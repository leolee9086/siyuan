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
	"strings"
	"testing"
	"time"
)

func TestCreateSession(t *testing.T) {
	sm := NewSessionManager(30 * time.Minute)
	defer sm.Stop()

	session := sm.CreateSession("user123")

	if session.ID == "" {
		t.Error("会话ID不应为空")
	}
	if !strings.HasPrefix(session.ID, "magi-") {
		t.Errorf("会话ID应以magi-开头，实际: %s", session.ID)
	}
	if session.UserID != "user123" {
		t.Errorf("期望UserID=user123，实际: %s", session.UserID)
	}
	if session.Metadata == nil {
		t.Error("Metadata不应为nil")
	}
}

func TestGetSession(t *testing.T) {
	sm := NewSessionManager(30 * time.Minute)
	defer sm.Stop()

	session := sm.CreateSession("user123")

	retrieved, ok := sm.GetSession(session.ID)
	if !ok {
		t.Error("应该能获取到会话")
	}
	if retrieved.ID != session.ID {
		t.Error("获取的会话ID不匹配")
	}

	_, ok = sm.GetSession("nonexistent")
	if ok {
		t.Error("不存在的会话应该返回false")
	}
}

func TestUpdateActivity(t *testing.T) {
	sm := NewSessionManager(30 * time.Minute)
	defer sm.Stop()

	session := sm.CreateSession("user123")
	originalTime := session.LastActiveAt

	time.Sleep(10 * time.Millisecond)
	sm.UpdateActivity(session.ID)

	retrieved, _ := sm.GetSession(session.ID)
	if !retrieved.LastActiveAt.After(originalTime) {
		t.Error("LastActiveAt应该被更新")
	}
}

func TestDeleteSession(t *testing.T) {
	sm := NewSessionManager(30 * time.Minute)
	defer sm.Stop()

	session := sm.CreateSession("user123")
	sm.DeleteSession(session.ID)

	_, ok := sm.GetSession(session.ID)
	if ok {
		t.Error("删除后不应该能获取到会话")
	}
}

func TestSessionCleanup(t *testing.T) {
	sm := NewSessionManager(100 * time.Millisecond)
	defer sm.Stop()

	session := sm.CreateSession("user123")

	time.Sleep(150 * time.Millisecond)
	sm.cleanup()

	_, ok := sm.GetSession(session.ID)
	if ok {
		t.Error("超时会话应该被清理")
	}
}

func TestStartCleanup(t *testing.T) {
	sm := NewSessionManager(50 * time.Millisecond)
	sm.StartCleanup(100 * time.Millisecond)
	defer sm.Stop()

	session := sm.CreateSession("user123")

	time.Sleep(200 * time.Millisecond)

	_, ok := sm.GetSession(session.ID)
	if ok {
		t.Error("自动清理应该删除超时会话")
	}
}

func TestGenerateSessionID(t *testing.T) {
	id1 := generateSessionID()
	id2 := generateSessionID()

	if id1 == id2 {
		t.Error("生成的会话ID应该唯一")
	}
	if !strings.HasPrefix(id1, "magi-") {
		t.Errorf("会话ID应以magi-开头，实际: %s", id1)
	}
}
