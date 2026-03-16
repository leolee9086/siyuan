// Package config 提供MAGI配置管理
package config

import (
	"encoding/json"
	"os"
	"sync"
	"time"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
)

// ContextStrategy 上下文管理策略
type ContextStrategy struct {
	Type    string  `json:"type"`    // "token_percent" 或 "message_count"
	Value   float64 `json:"value"`   // token百分比或消息条数
	Percent float64 `json:"percent"` // token占用百分比（仅用于token_percent类型）
	Count   int     `json:"count"`   // 消息条数（仅用于message_count类型）
}

// TimeoutConfig 超时配置
type TimeoutConfig struct {
	VotingTimeout       time.Duration `json:"votingTimeout"`       // 投票超时（秒）
	TrinityMaxRetries   int           `json:"trinityMaxRetries"`   // Trinity最大重试次数
	TrinityInitialDelay time.Duration `json:"trinityInitialDelay"` // Trinity初始延迟（秒）
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
	case "trinity":
		agent = &cm.magiConfig.Trinity
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
	case "trinity":
		return &cm.magiConfig.Trinity, true
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
		Trinity:   defaultTrinityConfig(),
	}
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
		ContextPercent: 0.8,
		SystemPrompt:   prompts.MelchiorSystemPrompt,
		Tools: []ToolDef{
			BuildWannaSpeakStartToolDef(),
			BuildWannaSpeakContinueToolDef(),
			BuildWannaSpeakStopToolDef(),
		},
	}
}

// defaultBalthazarConfig 返回Balthazar默认配置
// 注意：认知结构的保持将由上下文工程（prompt设计、记忆检索等）而非上下文长度来保证
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
		ContextPercent: 0.8,
		SystemPrompt:   prompts.BalthazarSystemPrompt,
		Tools: []ToolDef{
			BuildWannaSpeakStartToolDef(),
			BuildWannaSpeakContinueToolDef(),
			BuildWannaSpeakStopToolDef(),
		},
	}
}

// defaultCasperConfig 返回Casper默认配置
// 注意：认知结构的保持将由上下文工程（prompt设计、记忆检索等）而非上下文长度来保证
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
		ContextPercent: 0.8,
		SystemPrompt:   prompts.CasperSystemPrompt,
		Tools: []ToolDef{
			BuildWannaSpeakStartToolDef(),
			BuildWannaSpeakContinueToolDef(),
			BuildWannaSpeakStopToolDef(),
		},
	}
}

// buildTrinitySystemPrompt 构建Trinity完整系统提示词
// 对齐前端 mockWise.prompts.ts:116-138 的 TRINITY_STITCH_SYSTEM_REQUIREMENTS
func buildTrinitySystemPrompt() string {
	return prompts.TrinitySystemPrompt()
}

// defaultTrinityConfig 返回Trinity默认配置
func defaultTrinityConfig() AgentConfig {
	return AgentConfig{
		Name: "trinity",
		SEELConfig: SEELConfig{
			Name:         "Trinity",
			Color:        "#9B59B6",
			Icon:         "🟣",
			ResponseType: "synthesis",
			BaseWeight:   1.0,
		},
		MardukConfig: MardukConfig{},
		MemorySize:   3,
		SystemPrompt: buildTrinitySystemPrompt(),
		Tools: []ToolDef{
			BuildSpeakStartToolDef(),
			BuildSpeakContinueToolDef(),
			BuildSpeakStopToolDef(),
			BuildSpeakInternalStartToolDef(),
			BuildSpeakInternalContinueToolDef(),
			BuildSpeakInternalStopToolDef(),
		},
	}
}

// defaultContextStrategy 返回默认上下文策略
// 注意：三贤人统一使用80%上下文，认知结构的保持将由上下文工程（prompt设计、记忆检索等）而非上下文长度来保证
func defaultContextStrategy() map[string]*ContextStrategy {
	return map[string]*ContextStrategy{
		"melchior": {
			Type:    "token_percent",
			Percent: 0.8,
		},
		"balthazar": {
			Type:    "token_percent",
			Percent: 0.8,
		},
		"casper": {
			Type:    "token_percent",
			Percent: 0.8,
		},
		"trinity": {
			Type:    "token_percent",
			Percent: 0.8,
		},
	}
}

// defaultTimeoutConfig 返回默认超时配置
func defaultTimeoutConfig() *TimeoutConfig {
	return &TimeoutConfig{
		VotingTimeout:       30 * time.Second,
		TrinityMaxRetries:   10,
		TrinityInitialDelay: 1 * time.Second,
	}
}

func applyRequiredAvatarTools(cfg *MAGIConfig) {
	if cfg == nil {
		return
	}

	// 当前阶段三贤人与 Trinity 均使用 start/continue/stop 状态转移工具。
	cfg.Melchior.Tools = ensureExclusiveTools(
		cfg.Melchior.Tools,
		BuildWannaSpeakStartToolDef(),
		BuildWannaSpeakContinueToolDef(),
		BuildWannaSpeakStopToolDef(),
	)
	cfg.Balthazar.Tools = ensureExclusiveTools(
		cfg.Balthazar.Tools,
		BuildWannaSpeakStartToolDef(),
		BuildWannaSpeakContinueToolDef(),
		BuildWannaSpeakStopToolDef(),
	)
	cfg.Casper.Tools = ensureExclusiveTools(
		cfg.Casper.Tools,
		BuildWannaSpeakStartToolDef(),
		BuildWannaSpeakContinueToolDef(),
		BuildWannaSpeakStopToolDef(),
	)
	cfg.Trinity.Tools = ensureExclusiveTools(
		cfg.Trinity.Tools,
		BuildSpeakStartToolDef(),
		BuildSpeakContinueToolDef(),
		BuildSpeakStopToolDef(),
		BuildSpeakInternalStartToolDef(),
		BuildSpeakInternalContinueToolDef(),
		BuildSpeakInternalStopToolDef(),
	)

	// 通过 continue 工具承载正文后，可强制工具调用，避免纯文本旁路。
	cfg.Melchior.ToolChoice = "required"
	cfg.Balthazar.ToolChoice = "required"
	cfg.Casper.ToolChoice = "required"
	cfg.Trinity.ToolChoice = "required"
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
