package fswalk

import (
	"context"
	"errors"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestProbeImageReadsRasterAndSVGDimensions(t *testing.T) {
	root := t.TempDir()
	rasterPath := filepath.Join(root, "images", "sample.png")
	if err := os.MkdirAll(filepath.Dir(rasterPath), 0755); err != nil {
		t.Fatal(err)
	}
	file, err := os.Create(rasterPath)
	if err != nil {
		t.Fatal(err)
	}
	pixels := image.NewRGBA(image.Rect(0, 0, 7, 5))
	pixels.Set(0, 0, color.RGBA{R: 255, A: 255})
	if err = png.Encode(file, pixels); err != nil {
		file.Close()
		t.Fatal(err)
	}
	if err = file.Close(); err != nil {
		t.Fatal(err)
	}
	writeTextSearchFixture(t, root, "images/vector.svg", []byte(`<svg viewBox="0 0 320 180"></svg>`))

	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	raster, err := walker.ProbeImage(context.Background(), "images/sample.png")
	if err != nil || raster.Width != 7 || raster.Height != 5 || raster.Size <= 0 || raster.Path != "images/sample.png" {
		t.Fatalf("unexpected raster probe: %+v err=%v", raster, err)
	}
	vector, err := walker.ProbeImage(context.Background(), "images/vector.svg")
	if err != nil || vector.Width != 320 || vector.Height != 180 {
		t.Fatalf("unexpected SVG probe: %+v err=%v", vector, err)
	}
}

func TestProbeImageKeepsMetadataForUnsupportedFilesAndRejectsLinks(t *testing.T) {
	root := t.TempDir()
	writeTextSearchFixture(t, root, "plain.bin", []byte("not an image"))
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	probe, err := walker.ProbeImage(context.Background(), "plain.bin")
	if err == nil || probe.Name != "plain.bin" || probe.Size != int64(len("not an image")) {
		t.Fatalf("unsupported file did not preserve physical metadata: %+v err=%v", probe, err)
	}
	outside := filepath.Join(t.TempDir(), "outside.png")
	writeTextSearchFixture(t, filepath.Dir(outside), filepath.Base(outside), []byte("outside"))
	symlinkfixture.Create(t, outside, filepath.Join(root, "linked.png"))
	if _, err = walker.ProbeImage(context.Background(), "linked.png"); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("linked image was accepted: %v", err)
	}
}

func TestProbeImagesFiltersAndKeepsUnsupportedFileErrors(t *testing.T) {
	root := t.TempDir()
	writeProbePNG(t, root, "images/one.png", 9, 4)
	writeProbePNG(t, root, "images/skip/two.png", 3, 2)
	writeTextSearchFixture(t, root, "images/plain.bin", []byte("not an image"))
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	result, err := walker.ProbeImages(context.Background(), "images", ImageProbeQuery{
		Walk: WalkOptions{SortEntries: true},
		PruneDirectory: func(entry Metadata) bool {
			return entry.Name == "skip"
		},
		SelectFile: func(entry Metadata) bool {
			return entry.Name == "one.png" || entry.Name == "plain.bin"
		},
		ProbeWorkers: 2,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.SelectedCount != 2 || result.ProbedCount != 1 || result.FileErrorCount != 1 || len(result.Files) != 2 {
		t.Fatalf("unexpected batch probe result: %+v", result)
	}
	byName := map[string]ImageProbeRecord{}
	for _, record := range result.Files {
		byName[record.Probe.Name] = record
	}
	if byName["one.png"].Probe.Width != 9 || byName["one.png"].Probe.Height != 4 || byName["one.png"].Err != nil {
		t.Fatalf("valid image probe changed: %+v", byName["one.png"])
	}
	if byName["plain.bin"].Probe.Size == 0 || byName["plain.bin"].Err == nil {
		t.Fatalf("unsupported file metadata/error was lost: %+v", byName["plain.bin"])
	}
}

func TestDecodeImageKeepsReaderInsideWalker(t *testing.T) {
	root := t.TempDir()
	writeProbePNG(t, root, "sample.png", 6, 8)
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	called := false
	probe, err := walker.DecodeImage(context.Background(), "sample.png", func(callbackProbe ImageProbe, decoded image.Image) error {
		called = true
		if callbackProbe.Path != "sample.png" || decoded.Bounds().Dx() != 6 || decoded.Bounds().Dy() != 8 {
			t.Fatalf("unexpected decoded callback: probe=%+v bounds=%v", callbackProbe, decoded.Bounds())
		}
		return nil
	})
	if err != nil || !called || probe.Width != 6 || probe.Height != 8 {
		t.Fatalf("decode image failed: probe=%+v called=%v err=%v", probe, called, err)
	}
}

func writeProbePNG(t *testing.T, root, relative string, width, height int) {
	t.Helper()
	filePath := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		t.Fatal(err)
	}
	file, err := os.Create(filePath)
	if err != nil {
		t.Fatal(err)
	}
	if err = png.Encode(file, image.NewRGBA(image.Rect(0, 0, width, height))); err != nil {
		file.Close()
		t.Fatal(err)
	}
	if err = file.Close(); err != nil {
		t.Fatal(err)
	}
}
