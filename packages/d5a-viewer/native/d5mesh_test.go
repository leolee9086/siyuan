package d5a

import (
	"bytes"
	"encoding/binary"
	"errors"
	"strings"
	"testing"
)

func TestParseD5MeshVersions(t *testing.T) {
	tests := []struct {
		name        string
		payload     []byte
		version     uint32
		triangles   int64
		vertices    int64
		descriptors int
	}{
		{name: "version 9", payload: buildInterleavedD5Mesh(9, 1, []uint32{0, 1, 2}), version: 9, triangles: 1, vertices: 3, descriptors: 1},
		{name: "version 10 instances", payload: buildInterleavedD5Mesh(10, 2, []uint32{0, 1, 2}), version: 10, triangles: 2, vertices: 6, descriptors: 2},
		{name: "version 11", payload: buildSeparatedD5Mesh([]uint32{0, 1, 2}), version: 11, triangles: 1, vertices: 3, descriptors: 1},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			parsed, errorValue := parseD5MeshStream(bytes.NewReader(test.payload), int64(len(test.payload)))
			if errorValue != nil {
				t.Fatal(errorValue)
			}
			if parsed.summary.Version != test.version || parsed.summary.TriangleCount != test.triangles || parsed.summary.VertexCount != test.vertices {
				t.Fatalf("unexpected summary: %+v", parsed.summary)
			}
			if parsed.summary.DescriptorCount != test.descriptors || parsed.summary.GeometryGroupCount != 1 {
				t.Fatalf("unexpected groups or descriptors: %+v", parsed.summary)
			}
			if len(parsed.warnings) != 0 {
				t.Fatalf("unexpected warnings: %v", parsed.warnings)
			}
		})
	}
}

func TestParseD5MeshRejectsInvalidIndex(t *testing.T) {
	payload := buildSeparatedD5Mesh([]uint32{0, 1, 3})
	_, errorValue := parseD5MeshStream(bytes.NewReader(payload), int64(len(payload)))
	if errorValue == nil || !strings.Contains(errorValue.Error(), "exceeds vertex count") {
		t.Fatalf("expected invalid index error, got %v", errorValue)
	}
}

func TestParseD5MeshRecognizesProtectedPayload(t *testing.T) {
	payload := make([]byte, 4)
	binary.LittleEndian.PutUint32(payload, protectedD5MeshMarker)
	_, errorValue := parseD5MeshStream(bytes.NewReader(payload), int64(len(payload)))
	if !errors.Is(errorValue, errProtectedD5Mesh) {
		t.Fatalf("expected protected payload marker, got %v", errorValue)
	}
}

func TestParseD5MeshRejectsTruncation(t *testing.T) {
	payload := buildInterleavedD5Mesh(10, 1, []uint32{0, 1, 2})
	payload = payload[:len(payload)-5]
	_, errorValue := parseD5MeshStream(bytes.NewReader(payload), int64(len(payload)))
	if errorValue == nil {
		t.Fatal("expected truncated payload error")
	}
}

func TestParseD5MeshGeometryRetainsOnlyPositionsIndicesAndTransforms(t *testing.T) {
	payload := buildInterleavedD5Mesh(10, 2, []uint32{0, 1, 2})
	parsed, errorValue := parseD5MeshGeometryStream(bytes.NewReader(payload), int64(len(payload)))
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	if len(parsed.groups) != 1 || len(parsed.descriptors) != 2 {
		t.Fatalf("unexpected geometry structure: %d groups / %d descriptors", len(parsed.groups), len(parsed.descriptors))
	}
	group := parsed.groups[0]
	if len(group.positions) != 9 || len(group.indices) != 3 {
		t.Fatalf("unexpected retained geometry: %d positions / %d indices", len(group.positions), len(group.indices))
	}
	if group.positions[3] != 1 || group.positions[7] != 1 || group.indices[2] != 2 {
		t.Fatalf("unexpected geometry values: %v / %v", group.positions, group.indices)
	}
	if parsed.descriptors[0].transform != identityMatrix4() {
		t.Fatalf("unexpected v10 identity transform: %v", parsed.descriptors[0].transform)
	}
}
