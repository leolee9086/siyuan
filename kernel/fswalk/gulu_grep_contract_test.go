package fswalk

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"

	"github.com/88250/gulu"
	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestGrepTextMatchesGuluContractEdges(t *testing.T) {
	t.Run("single file ignores include glob", func(t *testing.T) {
		root := t.TempDir()
		path := writeGrepContractFile(t, root, "target.txt", []byte("hit\n"))
		assertGrepContractParity(t, root, path, "*.go", "hit", 0, 10)
	})

	t.Run("walk order is raw lexical order", func(t *testing.T) {
		root := t.TempDir()
		writeGrepContractFile(t, root, "B.txt", []byte("hit B\n"))
		writeGrepContractFile(t, root, "a.txt", []byte("hit a\n"))
		assertGrepContractParity(t, root, root, "", "hit", 0, 1)
	})

	t.Run("minus one context behaves like no context", func(t *testing.T) {
		root := t.TempDir()
		path := writeGrepContractFile(t, root, "target.txt", []byte("before\nhit\nafter\n"))
		assertGrepContractParity(t, root, path, "", "hit", -1, 10)
	})

	t.Run("missing root preserves stat error", func(t *testing.T) {
		root := t.TempDir()
		missing := filepath.Join(root, "missing.txt")
		legacy, legacyErr := gulu.File.Grep(missing, "", "hit", 0, 10)
		current, currentErr := runCandidateGrep(t, root, missing, "", "hit", 0, 10)
		if len(legacy) != 0 || len(current.Matches) != 0 {
			t.Fatalf("missing root returned matches: legacy=%+v current=%+v", legacy, current.Matches)
		}
		assertGrepErrorContract(t, legacyErr, currentErr)
	})

	t.Run("invalid regex precedes missing root", func(t *testing.T) {
		root := t.TempDir()
		missing := filepath.Join(root, "missing.txt")
		_, legacyErr := gulu.File.Grep(missing, "", "[", 0, 10)
		_, currentErr := runCandidateGrep(t, root, missing, "", "[", 0, 10)
		assertGrepErrorContract(t, legacyErr, currentErr)
	})

	t.Run("context below minus one retains legacy panic", func(t *testing.T) {
		root := t.TempDir()
		path := writeGrepContractFile(t, root, "target.txt", []byte("hit\n"))
		legacyPanic := captureGrepPanic(func() {
			_, _ = gulu.File.Grep(path, "", "hit", -2, 10)
		})
		currentPanic := captureGrepPanic(func() {
			_, _ = runCandidateGrep(t, root, path, "", "hit", -2, 10)
		})
		if legacyPanic == nil || currentPanic == nil ||
			reflect.TypeOf(legacyPanic) != reflect.TypeOf(currentPanic) ||
			fmt.Sprint(legacyPanic) != fmt.Sprint(currentPanic) {
			t.Fatalf("grep panic differs: legacy=(%T) %v current=(%T) %v",
				legacyPanic, legacyPanic, currentPanic, currentPanic)
		}
	})

	t.Run("line bytes and scan line boundaries", func(t *testing.T) {
		root := t.TempDir()
		path := writeGrepContractFile(t, root, "bytes.txt", []byte{
			0xef, 0xbb, 0xbf, 'h', 'i', 't', '\r', '\n',
			'h', 'i', 't', 0, 0xff, '\n',
			'h', 'i', 't', '\r', 'x', '\n',
			'\n',
		})
		assertGrepContractParity(t, root, path, "", "hit", 1, 20)
	})

	t.Run("recursive brace and invalid include", func(t *testing.T) {
		root := t.TempDir()
		for _, name := range []string{"a.go", "b.ts", "c.tsx", ".visible.go"} {
			writeGrepContractFile(t, root, name, []byte("hit "+name+"\n"))
		}
		assertGrepContractParity(t, root, root, "*.{go,{ts,tsx}}", "hit", 0, 20)
		assertGrepContractParity(t, root, root, "[", "hit", 0, 20)
	})

	t.Run("scanner keeps prior results before oversized token", func(t *testing.T) {
		root := t.TempDir()
		content := "hit first\n" + strings.Repeat("x", 1024*1024) + "hit hidden\nhit never-scanned\n"
		path := writeGrepContractFile(t, root, "long.txt", []byte(content))
		assertGrepContractParity(t, root, path, "", "hit", 0, 20)
	})
}

func TestGrepTextMatchesGuluDirectoryReparseEntries(t *testing.T) {
	root := t.TempDir()
	writeGrepContractFile(t, root, "real/file.txt", []byte("hit file\n"))
	directoryLink := filepath.Join(root, "directory-link")
	if err := createGrepContractDirectoryReparse(filepath.Join(root, "real"), directoryLink); err != nil {
		t.Fatal(err)
	}
	assertGrepContractParity(t, root, directoryLink, "", "hit", 0, 10)
	assertGrepContractParity(t, root, filepath.Join(directoryLink, "file.txt"), "", "hit", 0, 10)
}

func TestGrepTextMatchesGuluSymbolicLinkEntries(t *testing.T) {
	root := t.TempDir()
	realFile := writeGrepContractFile(t, root, "real/file.txt", []byte("hit file\n"))
	fileLink := filepath.Join(root, "file-link.txt")
	symlinkfixture.Create(t, realFile, fileLink)
	assertGrepContractParity(t, root, fileLink, "*.ignored", "hit", 0, 10)

	directoryLink := filepath.Join(root, "directory-link")
	symlinkfixture.Create(t, filepath.Join(root, "real"), directoryLink)
	assertGrepContractParity(t, root, directoryLink, "", "hit", 0, 10)
	assertGrepContractParity(t, root, filepath.Join(directoryLink, "file.txt"), "", "hit", 0, 10)
}

func TestGrepTextRejectsSymbolicLinkEscapeAtAuthorizationBoundary(t *testing.T) {
	root := t.TempDir()
	outsideRoot := t.TempDir()
	outsideFile := writeGrepContractFile(t, outsideRoot, "outside.txt", []byte("hit outside\n"))
	fileLink := filepath.Join(root, "outside-file.txt")
	directoryLink := filepath.Join(root, "outside-directory")
	symlinkfixture.Create(t, outsideFile, fileLink)
	symlinkfixture.Create(t, outsideRoot, directoryLink)
	for _, target := range []string{fileLink, filepath.Join(directoryLink, "outside.txt")} {
		_, err := runCandidateGrep(t, root, target, "", "hit", 0, 10)
		if !errors.Is(err, ErrPathTraversal) {
			t.Fatalf("grep followed an external symbolic link %s: %v", target, err)
		}
	}
}

func TestGrepTextMatchesGuluBrokenSymbolicLinkContract(t *testing.T) {
	root := t.TempDir()
	target := writeGrepContractFile(t, root, "target.txt", []byte("hit\n"))
	link := filepath.Join(root, "broken.txt")
	symlinkfixture.Create(t, target, link)
	if err := os.Remove(target); err != nil {
		t.Fatal(err)
	}
	legacy, legacyErr := gulu.File.Grep(link, "", "hit", 0, 10)
	current, currentErr := runCandidateGrep(t, root, link, "", "hit", 0, 10)
	assertGrepErrorContract(t, legacyErr, currentErr)
	if legacyErr == nil || len(legacy) != 0 || len(current.Matches) != 0 {
		t.Fatalf("broken symbolic-link contract differs: legacy=%+v current=%+v", legacy, current)
	}
}

func TestGrepTextRejectsDirectoryReparseEscapeAtAuthorizationBoundary(t *testing.T) {
	root := t.TempDir()
	outsideRoot := t.TempDir()
	writeGrepContractFile(t, outsideRoot, "outside.txt", []byte("hit outside\n"))
	link := filepath.Join(root, "outside-link")
	if err := createGrepContractDirectoryReparse(outsideRoot, link); err != nil {
		t.Fatal(err)
	}
	_, err := runCandidateGrep(t, root, filepath.Join(link, "outside.txt"), "", "hit", 0, 10)
	if !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("grep followed a file link outside its bound root: %v", err)
	}
}

func TestGrepTextExistingDirectoryReparse(t *testing.T) {
	configured := os.Getenv("SFORGE_TEST_DIRECTORY_REPARSE")
	if configured == "" {
		t.Skip("SFORGE_TEST_DIRECTORY_REPARSE is not set")
	}
	configured, err := filepath.Abs(configured)
	if err != nil {
		t.Fatal(err)
	}
	kind, err := grepContractReparseKind(configured)
	if err != nil {
		t.Fatal(err)
	}
	if kind != "junction" && runtime.GOOS == "windows" {
		t.Fatalf("fixture is %s, not a junction: %s", kind, configured)
	}
	entries := []string{configured}
	if child := os.Getenv("SFORGE_TEST_DIRECTORY_REPARSE_CHILD"); child != "" {
		entries = append(entries, filepath.Join(configured, filepath.FromSlash(child)))
	}
	root := os.Getenv("SFORGE_TEST_DIRECTORY_REPARSE_ROOT")
	if root == "" {
		root = filepath.Dir(configured)
	}
	root, err = filepath.Abs(root)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		assertGrepContractParity(t, root, entry, "", ".*", 0, 1)
	}
}

func TestGrepTextDifferentialMatrix(t *testing.T) {
	root := t.TempDir()
	fixtures := map[string][]byte{
		"B.go":              []byte("zero\nhit B\ntail\n"),
		"a.go":              {0xef, 0xbb, 0xbf, 'h', 'i', 't', '\r', '\n', 0xff, 'x', '\n'},
		".visible.go":       []byte("hit dot file\n"),
		"plain.txt":         {'n', 'o', 'n', 'e', '\n', 'h', 'i', 't', 0, 'x', '\n'},
		"nested/Z.tsx":      []byte("HIT upper\n\nhit lower\n"),
		"nested/a.ts":       []byte("before\nhit ts\nafter\n"),
		".hidden/skip.go":   []byte("hit hidden directory\n"),
		".git/ignored.go":   []byte("hit git\n"),
		"nested/no-newline": []byte("hit end"),
	}
	for relative, content := range fixtures {
		writeGrepContractFile(t, root, relative, content)
	}
	includes := []string{"", "*.go", "*.{go,tsx}", "["}
	patterns := []string{"", "hit", "(?i)hit", "^$", "\\x00"}
	contexts := []int{-1, 0, 2}
	limits := []int{-1, 1, 4, 64}
	for _, include := range includes {
		for _, pattern := range patterns {
			for _, contextLines := range contexts {
				for _, limit := range limits {
					legacy, legacyErr := gulu.File.Grep(root, include, pattern, contextLines, limit)
					current, currentErr := runCandidateGrep(t, root, root, include, pattern, contextLines, limit)
					assertGrepErrorContract(t, legacyErr, currentErr)
					if legacyErr != nil {
						continue
					}
					if len(legacy) != len(current.Matches) {
						t.Fatalf("matrix count differs include=%q pattern=%q context=%d limit=%d: legacy=%d current=%d",
							include, pattern, contextLines, limit, len(legacy), len(current.Matches))
					}
					for index, expected := range legacy {
						actual := current.Matches[index]
						relative, err := filepath.Rel(root, expected.File)
						if err != nil {
							t.Fatal(err)
						}
						if filepath.ToSlash(relative) != actual.Path || expected.Line != actual.Number ||
							expected.Text != actual.Text || expected.Context != actual.Context {
							t.Fatalf("matrix result differs include=%q pattern=%q context=%d limit=%d index=%d: legacy=%+v current=%+v",
								include, pattern, contextLines, limit, index, expected, actual)
						}
					}
				}
			}
		}
	}
}

func TestGrepTextMatchesGuluScannerTokenBoundary(t *testing.T) {
	root := t.TempDir()
	const maximum = 1024 * 1024
	for _, tokenBytes := range []int{maximum - 2, maximum - 1, maximum, maximum + 1} {
		name := "line-" + strings.Repeat("x", tokenBytes%7) + ".txt"
		content := []byte("hit" + strings.Repeat("x", tokenBytes-3) + "\n")
		path := writeGrepContractFile(t, root, name, content)
		assertGrepContractParity(t, root, path, "", "hit", 0, 10)
	}
}

func assertGrepContractParity(t *testing.T, walkerRoot, target, include, pattern string,
	contextLines, maxResults int) {
	t.Helper()
	legacy, legacyErr := gulu.File.Grep(target, include, pattern, contextLines, maxResults)
	current, currentErr := runCandidateGrep(t, walkerRoot, target, include, pattern, contextLines, maxResults)
	assertGrepErrorContract(t, legacyErr, currentErr)
	if legacyErr != nil {
		return
	}
	if len(legacy) != len(current.Matches) {
		t.Fatalf("grep count differs: legacy=%d current=%d\nlegacy=%+v\ncurrent=%+v",
			len(legacy), len(current.Matches), legacy, current.Matches)
	}
	for index, expected := range legacy {
		actual := current.Matches[index]
		relative, err := filepath.Rel(walkerRoot, expected.File)
		if err != nil {
			t.Fatal(err)
		}
		if filepath.ToSlash(relative) != actual.Path || expected.Line != actual.Number ||
			expected.Text != actual.Text || expected.Context != actual.Context {
			t.Fatalf("grep result %d differs: legacy=%+v current=%+v", index, expected, actual)
		}
	}
}

func assertGrepErrorContract(t *testing.T, legacy, current error) {
	t.Helper()
	if (legacy == nil) != (current == nil) {
		t.Fatalf("grep error presence differs: legacy=%v current=%v", legacy, current)
	}
	if legacy == nil {
		return
	}
	if reflect.TypeOf(legacy) != reflect.TypeOf(current) || legacy.Error() != current.Error() {
		t.Fatalf("grep error differs: legacy=(%T) %q current=(%T) %q",
			legacy, legacy.Error(), current, current.Error())
	}
}

func captureGrepPanic(call func()) (recovered any) {
	defer func() { recovered = recover() }()
	call()
	return nil
}

func runCandidateGrep(t *testing.T, walkerRoot, target, include, pattern string,
	contextLines, maxResults int) (GrepResult, error) {
	t.Helper()
	walker, err := New(walkerRoot)
	if err != nil {
		t.Fatal(err)
	}
	relative, err := filepath.Rel(walkerRoot, target)
	if err != nil {
		t.Fatal(err)
	}
	return walker.GrepText(context.Background(), filepath.ToSlash(relative), GrepQuery{
		Pattern: pattern, IncludeGlob: include, MaxResults: maxResults, ContextLines: contextLines,
	})
}

func writeGrepContractFile(t *testing.T, root, relative string, content []byte) string {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, content, 0600); err != nil {
		t.Fatal(err)
	}
	return path
}
