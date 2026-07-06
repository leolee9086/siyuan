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

package vamana

import (
	"encoding/binary"
	"math"
	"os"
	"path/filepath"
	"testing"

	"s-forge.local/vectordb/storage"
)

// ============================================================================
// Test Helpers
// ============================================================================

// testIndexParams holds parameters for creating test index files.
type testIndexParams struct {
	numPoints uint64
	dims      uint64
	maxDegree uint64
	blockSize uint64
}

// defaultTestParams returns default test parameters.
func defaultTestParams() testIndexParams {
	return testIndexParams{
		numPoints: 100,
		dims:      8,
		maxDegree: 16,
		blockSize: 4096,
	}
}

// createTestIndexFiles creates test index files (.index, .bbq, .deleted).
// Returns the base path (without extension) and cleanup function.
func createTestIndexFiles(t *testing.T, params testIndexParams) (string, func()) {
	t.Helper()

	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "test_vamana")

	// Create .index file
	createTestIndexFile(t, basePath+diskIndexExt, params)

	// Create .bbq file
	createTestBBQFile(t, basePath+diskBBQExt, params)

	return basePath, func() {
		os.RemoveAll(tmpDir)
	}
}

// createTestIndexFile creates a test .index file.
func createTestIndexFile(t *testing.T, path string, params testIndexParams) {
	t.Helper()

	nodeLen := params.dims*4 + 4 + params.maxDegree*4
	nodesPerBlock := params.blockSize / nodeLen
	if nodesPerBlock == 0 {
		nodesPerBlock = 1
	}

	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create index file failed: %v", err)
	}
	defer f.Close()

	// Write header block
	header := make([]byte, params.blockSize)
	writeIndexHeader(header, params, nodeLen, nodesPerBlock)

	if _, err := f.Write(header); err != nil {
		t.Fatalf("write header failed: %v", err)
	}

	// Write node data
	for i := uint64(0); i < params.numPoints; i++ {
		nodeData := createTestNodeData(i, params)
		if _, err := f.Write(nodeData); err != nil {
			t.Fatalf("write node %d failed: %v", i, err)
		}
	}

	// Pad to complete blocks
	numBlocks := (params.numPoints + nodesPerBlock - 1) / nodesPerBlock
	totalSize := params.blockSize + numBlocks*nodesPerBlock*nodeLen
	currentSize, _ := f.Seek(0, 2)
	if uint64(currentSize) < totalSize {
		padding := make([]byte, totalSize-uint64(currentSize))
		f.Write(padding)
	}
}

// writeIndexHeader writes the graph header to the buffer.
func writeIndexHeader(buf []byte, params testIndexParams, nodeLen, nodesPerBlock uint64) {
	// Magic number
	binary.LittleEndian.PutUint32(buf[0:], storage.MagicNumber)

	offset := 4
	// GraphMetadata (80 bytes)
	binary.LittleEndian.PutUint64(buf[offset:], params.numPoints)
	offset += 8
	binary.LittleEndian.PutUint64(buf[offset:], params.dims)
	offset += 8
	binary.LittleEndian.PutUint64(buf[offset:], 0) // medoid
	offset += 8
	binary.LittleEndian.PutUint64(buf[offset:], nodeLen)
	offset += 8
	binary.LittleEndian.PutUint64(buf[offset:], nodesPerBlock)
	offset += 8
	binary.LittleEndian.PutUint64(buf[offset:], 0) // frozenNum
	offset += 8
	binary.LittleEndian.PutUint64(buf[offset:], 0) // frozenLoc
	offset += 8
	binary.LittleEndian.PutUint64(buf[offset:], 0) // reserved
	offset += 8

	// Calculate total file size
	numBlocks := (params.numPoints + nodesPerBlock - 1) / nodesPerBlock
	totalSize := params.blockSize + numBlocks*nodesPerBlock*nodeLen
	binary.LittleEndian.PutUint64(buf[offset:], totalSize)
	offset += 8
	binary.LittleEndian.PutUint64(buf[offset:], 0) // assocDataLength
	offset += 8

	// Block size
	binary.LittleEndian.PutUint64(buf[offset:], params.blockSize)
	offset += 8

	// Layout version
	binary.LittleEndian.PutUint32(buf[offset:], storage.CurrentMajorVersion)
	binary.LittleEndian.PutUint32(buf[offset+4:], storage.CurrentMinorVersion)
}

// createTestNodeData creates test node data for a given node ID.
func createTestNodeData(nodeID uint64, params testIndexParams) []byte {
	nodeLen := params.dims*4 + 4 + params.maxDegree*4
	data := make([]byte, nodeLen)
	offset := 0

	// Write vector: value = nodeID * 0.1 + dimIndex * 0.01
	for d := uint64(0); d < params.dims; d++ {
		val := float32(nodeID)*0.1 + float32(d)*0.01
		binary.LittleEndian.PutUint32(data[offset:], math.Float32bits(val))
		offset += 4
	}

	// Write neighbor count
	neighborCount := uint32((nodeID % params.maxDegree) + 1)
	if neighborCount > uint32(params.maxDegree) {
		neighborCount = uint32(params.maxDegree)
	}
	binary.LittleEndian.PutUint32(data[offset:], neighborCount)
	offset += 4

	// Write neighbor IDs
	for n := uint32(0); n < neighborCount; n++ {
		neighborID := (uint32(nodeID) + n + 1) % uint32(params.numPoints)
		binary.LittleEndian.PutUint32(data[offset:], neighborID)
		offset += 4
	}

	return data
}

// createTestBBQFile creates a test .bbq file（单一格式：头部 + 质心 + 量化码 + 四个元数据数组）。
func createTestBBQFile(t *testing.T, path string, params testIndexParams) {
	t.Helper()

	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create BBQ file failed: %v", err)
	}
	defer f.Close()

	// Write header (24 bytes)
	header := make([]byte, bbqHeaderSize)
	binary.LittleEndian.PutUint32(header[0:], bbqMagic)
	binary.LittleEndian.PutUint32(header[4:], bbqVersion)
	binary.LittleEndian.PutUint64(header[8:], params.numPoints)
	binary.LittleEndian.PutUint32(header[16:], uint32(params.dims))
	binary.LittleEndian.PutUint32(header[20:], 0) // reserved

	if _, err := f.Write(header); err != nil {
		t.Fatalf("write BBQ header failed: %v", err)
	}

	// Write centroid (dimension * 4 bytes)
	centroid := make([]byte, int(params.dims)*4)
	if _, err := f.Write(centroid); err != nil {
		t.Fatalf("write BBQ centroid failed: %v", err)
	}

	// Write BBQ codes (1 bit per dimension, packed)
	packedSize := (int(params.dims) + 7) / 8
	for i := uint64(0); i < params.numPoints; i++ {
		code := make([]byte, packedSize)
		// Simple pattern: set bits based on nodeID
		for j := 0; j < packedSize; j++ {
			code[j] = byte((i + uint64(j)) & 0xFF)
		}
		if _, err := f.Write(code); err != nil {
			t.Fatalf("write BBQ code %d failed: %v", i, err)
		}
	}

	// Write metadata arrays (LowerBounds, UpperBounds, Corrections, QuantizedSums)
	// 测试用占位零值，加载逻辑只验证结构与维度
	metaArray := make([]byte, int(params.numPoints)*4)
	for k := 0; k < 4; k++ {
		if _, err := f.Write(metaArray); err != nil {
			t.Fatalf("write BBQ meta array %d failed: %v", k, err)
		}
	}
}

// ============================================================================
// Mock Reader for Testing
// ============================================================================

// mockDiskIndexReader implements storage.DiskIndexReader for testing.
type mockDiskIndexReader struct {
	meta      storage.GraphMetadata
	nodes     [][]byte
	closed    bool
	blockSize uint64
}

func newMockReader(params testIndexParams) *mockDiskIndexReader {
	nodeLen := params.dims*4 + 4 + params.maxDegree*4
	nodesPerBlock := params.blockSize / nodeLen
	if nodesPerBlock == 0 {
		nodesPerBlock = 1
	}

	r := &mockDiskIndexReader{
		meta: storage.GraphMetadata{
			NumPoints:       params.numPoints,
			Dims:            params.dims,
			Medoid:          0,
			NodeLen:         nodeLen,
			NodesPerBlock:   nodesPerBlock,
			AssocDataLength: 0,
		},
		nodes:     make([][]byte, params.numPoints),
		blockSize: params.blockSize,
	}

	// Create node data
	for i := uint64(0); i < params.numPoints; i++ {
		r.nodes[i] = createTestNodeData(i, params)
	}

	return r
}

func (r *mockDiskIndexReader) ReadNode(nodeID uint64, buf []byte) error {
	if r.closed {
		return storage.ErrIndexClosed
	}
	if nodeID >= uint64(len(r.nodes)) {
		return storage.ErrNodeNotFound
	}
	copy(buf, r.nodes[nodeID])
	return nil
}

func (r *mockDiskIndexReader) ReadNeighbors(nodeID uint64) ([]uint32, error) {
	if r.closed {
		return nil, storage.ErrIndexClosed
	}
	if nodeID >= uint64(len(r.nodes)) {
		return nil, storage.ErrNodeNotFound
	}

	data := r.nodes[nodeID]
	return storage.ParseNeighborsFromBuffer(data, int(r.meta.Dims))
}

func (r *mockDiskIndexReader) ReadVector(nodeID uint64, vec []float32) error {
	if r.closed {
		return storage.ErrIndexClosed
	}
	if nodeID >= uint64(len(r.nodes)) {
		return storage.ErrNodeNotFound
	}

	data := r.nodes[nodeID]
	parsed, err := storage.ParseVectorFromBuffer(data, int(r.meta.Dims))
	if err != nil {
		return err
	}
	copy(vec, parsed)
	return nil
}

func (r *mockDiskIndexReader) ReadVectorRef(nodeID uint64) ([]float32, error) {
	if r.closed {
		return nil, storage.ErrIndexClosed
	}
	if nodeID >= uint64(len(r.nodes)) {
		return nil, storage.ErrNodeNotFound
	}

	data := r.nodes[nodeID]
	parsed, err := storage.ParseVectorFromBuffer(data, int(r.meta.Dims))
	if err != nil {
		return nil, err
	}
	return parsed, nil
}

func (r *mockDiskIndexReader) Metadata() *storage.GraphMetadata {
	return &r.meta
}

func (r *mockDiskIndexReader) Warmup(nodeIDs []uint64) error {
	return nil
}

func (r *mockDiskIndexReader) Close() error {
	r.closed = true
	return nil
}

// ============================================================================
// Tests
// ============================================================================

func TestDiskIndex_OpenClose_WithMockReader(t *testing.T) {
	params := defaultTestParams()
	basePath, cleanup := createTestIndexFiles(t, params)
	defer cleanup()

	// Set up mock reader factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return newMockReader(params), nil
	}

	// Test Open
	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}

	// Verify metadata
	if idx.Dimension() != int(params.dims) {
		t.Errorf("Dimension mismatch: got %d, want %d", idx.Dimension(), params.dims)
	}

	if idx.NumPointsTotal() != params.numPoints {
		t.Errorf("NumPointsTotal mismatch: got %d, want %d", idx.NumPointsTotal(), params.numPoints)
	}

	// Test Close
	if err := idx.Close(); err != nil {
		t.Errorf("Close failed: %v", err)
	}

	// Verify closed state
	if idx.Dimension() != 0 {
		t.Error("Dimension should return 0 after close")
	}

	// Double close should not error
	if err := idx.Close(); err != nil {
		t.Errorf("Double close should not error: %v", err)
	}
}

func TestDiskIndex_NeighborsLoading(t *testing.T) {
	params := defaultTestParams()
	basePath, cleanup := createTestIndexFiles(t, params)
	defer cleanup()

	// Set up mock reader factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return newMockReader(params), nil
	}

	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer idx.Close()

	// Test neighbor loading for node 5
	nodeID := uint64(5)
	neighbors := idx.GetNeighbors(nodeID)

	expectedCount := int((nodeID % params.maxDegree) + 1)
	if len(neighbors) != expectedCount {
		t.Errorf("neighbor count mismatch: got %d, want %d", len(neighbors), expectedCount)
	}

	// Verify neighbor IDs
	for n := 0; n < len(neighbors); n++ {
		expectedID := (uint32(nodeID) + uint32(n) + 1) % uint32(params.numPoints)
		if neighbors[n] != expectedID {
			t.Errorf("neighbor[%d] mismatch: got %d, want %d", n, neighbors[n], expectedID)
		}
	}

	// Test invalid nodeID
	invalidNeighbors := idx.GetNeighbors(params.numPoints + 100)
	if invalidNeighbors != nil {
		t.Error("GetNeighbors should return nil for invalid nodeID")
	}
}

func TestDiskIndex_BBQLoading(t *testing.T) {
	params := defaultTestParams()
	basePath, cleanup := createTestIndexFiles(t, params)
	defer cleanup()

	// Set up mock reader factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return newMockReader(params), nil
	}

	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer idx.Close()

	// Verify BBQ is loaded
	if !idx.HasBBQ() {
		t.Error("BBQ should be loaded")
	}

	// Test BBQ code retrieval
	packedSize := (int(params.dims) + 7) / 8
	code := idx.GetBBQCode(5)
	if code == nil {
		t.Fatal("GetBBQCode returned nil")
	}
	if len(code) != packedSize {
		t.Errorf("BBQ code size mismatch: got %d, want %d", len(code), packedSize)
	}

	// Test invalid nodeID
	invalidCode := idx.GetBBQCode(params.numPoints + 100)
	if invalidCode != nil {
		t.Error("GetBBQCode should return nil for invalid nodeID")
	}
}

func TestDiskIndex_DeletedBitmap(t *testing.T) {
	params := defaultTestParams()
	basePath, cleanup := createTestIndexFiles(t, params)
	defer cleanup()

	// Set up mock reader factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return newMockReader(params), nil
	}

	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}

	// Initially no nodes are deleted
	if idx.IsDeleted(5) {
		t.Error("Node 5 should not be deleted initially")
	}

	// NumPoints should equal NumPointsTotal
	if idx.NumPoints() != idx.NumPointsTotal() {
		t.Error("NumPoints should equal NumPointsTotal when no deletions")
	}

	idx.Close()
}

func TestDiskIndex_ReadVector(t *testing.T) {
	params := defaultTestParams()
	basePath, cleanup := createTestIndexFiles(t, params)
	defer cleanup()

	// Set up mock reader factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return newMockReader(params), nil
	}

	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer idx.Close()

	// Read vector for node 5
	nodeID := uint64(5)
	vec, err := idx.ReadVector(nodeID)
	if err != nil {
		t.Fatalf("ReadVector failed: %v", err)
	}

	// Verify vector values
	for d := uint64(0); d < params.dims; d++ {
		expected := float32(nodeID)*0.1 + float32(d)*0.01
		if math.Abs(float64(vec[d]-expected)) > 1e-6 {
			t.Errorf("vector[%d] mismatch: got %f, want %f", d, vec[d], expected)
		}
	}
}

func TestDiskIndex_FileNotFound(t *testing.T) {
	// Set up mock reader factory that returns file not found
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return nil, storage.ErrFileNotFound
	}

	_, err := Open("/nonexistent/path/index")
	if err == nil {
		t.Error("Open should fail for nonexistent file")
	}
}

func TestDiskIndex_NoBBQFile(t *testing.T) {
	params := defaultTestParams()
	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "test_no_bbq")

	// Create only .index file, no .bbq
	createTestIndexFile(t, basePath+diskIndexExt, params)

	// Set up mock reader factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return newMockReader(params), nil
	}

	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer idx.Close()

	// BBQ should not be loaded
	if idx.HasBBQ() {
		t.Error("BBQ should not be loaded when .bbq file doesn't exist")
	}
}

func TestDiskIndex_MaxDegree(t *testing.T) {
	params := defaultTestParams()
	basePath, cleanup := createTestIndexFiles(t, params)
	defer cleanup()

	// Set up mock reader factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return newMockReader(params), nil
	}

	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer idx.Close()

	// Verify max degree calculation
	expectedMaxDegree := int(params.maxDegree)
	if idx.MaxDegree() != expectedMaxDegree {
		t.Errorf("MaxDegree mismatch: got %d, want %d", idx.MaxDegree(), expectedMaxDegree)
	}
}

func TestDiskIndex_Medoid(t *testing.T) {
	params := defaultTestParams()
	basePath, cleanup := createTestIndexFiles(t, params)
	defer cleanup()

	// Set up mock reader factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return newMockReader(params), nil
	}

	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer idx.Close()

	// Medoid should be 0 (as set in test data)
	if idx.Medoid() != 0 {
		t.Errorf("Medoid mismatch: got %d, want 0", idx.Medoid())
	}
}

func TestDiskIndex_ClosedState(t *testing.T) {
	params := defaultTestParams()
	basePath, cleanup := createTestIndexFiles(t, params)
	defer cleanup()

	// Set up mock reader factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return newMockReader(params), nil
	}

	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}

	idx.Close()

	// All accessors should return zero/nil/false after close
	if idx.NumPoints() != 0 {
		t.Error("NumPoints should return 0 after close")
	}
	if idx.NumPointsTotal() != 0 {
		t.Error("NumPointsTotal should return 0 after close")
	}
	if idx.Dimension() != 0 {
		t.Error("Dimension should return 0 after close")
	}
	if idx.Medoid() != 0 {
		t.Error("Medoid should return 0 after close")
	}
	if idx.MaxDegree() != 0 {
		t.Error("MaxDegree should return 0 after close")
	}
	if idx.GetNeighbors(0) != nil {
		t.Error("GetNeighbors should return nil after close")
	}
	if idx.IsDeleted(0) != false {
		t.Error("IsDeleted should return false after close")
	}
	if idx.HasBBQ() != false {
		t.Error("HasBBQ should return false after close")
	}
	if idx.GetBBQCode(0) != nil {
		t.Error("GetBBQCode should return nil after close")
	}

	_, err = idx.ReadVector(0)
	if err != ErrDiskIndexClosed {
		t.Errorf("ReadVector should return ErrDiskIndexClosed, got %v", err)
	}
}
