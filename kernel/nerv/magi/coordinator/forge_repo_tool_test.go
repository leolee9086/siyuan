package coordinator

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestDetectForgeDevRepoRoot_WalksUpFromNestedWorkingDir(t *testing.T) {
	repoRoot := createForgeDevRepoFixture(t)

	originalMode := util.Mode
	originalWorkingDir := util.WorkingDir
	defer func() {
		util.Mode = originalMode
		util.WorkingDir = originalWorkingDir
	}()

	util.Mode = util.ModeForge
	util.WorkingDir = filepath.Join(repoRoot, "kernel", "nerv", "magi")

	root, err := detectForgeDevRepoRoot()
	if err != nil {
		t.Fatalf("期望成功定位仓库根目录，实际错误: %v", err)
	}
	if !sameForgeDevRepoPath(root, repoRoot) {
		t.Fatalf("期望根目录=%s，实际=%s", repoRoot, root)
	}
}

func TestResolveForgeDevRepoTarget_BlocksTraversalAndGitMetadata(t *testing.T) {
	repoRoot := createForgeDevRepoFixture(t)

	if _, _, err := resolveForgeDevRepoTarget(repoRoot, ".."); err == nil {
		t.Fatal("期望阻止越权访问仓库外路径，实际成功")
	}
	if _, _, err := resolveForgeDevRepoTarget(repoRoot, ".git/config"); err == nil {
		t.Fatal("期望阻止访问 .git 元数据目录，实际成功")
	}
}

func TestExecuteForgeDevRepoList_TruncatesByLimit(t *testing.T) {
	repoRoot := createForgeDevRepoFixture(t)
	restore := overrideForgeDevRepoRootResolver(repoRoot)
	defer restore()

	result, err := executeForgeDevRepoList(`{"input":"path=kernel\nlimit=2"}`)
	if err != nil {
		t.Fatalf("期望列目录成功，实际错误: %v", err)
	}

	var payload forgeDevRepoListPayload
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果失败: %v", err)
	}

	if payload.Path != "kernel" {
		t.Fatalf("期望 path=kernel，实际=%s", payload.Path)
	}
	if payload.ReturnedEntries != 2 {
		t.Fatalf("期望返回2条目录项，实际=%d", payload.ReturnedEntries)
	}
	if !payload.Truncated {
		t.Fatal("期望结果被 limit 截断")
	}
}

func TestExecuteForgeDevRepoRead_ReturnsPagedContent(t *testing.T) {
	repoRoot := createForgeDevRepoFixture(t)
	restore := overrideForgeDevRepoRootResolver(repoRoot)
	defer restore()

	result, err := executeForgeDevRepoRead(`{"input":"path=kernel/nerv/magi/coordinator/sample.go\nstart=2\nlimit=2"}`)
	if err != nil {
		t.Fatalf("期望读取成功，实际错误: %v", err)
	}

	var payload forgeDevRepoReadPayload
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果失败: %v", err)
	}

	if payload.Path != "kernel/nerv/magi/coordinator/sample.go" {
		t.Fatalf("期望 path 为 sample.go，实际=%s", payload.Path)
	}
	if payload.StartLine != 2 || payload.EndLine != 3 {
		t.Fatalf("期望返回第2-3行，实际=%d-%d", payload.StartLine, payload.EndLine)
	}
	if !payload.HasMore || payload.NextStartLine != 4 {
		t.Fatalf("期望存在下一页且 nextStartLine=4，实际 hasMore=%v next=%d", payload.HasMore, payload.NextStartLine)
	}
	if !strings.Contains(payload.Content, "2 | func alpha() {}") {
		t.Fatalf("期望返回第2行内容，实际=%s", payload.Content)
	}
}

func TestExecuteForgeDevRepoSearch_ReportsHasMoreWhenLimitReached(t *testing.T) {
	repoRoot := createForgeDevRepoFixture(t)
	restore := overrideForgeDevRepoRootResolver(repoRoot)
	defer restore()

	result, err := executeForgeDevRepoSearch(`{"input":"pattern=needle\npath=kernel\nlimit=1"}`)
	if err != nil {
		t.Fatalf("期望搜索成功，实际错误: %v", err)
	}

	var payload forgeDevRepoSearchPayload
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果失败: %v", err)
	}

	if payload.MatchCount != 1 {
		t.Fatalf("期望返回1条匹配，实际=%d", payload.MatchCount)
	}
	if !payload.HasMore {
		t.Fatal("期望命中上限时 hasMore=true")
	}
	if len(payload.Matches) != 1 {
		t.Fatalf("期望 matches 长度=1，实际=%d", len(payload.Matches))
	}
	if payload.Matches[0].Path == "" || payload.Matches[0].Line <= 0 {
		t.Fatalf("期望返回有效匹配位置，实际=%+v", payload.Matches[0])
	}
}

func createForgeDevRepoFixture(t *testing.T) string {
	t.Helper()

	root := t.TempDir()
	mustMkdirAll(t, filepath.Join(root, "app", "src"))
	mustMkdirAll(t, filepath.Join(root, "kernel", "api"))
	mustMkdirAll(t, filepath.Join(root, "kernel", "nerv", "magi", "coordinator"))
	mustMkdirAll(t, filepath.Join(root, ".git"))

	mustWriteFile(t, filepath.Join(root, "kernel", "go.mod"), "module github.com/example/kernel\n")
	mustWriteFile(t, filepath.Join(root, "kernel", "api", "router.go"), "package api\n// needle in api router\n")
	mustWriteFile(
		t,
		filepath.Join(root, "kernel", "nerv", "magi", "coordinator", "sample.go"),
		strings.Join([]string{
			"package coordinator",
			"func alpha() {}",
			"// needle in coordinator",
			"func beta() {}",
			"",
		}, "\n"),
	)
	mustWriteFile(t, filepath.Join(root, ".git", "config"), "[core]\nrepositoryformatversion = 0\n")

	return root
}

func overrideForgeDevRepoRootResolver(root string) func() {
	original := resolveForgeDevRepoRoot
	resolveForgeDevRepoRoot = func() (string, error) {
		return root, nil
	}
	return func() {
		resolveForgeDevRepoRoot = original
	}
}

func mustMkdirAll(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatalf("创建目录失败 [%s]: %v", path, err)
	}
}

func mustWriteFile(t *testing.T, path string, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("写入文件失败 [%s]: %v", path, err)
	}
}
