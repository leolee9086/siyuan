package d5a

import (
	"encoding/binary"
	"os"
	"strings"
	"testing"
)

func TestInspectAndValidateGLB(t *testing.T) {
	path := writeGLBFixture(t, minimalGLTFDocument())
	report, errorValue := inspectGLB(path)
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	if report.Status != "pass" || report.GLB == nil {
		t.Fatalf("unexpected report: %+v", report)
	}
	if report.GLB.Version != 2 || report.GLB.MeshCount != 1 || report.GLB.PrimitiveCount != 1 || report.GLB.TriangleCount != 1 || report.GLB.MaterialCount != 1 {
		t.Fatalf("unexpected GLB inspection: %+v", report.GLB)
	}
	if errorValue = validateGLB(path, report); errorValue != nil {
		t.Fatal(errorValue)
	}
	if report.Status != "pass" || report.Validation == nil || report.Validation.ErrorCount != 0 || report.Validation.WarningCount != 0 {
		t.Fatalf("unexpected validation: %+v", report.Validation)
	}
}

func TestValidateGLTFDocumentFindsBrokenReferences(t *testing.T) {
	document := minimalGLTFDocument()
	document["scene"] = float64(4)
	meshes := document["meshes"].([]any)
	primitives := meshes[0].(map[string]any)["primitives"].([]any)
	primitives[0].(map[string]any)["material"] = float64(9)
	inspection := glbInspection{Chunks: []glbChunkInspection{{Type: "JSON"}, {Type: "BIN"}}, BinaryBytes: 44}
	result := validateGLTFDocument(document, inspection)
	if result.ErrorCount != 2 {
		t.Fatalf("expected two broken-reference errors, got %+v", result)
	}
}

func TestParseGLBRejectsDeclaredLengthMismatch(t *testing.T) {
	payload := buildGLB(t, minimalGLTFDocument())
	binary.LittleEndian.PutUint32(payload[8:12], uint32(len(payload)+4))
	path := writeGLBFixture(t, minimalGLTFDocument())
	if errorValue := os.WriteFile(path, payload, 0o644); errorValue != nil {
		t.Fatal(errorValue)
	}
	_, errorValue := parseGLB(path)
	if errorValue == nil || !strings.Contains(errorValue.Error(), "声明长度") {
		t.Fatalf("expected declared length error, got %v", errorValue)
	}
}
