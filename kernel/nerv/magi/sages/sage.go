// Package sages 提供MAGI贤者实例管理
package sages

import (
	"context"
	"fmt"
	"sync"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// ContextManager 上下文管理器接口
type ContextManager interface {
	AddMessage(msg types.ContextMessage)
	GetMessages() []types.ContextMessage
	Clear()
	ApplyStrategy(strategy *config.ContextStrategy)
}

// Sage 贤者实例
type Sage struct {
	mu             sync.RWMutex
	name           string
	displayName    string
	config         *config.AgentConfig
	llmClient      llm.Client
	contextManager ContextManager
	systemPrompt   string
	tools          []openai.Tool
	profile        *marduk.IpipPersonaProfile
}

// NewSage 创建贤者实例
func NewSage(name string, cfg *config.AgentConfig, client llm.Client, strategy *config.ContextStrategy) *Sage {
	cm := newContextManager(strategy)

	// 转换工具定义
	var tools []openai.Tool
	for _, toolDef := range cfg.Tools {
		tools = append(tools, openai.Tool{
			Type: openai.ToolType(toolDef.Type),
			Function: &openai.FunctionDefinition{
				Name:        toolDef.Function.Name,
				Description: toolDef.Function.Description,
				Parameters:  toolDef.Function.Parameters,
			},
		})
	}

	return &Sage{
		name:           name,
		displayName:    cfg.SEELConfig.Name,
		config:         cfg,
		llmClient:      client,
		contextManager: cm,
		systemPrompt:   cfg.SystemPrompt,
		tools:          tools,
	}
}

// SendMessage 发送消息并返回流式响应
func (s *Sage) SendMessage(ctx context.Context, sessionId, roundId, userInput string) (<-chan types.StreamChunk, error) {
	s.mu.Lock()

	// 添加系统提示词（如果上下文为空）
	messages := s.contextManager.GetMessages()
	if len(messages) == 0 && s.systemPrompt != "" {
		s.contextManager.AddMessage(types.ContextMessage{
			Role:    types.RoleSystem,
			Content: s.systemPrompt,
		})
	}

	// 添加用户消息
	s.contextManager.AddMessage(types.ContextMessage{
		Role:    types.RoleUser,
		Content: userInput,
	})

	messages = s.contextManager.GetMessages()
	requestMessages := s.buildRequestMessages(messages)
	s.mu.Unlock()

	// 推送LLM请求事件
	if sessionId != "" && roundId != "" {
		model := s.llmClient.GetModel()
		toolCount := len(s.tools)
		_ = websocket.PushLLMRequestSent(sessionId, roundId, s.name, s.displayName, model, requestMessages, toolCount)
	}

	// 发送请求
	return s.llmClient.SendChatRequest(ctx, requestMessages, s.tools)
}

// AddToContext 添加消息到上下文
func (s *Sage) AddToContext(msg types.ContextMessage) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.contextManager.AddMessage(msg)
}

// GetContext 获取当前上下文
func (s *Sage) GetContext() []types.ContextMessage {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.contextManager.GetMessages()
}

// ClearContext 清空上下文
func (s *Sage) ClearContext() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.contextManager.Clear()
}

// GetName 获取贤者名称
func (s *Sage) GetName() string {
	return s.name
}

// GetDisplayName 获取显示名称
func (s *Sage) GetDisplayName() string {
	return s.displayName
}

// GetLLMClient 获取LLM客户端
func (s *Sage) GetLLMClient() llm.Client {
	return s.llmClient
}

// GetSystemPrompt 获取系统提示词
func (s *Sage) GetSystemPrompt() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.systemPrompt
}

// GetTools 获取工具列表
func (s *Sage) GetTools() []openai.Tool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.tools
}

// PrependToContext 在上下文开头插入消息
func (s *Sage) PrependToContext(msg types.ContextMessage) {
	s.mu.Lock()
	defer s.mu.Unlock()
	messages := s.contextManager.GetMessages()
	newMessages := make([]types.ContextMessage, 0, len(messages)+1)
	newMessages = append(newMessages, msg)
	newMessages = append(newMessages, messages...)
	s.contextManager.Clear()
	for _, m := range newMessages {
		s.contextManager.AddMessage(m)
	}
}

func (s *Sage) buildRequestMessages(history []types.ContextMessage) []types.ContextMessage {
	if !prompts.IsCoreSage(s.name) {
		return history
	}
	wakeup := prompts.BuildWakeupSequence(util.DataDir, s.name, s.profile)
	if len(wakeup) == 0 {
		return history
	}

	// 唤醒序列是固定前缀：只参与当前请求，不写入可裁剪历史。
	request := make([]types.ContextMessage, 0, len(history)+len(wakeup))
	if len(history) > 0 && history[0].Role == types.RoleSystem {
		request = append(request, history[0])
		request = append(request, wakeup...)
		request = append(request, history[1:]...)
		return request
	}
	request = append(request, wakeup...)
	request = append(request, history...)
	return request
}

// contextManagerImpl 上下文管理器实现
type contextManagerImpl struct {
	mu       sync.RWMutex
	messages []types.ContextMessage
	strategy *config.ContextStrategy
}

func newContextManager(strategy *config.ContextStrategy) *contextManagerImpl {
	return &contextManagerImpl{
		messages: make([]types.ContextMessage, 0),
		strategy: strategy,
	}
}

func (cm *contextManagerImpl) AddMessage(msg types.ContextMessage) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.messages = append(cm.messages, msg)
	cm.applyStrategyLocked()
}

func (cm *contextManagerImpl) GetMessages() []types.ContextMessage {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	result := make([]types.ContextMessage, len(cm.messages))
	copy(result, cm.messages)
	return result
}

func (cm *contextManagerImpl) Clear() {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.messages = make([]types.ContextMessage, 0)
}

func (cm *contextManagerImpl) ApplyStrategy(strategy *config.ContextStrategy) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.strategy = strategy
	cm.applyStrategyLocked()
}

func (cm *contextManagerImpl) applyStrategyLocked() {
	if cm.strategy == nil {
		return
	}

	if cm.strategy.Type == "message_count" && cm.strategy.Count > 0 {
		// 固定消息条数策略
		if len(cm.messages) > cm.strategy.Count {
			cm.messages = cm.messages[len(cm.messages)-cm.strategy.Count:]
		}
	}
	// token_percent策略暂不实现，需要token计数功能
}

// 工厂方法

// NewMelchior 创建Melchior实例
func NewMelchior(cfgManager *config.ConfigManager, client llm.Client) (*Sage, error) {
	cfg, ok := cfgManager.GetAgentConfig("melchior")
	if !ok {
		return nil, fmt.Errorf("melchior config not found")
	}

	strategy := cfgManager.GetContextStrategy("melchior")
	sage := NewSage("melchior", cfg, client, strategy)
	sage.profile = getPersonaProfileFromConfigManager(cfgManager)
	return sage, nil
}

// NewBalthazar 创建Balthazar实例
func NewBalthazar(cfgManager *config.ConfigManager, client llm.Client) (*Sage, error) {
	cfg, ok := cfgManager.GetAgentConfig("balthazar")
	if !ok {
		return nil, fmt.Errorf("balthazar config not found")
	}

	strategy := cfgManager.GetContextStrategy("balthazar")
	sage := NewSage("balthazar", cfg, client, strategy)
	sage.profile = getPersonaProfileFromConfigManager(cfgManager)
	return sage, nil
}

// NewCasper 创建Casper实例
func NewCasper(cfgManager *config.ConfigManager, client llm.Client) (*Sage, error) {
	cfg, ok := cfgManager.GetAgentConfig("casper")
	if !ok {
		return nil, fmt.Errorf("casper config not found")
	}

	strategy := cfgManager.GetContextStrategy("casper")
	sage := NewSage("casper", cfg, client, strategy)
	sage.profile = getPersonaProfileFromConfigManager(cfgManager)
	return sage, nil
}

// NewTrinity 创建Trinity实例
func NewTrinity(cfgManager *config.ConfigManager, client llm.Client) (*Sage, error) {
	cfg, ok := cfgManager.GetAgentConfig("trinity")
	if !ok {
		return nil, fmt.Errorf("trinity config not found")
	}

	strategy := cfgManager.GetContextStrategy("trinity")
	sage := NewSage("trinity", cfg, client, strategy)
	sage.profile = getPersonaProfileFromConfigManager(cfgManager)
	return sage, nil
}

func getPersonaProfileFromConfigManager(cfgManager *config.ConfigManager) *marduk.IpipPersonaProfile {
	if cfgManager == nil {
		return nil
	}

	raw := cfgManager.GetPersonaProfile()
	if profile, ok := raw.(*marduk.IpipPersonaProfile); ok {
		return profile
	}
	return nil
}
