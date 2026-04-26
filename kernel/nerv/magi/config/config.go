// Package config 定义MAGI配置相关类型
package config

import (
	"time"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
)

// SEELConfig SEEL基础配置（对应前端SEELConfiguration）
type SEELConfig struct {
	Name         string  `json:"name"`
	Color        string  `json:"color"`
	Icon         string  `json:"icon"`
	ResponseType string  `json:"responseType"` // theological/scientific/humanistic
	BaseWeight   float64 `json:"baseWeight"`
}

// MardukConfig Marduk验证后的配置（对应前端MardukValidatedConfig）
type MardukConfig struct {
	APIKey      string        `json:"apiKey"`
	BaseURL     string        `json:"baseURL"`
	Model       string        `json:"model"`
	Timeout     time.Duration `json:"timeout"` // 毫秒转换为Duration
	MaxTokens   int           `json:"maxTokens"`
	Temperature float64       `json:"temperature"`
	Meta        *ConfigMeta   `json:"_meta,omitempty"`
}

// ConfigMeta 配置元数据
type ConfigMeta struct {
	Source    string     `json:"source,omitempty"`
	LoadedAt  *time.Time `json:"loadedAt,omitempty"`
	IsDefault bool       `json:"isDefault,omitempty"`
}

// AgentConfig 单个Agent的配置
type AgentConfig struct {
	Name           string       `json:"name"`
	SEELConfig     SEELConfig   `json:"seelConfig"`
	MardukConfig   MardukConfig `json:"mardukConfig"`
	MemorySize     int          `json:"memorySize"`     // 消息历史条数
	ContextPercent float64      `json:"contextPercent"` // 上下文token占用百分比（Melchior/Balthazar）
	SystemPrompt   string       `json:"systemPrompt"`
	Tools          []ToolDef    `json:"tools,omitempty"`
	// ToolChoice 控制模型的工具调用行为。
	// 可选值：nil(默认auto)、"required"(强制调用某个工具)、"none"(禁止调用工具)、
	// 或指定具体工具（参见 OpenAI tool_choice 文档）。
	ToolChoice any `json:"toolChoice,omitempty"`
}

// ToolDef 工具定义
type ToolDef struct {
	Type     string          `json:"type"` // "function"
	Function ToolFunctionDef `json:"function"`
}

// ToolFunctionDef 工具函数定义
type ToolFunctionDef struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"` // JSON Schema
}

const (
	// WannaSpeakToolName 三贤人内部表达工具名（兼容旧版，逐步废弃）。
	WannaSpeakToolName = "wanna_speak"
	// WannaSpeakStartToolName 三贤人表达状态开始工具名。
	WannaSpeakStartToolName = "wanna_speak_start"
	// WannaSpeakContinueToolName 三贤人表达状态续写工具名。
	WannaSpeakContinueToolName = "wanna_speak_continue"
	// WannaSpeakStopToolName 三贤人表达状态结束工具名。
	WannaSpeakStopToolName = "wanna_speak_stop"
	// WannaSleepRecordToolName 心跳轮次当前记录工具名。
	WannaSleepRecordToolName = "wanna_sleep_record"
	// WannaSleepPlanToolName 心跳轮次下一步计划工具名。
	WannaSleepPlanToolName = "wanna_sleep_plan"
	// WannaSleepDreamToolName 心跳轮次画面描述工具名。
	WannaSleepDreamToolName = "wanna_sleep_dream"
	// WannaSleepMergedRecordName 心跳轮次合并笔记记录名。
	WannaSleepMergedRecordName = "wanna_sleep_merged"
	// AvatarBuildToolName Avatar 原型创建工具名。
	AvatarBuildToolName = "buildAvatar"
	// AvatarModifyToolName Avatar 原型修改工具名。
	AvatarModifyToolName = "modifyAvatar"
	// AvatarSynthesizeToolName Avatar 原型综合工具名。
	AvatarSynthesizeToolName = "synthesizeAvatar"
	// SpeakToolName 统合输出工具名（兼容旧版，逐步废弃）。
	SpeakToolName = "speak"
	// SpeakStartToolName 统合输出的对外表达状态开始工具名。
	SpeakStartToolName = "speak_start"
	// SpeakContinueToolName 统合输出的对外表达状态续写工具名。
	SpeakContinueToolName = "speak_continue"
	// SpeakStopToolName 统合输出的对外表达状态结束工具名。
	SpeakStopToolName = "speak_stop"
	// SpeakInternalStartToolName 统合输出的内部表达状态开始工具名。
	SpeakInternalStartToolName = "speak_internal_start"
	// SpeakInternalContinueToolName 统合输出的内部表达状态续写工具名。
	SpeakInternalContinueToolName = "speak_internal_continue"
	// SpeakInternalStopToolName 统合输出的内部表达状态结束工具名。
	SpeakInternalStopToolName = "speak_internal_stop"
	// DeliberationSignalToolName Melchior 审慎决策信号工具名。
	DeliberationSignalToolName = "deliberation_signal"
	// VoteToolName 内部审批投票工具名。
	VoteToolName = "vote"
	// NoteKeywordSearchToolName 三贤人笔记关键词查询工具名（词法查询）。
	NoteKeywordSearchToolName = "search_notes_by_keywords"
	// ForgeDevRepoListToolName forge 模式开发仓库目录查看工具名。
	ForgeDevRepoListToolName = "forge_dev_repo_list"
	// ForgeDevRepoReadToolName forge 模式开发仓库文件读取工具名。
	ForgeDevRepoReadToolName = "forge_dev_repo_read"
	// ForgeDevRepoSearchToolName forge 模式开发仓库文本搜索工具名。
	ForgeDevRepoSearchToolName = "forge_dev_repo_search"
	// ForgeDevRepoEditToolName forge 模式开发仓库文件编辑工具名。
	ForgeDevRepoEditToolName = "forge_dev_repo_edit"
	// ForgeDevRepoBatchReplaceToolName forge 模式开发仓库批量替换工具名。
	ForgeDevRepoBatchReplaceToolName = "forge_dev_repo_batch_replace"
	// ForgeDevRepoBashToolName forge 模式开发仓库安全 Bash 命令执行工具名。
	ForgeDevRepoBashToolName = "forge_dev_repo_bash"
	// WriteDiaryToolName 向 AI 主笔记本当日日记追加 callout 容器式日记条目的工具名。
	WriteDiaryToolName = "write_diary_entry"
	// DominantElectionToolName 主导者选举投票工具名。
	DominantElectionToolName = "dominant_election"
	// NoteByIDReadToolName 按 ID 读取笔记块内容及其子块的工具名。
	NoteByIDReadToolName = "read_note_by_id"
)

// BuildDominantElectionToolDef 构建主导者选举投票工具定义。
// 对应 dominantVotePayload 结构，用于替代旧的自由文本 JSON 输出方式。
func BuildDominantElectionToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        DominantElectionToolName,
			Description: "对当前情境下的各候选主导者描述进行打分，选出最适合优先采取行动的一方。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"scores": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"candidate": map[string]interface{}{
									"type":        "string",
									"description": "候选描述原文，必须逐字复用给定描述",
								},
								"score": map[string]interface{}{
									"type":        "integer",
									"description": "0-100之间的整数，越高表示该描述在当前情境下越适合优先行动",
									"minimum":     0,
									"maximum":     100,
								},
							},
							"required": []string{"candidate", "score"},
						},
						"description": "全部候选描述的打分列表，数量必须与候选描述数量完全一致",
					},
					"reason": map[string]interface{}{
						"type":        "string",
						"description": "一句中文理由，不超过48个字",
					},
				},
				"required": []string{"scores", "reason"},
			},
		},
	}
}

// BuildWannaSpeakToolDef 构建三贤人 wanna_speak 工具定义。
func BuildWannaSpeakToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        WannaSpeakToolName,
			Description: "提交当前已经形成的内部想法内容。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"content": map[string]interface{}{
						"type":        "string",
						"description": "当前已经形成的内部想法内容",
					},
				},
				"required": []string{"content"},
			},
		},
	}
}

// BuildWannaSpeakStartToolDef 构建三贤人 wanna_speak_start 工具定义。
func BuildWannaSpeakStartToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        WannaSpeakStartToolName,
			Description: "进入内部表达状态。形成完整想法后再进入；进入后通过 wanna_speak_continue 追加内容，结束时调用 wanna_speak_stop。",
			Parameters: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
	}
}

// BuildWannaSpeakContinueToolDef 构建三贤人 wanna_speak_continue 工具定义。
func BuildWannaSpeakContinueToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        WannaSpeakContinueToolName,
			Description: "在内部表达状态中追加一段内容。可多次调用。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"content": map[string]interface{}{
						"type":        "string",
						"description": "本次追加的内容片段",
					},
				},
				"required": []string{"content"},
			},
		},
	}
}

// BuildWannaSpeakStopToolDef 构建三贤人 wanna_speak_stop 工具定义。
func BuildWannaSpeakStopToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        WannaSpeakStopToolName,
			Description: "结束内部表达状态。wanna_speak_start 与 wanna_speak_stop 必须成对出现。",
			Parameters: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
	}
}

// BuildWannaSleepRecordToolDef 构建“当前记录”型心跳休眠工具定义。
func BuildWannaSleepRecordToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        WannaSleepRecordToolName,
			Description: "仅在心跳唤醒轮次可用。表示本次醒来已完成阶段性检查/处理，准备休眠。你需要记录这次醒来做了什么、在想什么；如果没有必须处理的任务，也要顺手记下当前心情和最近刚做了什么。不要重复记录时间、系统状态或轮次等系统会自动保存的信息。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"summary": map[string]interface{}{
						"type":        "string",
						"description": "本次醒来期间已经完成的检查、思考或处理摘要；若暂无任务，可简要记录当前心情和最近做了什么。不要重复写系统状态，因为系统会自动记录。",
					},
				},
				"required": []string{"summary"},
			},
		},
	}
}

// BuildWannaSleepPlanToolDef 构建“下一步计划”型心跳休眠工具定义。
func BuildWannaSleepPlanToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        WannaSleepPlanToolName,
			Description: "仅在心跳唤醒轮次可用。表示本次醒来已完成阶段性检查/处理，准备休眠。你需要记录这次醒来做了什么，以及下一步最值得推进的计划。不要重复记录时间、系统状态或轮次等系统会自动保存的信息。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"summary": map[string]interface{}{
						"type":        "string",
						"description": "本次醒来期间已经完成的检查、思考或处理摘要。",
					},
					"nextStepPlan": map[string]interface{}{
						"type":        "string",
						"description": "接下来最值得推进的步骤、顺序或检查计划。",
					},
				},
				"required": []string{"summary", "nextStepPlan"},
			},
		},
	}
}

// BuildWannaSleepDreamToolDef 构建“画面描述”型心跳休眠工具定义。
func BuildWannaSleepDreamToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        WannaSleepDreamToolName,
			Description: "仅在心跳唤醒轮次可用。表示本次醒来已完成阶段性检查/处理，准备休眠。你需要记录这次醒来做了什么，并且用你认为最相关的画面和联想表现它,画面应该是一段具体而生动的描述,可以让人看到就能够理解其中蕴含的情绪和线索。不要重复记录时间、系统状态或轮次等系统会自动保存的信息。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"summary": map[string]interface{}{
						"type":        "string",
						"description": "本次醒来期间已经完成的检查、思考或处理摘要。",
					},
					"dreamScene": map[string]interface{}{
						"type":        "string",
						"description": "可直接交给文生图接口的画面描述，具体,生动,用意向和场景表达你的情绪和联想,注意因为其他人可能并不知道你长什么样,所以如果画面中出现你自己,用具体的形象而不是简单地说'我'。",
					},
				},
				"required": []string{"summary", "dreamScene"},
			},
		},
	}
}

func IsWannaSleepToolName(name string) bool {
	switch name {
	case WannaSleepRecordToolName, WannaSleepPlanToolName, WannaSleepDreamToolName:
		return true
	default:
		return false
	}
}

func ResolveWannaSleepToolNameForSage(sageName string) string {
	switch sageName {
	case "melchior":
		return WannaSleepPlanToolName
	case "balthazar":
		return WannaSleepDreamToolName
	case "casper":
		return WannaSleepRecordToolName
	default:
		return ""
	}
}

// BuildNoteByIDReadToolDef 构建按 ID 阅读笔记块内容及其子块的只读工具定义。
// 读取权限与 search_notes_by_keywords 一致：仅限 AI 主笔记本及其直接引用/嵌入范围内。
// format 参数支持 tree（默认，结构化块信息+子块列表）、markdown（标准 Markdown 内容）、kramdown（思源 Kramdown 格式内容）。
// tree 模式下支持 start/limit 参数控制仅返回部分子块内容。
func BuildNoteByIDReadToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        NoteByIDReadToolName,
			Description: "按块 ID 阅读当前工作空间 AI 主笔记本中的笔记块内容及其子块；若目标超出 AI 主笔记本的直接读取范围，仅返回块 ID 和所属文档 ID，此时应向用户请求阅读权限。format 参数控制输出格式：tree（结构化块信息+子块列表）、markdown（标准 Markdown 内容）、kramdown（思源 Kramdown 格式内容）。tree 模式下支持通过 start 和 limit 参数仅读取部分子块内容。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{
						"type":        "string",
						"description": "要读取的笔记块 ID",
					},
					"start": map[string]interface{}{
						"type":        "integer",
						"description": "子块起始序号，从 1 开始，不传则从第 1 个子块开始",
						"minimum":     1,
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "返回的子块数量上限，不传则返回全部子块",
						"minimum":     1,
					},
					"format": map[string]interface{}{
						"type":        "string",
						"description": "输出格式：tree（默认，结构化块信息+子块列表）、markdown（标准 Markdown 内容）、kramdown（思源 Kramdown 格式内容）",
						"enum":        []string{"tree", "markdown", "kramdown"},
					},
				},
				"required": []string{"id"},
			},
		},
	}
}

// BuildNoteKeywordSearchToolDef 构建三贤人笔记关键词查询工具定义（词法查询）。
func BuildNoteKeywordSearchToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        NoteKeywordSearchToolName,
			Description: "按关键词查询当前工作空间的AI主笔记本内容块；若命中超出AI主笔记本及其直接ID引用/嵌入范围，仅返回文档ID，此时应向用户请求阅读权限。",
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
	}
}

// BuildForgeDevRepoListToolDef 构建 forge 模式开发仓库目录查看工具定义。
func BuildForgeDevRepoListToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        ForgeDevRepoListToolName,
			Description: "仅在 forge 模式可用。只读列出开发代码仓库中的目录内容。input 为纯文本，使用相对仓库根目录的 key=value 行，例如：path=kernel/nerv/magi\\nlimit=200。支持 typeFilter=file|dir 按类型过滤，namePattern=*.go 按名称模式过滤。",
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
	}
}

// BuildForgeDevRepoReadToolDef 构建 forge 模式开发仓库文件读取工具定义。
func BuildForgeDevRepoReadToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        ForgeDevRepoReadToolName,
			Description: "仅在 forge 模式可用。只读读取开发代码仓库中的文本文件。input 为纯文本，使用相对仓库根目录的 key=value 行，例如：path=kernel/nerv/magi/coordinator/coordinator.go 或 path=kernel/nerv/magi/coordinator/coordinator.go\\nstart=1\\nlimit=120。",
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
	}
}

// BuildForgeDevRepoSearchToolDef 构建 forge 模式开发仓库文本搜索工具定义。
func BuildForgeDevRepoSearchToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        ForgeDevRepoSearchToolName,
			Description: "仅在 forge 模式可用。只读搜索开发代码仓库。input 为纯文本，使用 key=value 行，例如：pattern=buildToolResultExecutor\\npath=kernel/nerv/magi\\nlimit=20。支持 ignoreCase=true 忽略大小写、useRegex=true 启用正则表达式匹配、filePattern=*.go 按文件名称模式过滤。",
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
	}
}

// BuildForgeDevRepoEditToolDef 构建 forge 模式开发仓库文件编辑工具定义。
func BuildForgeDevRepoEditToolDef() ToolDef {
	return ToolDef{
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
					"motivation": map[string]interface{}{
						"type":        "string",
						"description": "为什么现在要执行这次编辑，以及它与当前任务的关系。用于行动工具复核。",
					},
				},
				"required": []string{"target_path", "old_string", "new_string", "motivation"},
			},
		},
	}
}

// BuildForgeDevRepoBatchReplaceToolDef 构建 forge 模式批量替换工具定义。
func BuildForgeDevRepoBatchReplaceToolDef() ToolDef {
	return ToolDef{
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
					"motivation": map[string]interface{}{
						"type":        "string",
						"description": "为什么现在要执行这次批量替换，以及它与当前任务的关系。用于行动工具复核。",
					},
				},
				"required": []string{"pattern", "old_string", "new_string", "motivation"},
			},
		},
	}
}

// BuildForgeDevRepoBashToolDef 构建 forge 模式开发仓库安全 Bash 命令执行工具定义。
func BuildForgeDevRepoBashToolDef() ToolDef {
	return ToolDef{
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
	}
}

// BuildWriteDiaryToolDef 构建向 AI 主笔记本日记写入 callout 容器条目的工具定义。
func BuildWriteDiaryToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        WriteDiaryToolName,
			Description: "用于往你的日记本里面记录笔记,当你需要主动记录重要事情的时候都应该使用它。调用时必须先明确填写本次行动动机，系统会把动机、工具名和参数交给专家团队结合完整上下文复核；若连续两次未获批准，当前轮次将改由其他处理路径继续。工具会把 markdown 正文包装成一个原生 callout 容器，并作为任意 markdown 子块追加到 AI 主笔记本当天的日记。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"motivation": map[string]interface{}{
						"type":        "string",
						"description": "为什么现在要执行这次行动，以及它与当前任务的关系。用于行动工具复核。",
					},
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
				"required": []string{"motivation", "markdown"},
			},
		},
	}
}

// BuildAvatarBuildToolDef 构建 Avatar 创建工具定义。
func BuildAvatarBuildToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        AvatarBuildToolName,
			Description: "发起 Avatar 原型创建。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"initiate": map[string]interface{}{
						"type": "boolean",
					},
					"reason": map[string]interface{}{
						"type": "string",
					},
					"systemPromptProposal": map[string]interface{}{
						"type": "string",
					},
					"requirements": map[string]interface{}{
						"type": "string",
					},
				},
				"required": []string{"initiate", "reason", "systemPromptProposal", "requirements"},
			},
		},
	}
}

// BuildAvatarModifyToolDef 构建 Avatar 修改工具定义。
func BuildAvatarModifyToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        AvatarModifyToolName,
			Description: "修改 Avatar 原型并给出评审结论。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"decision": map[string]interface{}{
						"type": "string",
						"enum": []string{"approved", "rejected"},
					},
					"reason": map[string]interface{}{
						"type": "string",
					},
					"systemPromptProposal": map[string]interface{}{
						"type": "string",
					},
					"requirements": map[string]interface{}{
						"type": "string",
					},
				},
				"required": []string{"decision", "reason", "systemPromptProposal", "requirements"},
			},
		},
	}
}

// BuildAvatarSynthesizeToolDef 构建 Avatar 综合工具定义。
func BuildAvatarSynthesizeToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        AvatarSynthesizeToolName,
			Description: "综合 Avatar 修改提案并输出最终系统提示词。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"finalSystemPrompt": map[string]interface{}{
						"type": "string",
					},
				},
				"required": []string{"finalSystemPrompt"},
			},
		},
	}
}

// BuildSpeakToolDef 构建统合输出 speak 工具定义。
func BuildSpeakToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        SpeakToolName,
			Description: "输出最终响应内容给用户。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"content": map[string]interface{}{
						"type":        "string",
						"description": "要输出的响应内容",
					},
					"channel": map[string]interface{}{
						"type":        "string",
						"description": "输出渠道：public（对外）或 internal（内部报告）",
						"enum":        []string{"public", "internal"},
					},
				},
				"required": []string{"content"},
			},
		},
	}
}

// BuildSpeakStartToolDef 构建统合输出 speak_start 工具定义。
func BuildSpeakStartToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        SpeakStartToolName,
			Description: "进入对外表达状态。进入后通过 speak_continue 追加正文，结束时调用 speak_stop。",
			Parameters: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
	}
}

// BuildSpeakContinueToolDef 构建统合输出 speak_continue 工具定义。
func BuildSpeakContinueToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        SpeakContinueToolName,
			Description: "在对外表达状态中追加一段正文。可多次调用。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"content": map[string]interface{}{
						"type":        "string",
						"description": "本次追加的对外正文片段",
					},
				},
				"required": []string{"content"},
			},
		},
	}
}

// BuildSpeakStopToolDef 构建统合输出 speak_stop 工具定义。
func BuildSpeakStopToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        SpeakStopToolName,
			Description: "结束对外表达状态。speak_start 与 speak_stop 必须成对出现。",
			Parameters: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
	}
}

// BuildSpeakInternalStartToolDef 构建统合输出 speak_internal_start 工具定义。
func BuildSpeakInternalStartToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        SpeakInternalStartToolName,
			Description: "进入内部报告表达状态。进入后通过 speak_internal_continue 追加内容，结束时必须调用 speak_internal_stop。",
			Parameters: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
	}
}

// BuildSpeakInternalContinueToolDef 构建统合输出 speak_internal_continue 工具定义。
func BuildSpeakInternalContinueToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        SpeakInternalContinueToolName,
			Description: "在内部报告表达状态中追加一段内容。可多次调用。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"content": map[string]interface{}{
						"type":        "string",
						"description": "本次追加的内部报告内容片段",
					},
				},
				"required": []string{"content"},
			},
		},
	}
}

// BuildSpeakInternalStopToolDef 构建统合输出 speak_internal_stop 工具定义。
func BuildSpeakInternalStopToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        SpeakInternalStopToolName,
			Description: "结束内部报告表达状态。speak_internal_start 与 speak_internal_stop 必须成对出现。",
			Parameters: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
	}
}

// BuildDeliberationSignalToolDef 构建 Melchior 审慎决策信号工具定义。
func BuildDeliberationSignalToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        DeliberationSignalToolName,
			Description: "发出审慎决策信号，表明当前决策需要慎重考虑。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"requires_deliberation": map[string]interface{}{
						"type":        "boolean",
						"description": "是否需要审慎决策",
					},
					"reason": map[string]interface{}{
						"type":        "string",
						"description": "需要审慎决策的原因",
					},
					"proposed_action": map[string]interface{}{
						"type":        "string",
						"description": "建议的行动提案，用一句话说明要做什么以及为什么",
					},
				},
				"required": []string{"requires_deliberation", "reason", "proposed_action"},
			},
		},
	}
}

// BuildVoteToolDef 构建内部审批投票工具定义。
func BuildVoteToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        VoteToolName,
			Description: "对当前提案进行二元投票，只能在批准或否决之间二选一，并给出简短理由。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"decision": map[string]interface{}{
						"type": "string",
						"enum": []string{prompts.VoteApprove, prompts.VoteReject},
					},
					"reason": map[string]interface{}{
						"type":        "string",
						"description": "投票理由，简短说明判断依据。",
					},
				},
				"required": []string{"decision", "reason"},
			},
		},
	}
}

// MAGIConfig MAGI系统完整配置
type MAGIConfig struct {
	Melchior  AgentConfig `json:"melchior"`
	Balthazar AgentConfig `json:"balthazar"`
	Casper    AgentConfig `json:"casper"`
}
