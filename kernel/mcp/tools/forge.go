package tools

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/siyuan-note/siyuan/kernel/util"
)

const (
	ForgeDevRepoListToolName         = "forge_dev_repo_list"
	ForgeDevRepoReadToolName         = "forge_dev_repo_read"
	ForgeDevRepoSearchToolName       = "forge_dev_repo_search"
	ForgeDevRepoWriteToolName        = "forge_dev_repo_write"
	ForgeDevRepoDeleteToolName       = "forge_dev_repo_delete"
	ForgeDevRepoEditToolName         = "forge_dev_repo_edit"
	ForgeDevRepoBatchReplaceToolName = "forge_dev_repo_batch_replace"
	ForgeDevRepoBashToolName         = "forge_dev_repo_bash"
	ForgeDevRepoGitToolName          = "forge_dev_repo_git"
)

const (
	forgeRepoDefaultListLimit   = 200
	forgeRepoMaxListLimit       = 500
	forgeRepoDefaultReadLimit   = 120
	forgeRepoMaxReadLimit       = 400
	forgeRepoDefaultSearchLimit = 100
	forgeRepoMaxSearchLimit     = 200
	forgeRepoMaxTextBytes       = 2 * 1024 * 1024
	forgeRepoMaxCommandOutput   = 1024 * 1024
)

var forgeRepoRootResolver = detectForgeDevRepoRoot

var forgeWriteToolNames = map[string]bool{
	ForgeDevRepoWriteToolName:        true,
	ForgeDevRepoDeleteToolName:       true,
	ForgeDevRepoEditToolName:         true,
	ForgeDevRepoBatchReplaceToolName: true,
	ForgeDevRepoBashToolName:         true,
	ForgeDevRepoGitToolName:          true,
	ForgeRuntimeRestartToolName:      true,
}

var ForgeDevRepoListTool = &Tool{
	Name:        ForgeDevRepoListToolName,
	Description: "仅在 forge 模式可用。列出 S-Forge 源码仓库目录内容，path 相对于仓库根目录。",
	Source:      "forge",
	InputSchema: ToolSchema{Type: "object", Properties: map[string]Property{
		"path":        {Type: "string", Description: "相对源码仓库根目录的目录路径，默认 ."},
		"limit":       {Type: "number", Description: "最多返回的条目数，默认 200，最大 500"},
		"type":        {Type: "string", Description: "按类型过滤", Enum: []string{"file", "dir"}},
		"namePattern": {Type: "string", Description: "文件名 glob 过滤，例如 *.go"},
	}},
	Handler: forgeListHandler,
}

var ForgeDevRepoReadTool = &Tool{
	Name:        ForgeDevRepoReadToolName,
	Description: "仅在 forge 模式可用。按行读取 S-Forge 源码仓库中的 UTF-8 文本文件。",
	Source:      "forge",
	InputSchema: ToolSchema{Type: "object", Properties: map[string]Property{
		"path":  {Type: "string", Description: "相对源码仓库根目录的文件路径"},
		"start": {Type: "number", Description: "起始行号，1-based，默认 1"},
		"limit": {Type: "number", Description: "读取行数，默认 120，最大 400"},
	}, Required: []string{"path"}},
	Handler: forgeReadHandler,
}

var ForgeDevRepoSearchTool = &Tool{
	Name:        ForgeDevRepoSearchToolName,
	Description: "仅在 forge 模式可用。在 S-Forge 源码仓库中搜索文本或正则表达式。",
	Source:      "forge",
	InputSchema: ToolSchema{Type: "object", Properties: map[string]Property{
		"pattern":     {Type: "string", Description: "文本或正则表达式"},
		"path":        {Type: "string", Description: "搜索路径，相对源码仓库根目录，默认 ."},
		"ignoreCase":  {Type: "boolean", Description: "是否忽略大小写"},
		"useRegex":    {Type: "boolean", Description: "是否按正则表达式匹配"},
		"filePattern": {Type: "string", Description: "文件名 glob 过滤，例如 *.go"},
		"limit":       {Type: "number", Description: "最多返回的匹配数，默认 100，最大 200"},
	}, Required: []string{"pattern"}},
	Handler: forgeSearchHandler,
}

var ForgeDevRepoWriteTool = &Tool{
	Name:        ForgeDevRepoWriteToolName,
	Description: "仅在 forge 模式可用。创建或完整覆写源码仓库中的 UTF-8 文本文件；原生 agent 会先请求用户确认。",
	Source:      "forge",
	InputSchema: ToolSchema{Type: "object", Properties: map[string]Property{
		"path":    {Type: "string", Description: "目标文件路径，相对源码仓库根目录"},
		"content": {Type: "string", Description: "完整文件内容，可以为空字符串"},
	}, Required: []string{"path", "content"}},
	Handler: forgeWriteHandler,
}

var ForgeDevRepoDeleteTool = &Tool{
	Name:        ForgeDevRepoDeleteToolName,
	Description: "仅在 forge 模式可用。删除源码仓库中的单个文件或空目录；原生 agent 会先请求用户确认。",
	Source:      "forge",
	InputSchema: ToolSchema{Type: "object", Properties: map[string]Property{
		"path": {Type: "string", Description: "目标文件或空目录路径，相对源码仓库根目录"},
	}, Required: []string{"path"}},
	Handler: forgeDeleteHandler,
}

var ForgeDevRepoEditTool = &Tool{
	Name:        ForgeDevRepoEditToolName,
	Description: "仅在 forge 模式可用。对源码文件执行只允许命中一次的精确 SEARCH/REPLACE；原生 agent 会先请求用户确认。",
	Source:      "forge",
	InputSchema: ToolSchema{Type: "object", Properties: map[string]Property{
		"path":       {Type: "string", Description: "目标文件路径，相对源码仓库根目录"},
		"old_string": {Type: "string", Description: "必须从文件中精确复制的原文"},
		"new_string": {Type: "string", Description: "替换后的内容"},
	}, Required: []string{"path", "old_string", "new_string"}},
	Handler: forgeEditHandler,
}

var ForgeDevRepoBatchReplaceTool = &Tool{
	Name:        ForgeDevRepoBatchReplaceToolName,
	Description: "仅在 forge 模式可用。对匹配到的多个源码文件执行精确替换；preview=true 时只返回预览；原生 agent 会先请求用户确认。",
	Source:      "forge",
	InputSchema: ToolSchema{Type: "object", Properties: map[string]Property{
		"pattern":     {Type: "string", Description: "相对 path 的文件 glob，例如 **/*.go 或 *.ts"},
		"old_string":  {Type: "string", Description: "需要替换的原文"},
		"new_string":  {Type: "string", Description: "替换后的内容"},
		"path":        {Type: "string", Description: "搜索目录，相对源码仓库根目录，默认 ."},
		"filePattern": {Type: "string", Description: "额外的文件名 glob 过滤"},
		"preview":     {Type: "boolean", Description: "是否只预览不写入"},
	}, Required: []string{"pattern", "old_string", "new_string"}},
	Handler: forgeBatchReplaceHandler,
}

var ForgeDevRepoBashTool = &Tool{
	Name:        ForgeDevRepoBashToolName,
	Description: "仅在 forge 模式可用。在源码仓库根目录执行受边界保护的命令；涉及写入的命令会先请求用户确认。Git 提交必须改用 forge_dev_repo_git 的显式路径提交。",
	Source:      "forge",
	InputSchema: ToolSchema{Type: "object", Properties: map[string]Property{
		"command": {Type: "string", Description: "要执行的命令"},
		"timeout": {Type: "number", Description: "超时秒数，默认 30，最大 120"},
	}, Required: []string{"command"}},
	Handler: forgeBashHandler,
}

var ForgeDevRepoGitTool = &Tool{
	Name:        ForgeDevRepoGitToolName,
	Description: "仅在 forge 模式可用。查询或提交源码仓库 Git 状态。commit 必须提供显式 paths 和 message，使用一次原子提交，不会纳入其他路径的改动。",
	Source:      "forge",
	InputSchema: ToolSchema{Type: "object", Properties: map[string]Property{
		"action":  {Type: "string", Description: "Git 操作", Enum: []string{"status", "log", "diff", "show", "branch", "commit"}},
		"message": {Type: "string", Description: "commit 消息，仅 commit 必填"},
		"paths":   {Type: "array", Description: "显式相对路径列表；commit 必填", Items: &Property{Type: "string"}},
	}, Required: []string{"action"}},
	Handler: forgeGitHandler,
}

func init() {
	register(ForgeDevRepoListTool)
	register(ForgeDevRepoReadTool)
	register(ForgeDevRepoSearchTool)
	register(ForgeDevRepoWriteTool)
	register(ForgeDevRepoDeleteTool)
	register(ForgeDevRepoEditTool)
	register(ForgeDevRepoBatchReplaceTool)
	register(ForgeDevRepoBashTool)
	register(ForgeDevRepoGitTool)
}

func IsForgeTool(name string) bool {
	return isForgeToolName(name)
}

func IsForgeWriteTool(name string) bool {
	return forgeWriteToolNames[strings.TrimSpace(name)]
}

func ForgeDevRepoRoot() (string, error) {
	return forgeRepoRootResolver()
}

func IsForgeModeAvailable() bool {
	return util.IsForgeMode()
}

func forgeResult(value interface{}, err error) (CallToolResult, error) {
	if err != nil {
		return CallToolResult{Content: []ContentItem{{Type: "text", Text: err.Error()}}, IsError: true}, nil
	}
	data, marshalErr := json.Marshal(value)
	if marshalErr != nil {
		return CallToolResult{Content: []ContentItem{{Type: "text", Text: marshalErr.Error()}}, IsError: true}, nil
	}
	return CallToolResult{Content: []ContentItem{{Type: "text", Text: string(data)}}}, nil
}

func forgeError(message string) (CallToolResult, error) {
	return forgeResult(nil, errors.New(message))
}

func forgeListHandler(args map[string]interface{}) (CallToolResult, error) {
	root, err := repositoryToolRoot(args)
	if err != nil {
		return forgeError(err.Error())
	}
	target, rel, err := resolveForgeDevRepoTarget(root, stringArg(args, "path", "."))
	if err != nil {
		return forgeError(err.Error())
	}
	info, err := os.Stat(target)
	if err != nil || !info.IsDir() {
		return forgeError(fmt.Sprintf("目标目录不可读: %s", rel))
	}
	limit := boundedInt(args, "limit", forgeRepoDefaultListLimit, forgeRepoMaxListLimit)
	typeFilter := strings.ToLower(stringArg(args, "type", ""))
	namePattern := stringArg(args, "namePattern", "")
	entries, err := os.ReadDir(target)
	if err != nil {
		return forgeError(fmt.Sprintf("列出目录失败: %v", err))
	}
	filtered := make([]os.DirEntry, 0, len(entries))
	for _, entry := range entries {
		if entry.Name() == ".git" {
			continue
		}
		if typeFilter == "file" && entry.IsDir() || typeFilter == "dir" && !entry.IsDir() {
			continue
		}
		if namePattern != "" {
			matched, matchErr := filepath.Match(namePattern, entry.Name())
			if matchErr != nil || !matched {
				continue
			}
		}
		filtered = append(filtered, entry)
	}
	sort.Slice(filtered, func(i, j int) bool { return strings.ToLower(filtered[i].Name()) < strings.ToLower(filtered[j].Name()) })
	result := map[string]interface{}{"rootHint": filepath.Base(root), "path": rel, "totalEntries": len(filtered), "truncated": len(filtered) > limit, "entries": []map[string]string{}}
	items := result["entries"].([]map[string]string)
	for _, entry := range filtered[:minInt(len(filtered), limit)] {
		entryType := "file"
		if entry.IsDir() {
			entryType = "dir"
		}
		items = append(items, map[string]string{"name": entry.Name(), "type": entryType})
	}
	result["entries"] = items
	return forgeResult(result, nil)
}

func forgeReadHandler(args map[string]interface{}) (CallToolResult, error) {
	root, err := repositoryToolRoot(args)
	if err != nil {
		return forgeError(err.Error())
	}
	pathArg := stringArg(args, "path", "")
	if pathArg == "" {
		return forgeError("path 不能为空")
	}
	target, rel, err := resolveForgeDevRepoTarget(root, pathArg)
	if err != nil {
		return forgeError(err.Error())
	}
	info, err := os.Stat(target)
	if err != nil || info.IsDir() {
		return forgeError(fmt.Sprintf("目标不是文本文件: %s", rel))
	}
	data, err := readForgeTextFile(target)
	if err != nil {
		return forgeError(err.Error())
	}
	lines := strings.Split(normalizeForgeText(string(data)), "\n")
	start := boundedInt(args, "start", 1, 0)
	limit := boundedInt(args, "limit", forgeRepoDefaultReadLimit, forgeRepoMaxReadLimit)
	if start < 1 {
		start = 1
	}
	if start > len(lines) {
		return forgeError(fmt.Sprintf("start=%d 超出文件总行数 %d", start, len(lines)))
	}
	end := minInt(len(lines), start+limit-1)
	var builder strings.Builder
	for line := start; line <= end; line++ {
		if line > start {
			builder.WriteByte('\n')
		}
		fmt.Fprintf(&builder, "%d | %s", line, lines[line-1])
	}
	return forgeResult(map[string]interface{}{"rootHint": filepath.Base(root), "path": rel, "startLine": start, "endLine": end, "totalLines": len(lines), "hasMore": end < len(lines), "content": builder.String()}, nil)
}

func forgeSearchHandler(args map[string]interface{}) (CallToolResult, error) {
	root, err := repositoryToolRoot(args)
	if err != nil {
		return forgeError(err.Error())
	}
	pattern := stringArg(args, "pattern", "")
	if pattern == "" {
		return forgeError("pattern 不能为空")
	}
	target, rel, err := resolveForgeDevRepoTarget(root, stringArg(args, "path", "."))
	if err != nil {
		return forgeError(err.Error())
	}
	limit := boundedInt(args, "limit", forgeRepoDefaultSearchLimit, forgeRepoMaxSearchLimit)
	ignoreCase := boolArg(args, "ignoreCase", false)
	useRegex := boolArg(args, "useRegex", false)
	filePattern := stringArg(args, "filePattern", "")
	var matcher func(string) bool
	if useRegex {
		regexPattern := pattern
		if ignoreCase {
			regexPattern = "(?i)" + regexPattern
		}
		compiled, compileErr := regexp.Compile(regexPattern)
		if compileErr != nil {
			return forgeError(fmt.Sprintf("正则表达式无效: %v", compileErr))
		}
		matcher = compiled.MatchString
	} else {
		needle := pattern
		if ignoreCase {
			needle = strings.ToLower(needle)
		}
		matcher = func(line string) bool {
			if ignoreCase {
				line = strings.ToLower(line)
			}
			return strings.Contains(line, needle)
		}
	}
	matches := make([]map[string]interface{}, 0, limit)
	scanned := 0
	appendFile := func(filePath string) error {
		if filePattern != "" {
			matched, matchErr := filepath.Match(filePattern, filepath.Base(filePath))
			if matchErr != nil || !matched {
				return nil
			}
		}
		data, readErr := readForgeTextFile(filePath)
		if readErr != nil {
			return nil
		}
		scanned++
		for lineNo, line := range strings.Split(normalizeForgeText(string(data)), "\n") {
			if !matcher(line) {
				continue
			}
			relPath, relErr := filepath.Rel(root, filePath)
			if relErr != nil {
				relPath = filePath
			} else {
				relPath = filepath.ToSlash(relPath)
			}
			matches = append(matches, map[string]interface{}{"path": relPath, "line": lineNo + 1, "content": truncateForgeLine(line)})
			if len(matches) >= limit {
				return errForgeSearchLimit
			}
		}
		return nil
	}
	info, err := os.Stat(target)
	if err != nil {
		return forgeError(fmt.Sprintf("搜索目标不存在: %s", rel))
	}
	if info.IsDir() {
		err = filepath.WalkDir(target, func(path string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return nil
			}
			relPath, relErr := filepath.Rel(root, path)
			if relErr != nil {
				return nil
			}
			relPath = filepath.ToSlash(relPath)
			if path != target && isBlockedForgePath(relPath) {
				if entry.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if entry.Type()&os.ModeSymlink != 0 {
				return nil
			}
			if entry.IsDir() {
				return nil
			}
			return appendFile(path)
		})
	} else {
		err = appendFile(target)
	}
	if err != nil && !errors.Is(err, errForgeSearchLimit) {
		return forgeError(fmt.Sprintf("搜索失败: %v", err))
	}
	return forgeResult(map[string]interface{}{"rootHint": filepath.Base(root), "path": rel, "pattern": pattern, "scannedFiles": scanned, "matchCount": len(matches), "hasMore": errors.Is(err, errForgeSearchLimit), "matches": matches}, nil)
}

var errForgeSearchLimit = errors.New("forge search limit reached")

func forgeWriteHandler(args map[string]interface{}) (CallToolResult, error) {
	root, err := repositoryToolRoot(args)
	if err != nil {
		return forgeError(err.Error())
	}
	target, rel, err := resolveForgeDevRepoTarget(root, stringArg(args, "path", ""))
	if err != nil {
		return forgeError(err.Error())
	}
	if err := requireProtectedForgeApproval(args, root, target); err != nil {
		return forgeError(err.Error())
	}
	if info, statErr := os.Stat(target); statErr == nil && info.IsDir() {
		return forgeError("目标路径是目录，不能写入")
	}
	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return forgeError(fmt.Sprintf("创建父目录失败: %v", err))
	}
	content, ok := args["content"].(string)
	if !ok {
		return forgeError("content 必须是字符串")
	}
	if err := os.WriteFile(target, []byte(content), 0644); err != nil {
		return forgeError(fmt.Sprintf("写入文件失败: %v", err))
	}
	return forgeResult(map[string]interface{}{"ok": true, "state": "written", "path": rel}, nil)
}

func forgeDeleteHandler(args map[string]interface{}) (CallToolResult, error) {
	root, err := repositoryToolRoot(args)
	if err != nil {
		return forgeError(err.Error())
	}
	target, rel, err := resolveForgeDevRepoTarget(root, stringArg(args, "path", ""))
	if err != nil {
		return forgeError(err.Error())
	}
	if err := requireProtectedForgeApproval(args, root, target); err != nil {
		return forgeError(err.Error())
	}
	info, err := os.Stat(target)
	if err != nil {
		return forgeError(fmt.Sprintf("目标不存在: %s", rel))
	}
	if info.IsDir() {
		entries, readErr := os.ReadDir(target)
		if readErr != nil {
			return forgeError(fmt.Sprintf("读取目录失败: %v", readErr))
		}
		if len(entries) != 0 {
			return forgeError("为避免递归删除，目录必须为空")
		}
	}
	if err := os.Remove(target); err != nil {
		return forgeError(fmt.Sprintf("删除失败: %v", err))
	}
	return forgeResult(map[string]interface{}{"ok": true, "state": "deleted", "path": rel}, nil)
}

func forgeEditHandler(args map[string]interface{}) (CallToolResult, error) {
	root, err := repositoryToolRoot(args)
	if err != nil {
		return forgeError(err.Error())
	}
	target, rel, err := resolveForgeDevRepoTarget(root, stringArg(args, "path", ""))
	if err != nil {
		return forgeError(err.Error())
	}
	if err := requireProtectedForgeApproval(args, root, target); err != nil {
		return forgeError(err.Error())
	}
	data, err := readForgeTextFile(target)
	if err != nil {
		return forgeError(err.Error())
	}
	oldString, ok := args["old_string"].(string)
	if !ok || oldString == "" {
		return forgeError("old_string 不能为空")
	}
	newString, ok := args["new_string"].(string)
	if !ok {
		return forgeError("new_string 必须是字符串")
	}
	content := normalizeForgeText(string(data))
	oldString = normalizeForgeText(oldString)
	count := strings.Count(content, oldString)
	if count == 0 {
		return forgeError("未找到 old_string")
	}
	if count != 1 {
		return forgeError(fmt.Sprintf("old_string 命中 %d 次，必须恰好命中一次", count))
	}
	newContent := strings.Replace(content, oldString, newString, 1)
	if err := writeForgeBackupAndFile(target, []byte(data), []byte(newContent)); err != nil {
		return forgeError(err.Error())
	}
	return forgeResult(map[string]interface{}{"ok": true, "state": "edited", "path": rel}, nil)
}

func forgeBatchReplaceHandler(args map[string]interface{}) (CallToolResult, error) {
	root, err := repositoryToolRoot(args)
	if err != nil {
		return forgeError(err.Error())
	}
	pattern := stringArg(args, "pattern", "")
	oldString := stringArg(args, "old_string", "")
	newString, newStringOK := args["new_string"].(string)
	if pattern == "" || oldString == "" || !newStringOK {
		return forgeError("pattern、old_string、new_string 均为必填项")
	}
	target, _, err := resolveForgeDevRepoTarget(root, stringArg(args, "path", "."))
	if err != nil {
		return forgeError(err.Error())
	}
	preview := boolArg(args, "preview", false)
	filePattern := stringArg(args, "filePattern", "")
	files := make([]string, 0)
	err = filepath.WalkDir(target, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		relPath, relErr := filepath.Rel(root, path)
		if relErr != nil {
			return nil
		}
		relPath = filepath.ToSlash(relPath)
		if path != target && isBlockedForgePath(relPath) {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return nil
		}
		if entry.IsDir() {
			return nil
		}
		matched, matchErr := matchForgePattern(pattern, relPath, entry.Name())
		if matchErr != nil || !matched {
			return nil
		}
		if filePattern != "" {
			matched, matchErr = filepath.Match(filePattern, entry.Name())
			if matchErr != nil || !matched {
				return nil
			}
		}
		data, readErr := readForgeTextFile(path)
		if readErr != nil || !strings.Contains(normalizeForgeText(string(data)), normalizeForgeText(oldString)) {
			return nil
		}
		files = append(files, path)
		return nil
	})
	if err != nil {
		return forgeError(fmt.Sprintf("匹配文件失败: %v", err))
	}
	if !preview {
		if err := requireProtectedForgeApproval(args, root, files...); err != nil {
			return forgeError(err.Error())
		}
	}
	changed := make([]string, 0, len(files))
	if !preview {
		for _, path := range files {
			data, readErr := readForgeTextFile(path)
			if readErr != nil {
				return forgeError(readErr.Error())
			}
			content := normalizeForgeText(string(data))
			old := normalizeForgeText(oldString)
			count := strings.Count(content, old)
			if count != 1 {
				return forgeError(fmt.Sprintf("%s 中 old_string 命中 %d 次，批量替换要求每个文件恰好命中一次", filepath.ToSlash(path), count))
			}
			newContent := strings.Replace(content, old, newString, 1)
			if writeErr := writeForgeBackupAndFile(path, data, []byte(newContent)); writeErr != nil {
				return forgeError(writeErr.Error())
			}
			changed = append(changed, relativeForgePath(root, path))
		}
	}
	matched := make([]string, 0, len(files))
	for _, path := range files {
		matched = append(matched, relativeForgePath(root, path))
	}
	return forgeResult(map[string]interface{}{"ok": true, "state": map[bool]string{true: "preview", false: "batch_replaced"}[preview], "matchedFiles": matched, "changedFiles": changed}, nil)
}

func forgeBashHandler(args map[string]interface{}) (CallToolResult, error) {
	root, err := repositoryToolRoot(args)
	if err != nil {
		return forgeError(err.Error())
	}
	command := strings.TrimSpace(stringArg(args, "command", ""))
	if command == "" {
		return forgeError("command 不能为空")
	}
	if err := validateForgeCommand(command, root); err != nil {
		return forgeError(err.Error())
	}
	if err := validateForgeRuntimeLifecycleCommand(command, root); err != nil {
		return forgeError(err.Error())
	}
	if containsGitCommit(command) {
		return forgeError("禁止通过 forge_dev_repo_bash 提交 Git。请使用 forge_dev_repo_git action=commit，并显式提供本次逻辑变更的 paths")
	}
	if err := requireForgeCommandApproval(args, root); err != nil {
		return forgeError(err.Error())
	}
	beforeGitStatus, beforeGitErr := runForgeGit(root, "status", "--short", "--untracked-files=all")
	timeout := boundedInt(args, "timeout", 30, 120)
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "powershell", "-NoProfile", "-Command", command)
	cmd.Dir = root
	cmd.Env = forgeCommandEnvironment()
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	runErr := cmd.Run()
	if ctx.Err() == context.DeadlineExceeded {
		return forgeResult(map[string]interface{}{"state": "timeout", "command": command, "timeout": timeout}, nil)
	}
	result := map[string]interface{}{"state": "executed", "command": command, "exitCode": 0, "stdout": truncateForgeOutput(stdout.String()), "stderr": truncateForgeOutput(stderr.String())}
	if beforeGitErr == nil {
		result["gitStatusBefore"] = beforeGitStatus["stdout"]
	}
	if afterGitStatus, afterGitErr := runForgeGit(root, "status", "--short", "--untracked-files=all"); afterGitErr == nil {
		result["gitStatusAfter"] = afterGitStatus["stdout"]
	}
	if runErr != nil {
		result["state"] = "executed_with_errors"
		if exitErr, ok := runErr.(*exec.ExitError); ok {
			result["exitCode"] = exitErr.ExitCode()
		} else {
			result["exitCode"] = -1
			result["error"] = runErr.Error()
		}
	}
	return forgeResult(result, nil)
}

func forgeGitHandler(args map[string]interface{}) (CallToolResult, error) {
	root, err := repositoryToolRoot(args)
	if err != nil {
		return forgeError(err.Error())
	}
	action := strings.ToLower(stringArg(args, "action", ""))
	if action == "" {
		return forgeError("action 不能为空")
	}
	paths, err := forgePathsArg(args["paths"])
	if err != nil {
		return forgeError(err.Error())
	}
	if action == "commit" {
		message := strings.TrimSpace(stringArg(args, "message", ""))
		if message == "" {
			return forgeError("commit 必须提供 message")
		}
		if len(paths) == 0 {
			return forgeError("commit 必须提供显式 paths，禁止提交未指定的改动")
		}
		for _, path := range paths {
			if err := validateForgeGitPath(root, path); err != nil {
				return forgeError(err.Error())
			}
			target, _, resolveErr := resolveForgeDevRepoTarget(root, path)
			if resolveErr != nil {
				return forgeError(resolveErr.Error())
			}
			if err := requireProtectedForgeApproval(args, root, target); err != nil {
				return forgeError(err.Error())
			}
		}
		addArgs := append([]string{"add", "--"}, paths...)
		if result, execErr := runForgeGit(root, addArgs...); execErr != nil {
			return forgeResult(result, execErr)
		}
		commitArgs := append([]string{"commit", "--only", "-m", message, "--"}, paths...)
		result, execErr := runForgeGit(root, commitArgs...)
		return forgeResult(result, execErr)
	}
	allowed := map[string]bool{"status": true, "log": true, "diff": true, "show": true, "branch": true}
	if !allowed[action] {
		return forgeError("不支持的 Git action")
	}
	gitArgs := []string{action}
	if len(paths) > 0 {
		for _, path := range paths {
			if err := validateForgeGitPath(root, path); err != nil {
				return forgeError(err.Error())
			}
		}
		gitArgs = append(gitArgs, "--")
		gitArgs = append(gitArgs, paths...)
	}
	result, execErr := runForgeGit(root, gitArgs...)
	return forgeResult(result, execErr)
}

func runForgeGit(root string, args ...string) (map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = root
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	result := map[string]interface{}{"command": append([]string{"git"}, args...), "stdout": truncateForgeOutput(stdout.String()), "stderr": truncateForgeOutput(stderr.String()), "exitCode": 0}
	if err != nil {
		result["exitCode"] = -1
		if exitErr, ok := err.(*exec.ExitError); ok {
			result["exitCode"] = exitErr.ExitCode()
		}
	}
	return result, err
}

func isForgeToolName(name string) bool {
	switch strings.TrimSpace(name) {
	case ForgeDevRepoListToolName, ForgeDevRepoReadToolName, ForgeDevRepoSearchToolName,
		ForgeDevRepoWriteToolName, ForgeDevRepoDeleteToolName, ForgeDevRepoEditToolName,
		ForgeDevRepoBatchReplaceToolName, ForgeDevRepoBashToolName, ForgeDevRepoGitToolName,
		ForgeRuntimeStatusToolName, ForgeRuntimeRestartToolName, ForgeRuntimeApproveTestsToolName:
		return true
	default:
		return false
	}
}

func detectForgeDevRepoRoot() (string, error) {
	if !util.IsForgeMode() {
		return "", errors.New("开发源码仓库工具仅在 forge 模式可用")
	}
	workingDir := strings.TrimSpace(util.WorkingDir)
	if workingDir == "" {
		return "", errors.New("forge 工作目录为空")
	}
	candidate, err := filepath.Abs(workingDir)
	if err != nil {
		return "", err
	}
	if evaluated, evalErr := filepath.EvalSymlinks(candidate); evalErr == nil {
		candidate = filepath.Clean(evaluated)
	}
	for {
		if isForgeDevRepoRoot(candidate) {
			return filepath.Clean(candidate), nil
		}
		parent := filepath.Dir(candidate)
		if sameForgePath(parent, candidate) {
			break
		}
		candidate = parent
	}
	return "", errors.New("未找到 forge 开发源码仓库根目录")
}

func isForgeDevRepoRoot(dir string) bool {
	return dirExists(filepath.Join(dir, "kernel")) && pathExists(filepath.Join(dir, "kernel", "go.mod")) && dirExists(filepath.Join(dir, "app", "src"))
}

func resolveForgeDevRepoTarget(root, rawPath string) (string, string, error) {
	cleanRoot, err := filepath.Abs(root)
	if err != nil {
		return "", "", err
	}
	if evaluated, evalErr := filepath.EvalSymlinks(cleanRoot); evalErr == nil {
		cleanRoot = filepath.Clean(evaluated)
	}
	relative := strings.TrimSpace(rawPath)
	if relative == "" {
		relative = "."
	}
	if filepath.IsAbs(relative) {
		return "", "", errors.New("path 必须是相对源码仓库根目录的路径")
	}
	target := filepath.Clean(filepath.Join(cleanRoot, filepath.FromSlash(relative)))
	if !sameOrSubForgePath(cleanRoot, target) {
		return "", "", errors.New("禁止访问源码仓库根目录之外的路径")
	}
	rel := relativeForgePath(cleanRoot, target)
	if isBlockedForgePath(rel) {
		return "", "", errors.New("禁止访问 .git 元数据目录")
	}
	probe := target
	for {
		evaluated, evalErr := filepath.EvalSymlinks(probe)
		if evalErr == nil {
			if !sameOrSubForgePath(cleanRoot, evaluated) {
				return "", "", errors.New("符号链接目标逸出源码仓库根目录")
			}
			break
		}
		if !os.IsNotExist(evalErr) {
			return "", "", fmt.Errorf("解析源码路径失败: %w", evalErr)
		}
		parent := filepath.Dir(probe)
		if sameForgePath(parent, probe) {
			break
		}
		probe = parent
	}
	return target, rel, nil
}

func validateForgeGitPath(root, rawPath string) error {
	_, rel, err := resolveForgeDevRepoTarget(root, rawPath)
	if err != nil {
		return err
	}
	if rel == "." {
		return errors.New("Git path 不能是源码仓库根目录")
	}
	return nil
}

func readForgeTextFile(path string) ([]byte, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}
	if info.IsDir() {
		return nil, errors.New("目标是目录，不是文本文件")
	}
	if info.Size() > forgeRepoMaxTextBytes {
		return nil, fmt.Errorf("文件过大（超过 %d bytes）", forgeRepoMaxTextBytes)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}
	if bytes.Contains(data, []byte{0}) || !utf8.Valid(data) {
		return nil, errors.New("仅支持 UTF-8 文本文件")
	}
	return data, nil
}

func writeForgeBackupAndFile(path string, oldContent, newContent []byte) error {
	if err := os.WriteFile(path+".bak", oldContent, 0644); err != nil {
		return fmt.Errorf("创建备份文件失败: %w", err)
	}
	if err := os.WriteFile(path, newContent, 0644); err != nil {
		return fmt.Errorf("写入文件失败: %w", err)
	}
	return nil
}

func matchForgePattern(pattern, relPath, baseName string) (bool, error) {
	pattern = filepath.ToSlash(pattern)
	if !strings.Contains(pattern, "/") {
		return filepath.Match(pattern, baseName)
	}
	return filepath.Match(pattern, filepath.ToSlash(relPath))
}

func validateForgeCommand(command, root string) error {
	if strings.Contains(command, "$([") || strings.Contains(command, "$(") || strings.Contains(command, "`") {
		return errors.New("禁止命令替换")
	}
	if regexp.MustCompile(`(?i)(^|[;&|])\s*(rm|rmdir|del|format|shutdown|reboot|sudo|cmd|bash|sh|powershell)\b`).MatchString(command) {
		return errors.New("命令包含被禁止的危险操作")
	}
	if strings.Contains(command, "git add .") || strings.Contains(command, "git add -A") || strings.Contains(command, "git commit -a") {
		return errors.New("禁止宽泛 Git 暂存或提交，请使用 forge_dev_repo_git 的显式 paths")
	}
	if strings.Contains(command, "..\\") || strings.Contains(command, "../") || strings.Contains(command, "cd ") && filepath.IsAbs(strings.TrimSpace(strings.TrimPrefix(strings.Split(command, "cd ")[1], "\""))) {
		return errors.New("命令路径不能逸出源码仓库")
	}
	_ = root
	return nil
}

func validateForgeRuntimeLifecycleCommand(command, root string) error {
	if !isForgeSourceCommandRoot(root) {
		return nil
	}
	forbidden := regexp.MustCompile(`(?i)(` +
		`\b(stop-process|start-process|start-job|taskkill|tskill|wmic|kill|pkill|killall)\b|` +
		`\.kill\s*\(|process\.kill|syscall\.kill|` +
		`siyuan-kernel|forge-start|forge_runtime|forge/runtime/shutdown|api/system/exit|` +
		`\b(pnpm|npm|yarn)\s+(run\s+)?forge\b|\bgo\s+run\b|--mode(?:=|\s+)forge\b|` +
		`\b(curl|wget|invoke-webrequest|invoke-restmethod)\b[^\r\n]*(127\.0\.0\.1|localhost)|` +
		`s_forge_supervisor)`)
	if forbidden.MatchString(command) {
		return errors.New("禁止通过源码命令控制 Kernel 或 Forge Supervisor 生命周期，请使用 forge_runtime_restart")
	}
	return nil
}

func forgeCommandEnvironment() []string {
	blockedPrefixes := []string{
		strings.ToUpper(util.ForgeSupervisorURLEnv) + "=",
		strings.ToUpper(util.ForgeSupervisorTokenEnv) + "=",
		strings.ToUpper(util.ForgeSupervisorRootEnv) + "=",
	}
	ret := make([]string, 0, len(os.Environ()))
	for _, entry := range os.Environ() {
		upper := strings.ToUpper(entry)
		blocked := false
		for _, prefix := range blockedPrefixes {
			if strings.HasPrefix(upper, prefix) {
				blocked = true
				break
			}
		}
		if !blocked {
			ret = append(ret, entry)
		}
	}
	return ret
}

func containsGitCommit(command string) bool {
	return regexp.MustCompile(`(?i)\bgit\s+commit\b`).MatchString(command)
}

func forgePathsArg(value interface{}) ([]string, error) {
	if value == nil {
		return nil, nil
	}
	items, ok := value.([]interface{})
	if !ok {
		return nil, errors.New("paths 必须是字符串数组")
	}
	paths := make([]string, 0, len(items))
	for _, item := range items {
		path, ok := item.(string)
		if !ok || strings.TrimSpace(path) == "" {
			return nil, errors.New("paths 中每一项都必须是非空字符串")
		}
		paths = append(paths, filepath.ToSlash(strings.TrimSpace(path)))
	}
	return paths, nil
}

func stringArg(args map[string]interface{}, key, fallback string) string {
	if value, ok := args[key].(string); ok {
		return strings.TrimSpace(value)
	}
	return fallback
}

func boolArg(args map[string]interface{}, key string, fallback bool) bool {
	if value, ok := args[key].(bool); ok {
		return value
	}
	return fallback
}

func boundedInt(args map[string]interface{}, key string, fallback, max int) int {
	value := fallback
	if raw, ok := args[key].(float64); ok {
		value = int(raw)
	}
	if value <= 0 {
		value = fallback
	}
	if max > 0 && value > max {
		value = max
	}
	return value
}

func normalizeForgeText(value string) string {
	return strings.ReplaceAll(strings.ReplaceAll(value, "\r\n", "\n"), "\r", "\n")
}

func relativeForgePath(root, target string) string {
	rel, err := filepath.Rel(root, target)
	if err != nil || rel == "." {
		return "."
	}
	return filepath.ToSlash(rel)
}

func isBlockedForgePath(relative string) bool {
	for _, segment := range strings.Split(filepath.ToSlash(relative), "/") {
		if segment == ".git" {
			return true
		}
	}
	return false
}

func sameOrSubForgePath(root, target string) bool {
	root = filepath.Clean(root)
	target = filepath.Clean(target)
	if sameForgePath(root, target) {
		return true
	}
	rel, err := filepath.Rel(root, target)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}

func sameForgePath(left, right string) bool {
	if runtime.GOOS == "windows" {
		return strings.EqualFold(filepath.Clean(left), filepath.Clean(right))
	}
	return filepath.Clean(left) == filepath.Clean(right)
}

func pathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func truncateForgeLine(line string) string {
	runes := []rune(line)
	if len(runes) <= 320 {
		return line
	}
	return string(runes[:320]) + "..."
}

func truncateForgeOutput(value string) string {
	if len(value) <= forgeRepoMaxCommandOutput {
		return value
	}
	return value[:forgeRepoMaxCommandOutput] + "\n... output truncated"
}

func minInt(left, right int) int {
	if left < right {
		return left
	}
	return right
}
