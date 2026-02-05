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
