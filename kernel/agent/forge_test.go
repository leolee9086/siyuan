package agent

import (
	"testing"

	"github.com/siyuan-note/siyuan/kernel/mcp/tools"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestNativeAgentForgeToolsAreModeScoped(t *testing.T) {
	previousMode := util.Mode
	t.Cleanup(func() { util.Mode = previousMode })

	util.Mode = util.ModeProd
	for _, tool := range convertMCPToolsToOpenAI() {
		if tools.IsForgeTool(tool.Function.Name) {
			t.Fatalf("forge tool %q exposed outside forge mode", tool.Function.Name)
		}
	}

	util.Mode = util.ModeForge
	found := false
	for _, tool := range convertMCPToolsToOpenAI() {
		if tool.Function.Name == tools.ForgeDevRepoGitToolName {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("native agent did not receive forge tools in forge mode")
	}
}

func TestNativeAgentForgeWritesRequireConfirmation(t *testing.T) {
	if !needsConfirm(tools.ForgeDevRepoWriteToolName, "", map[string]bool{}) {
		t.Fatal("forge write should require confirmation")
	}
	if needsConfirm(tools.ForgeDevRepoListToolName, "", map[string]bool{}) {
		t.Fatal("forge read should not require confirmation")
	}
}
