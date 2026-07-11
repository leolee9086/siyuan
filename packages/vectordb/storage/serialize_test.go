package storage

import (
	"bytes"
	"encoding/binary"
	"math"
	"testing"
)

// ============================================================================
// WriteGraphHeader / ReadGraphHeader 测试
// ============================================================================

func TestWriteReadGraphHeader_RoundTrip(t *testing.T) {
	header := &GraphHeader{
		Meta: GraphMetadata{
			NumPoints:       1000,
			Dims:            128,
			Medoid:          42,
			NodeLen:         772,
			NodesPerBlock:   5,
			FrozenNum:       10,
			FrozenLoc:       50,
			Reserved:        0,
			IndexFileSize:   4096 + 5*1000*772,
			AssocDataLength: 0,
		},
		BlockSize: 4096,
		Version: LayoutVersion{
			Major: CurrentMajorVersion,
			Minor: CurrentMinorVersion,
		},
	}

	var buf bytes.Buffer
	if err := WriteGraphHeader(&buf, header); err != nil {
		t.Fatalf("WriteGraphHeader failed: %v", err)
	}

	// 解析读取
	got, err := ReadGraphHeader(&buf)
	if err != nil {
		t.Fatalf("ReadGraphHeader failed: %v", err)
	}

	// 验证字段
	if got.Meta.NumPoints != header.Meta.NumPoints {
		t.Errorf("NumPoints: got %d, want %d", got.Meta.NumPoints, header.Meta.NumPoints)
	}
	if got.Meta.Dims != header.Meta.Dims {
		t.Errorf("Dims: got %d, want %d", got.Meta.Dims, header.Meta.Dims)
	}
	if got.Meta.Medoid != header.Meta.Medoid {
		t.Errorf("Medoid: got %d, want %d", got.Meta.Medoid, header.Meta.Medoid)
	}
	if got.Meta.NodeLen != header.Meta.NodeLen {
		t.Errorf("NodeLen: got %d, want %d", got.Meta.NodeLen, header.Meta.NodeLen)
	}
	if got.Meta.NodesPerBlock != header.Meta.NodesPerBlock {
		t.Errorf("NodesPerBlock: got %d, want %d", got.Meta.NodesPerBlock, header.Meta.NodesPerBlock)
	}
	if got.BlockSize != header.BlockSize {
		t.Errorf("BlockSize: got %d, want %d", got.BlockSize, header.BlockSize)
	}
	if got.Version.Major != header.Version.Major {
		t.Errorf("Version.Major: got %d, want %d", got.Version.Major, header.Version.Major)
	}
}

func TestReadGraphHeader_InvalidMagic(t *testing.T) {
	buf := bytes.NewBuffer([]byte{0x00, 0x00, 0x00, 0x00}) // wrong magic
	_, err := ReadGraphHeader(buf)
	if err != ErrInvalidMagic {
		t.Errorf("Expected ErrInvalidMagic, got %v", err)
	}
}

func TestReadGraphHeader_VersionMismatch(t *testing.T) {
	header := &GraphHeader{
		Meta: GraphMetadata{
			NumPoints:       10,
			Dims:            4,
			Medoid:          0,
			NodeLen:         40,
			NodesPerBlock:   102,
			FrozenNum:       0,
			FrozenLoc:       0,
			Reserved:        0,
			IndexFileSize:   4096 + 102*10*40,
			AssocDataLength: 0,
		},
		BlockSize: 4096,
		Version: LayoutVersion{
			Major: CurrentMajorVersion + 1, // 未来版本
			Minor: 0,
		},
	}

	var buf bytes.Buffer
	if err := WriteGraphHeader(&buf, header); err != nil {
		t.Fatalf("WriteGraphHeader failed: %v", err)
	}

	_, err := ReadGraphHeader(&buf)
	if err != ErrVersionMismatch {
		t.Errorf("Expected ErrVersionMismatch, got %v", err)
	}
}

func TestReadGraphHeader_EmptyReader(t *testing.T) {
	buf := bytes.NewBuffer([]byte{})
	_, err := ReadGraphHeader(buf)
	if err == nil {
		t.Error("Expected error for empty reader, got nil")
	}
}

func TestReadGraphHeader_Truncated(t *testing.T) {
	// Write header then read from truncated data
	header := &GraphHeader{
		Meta:      GraphMetadata{Dims: 128},
		BlockSize: 4096,
		Version:   LayoutVersion{Major: CurrentMajorVersion},
	}
	var fullBuf bytes.Buffer
	if err := WriteGraphHeader(&fullBuf, header); err != nil {
		t.Fatalf("WriteGraphHeader failed: %v", err)
	}

	data := fullBuf.Bytes()
	// 只保留前 10 个字节
	truncated := data[:10]
	_, err := ReadGraphHeader(bytes.NewBuffer(truncated))
	if err == nil {
		t.Error("Expected error for truncated data, got nil")
	}
}

// ============================================================================
// SerializeNode 测试
// ============================================================================

func TestSerializeNode_Basic(t *testing.T) {
	vector := []float32{1.0, 2.0, 3.0, 4.0}
	neighbors := []uint32{10, 20, 30}
	maxDegree := 5

	data := SerializeNode(vector, neighbors, maxDegree)

	expectedLen := len(vector)*4 + 4 + maxDegree*4
	if len(data) != expectedLen {
		t.Fatalf("SerializeNode data length = %d, want %d", len(data), expectedLen)
	}

	// 验证前 4 个 float32 (向量)
	for i, v := range vector {
		bits := binary.LittleEndian.Uint32(data[i*4:])
		got := math.Float32frombits(bits)
		if got != v {
			t.Errorf("vector[%d] = %f, want %f", i, got, v)
		}
	}

	// 验证邻居计数
	neighborCountOffset := len(vector) * 4
	count := binary.LittleEndian.Uint32(data[neighborCountOffset:])
	if count != uint32(len(neighbors)) {
		t.Errorf("neighbor count = %d, want %d", count, len(neighbors))
	}

	// 验证邻居 ID
	neighborStart := neighborCountOffset + 4
	for i, id := range neighbors {
		got := binary.LittleEndian.Uint32(data[neighborStart+i*4:])
		if got != id {
			t.Errorf("neighbor[%d] = %d, want %d", i, got, id)
		}
	}

	// 验证填充槽位为 0xFFFFFFFF
	paddingStart := neighborStart + len(neighbors)*4
	for i := len(neighbors); i < maxDegree; i++ {
		got := binary.LittleEndian.Uint32(data[paddingStart+(i-len(neighbors))*4:])
		if got != 0xFFFFFFFF {
			t.Errorf("padding[%d] = 0x%X, want 0xFFFFFFFF", i, got)
		}
	}
}

func TestSerializeNode_EmptyNeighbors(t *testing.T) {
	vector := []float32{0.5, 0.5}
	neighbors := []uint32{}
	maxDegree := 3

	data := SerializeNode(vector, neighbors, maxDegree)

	// 邻居计数应为 0
	count := binary.LittleEndian.Uint32(data[len(vector)*4:])
	if count != 0 {
		t.Errorf("neighbor count = %d, want 0", count)
	}

	// 所有槽位填充 0xFFFFFFFF
	for i := 0; i < maxDegree; i++ {
		offset := len(vector)*4 + 4 + i*4
		got := binary.LittleEndian.Uint32(data[offset:])
		if got != 0xFFFFFFFF {
			t.Errorf("slot[%d] = 0x%X, want 0xFFFFFFFF", i, got)
		}
	}
}

func TestSerializeNode_FullNeighbors(t *testing.T) {
	vector := []float32{1.0, 2.0}
	neighbors := []uint32{100, 200, 300}
	maxDegree := 3

	data := SerializeNode(vector, neighbors, maxDegree)

	// 没有填充槽位
	expectedLen := len(vector)*4 + 4 + maxDegree*4
	if len(data) != expectedLen {
		t.Fatalf("data length = %d, want %d", len(data), expectedLen)
	}

	count := binary.LittleEndian.Uint32(data[len(vector)*4:])
	if count != 3 {
		t.Errorf("neighbor count = %d, want 3", count)
	}
}

// ============================================================================
// ParseNeighborsFromBuffer 测试
// ============================================================================

func TestParseNeighborsFromBuffer_Normal(t *testing.T) {
	dims := 4
	data := make([]byte, dims*4+4+3*4)
	// 写入向量 (任意值)
	for i := 0; i < dims*4; i++ {
		data[i] = byte(i)
	}
	// 写入邻居计数 3
	binary.LittleEndian.PutUint32(data[dims*4:], 3)
	// 写入邻居 ID
	binary.LittleEndian.PutUint32(data[dims*4+4:], 100)
	binary.LittleEndian.PutUint32(data[dims*4+8:], 200)
	binary.LittleEndian.PutUint32(data[dims*4+12:], 300)

	neighbors, err := ParseNeighborsFromBuffer(data, dims)
	if err != nil {
		t.Fatalf("ParseNeighborsFromBuffer failed: %v", err)
	}
	if len(neighbors) != 3 {
		t.Fatalf("len(neighbors) = %d, want 3", len(neighbors))
	}
	expected := []uint32{100, 200, 300}
	for i, id := range neighbors {
		if id != expected[i] {
			t.Errorf("neighbors[%d] = %d, want %d", i, id, expected[i])
		}
	}
}

func TestParseNeighborsFromBuffer_Empty(t *testing.T) {
	dims := 3
	data := make([]byte, dims*4+4)
	binary.LittleEndian.PutUint32(data[dims*4:], 0) // 0 neighbors

	neighbors, err := ParseNeighborsFromBuffer(data, dims)
	if err != nil {
		t.Fatalf("ParseNeighborsFromBuffer failed: %v", err)
	}
	if len(neighbors) != 0 {
		t.Errorf("len(neighbors) = %d, want 0", len(neighbors))
	}
}

func TestParseNeighborsFromBuffer_TooShort(t *testing.T) {
	// 缓冲区连 count 都不够
	_, err := ParseNeighborsFromBuffer([]byte{1, 2, 3}, 4)
	if err != ErrCorruptedFile {
		t.Errorf("Expected ErrCorruptedFile, got %v", err)
	}
}

func TestParseNeighborsFromBuffer_TruncatedNeighbors(t *testing.T) {
	dims := 2
	// 写入 count=5 但只提供了 2 个邻居的空间
	data := make([]byte, dims*4+4+2*4)
	binary.LittleEndian.PutUint32(data[dims*4:], 5) // 声称有 5 个邻居
	binary.LittleEndian.PutUint32(data[dims*4+4:], 1)
	binary.LittleEndian.PutUint32(data[dims*4+8:], 2)

	_, err := ParseNeighborsFromBuffer(data, dims)
	if err != ErrCorruptedFile {
		t.Errorf("Expected ErrCorruptedFile for truncated neighbors, got %v", err)
	}
}

func TestParseNeighborsFromBuffer_ZeroDims(t *testing.T) {
	data := make([]byte, 4) // 只有 count
	binary.LittleEndian.PutUint32(data[0:], 0)

	neighbors, err := ParseNeighborsFromBuffer(data, 0)
	if err != nil {
		t.Fatalf("ParseNeighborsFromBuffer failed: %v", err)
	}
	if len(neighbors) != 0 {
		t.Errorf("len(neighbors) = %d, want 0", len(neighbors))
	}
}

// ============================================================================
// ParseVectorFromBuffer 测试
// ============================================================================

func TestParseVectorFromBuffer_Normal(t *testing.T) {
	dims := 4
	data := make([]byte, dims*4)
	for i := 0; i < dims; i++ {
		binary.LittleEndian.PutUint32(data[i*4:], math.Float32bits(float32(i)*1.5))
	}

	vec, err := ParseVectorFromBuffer(data, dims)
	if err != nil {
		t.Fatalf("ParseVectorFromBuffer failed: %v", err)
	}
	if len(vec) != dims {
		t.Fatalf("len(vec) = %d, want %d", len(vec), dims)
	}
	for i := 0; i < dims; i++ {
		expected := float32(i) * 1.5
		if vec[i] != expected {
			t.Errorf("vec[%d] = %f, want %f", i, vec[i], expected)
		}
	}
}

func TestParseVectorFromBuffer_TooShort(t *testing.T) {
	_, err := ParseVectorFromBuffer([]byte{1, 2, 3}, 4)
	if err != ErrCorruptedFile {
		t.Errorf("Expected ErrCorruptedFile, got %v", err)
	}
}

func TestParseVectorFromBuffer_Empty(t *testing.T) {
	_, err := ParseVectorFromBuffer([]byte{}, 4)
	if err != ErrCorruptedFile {
		t.Errorf("Expected ErrCorruptedFile for empty buffer, got %v", err)
	}
}

func TestParseVectorFromBuffer_ZeroDims(t *testing.T) {
	vec, err := ParseVectorFromBuffer([]byte{}, 0)
	if err != nil {
		t.Fatalf("ParseVectorFromBuffer(empty, 0) failed: %v", err)
	}
	if len(vec) != 0 {
		t.Errorf("len(vec) = %d, want 0", len(vec))
	}
}

// ============================================================================
// SerializeNode + ParseNeighborsFromBuffer + ParseVectorFromBuffer 完整往返测试
// ============================================================================

func TestSerializeParseRoundTrip(t *testing.T) {
	vector := []float32{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8}
	neighbors := []uint32{42, 43, 44, 45}
	maxDegree := 8

	data := SerializeNode(vector, neighbors, maxDegree)

	// 解析邻居
	parsedNeighbors, err := ParseNeighborsFromBuffer(data, len(vector))
	if err != nil {
		t.Fatalf("ParseNeighborsFromBuffer failed: %v", err)
	}
	if len(parsedNeighbors) != len(neighbors) {
		t.Fatalf("parsed %d neighbors, want %d", len(parsedNeighbors), len(neighbors))
	}
	for i, id := range neighbors {
		if parsedNeighbors[i] != id {
			t.Errorf("neighbors[%d] = %d, want %d", i, parsedNeighbors[i], id)
		}
	}

	// 解析向量
	parsedVec, err := ParseVectorFromBuffer(data, len(vector))
	if err != nil {
		t.Fatalf("ParseVectorFromBuffer failed: %v", err)
	}
	if len(parsedVec) != len(vector) {
		t.Fatalf("parsed %d dims, want %d", len(parsedVec), len(vector))
	}
	for i, v := range vector {
		if parsedVec[i] != v {
			t.Errorf("vec[%d] = %f, want %f", i, parsedVec[i], v)
		}
	}
}

// ============================================================================
// SerializeNode 溢出边界 — maxDegree 很大
// ============================================================================

func TestSerializeNode_LargeMaxDegree(t *testing.T) {
	vector := []float32{1.0, 2.0}
	neighbors := []uint32{1}
	maxDegree := 1000

	data := SerializeNode(vector, neighbors, maxDegree)

	// 长度检查
	expectedLen := len(vector)*4 + 4 + maxDegree*4
	if len(data) != expectedLen {
		t.Fatalf("data length = %d, want %d", len(data), expectedLen)
	}

	// 检查最后一个填充值
	lastOffset := len(data) - 4
	lastVal := binary.LittleEndian.Uint32(data[lastOffset:])
	if lastVal != 0xFFFFFFFF {
		t.Errorf("last padding = 0x%X, want 0xFFFFFFFF", lastVal)
	}

	// 检查邻居计数正确
	count := binary.LittleEndian.Uint32(data[len(vector)*4:])
	if count != 1 {
		t.Errorf("neighbor count = %d, want 1", count)
	}
}
