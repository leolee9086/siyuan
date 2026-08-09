package d5a

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInspectAndExtractD5A(t *testing.T) {
	info, errorValue := json.Marshal(map[string]any{
		"title":           "fixture",
		"infoVersion":     1,
		"material_MapKey": []any{"material-0"},
		"detailInfo": map[string]any{"styleDatas": []any{map[string]any{
			"bActive": true,
			"elements": []any{map[string]any{
				"materialIndex": 0,
				"materialData":  map[string]any{"matInfo": []any{map[string]any{"type": 3, "value": "textures/albedo.png"}}},
			}},
		}}},
	})
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	archivePath := writeZipFixture(t, []zipFixtureEntry{
		{name: "1.d5mesh", data: buildSeparatedD5Mesh([]uint32{0, 1, 2})},
		{name: "textures/albedo.png", data: []byte("texture")},
		{name: "info.json", data: info},
	})
	report, errorValue := inspectD5A(archivePath)
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	if report.Status != "pass" || report.D5A == nil || report.D5A.Variant != "d5mesh" || len(report.D5A.Bundles) != 1 {
		t.Fatalf("unexpected D5A report: %+v", report)
	}
	bundle := report.D5A.Bundles[0]
	if bundle.Mesh == nil || bundle.Mesh.Version != 11 || bundle.Mesh.TriangleCount != 1 {
		t.Fatalf("unexpected mesh summary: %+v", bundle.Mesh)
	}
	if bundle.Material == nil || bundle.Material.MaterialCount != 1 || bundle.Material.TextureReferenceCount != 1 {
		t.Fatalf("unexpected material summary: %+v", bundle.Material)
	}

	output := filepath.Join(t.TempDir(), "extracted")
	extraction, errorValue := extractD5A(archivePath, output, []string{"textures/albedo.png"}, false)
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	if len(extraction.Entries) != 1 {
		t.Fatalf("unexpected extraction: %+v", extraction)
	}
	content, errorValue := os.ReadFile(filepath.Join(output, "textures", "albedo.png"))
	if errorValue != nil || string(content) != "texture" {
		t.Fatalf("unexpected extracted content %q: %v", content, errorValue)
	}
	if _, errorValue = extractD5A(archivePath, output, []string{"textures/albedo.png"}, false); errorValue == nil || !strings.Contains(errorValue.Error(), "输出已存在") {
		t.Fatalf("expected overwrite guard, got %v", errorValue)
	}
	if _, errorValue = extractD5A(archivePath, output, []string{"textures/albedo.png"}, true); errorValue != nil {
		t.Fatal(errorValue)
	}
	partials, errorValue := filepath.Glob(filepath.Join(output, "textures", "*.partial"))
	if errorValue != nil || len(partials) != 0 {
		t.Fatalf("temporary files remain: %v, %v", partials, errorValue)
	}
}

func TestExtractD5ARejectsTraversal(t *testing.T) {
	archivePath := writeZipFixture(t, []zipFixtureEntry{{name: "../outside.txt", data: []byte("outside")}})
	root := t.TempDir()
	output := filepath.Join(root, "output")
	_, errorValue := extractD5A(archivePath, output, nil, false)
	if errorValue == nil || !strings.Contains(errorValue.Error(), "路径越界") {
		t.Fatalf("expected path traversal error, got %v", errorValue)
	}
	if _, statError := os.Stat(filepath.Join(root, "outside.txt")); !os.IsNotExist(statError) {
		t.Fatalf("traversal created an outside file: %v", statError)
	}
}

func TestExtractD5ARejectsCaseInsensitiveOutputCollision(t *testing.T) {
	archivePath := writeZipFixture(t, []zipFixtureEntry{
		{name: "Textures/A.png", data: []byte("a")},
		{name: "textures/a.png", data: []byte("b")},
	})
	_, errorValue := extractD5A(archivePath, filepath.Join(t.TempDir(), "output"), nil, false)
	if errorValue == nil || !strings.Contains(errorValue.Error(), "冲突的输出路径") {
		t.Fatalf("expected output collision error, got %v", errorValue)
	}
}
