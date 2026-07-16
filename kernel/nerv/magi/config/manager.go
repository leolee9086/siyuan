// Package config 提供MAGI配置管理
package config

import (
	"encoding/json"
	"os"
	"sync"
	"time"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// ContextStrategy 上下文管理策略
type ContextStrategy struct {
	Type    string  `json:"type"`    // "token_percent"、"message_count" 或 "round_count"
	Value   float64 `json:"value"`   // token百分比或消息条数
	Percent float64 `json:"percent"` // token占用百分比，范围 (0,100]；如 40 表示 40%（仅用于token_percent类型）
	Count   int     `json:"count"`   // 条数/轮数（用于message_count或round_count类型）
}

// TimeoutConfig 超时配置
type TimeoutConfig struct {
	VotingTimeout     time.Duration `json:"votingTimeout"`     // 投票超时（秒）
	VotingMaxRetries  int           `json:"votingMaxRetries"`  // 投票LLM请求最大重试次数
	VotingBackoffBase time.Duration `json:"votingBackoffBase"` // 投票重试指数退避基时
	ReplyMaxRetries   int           `json:"trinityMaxRetries"` // 沿用旧键名兼容历史配置
	ReplyInitialDelay time.Duration `json:"trinityInitialDelay"`
}

// ConfigManager MAGI配置管理器
type ConfigManager struct {
	mu              sync.RWMutex
	magiConfig      *MAGIConfig
	contextStrategy map[string]*ContextStrategy
	timeoutConfig   *TimeoutConfig
	configPath      string
	personaProfile  interface{} // 存储人格档案（类型为*marduk.IpipPersonaProfile，避免循环依赖）
}

// NewConfigManager 创建配置管理器
func NewConfigManager(configPath string) *ConfigManager {
	cm := &ConfigManager{
		configPath:      configPath,
		contextStrategy: make(map[string]*ContextStrategy),
		timeoutConfig:   defaultTimeoutConfig(),
	}

	// 尝试加载配置文件，失败则使用默认配置
	if err := cm.loadConfig(); err != nil {
		cm.magiConfig = defaultMAGIConfig()
		cm.contextStrategy = defaultContextStrategy()
	}

	return cm
}

// GetSEELConfig 获取指定贤者的SEEL配置
func (cm *ConfigManager) GetSEELConfig(name string) (*SEELConfig, bool) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	var agent *AgentConfig
	switch name {
	case "melchior":
		agent = &cm.magiConfig.Melchior
	case "balthazar":
		agent = &cm.magiConfig.Balthazar
	case "casper":
		agent = &cm.magiConfig.Casper
	default:
		return nil, false
	}

	return &agent.SEELConfig, true
}

// GetAgentConfig 获取完整的Agent配置
func (cm *ConfigManager) GetAgentConfig(name string) (*AgentConfig, bool) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	switch name {
	case "melchior":
		return &cm.magiConfig.Melchior, true
	case "balthazar":
		return &cm.magiConfig.Balthazar, true
	case "casper":
		return &cm.magiConfig.Casper, true
	default:
		return nil, false
	}
}

// GetContextStrategy 获取上下文管理策略
func (cm *ConfigManager) GetContextStrategy(agentName string) *ContextStrategy {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	if strategy, ok := cm.contextStrategy[agentName]; ok {
		return strategy
	}
	return nil
}

// GetTimeoutConfig 获取超时配置
func (cm *ConfigManager) GetTimeoutConfig() *TimeoutConfig {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.timeoutConfig
}

// loadConfig 从文件加载配置
func (cm *ConfigManager) loadConfig() error {
	if cm.configPath == "" {
		return os.ErrNotExist
	}

	data, err := os.ReadFile(cm.configPath)
	if err != nil {
		return err
	}

	var config MAGIConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return err
	}
	applyRequiredAvatarTools(&config)

	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.magiConfig = &config

	return nil
}

// defaultMAGIConfig 返回默认MAGI配置
func defaultMAGIConfig() *MAGIConfig {
	return &MAGIConfig{
		Melchior:  defaultMelchiorConfig(),
		Balthazar: defaultBalthazarConfig(),
		Casper:    defaultCasperConfig(),
	}
}

func buildDefaultCoreSageTools() []ToolDef {
	tools := []ToolDef{
		BuildWannaSpeakStartToolDef(),
		BuildWannaSpeakContinueToolDef(),
		BuildWannaSpeakStopToolDef(),
		BuildNoteKeywordSearchToolDef(),
		BuildNoteByIDReadToolDef(),
		BuildCreateNoteDocumentToolDef(),
		BuildAppendNoteBlocksToolDef(),
		BuildModifyNoteBlockToolDef(),
		BuildRevertNoteBlockToolDef(),
		BuildSearchWebToolDef(),
		BuildFetchWebPageToolDef(),
		BuildInspectWebSearchEnginesToolDef(),
		BuildListMagiChannelsToolDef(),
		BuildListMagiContactsToolDef(),
		BuildFetchChannelMessagesToolDef(),
	}
	if util.IsForgeMode() {
		tools = append(
			tools,
			BuildForgeDevRepoListToolDef(),
			BuildForgeDevRepoReadToolDef(),
			BuildForgeDevRepoSearchToolDef(),
			BuildForgeDevRepoEditToolDef(),
			BuildForgeDevRepoBatchReplaceToolDef(),
			BuildForgeDevRepoBashToolDef(),
		)
	}
	return tools
}

// defaultMelchiorConfig 返回Melchior默认配置
func defaultMelchiorConfig() AgentConfig {
	return AgentConfig{
		Name: "melchior",
		SEELConfig: SEELConfig{
			Name:         "Melchior",
			Color:        "#4A90E2",
			Icon:         "🔵",
			ResponseType: "theological",
			BaseWeight:   1.0,
		},
		MardukConfig:   MardukConfig{},
		ContextPercent: 80,
		SystemPrompt:   prompts.MelchiorSystemPrompt,
		Tools:          buildDefaultCoreSageTools(),
	}
}

// defaultBalthazarConfig 返回Balthazar默认配置
// 差异化策略：Balthazar使用40% token上下文，在信息完整性与思考深度间平衡
func defaultBalthazarConfig() AgentConfig {
	return AgentConfig{
		Name: "balthazar",
		SEELConfig: SEELConfig{
			Name:         "Balthazar",
			Color:        "#E74C3C",
			Icon:         "🔴",
			ResponseType: "scientific",
			BaseWeight:   1.0,
		},
		MardukConfig:   MardukConfig{},
		ContextPercent: 40,
		SystemPrompt:   prompts.BalthazarSystemPrompt,
		Tools:          buildDefaultCoreSageTools(),
	}
}

// defaultCasperConfig 返回Casper默认配置
// 差异化策略：Casper使用round_count 7轮上下文，不占用token百分比名额，观察历史的节奏而非内容
func defaultCasperConfig() AgentConfig {
	return AgentConfig{
		Name: "casper",
		SEELConfig: SEELConfig{
			Name:         "Casper",
			Color:        "#F39C12",
			Icon:         "🟡",
			ResponseType: "humanistic",
			BaseWeight:   1.0,
		},
		MardukConfig:   MardukConfig{},
		ContextPercent: 0,
		SystemPrompt:   prompts.CasperSystemPrompt,
		Tools:          buildDefaultCoreSageTools(),
	}
}

// defaultContextStrategy 返回默认上下文策略
// 差异化策略：Melchior 80% token（深广视角）、Balthazar 40% token（平衡）、Casper 7轮（节奏观察）
func defaultContextStrategy() map[string]*ContextStrategy {
	return map[string]*ContextStrategy{
		"melchior": {
			Type:    "token_percent",
			Percent: 80,
		},
		"balthazar": {
			Type:    "token_percent",
			Percent: 40,
		},
		"casper": {
			Type:  "round_count",
			Count: 7,
		},
	}
}

// defaultTimeoutConfig 返回默认超时配置
func defaultTimeoutConfig() *TimeoutConfig {
	return &TimeoutConfig{
		VotingTimeout:     120 * time.Second,
		VotingMaxRetries:  5,
		VotingBackoffBase: 1 * time.Second,
		ReplyMaxRetries:   10,
		ReplyInitialDelay: 1 * time.Second,
	}
}

func applyRequiredAvatarTools(cfg *MAGIConfig) {
	if cfg == nil {
		return
	}

	// 当前阶段只有三贤人参与生产路径；它们统一使用状态转移工具，并共享只读查询工具。
	// forge 模式下再附加开发仓库只读查看工具，避免普通模式暴露无意义的仓库入口。
	cfg.Melchior.Tools = ensureExclusiveTools(
		cfg.Melchior.Tools,
		buildDefaultCoreSageTools()...,
	)
	cfg.Balthazar.Tools = ensureExclusiveTools(
		cfg.Balthazar.Tools,
		buildDefaultCoreSageTools()...,
	)
	cfg.Casper.Tools = ensureExclusiveTools(
		cfg.Casper.Tools,
		buildDefaultCoreSageTools()...,
	)

	// 通过 continue 工具承载正文后，可强制工具调用，避免纯文本旁路。
	cfg.Melchior.ToolChoice = "required"
	cfg.Balthazar.ToolChoice = "required"
	cfg.Casper.ToolChoice = "required"
}

func ensureExclusiveTools(existing []ToolDef, required ...ToolDef) []ToolDef {
	if len(required) == 0 {
		return []ToolDef{}
	}

	byName := make(map[string]ToolDef, len(existing))
	for _, tool := range existing {
		name := tool.Function.Name
		if name == "" {
			continue
		}
		byName[name] = tool
	}

	normalized := make([]ToolDef, 0, len(required))
	for _, tool := range required {
		if preserved, ok := byName[tool.Function.Name]; ok {
			normalized = append(normalized, preserved)
			continue
		}
		normalized = append(normalized, tool)
	}
	return normalized
}

// SetPersonaProfile 设置人格档案（由Marduk调用）
func (cm *ConfigManager) SetPersonaProfile(profile interface{}) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.personaProfile = profile
}

// GetPersonaProfile 获取人格档案
func (cm *ConfigManager) GetPersonaProfile() interface{} {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.personaProfile
}
