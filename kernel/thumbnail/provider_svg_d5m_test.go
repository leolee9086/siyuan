package thumbnail

import (
	"archive/zip"
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestSVGProviderReturnsReferenceBytesAndRejectsOtherExtensions(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "preview.SVG")
	want := []byte("<?xml version=\"1.0\"?><svg viewBox=\"0 0 2 2\"><path/></svg>")
	if err := os.WriteFile(path, want, 0o600); err != nil {
		t.Fatal(err)
	}
	provider := NewSVGProvider()
	if !provider.CanHandle(path) {
		t.Fatal("SVG provider must match an uppercase .SVG extension")
	}
	if provider.CanHandle(filepath.Join(root, "preview.svg.zip")) {
		t.Fatal("SVG provider must not match an archive suffix")
	}
	got, err := provider.Generate(path, 360, 360)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want) {
		t.Fatalf("SVG provider changed source bytes: got %q want %q", got, want)
	}
	if contentType := detectContentType(got); contentType != "image/svg+xml" {
		t.Fatalf("SVG provider MIME = %q, want image/svg+xml", contentType)
	}
}

func TestD5MProviderReadsOnlyRootIconPNGBytes(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "material.D5M")
	want := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02}
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	archive := zip.NewWriter(file)
	if _, err = archive.Create("metadata.json"); err != nil {
		t.Fatal(err)
	}
	icon, err := archive.Create("icon.png")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = icon.Write(want); err != nil {
		t.Fatal(err)
	}
	if _, err = archive.Create("textures/icon.png"); err != nil {
		t.Fatal(err)
	}
	if err = archive.Close(); err != nil {
		t.Fatal(err)
	}
	if err = file.Close(); err != nil {
		t.Fatal(err)
	}

	provider := NewD5MProvider()
	if !provider.CanHandle(path) {
		t.Fatal("D5M provider must match extension case-insensitively")
	}
	got, err := provider.Generate(path, 256, 256)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want) {
		t.Fatalf("D5M provider returned wrong icon bytes: got %v want %v", got, want)
	}
	if contentType := detectContentType(got); contentType != "image/png" {
		t.Fatalf("D5M icon MIME = %q, want image/png", contentType)
	}
}

func TestD5MProviderReportsMissingRootIcon(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "missing.d5m")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	archive := zip.NewWriter(file)
	if _, err = archive.Create("textures/icon.png"); err != nil {
		t.Fatal(err)
	}
	if err = archive.Close(); err != nil {
		t.Fatal(err)
	}
	if err = file.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err = NewD5MProvider().Generate(path, 256, 256); err == nil {
		t.Fatal("D5M provider must report a missing root icon.png")
	}
}

func TestManagerKeepsReferenceSpecificProviderOrder(t *testing.T) {
	manager := NewInstance()
	indices := map[string]int{}
	for index, provider := range manager.providers {
		indices[provider.Name()] = index
	}
	for _, name := range []string{"SVG", "SY", "D5M", "GoImaging"} {
		if _, ok := indices[name]; !ok {
			t.Fatalf("manager did not register %s provider: %v", name, indices)
		}
	}
	if !(indices["SVG"] < indices["SY"] && indices["SY"] < indices["D5M"] && indices["D5M"] < indices["GoImaging"]) {
		t.Fatalf("provider order = %v, want SVG < SY < D5M < GoImaging", indices)
	}
}
