package config

// ── 笔记读取工具 ──

const (
	NoteKeywordSearchToolName = "search_notes_by_keywords"
	NoteByIDReadToolName      = "read_note_by_id"
)

// BuildNoteByIDReadToolDef 构建按 ID 阅读笔记块内容及其子块的只读工具定义。
// 读取权限与 search_notes_by_keywords 一致：仅限 AI 主笔记本及其直接引用/嵌入范围内。
// format 参数支持三种格式，各自有不同权衡：
//
//	markdown（默认）：将目标块及其整个子树完整渲染为扁平的标准 Markdown 文本，一次性获得全部内容，但丢失块 ID 等结构化信息。
//	tree：返回结构化块信息 + 直接子块列表。注意该模式仅展开一层，子块不再包含 children 字段，
//	  如需访问更深层内容需对容器类子块另行调用本工具。支持 start/limit 分页。子块不含 IAL/Name/Alias 等属性。
//	kramdown：将目标块及其整个子树完整渲染为思源 Kramdown 格式（含 AST 块 ID 内联属性），保留 ID 引用能力。
func BuildNoteByIDReadToolDef() ToolDef {
	return AddPurposeParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        NoteByIDReadToolName,
			Description: "按块 ID 阅读当前工作空间 AI 主笔记本中的笔记块内容及其子块；若目标超出 AI 主笔记本的直接读取范围，仅返回块 ID 和所属文档 ID，此时应向用户请求阅读权限。format 参数控制输出格式：markdown（默认，标准 Markdown，将目标块整个子树完整渲染为扁平文本）、tree（结构化块信息+直接子块列表，仅一层不递归）、kramdown（思源 Kramdown，完整子树渲染含 AST 块 ID 内联属性）。tree 模式下支持通过 start 和 limit 参数仅读取部分子块内容，markdown/kramdown 模式下忽略 start/limit。注意：tree 模式仅返回直接子块（不递归），子块不含 children 字段；如需读取深层嵌套需对容器子块反复调用本工具。markdown/kramdown 模式则会递归渲染整个子树，一次性返回全部内容。返回结果包含 refs（反向链接：哪些块引用了当前块）和 defs（正向链接：当前块引用了哪些块）两个列表，每项包含 blockID、rootID、anchorText（锚文本）、type（类型）和 restricted（是否超出 AI 主笔记本范围）。对于 restricted 为 true 的项，仅返回 blockID 和 rootID，不返回内容。所有格式均返回 refs 和 defs。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{
						"type":        "string",
						"description": "要读取的笔记块 ID",
					},
					"start": map[string]interface{}{
						"type":        "integer",
						"description": "子块起始序号，从 1 开始，不传则从第 1 个子块开始。仅 tree 模式有效，markdown/kramdown 模式下忽略。",
						"minimum":     1,
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "返回的子块数量上限，不传则返回全部子块。仅 tree 模式有效，markdown/kramdown 模式下忽略。",
						"minimum":     1,
					},
					"format": map[string]interface{}{
						"type":        "string",
						"description": "输出格式：markdown（默认，将目标块整个子树完整渲染为扁平标准 Markdown 文本，一次性获得全部内容但丢失块 ID）、tree（结构化块信息+直接子块列表，仅一层不递归，子块不含 IAL 等属性）、kramdown（将目标块整个子树完整渲染为思源 Kramdown 格式，含 AST 块 ID 内联属性，保留 ID 引用能力）。所有格式均额外返回 refs（反向链接）和 defs（正向链接）。如需读取深层嵌套内容，markdown/kramdown 可一次完成，tree 需反复调用。",
						"enum":        []string{"tree", "markdown", "kramdown"},
					},
				},
				"required": []string{"id"},
			},
		},
	})
}

// BuildNoteKeywordSearchToolDef 构建三贤人笔记关键词查询工具定义（词法查询）。
func BuildNoteKeywordSearchToolDef() ToolDef {
	return AddPurposeParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        NoteKeywordSearchToolName,
			Description: "按关键词查询当前工作空间的AI主笔记本内容块。每条结果包含：notebook（笔记本名和ID）、path（文档路径面包屑，每段含ID）、headings（标题面包屑，匹配块上方标题层级链）、leafIndex（叶子块序号，-1表示非叶子块）。若命中超出AI主笔记本及其直接ID引用/嵌入范围，仅返回文档ID，此时应向用户请求阅读权限。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "查询关键词或短句",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "返回结果数量，最大 50",
						"minimum":     1,
						"maximum":     50,
					},
				},
				"required": []string{"query"},
			},
		},
	})
}

// ── 笔记写入工具 ──

const (
	WriteDiaryToolName         = "write_diary_entry"
	CreateNoteDocumentToolName = "create_note_document"
	AppendNoteBlocksToolName   = "append_note_blocks"
	ModifyNoteBlockToolName    = "modify_note_block"
	RevertNoteBlockToolName    = "revert_note_block"
)

// BuildWriteDiaryToolDef 构建向 AI 主笔记本日记写入 callout 容器条目的工具定义。
func BuildWriteDiaryToolDef() ToolDef {
	return AddMotivationParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        WriteDiaryToolName,
			Description: "用于往你的日记本里面记录笔记,当你需要主动记录重要事情的时候都应该使用它。调用时必须先明确填写本次行动动机，系统会把动机、工具名和参数交给专家团队结合完整上下文复核；若连续两次未获批准，当前轮次将改由其他处理路径继续。工具会把 markdown 正文包装成一个原生 callout 容器，并作为任意 markdown 子块追加到 AI 主笔记本当天的日记。注意：正文内容至少应包含 3 个双向链接（使用 ((块ID \"显示文字\")) 格式引用其他笔记块）。建议先使用搜索/读取工具了解可链接的笔记，宁滥勿缺。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"markdown": map[string]interface{}{
						"type":        "string",
						"description": "要写入 callout 容器内的 markdown 正文。支持标题、列表、代码块、表格等任意 markdown 子块。",
					},
					"calloutType": map[string]interface{}{
						"type":        "string",
						"description": "可选的 Callout 类型文本。留空时默认使用 NOTE，也支持自定义类型。",
					},
					"title": map[string]interface{}{
						"type":        "string",
						"description": "可选的 Callout 标题。留空时使用该类型的默认标题。",
					},
				},
				"required": []string{"markdown"},
			},
		},
	})
}

// BuildCreateNoteDocumentToolDef 构建创建文档工具定义。
func BuildCreateNoteDocumentToolDef() ToolDef {
	return AddMotivationParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        CreateNoteDocumentToolName,
			Description: "在 AI 主笔记本中创建一篇新文档。标题必须填写，内容支持 Markdown 格式。path 可选，指定存放路径如 /avatar/identity/，默认根路径。返回新文档的 ID。注意：正文内容至少应包含 3 个双向链接（使用 ((块ID \"显示文字\")) 格式引用其他笔记块）。建议先使用搜索/读取工具了解可链接的笔记，宁滥勿缺。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"title": map[string]interface{}{
						"type":        "string",
						"description": "文档标题",
					},
					"content": map[string]interface{}{
						"type":        "string",
						"description": "Markdown 正文",
					},
					"path": map[string]interface{}{
						"type":        "string",
						"description": "存放路径，如 /avatar/identity/，默认根路径",
					},
				},
				"required": []string{"title", "content"},
			},
		},
	})
}

// BuildAppendNoteBlocksToolDef 构建追加叶子块工具定义。
func BuildAppendNoteBlocksToolDef() ToolDef {
	return AddMotivationParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        AppendNoteBlocksToolName,
			Description: "向已有文档追加新的叶子块。parent_id 是文档 ID 或容器块 ID。content 为 Markdown 内容，多块用换行分隔。after_id 可选，在此块之后插入，必须是 parent_id 的后代。返回新块的 ID 列表。注意：正文内容至少应包含 3 个双向链接（使用 ((块ID \"显示文字\")) 格式引用其他笔记块）。建议先使用搜索/读取工具了解可链接的笔记，宁滥勿缺。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"parent_id": map[string]interface{}{
						"type":        "string",
						"description": "文档 ID 或容器块 ID",
					},
					"content": map[string]interface{}{
						"type":        "string",
						"description": "Markdown 内容，多块用换行分隔",
					},
					"after_id": map[string]interface{}{
						"type":        "string",
						"description": "在此块 ID 之后插入（可选，必须是 parent_id 的后代）",
					},
				},
				"required": []string{"parent_id", "content"},
			},
		},
	})
}

// BuildModifyNoteBlockToolDef 构建修改叶子块工具定义。
func BuildModifyNoteBlockToolDef() ToolDef {
	return AddMotivationParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        ModifyNoteBlockToolName,
			Description: "修改 AI 主笔记本中的一个叶子块内容。修改后该块会被标记 pending，需要用户在前端接受后才会解除锁定。pending 期间不可再次修改。仅支持叶子块（段落、标题、列表项等）。attrs 可选，传入要设置的块属性 KV。注意：正文内容至少应包含 3 个双向链接（使用 ((块ID \"显示文字\")) 格式引用其他笔记块）。建议先使用搜索/读取工具了解可链接的笔记，宁滥勿缺。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"block_id": map[string]interface{}{
						"type":        "string",
						"description": "要修改的叶子块 ID",
					},
					"content": map[string]interface{}{
						"type":        "string",
						"description": "新的 Markdown 内容",
					},
					"attrs": map[string]interface{}{
						"type":        "object",
						"description": "可选，要设置的块属性 KV 对",
						"additionalProperties": map[string]interface{}{
							"type": "string",
						},
					},
				},
				"required": []string{"block_id", "content"},
			},
		},
	})
}

// BuildRevertNoteBlockToolDef 构建回滚 pending 修改工具定义。
func BuildRevertNoteBlockToolDef() ToolDef {
	return AddMotivationParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        RevertNoteBlockToolName,
			Description: "回滚一个 pending 状态的叶子块修改，恢复原内容。仅当块有 custom-magi-pending 属性时可用。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"block_id": map[string]interface{}{
						"type":        "string",
						"description": "要回滚的叶子块 ID",
					},
				},
				"required": []string{"block_id"},
			},
		},
	})
}
