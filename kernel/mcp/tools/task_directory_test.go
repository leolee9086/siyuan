package tools

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTaskDirectoryToolsAreRegisteredButNotGenerallyAvailable(t *testing.T) {
	for _, name := range []string{
		TaskDirectoryListToolName,
		TaskDirectoryReadToolName,
		TaskDirectorySearchToolName,
		TaskDirectoryWriteToolName,
		TaskDirectoryDeleteToolName,
		TaskDirectoryEditToolName,
		TaskDirectoryBatchReplaceToolName,
		TaskDirectoryCommandToolName,
	} {
		tool := GetTool(name)
		if tool == nil || tool.Source != "task-directory" {
			t.Fatalf("task-directory tool %q must be registered with a protected source", name)
		}
		for _, available := range GetAvailableTools() {
			if available.Name == name {
				t.Fatalf("task-directory tool %q must not be exposed through the general tool list", name)
			}
		}
	}
}

func TestTaskDirectoryPermissionsAreEnforcedByCapability(t *testing.T) {
	readRoot := t.TempDir()
	writeRoot := t.TempDir()
	commandRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(readRoot, "read.txt"), []byte("read"), 0600); err != nil {
		t.Fatal(err)
	}

	readArgs := map[string]interface{}{"path": "read.txt"}
	WithTaskDirectoryGrant(readArgs, "read-1", readRoot, TaskDirectoryPermissionReadOnly)
	result, err := GetTool(TaskDirectoryReadToolName).Handler(readArgs)
	if err != nil || result.IsError || !strings.Contains(result.Content[0].Text, "read") {
		t.Fatalf("read-only grant should allow reads: result=%+v err=%v", result, err)
	}
	writeArgs := map[string]interface{}{"path": "new.txt", "content": "blocked"}
	WithTaskDirectoryGrant(writeArgs, "read-1", readRoot, TaskDirectoryPermissionReadOnly)
	result, err = GetTool(TaskDirectoryWriteToolName).Handler(writeArgs)
	if err != nil || !result.IsError {
		t.Fatalf("read-only grant must reject writes: result=%+v err=%v", result, err)
	}

	writeArgs = map[string]interface{}{"path": "new.txt", "content": "written"}
	WithTaskDirectoryGrant(writeArgs, "write-1", writeRoot, TaskDirectoryPermissionReadWrite)
	result, err = GetTool(TaskDirectoryWriteToolName).Handler(writeArgs)
	if err != nil || result.IsError {
		t.Fatalf("read-write grant should allow writes: result=%+v err=%v", result, err)
	}
	commandArgs := map[string]interface{}{"command": "Write-Output command-ok"}
	WithTaskDirectoryGrant(commandArgs, "command-1", commandRoot, TaskDirectoryPermissionCommand)
	result, err = GetTool(TaskDirectoryCommandToolName).Handler(commandArgs)
	if err != nil || result.IsError || !strings.Contains(result.Content[0].Text, "command-ok") {
		t.Fatalf("command grant should allow bounded commands: result=%+v err=%v", result, err)
	}
	readCommandArgs := map[string]interface{}{"path": "read.txt"}
	WithTaskDirectoryGrant(readCommandArgs, "command-1", commandRoot, TaskDirectoryPermissionCommand)
	result, err = GetTool(TaskDirectoryReadToolName).Handler(readCommandArgs)
	if err != nil || !result.IsError {
		t.Fatalf("command-only grant must not imply file reads: result=%+v err=%v", result, err)
	}
}

func TestTaskDirectoryReadRequiresCapabilityAndStaysInsideRoot(t *testing.T) {
	root := t.TempDir()
	inside := filepath.Join(root, "inside.txt")
	outside := filepath.Join(filepath.Dir(root), "outside.txt")
	if err := os.WriteFile(inside, []byte("inside"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(outside, []byte("outside"), 0600); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Remove(outside) })

	tool := GetTool(TaskDirectoryReadToolName)
	withoutCapability, err := tool.Handler(map[string]interface{}{"path": "inside.txt"})
	if err != nil || !withoutCapability.IsError || !strings.Contains(withoutCapability.Content[0].Text, "capability") {
		t.Fatalf("missing capability must be rejected: result=%+v err=%v", withoutCapability, err)
	}

	args := map[string]interface{}{"path": "inside.txt"}
	WithTaskDirectoryCapability(args, root)
	result, err := tool.Handler(args)
	if err != nil || result.IsError || len(result.Content) == 0 || !strings.Contains(result.Content[0].Text, "inside") {
		t.Fatalf("bound task directory read failed: result=%+v err=%v", result, err)
	}

	args = map[string]interface{}{"path": "../outside.txt"}
	WithTaskDirectoryCapability(args, root)
	result, err = tool.Handler(args)
	if err != nil || !result.IsError || strings.Contains(result.Content[0].Text, "outside") {
		t.Fatalf("path traversal must be rejected without reading outside: result=%+v err=%v", result, err)
	}
}

func TestTaskDirectoryCapabilityRejectsSymlinkEscape(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	outsideFile := filepath.Join(outside, "secret.txt")
	if err := os.WriteFile(outsideFile, []byte("secret"), 0600); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(root, "link.txt")
	if err := os.Symlink(outsideFile, link); err != nil {
		t.Skipf("symbolic links are unavailable: %v", err)
	}

	args := map[string]interface{}{"path": "link.txt"}
	WithTaskDirectoryCapability(args, root)
	result, err := GetTool(TaskDirectoryReadToolName).Handler(args)
	if err != nil || !result.IsError {
		t.Fatalf("symlink escape must be rejected: result=%+v err=%v", result, err)
	}
	if len(result.Content) > 0 {
		var payload interface{}
		if json.Unmarshal([]byte(result.Content[0].Text), &payload) == nil && strings.Contains(result.Content[0].Text, "secret") {
			t.Fatal("symlink escape result must not disclose outside file content")
		}
	}
}
