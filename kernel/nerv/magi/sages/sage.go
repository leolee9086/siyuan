// Package sages 提供MAGI贤者实例管理
package sages

import (
	"context"
	"fmt"
	"sync"

	"github.com/88250/lute/ast"
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
	// UpdateMessage 按 msg.ID 匹配并更新指定会话中的消息内容。
	UpdateMessage(sessionId string, msg types.ContextMessage)
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
	cm := newContextManager(strategy, client.GetModel())

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

// UpdateLLMClient 热更新 LLM 客户端。切换 profile 时由外部调用。
func (s *Sage) UpdateLLMClient(client llm.Client) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.llmClient = client
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
		_ = s.addMessageWithSessionLocked(sessionId, roundId, types.ContextMessage{
			Role:    types.RoleSystem,
			Content: s.systemPrompt,
		})
	}

	// 添加用户消息
	if appendUserInput {
		_ = s.addMessageWithSessionLocked(sessionId, roundId, types.ContextMessage{
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

// AddToContext 添加消息到上下文并分配消息ID（向后兼容，使用空sessionId）
func (s *Sage) AddToContext(msg types.ContextMessage) types.ContextMessage {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.addMessageWithSessionLocked("", "", msg)
}

// AddToContextWithSession 添加消息到指定会话的上下文并分配消息ID
func (s *Sage) AddToContextWithSession(sessionId string, msg types.ContextMessage) types.ContextMessage {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.addMessageWithSessionLocked(sessionId, "", msg)
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

// UpdateContextMessage 按消息ID更新指定会话中的消息内容。
func (s *Sage) UpdateContextMessage(sessionId string, msg types.ContextMessage) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.contextManager.UpdateMessage(sessionId, msg)
}

// ClearContext 清空上下文
func (s *Sage) ClearContext() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.contextManager.Clear()
}

// ClearContextSession 清空指定会话的上下文（Melchior 多会话安全）。
func (s *Sage) ClearContextSession(sessionId string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.contextManager.ClearSession(sessionId)
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

// GetProfile 返回当前贤者绑定的人格档案。
func (s *Sage) GetProfile() *marduk.IpipPersonaProfile {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.profile
}

// SetProfile 绑定人格档案。
func (s *Sage) SetProfile(profile *marduk.IpipPersonaProfile) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.profile = profile
}

// GetSystemPrompt 获取系统提示词
func (s *Sage) GetSystemPrompt() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.systemPrompt
}

// GetFatigue 计算当前会话的疲劳值 (0-100)。
func (s *Sage) GetFatigue(sessionId string) float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	messages := s.contextManager.GetMessagesForSession(sessionId)
	return CalculateFatigue(messages, s.contextStrategy, s.llmClient.GetModel())
}

// GetWakefulness 计算当前会话的唤醒值 (0-100)。
func (s *Sage) GetWakefulness(sessionId string) float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	messages := s.contextManager.GetMessagesForSession(sessionId)
	return CalculateWakefulness(messages, s.contextStrategy, s.llmClient.GetModel())
}

// CloneWithFreshContext 基于当前 Sage 配置创建一个不携带历史的新实例。
// 用于统合型临时执行体这类需要跨调用保持无状态、但单次调用内部仍需要临时上下文的场景。
func (s *Sage) CloneWithFreshContext() *Sage {
	if s == nil {
		return nil
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	var clonedContextManager ContextManager
	modelName := s.llmClient.GetModel()
	switch s.contextManager.(type) {
	case *multiSessionContextManager:
		clonedContextManager = newMultiSessionContextManager(s.contextStrategy, modelName)
	default:
		clonedContextManager = newContextManager(s.contextStrategy, modelName)
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

// GetToolChoice 获取当前工具调用策略。
func (s *Sage) GetToolChoice() any {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.toolChoice
}

// BuildRequestMessagesForSession 构建带唤醒前缀的当前会话请求消息快照。
func (s *Sage) BuildRequestMessagesForSession(sessionId string, extraMessages ...types.ContextMessage) []types.ContextMessage {
	s.mu.RLock()
	defer s.mu.RUnlock()

	history := s.contextManager.GetMessagesForSession(sessionId)
	requestMessages := s.buildRequestMessages(history)
	result := make([]types.ContextMessage, 0, len(requestMessages)+len(extraMessages))
	result = append(result, cloneContextMessages(requestMessages)...)
	result = append(result, cloneContextMessages(extraMessages)...)
	return result
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

	// 计算 <status> 信封内容（疲劳度和唤醒值）。
	// 注意：status 属于动态内容，必须组装到消息序列尾部（本轮 user 消息），
	// 不能插入 system 之后，否则会破坏 LLM 前缀缓存（prefix cache）的稳定前缀。
	model := s.llmClient.GetModel()
	fatigueLevel := FatigueLevel(CalculateFatigue(history, s.contextStrategy, model))
	wakeLevel := WakefulnessLevel(CalculateWakefulness(history, s.contextStrategy, model))
	statusContent := fmt.Sprintf("<status>\n疲劳度: %s\n唤醒值: %s\n</status>", fatigueLevel, wakeLevel)

	wakeup := prompts.BuildWakeupSequence(util.DataDir, s.name, s.profile)
	request := make([]types.ContextMessage, 0, len(history)+len(wakeup)+1)

	// 固定前缀：system 提示词 + 唤醒序列（唤醒序列只参与当前请求，不写入可裁剪历史）。
	if len(history) > 0 && history[0].Role == types.RoleSystem {
		request = append(request, history[0])
	}
	request = append(request, wakeup...)

	// 历史正文（去掉 system 首条，避免与固定前缀重复）。
	historyTail := history
	if len(history) > 0 && history[0].Role == types.RoleSystem {
		historyTail = history[1:]
	}
	request = append(request, historyTail...)

	// 动态 <status> 组装到尾部 user 消息，保持稳定前缀逐字节不变。
	return appendStatusEnvelopeToTail(request, statusContent)
}

// appendStatusEnvelopeToTail 将 <status> 信封追加到请求序列的尾部 user 消息。
// 动态内容追加在 user 消息末尾，避免破坏 system + wakeup 组成的稳定前缀。
// 若请求序列中没有 user 消息（如 continuation 轮次），则作为独立 system 消息追加到末尾。
func appendStatusEnvelopeToTail(request []types.ContextMessage, statusContent string) []types.ContextMessage {
	for i := len(request) - 1; i >= 0; i-- {
		if request[i].Role == types.RoleUser {
			request[i].Content += "\n\n" + statusContent
			return request
		}
	}
	return append(request, types.ContextMessage{Role: types.RoleSystem, Content: statusContent})
}

func (s *Sage) addMessageWithSessionLocked(sessionId, roundId string, msg types.ContextMessage) types.ContextMessage {
	if msg.ID == "" {
		msg.ID = ast.NewNodeID()
	}
	if roundId != "" {
		msg.RoundID = roundId
	}
	beforeCount := len(s.contextManager.GetMessagesForSession(sessionId))
	s.contextManager.AddMessageWithSession(sessionId, msg)
	afterCount := len(s.contextManager.GetMessagesForSession(sessionId))

	droppedCount := beforeCount + 1 - afterCount
	if droppedCount <= 0 {
		return msg
	}
	if sessionId == "" {
		return msg
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
	return msg
}

func cloneContextMessages(messages []types.ContextMessage) []types.ContextMessage {
	if len(messages) == 0 {
		return nil
	}

	cloned := make([]types.ContextMessage, 0, len(messages))
	for _, msg := range messages {
		next := msg
		if len(msg.ToolCalls) > 0 {
			next.ToolCalls = append([]types.ToolCall(nil), msg.ToolCalls...)
		}
		if msg.Meta != nil {
			metaCopy := make(map[string]interface{}, len(msg.Meta))
			for key, value := range msg.Meta {
				metaCopy[key] = value
			}
			next.Meta = metaCopy
		}
		cloned = append(cloned, next)
	}
	return cloned
}

// contextManagerImpl 上下文管理器实现
type contextManagerImpl struct {
	mu              sync.RWMutex
	messages        []types.ContextMessage
	strategy        *config.ContextStrategy
	modelName       string
	lastRoundID     string
	dominantRounds  map[string]bool
	heartbeatRounds map[string]bool
}

func newContextManager(strategy *config.ContextStrategy, modelName string) *contextManagerImpl {
	return &contextManagerImpl{
		messages:        make([]types.ContextMessage, 0),
		strategy:        strategy,
		modelName:       modelName,
		dominantRounds:  make(map[string]bool),
		heartbeatRounds: make(map[string]bool),
	}
}

func (cm *contextManagerImpl) AddMessage(msg types.ContextMessage) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if msg.RoundID != "" {
		if cm.dominantRounds[msg.RoundID] {
			msg.Dominant = true
		}
		if cm.heartbeatRounds[msg.RoundID] {
			msg.Heartbeat = true
		}
	}

	roundChanged := msg.RoundID != "" && msg.RoundID != cm.lastRoundID
	if roundChanged {
		cm.lastRoundID = msg.RoundID
	}

	cm.messages = append(cm.messages, msg)
	cm.applyStrategyLocked(roundChanged)
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
	cm.lastRoundID = ""
	cm.dominantRounds = make(map[string]bool)
	cm.heartbeatRounds = make(map[string]bool)
}

func (cm *contextManagerImpl) ApplyStrategy(strategy *config.ContextStrategy) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.strategy = strategy
	cm.applyStrategyLocked(true)
}

func (cm *contextManagerImpl) applyStrategyLocked(roundChanged bool) {
	if cm.strategy == nil {
		return
	}

	if cm.strategy.Type == "message_count" && cm.strategy.Count > 0 {
		if len(cm.messages) > cm.strategy.Count {
			cm.messages = cm.messages[len(cm.messages)-cm.strategy.Count:]
		}
	}
	if cm.strategy.Type == "round_count" && cm.strategy.Count > 0 && roundChanged {
		cm.trimByRoundCount(cm.strategy.Count)
	}
	if cm.strategy.Type == "token_percent" && roundChanged {
		cm.trimByTokenPercent(cm.strategy.Percent)
	}
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

func (cm *contextManagerImpl) UpdateMessage(sessionId string, msg types.ContextMessage) {
	if msg.ID == "" {
		return
	}
	cm.mu.Lock()
	defer cm.mu.Unlock()
	for i := range cm.messages {
		if cm.messages[i].ID == msg.ID {
			cm.messages[i] = msg
			return
		}
	}
}

func (cm *contextManagerImpl) markRoundAttr(roundId string, dominant, heartbeat bool) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	if dominant {
		cm.dominantRounds[roundId] = true
	}
	if heartbeat {
		cm.heartbeatRounds[roundId] = true
	}
}

func (cm *contextManagerImpl) trimByRoundCount(maxRounds int) {
	if maxRounds <= 0 || len(cm.messages) == 0 {
		return
	}
	seen := make(map[string]bool)
	roundOrder := make([]string, 0)
	for i := len(cm.messages) - 1; i >= 0; i-- {
		rid := cm.messages[i].RoundID
		if rid == "" || seen[rid] {
			continue
		}
		seen[rid] = true
		roundOrder = append(roundOrder, rid)
	}
	if len(roundOrder) <= maxRounds {
		return
	}
	keepRounds := make(map[string]bool)
	for i := 0; i < maxRounds; i++ {
		keepRounds[roundOrder[i]] = true
	}
	filtered := make([]types.ContextMessage, 0, len(cm.messages))
	for _, msg := range cm.messages {
		if msg.Role == types.RoleSystem || msg.RoundID == "" || keepRounds[msg.RoundID] {
			filtered = append(filtered, msg)
		}
	}
	cm.messages = filtered
}

func (cm *contextManagerImpl) trimByTokenPercent(percent float64) {
	if percent <= 0 || percent > 100 || len(cm.messages) == 0 {
		return
	}
	cm.messages = trimByRoundTokenPercent(cm.messages, percent, cm.modelName)
}

// multiSessionContextManager 多会话上下文管理器（用于Melchior）
type multiSessionContextManager struct {
	mu              sync.RWMutex
	sessions        map[string][]types.ContextMessage
	strategy        *config.ContextStrategy
	modelName       string
	lastRoundID     map[string]string
	dominantRounds  map[string]map[string]bool
	heartbeatRounds map[string]map[string]bool
}

func newMultiSessionContextManager(strategy *config.ContextStrategy, modelName string) *multiSessionContextManager {
	return &multiSessionContextManager{
		sessions:        make(map[string][]types.ContextMessage),
		strategy:        strategy,
		modelName:       modelName,
		lastRoundID:     make(map[string]string),
		dominantRounds:  make(map[string]map[string]bool),
		heartbeatRounds: make(map[string]map[string]bool),
	}
}

func (mscm *multiSessionContextManager) AddMessageWithSession(sessionId string, msg types.ContextMessage) {
	mscm.mu.Lock()
	defer mscm.mu.Unlock()

	if msg.RoundID != "" {
		if mscm.dominantRounds[sessionId] != nil && mscm.dominantRounds[sessionId][msg.RoundID] {
			msg.Dominant = true
		}
		if mscm.heartbeatRounds[sessionId] != nil && mscm.heartbeatRounds[sessionId][msg.RoundID] {
			msg.Heartbeat = true
		}
	}

	roundChanged := msg.RoundID != "" && msg.RoundID != mscm.lastRoundID[sessionId]
	if roundChanged {
		mscm.lastRoundID[sessionId] = msg.RoundID
	}

	if mscm.sessions[sessionId] == nil {
		mscm.sessions[sessionId] = make([]types.ContextMessage, 0)
	}
	mscm.sessions[sessionId] = append(mscm.sessions[sessionId], msg)
	mscm.applyStrategyForSessionLocked(sessionId, roundChanged)
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
	delete(mscm.lastRoundID, sessionId)
	delete(mscm.dominantRounds, sessionId)
	delete(mscm.heartbeatRounds, sessionId)
}

func (mscm *multiSessionContextManager) UpdateMessage(sessionId string, msg types.ContextMessage) {
	if msg.ID == "" {
		return
	}
	mscm.mu.Lock()
	defer mscm.mu.Unlock()
	messages := mscm.sessions[sessionId]
	for i := range messages {
		if messages[i].ID == msg.ID {
			messages[i] = msg
			return
		}
	}
}

func (mscm *multiSessionContextManager) applyStrategyForSessionLocked(sessionId string, roundChanged bool) {
	if mscm.strategy == nil {
		return
	}
	messages := mscm.sessions[sessionId]
	if mscm.strategy.Type == "message_count" && mscm.strategy.Count > 0 {
		if len(messages) > mscm.strategy.Count {
			mscm.sessions[sessionId] = messages[len(messages)-mscm.strategy.Count:]
		}
	}
	if mscm.strategy.Type == "round_count" && mscm.strategy.Count > 0 && roundChanged {
		mscm.trimByRoundCount(sessionId, mscm.strategy.Count)
	}
	if mscm.strategy.Type == "token_percent" && roundChanged {
		mscm.trimByTokenPercent(sessionId, mscm.strategy.Percent)
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
	mscm.lastRoundID = make(map[string]string)
	mscm.dominantRounds = make(map[string]map[string]bool)
	mscm.heartbeatRounds = make(map[string]map[string]bool)
}

func (mscm *multiSessionContextManager) ApplyStrategy(strategy *config.ContextStrategy) {
	mscm.mu.Lock()
	defer mscm.mu.Unlock()
	mscm.strategy = strategy
	for sessionId := range mscm.sessions {
		mscm.applyStrategyForSessionLocked(sessionId, true)
	}
}

func (mscm *multiSessionContextManager) markRoundAttr(sessionId, roundId string, dominant, heartbeat bool) {
	mscm.mu.Lock()
	defer mscm.mu.Unlock()
	if dominant {
		if mscm.dominantRounds[sessionId] == nil {
			mscm.dominantRounds[sessionId] = make(map[string]bool)
		}
		mscm.dominantRounds[sessionId][roundId] = true
	}
	if heartbeat {
		if mscm.heartbeatRounds[sessionId] == nil {
			mscm.heartbeatRounds[sessionId] = make(map[string]bool)
		}
		mscm.heartbeatRounds[sessionId][roundId] = true
	}
}

func (mscm *multiSessionContextManager) trimByRoundCount(sessionId string, maxRounds int) {
	messages := mscm.sessions[sessionId]
	if maxRounds <= 0 || len(messages) == 0 {
		return
	}
	seen := make(map[string]bool)
	roundOrder := make([]string, 0)
	for i := len(messages) - 1; i >= 0; i-- {
		rid := messages[i].RoundID
		if rid == "" || seen[rid] {
			continue
		}
		seen[rid] = true
		roundOrder = append(roundOrder, rid)
	}
	if len(roundOrder) <= maxRounds {
		return
	}
	keepRounds := make(map[string]bool)
	for i := 0; i < maxRounds; i++ {
		keepRounds[roundOrder[i]] = true
	}
	filtered := make([]types.ContextMessage, 0, len(messages))
	for _, msg := range messages {
		if msg.Role == types.RoleSystem || msg.RoundID == "" || keepRounds[msg.RoundID] {
			filtered = append(filtered, msg)
		}
	}
	mscm.sessions[sessionId] = filtered
}

func (mscm *multiSessionContextManager) trimByTokenPercent(sessionId string, percent float64) {
	messages := mscm.sessions[sessionId]
	if percent <= 0 || percent > 100 || len(messages) == 0 {
		return
	}
	mscm.sessions[sessionId] = trimByRoundTokenPercent(messages, percent, mscm.modelName)
}

// MarkCurrentRoundDominant 将指定会话的当前轮次标记为支配轮，后续该轮次的
// 消息入库时会自动带上 Dominant 标记，供策略检索时优先保留。
func (s *Sage) MarkCurrentRoundDominant(sessionId, roundId string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if mscm, ok := s.contextManager.(*multiSessionContextManager); ok {
		mscm.markRoundAttr(sessionId, roundId, true, false)
	} else if cm, ok := s.contextManager.(*contextManagerImpl); ok {
		cm.markRoundAttr(roundId, true, false)
	}
}

// MarkCurrentRoundHeartbeat 将指定会话的当前轮次标记为心跳轮，后续该轮次的
// 消息入库时会自动带上 Heartbeat 标记，供策略检索时优先保留。
func (s *Sage) MarkCurrentRoundHeartbeat(sessionId, roundId string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if mscm, ok := s.contextManager.(*multiSessionContextManager); ok {
		mscm.markRoundAttr(sessionId, roundId, false, true)
	} else if cm, ok := s.contextManager.(*contextManagerImpl); ok {
		cm.markRoundAttr(roundId, false, true)
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
	cm := newMultiSessionContextManager(strategy, client.GetModel())

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
