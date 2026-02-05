// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// Package vamana implements the Vamana graph index algorithm for approximate nearest neighbor search.
//
// This file implements the disk-based Vamana index structure (DiskVamanaIndex),
// which stores the graph on disk while keeping frequently accessed data in memory:
//   - BBQ codes: 1-bit quantized vectors for fast distance estimation
//   - Neighbor lists: graph adjacency information
//   - Deleted bitmap: soft-delete tracking
//
// The disk index uses memory-mapped I/O for efficient random access to node data.
package vamana

import (
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"os"
	"sync"

	"github.com/siyuan-note/siyuan/kernel/vectordb/storage"
)

// ============================================================================
// Constants
// ============================================================================

const (
	// File extensions for disk index components
	diskIndexExt   = ".index"   // Main index file (graph header + node data)
	diskBBQExt     = ".bbq"     // BBQ quantization codes
	diskDeletedExt = ".deleted" // Deleted bitmap

	// BBQ file header constants
	bbqMagic           uint32 = 0x42425100 // "BBQ\0"
	bbqVersion         uint32 = 1          // 旧版本：仅包含打包码
	bbqVersionWithMeta uint32 = 2          // 新版本：包含量化元数据
	bbqHeaderSizeV1    int    = 16         // 版本 1 头部大小
	bbqHeaderSizeV2    int    = 24         // 版本 2 头部大小
)

// ============================================================================
// Errors
// ============================================================================

var (
	// ErrDiskIndexClosed indicates the disk index has been closed
	ErrDiskIndexClosed = errors.New("disk index is closed")

	// ErrBBQMagicMismatch indicates invalid BBQ file magic number
	ErrBBQMagicMismatch = errors.New("invalid BBQ file magic number")

	// ErrBBQVersionMismatch indicates unsupported BBQ file version
	ErrBBQVersionMismatch = errors.New("unsupported BBQ file version")
)

// ============================================================================
// DiskVamanaIndex Structure
// ============================================================================

// DiskVamanaIndex represents a disk-based Vamana graph index.
//
// Memory-resident data (for fast access):
//   - BBQ codes: 1-bit quantized vectors for distance estimation
//   - Neighbor lists: graph adjacency (loaded on demand or fully cached)
//   - Deleted bitmap: soft-delete tracking
//
// Disk-resident data (accessed via mmap):
//   - Original vectors: full-precision float32 vectors
//   - Graph metadata: dimension, node count, medoid, etc.
//
// Thread-safety:
//   - Read operations are safe for concurrent access
//   - Write operations require external synchronization
type DiskVamanaIndex struct {
	// Index metadata
	basePath  string                 // Base path without extension
	metadata  *storage.GraphMetadata // Graph metadata from disk
	maxDegree int                    // Maximum out-degree (calculated from metadata)

	// Disk I/O
	reader storage.DiskIndexReader // Disk index reader (mmap-based)

	// Memory-resident data
	bbqCodes         []byte                 // Packed BBQ codes (1-bit per dimension)
	bbqCentroid      []float32              // BBQ 质心向量
	bbqLowerBounds   []float32              // 量化区间下界
	bbqUpperBounds   []float32              // 量化区间上界
	bbqCorrections   []float32              // 校正因子
	bbqQuantizedSums []float32              // 量化分量和
	bbqHasMeta       bool                   // 是否有量化元数据
	neighbors        [][]uint32             // Neighbor lists (fully loaded in memory)
	deleted          *storage.DeletedBitmap // Deleted node bitmap

	// State
	closed bool         // Whether the index is closed
	mu     sync.RWMutex // Protects closed state and write operations
}

// ============================================================================
// Constructor and Destructor
// ============================================================================

// Open opens a disk-based Vamana index from the specified path.
//
// The path should be the base path without extension. The function will
// look for the following files:
//   - {path}.index: Main index file with graph header and node data
//   - {path}.bbq: BBQ quantization codes (optional)
//   - {path}.deleted: Deleted bitmap (optional, created if not exists)
//
// Parameters:
//   - path: Base path to the index files (without extension)
//
// Returns the opened index, or error if:
//   - Index file does not exist or cannot be opened
//   - Index file is corrupted or has incompatible version
//   - Memory allocation fails
//
// Example:
//
//	idx, err := vamana.Open("/data/vectors/my_index")
//	if err != nil {
//	    return err
//	}
//	defer idx.Close()
func Open(path string) (*DiskVamanaIndex, error) {
	idx := &DiskVamanaIndex{
		basePath: path,
		closed:   false,
	}

	// Open main index file
	indexPath := path + diskIndexExt
	reader, err := openDiskIndexReader(indexPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open index file: %w", err)
	}
	idx.reader = reader
	idx.metadata = reader.Metadata()

	// Calculate max degree from metadata
	idx.maxDegree = storage.CalcMaxDegree(
		int(idx.metadata.NodeLen),
		int(idx.metadata.Dims),
		int(idx.metadata.AssocDataLength),
	)

	// Load BBQ codes (optional)
	bbqPath := path + diskBBQExt
	if err := idx.loadBBQCodes(bbqPath); err != nil {
		// BBQ file is optional, log warning but continue
		// In production, use proper logging
		_ = err
	}

	// Load neighbor lists into memory
	if err := idx.loadNeighbors(); err != nil {
		idx.reader.Close()
		return nil, fmt.Errorf("failed to load neighbors: %w", err)
	}

	// Load deleted bitmap (creates empty if not exists)
	deletedPath := path + diskDeletedExt
	deleted, err := storage.LoadDeletedBitmap(deletedPath)
	if err != nil {
		idx.reader.Close()
		return nil, fmt.Errorf("failed to load deleted bitmap: %w", err)
	}
	idx.deleted = deleted

	return idx, nil
}

// Close releases all resources associated with the disk index.
//
// After Close is called, all operations on the index will return ErrDiskIndexClosed.
// It is safe to call Close multiple times.
//
// Returns error if the underlying reader fails to close.
func (idx *DiskVamanaIndex) Close() error {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	if idx.closed {
		return nil
	}

	idx.closed = true

	// Save deleted bitmap if dirty
	if idx.deleted != nil && idx.deleted.IsDirty() {
		deletedPath := idx.basePath + diskDeletedExt
		if err := storage.SaveDeletedBitmap(deletedPath, idx.deleted); err != nil {
			// Log error but continue closing
			_ = err
		}
	}

	// Close disk reader
	if idx.reader != nil {
		if err := idx.reader.Close(); err != nil {
			return fmt.Errorf("failed to close reader: %w", err)
		}
	}

	// Clear memory-resident data
	idx.bbqCodes = nil
	idx.neighbors = nil
	idx.deleted = nil

	return nil
}

// ============================================================================
// Internal Loading Functions
// ============================================================================

// loadBBQCodes loads BBQ quantization codes from disk.
//
// BBQ file format (版本 1):
//   - Magic (4 bytes): 0x42425100 ("BBQ\0")
//   - Version (4 bytes): 1
//   - NumVectors (8 bytes): number of vectors
//   - Codes: byte[numVectors * packedSize]
//
// BBQ file format (版本 2, 包含量化元数据):
//   - Magic (4 bytes): 0x42425100 ("BBQ\0")
//   - Version (4 bytes): 2
//   - NumVectors (8 bytes): 向量数量
//   - Dimension (4 bytes): 向量维度
//   - Reserved (4 bytes): 保留字段
//   - Centroid (dimension * 4 bytes): 质心向量
//   - PackedCodes (numVectors * packedSize bytes): 打包的 BBQ 码
//   - LowerBounds (numVectors * 4 bytes): 量化区间下界
//   - UpperBounds (numVectors * 4 bytes): 量化区间上界
//   - Corrections (numVectors * 4 bytes): 校正因子
//   - QuantizedSums (numVectors * 4 bytes): 量化分量和
//
// Parameters:
//   - path: Path to the BBQ file
//
// Returns nil if file doesn't exist (BBQ is optional).
func (idx *DiskVamanaIndex) loadBBQCodes(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // BBQ file is optional
		}
		return err
	}

	// Validate header size (至少需要 16 字节)
	if len(data) < bbqHeaderSizeV1 {
		return ErrBBQMagicMismatch
	}

	// Validate magic number
	magic := binary.LittleEndian.Uint32(data[0:4])
	if magic != bbqMagic {
		return ErrBBQMagicMismatch
	}

	// Read version
	version := binary.LittleEndian.Uint32(data[4:8])

	switch version {
	case bbqVersion:
		return idx.loadBBQCodesV1(data)
	case bbqVersionWithMeta:
		return idx.loadBBQCodesV2(data)
	default:
		return ErrBBQVersionMismatch
	}
}

// loadBBQCodesV1 加载版本 1 的 BBQ 文件（仅包含打包码，无量化元数据）
func (idx *DiskVamanaIndex) loadBBQCodesV1(data []byte) error {
	// Read number of vectors
	numVectors := binary.LittleEndian.Uint64(data[8:16])

	// Calculate packed size per vector
	packedSize := (int(idx.metadata.Dims) + 7) / 8

	// Validate data size
	expectedSize := bbqHeaderSizeV1 + int(numVectors)*packedSize
	if len(data) < expectedSize {
		return storage.ErrCorruptedFile
	}

	// Copy BBQ codes
	idx.bbqCodes = make([]byte, int(numVectors)*packedSize)
	copy(idx.bbqCodes, data[bbqHeaderSizeV1:bbqHeaderSizeV1+len(idx.bbqCodes)])

	// 版本 1 没有量化元数据
	idx.bbqHasMeta = false

	return nil
}

// loadBBQCodesV2 加载版本 2 的 BBQ 文件（包含完整量化元数据）
func (idx *DiskVamanaIndex) loadBBQCodesV2(data []byte) error {
	// Validate header size
	if len(data) < bbqHeaderSizeV2 {
		return storage.ErrCorruptedFile
	}

	// Read header
	numVectors := binary.LittleEndian.Uint64(data[8:16])
	dimension := binary.LittleEndian.Uint32(data[16:20])
	// reserved := binary.LittleEndian.Uint32(data[20:24]) // 保留字段

	// Validate dimension
	if int(dimension) != int(idx.metadata.Dims) {
		return fmt.Errorf("BBQ dimension mismatch: file=%d, index=%d", dimension, idx.metadata.Dims)
	}

	packedSize := (int(dimension) + 7) / 8
	n := int(numVectors)

	// 计算各部分的偏移量和大小
	centroidSize := int(dimension) * 4
	codesSize := n * packedSize
	metaSize := n * 4 // 每个元数据数组的大小

	expectedSize := bbqHeaderSizeV2 + centroidSize + codesSize + metaSize*4
	if len(data) < expectedSize {
		return storage.ErrCorruptedFile
	}

	offset := bbqHeaderSizeV2

	// 读取质心向量
	idx.bbqCentroid = make([]float32, dimension)
	for i := 0; i < int(dimension); i++ {
		idx.bbqCentroid[i] = math.Float32frombits(binary.LittleEndian.Uint32(data[offset:]))
		offset += 4
	}

	// 读取打包的 BBQ 码
	idx.bbqCodes = make([]byte, codesSize)
	copy(idx.bbqCodes, data[offset:offset+codesSize])
	offset += codesSize

	// 读取 LowerBounds
	idx.bbqLowerBounds = make([]float32, n)
	for i := 0; i < n; i++ {
		idx.bbqLowerBounds[i] = math.Float32frombits(binary.LittleEndian.Uint32(data[offset:]))
		offset += 4
	}

	// 读取 UpperBounds
	idx.bbqUpperBounds = make([]float32, n)
	for i := 0; i < n; i++ {
		idx.bbqUpperBounds[i] = math.Float32frombits(binary.LittleEndian.Uint32(data[offset:]))
		offset += 4
	}

	// 读取 Corrections
	idx.bbqCorrections = make([]float32, n)
	for i := 0; i < n; i++ {
		idx.bbqCorrections[i] = math.Float32frombits(binary.LittleEndian.Uint32(data[offset:]))
		offset += 4
	}

	// 读取 QuantizedSums
	idx.bbqQuantizedSums = make([]float32, n)
	for i := 0; i < n; i++ {
		idx.bbqQuantizedSums[i] = math.Float32frombits(binary.LittleEndian.Uint32(data[offset:]))
		offset += 4
	}

	idx.bbqHasMeta = true

	return nil
}

// loadNeighbors loads all neighbor lists from disk into memory.
//
// This provides fast access to graph structure during search,
// at the cost of memory usage proportional to graph size.
func (idx *DiskVamanaIndex) loadNeighbors() error {
	numPoints := idx.metadata.NumPoints
	idx.neighbors = make([][]uint32, numPoints)

	// Allocate buffer for reading nodes
	nodeLen := int(idx.metadata.NodeLen)
	buf := make([]byte, nodeLen)

	for i := uint64(0); i < numPoints; i++ {
		if err := idx.reader.ReadNode(i, buf); err != nil {
			return fmt.Errorf("failed to read node %d: %w", i, err)
		}

		neighbors, err := storage.ParseNeighborsFromBuffer(buf, int(idx.metadata.Dims))
		if err != nil {
			return fmt.Errorf("failed to parse neighbors for node %d: %w", i, err)
		}

		// Copy neighbors to avoid referencing buffer
		idx.neighbors[i] = make([]uint32, len(neighbors))
		copy(idx.neighbors[i], neighbors)
	}

	return nil
}

// ============================================================================
// Accessor Methods
// ============================================================================

// NumPoints returns the number of points in the index (excluding deleted).
func (idx *DiskVamanaIndex) NumPoints() uint64 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return 0
	}

	return idx.metadata.NumPoints - idx.deleted.CountDeleted()
}

// NumPointsTotal returns the total number of points (including deleted).
func (idx *DiskVamanaIndex) NumPointsTotal() uint64 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return 0
	}

	return idx.metadata.NumPoints
}

// Dimension returns the vector dimension.
func (idx *DiskVamanaIndex) Dimension() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return 0
	}

	return int(idx.metadata.Dims)
}

// Medoid returns the entry point (medoid) node ID.
func (idx *DiskVamanaIndex) Medoid() uint64 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return 0
	}

	return idx.metadata.Medoid
}

// MaxDegree returns the maximum out-degree of the graph.
func (idx *DiskVamanaIndex) MaxDegree() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return 0
	}

	return idx.maxDegree
}

// GetNeighbors returns the neighbor list for the specified node.
//
// Returns nil if the node doesn't exist or the index is closed.
func (idx *DiskVamanaIndex) GetNeighbors(nodeID uint64) []uint32 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed || nodeID >= uint64(len(idx.neighbors)) {
		return nil
	}

	return idx.neighbors[nodeID]
}

// IsDeleted checks if a node is marked as deleted.
func (idx *DiskVamanaIndex) IsDeleted(nodeID uint64) bool {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return false
	}

	return idx.deleted.IsDeleted(nodeID)
}

// HasBBQ returns true if BBQ codes are loaded.
func (idx *DiskVamanaIndex) HasBBQ() bool {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return idx.bbqCodes != nil
}

// HasBBQMeta returns true if BBQ quantization metadata is loaded.
// This indicates the BBQ file was saved with version 2 format.
func (idx *DiskVamanaIndex) HasBBQMeta() bool {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return idx.bbqHasMeta
}

// GetBBQCode returns the BBQ code for the specified node.
//
// Returns nil if BBQ is not enabled or node doesn't exist.
func (idx *DiskVamanaIndex) GetBBQCode(nodeID uint64) []byte {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed || idx.bbqCodes == nil {
		return nil
	}

	packedSize := (int(idx.metadata.Dims) + 7) / 8
	start := int(nodeID) * packedSize
	end := start + packedSize

	if end > len(idx.bbqCodes) {
		return nil
	}

	return idx.bbqCodes[start:end]
}

// ReadVector reads the original vector for the specified node.
//
// This reads from disk and should be used sparingly (e.g., for reranking).
func (idx *DiskVamanaIndex) ReadVector(nodeID uint64) ([]float32, error) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return nil, ErrDiskIndexClosed
	}

	vec := make([]float32, idx.metadata.Dims)
	if err := idx.reader.ReadVector(nodeID, vec); err != nil {
		return nil, err
	}

	return vec, nil
}

// ============================================================================
// Platform-specific Reader Factory
// ============================================================================

// OpenDiskIndexReader is a package-level variable for opening disk index readers.
//
// This can be overridden for testing purposes. By default, it is nil and
// openDiskIndexReader will return an error indicating no implementation.
//
// In production, this should be set to the platform-specific implementation
// from the storage package.
var OpenDiskIndexReader func(path string, readOnly bool) (storage.DiskIndexReader, error)

// openDiskIndexReader opens a disk index reader using the configured factory.
//
// If OpenDiskIndexReader is not set, returns an error.
func openDiskIndexReader(path string) (storage.DiskIndexReader, error) {
	// Check if file exists first
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil, storage.ErrFileNotFound
	}

	if OpenDiskIndexReader == nil {
		return nil, fmt.Errorf("disk index reader not configured: set vamana.OpenDiskIndexReader")
	}

	return OpenDiskIndexReader(path, true) // read-only mode
}
