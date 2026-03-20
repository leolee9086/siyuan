// Package config 定义MAGI配置相关类型
package config

import "time"

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
	MemorySize     int          `json:"memorySize"`     // 消息历史条数（Casper/Trinity）
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
	// AvatarBuildToolName Avatar 原型创建工具名。
	AvatarBuildToolName = "buildAvatar"
	// AvatarModifyToolName Avatar 原型修改工具名。
	AvatarModifyToolName = "modifyAvatar"
	// AvatarSynthesizeToolName Avatar 原型综合工具名。
	AvatarSynthesizeToolName = "synthesizeAvatar"
	// SpeakToolName Trinity 输出工具名（兼容旧版，逐步废弃）。
	SpeakToolName = "speak"
	// SpeakStartToolName Trinity 对外表达状态开始工具名。
	SpeakStartToolName = "speak_start"
	// SpeakContinueToolName Trinity 对外表达状态续写工具名。
	SpeakContinueToolName = "speak_continue"
	// SpeakStopToolName Trinity 对外表达状态结束工具名。
	SpeakStopToolName = "speak_stop"
	// SpeakInternalStartToolName Trinity 内部表达状态开始工具名。
	SpeakInternalStartToolName = "speak_internal_start"
	// SpeakInternalContinueToolName Trinity 内部表达状态续写工具名。
	SpeakInternalContinueToolName = "speak_internal_continue"
	// SpeakInternalStopToolName Trinity 内部表达状态结束工具名。
	SpeakInternalStopToolName = "speak_internal_stop"
	// DeliberationSignalToolName Melchior 审慎决策信号工具名。
	DeliberationSignalToolName = "deliberation_signal"
	// NoteKeywordSearchToolName 三贤人笔记关键词查询工具名（词法查询）。
	NoteKeywordSearchToolName = "search_notes_by_keywords"
)

// BuildWannaSpeakToolDef 构建三贤人 wanna_speak 工具定义。
func BuildWannaSpeakToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        WannaSpeakToolName,
			Description: "提交本贤者希望对 Trinity 表达的观点内容。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"content": map[string]interface{}{
						"type":        "string",
						"description": "希望表达给 Trinity 的观点内容",
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
			Description: "进入表达状态。进入后通过 wanna_speak_continue 追加正文，结束时调用 wanna_speak_stop。",
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
			Description: "在表达状态中追加一段正文。可多次调用。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"content": map[string]interface{}{
						"type":        "string",
						"description": "本次追加的正文片段",
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
			Description: "结束表达状态。wanna_speak_start 与 wanna_speak_stop 必须成对出现。",
			Parameters: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
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
			Description: "按关键词查询笔记内容块（词法查询，不写入数据）。",
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

// BuildSpeakToolDef 构建 Trinity speak 工具定义。
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

// BuildSpeakStartToolDef 构建 Trinity speak_start 工具定义。
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

// BuildSpeakContinueToolDef 构建 Trinity speak_continue 工具定义。
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

// BuildSpeakStopToolDef 构建 Trinity speak_stop 工具定义。
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

// BuildSpeakInternalStartToolDef 构建 Trinity speak_internal_start 工具定义。
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

// BuildSpeakInternalContinueToolDef 构建 Trinity speak_internal_continue 工具定义。
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

// BuildSpeakInternalStopToolDef 构建 Trinity speak_internal_stop 工具定义。
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

// MAGIConfig MAGI系统完整配置
type MAGIConfig struct {
	Melchior  AgentConfig `json:"melchior"`
	Balthazar AgentConfig `json:"balthazar"`
	Casper    AgentConfig `json:"casper"`
	Trinity   AgentConfig `json:"trinity"`
}
