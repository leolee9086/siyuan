package main

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
)

func TestFixtureManifestMatchesRealFilesystemForAllShapes(t *testing.T) {
	tests := []struct {
		name        string
		config      fixtureConfig
		files       uint64
		directories uint64
	}{
		{name: "balanced", config: fixtureConfig{Shape: "balanced", Parents: 3, Branches: 2, Files: 4},
			files: 24, directories: 9},
		{name: "wide", config: fixtureConfig{Shape: "wide", Count: 37}, files: 37},
		{name: "deep", config: fixtureConfig{Shape: "deep", Depth: 12}, files: 12, directories: 12},
		{name: "empty", config: fixtureConfig{Shape: "empty", Count: 37}, directories: 37},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			fixture, err := makeFixture(test.config)
			if err != nil {
				t.Fatal(err)
			}
			defer os.RemoveAll(fixture.Root)
			actual, err := snapshotFilesystem(fixture.Root)
			if err != nil {
				t.Fatal(err)
			}
			if !snapshotsMatch(actual, fixture.Expected) || actual.Files != test.files ||
				actual.Directories != test.directories {
				t.Fatalf("fixture manifest differs from real filesystem: expected=%+v actual=%+v",
					fixture.Expected, actual)
			}
		})
	}
}

func TestNativeTimingPathPreservesValidationCounts(t *testing.T) {
	fixture, err := makeFixture(fixtureConfig{Shape: "balanced", Parents: 4, Branches: 2, Files: 8})
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(fixture.Root)
	run := runNative(4)
	validation, err := run(context.Background(), fixture.Root, true)
	if err != nil {
		t.Fatal(err)
	}
	timing, err := run(context.Background(), fixture.Root, false)
	if err != nil {
		t.Fatal(err)
	}
	if !snapshotsMatch(validation, fixture.Expected) || timing.Entries != validation.Entries ||
		timing.Files != validation.Files || timing.Directories != validation.Directories ||
		timing.Errors != validation.Errors {
		t.Fatalf("native timing path differs from validation: expected=%+v validation=%+v timing=%+v",
			fixture.Expected, validation, timing)
	}
}

func snapshotFilesystem(root string) (snapshot, error) {
	acc := newAccumulator(root, true)
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		acc.addAbsolute(path, entry.IsDir())
		return nil
	})
	return acc.snapshot(true), err
}
