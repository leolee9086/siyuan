package fswalk

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestSearchByteTargetsStreamsAcrossChunksAndDeduplicatesPerFile(t *testing.T) {
	root := t.TempDir()
	writeTextSearchFixture(t, root, "boundary.bin", append([]byte(strings.Repeat("x", 64*1024-2)), []byte("needle")...))
	writeTextSearchFixture(t, root, "duplicate.bin", []byte("needle--needle"))
	writeTextSearchFixture(t, root, "binary.bin", []byte{'a', 0, 'b', 'c'})
	writeTextSearchFixture(t, root, "unmatched.bin", []byte("none"))
	writeTextSearchFixture(t, root, "skip/ignored.bin", []byte("needle"))

	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	result, err := walker.SearchByteTargets(context.Background(), "", ByteSearchQuery{
		Targets: []string{"needle", "\x00b", "needle", ""},
		SelectFile: func(entry Metadata) bool {
			return !strings.HasPrefix(entry.Path, "skip/")
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.CandidateFileCount != 4 || result.ScannedFileCount != 4 || result.FileErrorCount != 0 {
		t.Fatalf("unexpected byte search counts: %+v", result)
	}
	got := make(map[string]int)
	for _, match := range result.Matches {
		got[match.Path+"\x00"+match.Target]++
	}
	want := []string{"boundary.bin\x00needle", "duplicate.bin\x00needle", "binary.bin\x00\x00b"}
	for _, key := range want {
		if got[key] != 1 {
			t.Fatalf("expected one match for %q, got=%v", key, got)
		}
	}
	if len(got) != len(want) {
		t.Fatalf("unexpected byte matches: %+v", result.Matches)
	}
}

func TestSearchByteTargetsRejectsDirectLinksEscapeAndCancellation(t *testing.T) {
	root := t.TempDir()
	outside := filepath.Join(t.TempDir(), "outside.bin")
	if err := os.WriteFile(outside, []byte("needle"), 0600); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(root, "outside-link.bin")
	symlinkfixture.Create(t, outside, link)
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = walker.SearchByteTargets(context.Background(), "outside-link.bin",
		ByteSearchQuery{Targets: []string{"needle"}}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("direct symlink was accepted: %v", err)
	}
	if _, err = walker.SearchByteTargets(context.Background(), "../outside.bin",
		ByteSearchQuery{Targets: []string{"needle"}}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("path escape was accepted: %v", err)
	}
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err = walker.SearchByteTargets(canceled, "", ByteSearchQuery{Targets: []string{"needle"}}); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled byte search returned %v", err)
	}
}
