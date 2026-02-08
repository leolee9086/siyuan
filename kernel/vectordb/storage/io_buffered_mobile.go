//go:build ios || android

// Package storage provides a unified I/O abstraction layer for disk-based indexes.
//
// This file implements mobile platform (iOS/Android) buffered reader with LRU cache.
// Mobile platforms avoid mmap due to:
//   - iOS sandbox restrictions may cause issues with memory-mapped files
//   - Android may trigger ANR (Application Not Responding) with large mmap operations
//
// Instead, this implementation uses standard file I/O with an LRU node cache
// to balance memory usage and read performance.
package storage

import (
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"sync"
)

// Default cache configuration for mobile platforms
const (
	// DefaultMobileCacheCapacity default number of nodes to cache
	DefaultMobileCacheCapacity = 1000

	// DefaultBufferSize default read buffer size
	DefaultBufferSize = 4096
)

// mobileReader implements buffered disk index reader for mobile platforms.
//
// Uses standard file I/O with LRU cache for node data.
// Cache eviction strategy: clear all when capacity exceeded (simple but effective).
type mobileReader struct {
	file          *os.File          // underlying file handle
	meta          GraphMetadata     // parsed graph metadata
	blockSize     uint64            // data block size
	cacheCapacity int               // maximum number of cached nodes
	cache         map[uint64][]byte // LRU node cache: nodeID -> node data
	cacheMu       sync.RWMutex      // cache lock for concurrent access
	bufferPool    sync.Pool         // buffer pool for read operations
}

// platformOpenReader creates mobile platform buffered reader.
//
// Parameters:
//   - path: index file path
//   - readOnly: true for read-only mode, false for read-write mode
//     (mobile implementation only supports read-only mode)
//
// Returns DiskIndexReader interface implementation.
// Returns ErrFileNotFound if file does not exist.
func platformOpenReader(path string, readOnly bool) (DiskIndexReader, error) {
	// Mobile platform only supports read-only mode
	flags := os.O_RDONLY

	// Open file
	f, err := os.OpenFile(path, flags, 0)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrFileNotFound
		}
		return nil, fmt.Errorf("open index file failed: %w", err)
	}

	// Get file size
	stat, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, fmt.Errorf("get file info failed: %w", err)
	}

	fileSize := stat.Size()
	if fileSize < GraphHeaderSize {
		f.Close()
		return nil, ErrCorruptedFile
	}

	// Create reader instance
	r := &mobileReader{
		file:          f,
		cacheCapacity: DefaultMobileCacheCapacity,
		cache:         make(map[uint64][]byte),
		bufferPool: sync.Pool{
			New: func() interface{} {
				return make([]byte, DefaultBufferSize)
			},
		},
	}

	// Parse header
	if err := r.parseHeader(); err != nil {
		r.Close()
		return nil, err
	}

	return r, nil
}

// parseHeader parses graph header from file.
//
// Validates magic number and version, extracts metadata.
// Returns ErrInvalidMagic if magic number mismatch.
// Returns ErrVersionMismatch if version not supported.
func (r *mobileReader) parseHeader() error {
	// Read header bytes
	headerBuf := make([]byte, GraphHeaderSize)
	n, err := r.file.ReadAt(headerBuf, 0)
	if err != nil || n < GraphHeaderSize {
		return ErrCorruptedFile
	}

	// Read and validate magic number (first 4 bytes)
	magic := binary.LittleEndian.Uint32(headerBuf[0:4])
	if magic != MagicNumber {
		return ErrInvalidMagic
	}

	// Parse metadata (starting from offset 4, 80 bytes)
	offset := 4
	r.meta.NumPoints = binary.LittleEndian.Uint64(headerBuf[offset:])
	offset += 8
	r.meta.Dims = binary.LittleEndian.Uint64(headerBuf[offset:])
	offset += 8
	r.meta.Medoid = binary.LittleEndian.Uint64(headerBuf[offset:])
	offset += 8
	r.meta.NodeLen = binary.LittleEndian.Uint64(headerBuf[offset:])
	offset += 8
	r.meta.NodesPerBlock = binary.LittleEndian.Uint64(headerBuf[offset:])
	offset += 8
	r.meta.FrozenNum = binary.LittleEndian.Uint64(headerBuf[offset:])
	offset += 8
	r.meta.FrozenLoc = binary.LittleEndian.Uint64(headerBuf[offset:])
	offset += 8
	r.meta.Reserved = binary.LittleEndian.Uint64(headerBuf[offset:])
	offset += 8
	r.meta.IndexFileSize = binary.LittleEndian.Uint64(headerBuf[offset:])
	offset += 8
	r.meta.AssocDataLength = binary.LittleEndian.Uint64(headerBuf[offset:])
	offset += 8

	// Parse block size (8 bytes)
	r.blockSize = binary.LittleEndian.Uint64(headerBuf[offset:])
	offset += 8

	// Parse layout version (8 bytes)
	majorVersion := binary.LittleEndian.Uint32(headerBuf[offset:])
	// minorVersion := binary.LittleEndian.Uint32(headerBuf[offset+4:])

	// Validate version compatibility
	if majorVersion > CurrentMajorVersion {
		return ErrVersionMismatch
	}

	return nil
}

// calcOffset calculates byte offset in file for given nodeID.
//
// File layout:
//   - Block #0: header (blockSize bytes, typically 4096)
//   - Block #1..N: data blocks, each containing NodesPerBlock nodes
//
// Parameters:
//   - nodeID: node ID
//
// Returns node data start offset in file.
func (r *mobileReader) calcOffset(nodeID uint64) int64 {
	// Calculate block number and offset within block
	blockNum := nodeID / r.meta.NodesPerBlock
	indexInBlock := nodeID % r.meta.NodesPerBlock

	// Block #0 is header, data starts from Block #1
	// Each data block size = NodesPerBlock * NodeLen
	dataBlockSize := r.meta.NodesPerBlock * r.meta.NodeLen
	blockStartOffset := r.blockSize + blockNum*dataBlockSize
	nodeOffset := indexInBlock * r.meta.NodeLen

	return int64(blockStartOffset + nodeOffset)
}

// getFromCache retrieves node data from cache.
//
// Returns nil if not in cache.
// Thread-safe with read lock.
func (r *mobileReader) getFromCache(nodeID uint64) []byte {
	r.cacheMu.RLock()
	defer r.cacheMu.RUnlock()
	return r.cache[nodeID]
}

// addToCache adds node data to cache.
//
// If cache exceeds capacity, clears all cached data (simple eviction strategy).
// Thread-safe with write lock.
func (r *mobileReader) addToCache(nodeID uint64, data []byte) {
	r.cacheMu.Lock()
	defer r.cacheMu.Unlock()

	// Check if already cached
	if _, exists := r.cache[nodeID]; exists {
		return
	}

	// Clear cache if capacity exceeded
	if len(r.cache) >= r.cacheCapacity {
		// Simple eviction: clear all
		r.cache = make(map[uint64][]byte)
	}

	// Make a copy of data for cache
	cached := make([]byte, len(data))
	copy(cached, data)
	r.cache[nodeID] = cached
}

// readNodeFromDisk reads node data directly from disk.
//
// Uses buffer pool to reduce allocations.
func (r *mobileReader) readNodeFromDisk(nodeID uint64) ([]byte, error) {
	nodeLen := r.meta.NodeLen
	offset := r.calcOffset(nodeID)

	// Allocate buffer for node data
	data := make([]byte, nodeLen)

	// Read from file
	n, err := r.file.ReadAt(data, offset)
	if err != nil {
		return nil, fmt.Errorf("read node from disk failed: %w", err)
	}
	if uint64(n) < nodeLen {
		return nil, ErrCorruptedFile
	}

	return data, nil
}

// ReadNode reads complete node data into buffer.
//
// First checks cache, then reads from disk if not cached.
// Adds read data to cache for future access.
//
// Parameters:
//   - nodeID: node ID
//   - buf: target buffer, length must be >= node byte length
//
// Returns ErrNodeNotFound if nodeID out of range.
func (r *mobileReader) ReadNode(nodeID uint64, buf []byte) error {
	// Validate nodeID range
	if nodeID >= r.meta.NumPoints {
		return ErrNodeNotFound
	}

	// Validate buffer size
	nodeLen := r.meta.NodeLen
	if uint64(len(buf)) < nodeLen {
		return fmt.Errorf("buffer too small: need %d bytes, got %d bytes", nodeLen, len(buf))
	}

	// Try cache first
	if cached := r.getFromCache(nodeID); cached != nil {
		copy(buf, cached)
		return nil
	}

	// Read from disk
	data, err := r.readNodeFromDisk(nodeID)
	if err != nil {
		return err
	}

	// Add to cache
	r.addToCache(nodeID, data)

	// Copy to user buffer
	copy(buf, data)
	return nil
}

// ReadNeighbors returns neighbor ID list for specified node.
//
// First checks cache, then reads from disk if not cached.
// Returns a copy of neighbor IDs (not zero-copy like mmap implementation).
//
// Parameters:
//   - nodeID: node ID
//
// Returns neighbor ID list. Returns ErrNodeNotFound if node does not exist.
func (r *mobileReader) ReadNeighbors(nodeID uint64) ([]uint32, error) {
	// Validate nodeID range
	if nodeID >= r.meta.NumPoints {
		return nil, ErrNodeNotFound
	}

	// Get node data (from cache or disk)
	var nodeData []byte

	if cached := r.getFromCache(nodeID); cached != nil {
		nodeData = cached
	} else {
		data, err := r.readNodeFromDisk(nodeID)
		if err != nil {
			return nil, err
		}
		r.addToCache(nodeID, data)
		nodeData = data
	}

	// Node layout: [Vector][NeighborCount][NeighborIDs][AssocData]
	// Vector bytes = Dims * 4 (float32)
	vectorBytes := r.meta.Dims * 4
	neighborCountOffset := vectorBytes

	// Read neighbor count (uint32)
	neighborCount := binary.LittleEndian.Uint32(nodeData[neighborCountOffset:])
	if neighborCount == 0 {
		return []uint32{}, nil
	}

	// Neighbor IDs start position
	neighborIDsStart := neighborCountOffset + 4

	// Parse neighbor IDs
	neighbors := make([]uint32, neighborCount)
	for i := uint32(0); i < neighborCount; i++ {
		offset := neighborIDsStart + uint64(i)*4
		neighbors[i] = binary.LittleEndian.Uint32(nodeData[offset:])
	}

	return neighbors, nil
}

// ReadVector reads original vector of specified node into target slice.
//
// Used for rerank phase of search results.
//
// Parameters:
//   - nodeID: node ID
//   - vec: target slice, length must be >= vector dimension
//
// Returns ErrNodeNotFound if node does not exist.
// Returns ErrDimensionMismatch if target slice length insufficient.
func (r *mobileReader) ReadVector(nodeID uint64, vec []float32) error {
	// Validate nodeID range
	if nodeID >= r.meta.NumPoints {
		return ErrNodeNotFound
	}

	// Validate target slice size
	dims := r.meta.Dims
	if uint64(len(vec)) < dims {
		return ErrDimensionMismatch
	}

	// Get node data (from cache or disk)
	var nodeData []byte

	if cached := r.getFromCache(nodeID); cached != nil {
		nodeData = cached
	} else {
		data, err := r.readNodeFromDisk(nodeID)
		if err != nil {
			return err
		}
		r.addToCache(nodeID, data)
		nodeData = data
	}

	// Read vector data from node data
	// Vector is stored at the beginning of node data
	for i := uint64(0); i < dims; i++ {
		byteOffset := i * 4
		bits := binary.LittleEndian.Uint32(nodeData[byteOffset:])
		vec[i] = math.Float32frombits(bits)
	}

	return nil
}

// ReadVectorRef returns a vector slice for the specified node.
//
// On mobile platforms without mmap, this allocates a new []float32 and copies
// the vector data from the cached/disk node data. This is functionally equivalent
// to ReadVector but manages its own buffer.
//
// Parameters:
//   - nodeID: node ID
//
// Returns vector slice (allocated copy on mobile), ErrNodeNotFound if node does not exist.
func (r *mobileReader) ReadVectorRef(nodeID uint64) ([]float32, error) {
	// Validate nodeID range
	if nodeID >= r.meta.NumPoints {
		return nil, ErrNodeNotFound
	}

	dims := r.meta.Dims

	// Get node data (from cache or disk)
	var nodeData []byte

	if cached := r.getFromCache(nodeID); cached != nil {
		nodeData = cached
	} else {
		data, err := r.readNodeFromDisk(nodeID)
		if err != nil {
			return nil, err
		}
		r.addToCache(nodeID, data)
		nodeData = data
	}

	// Allocate and copy vector data
	vec := make([]float32, dims)
	for i := uint64(0); i < dims; i++ {
		byteOffset := i * 4
		bits := binary.LittleEndian.Uint32(nodeData[byteOffset:])
		vec[i] = math.Float32frombits(bits)
	}

	return vec, nil
}

// Metadata returns graph index metadata.
//
// Returned pointer points to internal data, caller should not modify.
func (r *mobileReader) Metadata() *GraphMetadata {
	return &r.meta
}

// Warmup preloads specified nodes into cache.
//
// For mobile buffered implementation, this reads nodes from disk
// and stores them in the LRU cache for faster subsequent access.
//
// Parameters:
//   - nodeIDs: list of node IDs to warmup
func (r *mobileReader) Warmup(nodeIDs []uint64) error {
	for _, nodeID := range nodeIDs {
		if nodeID >= r.meta.NumPoints {
			continue // skip invalid nodeID
		}

		// Skip if already cached
		if r.getFromCache(nodeID) != nil {
			continue
		}

		// Read from disk and add to cache
		data, err := r.readNodeFromDisk(nodeID)
		if err != nil {
			// Non-fatal: continue with other nodes
			continue
		}
		r.addToCache(nodeID, data)
	}
	return nil
}

// Close clears cache and closes file.
//
// Releases all resources. Reader should not be used after calling.
func (r *mobileReader) Close() error {
	// Clear cache
	r.cacheMu.Lock()
	r.cache = nil
	r.cacheMu.Unlock()

	// Close file
	if r.file != nil {
		if err := r.file.Close(); err != nil {
			return fmt.Errorf("close file failed: %w", err)
		}
		r.file = nil
	}

	return nil
}
