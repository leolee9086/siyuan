package coordinator

import (
	"encoding/json"
	"errors"
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
	if payload.FileSize <= 0 {
		t.Fatalf("期望 fileSize > 0，实际=%d", payload.FileSize)
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

func TestExecuteForgeDevRepoEdit_ValidatesRequiredFields(t *testing.T) {
	tests := []struct {
		name    string
		args    string
		wantErr string
	}{
		{
			name:    "empty args returns error",
			args:    ``,
			wantErr: "参数不能为空",
		},
		{
			name:    "missing target_path returns error",
			args:    `{}`,
			wantErr: "缺少 target_path",
		},
		{
			name:    "missing old_string returns error",
			args:    `{"target_path":"test.go"}`,
			wantErr: "缺少 old_string",
		},
		{
			name:    "missing motivation returns error",
			args:    `{"target_path":"test.go","old_string":"a","new_string":"b"}`,
			wantErr: "缺少 motivation",
		},
		{
			name:    "invalid JSON returns error",
			args:    `not-json`,
			wantErr: "参数解析失败",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := executeForgeDevRepoEdit(tt.args)
			if err == nil {
				t.Fatal("期望错误，实际成功")
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("期望错误包含 %q，实际=%v", tt.wantErr, err)
			}
		})
	}
}

func TestExecuteForgeDevRepoEdit_RejectsNonexistentFile(t *testing.T) {
	repoRoot := createForgeDevRepoFixture(t)
	restore := overrideForgeDevRepoRootResolver(repoRoot)
	defer restore()

	_, err := executeForgeDevRepoEdit(`{"target_path":"nonexistent.go","old_string":"a","new_string":"b","motivation":"test"}`)
	if err == nil {
		t.Fatal("期望文件不存在错误，实际成功")
	}
	if !strings.Contains(err.Error(), "不存在") {
		t.Fatalf("期望不存在错误，实际=%v", err)
	}
}

func TestExecuteForgeDevRepoEdit_RejectsBlockedPath(t *testing.T) {
	repoRoot := createForgeDevRepoFixture(t)
	restore := overrideForgeDevRepoRootResolver(repoRoot)
	defer restore()

	_, err := executeForgeDevRepoEdit(`{"target_path":".git/config","old_string":"a","new_string":"b","motivation":"test"}`)
	if err == nil {
		t.Fatal("期望阻止 .git 路径，实际成功")
	}
}

func TestExecuteForgeDevRepoEdit_ReturnsPendingGovernanceForValidInput(t *testing.T) {
	repoRoot := createForgeDevRepoFixture(t)
	restore := overrideForgeDevRepoRootResolver(repoRoot)
	defer restore()

	result, err := executeForgeDevRepoEdit(`{"target_path":"kernel/nerv/magi/coordinator/sample.go","old_string":"func alpha() {}","new_string":"func alpha() { x := 1 }","motivation":"test edit"}`)
	if err != nil {
		t.Fatalf("期望路径检查通过，实际错误: %v", err)
	}

	payload := struct {
		State      string `json:"state"`
		TargetPath string `json:"targetPath"`
	}{}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果失败: %v", err)
	}
	if payload.State != "pending_governance" {
		t.Fatalf("期望 state=pending_governance，实际=%s", payload.State)
	}
	if payload.TargetPath != "kernel/nerv/magi/coordinator/sample.go" {
		t.Fatalf("期望 targetPath 正确，实际=%s", payload.TargetPath)
	}
}

func TestApplySearchReplace_StrictExactMatch(t *testing.T) {
	content := "package coordinator\n\nfunc alpha() {}\n\nfunc beta() {}\n"

	// 精确匹配成功
	result, applied, err := applySearchReplace(content, "func alpha() {}", "func alpha() { return }")
	if err != nil {
		t.Fatalf("期望匹配成功，实际错误: %v", err)
	}
	if !applied {
		t.Fatal("期望 applied=true")
	}
	if !strings.Contains(result, "func alpha() { return }") {
		t.Fatalf("期望替换后的内容包含新文本，实际=%s", result)
	}
	if strings.Contains(result, "func alpha() {}") {
		t.Fatal("期望原始内容已被替换")
	}
}

func TestApplySearchReplace_NotFoundError(t *testing.T) {
	content := "package coordinator\n\nfunc alpha() {}\n"
	_, _, err := applySearchReplace(content, "func nonexistent() {}", "replacement")
	if err == nil {
		t.Fatal("期望 ErrSearchNotFound，实际无错误")
	}
	if !errors.Is(err, ErrSearchNotFound) {
		t.Fatalf("期望 ErrSearchNotFound，实际=%v", err)
	}
}

func TestApplySearchReplace_MultipleMatchesError(t *testing.T) {
	content := "func foo() {}\nfunc bar() {}\n"
	_, _, err := applySearchReplace(content, "func", "func replaced")
	if err == nil {
		t.Fatal("期望 ErrMultipleMatches，实际无错误")
	}
	if !errors.Is(err, ErrMultipleMatches) {
		t.Fatalf("期望 ErrMultipleMatches，实际=%v", err)
	}
}

func TestApplySearchReplace_NormalizesLineEndings(t *testing.T) {
	crlfContent := "package coordinator\r\n\r\nfunc alpha() {}\r\n"
	lfSearch := "func alpha() {}"
	replacement := "func alpha() { return }"

	result, applied, err := applySearchReplace(crlfContent, lfSearch, replacement)
	if err != nil {
		t.Fatalf("期望 CRLF 文件匹配成功，实际错误: %v", err)
	}
	if !applied {
		t.Fatal("期望 applied=true")
	}
	if strings.Count(result, "\r\n") > 0 {
		t.Fatal("期望结果中不含 CRLF")
	}
	if !strings.Contains(result, "func alpha() { return }") {
		t.Fatalf("期望替换后的内容，实际=%s", result)
	}
}

func TestApplySearchReplace_EmptySearchReturnsError(t *testing.T) {
	_, _, err := applySearchReplace("content", "", "replacement")
	if err == nil {
		t.Fatal("期望空搜索返回错误")
	}
}

func TestApplySearchReplace_HandlesNewlinesCorrectly(t *testing.T) {
	content := "line1\nline2\nline3\n"
	result, applied, err := applySearchReplace(content, "line1\nline2", "replaced")
	if err != nil {
		t.Fatalf("期望多行匹配成功，实际错误: %v", err)
	}
	if !applied {
		t.Fatal("期望 applied=true")
	}
	expected := "replaced\nline3\n"
	if result != expected {
		t.Fatalf("期望=%q，实际=%q", expected, result)
	}
}

func TestWrapSearchNotFoundError_IncludesContext(t *testing.T) {
	content := "package coordinator\n\nfunc alpha() {}\n\nfunc beta() {}\n"
	oldStr := "func nonexistent() {}"
	err := WrapSearchNotFoundError(content, oldStr)
	if err == nil {
		t.Fatal("期望错误，实际 nil")
	}
	errMsg := err.Error()
	if !strings.Contains(errMsg, "未匹配") && !strings.Contains(errMsg, "not found") {
		t.Fatalf("期望错误描述匹配失败，实际=%s", errMsg)
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
