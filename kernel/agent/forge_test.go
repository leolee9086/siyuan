package agent

import (
	"encoding/json"
	"strings"
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

func TestBuildToolResultOutputsPreservesCompleteDisplayPayload(t *testing.T) {
	previousDataDir := util.DataDir
	util.DataDir = t.TempDir()
	t.Cleanup(func() { util.DataDir = previousDataDir })

	raw := `{"results":[{"title":"complete"}],"padding":"` + strings.Repeat("x", util.MaxToolOutputChars+100) + `"}`
	displayResult, modelResult := buildToolResultOutputs(raw, "session-test")
	displayPayload := strings.TrimSuffix(strings.TrimPrefix(displayResult, "[tool_output]\n"), "\n[/tool_output]")
	if !json.Valid([]byte(displayPayload)) {
		t.Fatal("display result must preserve a complete JSON payload")
	}
	if !strings.Contains(modelResult, "content truncated") {
		t.Fatal("model result should be truncated when it exceeds the context limit")
	}
}
