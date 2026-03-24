// Package sages 提供MAGI贤者实例管理
package sages

import (
	"context"
	"fmt"
	"sync"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
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
	// 会话感知方法
	AddMessageWithSession(sessionId string, msg types.ContextMessage)
	GetMessagesForSession(sessionId string) []types.ContextMessage
	ClearSession(sessionId string)
}

// Sage 贤者实例
type Sage struct {
	mu              sync.RWMutex
	name            string
	displayName     string
	config          *config.AgentConfig
	llmClient       llm.Client
	contextManager  ContextManager
	systemPrompt    string
	tools           []openai.Tool
	toolChoice      any
	contextStrategy *config.ContextStrategy
	profile         *marduk.IpipPersonaProfile
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
		name:            name,
		displayName:     cfg.SEELConfig.Name,
		config:          cfg,
		llmClient:       client,
		contextManager:  cm,
		systemPrompt:    cfg.SystemPrompt,
		tools:           tools,
		toolChoice:      cfg.ToolChoice,
		contextStrategy: strategy,
	}
}

// SendMessage 发送消息并返回流式响应
func (s *Sage) SendMessage(ctx context.Context, sessionId, roundId, userInput string) (<-chan types.StreamChunk, error) {
	return s.sendMessageInternal(ctx, sessionId, roundId, userInput, true, nil, nil, false)
}

// SendContinuation 基于当前上下文继续对话（不追加新的 user 消息）。
func (s *Sage) SendContinuation(ctx context.Context, sessionId, roundId string) (<-chan types.StreamChunk, error) {
	return s.sendMessageInternal(ctx, sessionId, roundId, "", false, nil, nil, false)
}

// SendMessageWithRuntimeTools 使用临时工具集发送消息。
func (s *Sage) SendMessageWithRuntimeTools(
	ctx context.Context,
	sessionId, roundId, userInput string,
	runtimeTools []openai.Tool,
	runtimeToolChoice any,
) (<-chan types.StreamChunk, error) {
	return s.sendMessageInternal(ctx, sessionId, roundId, userInput, true, runtimeTools, runtimeToolChoice, true)
}

// SendContinuationWithRuntimeTools 使用临时工具集继续对话。
func (s *Sage) SendContinuationWithRuntimeTools(
	ctx context.Context,
	sessionId, roundId string,
	runtimeTools []openai.Tool,
	runtimeToolChoice any,
) (<-chan types.StreamChunk, error) {
	return s.sendMessageInternal(ctx, sessionId, roundId, "", false, runtimeTools, runtimeToolChoice, true)
}

func (s *Sage) sendMessageInternal(
	ctx context.Context,
	sessionId, roundId, userInput string,
	appendUserInput bool,
	runtimeTools []openai.Tool,
	runtimeToolChoice any,
	overrideRuntimeTools bool,
) (<-chan types.StreamChunk, error) {
	s.mu.Lock()

	// 添加系统提示词（如果上下文为空）
	messages := s.contextManager.GetMessagesForSession(sessionId)
	if len(messages) == 0 && s.systemPrompt != "" {
		s.addMessageWithSessionLocked(sessionId, roundId, types.ContextMessage{
			Role:    types.RoleSystem,
			Content: s.systemPrompt,
		})
	}

	// 添加用户消息
	if appendUserInput {
		s.addMessageWithSessionLocked(sessionId, roundId, types.ContextMessage{
			Role:    types.RoleUser,
			Content: userInput,
		})
	}

	messages = s.contextManager.GetMessagesForSession(sessionId)
	requestMessages := s.buildRequestMessages(messages)
	requestTools := s.tools
	requestToolChoice := s.toolChoice
	if overrideRuntimeTools {
		requestTools = append([]openai.Tool(nil), runtimeTools...)
		requestToolChoice = runtimeToolChoice
	}
	s.mu.Unlock()

	// 推送LLM请求事件
	if sessionId != "" && roundId != "" {
		model := s.llmClient.GetModel()
		toolCount := len(requestTools)
		_ = websocket.PushLLMRequestSent(websocket.RuntimeMonitorSessionID, roundId, s.name, s.displayName, model, requestMessages, toolCount)
	}

	// 发送请求
	return s.llmClient.SendChatRequest(ctx, requestMessages, requestTools, requestToolChoice)
}

// AddToContext 添加消息到上下文（向后兼容，使用空sessionId）
func (s *Sage) AddToContext(msg types.ContextMessage) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.addMessageWithSessionLocked("", "", msg)
}

// AddToContextWithSession 添加消息到指定会话的上下文
func (s *Sage) AddToContextWithSession(sessionId string, msg types.ContextMessage) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.addMessageWithSessionLocked(sessionId, "", msg)
}

// GetContext 获取当前上下文（向后兼容，使用空sessionId）
func (s *Sage) GetContext() []types.ContextMessage {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.contextManager.GetMessages()
}

// GetContextForSession 获取指定会话的上下文
func (s *Sage) GetContextForSession(sessionId string) []types.ContextMessage {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.contextManager.GetMessagesForSession(sessionId)
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

// CloneWithFreshContext 基于当前 Sage 配置创建一个不携带历史的新实例。
// 用于像 Trinity 这类需要跨调用保持无状态、但单次调用内部仍需要临时上下文的场景。
func (s *Sage) CloneWithFreshContext() *Sage {
	if s == nil {
		return nil
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	var clonedContextManager ContextManager
	switch s.contextManager.(type) {
	case *multiSessionContextManager:
		clonedContextManager = newMultiSessionContextManager(s.contextStrategy)
	default:
		clonedContextManager = newContextManager(s.contextStrategy)
	}

	clonedTools := append([]openai.Tool(nil), s.tools...)

	return &Sage{
		name:            s.name,
		displayName:     s.displayName,
		config:          s.config,
		llmClient:       s.llmClient,
		contextManager:  clonedContextManager,
		systemPrompt:    s.systemPrompt,
		tools:           clonedTools,
		toolChoice:      s.toolChoice,
		contextStrategy: s.contextStrategy,
		profile:         s.profile,
	}
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

func (s *Sage) addMessageWithSessionLocked(sessionId, roundId string, msg types.ContextMessage) {
	beforeCount := len(s.contextManager.GetMessagesForSession(sessionId))
	s.contextManager.AddMessageWithSession(sessionId, msg)
	afterCount := len(s.contextManager.GetMessagesForSession(sessionId))

	droppedCount := beforeCount + 1 - afterCount
	if droppedCount <= 0 {
		return
	}
	if sessionId == "" {
		return
	}

	strategyType := ""
	strategyCount := 0
	strategyPercent := 0.0
	if s.contextStrategy != nil {
		strategyType = s.contextStrategy.Type
		strategyCount = s.contextStrategy.Count
		strategyPercent = s.contextStrategy.Percent
	}

	if err := websocket.PushContextHistoryTrimmed(
		websocket.RuntimeMonitorSessionID,
		roundId,
		s.name,
		s.displayName,
		beforeCount,
		afterCount,
		droppedCount,
		strategyType,
		strategyCount,
		strategyPercent,
	); err != nil {
		logging.LogWarnf("推送上下文裁剪事件失败: %v", err)
	}
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

// 会话感知方法实现（单一历史版本忽略sessionId）
func (cm *contextManagerImpl) AddMessageWithSession(sessionId string, msg types.ContextMessage) {
	cm.AddMessage(msg)
}

func (cm *contextManagerImpl) GetMessagesForSession(sessionId string) []types.ContextMessage {
	return cm.GetMessages()
}

func (cm *contextManagerImpl) ClearSession(sessionId string) {
	cm.Clear()
}

// multiSessionContextManager 多会话上下文管理器（用于Melchior）
type multiSessionContextManager struct {
	mu       sync.RWMutex
	sessions map[string][]types.ContextMessage
	strategy *config.ContextStrategy
}

func newMultiSessionContextManager(strategy *config.ContextStrategy) *multiSessionContextManager {
	return &multiSessionContextManager{
		sessions: make(map[string][]types.ContextMessage),
		strategy: strategy,
	}
}

func (mscm *multiSessionContextManager) AddMessageWithSession(sessionId string, msg types.ContextMessage) {
	mscm.mu.Lock()
	defer mscm.mu.Unlock()
	if mscm.sessions[sessionId] == nil {
		mscm.sessions[sessionId] = make([]types.ContextMessage, 0)
	}
	mscm.sessions[sessionId] = append(mscm.sessions[sessionId], msg)
	mscm.applyStrategyForSessionLocked(sessionId)
}

func (mscm *multiSessionContextManager) GetMessagesForSession(sessionId string) []types.ContextMessage {
	mscm.mu.RLock()
	defer mscm.mu.RUnlock()
	messages := mscm.sessions[sessionId]
	if messages == nil {
		return []types.ContextMessage{}
	}
	result := make([]types.ContextMessage, len(messages))
	copy(result, messages)
	return result
}

func (mscm *multiSessionContextManager) ClearSession(sessionId string) {
	mscm.mu.Lock()
	defer mscm.mu.Unlock()
	delete(mscm.sessions, sessionId)
}

func (mscm *multiSessionContextManager) applyStrategyForSessionLocked(sessionId string) {
	if mscm.strategy == nil {
		return
	}
	messages := mscm.sessions[sessionId]
	if mscm.strategy.Type == "message_count" && mscm.strategy.Count > 0 {
		if len(messages) > mscm.strategy.Count {
			mscm.sessions[sessionId] = messages[len(messages)-mscm.strategy.Count:]
		}
	}
}

// 向后兼容方法（使用空sessionId）
func (mscm *multiSessionContextManager) AddMessage(msg types.ContextMessage) {
	mscm.AddMessageWithSession("", msg)
}

func (mscm *multiSessionContextManager) GetMessages() []types.ContextMessage {
	return mscm.GetMessagesForSession("")
}

func (mscm *multiSessionContextManager) Clear() {
	mscm.mu.Lock()
	defer mscm.mu.Unlock()
	mscm.sessions = make(map[string][]types.ContextMessage)
}

func (mscm *multiSessionContextManager) ApplyStrategy(strategy *config.ContextStrategy) {
	mscm.mu.Lock()
	defer mscm.mu.Unlock()
	mscm.strategy = strategy
	for sessionId := range mscm.sessions {
		mscm.applyStrategyForSessionLocked(sessionId)
	}
}

// 工厂方法

// NewMelchior 创建Melchior实例（使用多会话历史管理）
func NewMelchior(cfgManager *config.ConfigManager, client llm.Client) (*Sage, error) {
	cfg, ok := cfgManager.GetAgentConfig("melchior")
	if !ok {
		return nil, fmt.Errorf("melchior config not found")
	}

	strategy := cfgManager.GetContextStrategy("melchior")

	// Melchior使用多会话ContextManager
	cm := newMultiSessionContextManager(strategy)

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

	sage := &Sage{
		name:            "melchior",
		displayName:     cfg.SEELConfig.Name,
		config:          cfg,
		llmClient:       client,
		contextManager:  cm,
		systemPrompt:    cfg.SystemPrompt,
		tools:           tools,
		toolChoice:      cfg.ToolChoice,
		contextStrategy: strategy,
	}
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
