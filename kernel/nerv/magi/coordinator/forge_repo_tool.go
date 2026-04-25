package coordinator

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// 设计参考了 badlogic/pi-mono 中 read/ls/grep 工具的“只读浏览 + 小而稳的参数面”思路，
// 这里按 MAGI forge 模式和 Go 后端约束做了重实现。

const (
	defaultForgeDevRepoListLimit   = 200
	maxForgeDevRepoListLimit       = 500
	defaultForgeDevRepoReadStart   = 1
	defaultForgeDevRepoReadLimit   = 120
	maxForgeDevRepoReadLimit       = 400
	defaultForgeDevRepoSearchLimit = 20
	maxForgeDevRepoSearchLimit     = 100
	maxForgeDevRepoReadBytes       = 2 * 1024 * 1024
	maxForgeDevRepoSearchBytes     = 2 * 1024 * 1024
	maxForgeDevRepoSearchLineRunes = 320
)

var (
	errForgeDevRepoSearchLimitReached = errors.New("forge dev repo search limit reached")

	resolveForgeDevRepoRoot = detectForgeDevRepoRoot
)

type forgeDevRepoPlainInputArgs struct {
	Input string `json:"input"`
}

type forgeDevRepoPlainInput struct {
	Raw        string
	Fields     map[string]string
	Positional []string
}

type forgeDevRepoListEntry struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type forgeDevRepoListPayload struct {
	RootHint        string                  `json:"rootHint"`
	Path            string                  `json:"path"`
	Limit           int                     `json:"limit"`
	TotalEntries    int                     `json:"totalEntries"`
	ReturnedEntries int                     `json:"returnedEntries"`
	Truncated       bool                    `json:"truncated"`
	Entries         []forgeDevRepoListEntry `json:"entries"`
}

type forgeDevRepoReadPayload struct {
	RootHint      string `json:"rootHint"`
	Path          string `json:"path"`
	FileSize      int64  `json:"fileSize"`
	StartLine     int    `json:"startLine"`
	EndLine       int    `json:"endLine"`
	TotalLines    int    `json:"totalLines"`
	HasMore       bool   `json:"hasMore"`
	NextStartLine int    `json:"nextStartLine,omitempty"`
	Content       string `json:"content"`
}

type forgeDevRepoSearchMatch struct {
	Path    string `json:"path"`
	Line    int    `json:"line"`
	Content string `json:"content"`
}

type forgeDevRepoSearchPayload struct {
	RootHint     string                    `json:"rootHint"`
	Path         string                    `json:"path"`
	Pattern      string                    `json:"pattern"`
	IgnoreCase   bool                      `json:"ignoreCase"`
	Limit        int                       `json:"limit"`
	ScannedFiles int                       `json:"scannedFiles"`
	MatchCount   int                       `json:"matchCount"`
	HasMore      bool                      `json:"hasMore"`
	Matches      []forgeDevRepoSearchMatch `json:"matches"`
}

type forgeDevRepoToolResultExecutor struct {
	cache map[string]string
}

func newForgeDevRepoToolResultExecutor() *forgeDevRepoToolResultExecutor {
	return &forgeDevRepoToolResultExecutor{
		cache: make(map[string]string),
	}
}

func (e *forgeDevRepoToolResultExecutor) ExecuteToolCall(toolCall types.ToolCall) (result string, handled bool, err error) {
	toolName := strings.TrimSpace(toolCall.Function.Name)
	switch toolName {
	case config.ForgeDevRepoListToolName:
		return e.executeCached(toolName, toolCall.Function.Arguments, executeForgeDevRepoList)
	case config.ForgeDevRepoReadToolName:
		return e.executeCached(toolName, toolCall.Function.Arguments, executeForgeDevRepoRead)
	case config.ForgeDevRepoSearchToolName:
		return e.executeCached(toolName, toolCall.Function.Arguments, executeForgeDevRepoSearch)
	case config.ForgeDevRepoEditToolName:
		result, execErr := executeForgeDevRepoEdit(toolCall.Function.Arguments)
		return result, true, execErr
	default:
		return "", false, nil
	}
}

func (e *forgeDevRepoToolResultExecutor) executeCached(
	toolName string,
	rawArgs string,
	runner func(string) (string, error),
) (result string, handled bool, err error) {
	cacheKey := toolName + "\n" + rawArgs
	if cached, ok := e.cache[cacheKey]; ok {
		return cached, true, nil
	}

	result, err = runner(rawArgs)
	if err != nil {
		return "", true, err
	}
	e.cache[cacheKey] = result
	return result, true, nil
}

func executeForgeDevRepoList(rawArgs string) (string, error) {
	root, err := resolveForgeDevRepoRoot()
	if err != nil {
		return "", err
	}

	input, err := parseForgeDevRepoPlainInput(rawArgs)
	if err != nil {
		return "", err
	}

	targetPath := input.primary("path", ".")
	limit, err := input.intValue("limit", defaultForgeDevRepoListLimit, maxForgeDevRepoListLimit)
	if err != nil {
		return "", fmt.Errorf("%s 参数错误: %w", config.ForgeDevRepoListToolName, err)
	}

	targetAbs, targetRel, err := resolveForgeDevRepoTarget(root, targetPath)
	if err != nil {
		return "", err
	}

	info, err := os.Stat(targetAbs)
	if err != nil {
		return "", fmt.Errorf("读取开发仓库目录失败: %w", err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("目标路径不是目录: %s", targetRel)
	}

	entries, err := os.ReadDir(targetAbs)
	if err != nil {
		return "", fmt.Errorf("列出开发仓库目录失败: %w", err)
	}
	sort.Slice(entries, func(i, j int) bool {
		left := strings.ToLower(entries[i].Name())
		right := strings.ToLower(entries[j].Name())
		if left == right {
			return entries[i].Name() < entries[j].Name()
		}
		return left < right
	})

	payload := forgeDevRepoListPayload{
		RootHint:        compactWorkspacePathHint(root),
		Path:            targetRel,
		Limit:           limit,
		TotalEntries:    len(entries),
		ReturnedEntries: 0,
		Truncated:       len(entries) > limit,
		Entries:         make([]forgeDevRepoListEntry, 0, minInt(len(entries), limit)),
	}

	for idx, entry := range entries {
		if idx >= limit {
			break
		}
		name, entryType := classifyForgeDevRepoDirEntry(root, targetAbs, entry)
		payload.Entries = append(payload.Entries, forgeDevRepoListEntry{
			Name: name,
			Type: entryType,
		})
	}
	payload.ReturnedEntries = len(payload.Entries)
	return marshalForgeDevRepoPayload(payload)
}

func executeForgeDevRepoRead(rawArgs string) (string, error) {
	root, err := resolveForgeDevRepoRoot()
	if err != nil {
		return "", err
	}

	input, err := parseForgeDevRepoPlainInput(rawArgs)
	if err != nil {
		return "", err
	}

	targetPath := input.primary("path", "")
	if targetPath == "" {
		return "", fmt.Errorf("%s 缺少 path", config.ForgeDevRepoReadToolName)
	}
	startLine, err := input.intValue("start", defaultForgeDevRepoReadStart, 0)
	if err != nil {
		return "", fmt.Errorf("%s 参数错误: %w", config.ForgeDevRepoReadToolName, err)
	}
	limit, err := input.intValue("limit", defaultForgeDevRepoReadLimit, maxForgeDevRepoReadLimit)
	if err != nil {
		return "", fmt.Errorf("%s 参数错误: %w", config.ForgeDevRepoReadToolName, err)
	}

	targetAbs, targetRel, err := resolveForgeDevRepoTarget(root, targetPath)
	if err != nil {
		return "", err
	}

	info, err := os.Stat(targetAbs)
	if err != nil {
		return "", fmt.Errorf("读取开发仓库文件失败: %w", err)
	}
	if info.IsDir() {
		return "", fmt.Errorf("目标路径是目录，请改用 %s: %s", config.ForgeDevRepoListToolName, targetRel)
	}
	if info.Size() > maxForgeDevRepoReadBytes {
		return "", fmt.Errorf("文件过大（%d bytes），请缩小目标文件范围后再读取: %s", info.Size(), targetRel)
	}

	data, err := os.ReadFile(targetAbs)
	if err != nil {
		return "", fmt.Errorf("读取开发仓库文件失败: %w", err)
	}
	if bytes.Contains(data, []byte{0}) || !utf8.Valid(data) {
		return "", fmt.Errorf("仅支持读取 UTF-8 文本文件: %s", targetRel)
	}

	lines := strings.Split(normalizeForgeRepoText(string(data)), "\n")
	if startLine > len(lines) {
		return "", fmt.Errorf("start=%d 超出文件总行数 %d", startLine, len(lines))
	}

	endLine := startLine + limit - 1
	if endLine > len(lines) {
		endLine = len(lines)
	}

	var builder strings.Builder
	for lineNo := startLine; lineNo <= endLine; lineNo++ {
		builder.WriteString(strconv.Itoa(lineNo))
		builder.WriteString(" | ")
		builder.WriteString(lines[lineNo-1])
		if lineNo < endLine {
			builder.WriteString("\n")
		}
	}

	payload := forgeDevRepoReadPayload{
		RootHint:   compactWorkspacePathHint(root),
		Path:       targetRel,
		FileSize:   info.Size(),
		StartLine:  startLine,
		EndLine:    endLine,
		TotalLines: len(lines),
		HasMore:    endLine < len(lines),
		Content:    builder.String(),
	}
	if payload.HasMore {
		payload.NextStartLine = endLine + 1
	}
	return marshalForgeDevRepoPayload(payload)
}

func executeForgeDevRepoSearch(rawArgs string) (string, error) {
	root, err := resolveForgeDevRepoRoot()
	if err != nil {
		return "", err
	}

	input, err := parseForgeDevRepoPlainInput(rawArgs)
	if err != nil {
		return "", err
	}

	pattern := input.primary("pattern", "")
	if pattern == "" {
		return "", fmt.Errorf("%s 缺少 pattern", config.ForgeDevRepoSearchToolName)
	}
	targetPath := input.primary("path", ".")
	limit, err := input.intValue("limit", defaultForgeDevRepoSearchLimit, maxForgeDevRepoSearchLimit)
	if err != nil {
		return "", fmt.Errorf("%s 参数错误: %w", config.ForgeDevRepoSearchToolName, err)
	}
	ignoreCase, err := input.boolValue("ignorecase", false)
	if err != nil {
		return "", fmt.Errorf("%s 参数错误: %w", config.ForgeDevRepoSearchToolName, err)
	}

	targetAbs, targetRel, err := resolveForgeDevRepoTarget(root, targetPath)
	if err != nil {
		return "", err
	}

	info, err := os.Stat(targetAbs)
	if err != nil {
		return "", fmt.Errorf("搜索开发仓库失败: %w", err)
	}

	payload := forgeDevRepoSearchPayload{
		RootHint:   compactWorkspacePathHint(root),
		Path:       targetRel,
		Pattern:    pattern,
		IgnoreCase: ignoreCase,
		Limit:      limit,
		Matches:    make([]forgeDevRepoSearchMatch, 0, limit),
	}

	needle := pattern
	if ignoreCase {
		needle = strings.ToLower(pattern)
	}

	appendMatchesFromFile := func(fileAbsPath, fileRelPath string) error {
		fileInfo, err := os.Stat(fileAbsPath)
		if err != nil || fileInfo.IsDir() {
			return nil
		}
		if fileInfo.Size() > maxForgeDevRepoSearchBytes {
			return nil
		}

		data, err := os.ReadFile(fileAbsPath)
		if err != nil {
			return nil
		}
		if bytes.Contains(data, []byte{0}) || !utf8.Valid(data) {
			return nil
		}

		payload.ScannedFiles++
		lines := strings.Split(normalizeForgeRepoText(string(data)), "\n")
		for idx, line := range lines {
			haystack := line
			if ignoreCase {
				haystack = strings.ToLower(line)
			}
			if !strings.Contains(haystack, needle) {
				continue
			}

			payload.Matches = append(payload.Matches, forgeDevRepoSearchMatch{
				Path:    fileRelPath,
				Line:    idx + 1,
				Content: truncateForgeDevRepoSearchLine(line),
			})
			if len(payload.Matches) >= limit {
				return errForgeDevRepoSearchLimitReached
			}
		}
		return nil
	}

	if info.IsDir() {
		err = filepath.WalkDir(targetAbs, func(path string, d fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return nil
			}
			if path == targetAbs {
				return nil
			}

			rel, relErr := filepath.Rel(root, path)
			if relErr != nil {
				return nil
			}
			rel = filepath.ToSlash(rel)
			if isBlockedForgeDevRepoPath(rel) {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if d.Type()&os.ModeSymlink != 0 {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if d.IsDir() {
				return nil
			}
			return appendMatchesFromFile(path, rel)
		})
		if err != nil && !errors.Is(err, errForgeDevRepoSearchLimitReached) {
			return "", fmt.Errorf("搜索开发仓库失败: %w", err)
		}
	} else {
		err = appendMatchesFromFile(targetAbs, targetRel)
		if err != nil && !errors.Is(err, errForgeDevRepoSearchLimitReached) {
			return "", fmt.Errorf("搜索开发仓库失败: %w", err)
		}
	}

	payload.MatchCount = len(payload.Matches)
	payload.HasMore = errors.Is(err, errForgeDevRepoSearchLimitReached)
	return marshalForgeDevRepoPayload(payload)
}

type forgeDevRepoEditPayload struct {
	RootHint   string `json:"rootHint"`
	TargetPath string `json:"targetPath"`
	State      string `json:"state"`
}

func executeForgeDevRepoEdit(rawArgs string) (string, error) {
	var args struct {
		TargetPath string `json:"target_path"`
		OldString  string `json:"old_string"`
		NewString  string `json:"new_string"`
		Motivation string `json:"motivation"`
	}
	trimmed := strings.TrimSpace(rawArgs)
	if trimmed == "" {
		return "", fmt.Errorf("%s 参数不能为空", config.ForgeDevRepoEditToolName)
	}
	if err := json.Unmarshal([]byte(trimmed), &args); err != nil {
		return "", fmt.Errorf("%s 参数解析失败: %w", config.ForgeDevRepoEditToolName, err)
	}

	args.TargetPath = strings.TrimSpace(args.TargetPath)
	args.OldString = strings.TrimSpace(args.OldString)
	args.NewString = strings.TrimSpace(args.NewString)
	args.Motivation = strings.TrimSpace(args.Motivation)
	if args.TargetPath == "" {
		return "", fmt.Errorf("%s 缺少 target_path", config.ForgeDevRepoEditToolName)
	}
	if args.OldString == "" {
		return "", fmt.Errorf("%s 缺少 old_string", config.ForgeDevRepoEditToolName)
	}
	if args.Motivation == "" {
		return "", fmt.Errorf("%s 缺少 motivation", config.ForgeDevRepoEditToolName)
	}

	root, err := resolveForgeDevRepoRoot()
	if err != nil {
		return "", err
	}

	targetAbs, targetRel, err := resolveForgeDevRepoTarget(root, args.TargetPath)
	if err != nil {
		return "", err
	}

	info, err := os.Stat(targetAbs)
	if err != nil {
		return "", fmt.Errorf("目标文件不存在: %s", targetRel)
	}
	if info.IsDir() {
		return "", fmt.Errorf("目标路径是目录，不能编辑: %s", targetRel)
	}
	if info.Size() > maxForgeDevRepoReadBytes {
		return "", fmt.Errorf("文件过大（%d bytes），无法编辑: %s", info.Size(), targetRel)
	}

	payload := forgeDevRepoEditPayload{
		RootHint:   compactWorkspacePathHint(root),
		TargetPath: targetRel,
		State:      "pending_governance",
	}
	return marshalForgeDevRepoPayload(payload)
}

func parseForgeDevRepoPlainInput(rawArgs string) (*forgeDevRepoPlainInput, error) {
	var args forgeDevRepoPlainInputArgs
	if err := json.Unmarshal([]byte(strings.TrimSpace(rawArgs)), &args); err != nil {
		return nil, fmt.Errorf("工具参数解析失败: %w", err)
	}

	input := strings.TrimSpace(args.Input)
	if input == "" {
		return nil, errors.New("input 不能为空")
	}

	parsed := &forgeDevRepoPlainInput{
		Raw:        input,
		Fields:     map[string]string{},
		Positional: []string{},
	}
	for _, rawLine := range strings.Split(normalizeForgeRepoText(input), "\n") {
		line := strings.TrimSpace(rawLine)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if key, value, ok := strings.Cut(line, "="); ok {
			key = strings.ToLower(strings.TrimSpace(key))
			value = strings.TrimSpace(value)
			if key != "" {
				parsed.Fields[key] = value
				continue
			}
		}
		parsed.Positional = append(parsed.Positional, line)
	}
	return parsed, nil
}

func (i *forgeDevRepoPlainInput) primary(key, fallback string) string {
	if i == nil {
		return fallback
	}
	if value := strings.TrimSpace(i.Fields[strings.ToLower(strings.TrimSpace(key))]); value != "" {
		return value
	}
	if len(i.Positional) > 0 {
		return strings.TrimSpace(i.Positional[0])
	}
	return fallback
}

func (i *forgeDevRepoPlainInput) intValue(key string, defaultValue int, maxValue int) (int, error) {
	if i == nil {
		return defaultValue, nil
	}
	value := strings.TrimSpace(i.Fields[strings.ToLower(strings.TrimSpace(key))])
	if value == "" {
		return defaultValue, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("%s 必须是整数", key)
	}
	if parsed <= 0 {
		return 0, fmt.Errorf("%s 必须大于 0", key)
	}
	if maxValue > 0 && parsed > maxValue {
		return maxValue, nil
	}
	return parsed, nil
}

func (i *forgeDevRepoPlainInput) boolValue(key string, defaultValue bool) (bool, error) {
	if i == nil {
		return defaultValue, nil
	}
	value := strings.TrimSpace(i.Fields[strings.ToLower(strings.TrimSpace(key))])
	if value == "" {
		return defaultValue, nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("%s 必须是布尔值", key)
	}
	return parsed, nil
}

func detectForgeDevRepoRoot() (string, error) {
	if !util.IsForgeMode() {
		return "", errors.New("开发代码仓库查看工具仅在 forge 模式可用")
	}

	workingDir := strings.TrimSpace(util.WorkingDir)
	if workingDir == "" {
		return "", errors.New("forge 工作目录为空，无法定位开发代码仓库")
	}

	candidate, err := canonicalExistingPath(workingDir)
	if err != nil {
		return "", fmt.Errorf("解析 forge 工作目录失败: %w", err)
	}

	for {
		if isForgeDevRepoRoot(candidate) {
			return candidate, nil
		}
		parent := filepath.Dir(candidate)
		if sameForgeDevRepoPath(parent, candidate) {
			break
		}
		candidate = parent
	}
	return "", errors.New("未找到 forge 开发代码仓库根目录")
}

func isForgeDevRepoRoot(dir string) bool {
	if strings.TrimSpace(dir) == "" {
		return false
	}
	return pathExists(filepath.Join(dir, "kernel", "go.mod")) && dirExists(filepath.Join(dir, "app", "src"))
}

func resolveForgeDevRepoTarget(root, rawPath string) (string, string, error) {
	cleanRoot, err := canonicalExistingPath(root)
	if err != nil {
		return "", "", fmt.Errorf("解析开发仓库根目录失败: %w", err)
	}

	relativePath := strings.TrimSpace(rawPath)
	if relativePath == "" {
		relativePath = "."
	}
	if filepath.IsAbs(relativePath) {
		return "", "", errors.New("path 必须是相对开发仓库根目录的相对路径")
	}

	joinedPath := filepath.Join(cleanRoot, filepath.FromSlash(relativePath))
	resolvedPath, err := filepath.Abs(joinedPath)
	if err != nil {
		return "", "", fmt.Errorf("解析开发仓库路径失败: %w", err)
	}
	resolvedPath = filepath.Clean(resolvedPath)

	if evaluated, evalErr := filepath.EvalSymlinks(resolvedPath); evalErr == nil {
		resolvedPath = filepath.Clean(evaluated)
	} else if !os.IsNotExist(evalErr) {
		return "", "", fmt.Errorf("解析开发仓库路径失败: %w", evalErr)
	}

	if !sameOrSubForgeDevRepoPath(cleanRoot, resolvedPath) {
		return "", "", errors.New("禁止访问开发代码仓库根目录之外的路径")
	}

	relativeToRoot, err := filepath.Rel(cleanRoot, resolvedPath)
	if err != nil {
		return "", "", fmt.Errorf("计算开发仓库相对路径失败: %w", err)
	}
	if relativeToRoot == "." {
		return resolvedPath, ".", nil
	}
	relativeToRoot = filepath.ToSlash(relativeToRoot)
	if isBlockedForgeDevRepoPath(relativeToRoot) {
		return "", "", errors.New("禁止访问 .git 元数据目录")
	}
	return resolvedPath, relativeToRoot, nil
}

func classifyForgeDevRepoDirEntry(root, dirPath string, entry os.DirEntry) (string, string) {
	name := entry.Name()
	fullPath := filepath.Join(dirPath, name)

	if entry.Type()&os.ModeSymlink != 0 {
		if evaluated, err := filepath.EvalSymlinks(fullPath); err == nil {
			evaluated = filepath.Clean(evaluated)
			if sameOrSubForgeDevRepoPath(root, evaluated) {
				if targetInfo, statErr := os.Stat(evaluated); statErr == nil && targetInfo.IsDir() {
					return name + "@/", "symlink-dir"
				}
				return name + "@", "symlink-file"
			}
		}
		return name + "@", "symlink-blocked"
	}

	if entry.IsDir() {
		return name + "/", "dir"
	}
	return name, "file"
}

func marshalForgeDevRepoPayload(payload interface{}) (string, error) {
	resultBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("开发仓库工具结果序列化失败: %w", err)
	}
	return string(resultBytes), nil
}

func normalizeForgeRepoText(text string) string {
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	return text
}

func truncateForgeDevRepoSearchLine(line string) string {
	line = strings.TrimRight(line, "\r")
	runes := []rune(line)
	if len(runes) <= maxForgeDevRepoSearchLineRunes {
		return line
	}
	return string(runes[:maxForgeDevRepoSearchLineRunes]) + "..."
}

func pathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func canonicalExistingPath(path string) (string, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	evaluated, err := filepath.EvalSymlinks(absPath)
	if err != nil {
		return "", err
	}
	return filepath.Clean(evaluated), nil
}

func sameOrSubForgeDevRepoPath(root, target string) bool {
	if sameForgeDevRepoPath(root, target) {
		return true
	}
	rel, err := filepath.Rel(root, target)
	if err != nil {
		return false
	}
	if rel == "." {
		return true
	}
	upPrefix := ".." + string(os.PathSeparator)
	return rel != ".." && !strings.HasPrefix(rel, upPrefix)
}

func sameForgeDevRepoPath(left, right string) bool {
	left = filepath.Clean(left)
	right = filepath.Clean(right)
	if runtime.GOOS == "windows" {
		return strings.EqualFold(left, right)
	}
	return left == right
}

func isBlockedForgeDevRepoPath(relativePath string) bool {
	for _, segment := range strings.Split(filepath.ToSlash(relativePath), "/") {
		if segment == ".git" {
			return true
		}
	}
	return false
}

func minInt(left, right int) int {
	if left < right {
		return left
	}
	return right
}

// forgeDevRepoEditArgs 是 forge_dev_repo_edit 工具参数的内部结构
type forgeDevRepoEditArgs struct {
	TargetPath string `json:"target_path"`
	OldString  string `json:"old_string"`
	NewString  string `json:"new_string"`
	Motivation string `json:"motivation"`
}

// materializeForgeDevRepoEditResult 在治理统合阶段执行实际文件编辑操作。
// 流程：治理投票 → 读取文件 → applySearchReplace → 写入文件 → 返回编辑结果。
func materializeForgeDevRepoEditResult(
	ctx context.Context,
	sessionID, roundID string,
	sage *sages.Sage,
	assistantContent string,
	toolCall types.ToolCall,
	detailedResult string,
) string {
	args, err := parseForgeDevRepoEditArgs(toolCall.Function.Arguments)
	if err != nil {
		return marshalForgeDevRepoEditFailure(err)
	}

	payload := map[string]interface{}{}
	if trimmed := strings.TrimSpace(detailedResult); trimmed != "" {
		_ = json.Unmarshal([]byte(trimmed), &payload)
	}
	if len(payload) == 0 {
		payload["ok"] = true
		payload["state"] = "pending_governance"
	}

	outcome, governed, voteErr := dominantActionToolGovernance.EvaluateActionVote(
		ctx, sessionID, roundID, sage, assistantContent, toolCall,
	)
	if voteErr != nil {
		return marshalForgeDevRepoEditFailure(voteErr)
	}
	if governed && outcome != nil && outcome.Rejected {
		return marshalForgeDevRepoEditRejection(toolCall.Function.Name, payload, outcome)
	}

	// 治理通过，执行实际文件编辑
	root, rootErr := resolveForgeDevRepoRoot()
	if rootErr != nil {
		return marshalForgeDevRepoEditFailure(rootErr)
	}
	targetAbs, targetRel, targetErr := resolveForgeDevRepoTarget(root, args.TargetPath)
	if targetErr != nil {
		return marshalForgeDevRepoEditFailure(targetErr)
	}

	data, readErr := os.ReadFile(targetAbs)
	if readErr != nil {
		return marshalForgeDevRepoEditFailure(fmt.Errorf("读取文件失败: %w", readErr))
	}

	newContent, applied, srErr := applySearchReplace(string(data), args.OldString, args.NewString)
	if srErr != nil {
		if errors.Is(srErr, ErrSearchNotFound) {
			return marshalForgeDevRepoEditFailure(WrapSearchNotFoundError(string(data), args.OldString))
		}
		return marshalForgeDevRepoEditFailure(srErr)
	}
	if !applied {
		return marshalForgeDevRepoEditFailure(errors.New("搜索文本未找到"))
	}

	if writeErr := os.WriteFile(targetAbs, []byte(newContent), 0644); writeErr != nil {
		return marshalForgeDevRepoEditFailure(fmt.Errorf("写入文件失败: %w", writeErr))
	}

	payload["ok"] = true
	payload["state"] = "edited"
	payload["targetPath"] = targetRel

	resultBytes, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return marshalForgeDevRepoEditFailure(marshalErr)
	}
	return string(resultBytes)
}

func parseForgeDevRepoEditArgs(rawArgs string) (*forgeDevRepoEditArgs, error) {
	trimmed := strings.TrimSpace(rawArgs)
	if trimmed == "" {
		return nil, fmt.Errorf("%s 参数不能为空", config.ForgeDevRepoEditToolName)
	}
	var args forgeDevRepoEditArgs
	if err := json.Unmarshal([]byte(trimmed), &args); err != nil {
		return nil, fmt.Errorf("%s 参数解析失败: %w", config.ForgeDevRepoEditToolName, err)
	}
	args.TargetPath = strings.TrimSpace(args.TargetPath)
	args.OldString = strings.TrimSpace(args.OldString)
	args.NewString = strings.TrimSpace(args.NewString)
	args.Motivation = strings.TrimSpace(args.Motivation)
	if args.TargetPath == "" {
		return nil, fmt.Errorf("%s 缺少 target_path", config.ForgeDevRepoEditToolName)
	}
	if args.OldString == "" {
		return nil, fmt.Errorf("%s 缺少 old_string", config.ForgeDevRepoEditToolName)
	}
	if args.Motivation == "" {
		return nil, fmt.Errorf("%s 缺少 motivation", config.ForgeDevRepoEditToolName)
	}
	return &args, nil
}

func marshalForgeDevRepoEditFailure(err error) string {
	payload := map[string]interface{}{
		"ok":    false,
		"state": "edit_failed",
	}
	if err != nil {
		payload["error"] = err.Error()
	}
	resultBytes, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return `{"ok":false,"state":"edit_failed"}`
	}
	return string(resultBytes)
}

func marshalForgeDevRepoEditRejection(
	toolName string,
	payload map[string]interface{},
	outcome *governedActionVoteOutcome,
) string {
	if payload == nil {
		payload = map[string]interface{}{}
	}
	payload["ok"] = false
	payload["toolName"] = strings.TrimSpace(toolName)
	payload["reviewSummary"] = "该编辑操作已被专家团队否决。"
	if outcome != nil && len(outcome.RejectionReasons) > 0 {
		payload["rejectionReasons"] = outcome.RejectionReasons
	}
	if outcome != nil && outcome.LostDominance {
		payload["state"] = "dominance_revoked"
		payload["remainingAttempts"] = 0
		payload["instruction"] = "连续两次未获批准，当前轮次将改由其他处理路径继续。"
	} else {
		payload["state"] = "rejected"
		payload["remainingAttempts"] = 1
		payload["instruction"] = buildGovernedActionRetryPrompt(config.ForgeDevRepoEditToolName)
	}
	resultBytes, err := json.Marshal(payload)
	if err != nil {
		if outcome != nil && outcome.LostDominance {
			return `{"ok":false,"state":"dominance_revoked"}`
		}
		return `{"ok":false,"state":"rejected"}`
	}
	return string(resultBytes)
}
