package thumbnail

import (
	"image"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestSYProviderUsesReferenceProductIconFixture(t *testing.T) {
	root := t.TempDir()
	iconPath := filepath.Join(root, "stage", "icon.png")
	if err := os.MkdirAll(filepath.Dir(iconPath), 0o755); err != nil {
		t.Fatal(err)
	}
	iconFile, err := os.Create(iconPath)
	if err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(iconFile, image.NewRGBA(image.Rect(0, 0, 2, 2))); err != nil {
		_ = iconFile.Close()
		t.Fatal(err)
	}
	if err := iconFile.Close(); err != nil {
		t.Fatal(err)
	}

	provider := newSYProvider(iconPath)
	if !provider.CanHandle(filepath.Join(root, "notes", "example.SY")) {
		t.Fatal("SY provider must match .sy files case-insensitively")
	}
	if provider.CanHandle(filepath.Join(root, "notes", "example.sy.zip")) {
		t.Fatal("SY provider must not match .sy.zip imports")
	}

	got, err := provider.Generate(filepath.Join(root, "notes", "example.sy"), 256, 256)
	if err != nil {
		t.Fatal(err)
	}
	want, err := os.ReadFile(iconPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(want) {
		t.Fatal("SY provider must return the configured product icon bytes")
	}
	if gotType := detectContentType(got); gotType != "image/png" {
		t.Fatalf("SY fixture MIME = %q, want image/png", gotType)
	}
}

func TestManagerRegistersSYProviderBeforeD5M(t *testing.T) {
	manager := NewInstance()
	syIndex, d5mIndex := -1, -1
	for index, provider := range manager.providers {
		switch provider.Name() {
		case "SY":
			syIndex = index
		case "D5M":
			d5mIndex = index
		}
	}
	if syIndex < 0 || d5mIndex < 0 || syIndex >= d5mIndex {
		t.Fatalf("provider order = SY:%d D5M:%d, want SY before D5M", syIndex, d5mIndex)
	}
}

func TestSYProviderReportsMissingIcon(t *testing.T) {
	provider := newSYProvider(filepath.Join(t.TempDir(), "missing", "icon.png"))
	if _, err := provider.Generate("document.sy", 256, 256); err == nil {
		t.Fatal("missing SY product icon must be reported, not replaced with a fallback")
	}
}
