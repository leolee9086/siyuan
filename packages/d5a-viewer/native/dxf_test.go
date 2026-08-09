package d5a

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestD5aToDxfWritesWorldGeometryAndMaterialColor(t *testing.T) {
	detail, _ := json.Marshal(map[string]any{"styleDatas": []any{map[string]any{
		"bActive": true,
		"elements": []any{map[string]any{
			"materialIndex": float64(0),
			"materialData": map[string]any{
				"title":   "Red/Material",
				"matInfo": `[{"name":"Diffuse (Color)","type":1,"value":"R=1,G=0,B=0,A=1"}]`,
			},
		}},
	}}})
	info, _ := json.Marshal(map[string]any{"material_MapKey": []any{"material"}, "detailInfo": string(detail)})
	input := writeZipFixture(t, []zipFixtureEntry{
		{name: "1.d5mesh", data: buildSeparatedD5Mesh([]uint32{0, 1, 2})},
		{name: "info.json", data: info},
	})
	source, errorValue := loadD5aDxfSource(context.Background(), input)
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	if source.metrics.TriangleCount != 1 || len(source.layers) != 1 || source.layers[0].trueColor != 0xff0000 {
		t.Fatalf("unexpected source: %+v / %+v", source.metrics, source.layers)
	}
	output := filepath.Join(t.TempDir(), "fixture.dxf")
	reportPath := output + ".fidelity.json"
	report, errorValue := writeAndVerifyDxf(context.Background(), input, output, reportPath, source, false, time.Now())
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	if report.Source.TriangleCount != 1 || report.RoundTrip.TriangleCount != 1 || report.Status != "warning" {
		t.Fatalf("unexpected report: %+v", report)
	}
	inspection, errorValue := inspectDxf(output)
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	if inspection.Bounds.Min != (point3{0, 0, 0}) || inspection.Bounds.Max != (point3{1, 1, 0}) {
		t.Fatalf("unexpected D5 bounds: %+v", inspection.Bounds)
	}
	if _, errorValue = os.Stat(reportPath); errorValue != nil {
		t.Fatal(errorValue)
	}
}

func TestGlbToDxfAppliesNodeTransformAndAxisMapping(t *testing.T) {
	document := minimalGLTFDocument()
	document["nodes"] = []any{map[string]any{"mesh": float64(0), "translation": []any{float64(1), float64(2), float64(3)}}}
	input := writeGLBFixture(t, document)
	source, errorValue := loadGlbDxfSource(context.Background(), input)
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	output := filepath.Join(t.TempDir(), "fixture.dxf")
	if _, errorValue = writeAndVerifyDxf(context.Background(), input, output, output+".json", source, false, time.Now()); errorValue != nil {
		t.Fatal(errorValue)
	}
	inspection, errorValue := inspectDxf(output)
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	if inspection.Bounds.Min != (point3{1, -3, 2}) || inspection.Bounds.Max != (point3{2, -3, 3}) {
		t.Fatalf("unexpected GLB bounds: %+v", inspection.Bounds)
	}
}

func TestConvertCommandProtectsExistingOutput(t *testing.T) {
	input := writeZipFixture(t, []zipFixtureEntry{{name: "1.d5mesh", data: buildSeparatedD5Mesh([]uint32{0, 1, 2})}})
	output := filepath.Join(t.TempDir(), "fixture.dxf")
	if errorValue := convertCommand([]string{input, "--output", output, "--quiet"}); errorValue != nil {
		t.Fatal(errorValue)
	}
	if errorValue := convertCommand([]string{input, "--output", output, "--quiet"}); errorValue == nil {
		t.Fatal("expected existing-output protection")
	}
	if errorValue := convertCommand([]string{input, "--output", output, "--overwrite", "--quiet"}); errorValue != nil {
		t.Fatal(errorValue)
	}
}
