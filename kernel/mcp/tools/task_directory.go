package tools

import (
	"errors"
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"strings"
)

const (
	TaskDirectoryListToolName         = "task_directory_list"
	TaskDirectoryReadToolName         = "task_directory_read"
	TaskDirectorySearchToolName       = "task_directory_search"
	TaskDirectoryWriteToolName        = "task_directory_write"
	TaskDirectoryDeleteToolName       = "task_directory_delete"
	TaskDirectoryEditToolName         = "task_directory_edit"
	TaskDirectoryBatchReplaceToolName = "task_directory_batch_replace"
	TaskDirectoryCommandToolName      = "task_directory_command"
)

const (
	TaskDirectoryPermissionReadOnly  = "read-only"
	TaskDirectoryPermissionReadWrite = "read-write"
	TaskDirectoryPermissionCommand   = "command"
)

type taskDirectoryCapability struct {
	root        string
	permission  string
	directoryID string
}

const taskDirectoryCapabilityArg = "_taskDirectoryCapability"

// WithTaskDirectoryCapability 将服务端解析出的任务目录根路径注入原生工具参数。
func WithTaskDirectoryCapability(args map[string]interface{}, root string) {
	WithTaskDirectoryGrant(args, "main", root, TaskDirectoryPermissionReadWrite)
}

// WithTaskDirectoryGrant 注入服务端选择的目录和权限，调用方不能通过模型参数伪造 root。
func WithTaskDirectoryGrant(args map[string]interface{}, directoryID, root, permission string) {
	if args == nil {
		return
	}
	args[taskDirectoryCapabilityArg] = taskDirectoryCapability{
		root:        filepath.Clean(root),
		permission:  permission,
		directoryID: directoryID,
	}
}

// repositoryToolRoot 根据工具参数选择 forge 仓库根目录或会话 capability 根目录。
func repositoryToolRoot(args map[string]interface{}) (string, error) {
	if capability, ok := args[taskDirectoryCapabilityArg].(taskDirectoryCapability); ok {
		if strings.TrimSpace(capability.root) == "" {
			return "", errors.New("任务目录 capability 无效")
		}
		resolved, err := filepath.EvalSymlinks(filepath.Clean(capability.root))
		if err != nil {
			return "", fmt.Errorf("任务目录不可用: %w", err)
		}
		info, err := os.Stat(resolved)
		if err != nil || !info.IsDir() {
			return "", errors.New("任务目录不可用")
		}
		return filepath.Clean(resolved), nil
	}
	return ForgeDevRepoRoot()
}

func init() {
	registerTaskDirectoryTool(ForgeDevRepoListTool, TaskDirectoryListToolName, "列出当前会话绑定的任务目录内容，path 必须相对于任务目录根路径。", TaskDirectoryPermissionReadOnly)
	registerTaskDirectoryTool(ForgeDevRepoReadTool, TaskDirectoryReadToolName, "按行读取当前会话绑定任务目录中的 UTF-8 文本文件。", TaskDirectoryPermissionReadOnly)
	registerTaskDirectoryTool(ForgeDevRepoSearchTool, TaskDirectorySearchToolName, "在当前会话绑定的任务目录中搜索文本或正则表达式。", TaskDirectoryPermissionReadOnly)
	registerTaskDirectoryTool(ForgeDevRepoWriteTool, TaskDirectoryWriteToolName, "创建或完整覆写当前会话任务目录中的 UTF-8 文本文件；执行前需要用户确认。", TaskDirectoryPermissionReadWrite)
	registerTaskDirectoryTool(ForgeDevRepoDeleteTool, TaskDirectoryDeleteToolName, "删除当前会话任务目录中的单个文件或空目录；执行前需要用户确认。", TaskDirectoryPermissionReadWrite)
	registerTaskDirectoryTool(ForgeDevRepoEditTool, TaskDirectoryEditToolName, "对当前会话任务目录中的文件执行单次精确替换；执行前需要用户确认。", TaskDirectoryPermissionReadWrite)
	registerTaskDirectoryTool(ForgeDevRepoBatchReplaceTool, TaskDirectoryBatchReplaceToolName, "对当前会话任务目录中的匹配文件执行精确替换；写入前需要用户确认。", TaskDirectoryPermissionReadWrite)
	registerTaskDirectoryTool(ForgeDevRepoBashTool, TaskDirectoryCommandToolName, "在当前会话绑定的命令权限目录执行受边界保护的命令；执行前需要用户确认。", TaskDirectoryPermissionCommand)
}

func registerTaskDirectoryTool(base *Tool, name, description, permission string) {
	tool := *base
	tool.Name = name
	tool.Description = description
	tool.Source = "task-directory"
	tool.CapabilityID = BuildCapabilityID(tool.Source, "backend", name)
	tool.InputSchema.Properties = maps.Clone(base.InputSchema.Properties)
	if tool.InputSchema.Properties == nil {
		tool.InputSchema.Properties = map[string]Property{}
	}
	tool.InputSchema.Properties["directoryID"] = Property{Type: "string", Description: "目标目录 capability ID；main 表示主任务目录，省略时使用 main。"}
	baseHandler := base.Handler
	tool.Handler = func(args map[string]interface{}) (CallToolResult, error) {
		capability, ok := args[taskDirectoryCapabilityArg].(taskDirectoryCapability)
		if !ok {
			return forgeError("任务目录 capability 缺失，拒绝执行")
		}
		if !taskDirectoryPermissionAllowed(capability.permission, permission) {
			return forgeError("当前目录 capability 不允许执行该操作")
		}
		return baseHandler(args)
	}
	register(&tool)
}

func taskDirectoryPermissionAllowed(grantPermission, requiredPermission string) bool {
	if requiredPermission == TaskDirectoryPermissionReadOnly {
		return grantPermission == TaskDirectoryPermissionReadOnly || grantPermission == TaskDirectoryPermissionReadWrite
	}
	return grantPermission == requiredPermission
}

func IsTaskDirectoryTool(name string) bool {
	switch strings.TrimSpace(name) {
	case TaskDirectoryListToolName, TaskDirectoryReadToolName, TaskDirectorySearchToolName,
		TaskDirectoryWriteToolName, TaskDirectoryDeleteToolName, TaskDirectoryEditToolName,
		TaskDirectoryBatchReplaceToolName, TaskDirectoryCommandToolName:
		return true
	default:
		return false
	}
}

func TaskDirectoryToolPermission(name string) string {
	switch strings.TrimSpace(name) {
	case TaskDirectoryListToolName, TaskDirectoryReadToolName, TaskDirectorySearchToolName:
		return TaskDirectoryPermissionReadOnly
	case TaskDirectoryWriteToolName, TaskDirectoryDeleteToolName, TaskDirectoryEditToolName, TaskDirectoryBatchReplaceToolName:
		return TaskDirectoryPermissionReadWrite
	case TaskDirectoryCommandToolName:
		return TaskDirectoryPermissionCommand
	default:
		return ""
	}
}
