package fswalk

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestReadJSONDocumentsReturnsBoundedSnapshotsAndContinuesErrors(t *testing.T) {
	root := t.TempDir()
	writeTextSearchFixture(t, root, "meta/one.json", []byte(`{"path":"assets/one.png"}`))
	writeTextSearchFixture(t, root, "meta/bad.json", []byte(`{"path":`))
	writeTextSearchFixture(t, root, "meta/large.json", []byte(strings.Repeat("x", 128)))
	writeTextSearchFixture(t, root, "skip/two.json", []byte(`{"path":"assets/two.png"}`))
	writeTextSearchFixture(t, root, "meta/readme.txt", []byte(`not json`))
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	result, err := walker.ReadJSONDocuments(context.Background(), "", JSONDocumentQuery{
		MaxFileBytes: 64,
		PruneDirectory: func(entry Metadata) bool {
			return entry.Path == "skip"
		},
		SelectFile: func(entry Metadata) bool {
			return filepath.Ext(entry.Name) == ".json"
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.SelectedFileCount != 3 || result.ReadFileCount != 2 || result.SkippedLargeCount != 1 ||
		result.FileErrorCount != 0 || len(result.Documents) != 2 {
		t.Fatalf("unexpected JSON document result: %+v", result)
	}
	for _, document := range result.Documents {
		if filepath.IsAbs(document.Path) || strings.Contains(document.Path, "\\") {
			t.Fatalf("document exposed a non-root-relative path: %+v", document)
		}
	}
}

func TestReadJSONDocumentsRejectsLinksEscapeAndCancellation(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	writeTextSearchFixture(t, outside, "outside.json", []byte(`{"path":"outside"}`))
	symlinkfixture.Create(t, outside, filepath.Join(root, "linked"))
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = walker.ReadJSONDocuments(context.Background(), "linked", JSONDocumentQuery{}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("linked JSON root was accepted: %v", err)
	}
	if _, err = walker.ReadJSONDocuments(context.Background(), "../outside", JSONDocumentQuery{}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("JSON path escape was accepted: %v", err)
	}
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err = walker.ReadJSONDocuments(canceled, "", JSONDocumentQuery{}); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled JSON read returned %v", err)
	}
}
