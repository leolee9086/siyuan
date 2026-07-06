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
// This file implements disk-based index building functionality (BuildFromVectors),
// which constructs a Vamana graph index directly to disk without requiring
// the entire index to fit in memory during the build process.
//
// Key features:
//   - Streaming write to disk with sector alignment (4096 bytes)
//   - I/O alignment at 512-byte boundaries
//   - Medoid calculation for navigation point
//   - Optional BBQ quantization metadata
package vamana

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"runtime"
	"sync"

	"s-forge.local/vectordb/bbq"
	"s-forge.local/vectordb/storage"
)

// ============================================================================
// Build Configuration
// ============================================================================

// DiskBuildConfig 磁盘索引构建配置。
// 通过嵌入 Config 获得图参数 (R, L, Alpha 等)，避免字段重复。
type DiskBuildConfig struct {
	Config // 嵌入图参数 (R, L, Alpha, MaxOcclusionSize 等)

	// 构建参数
	NumWorkers int // 并行工作线程数 (默认: NumCPU)
	ChunkSize  int // 每批处理节点数 (默认: 10000)

	// 磁盘参数
	BlockSize       int  // 磁盘对齐块大小 (默认: 4096)
	WriteBufferSize int  // 写缓冲区大小 (默认: 16MB)
	EnableBBQ       bool // 启用 BBQ 量化 (默认: dim >= 64 时自动启用)
}

// DefaultDiskBuildConfig 返回磁盘构建的默认配置。
// 图参数继承自 DefaultConfig()，确保与内存索引使用相同的默认值。
func DefaultDiskBuildConfig() DiskBuildConfig {
	return DiskBuildConfig{
		Config:          DefaultConfig(),
		NumWorkers:      runtime.NumCPU(),
		ChunkSize:       10000,
		BlockSize:       SectorSize,
		WriteBufferSize: DefaultWriteBufferSize,
		EnableBBQ:       true,
	}
}

// Validate 验证并填充默认值。
// 图参数验证委托给嵌入的 Config.Validate()。
func (c *DiskBuildConfig) Validate(dimension int) {
	// 委托图参数验证给 Config
	c.Config.Validate()

	if c.NumWorkers <= 0 {
		c.NumWorkers = runtime.NumCPU()
	}
	if c.ChunkSize <= 0 {
		c.ChunkSize = 10000
	}
	if c.BlockSize <= 0 {
		c.BlockSize = SectorSize
	}
	if c.WriteBufferSize <= 0 {
		c.WriteBufferSize = DefaultWriteBufferSize
	}
	// 高维向量自动启用 BBQ 量化
	if dimension >= bbq.BBQEnableThreshold {
		c.EnableBBQ = true
	}
}

// ============================================================================
// Build Result
// ============================================================================

// DiskBuildResult contains statistics from the build process.
type DiskBuildResult struct {
	NumPoints     uint64 // Total number of points indexed
	Dimension     int    // Vector dimension
	Medoid        uint64 // Entry point (medoid) node ID
	MaxDegree     int    // Actual maximum degree used
	IndexFileSize uint64 // Size of the main index file
	BBQEnabled    bool   // Whether BBQ was enabled
}

// ============================================================================
// Main Build Function
// ============================================================================

// BuildFromVectors builds a disk-based Vamana index from a vector collection.
//
// This function constructs the index in the following steps:
//  1. Compute medoid (centroid-nearest point) as navigation entry
//  2. Build in-memory Vamana graph using parallel construction
//  3. Stream write graph data to disk with sector alignment
//  4. Write BBQ quantization data if enabled
//
// Parameters:
//   - path: Base path for output files (without extension)
//   - vectors: Input vector collection (each vector must have same dimension)
//   - config: Build configuration (use DefaultDiskBuildConfig() for defaults)
//
// Output files:
//   - {path}.index: Main index file (header + node data)
//   - {path}.bbq: BBQ quantization codes (if enabled)
//
// Returns build result statistics, or error if:
//   - vectors is empty
//   - vectors have inconsistent dimensions
//   - file creation fails
//   - write fails
//
// Example:
//
//	vectors := loadVectors("sift10k.fvecs")
//	config := vamana.DefaultDiskBuildConfig()
//	result, err := vamana.BuildFromVectors("/data/index", vectors, config)
//	if err != nil {
//	    return err
//	}
//	fmt.Printf("Built index with %d points, medoid=%d\n", result.NumPoints, result.Medoid)
func BuildFromVectors(path string, vectors [][]float32, config DiskBuildConfig) (*DiskBuildResult, error) {
	if len(vectors) == 0 {
		return nil, ErrVectorsEmpty
	}

	// 验证维度一致性
	dimension := len(vectors[0])
	if dimension == 0 {
		return nil, ErrDimensionZero
	}
	for i, v := range vectors {
		if len(v) != dimension {
			return nil, fmt.Errorf("%w at vector %d: expected %d, got %d", ErrDimensionInconsistent, i, dimension, len(v))
		}
	}

	// Validate and fill config defaults
	config.Validate(dimension)

	// Create builder
	builder := &diskBuilder{
		path:      path,
		vectors:   vectors,
		dimension: dimension,
		config:    config,
	}

	return builder.build()
}

// ============================================================================
// Internal Builder
// ============================================================================

// diskBuilder handles the disk index building process.
type diskBuilder struct {
	path      string
	vectors   [][]float32
	dimension int
	config    DiskBuildConfig

	// Computed during build
	medoid      uint32
	neighbors   [][]uint32
	normSquares []float32

	// BBQ data (if enabled)
	bbqEnabled       bool
	bbqPacked        []byte
	bbqCentroid      []float32
	bbqLowerBounds   []float32
	bbqUpperBounds   []float32
	bbqCompensations []float32
	bbqQuantizedSums []float32
}

// build executes the complete build process.
func (b *diskBuilder) build() (*DiskBuildResult, error) {
	n := len(b.vectors)

	// Step 1: Precompute norm squares for fast distance calculation
	b.precomputeNormSquares()

	// Step 2: Compute medoid
	b.medoid = b.computeMedoid()

	// Step 3: Build in-memory graph
	if err := b.buildGraph(); err != nil {
		return nil, fmt.Errorf("failed to build graph: %w", err)
	}

	// Step 4: Compute BBQ data if enabled
	if b.config.EnableBBQ && b.dimension >= bbq.BBQEnableThreshold {
		b.bbqEnabled = true
		b.computeBBQData()
	}

	// Step 5: Write index file
	indexFileSize, err := b.writeIndexFile()
	if err != nil {
		return nil, fmt.Errorf("failed to write index file: %w", err)
	}

	// Step 6: Write BBQ file if enabled
	if b.bbqEnabled {
		if err := b.writeBBQFile(); err != nil {
			return nil, fmt.Errorf("failed to write BBQ file: %w", err)
		}
	}

	// Compute actual max degree
	actualMaxDegree := 0
	for _, neighbors := range b.neighbors {
		if len(neighbors) > actualMaxDegree {
			actualMaxDegree = len(neighbors)
		}
	}

	return &DiskBuildResult{
		NumPoints:     uint64(n),
		Dimension:     b.dimension,
		Medoid:        uint64(b.medoid),
		MaxDegree:     actualMaxDegree,
		IndexFileSize: indexFileSize,
		BBQEnabled:    b.bbqEnabled,
	}, nil
}

// ============================================================================
// Medoid Computation
// ============================================================================

// computeMedoid finds the point closest to the centroid.
//
// The medoid serves as the entry point for graph traversal during search.
// Using the centroid-nearest point ensures good coverage of the data distribution.
func (b *diskBuilder) computeMedoid() uint32 {
	n := len(b.vectors)
	if n == 0 {
		return math.MaxUint32
	}
	if n == 1 {
		return 0
	}

	// Compute centroid
	centroid := make([]float32, b.dimension)
	for _, v := range b.vectors {
		for i := range v {
			centroid[i] += v[i]
		}
	}
	invN := 1.0 / float32(n)
	for i := range centroid {
		centroid[i] *= invN
	}

	// Find point closest to centroid
	var minDist float32 = math.MaxFloat32
	var medoid uint32 = 0
	for i, v := range b.vectors {
		dist := euclideanDistance(v, centroid)
		if dist < minDist {
			minDist = dist
			medoid = uint32(i)
		}
	}

	return medoid
}

// precomputeNormSquares 预计算所有向量的范数平方
func (b *diskBuilder) precomputeNormSquares() {
	b.normSquares = precomputeNorms(b.vectors)
}

// ============================================================================
// Graph Building
// ============================================================================

// buildGraph 在内存中构建 Vamana 图结构。
// 直接使用 DiskBuildConfig 嵌入的 Config 图参数，无需手动拷贝。
func (b *diskBuilder) buildGraph() error {
	n := len(b.vectors)

	// 初始化邻居列表
	b.neighbors = make([][]uint32, n)
	for i := range b.neighbors {
		b.neighbors[i] = make([]uint32, 0, b.config.R)
	}

	// 直接使用嵌入的 Config 构建内存索引，无需手动拷贝字段
	idx := New(b.dimension, b.config.Config)
	if err := idx.BuildParallel(b.vectors, b.config.NumWorkers); err != nil {
		return err
	}

	// Copy neighbors from memory index
	for i := 0; i < n; i++ {
		b.neighbors[i] = idx.GetNeighbors(uint32(i))
	}

	// Update medoid from the built index (it may have been refined)
	b.medoid = idx.medoid

	return nil
}

// ============================================================================
// BBQ Computation
// ============================================================================

// computeBBQData computes BBQ quantization data for all vectors.
func (b *diskBuilder) computeBBQData() {
	n := len(b.vectors)
	packedSize := (b.dimension + 7) / 8

	// Compute centroid for BBQ
	b.bbqCentroid = make([]float32, b.dimension)
	for _, v := range b.vectors {
		for i := range v {
			b.bbqCentroid[i] += v[i]
		}
	}
	invN := 1.0 / float32(n)
	for i := range b.bbqCentroid {
		b.bbqCentroid[i] *= invN
	}

	// Initialize BBQ arrays
	b.bbqPacked = make([]byte, n*packedSize)
	b.bbqLowerBounds = make([]float32, n)
	b.bbqUpperBounds = make([]float32, n)
	b.bbqCompensations = make([]float32, n)
	b.bbqQuantizedSums = make([]float32, n)

	// Create quantizer
	// 使用配置中的距离度量，与图构建保持一致
	quantizer := bbq.NewScalarQuantizer(b.config.DistanceMetric)

	// Parallel BBQ computation
	numWorkers := b.config.NumWorkers
	if numWorkers > n {
		numWorkers = n
	}

	var wg sync.WaitGroup
	chunkSize := (n + numWorkers - 1) / numWorkers

	for w := 0; w < numWorkers; w++ {
		start := w * chunkSize
		end := start + chunkSize
		if end > n {
			end = n
		}
		if start >= end {
			continue
		}

		wg.Add(1)
		go func(start, end int) {
			defer wg.Done()
			b.computeBBQChunk(quantizer, start, end, packedSize)
		}(start, end)
	}

	wg.Wait()
}

// computeBBQChunk computes BBQ data for a chunk of vectors.
func (b *diskBuilder) computeBBQChunk(quantizer *bbq.ScalarQuantizer, start, end, packedSize int) {
	// Each worker has its own temporary buffer
	quantized := make([]byte, b.dimension)

	for i := start; i < end; i++ {
		vec := b.vectors[i]

		// Quantize vector (1-bit quantization)
		result := quantizer.Quantize(vec, quantized, 1, b.bbqCentroid)

		// Pack binary data for POPCNT optimization
		packed := bbq.PackBinary(quantized)

		// Store packed code
		copy(b.bbqPacked[i*packedSize:(i+1)*packedSize], packed)

		// Store metadata
		b.bbqLowerBounds[i] = result.LowerBound
		b.bbqUpperBounds[i] = result.UpperBound
		b.bbqCompensations[i] = result.Correction
		b.bbqQuantizedSums[i] = result.QuantizedSum
	}
}

// ============================================================================
// Index File Writing
// ============================================================================

// writeIndexFile writes the main index file with sector alignment.
func (b *diskBuilder) writeIndexFile() (uint64, error) {
	indexPath := b.path + diskIndexExt

	f, err := os.Create(indexPath)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	// Use buffered writer
	w := bufio.NewWriterSize(f, b.config.WriteBufferSize)

	numPoints := uint64(len(b.vectors))
	dims := uint64(b.dimension)

	// Calculate actual max degree from built graph
	actualMaxDegree := uint64(0)
	for _, neighbors := range b.neighbors {
		if neighbors != nil && uint64(len(neighbors)) > actualMaxDegree {
			actualMaxDegree = uint64(len(neighbors))
		}
	}
	// Use at least configured R
	if actualMaxDegree < uint64(b.config.R) {
		actualMaxDegree = uint64(b.config.R)
	}

	// Calculate node length: vector(dims*4) + neighborCount(4) + neighbors(maxDegree*4)
	nodeLen := dims*4 + 4 + actualMaxDegree*4
	blockSize := uint64(b.config.BlockSize)
	nodesPerBlock := blockSize / nodeLen
	if nodesPerBlock == 0 {
		nodesPerBlock = 1
	}

	// Calculate total file size
	numBlocks := (numPoints + nodesPerBlock - 1) / nodesPerBlock
	dataSize := numBlocks * nodesPerBlock * nodeLen
	totalSize := blockSize + dataSize // Header block + data blocks

	// Build header
	header := &storage.GraphHeader{
		Meta: storage.GraphMetadata{
			NumPoints:       numPoints,
			Dims:            dims,
			Medoid:          uint64(b.medoid),
			NodeLen:         nodeLen,
			NodesPerBlock:   nodesPerBlock,
			FrozenNum:       0,
			FrozenLoc:       0,
			Reserved:        0,
			IndexFileSize:   totalSize,
			AssocDataLength: 0,
		},
		BlockSize: blockSize,
		Version: storage.LayoutVersion{
			Major: storage.CurrentMajorVersion,
			Minor: storage.CurrentMinorVersion,
		},
	}

	// Write header
	if err := storage.WriteGraphHeader(w, header); err != nil {
		return 0, err
	}

	// Pad header block to blockSize
	headerWritten := 4 + 80 + 8 + 8 // magic + metadata + blockSize + version
	padding := make([]byte, blockSize-uint64(headerWritten))
	if _, err := w.Write(padding); err != nil {
		return 0, err
	}

	// Write node data
	maxDegreeInt := int(actualMaxDegree)
	nodeData := make([]byte, nodeLen)
	for i := uint64(0); i < numPoints; i++ {
		b.serializeNode(uint32(i), nodeData, maxDegreeInt)
		if _, err := w.Write(nodeData); err != nil {
			return 0, err
		}
	}

	// Pad last block
	remainder := numPoints % nodesPerBlock
	if remainder != 0 {
		paddingNodes := nodesPerBlock - remainder
		emptyNode := make([]byte, nodeLen)
		for i := uint64(0); i < paddingNodes; i++ {
			if _, err := w.Write(emptyNode); err != nil {
				return 0, err
			}
		}
	}

	// Flush and sync
	if err := w.Flush(); err != nil {
		return 0, err
	}

	if err := f.Sync(); err != nil {
		return 0, err
	}

	return totalSize, nil
}

// serializeNode serializes a single node to the buffer.
func (b *diskBuilder) serializeNode(id uint32, buf []byte, maxDegree int) {
	offset := 0

	// Write vector
	vec := b.vectors[id]
	for _, v := range vec {
		binary.LittleEndian.PutUint32(buf[offset:], math.Float32bits(v))
		offset += 4
	}

	// Get neighbors
	neighbors := b.neighbors[id]
	if neighbors == nil {
		neighbors = []uint32{}
	}

	// Write neighbor count
	binary.LittleEndian.PutUint32(buf[offset:], uint32(len(neighbors)))
	offset += 4

	// Write neighbor IDs
	for _, n := range neighbors {
		binary.LittleEndian.PutUint32(buf[offset:], n)
		offset += 4
	}

	// Pad remaining slots with sentinel value
	for i := len(neighbors); i < maxDegree; i++ {
		binary.LittleEndian.PutUint32(buf[offset:], 0xFFFFFFFF)
		offset += 4
	}
}

// ============================================================================
// BBQ File Writing
// ============================================================================

// writeBBQFile writes the BBQ quantization file.
//
// BBQ file format (version 2):
//   - Magic (4 bytes): 0x42425100 ("BBQ\0")
//   - Version (4 bytes): 2
//   - NumVectors (8 bytes): number of vectors
//   - Dimension (4 bytes): vector dimension
//   - Reserved (4 bytes): reserved field
//   - Centroid (dimension * 4 bytes): centroid vector
//   - PackedCodes (numVectors * packedSize bytes): packed BBQ codes
//   - LowerBounds (numVectors * 4 bytes): quantization lower bounds
//   - UpperBounds (numVectors * 4 bytes): quantization upper bounds
//   - Corrections (numVectors * 4 bytes): correction factors
//   - QuantizedSums (numVectors * 4 bytes): quantized component sums
func (b *diskBuilder) writeBBQFile() error {
	bbqPath := b.path + diskBBQExt

	f, err := os.Create(bbqPath)
	if err != nil {
		return err
	}
	defer f.Close()

	w := bufio.NewWriter(f)

	numPoints := uint64(len(b.vectors))
	dimension := uint32(b.dimension)

	// Write header
	header := make([]byte, bbqHeaderSize)
	binary.LittleEndian.PutUint32(header[0:], bbqMagic)
	binary.LittleEndian.PutUint32(header[4:], bbqVersion)
	binary.LittleEndian.PutUint64(header[8:], numPoints)
	binary.LittleEndian.PutUint32(header[16:], dimension)
	binary.LittleEndian.PutUint32(header[20:], 0) // Reserved

	if _, err := w.Write(header); err != nil {
		return err
	}

	// Write centroid
	centroidBuf := make([]byte, b.dimension*4)
	for i, v := range b.bbqCentroid {
		binary.LittleEndian.PutUint32(centroidBuf[i*4:], math.Float32bits(v))
	}
	if _, err := w.Write(centroidBuf); err != nil {
		return err
	}

	// Write packed BBQ codes
	if _, err := w.Write(b.bbqPacked); err != nil {
		return err
	}

	// Write metadata arrays
	metaBuf := make([]byte, 4)

	// LowerBounds
	for _, v := range b.bbqLowerBounds {
		binary.LittleEndian.PutUint32(metaBuf, math.Float32bits(v))
		if _, err := w.Write(metaBuf); err != nil {
			return err
		}
	}

	// UpperBounds
	for _, v := range b.bbqUpperBounds {
		binary.LittleEndian.PutUint32(metaBuf, math.Float32bits(v))
		if _, err := w.Write(metaBuf); err != nil {
			return err
		}
	}

	// Corrections (compensations)
	for _, v := range b.bbqCompensations {
		binary.LittleEndian.PutUint32(metaBuf, math.Float32bits(v))
		if _, err := w.Write(metaBuf); err != nil {
			return err
		}
	}

	// QuantizedSums
	for _, v := range b.bbqQuantizedSums {
		binary.LittleEndian.PutUint32(metaBuf, math.Float32bits(v))
		if _, err := w.Write(metaBuf); err != nil {
			return err
		}
	}

	// Flush and sync
	if err := w.Flush(); err != nil {
		return err
	}

	return f.Sync()
}
