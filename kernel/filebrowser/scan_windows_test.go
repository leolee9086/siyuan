//go:build windows

package filebrowser

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"testing"
)

func TestScanContextDoesNotFollowDirectoryReplacedByJunction(t *testing.T) {
	workspace := t.TempDir()
	directory := filepath.Join(workspace, "replace-me")
	outside := t.TempDir()
	writeWalkTestFile(t, filepath.Join(directory, "original.txt"))
	writeWalkTestFile(t, filepath.Join(outside, "outside.txt"))

	paths := make([]string, 0, 2)
	replaced := false
	result, err := newWalkTestService(workspace).ScanContext(context.Background(),
		ScanRequest{RootID: "workspace", Workers: 1}, func(entry WalkEntry) error {
			paths = append(paths, entry.Path)
			if entry.Path != "replace-me" {
				return nil
			}
			if err := os.RemoveAll(directory); err != nil {
				return err
			}
			if err := createWalkDirectoryJunction(outside, directory); err != nil {
				return err
			}
			replaced = true
			return nil
		})
	if err != nil {
		t.Fatal(err)
	}
	if !replaced {
		t.Fatal("fixture directory was not replaced")
	}
	if slices.Contains(paths, "replace-me/outside.txt") {
		t.Fatalf("scan followed a replacement junction outside the root: %v", paths)
	}
	if result.ErrorCount != 1 || len(result.Errors) != 1 || result.Errors[0].Path != "replace-me" ||
		result.Errors[0].Code != "path-boundary" {
		t.Fatalf("replacement junction was not reported as a path boundary: %+v", result)
	}
}
