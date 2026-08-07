package search

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFindAllMatchesUsesByteSearchAndPreservesAbsolutePaths(t *testing.T) {
	root := t.TempDir()
	writeFindFixture(t, root, "a.bin", []byte("alpha beta alpha"))
	writeFindFixture(t, root, "nested/b.bin", []byte{'x', 0, 'y'})
	writeFindFixture(t, root, "nested/unmatched.bin", []byte("none"))

	matches := FindAllMatches(root, []string{"alpha", "beta", "\x00y", "alpha"})
	got := make(map[string]int)
	for _, match := range matches {
		got[filepath.Clean(match.Path)+"\x00"+match.Target]++
	}
	want := []string{
		filepath.Join(root, "a.bin") + "\x00alpha",
		filepath.Join(root, "a.bin") + "\x00beta",
		filepath.Join(root, "nested", "b.bin") + "\x00\x00y",
	}
	for _, key := range want {
		if got[key] != 1 {
			t.Fatalf("expected one match for %q, got=%v", key, got)
		}
	}
	if len(got) != len(want) {
		t.Fatalf("unexpected matches: %+v", matches)
	}
	if paths := FindAllMatchedPaths(root, []string{"alpha", "beta"}); len(paths) != 1 || filepath.Clean(paths[0]) != filepath.Join(root, "a.bin") {
		t.Fatalf("path projection changed: %v", paths)
	}
}

func TestFindAllMatchesKeepsEmptyAndMissingRootSemantics(t *testing.T) {
	if matches := FindAllMatches("", []string{"target"}); matches != nil {
		t.Fatalf("empty root returned matches: %v", matches)
	}
	if matches := FindAllMatches(t.TempDir(), nil); matches != nil {
		t.Fatalf("empty targets returned matches: %v", matches)
	}
	if matches := FindAllMatches(filepath.Join(t.TempDir(), "missing"), []string{"target"}); matches != nil {
		t.Fatalf("missing root returned matches: %v", matches)
	}
}

func writeFindFixture(t *testing.T, root, relative string, content []byte) {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, content, 0600); err != nil {
		t.Fatal(err)
	}
}
