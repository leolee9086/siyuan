package tools

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/88250/gulu"
	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestFileGrepPreservesGuluTextContract(t *testing.T) {
	workspace := t.TempDir()
	originalWorkspace := util.WorkspaceDir
	util.WorkspaceDir = workspace
	defer func() { util.WorkspaceDir = originalWorkspace }()

	path := filepath.Join(workspace, "visible.txt")
	content := "zero\nhit one\nbridge\nhit two\ntail"
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
	legacy, err := gulu.File.Grep(path, "", "hit", 1, 10)
	if err != nil {
		t.Fatal(err)
	}
	var expected strings.Builder
	expected.WriteString(fmt.Sprintf("Found %d lines:\n\n", len(legacy)))
	for _, match := range legacy {
		relative, relErr := filepath.Rel(workspace, match.File)
		if relErr != nil {
			relative = match.File
		}
		separator := ":"
		if match.Context {
			separator = "-:"
		}
		expected.WriteString(fmt.Sprintf("%s:%d%s %s\n", relative, match.Line, separator, match.Text))
	}

	result, err := fileGrep(map[string]any{
		"pattern": "hit", "path": "visible.txt", "context": float64(1), "limit": float64(10),
	})
	if err != nil || result.IsError || len(result.Content) != 1 {
		t.Fatalf("fileGrep failed: result=%+v err=%v", result, err)
	}
	if result.Content[0].Text != expected.String() {
		t.Fatalf("fileGrep output differs from gulu contract:\nexpected=%q\nactual=%q", expected.String(), result.Content[0].Text)
	}
}

func TestFileGrepPreservesGuluBraceAndHiddenDirectorySelection(t *testing.T) {
	workspace := t.TempDir()
	originalWorkspace := util.WorkspaceDir
	util.WorkspaceDir = workspace
	defer func() { util.WorkspaceDir = originalWorkspace }()
	for _, relative := range []string{"search/.git/ignored.go", "search/visible.go", "search/visible.tsx", "search/visible.ts"} {
		path := filepath.Join(workspace, filepath.FromSlash(relative))
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("hit"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	result, err := fileGrep(map[string]any{
		"pattern": "hit", "path": "search", "include": "*.{go,tsx}", "limit": float64(20),
	})
	if err != nil || result.IsError {
		t.Fatalf("directory fileGrep failed: result=%+v err=%v", result, err)
	}
	text := result.Content[0].Text
	for _, expected := range []string{"visible.go:1: hit", "visible.tsx:1: hit"} {
		if !strings.Contains(text, expected) {
			t.Fatalf("missing expected match %q in %q", expected, text)
		}
	}
	if strings.Contains(text, ".git") || strings.Contains(text, "visible.ts:1") {
		t.Fatalf("gulu directory selection contract changed: %q", text)
	}
}

func TestFileGrepPreservesGuluDirectFileContextLimitAndErrors(t *testing.T) {
	workspace := t.TempDir()
	originalWorkspace := util.WorkspaceDir
	util.WorkspaceDir = workspace
	defer func() { util.WorkspaceDir = originalWorkspace }()

	path := filepath.Join(workspace, "direct.txt")
	if err := os.WriteFile(path, []byte(strings.Repeat("hit\n", 220)), 0600); err != nil {
		t.Fatal(err)
	}
	result, err := fileGrep(map[string]any{
		"pattern": "hit", "path": "direct.txt", "include": "*.go",
		"context": float64(-1), "limit": float64(0),
	})
	if err != nil || result.IsError {
		t.Fatalf("direct file grep failed: result=%+v err=%v", result, err)
	}
	if !strings.HasPrefix(result.Content[0].Text, "Found 200 lines:\n\n") ||
		strings.Contains(result.Content[0].Text, "direct.txt:201:") {
		t.Fatalf("MCP grep changed direct include/context/limit behavior: %q", result.Content[0].Text)
	}

	missing := filepath.Join(workspace, "missing.txt")
	_, legacyErr := gulu.File.Grep(missing, "", "hit", 0, 200)
	failed, callErr := fileGrep(map[string]any{
		"pattern": "hit", "path": "missing.txt", "limit": float64(200),
	})
	if callErr != nil || !failed.IsError || legacyErr == nil || len(failed.Content) != 1 ||
		failed.Content[0].Text != "grep failed: "+legacyErr.Error() {
		t.Fatalf("MCP grep changed missing-root error: legacy=%v result=%+v err=%v", legacyErr, failed, callErr)
	}
}

func TestFileGrepPreservesDirectoryReparseAndRegexPriority(t *testing.T) {
	workspace := t.TempDir()
	originalWorkspace := util.WorkspaceDir
	util.WorkspaceDir = workspace
	defer func() { util.WorkspaceDir = originalWorkspace }()

	realDirectory := filepath.Join(workspace, "real")
	if err := os.MkdirAll(realDirectory, 0755); err != nil {
		t.Fatal(err)
	}
	realPath := filepath.Join(realDirectory, "real.txt")
	if err := os.WriteFile(realPath, []byte("hit\n"), 0600); err != nil {
		t.Fatal(err)
	}
	linkPath := filepath.Join(workspace, "inside-link")
	if err := createMCPGrepDirectoryReparse(realDirectory, linkPath); err != nil {
		t.Fatal(err)
	}
	linked, err := fileGrep(map[string]any{
		"pattern": "hit", "path": "inside-link/real.txt", "include": "*.ignored", "limit": float64(10),
	})
	if err != nil || linked.IsError || !strings.Contains(linked.Content[0].Text, "inside-link") {
		t.Fatalf("MCP grep changed authorized file-link behavior: result=%+v err=%v", linked, err)
	}

	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "outside.txt"), []byte("hit\n"), 0600); err != nil {
		t.Fatal(err)
	}
	outsideLink := filepath.Join(workspace, "outside-link")
	if err := createMCPGrepDirectoryReparse(outside, outsideLink); err != nil {
		t.Fatal(err)
	}
	boundary, err := fileGrep(map[string]any{
		"pattern": "hit", "path": "outside-link/outside.txt", "limit": float64(10),
	})
	legacy, legacyErr := gulu.File.Grep(filepath.Join(outsideLink, "outside.txt"), "", "hit", 0, 10)
	if err != nil || legacyErr != nil || boundary.IsError || len(legacy) != 1 || len(boundary.Content) != 1 ||
		!strings.Contains(boundary.Content[0].Text, "outside-link\\outside.txt:1: hit") {
		t.Fatalf("MCP grep changed gulu junction-entry behavior: legacy=%+v legacyErr=%v result=%+v err=%v",
			legacy, legacyErr, boundary, err)
	}

	invalid, err := fileGrep(map[string]any{
		"pattern": "[", "path": "missing.txt", "limit": float64(10),
	})
	if err != nil || !invalid.IsError || !strings.Contains(invalid.Content[0].Text, "error parsing regexp") {
		t.Fatalf("MCP grep changed regex-before-stat priority: result=%+v err=%v", invalid, err)
	}
}

func TestFileGrepPreservesAuthorizedSymbolicLink(t *testing.T) {
	workspace := t.TempDir()
	originalWorkspace := util.WorkspaceDir
	util.WorkspaceDir = workspace
	defer func() { util.WorkspaceDir = originalWorkspace }()

	realPath := filepath.Join(workspace, "real.txt")
	if err := os.WriteFile(realPath, []byte("hit\n"), 0600); err != nil {
		t.Fatal(err)
	}
	linkPath := filepath.Join(workspace, "inside-link.txt")
	symlinkfixture.Create(t, realPath, linkPath)
	linked, err := fileGrep(map[string]any{
		"pattern": "hit", "path": "inside-link.txt", "include": "*.ignored", "limit": float64(10),
	})
	if err != nil || linked.IsError || !strings.Contains(linked.Content[0].Text, "inside-link.txt:1: hit") {
		t.Fatalf("MCP grep changed authorized symbolic-link behavior: result=%+v err=%v", linked, err)
	}
}

func TestFileGrepRejectsExternalSymbolicLink(t *testing.T) {
	workspace := t.TempDir()
	outside := t.TempDir()
	outsidePath := filepath.Join(outside, "outside.txt")
	if err := os.WriteFile(outsidePath, []byte("secret\n"), 0600); err != nil {
		t.Fatal(err)
	}
	symlinkfixture.Create(t, outsidePath, filepath.Join(workspace, "outside-link.txt"))
	originalWorkspace := util.WorkspaceDir
	util.WorkspaceDir = workspace
	defer func() { util.WorkspaceDir = originalWorkspace }()

	actual, err := fileGrep(map[string]any{
		"pattern": ".*", "path": "outside-link.txt", "limit": float64(1),
	})
	if err != nil || !actual.IsError || len(actual.Content) != 1 ||
		!strings.Contains(actual.Content[0].Text, "symlink escapes workspace") ||
		strings.Contains(actual.Content[0].Text, "secret") {
		t.Fatalf("MCP grep crossed a real symbolic-link boundary: result=%+v err=%v", actual, err)
	}
}

func createMCPGrepDirectoryReparse(target, link string) error {
	if runtime.GOOS != "windows" {
		return os.Symlink(target, link)
	}
	output, err := exec.Command("cmd.exe", "/d", "/c", "mklink", "/J", link, target).CombinedOutput()
	if err != nil {
		return fmt.Errorf("create junction: %w: %s", err, output)
	}
	return nil
}
