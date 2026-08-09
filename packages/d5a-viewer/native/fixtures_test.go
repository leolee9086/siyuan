package d5a

import (
	"archive/zip"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"
	"unicode/utf16"
)

type zipFixtureEntry struct {
	name string
	data []byte
}

func appendUint32(buffer *bytes.Buffer, value uint32) {
	encoded := [4]byte{}
	binary.LittleEndian.PutUint32(encoded[:], value)
	buffer.Write(encoded[:])
}

func appendFloat32(buffer *bytes.Buffer, value float32) {
	appendUint32(buffer, math.Float32bits(value))
}

func appendUTF8(buffer *bytes.Buffer, value string) {
	encoded := []byte(value)
	appendUint32(buffer, uint32(len(encoded)))
	buffer.Write(encoded)
}

func appendUTF16(buffer *bytes.Buffer, value string) {
	encoded := utf16.Encode([]rune(value))
	appendUint32(buffer, uint32(len(encoded)))
	for _, unit := range encoded {
		pair := [2]byte{}
		binary.LittleEndian.PutUint16(pair[:], unit)
		buffer.Write(pair[:])
	}
}

func appendFloatBlock(buffer *bytes.Buffer, count int) {
	for index := 0; index < count; index++ {
		appendFloat32(buffer, 0)
	}
}

func appendMatrix(buffer *bytes.Buffer, values []float32) {
	for _, value := range values {
		appendFloat32(buffer, value)
	}
}

func identityFixtureMatrix() []float32 {
	return []float32{1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1}
}

func buildInterleavedD5Mesh(versionValue uint32, descriptorCount int, indices []uint32) []byte {
	buffer := &bytes.Buffer{}
	appendUint32(buffer, versionValue)
	instances := descriptorCount
	if instances < 1 {
		instances = 1
	}
	metadata, _ := json.Marshal(map[string]any{"triangleCount": (len(indices) / 3) * instances})
	appendUTF8(buffer, string(metadata))
	appendUint32(buffer, 1)
	appendUTF8(buffer, "group")
	appendUint32(buffer, 3)
	vertices := [][]float32{
		{0, 0, 0, 0, 0, 0, 0, 1},
		{1, 0, 0, 1, 0, 0, 0, 1},
		{0, 1, 0, 0, 1, 0, 0, 1},
	}
	for _, vertex := range vertices {
		appendMatrix(buffer, vertex)
	}
	appendUint32(buffer, uint32(len(indices)))
	for _, index := range indices {
		appendUint32(buffer, index)
	}
	appendUint32(buffer, uint32(descriptorCount))
	for index := 0; index < descriptorCount; index++ {
		appendUTF8(buffer, "group")
		appendUTF8(buffer, "material")
		transformCount := 9
		if versionValue == 9 {
			appendMatrix(buffer, identityFixtureMatrix())
		} else {
			appendMatrix(buffer, []float32{0, 0, 0, 0, 0, 0, 1, 1, 1})
		}
		_ = transformCount
	}
	if versionValue == 10 {
		appendUint32(buffer, 0)
	}
	return buffer.Bytes()
}

func buildSeparatedD5Mesh(indices []uint32) []byte {
	buffer := &bytes.Buffer{}
	appendUint32(buffer, 11)
	metadata, _ := json.Marshal(map[string]any{"triangleCount": len(indices) / 3})
	appendUTF16(buffer, string(metadata))
	appendUint32(buffer, 0)
	appendUint32(buffer, 1)
	appendUTF16(buffer, "group")
	appendUTF16(buffer, "material")
	appendMatrix(buffer, identityFixtureMatrix())
	appendUint32(buffer, 1)
	appendUTF16(buffer, "group")
	appendUint32(buffer, 9)
	appendMatrix(buffer, []float32{0, 0, 0, 1, 0, 0, 0, 1, 0})
	appendUint32(buffer, 9)
	appendMatrix(buffer, []float32{0, 0, 1, 0, 0, 1, 0, 0, 1})
	appendUint32(buffer, 6)
	appendMatrix(buffer, []float32{0, 0, 1, 0, 0, 1})
	appendUint32(buffer, 0)
	appendUint32(buffer, uint32(len(indices)))
	for _, index := range indices {
		appendUint32(buffer, index)
	}
	return buffer.Bytes()
}

func writeZipFixture(t *testing.T, entries []zipFixtureEntry) string {
	t.Helper()
	archivePath := filepath.Join(t.TempDir(), "fixture.d5a")
	file, errorValue := os.Create(archivePath)
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	writer := zip.NewWriter(file)
	for _, entry := range entries {
		stream, createError := writer.Create(entry.name)
		if createError != nil {
			t.Fatal(createError)
		}
		if _, createError = stream.Write(entry.data); createError != nil {
			t.Fatal(createError)
		}
	}
	if errorValue = writer.Close(); errorValue != nil {
		t.Fatal(errorValue)
	}
	if errorValue = file.Close(); errorValue != nil {
		t.Fatal(errorValue)
	}
	return archivePath
}

func minimalGLTFDocument() map[string]any {
	return map[string]any{
		"asset":   map[string]any{"version": "2.0"},
		"buffers": []any{map[string]any{"byteLength": float64(42)}},
		"bufferViews": []any{
			map[string]any{"buffer": float64(0), "byteOffset": float64(0), "byteLength": float64(36)},
			map[string]any{"buffer": float64(0), "byteOffset": float64(36), "byteLength": float64(6)},
		},
		"accessors": []any{
			map[string]any{"bufferView": float64(0), "componentType": float64(5126), "count": float64(3), "type": "VEC3"},
			map[string]any{"bufferView": float64(1), "componentType": float64(5123), "count": float64(3), "type": "SCALAR"},
		},
		"materials": []any{map[string]any{"name": "material"}},
		"meshes": []any{map[string]any{"primitives": []any{map[string]any{
			"attributes": map[string]any{"POSITION": float64(0)}, "indices": float64(1), "material": float64(0),
		}}}},
		"nodes":  []any{map[string]any{"mesh": float64(0)}},
		"scenes": []any{map[string]any{"nodes": []any{float64(0)}}},
		"scene":  float64(0),
	}
}

func buildGLB(t *testing.T, document map[string]any) []byte {
	t.Helper()
	jsonBytes, errorValue := json.Marshal(document)
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	for len(jsonBytes)%4 != 0 {
		jsonBytes = append(jsonBytes, ' ')
	}
	binaryBytes := make([]byte, 44)
	positions := []float32{0, 0, 0, 1, 0, 0, 0, 1, 0}
	for index, value := range positions {
		binary.LittleEndian.PutUint32(binaryBytes[index*4:index*4+4], math.Float32bits(value))
	}
	binary.LittleEndian.PutUint16(binaryBytes[36:38], 0)
	binary.LittleEndian.PutUint16(binaryBytes[38:40], 1)
	binary.LittleEndian.PutUint16(binaryBytes[40:42], 2)
	totalLength := 12 + 8 + len(jsonBytes) + 8 + len(binaryBytes)
	buffer := &bytes.Buffer{}
	appendUint32(buffer, glbMagic)
	appendUint32(buffer, 2)
	appendUint32(buffer, uint32(totalLength))
	appendUint32(buffer, uint32(len(jsonBytes)))
	appendUint32(buffer, glbJSONChunk)
	buffer.Write(jsonBytes)
	appendUint32(buffer, uint32(len(binaryBytes)))
	appendUint32(buffer, glbBINChunk)
	buffer.Write(binaryBytes)
	return buffer.Bytes()
}

func writeGLBFixture(t *testing.T, document map[string]any) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "fixture.glb")
	if errorValue := os.WriteFile(path, buildGLB(t, document), 0o644); errorValue != nil {
		t.Fatal(errorValue)
	}
	return path
}
