package cmd

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/88250/gulu"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestFileGrepCommandPreservesLegacyJSONFieldsAndAbsoluteFile(t *testing.T) {
	workspace := t.TempDir()
	originalWorkspace := util.WorkspaceDir
	originalFormat := outputFormat
	util.WorkspaceDir = workspace
	outputFormat = "json"
	defer func() {
		util.WorkspaceDir = originalWorkspace
		outputFormat = originalFormat
		_ = fileGrepCmd.Flags().Set("pattern", "")
		_ = fileGrepCmd.Flags().Set("path", "")
		_ = fileGrepCmd.Flags().Set("include", "")
		_ = fileGrepCmd.Flags().Set("context", "0")
		_ = fileGrepCmd.Flags().Set("limit", "200")
	}()

	path := filepath.Join(workspace, "nested", "file.go")
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("before\nhit\nafter\n"), 0600); err != nil {
		t.Fatal(err)
	}
	legacy, err := gulu.File.Grep(path, "*.ignored", "hit", 1, 10)
	if err != nil {
		t.Fatal(err)
	}
	expected, err := json.MarshalIndent(legacy, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	for name, value := range map[string]string{
		"pattern": "hit", "path": "nested/file.go", "include": "*.ignored", "context": "1", "limit": "10",
	} {
		if err := fileGrepCmd.Flags().Set(name, value); err != nil {
			t.Fatal(err)
		}
	}
	fileGrepCmd.SetContext(context.Background())
	actual, runErr := captureFileGrepStdout(t)
	if runErr != nil || strings.TrimSpace(actual) != string(expected) {
		t.Fatalf("CLI grep JSON contract changed: expected=%q actual=%q err=%v", expected, actual, runErr)
	}
}

func TestFileGrepCommandPreservesLegacyNonPositiveLimit(t *testing.T) {
	workspace := t.TempDir()
	originalWorkspace := util.WorkspaceDir
	originalFormat := outputFormat
	util.WorkspaceDir = workspace
	outputFormat = "table"
	defer func() {
		util.WorkspaceDir = originalWorkspace
		outputFormat = originalFormat
		_ = fileGrepCmd.Flags().Set("pattern", "")
		_ = fileGrepCmd.Flags().Set("path", "")
		_ = fileGrepCmd.Flags().Set("include", "")
		_ = fileGrepCmd.Flags().Set("context", "0")
		_ = fileGrepCmd.Flags().Set("limit", "200")
	}()

	if err := os.WriteFile(filepath.Join(workspace, "many.txt"), []byte(strings.Repeat("hit\n", 220)), 0600); err != nil {
		t.Fatal(err)
	}
	for name, value := range map[string]string{
		"pattern": "hit", "path": "many.txt", "include": "*.ignored", "context": "-1", "limit": "0",
	} {
		if err := fileGrepCmd.Flags().Set(name, value); err != nil {
			t.Fatal(err)
		}
	}
	fileGrepCmd.SetContext(context.Background())

	read, write, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	originalStdout := os.Stdout
	os.Stdout = write
	runErr := fileGrepCmd.RunE(fileGrepCmd, nil)
	_ = write.Close()
	os.Stdout = originalStdout
	output, readErr := io.ReadAll(read)
	_ = read.Close()
	if runErr != nil || readErr != nil {
		t.Fatalf("CLI grep failed: run=%v read=%v", runErr, readErr)
	}
	text := string(output)
	if !strings.HasPrefix(text, "Found 200 lines:\n\n") || strings.Contains(text, "many.txt:201:") {
		t.Fatalf("CLI grep changed direct include/context/limit behavior: %q", text)
	}
}

func TestFileGrepCommandPreservesLegacyEmptyJSONShape(t *testing.T) {
	workspace := t.TempDir()
	originalWorkspace := util.WorkspaceDir
	originalFormat := outputFormat
	util.WorkspaceDir = workspace
	outputFormat = "json"
	defer func() {
		util.WorkspaceDir = originalWorkspace
		outputFormat = originalFormat
		_ = fileGrepCmd.Flags().Set("pattern", "")
		_ = fileGrepCmd.Flags().Set("path", "")
		_ = fileGrepCmd.Flags().Set("include", "")
		_ = fileGrepCmd.Flags().Set("context", "0")
		_ = fileGrepCmd.Flags().Set("limit", "200")
	}()
	if err := os.WriteFile(filepath.Join(workspace, "none.txt"), []byte("none\n"), 0600); err != nil {
		t.Fatal(err)
	}
	for name, value := range map[string]string{
		"pattern": "hit", "path": "none.txt", "include": "", "context": "0", "limit": "200",
	} {
		if err := fileGrepCmd.Flags().Set(name, value); err != nil {
			t.Fatal(err)
		}
	}
	fileGrepCmd.SetContext(context.Background())
	output, runErr := captureFileGrepStdout(t)
	if runErr != nil || strings.TrimSpace(output) != "null" {
		t.Fatalf("CLI grep changed empty JSON shape: output=%q err=%v", output, runErr)
	}
}

func captureFileGrepStdout(t *testing.T) (string, error) {
	t.Helper()
	read, write, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	originalStdout := os.Stdout
	os.Stdout = write
	runErr := fileGrepCmd.RunE(fileGrepCmd, nil)
	_ = write.Close()
	os.Stdout = originalStdout
	output, readErr := io.ReadAll(read)
	_ = read.Close()
	if readErr != nil {
		t.Fatal(readErr)
	}
	return string(output), runErr
}
