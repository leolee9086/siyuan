package config

// ── Forge 模式开发仓库工具 ──

const (
	ForgeDevRepoListToolName       = "forge_dev_repo_list"
	ForgeDevRepoReadToolName       = "forge_dev_repo_read"
	ForgeDevRepoSearchToolName     = "forge_dev_repo_search"
	ForgeDevRepoEditToolName       = "forge_dev_repo_edit"
	ForgeDevRepoBatchReplaceToolName = "forge_dev_repo_batch_replace"
	ForgeDevRepoBashToolName       = "forge_dev_repo_bash"
)

// BuildForgeDevRepoListToolDef 构建 forge 模式开发仓库目录查看工具定义。
func BuildForgeDevRepoListToolDef() ToolDef {
	return AddPurposeParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        ForgeDevRepoListToolName,
			Description: "仅在 forge 模式可用。只读列出开发代码仓库中的目录内容。input 为纯文本，使用相对仓库根目录的 key=value 行，例如：path=kernel/nerv/magi\\nlimit=200。支持 typeFilter=file|dir 按类型过滤，namePattern=*.go 按名称模式过滤。调用时必须显式填写本次查询目的。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"input": map[string]interface{}{
						"type":        "string",
						"description": "纯文本参数，支持 path=<相对路径>、limit=<数量>、typeFilter=<file|dir>、namePattern=<glob 模式>",
					},
				},
				"required": []string{"input"},
			},
		},
	})
}

// BuildForgeDevRepoReadToolDef 构建 forge 模式开发仓库文件读取工具定义。
func BuildForgeDevRepoReadToolDef() ToolDef {
	return AddPurposeParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        ForgeDevRepoReadToolName,
			Description: "仅在 forge 模式可用。只读读取开发代码仓库中的文本文件。input 为纯文本，使用相对仓库根目录的 key=value 行，例如：path=kernel/nerv/magi/coordinator/coordinator.go 或 path=kernel/nerv/magi/coordinator/coordinator.go\\nstart=1\\nlimit=120。调用时必须显式填写本次读取目的。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"input": map[string]interface{}{
						"type":        "string",
						"description": "纯文本参数，支持 path=<相对路径>、start=<起始行号>、limit=<行数>",
					},
				},
				"required": []string{"input"},
			},
		},
	})
}

// BuildForgeDevRepoSearchToolDef 构建 forge 模式开发仓库文本搜索工具定义。
func BuildForgeDevRepoSearchToolDef() ToolDef {
	return AddPurposeParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        ForgeDevRepoSearchToolName,
			Description: "仅在 forge 模式可用。只读搜索开发代码仓库。input 为纯文本，使用 key=value 行，例如：pattern=buildToolResultExecutor\\npath=kernel/nerv/magi\\nlimit=20。支持 ignoreCase=true 忽略大小写、useRegex=true 启用正则表达式匹配、filePattern=*.go 按文件名称模式过滤。调用时必须显式填写本次搜索目的。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"input": map[string]interface{}{
						"type":        "string",
						"description": "纯文本参数，支持 pattern=<文本>、path=<相对路径>、limit=<数量>、ignoreCase=<true|false>、useRegex=<true|false>、filePattern=<glob 模式>",
					},
				},
				"required": []string{"input"},
			},
		},
	})
}

// BuildForgeDevRepoEditToolDef 构建 forge 模式开发仓库文件编辑工具定义。
func BuildForgeDevRepoEditToolDef() ToolDef {
	return AddMotivationParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name: ForgeDevRepoEditToolName,
			Description: "仅在 forge 模式可用。对开发代码仓库中的文本文件执行精确的 SEARCH/REPLACE 替换操作。" +
				"请从文件中复制需要替换的原文作为 old_string，确保精确匹配（包括空白字符和换行符）。" +
				"调用时必须先明确填写本次行动动机，系统会把动机、工具名和参数交给专家团队结合完整上下文复核。" +
				"若连续两次未获批准，当前轮次将改由其他处理路径继续。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"target_path": map[string]interface{}{
						"type":        "string",
						"description": "目标文件路径，相对于开发代码仓库根目录",
					},
					"old_string": map[string]interface{}{
						"type":        "string",
						"description": "需要替换的原文（SEARCH 块），必须从文件中精确复制，包括所有空白字符和换行符",
					},
					"new_string": map[string]interface{}{
						"type":        "string",
						"description": "替换后的新内容（REPLACE 块）",
					},
				},
				"required": []string{"target_path", "old_string", "new_string"},
			},
		},
	})
}

// BuildForgeDevRepoBatchReplaceToolDef 构建 forge 模式批量替换工具定义。
func BuildForgeDevRepoBatchReplaceToolDef() ToolDef {
	return AddMotivationParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name: ForgeDevRepoBatchReplaceToolName,
			Description: "仅在 forge 模式可用。在开发代码仓库中基于搜索匹配结果执行批量替换。" +
				"先使用 pattern 搜索匹配文件，然后在匹配结果上执行 old_string→new_string 替换。" +
				"如果指定 preview=true，仅预览匹配结果而不实际执行替换。" +
				"调用时必须先明确填写本次行动动机，系统会把动机、工具名和参数交给专家团队结合完整上下文复核。" +
				"若连续两次未获批准，当前轮次将改由其他处理路径继续。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pattern": map[string]interface{}{
						"type":        "string",
						"description": "搜索模式，匹配包含此模式的文件",
					},
					"old_string": map[string]interface{}{
						"type":        "string",
						"description": "需要替换的原文（SEARCH 块），必须从文件中精确复制，包括所有空白字符和换行符",
					},
					"new_string": map[string]interface{}{
						"type":        "string",
						"description": "替换后的新内容（REPLACE 块）",
					},
					"path": map[string]interface{}{
						"type":        "string",
						"description": "搜索路径，相对于开发仓库根目录，默认 .",
					},
					"filePattern": map[string]interface{}{
						"type":        "string",
						"description": "文件名称 glob 模式过滤，如 *.go",
					},
					"preview": map[string]interface{}{
						"type":        "boolean",
						"description": "true 时仅预览匹配结果，不执行实际替换",
					},
				},
				"required": []string{"pattern", "old_string", "new_string"},
			},
		},
	})
}

// BuildForgeDevRepoBashToolDef 构建 forge 模式开发仓库安全 Bash 命令执行工具定义。
func BuildForgeDevRepoBashToolDef() ToolDef {
	return AddMotivationParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        ForgeDevRepoBashToolName,
			Description: "仅在 forge 模式可用。在 forge 开发代码库中执行安全的 Bash 命令。仅限只/读操作和受限的写操作（需三贤人投票）。cwd 自动锁定在 forge dev repo 根目录。支持 command（要执行的 bash 命令）、timeout（超时秒数 1-120，默认 30）、description（命令说明，辅助治理投票决策）。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"command": map[string]interface{}{
						"type":        "string",
						"description": "要执行的 bash 命令",
					},
					"timeout": map[string]interface{}{
						"type":        "integer",
						"description": "超时秒数（1-120），默认 30",
						"default":     30,
					},
					"description": map[string]interface{}{
						"type":        "string",
						"description": "命令说明，辅助治理投票决策",
					},
				},
				"required": []string{"command"},
			},
		},
	})
}
