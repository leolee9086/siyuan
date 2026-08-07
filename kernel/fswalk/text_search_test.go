package fswalk

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func writeTextSearchFixture(t *testing.T, root, relative string, content []byte) {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, content, 0600); err != nil {
		t.Fatal(err)
	}
}

func TestSearchTextOwnsReadingFilteringAndTextClassification(t *testing.T) {
	root := t.TempDir()
	writeTextSearchFixture(t, root, "keep/a.go", append([]byte{0xef, 0xbb, 0xbf}, []byte("alpha\r\nbeta alpha\r\n")...))
	writeTextSearchFixture(t, root, "keep/readme.md", []byte("alpha\n"))
	writeTextSearchFixture(t, root, "keep/binary.go", []byte{'a', 0, 'b'})
	writeTextSearchFixture(t, root, "keep/large.go", []byte(strings.Repeat("x", 128)))
	writeTextSearchFixture(t, root, "skip/hidden.go", []byte("alpha\n"))

	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	result, err := walker.SearchText(context.Background(), "", TextSearchQuery{
		Walk:         WalkOptions{SortEntries: true, Workers: 4},
		MaxFileBytes: 64,
		MaxMatches:   10,
		ReadWorkers:  4,
		PruneDirectory: func(entry Metadata) bool {
			return entry.Path == "skip"
		},
		SelectFile: func(entry Metadata) bool {
			return strings.HasSuffix(entry.Name, ".go")
		},
		MatchLine: func(line TextLine) bool {
			return strings.Contains(line.Text, "alpha")
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.CandidateFileCount != 3 || result.ScannedFileCount != 1 ||
		result.SkippedBinaryCount != 1 || result.SkippedLargeCount != 1 || result.FileErrorCount != 0 {
		t.Fatalf("unexpected file classification: %+v", result)
	}
	paths := make([]string, len(result.Matches))
	lines := make([]int, len(result.Matches))
	for index, match := range result.Matches {
		paths[index] = match.Path
		lines[index] = match.Number
		if strings.Contains(match.Text, "\r") || strings.HasPrefix(match.Text, "\ufeff") {
			t.Fatalf("line was not normalized: %#v", match)
		}
	}
	if !slices.Equal(paths, []string{"keep/a.go", "keep/a.go"}) || !slices.Equal(lines, []int{1, 2}) {
		t.Fatalf("unexpected matches: %+v", result.Matches)
	}
	for _, match := range result.Matches {
		if strings.HasPrefix(match.Path, "skip/") || match.Path == "keep/readme.md" {
			t.Fatalf("declarative filters were ignored: %+v", result.Matches)
		}
	}
}

func TestSearchTextDirectFileLimitCancellationAndEscape(t *testing.T) {
	root := t.TempDir()
	writeTextSearchFixture(t, root, "target.txt", []byte("hit\nhit\n"))
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	result, err := walker.SearchText(context.Background(), "target.txt", TextSearchQuery{
		MaxMatches: 1,
		MatchLine:  func(line TextLine) bool { return line.Text == "hit" },
	})
	if err != nil || len(result.Matches) != 1 || !result.MatchLimitReached ||
		result.Traversal.FileCount != 1 || result.Matches[0].Path != "target.txt" {
		t.Fatalf("direct file search failed: result=%+v err=%v", result, err)
	}
	if _, err = walker.SearchText(context.Background(), "../outside.txt", TextSearchQuery{
		MatchLine: func(TextLine) bool { return true },
	}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("path escape was accepted: %v", err)
	}

	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = walker.SearchText(canceled, "target.txt", TextSearchQuery{
		MatchLine: func(TextLine) bool { return true },
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled search returned %v", err)
	}
}

func TestSearchTextRejectsDirectSymlink(t *testing.T) {
	root := t.TempDir()
	outside := filepath.Join(t.TempDir(), "outside.txt")
	writeTextSearchFixture(t, filepath.Dir(outside), filepath.Base(outside), []byte("secret"))
	link := filepath.Join(root, "outside-link.txt")
	symlinkfixture.Create(t, outside, link)
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	_, err = walker.SearchText(context.Background(), "outside-link.txt", TextSearchQuery{
		MatchLine: func(TextLine) bool { return true },
	})
	if !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("direct symlink was accepted: %v", err)
	}
}
