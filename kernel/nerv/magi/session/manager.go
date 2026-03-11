// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package session

import (
	"fmt"
	"math/rand"
	"sync"
	"time"
)

// Session HTTP/WebSocket会话元数据
type Session struct {
	ID           string
	CreatedAt    time.Time
	LastActiveAt time.Time
	UserID       string
	Metadata     map[string]interface{}
}

// SessionManager 管理MAGI会话生命周期
type SessionManager struct {
	sessions sync.Map
	timeout  time.Duration
	stopChan chan struct{}
	wg       sync.WaitGroup
}

// NewSessionManager 创建会话管理器
func NewSessionManager(timeout time.Duration) *SessionManager {
	return &SessionManager{
		timeout:  timeout,
		stopChan: make(chan struct{}),
	}
}

// CreateSession 创建新会话
func (sm *SessionManager) CreateSession(userID string) *Session {
	return sm.CreateSessionWithID(generateSessionID(), userID)
}

// CreateSessionWithID 使用指定ID创建新会话。
func (sm *SessionManager) CreateSessionWithID(sessionID string, userID string) *Session {
	session := &Session{
		ID:           sessionID,
		CreatedAt:    time.Now(),
		LastActiveAt: time.Now(),
		UserID:       userID,
		Metadata:     make(map[string]interface{}),
	}
	sm.sessions.Store(session.ID, session)
	return session
}

// GetSession 获取会话
func (sm *SessionManager) GetSession(sessionID string) (*Session, bool) {
	value, ok := sm.sessions.Load(sessionID)
	if !ok {
		return nil, false
	}
	return value.(*Session), true
}

// UpdateActivity 更新会话活跃时间
func (sm *SessionManager) UpdateActivity(sessionID string) {
	if value, ok := sm.sessions.Load(sessionID); ok {
		session := value.(*Session)
		session.LastActiveAt = time.Now()
	}
}

// DeleteSession 删除会话
func (sm *SessionManager) DeleteSession(sessionID string) {
	sm.sessions.Delete(sessionID)
}

// StartCleanup 启动清理goroutine
func (sm *SessionManager) StartCleanup(interval time.Duration) {
	sm.wg.Add(1)
	go func() {
		defer sm.wg.Done()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				sm.cleanup()
			case <-sm.stopChan:
				return
			}
		}
	}()
}

// Stop 停止清理goroutine
func (sm *SessionManager) Stop() {
	close(sm.stopChan)
	sm.wg.Wait()
}

// cleanup 清理超时会话
func (sm *SessionManager) cleanup() {
	now := time.Now()
	sm.sessions.Range(func(key, value interface{}) bool {
		session := value.(*Session)
		if now.Sub(session.LastActiveAt) > sm.timeout {
			sm.sessions.Delete(key)
		}
		return true
	})
}

// generateSessionID 生成会话ID: magi-{timestamp}-{random}
func generateSessionID() string {
	timestamp := time.Now().UnixNano()
	random := rand.Int63()
	return fmt.Sprintf("magi-%d-%d", timestamp, random)
}
