package d5a

import (
	"os"
	"path/filepath"
	"testing"
)

func TestInspectD5MeshPublicAPIUsesTheSharedParser(t *testing.T) {
	path := filepath.Join(t.TempDir(), "standalone.d5mesh")
	if err := os.WriteFile(path, buildSeparatedD5Mesh([]uint32{0, 1, 2}), 0o600); err != nil {
		t.Fatal(err)
	}
	report, err := InspectD5Mesh(path)
	if err != nil {
		t.Fatal(err)
	}
	if report.Format != "d5mesh" || report.D5A == nil || len(report.D5A.Bundles) != 1 ||
		report.D5A.Bundles[0].Mesh == nil || report.D5A.Bundles[0].Mesh.Version != 11 ||
		report.D5A.Bundles[0].Mesh.TriangleCount != 1 {
		t.Fatalf("unexpected standalone D5Mesh report: %+v", report)
	}
}
