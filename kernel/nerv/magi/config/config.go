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
	ContextPercent float64      `json:"contextPercent"` // 上下文token占用百分比，范围 (0,100]（Melchior/Balthazar）
	SystemPrompt   string       `json:"systemPrompt"`
	Tools          []ToolDef    `json:"tools,omitempty"`
	// ToolChoice 控制模型的工具调用行为。
	// 可选值：nil(默认auto)、"required"(强制调用某个工具)、"none"(禁止调用工具)、
	// 或指定具体工具（参见 OpenAI tool_choice 文档）。
	ToolChoice any `json:"toolChoice,omitempty"`
}

// ToolMode 工具运行模式依赖。
type ToolMode uint8

const (
	ModeCore  ToolMode = 0 // 始终可用
	ModeForge ToolMode = 1 // 仅 forge 模式可用
)

// ToolPlatform 工具运行平台（bitmask 位掩码，0 表示全平台）。
type ToolPlatform uint16

const (
	PlatformStd     ToolPlatform = 1 << 0 // 桌面端
	PlatformDocker  ToolPlatform = 1 << 1 // Docker 容器
	PlatformAndroid ToolPlatform = 1 << 2 // Android
	PlatformIOS     ToolPlatform = 1 << 3 // iOS
	PlatformHarmony ToolPlatform = 1 << 4 // 鸿蒙
)

// ToolMeta 工具自描述元数据。每个字段独立正交，字段之间不存在任何隐含推导关系。
type ToolMeta struct {
	// ── 副作用能力（原子化布尔字段）──
	ReadsNotes           bool // 读取笔记内容
	ReadsFilesystem      bool // 读取文件系统
	ReadsExternalChannel bool // 读取外部渠道数据
	ReadsWebContent      bool // 读取网络内容
	ReadsMemories        bool // 读取跨会话记忆
	ModifiesNotes        bool // 修改笔记内容
	ModifiesFilesystem   bool // 修改文件系统
	ExecutesCommand      bool // 执行系统命令
	SendsExternalMessage bool // 发送外部渠道消息
	ModifiesAvatar       bool // 修改 avatar 状态
	PersistsMemory       bool // 写入持久化记忆到 /MAGI记忆/

	// ── 执行策略 ──
	RequiresPeerVote bool // 需要同级贤者投票

	// ── 可用场景（三个独立的布尔字段，互不推导）──
	AvailableDirectReply bool // 正常用户消息/直接回复时可用
	AvailableSleepHB     bool // 睡眠心跳时可用
	AvailableWorkHB      bool // 工作心跳时可用

	// ── 运行条件 ──
	Mode      ToolMode     // 运行模式依赖
	Platforms ToolPlatform // 平台可用性，0 表示全平台

	// ── 结果处理（三个独立属性）──
	EntersUnifiedContext bool // 工具调用结果进入统一上下文，三贤人间可共享/压缩
	ResultArchived       bool // 结果外部存档到 /MAGI查询结果/
	ResultPersisted      bool // 结果持久化到 /MAGI记忆/（跨会话保留）

	// ── 调用提醒 ──
	// RemindPolicy 工具调用超时未调用提醒策略。
	// 非 nil 时生效。更多钩子（全局提醒、辅助者提醒等）待实现。
	RemindPolicy *ToolRemindPolicy
}

// ToolRemindPolicy 工具调用超时未调用提醒策略。
// 声明该工具在持续多少轮未被调用时向持有者发出提醒。
// 当前仅实现了主导者提醒钩子，全局提醒、辅助者提醒等更多钩子待实现。
type ToolRemindPolicy struct {
	AfterRounds uint64            // 超过多少轮未调用则触发提醒
	Templates   map[uint64]string // 超出轮数 → 提醒模板，key 递增匹配，取≤实际超出轮数的最大 key
	ContextKeys []string          // 需要从调用参数中提取并保存到记录的字段名
}

// ToolDef 工具定义
type ToolDef struct {
	Type     string          `json:"type"` // "function"
	Function ToolFunctionDef `json:"function"`
	Meta     ToolMeta        `json:"-"`
}

// AddMotivationParam 为工具定义统一添加 motivation 参数，用于行动工具复核。
// 所有受治理的行动工具都应通过此函数添加 motivation，而非在各 Build* 中零散添加。
func AddMotivationParam(td ToolDef) ToolDef {
	return addRequiredStringParam(
		td,
		"motivation",
		"为什么现在要执行这次行动，以及它与当前任务的关系。用于行动工具复核。",
	)
}

// AddPurposeParam 为只读或查询工具统一添加显式 purpose 参数。
// purpose 会进入归档、审计和历史摘要，禁止从相邻回复文本推断。
func AddPurposeParam(td ToolDef) ToolDef {
	return addRequiredStringParam(
		td,
		"purpose",
		"本次读取或查询要解决的具体问题，以及结果将用于什么判断。",
	)
}

func addRequiredStringParam(td ToolDef, name, description string) ToolDef {
	params := td.Function.Parameters
	if params == nil {
		params = map[string]interface{}{}
		td.Function.Parameters = params
	}
	props, _ := params["properties"].(map[string]interface{})
	if props == nil {
		props = map[string]interface{}{}
		params["properties"] = props
	}
	if _, exists := props[name]; !exists {
		props[name] = map[string]interface{}{
			"type":        "string",
			"description": description,
		}
	}
	if params["type"] == nil {
		params["type"] = "object"
	}
	appendStringToRequired(params, name)
	return td
}

func appendStringToRequired(params map[string]interface{}, name string) {
	raw := params["required"]
	if raw == nil {
		params["required"] = []string{name}
		return
	}
	switch list := raw.(type) {
	case []string:
		for _, r := range list {
			if r == name {
				return
			}
		}
		params["required"] = append(list, name)
	case []interface{}:
		for _, r := range list {
			if s, ok := r.(string); ok && s == name {
				return
			}
		}
		params["required"] = append(list, name)
	}
}

// ToolFunctionDef 工具函数定义
type ToolFunctionDef struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"` // JSON Schema
}

const (
	// WannaSpeakToolName 三贤人流式输出工具名（兼容旧版，逐步废弃）。
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
	// DeliberationSignalToolName Melchior 审慎决策信号工具名。
	DeliberationSignalToolName = "deliberation_signal"
	// ProposeActionPlanToolName 行动计划提案工具名。
	ProposeActionPlanToolName = "propose_action_plan"
	// VoteToolName 内部审批投票工具名。
	VoteToolName = "vote"
	// DominantElectionToolName 主导者选举投票工具名。
	DominantElectionToolName = "dominant_election"
	// PersistSessionMemoryToolName 跨session对话记忆持久化落盘工具名。
	PersistSessionMemoryToolName = "persist_session_memory"
	// RecallCrossSessionMemoriesToolName 跨session对话记忆查询工具名。
	RecallCrossSessionMemoriesToolName = "recall_cross_session_memories"
	// FetchWebPageToolName 网页内容获取工具名。
	FetchWebPageToolName = "fetch_web_page"
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
					"doubts": map[string]interface{}{
						"type":        "array",
						"items":       map[string]interface{}{"type": "string"},
						"description": "你对当前输入消息的质疑点列表。" + prompts.SecurityReviewCriteria,
					},
				},
				"required": []string{"scores", "reason", "doubts"},
			},
		},
	}
}

// BuildProposeActionPlanToolDef 构建行动计划提案工具定义。
// 贤者在选举前使用此工具提交本轮行动计划。
func BuildProposeActionPlanToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        ProposeActionPlanToolName,
			Description: "在主导者选举前提交你本轮的行动计划。简要描述你在本轮想要做什么、关注什么方向。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"plan": map[string]interface{}{
						"type":        "string",
						"description": "本轮的简短行动计划，说明你打算做什么、关注什么方向。尽可能具体但不过于细节。",
					},
				},
				"required": []string{"plan"},
			},
		},
		Meta: ToolMeta{
			AvailableWorkHB: true,
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
			Description: "进入流式回复状态。形成完整想法后再进入；进入后通过 wanna_speak_continue 追加内容，结束时调用 wanna_speak_stop。",
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
			Description: "在流式输出状态中追加一段内容,这些内容将会被推送给消息接收方。可多次调用。",
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
			Description: "结束流式输出状态。wanna_speak_start 与 wanna_speak_stop 必须成对出现。",
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
					"deep": map[string]interface{}{
						"type":        "boolean",
						"description": "是否进行深度休息，清理当前上下文记忆以恢复精力。疲劳度归零但唤醒值暂时降低。请在深度休息前将重要信息通过工具持久化。",
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
					"deep": map[string]interface{}{
						"type":        "boolean",
						"description": "是否进行深度休息，清理当前上下文记忆以恢复精力。疲劳度归零但唤醒值暂时降低。请在深度休息前将重要信息通过工具持久化。",
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
					"deep": map[string]interface{}{
						"type":        "boolean",
						"description": "是否进行深度休息，清理当前上下文记忆以恢复精力。疲劳度归零但唤醒值暂时降低。请在深度休息前将重要信息通过工具持久化。",
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

// BuildForgeDevRepoReadToolDef 构建 forge 模式开发仓库文件读取工具定义。
// BuildForgeDevRepoSearchToolDef 构建 forge 模式开发仓库文本搜索工具定义。
// BuildForgeDevRepoEditToolDef 构建 forge 模式开发仓库文件编辑工具定义。
// BuildForgeDevRepoBatchReplaceToolDef 构建 forge 模式批量替换工具定义。
// BuildForgeDevRepoBashToolDef 构建 forge 模式开发仓库安全 Bash 命令执行工具定义。
// BuildAvatarBuildToolDef 构建 Avatar 创建工具定义。
func BuildAvatarBuildToolDef() ToolDef {
	return AddMotivationParam(ToolDef{
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
	})
}

// BuildAvatarModifyToolDef 构建 Avatar 修改工具定义。
func BuildAvatarModifyToolDef() ToolDef {
	return AddMotivationParam(ToolDef{
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
	})
}

// BuildAvatarSynthesizeToolDef 构建 Avatar 综合工具定义。
func BuildAvatarSynthesizeToolDef() ToolDef {
	return AddMotivationParam(ToolDef{
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
	})
}

// BuildSpeakStartToolDef 构建统合输出 speak_start 工具定义。
// BuildSpeakContinueToolDef 构建统合输出 speak_continue 工具定义。
// BuildSpeakStopToolDef 构建统合输出 speak_stop 工具定义。
// BuildSpeakInternalStartToolDef 构建统合输出 speak_internal_start 工具定义。
// BuildSpeakInternalContinueToolDef 构建统合输出 speak_internal_continue 工具定义。
// BuildSpeakInternalStopToolDef 构建统合输出 speak_internal_stop 工具定义。
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

// BuildPersistSessionMemoryToolDef 构建跨session对话记忆持久化落盘工具定义。
func BuildPersistSessionMemoryToolDef() ToolDef {
	return AddMotivationParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        PersistSessionMemoryToolName,
			Description: "将当前会话中值得记住的信息持久化保存到记忆笔记中。这是一个只读/追加操作，风险可控。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"summary": map[string]interface{}{
						"type":        "string",
						"description": "要保存的记忆摘要内容，以 markdown 格式书写。应包含谁、做了什么、为什么、结果如何。",
					},
					"tags": map[string]interface{}{
						"type":        "array",
						"items":       map[string]interface{}{"type": "string"},
						"description": "场景tag列表，用自己视角的tag词汇表打标，例如 [\"#决策/技术选型#\", \"#逻辑/方案对比#\"]。tag 格式为 #tag#。",
					},
				},
				"required": []string{"summary", "tags"},
			},
		},
	})
}

// BuildRecallCrossSessionMemoriesToolDef 构建跨session对话记忆查询工具定义。
func BuildRecallCrossSessionMemoriesToolDef() ToolDef {
	return AddPurposeParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        RecallCrossSessionMemoriesToolName,
			Description: "搜索跨会话的对话记忆。同时搜索已持久化的笔记记忆和当前运行中的会话历史。搜索结果按相关性排序，每条标注来源（持久化/内存）和匹配的tag。只读操作，无需投票。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "关键词搜索，用于全文搜索匹配记忆内容",
					},
					"tags": map[string]interface{}{
						"type":        "array",
						"items":       map[string]interface{}{"type": "string"},
						"description": "自己的场景tag列表，用于过滤记忆。只返回与之有交集的记忆。传空则不按tag过滤。例如 [\"#决策/技术选型#\", \"#逻辑/方案对比#\"]",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "返回条数上限，默认5，最大20",
					},
				},
				"required": []string{"query"},
			},
		},
	})
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

// BuildFetchWebPageToolDef 构建网页内容获取工具定义。
func BuildFetchWebPageToolDef() ToolDef {
	return AddPurposeParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        FetchWebPageToolName,
			Description: "获取指定 URL 的网页内容。拉取完成后将指定格式保存到工作空间 temp/raw/ 目录下的 .md 文件中供你前往阅读。该工具只读取外部信息，不触发行动治理。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"url": map[string]interface{}{
						"type":        "string",
						"description": "要获取内容的完整 URL，须包含协议前缀（如 https://）",
					},
					"timeout": map[string]interface{}{
						"type":        "integer",
						"description": "请求超时时间（秒），默认 15",
						"minimum":     5,
						"maximum":     60,
					},
					"format": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"markdown", "text", "html"},
						"description": "保存格式，默认 markdown",
					},
				},
				"required": []string{"url"},
			},
		},
		Meta: ToolMeta{
			ReadsWebContent:      true,
			AvailableDirectReply: true,
			AvailableWorkHB:      true,
			EntersUnifiedContext: true,
			ResultArchived:       true,
		},
	})
}

// MAGIConfig MAGI系统完整配置
type MAGIConfig struct {
	Melchior  AgentConfig `json:"melchior"`
	Balthazar AgentConfig `json:"balthazar"`
	Casper    AgentConfig `json:"casper"`
}
