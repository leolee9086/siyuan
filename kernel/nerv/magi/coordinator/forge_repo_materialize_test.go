package coordinator

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func TestMaterializeForgeDevRepoEditWritesAndCreatesExactBackup(t *testing.T) {
	repoRoot := createForgeDevRepoFixture(t)
	restore := overrideForgeDevRepoRootResolver(repoRoot)
	defer restore()

	arguments := `{"target_path":"kernel/nerv/magi/coordinator/sample.go","old_string":"func alpha() {}","new_string":"func alpha() { return }","motivation":"test materialize"}`
	preview, err := executeForgeDevRepoEdit(arguments)
	if err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(repoRoot, "kernel", "nerv", "magi", "coordinator", "sample.go")
	original, err := os.ReadFile(target)
	if err != nil {
		t.Fatal(err)
	}
	result := materializeForgeDevRepoEditResult(context.Background(), "edit-session", "edit-round", nil, "",
		forgeRepoToolCall(config.ForgeDevRepoEditToolName, arguments), preview)
	payload := decodeForgeMaterializePayload(t, result)
	if payload.State != "edited" || !payload.OK || payload.Error != "" {
		t.Fatalf("edit materialization failed: %s", result)
	}
	updated, err := os.ReadFile(target)
	if err != nil || !strings.Contains(string(updated), "func alpha() { return }") {
		t.Fatalf("edit did not reach the real file: %q err=%v", updated, err)
	}
	backup, err := os.ReadFile(target + ".bak")
	if err != nil || string(backup) != string(original) {
		t.Fatalf("backup differs from the approved source: %q err=%v", backup, err)
	}
}

func TestMaterializeForgeDevRepoEditRejectsContentChangedAfterPreview(t *testing.T) {
	repoRoot := createForgeDevRepoFixture(t)
	restore := overrideForgeDevRepoRootResolver(repoRoot)
	defer restore()

	arguments := `{"target_path":"kernel/nerv/magi/coordinator/sample.go","old_string":"func alpha() {}","new_string":"func alpha() { return }","motivation":"test stale edit"}`
	preview, err := executeForgeDevRepoEdit(arguments)
	if err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(repoRoot, "kernel", "nerv", "magi", "coordinator", "sample.go")
	changed := "// concurrent change\npackage coordinator\nfunc alpha() {}\n// needle in coordinator\nfunc beta() {}\n"
	if err = os.WriteFile(target, []byte(changed), 0644); err != nil {
		t.Fatal(err)
	}
	result := materializeForgeDevRepoEditResult(context.Background(), "stale-session", "stale-round", nil, "",
		forgeRepoToolCall(config.ForgeDevRepoEditToolName, arguments), preview)
	payload := decodeForgeMaterializePayload(t, result)
	if payload.State != "edit_failed" || payload.OK || !strings.Contains(payload.Error, "内容发生变化") {
		t.Fatalf("stale edit was accepted: %s", result)
	}
	current, err := os.ReadFile(target)
	if err != nil || string(current) != changed {
		t.Fatalf("stale edit modified the file: %q err=%v", current, err)
	}
	if _, err = os.Stat(target + ".bak"); !os.IsNotExist(err) {
		t.Fatalf("stale edit created a backup: %v", err)
	}
}

func TestMaterializeForgeDevRepoBatchRejectsCandidateSetChangedAfterPreview(t *testing.T) {
	repoRoot := createForgeDevRepoFixture(t)
	restore := overrideForgeDevRepoRootResolver(repoRoot)
	defer restore()

	arguments := `{"pattern":"kernel/api/*.go","old_string":"needle","new_string":"updated","preview":false,"motivation":"test stale batch"}`
	preview, err := executeForgeDevRepoBatchReplace(arguments)
	if err != nil {
		t.Fatal(err)
	}
	added := filepath.Join(repoRoot, "kernel", "api", "added.go")
	mustWriteFile(t, added, "package api\n// needle in added file\n")
	result := materializeForgeDevRepoBatchReplaceResult(context.Background(), "batch-session", "batch-round", nil, "",
		forgeRepoToolCall(config.ForgeDevRepoBatchReplaceToolName, arguments), preview)
	payload := decodeForgeMaterializePayload(t, result)
	if payload.State != "batch_replace_failed" || payload.OK || !strings.Contains(payload.Error, "候选文件发生变化") {
		t.Fatalf("changed batch candidate set was accepted: %s", result)
	}
	current, err := os.ReadFile(added)
	if err != nil || !strings.Contains(string(current), "needle") {
		t.Fatalf("rejected batch changed a file: %q err=%v", current, err)
	}
}

func TestMaterializeForgeDevRepoBatchWritesAllApprovedCandidates(t *testing.T) {
	repoRoot := createForgeDevRepoFixture(t)
	restore := overrideForgeDevRepoRootResolver(repoRoot)
	defer restore()
	mustWriteFile(t, filepath.Join(repoRoot, "kernel", "api", "second.go"), "package api\n// needle in second file\n")

	arguments := `{"pattern":"kernel/api/*.go","old_string":"needle","new_string":"updated","preview":false,"motivation":"test batch materialize"}`
	preview, err := executeForgeDevRepoBatchReplace(arguments)
	if err != nil {
		t.Fatal(err)
	}
	result := materializeForgeDevRepoBatchReplaceResult(context.Background(), "batch-success-session", "batch-success-round",
		nil, "", forgeRepoToolCall(config.ForgeDevRepoBatchReplaceToolName, arguments), preview)
	payload := decodeForgeMaterializePayload(t, result)
	if payload.State != "batch_replaced" || !payload.OK || payload.Error != "" {
		t.Fatalf("batch materialization failed: %s", result)
	}
	for _, name := range []string{"router.go", "second.go"} {
		path := filepath.Join(repoRoot, "kernel", "api", name)
		content, readErr := os.ReadFile(path)
		if readErr != nil || !strings.Contains(string(content), "updated") || strings.Contains(string(content), "needle") {
			t.Fatalf("batch did not update %s: %q err=%v", name, content, readErr)
		}
		backup, backupErr := os.ReadFile(path + ".bak")
		if backupErr != nil || !strings.Contains(string(backup), "needle") {
			t.Fatalf("batch backup is missing original content for %s: %q err=%v", name, backup, backupErr)
		}
	}
}

func forgeRepoToolCall(name, arguments string) types.ToolCall {
	return types.ToolCall{Type: "function", Function: types.ToolCallFunction{Name: name, Arguments: arguments}}
}

func decodeForgeMaterializePayload(t *testing.T, raw string) struct {
	OK    bool   `json:"ok"`
	State string `json:"state"`
	Error string `json:"error"`
} {
	t.Helper()
	payload := struct {
		OK    bool   `json:"ok"`
		State string `json:"state"`
		Error string `json:"error"`
	}{}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("invalid materialize payload %q: %v", raw, err)
	}
	return payload
}
