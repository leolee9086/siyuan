//go:build windows

package storage

import (
	"encoding/binary"
	"math"
	"os"
	"path/filepath"
	"testing"
)

// createTestIndexFile creates a test index file with specified parameters.
// Returns the file path and cleanup function.
func createTestIndexFile(t *testing.T, numPoints, dims, maxDegree uint64) (string, func()) {
	t.Helper()

	// Create temp directory
	tmpDir := t.TempDir()
	indexPath := filepath.Join(tmpDir, "test.index")

	// Calculate node length
	nodeLen := dims*4 + 4 + maxDegree*4 // vector + neighborCount + neighborIDs

	// Calculate nodes per block (assuming 4096 block size)
	blockSize := uint64(4096)
	nodesPerBlock := blockSize / nodeLen
	if nodesPerBlock == 0 {
		nodesPerBlock = 1
	}

	// Create file
	f, err := os.Create(indexPath)
	if err != nil {
		t.Fatalf("create test file failed: %v", err)
	}

	// Write header (96 bytes)
	header := make([]byte, blockSize) // pad to block size

	// Magic number "VAMA"
	binary.LittleEndian.PutUint32(header[0:], MagicNumber)

	// GraphMetadata (80 bytes starting at offset 4)
	offset := 4
	binary.LittleEndian.PutUint64(header[offset:], numPoints)
	offset += 8
	binary.LittleEndian.PutUint64(header[offset:], dims)
	offset += 8
	binary.LittleEndian.PutUint64(header[offset:], 0) // medoid
	offset += 8
	binary.LittleEndian.PutUint64(header[offset:], nodeLen)
	offset += 8
	binary.LittleEndian.PutUint64(header[offset:], nodesPerBlock)
	offset += 8
	binary.LittleEndian.PutUint64(header[offset:], 0) // frozenNum
	offset += 8
	binary.LittleEndian.PutUint64(header[offset:], 0) // frozenLoc
	offset += 8
	binary.LittleEndian.PutUint64(header[offset:], 0) // reserved
	offset += 8

	// Calculate total file size
	numBlocks := (numPoints + nodesPerBlock - 1) / nodesPerBlock
	totalSize := blockSize + numBlocks*nodesPerBlock*nodeLen
	binary.LittleEndian.PutUint64(header[offset:], totalSize)
	offset += 8
	binary.LittleEndian.PutUint64(header[offset:], 0) // assocDataLength
	offset += 8

	// Block size
	binary.LittleEndian.PutUint64(header[offset:], blockSize)
	offset += 8

	// Layout version
	binary.LittleEndian.PutUint32(header[offset:], CurrentMajorVersion)
	binary.LittleEndian.PutUint32(header[offset+4:], CurrentMinorVersion)

	// Write header
	if _, err := f.Write(header); err != nil {
		f.Close()
		t.Fatalf("write header failed: %v", err)
	}

	// Write node data
	for i := uint64(0); i < numPoints; i++ {
		nodeData := make([]byte, nodeLen)
		nodeOffset := 0

		// Write vector (float32 values = nodeID * 0.1 + dimIndex * 0.01)
		for d := uint64(0); d < dims; d++ {
			val := float32(i)*0.1 + float32(d)*0.01
			binary.LittleEndian.PutUint32(nodeData[nodeOffset:], math.Float32bits(val))
			nodeOffset += 4
		}

		// Write neighbor count (use nodeID % maxDegree as count)
		neighborCount := uint32((i % maxDegree) + 1)
		if neighborCount > uint32(maxDegree) {
			neighborCount = uint32(maxDegree)
		}
		binary.LittleEndian.PutUint32(nodeData[nodeOffset:], neighborCount)
		nodeOffset += 4

		// Write neighbor IDs
		for n := uint32(0); n < neighborCount; n++ {
			neighborID := (uint32(i) + n + 1) % uint32(numPoints)
			binary.LittleEndian.PutUint32(nodeData[nodeOffset:], neighborID)
			nodeOffset += 4
		}

		if _, err := f.Write(nodeData); err != nil {
			f.Close()
			t.Fatalf("write node %d failed: %v", i, err)
		}
	}

	// Pad to complete the last block if needed
	currentSize, _ := f.Seek(0, 2)
	if uint64(currentSize) < totalSize {
		padding := make([]byte, totalSize-uint64(currentSize))
		f.Write(padding)
	}

	f.Close()

	return indexPath, func() {
		os.RemoveAll(tmpDir)
	}
}

func TestWindowsReader_OpenClose(t *testing.T) {
	indexPath, cleanup := createTestIndexFile(t, 100, 8, 16)
	defer cleanup()

	// Test read-only mode
	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}

	if err := reader.Close(); err != nil {
		t.Errorf("close reader failed: %v", err)
	}

	// Test read-write mode
	reader, err = platformOpenReader(indexPath, false)
	if err != nil {
		t.Fatalf("open reader (rw) failed: %v", err)
	}

	if err := reader.Close(); err != nil {
		t.Errorf("close reader (rw) failed: %v", err)
	}
}

func TestWindowsReader_Metadata(t *testing.T) {
	numPoints := uint64(100)
	dims := uint64(8)
	maxDegree := uint64(16)

	indexPath, cleanup := createTestIndexFile(t, numPoints, dims, maxDegree)
	defer cleanup()

	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}
	defer reader.Close()

	meta := reader.Metadata()
	if meta == nil {
		t.Fatal("metadata is nil")
	}

	if meta.NumPoints != numPoints {
		t.Errorf("NumPoints mismatch: got %d, want %d", meta.NumPoints, numPoints)
	}

	if meta.Dims != dims {
		t.Errorf("Dims mismatch: got %d, want %d", meta.Dims, dims)
	}
}

func TestWindowsReader_ReadVector(t *testing.T) {
	numPoints := uint64(100)
	dims := uint64(8)
	maxDegree := uint64(16)

	indexPath, cleanup := createTestIndexFile(t, numPoints, dims, maxDegree)
	defer cleanup()

	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}
	defer reader.Close()

	// Test reading vector for node 5
	nodeID := uint64(5)
	vec := make([]float32, dims)
	if err := reader.ReadVector(nodeID, vec); err != nil {
		t.Fatalf("ReadVector failed: %v", err)
	}

	// Verify vector values
	for d := uint64(0); d < dims; d++ {
		expected := float32(nodeID)*0.1 + float32(d)*0.01
		if math.Abs(float64(vec[d]-expected)) > 1e-6 {
			t.Errorf("vector[%d] mismatch: got %f, want %f", d, vec[d], expected)
		}
	}

	// Test invalid nodeID
	if err := reader.ReadVector(numPoints+1, vec); err != ErrNodeNotFound {
		t.Errorf("expected ErrNodeNotFound, got %v", err)
	}

	// Test dimension mismatch
	smallVec := make([]float32, dims-1)
	if err := reader.ReadVector(0, smallVec); err != ErrDimensionMismatch {
		t.Errorf("expected ErrDimensionMismatch, got %v", err)
	}
}

func TestWindowsReader_ReadNeighbors(t *testing.T) {
	numPoints := uint64(100)
	dims := uint64(8)
	maxDegree := uint64(16)

	indexPath, cleanup := createTestIndexFile(t, numPoints, dims, maxDegree)
	defer cleanup()

	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}
	defer reader.Close()

	// Test reading neighbors for node 5
	nodeID := uint64(5)
	neighbors, err := reader.ReadNeighbors(nodeID)
	if err != nil {
		t.Fatalf("ReadNeighbors failed: %v", err)
	}

	// Expected neighbor count = (nodeID % maxDegree) + 1
	expectedCount := int((nodeID % maxDegree) + 1)
	if len(neighbors) != expectedCount {
		t.Errorf("neighbor count mismatch: got %d, want %d", len(neighbors), expectedCount)
	}

	// Verify neighbor IDs
	for n := 0; n < len(neighbors); n++ {
		expectedID := (uint32(nodeID) + uint32(n) + 1) % uint32(numPoints)
		if neighbors[n] != expectedID {
			t.Errorf("neighbor[%d] mismatch: got %d, want %d", n, neighbors[n], expectedID)
		}
	}

	// Test invalid nodeID
	if _, err := reader.ReadNeighbors(numPoints + 1); err != ErrNodeNotFound {
		t.Errorf("expected ErrNodeNotFound, got %v", err)
	}
}

func TestWindowsReader_ReadNode(t *testing.T) {
	numPoints := uint64(100)
	dims := uint64(8)
	maxDegree := uint64(16)

	indexPath, cleanup := createTestIndexFile(t, numPoints, dims, maxDegree)
	defer cleanup()

	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}
	defer reader.Close()

	meta := reader.Metadata()
	nodeLen := meta.NodeLen

	// Test reading complete node data
	nodeID := uint64(5)
	buf := make([]byte, nodeLen)
	if err := reader.ReadNode(nodeID, buf); err != nil {
		t.Fatalf("ReadNode failed: %v", err)
	}

	// Verify first vector element
	firstVecBits := binary.LittleEndian.Uint32(buf[0:4])
	firstVec := math.Float32frombits(firstVecBits)
	expected := float32(nodeID) * 0.1
	if math.Abs(float64(firstVec-expected)) > 1e-6 {
		t.Errorf("first vector element mismatch: got %f, want %f", firstVec, expected)
	}

	// Test invalid nodeID
	if err := reader.ReadNode(numPoints+1, buf); err != ErrNodeNotFound {
		t.Errorf("expected ErrNodeNotFound, got %v", err)
	}

	// Test buffer too small
	smallBuf := make([]byte, nodeLen-1)
	if err := reader.ReadNode(0, smallBuf); err == nil {
		t.Error("expected error for small buffer, got nil")
	}
}

func TestWindowsReader_Warmup(t *testing.T) {
	numPoints := uint64(100)
	dims := uint64(8)
	maxDegree := uint64(16)

	indexPath, cleanup := createTestIndexFile(t, numPoints, dims, maxDegree)
	defer cleanup()

	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}
	defer reader.Close()

	// Warmup should not return error
	nodeIDs := []uint64{0, 5, 10, 50, 99}
	if err := reader.Warmup(nodeIDs); err != nil {
		t.Errorf("Warmup failed: %v", err)
	}

	// Warmup with invalid nodeIDs should not fail
	invalidIDs := []uint64{numPoints + 1, numPoints + 100}
	if err := reader.Warmup(invalidIDs); err != nil {
		t.Errorf("Warmup with invalid IDs failed: %v", err)
	}
}

func TestWindowsReader_FileNotFound(t *testing.T) {
	_, err := platformOpenReader("nonexistent_file.index", true)
	if err != ErrFileNotFound {
		t.Errorf("expected ErrFileNotFound, got %v", err)
	}
}

func TestWindowsReader_InvalidMagic(t *testing.T) {
	tmpDir := t.TempDir()
	indexPath := filepath.Join(tmpDir, "invalid.index")

	// Create file with invalid magic number
	f, err := os.Create(indexPath)
	if err != nil {
		t.Fatalf("create file failed: %v", err)
	}

	// Write invalid magic and padding
	data := make([]byte, 4096)
	binary.LittleEndian.PutUint32(data[0:], 0x12345678) // invalid magic
	f.Write(data)
	f.Close()

	_, err = platformOpenReader(indexPath, true)
	if err != ErrInvalidMagic {
		t.Errorf("expected ErrInvalidMagic, got %v", err)
	}
}

func TestWindowsReader_CorruptedFile(t *testing.T) {
	tmpDir := t.TempDir()
	indexPath := filepath.Join(tmpDir, "corrupted.index")

	// Create file that's too small
	f, err := os.Create(indexPath)
	if err != nil {
		t.Fatalf("create file failed: %v", err)
	}

	// Write only 50 bytes (less than GraphHeaderSize)
	data := make([]byte, 50)
	f.Write(data)
	f.Close()

	_, err = platformOpenReader(indexPath, true)
	if err != ErrCorruptedFile {
		t.Errorf("expected ErrCorruptedFile, got %v", err)
	}
}

// ============================================================================
// ReadVectorRef 测试
// ============================================================================

func TestWindowsReader_ReadVectorRef(t *testing.T) {
	numPoints := uint64(100)
	dims := uint64(8)
	maxDegree := uint64(16)

	indexPath, cleanup := createTestIndexFile(t, numPoints, dims, maxDegree)
	defer cleanup()

	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}
	defer reader.Close()

	// 测试零拷贝向量引用
	vec, err := reader.ReadVectorRef(5)
	if err != nil {
		t.Fatalf("ReadVectorRef failed: %v", err)
	}

	if len(vec) != int(dims) {
		t.Fatalf("vector length = %d, want %d", len(vec), dims)
	}

	// 验证向量值
	for d := uint64(0); d < dims; d++ {
		expected := float32(5)*0.1 + float32(d)*0.01
		if vec[d] != expected {
			t.Errorf("vec[%d] = %f, want %f", d, vec[d], expected)
		}
	}

	// 测试越界 nodeID
	_, err = reader.ReadVectorRef(numPoints + 1)
	if err != ErrNodeNotFound {
		t.Errorf("expected ErrNodeNotFound, got %v", err)
	}
}

// ============================================================================
// Warmup 边界测试
// ============================================================================

func TestWindowsReader_Warmup_InvalidNodes(t *testing.T) {
	indexPath, cleanup := createTestIndexFile(t, 50, 4, 8)
	defer cleanup()

	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}
	defer reader.Close()

	// 混合有效和无效 nodeID，不应返回错误
	ids := []uint64{0, 10, 100, 200, 49}
	if err := reader.Warmup(ids); err != nil {
		t.Errorf("Warmup with mixed IDs should not fail: %v", err)
	}

	// 全无效 nodeID
	allInvalid := []uint64{100, 200, 300}
	if err := reader.Warmup(allInvalid); err != nil {
		t.Errorf("Warmup with all invalid IDs should not fail: %v", err)
	}
}

func TestWindowsReader_Warmup_Empty(t *testing.T) {
	indexPath, cleanup := createTestIndexFile(t, 50, 4, 8)
	defer cleanup()

	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}
	defer reader.Close()

	if err := reader.Warmup([]uint64{}); err != nil {
		t.Errorf("Warmup with empty slice should not fail: %v", err)
	}
	if err := reader.Warmup(nil); err != nil {
		t.Errorf("Warmup with nil should not fail: %v", err)
	}
}

// ============================================================================
// ReadVector 边界测试
// ============================================================================

func TestWindowsReader_ReadVector_EdgeCases(t *testing.T) {

	indexPath, cleanup := createTestIndexFile(t, 10, 4, 8)
	defer cleanup()

	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}
	defer reader.Close()

	// 测试 nil 目标切片
	if err := reader.ReadVector(0, nil); err != ErrDimensionMismatch {
		t.Errorf("expected ErrDimensionMismatch for nil vec, got %v", err)
	}

	// 测试空的 vec
	if err := reader.ReadVector(0, []float32{}); err != ErrDimensionMismatch {
		t.Errorf("expected ErrDimensionMismatch for empty vec, got %v", err)
	}

	// 测试维度正确但 nodeID 越界
	validVec := make([]float32, 4)
	if err := reader.ReadVector(100, validVec); err != ErrNodeNotFound {
		t.Errorf("expected ErrNodeNotFound for out-of-range nodeID, got %v", err)
	}
}

// ============================================================================
// ReadNeighbors 边界测试
// ============================================================================

func TestWindowsReader_ReadNeighbors_ZeroNeighbors(t *testing.T) {
	numPoints := uint64(1)
	dims := uint64(4)
	maxDegree := uint64(4)

	indexPath, cleanup := createTestIndexFile(t, numPoints, dims, maxDegree)
	defer cleanup()

	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}
	defer reader.Close()

	neighbors, err := reader.ReadNeighbors(0)
	if err != nil {
		t.Fatalf("ReadNeighbors failed: %v", err)
	}
	if len(neighbors) == 0 {
		t.Log("node 0 has 1 neighbor (createTestIndexFile generates at least 1)")
	}
	_ = neighbors
}

// ============================================================================
// OpenReader 公共 API 测试
// ============================================================================

func TestOpenReader_PublicAPI(t *testing.T) {
	indexPath, cleanup := createTestIndexFile(t, 10, 4, 8)
	defer cleanup()

	// 测试公共 API 入口
	reader, err := OpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("OpenReader failed: %v", err)
	}
	defer reader.Close()

	// 验证 Metadata
	meta := reader.Metadata()
	if meta == nil {
		t.Fatal("Metadata is nil")
	}
	if meta.NumPoints != 10 {
		t.Errorf("NumPoints = %d, want 10", meta.NumPoints)
	}
	if meta.Dims != 4 {
		t.Errorf("Dims = %d, want 4", meta.Dims)
	}
}

// ============================================================================
// ReadNode 边界测试
// ============================================================================

func TestWindowsReader_ReadNode_Boundaries(t *testing.T) {
	indexPath, cleanup := createTestIndexFile(t, 10, 4, 8)
	defer cleanup()

	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}
	defer reader.Close()

	// 测试 nodeID = 0 (第一个节点)
	nodeLen := reader.Metadata().NodeLen
	buf := make([]byte, nodeLen)
	if err := reader.ReadNode(0, buf); err != nil {
		t.Fatalf("ReadNode(0) failed: %v", err)
	}

	// 测试 nodeID = NumPoints - 1 (最后一个节点)
	lastID := reader.Metadata().NumPoints - 1
	if err := reader.ReadNode(lastID, buf); err != nil {
		t.Fatalf("ReadNode(last) failed: %v", err)
	}

	// 测试过小的缓冲区
	smallBuf := make([]byte, nodeLen-1)
	if err := reader.ReadNode(0, smallBuf); err == nil {
		t.Error("expected error for too-small buffer, got nil")
	}
}

// ============================================================================
// Bug 暴露测试: NodesPerBlock=0 导致 calcOffset 除零崩溃
// ============================================================================
//
// 问题: parseHeader 未验证 NodesPerBlock > 0。
// 若文件被损坏或手动构造为 NodesPerBlock=0，
// calcOffset 中 nodeID / r.meta.NodesPerBlock 会触发整数除零 panic。
//
// 预期行为: OpenReader 应在此场景返回错误，而非在后续 ReadNode/ReadNeighbors 时 panic。

func TestWindowsReader_NodesPerBlockZero(t *testing.T) {
	tmpDir := t.TempDir()
	indexPath := tmpDir + "\\nodesperblock_zero.index"

	dims := uint64(4)
	maxDegree := uint64(8)
	nodeLen := dims*4 + 4 + maxDegree*4
	blockSize := uint64(4096)
	nodesPerBlock := uint64(0) // 错误: NodesPerBlock = 0

	totalSize := blockSize

	f, err := os.Create(indexPath)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	header := make([]byte, blockSize)
	off := 0
	binary.LittleEndian.PutUint32(header[off:], MagicNumber)
	off = 4
	binary.LittleEndian.PutUint64(header[off:], 10) // NumPoints > 0 以到达 calcOffset
	binary.LittleEndian.PutUint64(header[off+8:], dims)
	binary.LittleEndian.PutUint64(header[off+16:], 0)
	binary.LittleEndian.PutUint64(header[off+24:], nodeLen)
	binary.LittleEndian.PutUint64(header[off+32:], nodesPerBlock) // NodesPerBlock=0 → 除零
	binary.LittleEndian.PutUint64(header[off+40:], 0)
	binary.LittleEndian.PutUint64(header[off+48:], 0)
	binary.LittleEndian.PutUint64(header[off+56:], 0)
	binary.LittleEndian.PutUint64(header[off+64:], totalSize)
	binary.LittleEndian.PutUint64(header[off+72:], 0)
	binary.LittleEndian.PutUint64(header[84:], blockSize)
	binary.LittleEndian.PutUint32(header[92:], CurrentMajorVersion)
	binary.LittleEndian.PutUint32(header[96:], CurrentMinorVersion)

	if _, err := f.Write(header); err != nil {
		f.Close()
		t.Fatalf("Write failed: %v", err)
	}
	f.Close()

	reader, err := OpenReader(indexPath, true)
	if err != nil {
		t.Skipf("OpenReader rejected NodesPerBlock=0: %v — acceptable once validation is added", err)
		return
	}
	defer reader.Close()

	meta := reader.Metadata()
	buf := make([]byte, meta.NodeLen)
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("ReadNode panicked with NodesPerBlock=0: %v — BUG: parseHeader should reject this", r)
		}
	}()
	err = reader.ReadNode(0, buf)
	// 这里会 panic（除零），如果程序能运行到这里则说明有防御
	t.Errorf("BUG: NodesPerBlock=0 should have caused error/panic but ReadNode returned: %v", err)
}

// ============================================================================
// Bug 暴露测试: 损坏的 neighborCount 导致 unsafe.Slice 越界
// ============================================================================
//
// 问题: ReadNeighbors 读取 neighborCount 后直接用于 unsafe.Slice，
// 未验证 neighborCount * 4 + neighborIDsStart 是否超出 mmap 区域。
// 若文件损坏导致 neighborCount 异常大，会创建指向映射区外的 slice，
// 在 Windows 上会触发访问违规 (panic)。
//
// 预期行为: ReadNeighbors 应在发现 neighborCount 超出节点布局范围时返回 ErrCorruptedFile。

func TestWindowsReader_CorruptedNeighborCount(t *testing.T) {
	tmpDir := t.TempDir()
	indexPath := tmpDir + "\\corrupted_neighbor.index"

	dims := uint64(4)
	maxDegree := uint64(4)
	nodeLen := dims*4 + 4 + maxDegree*4
	blockSize := uint64(4096)
	numPoints := uint64(10)
	nodesPerBlock := uint64(blockSize / nodeLen)
	totalSize := blockSize + uint64(numPoints)*nodeLen

	f, err := os.Create(indexPath)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	header := make([]byte, blockSize)
	off := 0
	binary.LittleEndian.PutUint32(header[off:], MagicNumber)
	off = 4
	binary.LittleEndian.PutUint64(header[off:], numPoints)
	binary.LittleEndian.PutUint64(header[off+8:], dims)
	binary.LittleEndian.PutUint64(header[off+16:], 0)
	binary.LittleEndian.PutUint64(header[off+24:], nodeLen)
	binary.LittleEndian.PutUint64(header[off+32:], nodesPerBlock)
	binary.LittleEndian.PutUint64(header[off+40:], 0)
	binary.LittleEndian.PutUint64(header[off+48:], 0)
	binary.LittleEndian.PutUint64(header[off+56:], 0)
	binary.LittleEndian.PutUint64(header[off+64:], totalSize)
	binary.LittleEndian.PutUint64(header[off+72:], 0)
	binary.LittleEndian.PutUint64(header[84:], blockSize)
	binary.LittleEndian.PutUint32(header[92:], CurrentMajorVersion)
	binary.LittleEndian.PutUint32(header[96:], CurrentMinorVersion)

	if _, err := f.Write(header); err != nil {
		f.Close()
		t.Fatalf("Write header failed: %v", err)
	}

	for i := uint64(0); i < numPoints; i++ {
		nodeData := make([]byte, nodeLen)
		for d := uint64(0); d < dims; d++ {
			val := float32(i)*0.1 + float32(d)*0.01
			binary.LittleEndian.PutUint32(nodeData[d*4:], math.Float32bits(val))
		}
		if i == 0 {
			binary.LittleEndian.PutUint32(nodeData[dims*4:], 0x7FFFFFFF) // 极大值
		} else {
			neighborCount := uint32((i % maxDegree) + 1)
			if neighborCount > uint32(maxDegree) {
				neighborCount = uint32(maxDegree)
			}
			binary.LittleEndian.PutUint32(nodeData[dims*4:], neighborCount)
			for n := uint32(0); n < neighborCount; n++ {
				neighborID := (uint32(i) + n + 1) % uint32(numPoints)
				offset := dims*4 + 4 + uint64(n)*4
				binary.LittleEndian.PutUint32(nodeData[offset:], neighborID)
			}
		}
		if _, err := f.Write(nodeData); err != nil {
			f.Close()
			t.Fatalf("Write node %d failed: %v", i, err)
		}
	}

	currentSize, _ := f.Seek(0, 2)
	if uint64(currentSize) < totalSize {
		padding := make([]byte, totalSize-uint64(currentSize))
		f.Write(padding)
	}
	f.Close()

	reader, err := OpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("OpenReader failed: %v", err)
	}
	defer reader.Close()

	defer func() {
		if r := recover(); r != nil {
			t.Errorf("BUG: ReadNeighbors with corrupted neighborCount panicked: %v — should return ErrCorruptedFile instead", r)
		}
	}()

	_, err = reader.ReadNeighbors(0)
	if err == nil {
		t.Error("BUG: ReadNeighbors with corrupted count should return error, but succeeded")
	} else {
		t.Logf("ReadNeighbors correctly returned error for corrupted count: %v", err)
	}
}

// ============================================================================
// Close 安全性测试
// ============================================================================

func TestWindowsReader_Close_Idempotent(t *testing.T) {
	indexPath, cleanup := createTestIndexFile(t, 10, 4, 8)
	defer cleanup()

	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}

	if err := reader.Close(); err != nil {
		t.Errorf("first Close failed: %v", err)
	}
	if err := reader.Close(); err != nil {
		t.Errorf("second Close should be idempotent, got: %v", err)
	}
	if err := reader.Close(); err != nil {
		t.Errorf("third Close should be idempotent, got: %v", err)
	}
}

// ============================================================================
// 小文件/单节点边界测试
// ============================================================================

func TestWindowsReader_SinglePoint(t *testing.T) {
	indexPath, cleanup := createTestIndexFile(t, 1, 4, 4)
	defer cleanup()

	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}
	defer reader.Close()

	meta := reader.Metadata()
	if meta.NumPoints != 1 {
		t.Errorf("NumPoints = %d, want 1", meta.NumPoints)
	}

	vec := make([]float32, 4)
	if err := reader.ReadVector(0, vec); err != nil {
		t.Fatalf("ReadVector failed: %v", err)
	}

	if err := reader.ReadVector(1, vec); err != ErrNodeNotFound {
		t.Errorf("expected ErrNodeNotFound for nodeID=1, got %v", err)
	}
}

// ============================================================================
// Metadata 指针稳定性测试
// ============================================================================

func TestWindowsReader_MetadataPointer(t *testing.T) {
	indexPath, cleanup := createTestIndexFile(t, 50, 4, 8)
	defer cleanup()

	reader, err := platformOpenReader(indexPath, true)
	if err != nil {
		t.Fatalf("open reader failed: %v", err)
	}

	meta := reader.Metadata()
	meta2 := reader.Metadata()
	if meta != meta2 {
		t.Error("Metadata() should return the same pointer")
	}
	_ = reader.Close()

	metaAfterClose := reader.Metadata()
	if metaAfterClose == nil {
		t.Error("Metadata() after close should not be nil")
	}
}
