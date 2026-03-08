// Package coordinator 定义MAGI会话协调相关类型
package coordinator

import (
	"sync"
	"time"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// SessionStatus 会话状态
type SessionStatus string

const (
	SessionStatusActive    SessionStatus = "active"
	SessionStatusIdle      SessionStatus = "idle"
	SessionStatusCompleted SessionStatus = "completed"
	SessionStatusError     SessionStatus = "error"
)

// RoundStatus 轮次状态
type RoundStatus string

const (
	RoundStatusStarted    RoundStatus = "started"
	RoundStatusCollecting RoundStatus = "collecting" // 收集贤者响应中
	RoundStatusVoting     RoundStatus = "voting"     // 投票中
	RoundStatusSynthesis  RoundStatus = "synthesis"  // Trinity统合中
	RoundStatusCompleted  RoundStatus = "completed"
	RoundStatusFailed     RoundStatus = "failed"
)

// Session MAGI会话（并发安全）
type Session struct {
	ID           string                 `json:"id"`
	Status       SessionStatus          `json:"status"`
	CreatedAt    time.Time              `json:"createdAt"`
	LastActiveAt time.Time              `json:"lastActiveAt"`
	CurrentRound *Round                 `json:"currentRound,omitempty"`
	History      []types.ContextMessage `json:"history"` // 全局历史
	mu           sync.RWMutex           // 保护并发访问
}

// Round 决策轮次
type Round struct {
	ID               string               `json:"id"`
	SessionID        string               `json:"sessionId"`
	Status           RoundStatus          `json:"status"`
	UserInput        string               `json:"userInput"`
	StartedAt        time.Time            `json:"startedAt"`
	CompletedAt      *time.Time           `json:"completedAt,omitempty"`
	SageResponses    []types.SageResponse `json:"sageResponses,omitempty"`
	VoteResult       *types.VoteResult    `json:"voteResult,omitempty"`
	TrinityResponse  string               `json:"trinityResponse,omitempty"`
	ConsensusContent string               `json:"consensusContent,omitempty"`
	Error            string               `json:"error,omitempty"`
}

// AgentContext Agent上下文（每个Agent独立维护）
type AgentContext struct {
	AgentName string                 `json:"agentName"`
	Messages  []types.ContextMessage `json:"messages"`
	mu        sync.RWMutex
}

// NewSession 创建新会话
func NewSession(id string) *Session {
	now := time.Now()
	return &Session{
		ID:           id,
		Status:       SessionStatusActive,
		CreatedAt:    now,
		LastActiveAt: now,
		History:      make([]types.ContextMessage, 0),
	}
}

// NewRound 创建新轮次
func NewRound(sessionID, roundID, userInput string) *Round {
	return &Round{
		ID:            roundID,
		SessionID:     sessionID,
		Status:        RoundStatusStarted,
		UserInput:     userInput,
		StartedAt:     time.Now(),
		SageResponses: make([]types.SageResponse, 0, 3),
	}
}

// AddMessage 添加消息到会话历史（并发安全）
func (s *Session) AddMessage(msg types.ContextMessage) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.History = append(s.History, msg)
	s.LastActiveAt = time.Now()
}

// GetHistory 获取会话历史（并发安全）
func (s *Session) GetHistory() []types.ContextMessage {
	s.mu.RLock()
	defer s.mu.RUnlock()
	history := make([]types.ContextMessage, len(s.History))
	copy(history, s.History)
	return history
}

// UpdateStatus 更新会话状态（并发安全）
func (s *Session) UpdateStatus(status SessionStatus) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Status = status
	s.LastActiveAt = time.Now()
}

// NewAgentContext 创建Agent上下文
func NewAgentContext(agentName string) *AgentContext {
	return &AgentContext{
		AgentName: agentName,
		Messages:  make([]types.ContextMessage, 0),
	}
}

// AddMessage 添加消息到Agent上下文（并发安全）
func (ac *AgentContext) AddMessage(msg types.ContextMessage) {
	ac.mu.Lock()
	defer ac.mu.Unlock()
	ac.Messages = append(ac.Messages, msg)
}

// GetMessages 获取Agent消息历史（并发安全）
func (ac *AgentContext) GetMessages() []types.ContextMessage {
	ac.mu.RLock()
	defer ac.mu.RUnlock()
	messages := make([]types.ContextMessage, len(ac.Messages))
	copy(messages, ac.Messages)
	return messages
}

// TrimToSize 裁剪消息历史到指定大小（并发安全）
func (ac *AgentContext) TrimToSize(size int) {
	ac.mu.Lock()
	defer ac.mu.Unlock()
	if len(ac.Messages) > size {
		ac.Messages = ac.Messages[len(ac.Messages)-size:]
	}
}
