package tools

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestForgeDevRepoCRUDAndBoundary(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "kernel"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "app", "src"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "kernel", "go.mod"), []byte("module test"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "kernel", "main.go"), []byte("alpha\nbeta\n"), 0644); err != nil {
		t.Fatal(err)
	}
	writeForgeRestartPolicyFixture(t, root)

	previousResolver := forgeRepoRootResolver
	forgeRepoRootResolver = func() (string, error) { return root, nil }
	t.Cleanup(func() { forgeRepoRootResolver = previousResolver })

	writeResult, _ := forgeWriteHandler(map[string]interface{}{"path": "app/src/new.ts", "content": "export const value = 1;\n"})
	if writeResult.IsError {
		t.Fatalf("write failed: %s", toolResultText(writeResult))
	}

	readResult, _ := forgeReadHandler(map[string]interface{}{"path": "app/src/new.ts"})
	if readResult.IsError || !containsToolResult(readResult, "export const value = 1;") {
		t.Fatalf("read did not return written content: %s", toolResultText(readResult))
	}

	searchResult, _ := forgeSearchHandler(map[string]interface{}{"pattern": "value", "path": "app"})
	if searchResult.IsError || !containsToolResult(searchResult, "app/src/new.ts") {
		t.Fatalf("search did not find written file: %s", toolResultText(searchResult))
	}

	editResult, _ := forgeEditHandler(map[string]interface{}{"path": "kernel/main.go", "old_string": "beta", "new_string": "delta"})
	if editResult.IsError {
		t.Fatalf("edit failed: %s", toolResultText(editResult))
	}
	updated, err := os.ReadFile(filepath.Join(root, "kernel", "main.go"))
	if err != nil || string(updated) != "alpha\ndelta\n" {
		t.Fatalf("unexpected edited content: %q, err=%v", string(updated), err)
	}
	if _, err := os.Stat(filepath.Join(root, "kernel", "main.go.bak")); err != nil {
		t.Fatalf("expected edit backup: %v", err)
	}

	deleteResult, _ := forgeDeleteHandler(map[string]interface{}{"path": "app/src/new.ts"})
	if deleteResult.IsError {
		t.Fatalf("delete failed: %s", toolResultText(deleteResult))
	}
	if _, err := os.Stat(filepath.Join(root, "app", "src", "new.ts")); !os.IsNotExist(err) {
		t.Fatalf("file still exists after delete, err=%v", err)
	}

	outside := filepath.Join(filepath.Dir(root), "outside.txt")
	if err := os.WriteFile(outside, []byte("outside"), 0644); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Remove(outside) })
	outsideResult, _ := forgeReadHandler(map[string]interface{}{"path": "../outside.txt"})
	if !outsideResult.IsError {
		t.Fatal("expected path escape to be rejected")
	}
}

func TestForgeDevRepoBatchReplaceAndAtomicCommitGuard(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "kernel"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "app", "src"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "kernel", "go.mod"), []byte("module test"), 0644); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"one.go", "two.go"} {
		if err := os.WriteFile(filepath.Join(root, "kernel", name), []byte("old\n"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	writeForgeRestartPolicyFixture(t, root)

	previousResolver := forgeRepoRootResolver
	forgeRepoRootResolver = func() (string, error) { return root, nil }
	t.Cleanup(func() { forgeRepoRootResolver = previousResolver })

	result, _ := forgeBatchReplaceHandler(map[string]interface{}{
		"pattern":    "*.go",
		"path":       "kernel",
		"old_string": "old",
		"new_string": "new",
	})
	if result.IsError || !containsToolResult(result, "batch_replaced") || !containsToolResult(result, "one.go") || !containsToolResult(result, "two.go") {
		t.Fatalf("batch replace failed: %s", toolResultText(result))
	}

	commitResult, _ := forgeGitHandler(map[string]interface{}{"action": "commit", "message": "change"})
	if !commitResult.IsError || !containsToolResult(commitResult, "显式 paths") {
		t.Fatalf("expected commit without paths to be rejected: %s", toolResultText(commitResult))
	}

	bashResult, _ := forgeBashHandler(map[string]interface{}{"command": "git commit -m change"})
	if !bashResult.IsError || !containsToolResult(bashResult, "forge_dev_repo_git") {
		t.Fatalf("expected bash git commit to be rejected: %s", toolResultText(bashResult))
	}
}

func TestForgeToolsHiddenOutsideForgeMode(t *testing.T) {
	previousMode := util.Mode
	util.Mode = util.ModeProd
	t.Cleanup(func() { util.Mode = previousMode })
	for _, tool := range GetAvailableTools() {
		if IsForgeTool(tool.Name) {
			t.Fatalf("forge tool %q exposed outside forge mode", tool.Name)
		}
	}

	util.Mode = util.ModeForge
	found := false
	for _, tool := range GetAvailableTools() {
		if tool.Name == ForgeDevRepoGitToolName {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("forge git tool missing in forge mode")
	}
}

func toolResultText(result CallToolResult) string {
	if len(result.Content) == 0 {
		return ""
	}
	return result.Content[0].Text
}

func containsToolResult(result CallToolResult, needle string) bool {
	return len(result.Content) > 0 && (strings.Contains(result.Content[0].Text, needle) || jsonContains(result.Content[0].Text, needle))
}

func jsonContains(value, needle string) bool {
	var decoded interface{}
	if err := json.Unmarshal([]byte(value), &decoded); err != nil {
		return false
	}
	data, _ := json.Marshal(decoded)
	return strings.Contains(string(data), needle)
}
