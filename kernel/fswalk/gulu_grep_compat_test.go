package fswalk

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/88250/gulu"
)

func TestGuluGrepCompatibilityBaseline(t *testing.T) {
	t.Run("context ordering and result limit", func(t *testing.T) {
		root := t.TempDir()
		path := filepath.Join(root, "target.txt")
		content := "zero\nhit one\nbridge\nhit two\ntail"
		if err := os.WriteFile(path, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
		results, err := gulu.File.Grep(path, "", "hit", 1, 10)
		if err != nil {
			t.Fatal(err)
		}
		lines := make([]int, len(results))
		contexts := make([]bool, len(results))
		for index, result := range results {
			lines[index] = result.Line
			contexts[index] = result.Context
		}
		if !slices.Equal(lines, []int{1, 2, 3, 4, 5}) ||
			!slices.Equal(contexts, []bool{true, false, true, false, true}) {
			t.Fatalf("unexpected gulu context behavior: lines=%v contexts=%v", lines, contexts)
		}
		limited, err := gulu.File.Grep(path, "", "hit", 1, 3)
		if err != nil || len(limited) != 3 || limited[2].Line != 3 || !limited[2].Context {
			t.Fatalf("unexpected gulu context limit behavior: results=%+v err=%v", limited, err)
		}
	})

	t.Run("non-positive limit defaults to sixty-four", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "many.txt")
		if err := os.WriteFile(path, []byte(strings.Repeat("hit\n", 70)), 0600); err != nil {
			t.Fatal(err)
		}
		for _, limit := range []int{0, -1} {
			results, err := gulu.File.Grep(path, "", "hit", 0, limit)
			if err != nil || len(results) != 64 || results[63].Line != 64 {
				t.Fatalf("limit %d produced %d results, last=%+v err=%v", limit, len(results), results[len(results)-1], err)
			}
		}
	})

	t.Run("directory filters use actual implementation semantics", func(t *testing.T) {
		root := t.TempDir()
		for _, directory := range []string{".git", ".hidden"} {
			if err := os.MkdirAll(filepath.Join(root, directory), 0755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(root, directory, "ignored.go"), []byte("hit"), 0600); err != nil {
				t.Fatal(err)
			}
		}
		fixtures := map[string][]byte{
			"binary.go":   {'h', 'i', 't', 0, 'x'},
			"visible.go":  []byte("hit go"),
			"visible.ts":  []byte("hit ts"),
			"visible.tsx": []byte("hit tsx"),
		}
		for name, content := range fixtures {
			if err := os.WriteFile(filepath.Join(root, name), content, 0600); err != nil {
				t.Fatal(err)
			}
		}
		results, err := gulu.File.Grep(root, "*.{go,tsx}", "hit", 0, 20)
		if err != nil {
			t.Fatal(err)
		}
		names := make([]string, len(results))
		for index, result := range results {
			names[index] = filepath.Base(result.File)
		}
		if !slices.Equal(names, []string{"binary.go", "visible.go", "visible.tsx"}) {
			t.Fatalf("unexpected gulu include/hidden behavior: %v", names)
		}
		if !strings.Contains(results[0].Text, "\x00") {
			t.Fatalf("gulu binary-line behavior changed: %q", results[0].Text)
		}
	})

	t.Run("scanner errors are not returned", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "long.txt")
		line := strings.Repeat("x", 1024*1024) + "hit"
		if err := os.WriteFile(path, []byte(line), 0600); err != nil {
			t.Fatal(err)
		}
		results, err := gulu.File.Grep(path, "", "hit", 0, 10)
		if err != nil || len(results) != 0 {
			t.Fatalf("unexpected overlong-line behavior: results=%+v err=%v", results, err)
		}
	})

	t.Run("root and regex errors remain observable", func(t *testing.T) {
		if _, err := gulu.File.Grep(filepath.Join(t.TempDir(), "missing"), "", "hit", 0, 10); err == nil {
			t.Fatal("missing root did not return an error")
		}
		path := filepath.Join(t.TempDir(), "target.txt")
		if err := os.WriteFile(path, []byte("hit"), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := gulu.File.Grep(path, "", "[", 0, 10); err == nil {
			t.Fatal("invalid regex did not return an error")
		}
	})
}

func TestGrepTextMatchesGuluCharacterization(t *testing.T) {
	root := t.TempDir()
	for _, directory := range []string{".git", ".hidden", "visible"} {
		if err := os.MkdirAll(filepath.Join(root, directory), 0755); err != nil {
			t.Fatal(err)
		}
	}
	fixtures := map[string][]byte{
		".git/ignored.go":     []byte("hit"),
		".hidden/ignored.go":  []byte("hit"),
		"binary.go":           {'h', 'i', 't', 0, 'x'},
		"visible.go":          []byte("zero\nhit one\nbridge\nhit two\ntail"),
		"visible/extra.tsx":   []byte("hit tsx"),
		"visible/extra.ts":    []byte("hit ts"),
		"visible/no-match.go": []byte("none"),
	}
	for relative, content := range fixtures {
		path := filepath.Join(root, filepath.FromSlash(relative))
		if err := os.WriteFile(path, content, 0600); err != nil {
			t.Fatal(err)
		}
	}
	const include = "*.{go,tsx}"
	const pattern = "hit"
	const contextLines = 1
	const maxResults = 20
	legacy, err := gulu.File.Grep(root, include, pattern, contextLines, maxResults)
	if err != nil {
		t.Fatal(err)
	}
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	current, err := walker.GrepText(context.Background(), "", GrepQuery{
		Pattern: pattern, IncludeGlob: include, MaxResults: maxResults, ContextLines: contextLines,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(legacy) != len(current.Matches) {
		t.Fatalf("gulu and fswalk result count differ: legacy=%d current=%d\nlegacy=%+v\ncurrent=%+v",
			len(legacy), len(current.Matches), legacy, current.Matches)
	}
	for index, expected := range legacy {
		actual := current.Matches[index]
		if filepath.Base(expected.File) != filepath.Base(filepath.FromSlash(actual.Path)) ||
			expected.Line != actual.Number || expected.Text != actual.Text || expected.Context != actual.Context {
			t.Fatalf("gulu and fswalk result %d differ: legacy=%+v current=%+v", index, expected, actual)
		}
	}
}

func TestGrepTextMatchesGuluLimitsDirectFilesAndScannerBoundary(t *testing.T) {
	root := t.TempDir()
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	manyPath := filepath.Join(root, "many.txt")
	if err = os.WriteFile(manyPath, []byte(strings.Repeat("hit\n", 70)), 0600); err != nil {
		t.Fatal(err)
	}
	for _, limit := range []int{0, -1, 3} {
		legacy, legacyErr := gulu.File.Grep(manyPath, "", "hit", 0, limit)
		current, currentErr := walker.GrepText(context.Background(), "many.txt", GrepQuery{
			Pattern: "hit", MaxResults: limit,
		})
		assertGrepParity(t, root, legacy, legacyErr, current, currentErr)
	}

	longPath := filepath.Join(root, "long.txt")
	if err = os.WriteFile(longPath, []byte(strings.Repeat("x", 1024*1024)+"hit"), 0600); err != nil {
		t.Fatal(err)
	}
	legacy, legacyErr := gulu.File.Grep(longPath, "", "hit", 0, 10)
	current, currentErr := walker.GrepText(context.Background(), "long.txt", GrepQuery{
		Pattern: "hit", MaxResults: 10,
	})
	assertGrepParity(t, root, legacy, legacyErr, current, currentErr)

	hidden := filepath.Join(root, ".hidden")
	if err = os.MkdirAll(hidden, 0755); err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(filepath.Join(hidden, "inside.txt"), []byte("hit"), 0600); err != nil {
		t.Fatal(err)
	}
	legacy, legacyErr = gulu.File.Grep(hidden, "", "hit", 0, 10)
	current, currentErr = walker.GrepText(context.Background(), ".hidden", GrepQuery{
		Pattern: "hit", MaxResults: 10,
	})
	assertGrepParity(t, root, legacy, legacyErr, current, currentErr)

	_, legacyErr = gulu.File.Grep(filepath.Join(root, "missing"), "", "hit", 0, 10)
	_, currentErr = walker.GrepText(context.Background(), "missing", GrepQuery{Pattern: "hit"})
	if legacyErr == nil || currentErr == nil {
		t.Fatalf("missing target error parity failed: legacy=%v current=%v", legacyErr, currentErr)
	}
}

func assertGrepParity(t *testing.T, root string, legacy []*gulu.GrepResult, legacyErr error,
	current GrepResult, currentErr error) {
	t.Helper()
	if (legacyErr == nil) != (currentErr == nil) {
		t.Fatalf("grep error parity failed: legacy=%v current=%v", legacyErr, currentErr)
	}
	if legacyErr != nil {
		return
	}
	if len(legacy) != len(current.Matches) {
		t.Fatalf("grep count parity failed: legacy=%d current=%d", len(legacy), len(current.Matches))
	}
	for index, expected := range legacy {
		actual := current.Matches[index]
		relative, err := filepath.Rel(root, expected.File)
		if err != nil {
			t.Fatal(err)
		}
		if filepath.ToSlash(relative) != actual.Path || expected.Line != actual.Number ||
			expected.Text != actual.Text || expected.Context != actual.Context {
			t.Fatalf("grep result %d differs: legacy=%+v current=%+v", index, expected, actual)
		}
	}
}
