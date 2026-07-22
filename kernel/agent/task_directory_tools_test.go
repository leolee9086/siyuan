package agent

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/88250/lute/ast"
	"github.com/sashabaranov/go-openai"
	mcpTools "github.com/siyuan-note/siyuan/kernel/mcp/tools"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestExecuteToolUsesCurrentDirectoryGrantAndOwner(t *testing.T) {
	originalWorkspaceDir, originalDataDir := util.WorkspaceDir, util.DataDir
	t.Cleanup(func() {
		util.WorkspaceDir = originalWorkspaceDir
		util.DataDir = originalDataDir
	})

	baseDir := t.TempDir()
	util.WorkspaceDir = filepath.Join(baseDir, "workspace")
	util.DataDir = filepath.Join(util.WorkspaceDir, "data")
	sessionID := ast.NewNodeID()
	sessionDir := filepath.Join(sessionsDir(), sessionID)
	if err := os.MkdirAll(sessionDir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(sessionDir, "session.json"), []byte(fmt.Sprintf(`{"id":%q}`, sessionID)), 0600); err != nil {
		t.Fatal(err)
	}
	mainDir := filepath.Join(baseDir, "main")
	readDir := filepath.Join(baseDir, "read")
	for _, dir := range []string{mainDir, readDir} {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(readDir, "note.txt"), []byte("read-only-content"), 0600); err != nil {
		t.Fatal(err)
	}
	binding, err := BindTaskDirectory(sessionID, mainDir, "owner-a")
	if err != nil {
		t.Fatal(err)
	}
	binding, err = AddTaskDirectory(sessionID, readDir, TaskDirectoryPermissionReadOnly, "owner-a")
	if err != nil {
		t.Fatal(err)
	}
	readGrantID := binding.Directories[0].ID
	expiresAt := time.Now().Add(time.Minute).Unix()

	readCall := openai.ToolCall{Type: openai.ToolTypeFunction, Function: openai.FunctionCall{
		Name:      mcpTools.TaskDirectoryReadToolName,
		Arguments: fmt.Sprintf(`{"directoryID":%q,"path":"note.txt"}`, readGrantID),
	}}
	result, isErr := executeTool(readCall, sessionID, binding, "owner-a", expiresAt, false, nil)
	if isErr || !strings.Contains(result, "read-only-content") {
		t.Fatalf("bound read grant should be usable through Agent execution: result=%s isErr=%v", result, isErr)
	}
	if result, isErr = executeTool(readCall, sessionID, binding, "owner-b", expiresAt, false, nil); !isErr || !strings.Contains(result, "owner") {
		t.Fatalf("cross-owner Agent execution must be rejected: result=%s isErr=%v", result, isErr)
	}
	if result, isErr = executeTool(readCall, sessionID, binding, "owner-a", time.Now().Add(-time.Second).Unix(), false, nil); !isErr || !strings.Contains(result, "expired") {
		t.Fatalf("expired owner authorization must stop Agent tools: result=%s isErr=%v", result, isErr)
	}

	writeCall := openai.ToolCall{Type: openai.ToolTypeFunction, Function: openai.FunctionCall{
		Name:      mcpTools.TaskDirectoryWriteToolName,
		Arguments: fmt.Sprintf(`{"directoryID":%q,"path":"blocked.txt","content":"blocked"}`, readGrantID),
	}}
	if result, isErr = executeTool(writeCall, sessionID, binding, "owner-a", expiresAt, false, nil); !isErr || !strings.Contains(result, "不允许") {
		t.Fatalf("read-only grant must reject Agent writes: result=%s isErr=%v", result, isErr)
	}
	if _, err := os.Stat(filepath.Join(readDir, "blocked.txt")); !os.IsNotExist(err) {
		t.Fatalf("read-only grant unexpectedly wrote a file: %v", err)
	}
}
