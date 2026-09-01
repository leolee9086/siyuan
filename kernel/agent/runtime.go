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

package agent

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"github.com/88250/gulu"
	"github.com/siyuan-note/filelock"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const (
	toolNotExecutedResult = "Tool was not executed because the turn was interrupted."
	toolUnknownResult     = "Tool execution was interrupted; the result is unknown. Do not retry automatically."
	// AgentPermissionConfirm 每轮需用户确认工具调用；AgentPermissionAllowSession 整个会话放行。
	AgentPermissionConfirm      = "confirm"
	AgentPermissionAllowSession = "allowSession"
	AgentEventPermission        = "permission"
)

type agentRuntime struct {
	SchemaVersion  int                `json:"schemaVersion"`
	Revision       int64              `json:"revision"`
	SessionID      string             `json:"sessionID"`
	PermissionMode string             `json:"permissionMode,omitempty"`
	AlwaysAllow    bool               `json:"alwaysAllow,omitempty"`
	ActiveTurn     *agentRuntimeTurn  `json:"activeTurn,omitempty"`
	Compaction     *runtimeCompaction `json:"compaction,omitempty"`
}

// sessionPermissionController 是会话级权限模式的运行期视图，供确认等待路径查询是否整轮放行。
type sessionPermissionController struct {
	allowSession atomic.Bool
}

var sessionPermissionControllers sync.Map

func validAgentPermissionMode(mode string) bool {
	return mode == AgentPermissionConfirm || mode == AgentPermissionAllowSession
}

// resolveSessionPermissionModeLocked 解析会话的权限模式：runtime.permissionMode > runtime.alwaysAllow（旧机制）
// > session.json.permissionMode > session.json.alwaysAllow（旧机制）> 默认 confirm。
func resolveSessionPermissionModeLocked(sessionID string, session map[string]any) (string, error) {
	runtime, err := loadRuntimeLocked(sessionID)
	if err != nil {
		return "", err
	}
	if runtime.PermissionMode != "" {
		if !validAgentPermissionMode(runtime.PermissionMode) {
			return "", fmt.Errorf("invalid agent permission mode")
		}
		return runtime.PermissionMode, nil
	}
	if runtime.AlwaysAllow {
		return AgentPermissionAllowSession, nil
	}
	if session == nil {
		data, readErr := os.ReadFile(filepath.Join(sessionsDir(), sessionID, "session.json"))
		if readErr != nil {
			return "", readErr
		}
		session = map[string]any{}
		if unmarshalErr := gulu.JSON.UnmarshalJSON(data, &session); unmarshalErr != nil {
			return "", unmarshalErr
		}
	}
	if permissionMode, _ := session["permissionMode"].(string); permissionMode != "" {
		if !validAgentPermissionMode(permissionMode) {
			return "", fmt.Errorf("invalid agent permission mode")
		}
		return permissionMode, nil
	}
	if alwaysAllow, _ := session["alwaysAllow"].(bool); alwaysAllow {
		return AgentPermissionAllowSession, nil
	}
	return AgentPermissionConfirm, nil
}

func registerSessionPermissionController(sessionID string) (*sessionPermissionController, error) {
	controller := &sessionPermissionController{}
	if sessionID == "" {
		return controller, nil
	}
	if !isValidSessionID(sessionID) {
		return nil, fmt.Errorf("invalid session id")
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()
	mode, err := resolveSessionPermissionModeLocked(sessionID, nil)
	if err != nil {
		return nil, err
	}
	controller.allowSession.Store(mode == AgentPermissionAllowSession)
	sessionPermissionControllers.Store(sessionID, controller)
	return controller, nil
}

func unregisterSessionPermissionController(sessionID string, controller *sessionPermissionController) {
	if sessionID == "" || controller == nil {
		return
	}
	sessionPermissionControllers.CompareAndDelete(sessionID, controller)
}

// SetSessionPermissionMode 切换会话权限模式并同步运行期控制器。
func SetSessionPermissionMode(sessionID, mode string) error {
	if sessionID == "" || !isValidSessionID(sessionID) {
		return fmt.Errorf("invalid session id")
	}
	if !validAgentPermissionMode(mode) {
		return fmt.Errorf("invalid agent permission mode")
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()
	if _, err := os.Stat(filepath.Join(sessionsDir(), sessionID, "session.json")); err != nil {
		return err
	}
	runtime, err := loadRuntimeLocked(sessionID)
	if err != nil {
		return err
	}
	runtime.PermissionMode = mode
	runtime.AlwaysAllow = false
	if err = writeRuntimeLocked(sessionID, runtime); err != nil {
		return err
	}
	if value, ok := sessionPermissionControllers.Load(sessionID); ok {
		value.(*sessionPermissionController).allowSession.Store(mode == AgentPermissionAllowSession)
	}
	return nil
}

type agentRuntimeTurn struct {
	TurnID            string         `json:"turnID"`
	Mode              string         `json:"mode"`
	UserEntryID       string         `json:"userEntryID"`
	TargetUserEntryID string         `json:"targetUserEntryID,omitempty"`
	UserContent       string         `json:"userContent,omitempty"`
	UserBlockHTML     *string        `json:"userBlockHTML,omitempty"`
	UserReferences    *[]Reference   `json:"userReferences,omitempty"`
	UserEditorContext *EditorContext `json:"userEditorContext,omitempty"`
	BaseRevision      int64          `json:"baseRevision"`
	State             string         `json:"state"`
	Delta             []AgentMessage `json:"delta,omitempty"`
	DraftContent      string         `json:"draftContent,omitempty"`
	DraftRoundID      string         `json:"draftRoundID,omitempty"`
	SnapshotIDs       []string       `json:"snapshotIDs,omitempty"`
	PromptTokens      int            `json:"promptTokens,omitempty"`
	CompletionTokens  int            `json:"completionTokens,omitempty"`
	LastPromptTokens  int            `json:"lastPromptTokens,omitempty"`
	CachedTokens      int            `json:"cachedTokens,omitempty"`
	ContextLimit      int            `json:"contextLimit,omitempty"`
	TokenBreakdown    map[string]int `json:"tokenBreakdown,omitempty"`
	UpdatedAt         int64          `json:"updatedAt"`
}

type runtimeCompaction struct {
	Version              int               `json:"version"`
	Protocol             string            `json:"protocol,omitempty"`
	Summary              string            `json:"summary"`
	ResponseOutput       []json.RawMessage `json:"responseOutput,omitempty"`
	ResponseOutputTokens int               `json:"responseOutputTokens,omitempty"`
	CoveredEntryCount    int               `json:"coveredEntryCount"`
	NextEntryID          string            `json:"nextEntryID"`
	CoveredDigest        string            `json:"coveredDigest"`
	UpdatedAt            int64             `json:"updatedAt"`
}

// cloneRuntimeCompaction 深拷贝 compaction 的响应输出字段，避免调用方修改共享切片。
func cloneRuntimeCompaction(compaction *runtimeCompaction) *runtimeCompaction {
	if compaction == nil {
		return nil
	}
	cloned := *compaction
	cloned.ResponseOutput = util.CloneOpenAIResponseOutput(compaction.ResponseOutput)
	return &cloned
}

func runtimePath(sessionID string) string {
	return filepath.Join(sessionsDir(), sessionID, "runtime.json")
}

func loadRuntimeLocked(sessionID string) (*agentRuntime, error) {
	data, err := os.ReadFile(runtimePath(sessionID))
	if err != nil {
		if os.IsNotExist(err) {
			return &agentRuntime{SchemaVersion: 1, SessionID: sessionID}, nil
		}
		return nil, err
	}
	var runtime agentRuntime
	if err := gulu.JSON.UnmarshalJSON(data, &runtime); err != nil {
		return nil, err
	}
	if runtime.SchemaVersion > 1 {
		return nil, fmt.Errorf("unsupported agent runtime schema version: %d", runtime.SchemaVersion)
	}
	if runtime.SessionID != "" && runtime.SessionID != sessionID {
		return nil, fmt.Errorf("agent runtime session id mismatch")
	}
	if runtime.Revision < 0 {
		return nil, fmt.Errorf("invalid agent runtime revision")
	}
	if runtime.ActiveTurn != nil {
		if runtime.ActiveTurn.TurnID == "" {
			return nil, fmt.Errorf("invalid agent runtime turn id")
		}
		switch runtime.ActiveTurn.State {
		case "running", "finished", "interrupted":
		default:
			return nil, fmt.Errorf("invalid agent runtime turn state")
		}
	}
	if runtime.SchemaVersion == 0 {
		runtime.SchemaVersion = 1
	}
	if runtime.SessionID == "" {
		runtime.SessionID = sessionID
	}
	return &runtime, nil
}

func writeRuntimeLocked(sessionID string, runtime *agentRuntime) error {
	if runtime == nil {
		return nil
	}
	// runtime 只能附着在已经存在的会话上，避免迟到的 checkpoint 复活已删除会话。
	if _, err := os.Stat(filepath.Join(sessionsDir(), sessionID, "session.json")); err != nil {
		return err
	}
	runtime.SchemaVersion = 1
	runtime.SessionID = sessionID
	runtime.Revision++
	data, err := gulu.JSON.MarshalIndentJSON(runtime, "", "\t")
	if err != nil {
		return err
	}
	return filelock.WriteFile(runtimePath(sessionID), data)
}

func beginRuntimeTurn(sessionID string, turn *agentRuntimeTurn, alwaysAllowValues ...bool) error {
	alwaysAllow := len(alwaysAllowValues) > 0 && alwaysAllowValues[0]
	if sessionID == "" || turn == nil {
		return nil
	}
	if !isValidSessionID(sessionID) {
		return fmt.Errorf("invalid session id")
	}
	if turn.TurnID == "" || turn.State != "running" {
		return fmt.Errorf("invalid agent runtime turn")
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()
	runtime, err := loadRuntimeLocked(sessionID)
	if err != nil {
		return err
	}
	if runtime.ActiveTurn != nil && runtime.ActiveTurn.TurnID != turn.TurnID {
		committed, err := isTurnCommittedLocked(sessionID, runtime.ActiveTurn.TurnID)
		if err != nil {
			return err
		}
		if !committed {
			return fmt.Errorf("agent session has an uncommitted turn")
		}
		runtime.ActiveTurn = nil
	}
	data, err := os.ReadFile(filepath.Join(sessionsDir(), sessionID, "session.json"))
	if err != nil {
		return err
	}
	var session map[string]any
	if err := gulu.JSON.UnmarshalJSON(data, &session); err != nil {
		return err
	}
	if turn.BaseRevision >= 0 && numberToInt64(session["revision"]) != turn.BaseRevision {
		return ErrSessionConflict
	}
	if findRuntimeUserAnchor(session, turn.UserEntryID) < 0 {
		return fmt.Errorf("agent runtime user entry not found")
	}
	runtime.AlwaysAllow = runtime.AlwaysAllow || alwaysAllow
	runtime.ActiveTurn = turn
	return writeRuntimeLocked(sessionID, runtime)
}

func isTurnCommittedLocked(sessionID, turnID string) (bool, error) {
	data, err := os.ReadFile(filepath.Join(sessionsDir(), sessionID, "session.json"))
	if err != nil {
		return false, err
	}
	var meta sessionMeta
	if err := gulu.JSON.UnmarshalJSON(data, &meta); err != nil {
		return false, err
	}
	return meta.LastCommittedTurnID == turnID, nil
}

func saveRuntimeTurn(sessionID string, turn *agentRuntimeTurn, alwaysAllowValues ...bool) error {
	alwaysAllow := len(alwaysAllowValues) > 0 && alwaysAllowValues[0]
	if sessionID == "" || turn == nil {
		return nil
	}
	if !isValidSessionID(sessionID) {
		return fmt.Errorf("invalid session id")
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()
	committed, err := isTurnCommittedLocked(sessionID, turn.TurnID)
	if err != nil {
		return err
	}
	if committed {
		return nil
	}
	runtime, err := loadRuntimeLocked(sessionID)
	if err != nil {
		return err
	}
	if runtime.ActiveTurn != nil && runtime.ActiveTurn.TurnID != turn.TurnID {
		return fmt.Errorf("agent runtime turn changed")
	}
	runtime.AlwaysAllow = runtime.AlwaysAllow || alwaysAllow
	turn.UpdatedAt = time.Now().UnixMilli()
	runtime.ActiveTurn = turn
	return writeRuntimeLocked(sessionID, runtime)
}

func loadRuntimeState(sessionID string) (*agentRuntime, error) {
	if sessionID == "" || !isValidSessionID(sessionID) {
		return nil, nil
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()
	return loadRuntimeLocked(sessionID)
}

// saveRuntimeCompaction 持久化上下文压缩结果到 runtime，供后续 checkpoint 恢复时直接复用。
func saveRuntimeCompaction(sessionID string, compaction *runtimeCompaction) error {
	if sessionID == "" || compaction == nil {
		return errContextCannotBeCompacted
	}
	if !isValidSessionID(sessionID) {
		return fmt.Errorf("invalid session id")
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()
	runtime, err := loadRuntimeLocked(sessionID)
	if err != nil {
		return err
	}
	runtime.Compaction = cloneRuntimeCompaction(compaction)
	return writeRuntimeLocked(sessionID, runtime)
}

func FinalizeOrphanedTurn(sessionID string) error {
	if sessionID == "" || !isValidSessionID(sessionID) {
		return nil
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()
	runtime, err := loadRuntimeLocked(sessionID)
	if err != nil || runtime.ActiveTurn == nil || runtime.ActiveTurn.State != "running" {
		return err
	}
	runtime.ActiveTurn.State = "interrupted"
	runtime.ActiveTurn.UpdatedAt = time.Now().UnixMilli()
	return writeRuntimeLocked(sessionID, runtime)
}

func HasUncommittedTurn(sessionID string) (bool, error) {
	if sessionID == "" || !isValidSessionID(sessionID) {
		return false, nil
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()
	runtime, err := loadRuntimeLocked(sessionID)
	if err != nil || runtime.ActiveTurn == nil {
		return false, err
	}
	committed, err := isTurnCommittedLocked(sessionID, runtime.ActiveTurn.TurnID)
	if err != nil {
		return false, err
	}
	return !committed, nil
}

func RecoverableTurnID(sessionID string) (string, error) {
	if sessionID == "" || !isValidSessionID(sessionID) {
		return "", nil
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()
	runtime, err := loadRuntimeLocked(sessionID)
	if err != nil || runtime.ActiveTurn == nil || !isRuntimeTurnTerminal(runtime.ActiveTurn) {
		return "", err
	}
	committed, err := isTurnCommittedLocked(sessionID, runtime.ActiveTurn.TurnID)
	if err != nil || committed {
		return "", err
	}
	return runtime.ActiveTurn.TurnID, nil
}

// IsTurnCommitted 返回指定 turn 是否已经写入 canonical session。
func IsTurnCommitted(sessionID, turnID string) (bool, error) {
	if sessionID == "" || turnID == "" || !isValidSessionID(sessionID) {
		return false, nil
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()
	return isTurnCommittedLocked(sessionID, turnID)
}

// RuntimeTurnRecoveryState 是执行器恢复所需的最小 runtime 只读视图。
type RuntimeTurnRecoveryState struct {
	TurnID    string
	State     string
	Committed bool
}

func InspectRuntimeTurnRecovery(sessionID string) (*RuntimeTurnRecoveryState, error) {
	if sessionID == "" || !isValidSessionID(sessionID) {
		return nil, nil
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()
	runtime, err := loadRuntimeLocked(sessionID)
	if err != nil || runtime.ActiveTurn == nil {
		return nil, err
	}
	committed, err := isTurnCommittedLocked(sessionID, runtime.ActiveTurn.TurnID)
	if err != nil {
		return nil, err
	}
	return &RuntimeTurnRecoveryState{
		TurnID:    runtime.ActiveTurn.TurnID,
		State:     runtime.ActiveTurn.State,
		Committed: committed,
	}, nil
}

func markRuntimeCommittedLocked(sessionID, turnID string) error {
	if turnID == "" {
		return nil
	}
	runtime, err := loadRuntimeLocked(sessionID)
	if err != nil {
		return err
	}
	if runtime.ActiveTurn == nil || runtime.ActiveTurn.TurnID != turnID {
		return nil
	}
	runtime.ActiveTurn = nil
	return writeRuntimeLocked(sessionID, runtime)
}

func isRuntimeTurnTerminal(turn *agentRuntimeTurn) bool {
	return turn != nil && (turn.State == "finished" || turn.State == "interrupted")
}

func findRuntimeUserAnchor(session map[string]any, userEntryID string) int {
	entries, _ := session["entries"].([]any)
	for i := len(entries) - 1; i >= 0; i-- {
		entry, _ := entries[i].(map[string]any)
		if entry["type"] != "user" {
			continue
		}
		id, _ := entry["id"].(string)
		if userEntryID == "" || id == userEntryID {
			return i
		}
	}
	return -1
}

func applyRuntimeTurnToSessionLocked(session map[string]any, turn *agentRuntimeTurn) error {
	if turn == nil {
		return nil
	}
	entries, _ := session["entries"].([]any)
	anchor := findRuntimeUserAnchor(session, turn.UserEntryID)
	if anchor < 0 {
		return fmt.Errorf("agent runtime user entry not found")
	}
	if turn.Mode == "regenerate" && turn.UserContent != "" {
		entry, _ := entries[anchor].(map[string]any)
		entry["content"] = turn.UserContent
		if turn.UserBlockHTML != nil {
			if *turn.UserBlockHTML == "" {
				delete(entry, "blockHTML")
			} else {
				entry["blockHTML"] = *turn.UserBlockHTML
			}
		}
		if turn.UserReferences != nil {
			if len(*turn.UserReferences) > 0 {
				entry["references"] = *turn.UserReferences
			} else {
				delete(entry, "references")
			}
		}
		if turn.UserEditorContext != nil {
			entry["editorContext"] = turn.UserEditorContext
		} else {
			delete(entry, "editorContext")
		}
	}

	// 当前 turn 的 user/assistant 增量以 runtime 为权威；前端只补充 thinking/confirm/question 等 UI 条目。
	// steer 仍使用既有 SessionEntry user 结构，不引入新的上游会话字段。
	authoritative := make([]any, 0, len(turn.Delta)+1)
	for i, message := range turn.Delta {
		switch message.Role {
		case "user":
			entryID := message.EntryID
			if entryID == "" {
				entryID = fmt.Sprintf("runtime_user_%s_%d", turn.TurnID, i)
			}
			entry := map[string]any{
				"id":        entryID,
				"type":      "user",
				"content":   message.Content,
				"timestamp": turn.UpdatedAt,
			}
			if message.BlockHTML != "" {
				entry["blockHTML"] = message.BlockHTML
			}
			if len(message.References) > 0 {
				entry["references"] = append([]Reference(nil), message.References...)
			}
			if message.EditorContext != nil {
				entry["editorContext"] = cloneEditorContext(*message.EditorContext)
			}
			authoritative = append(authoritative, entry)
		case "assistant":
			entry := map[string]any{
				"id":        fmt.Sprintf("runtime_%s_%d", turn.TurnID, i),
				"type":      "assistant",
				"timestamp": turn.UpdatedAt,
			}
			if message.Content != "" {
				entry["content"] = message.Content
			}
			if message.ReasoningContent != "" {
				entry["reasoningContent"] = message.ReasoningContent
			}
			if len(message.ResponseOutput) > 0 {
				entry["responseOutput"] = util.CloneOpenAIResponseOutput(message.ResponseOutput)
			}
			if message.ResponseOutputTokens > 0 {
				entry["responseOutputTokens"] = message.ResponseOutputTokens
			}
			if message.RoundID != "" {
				entry["roundID"] = message.RoundID
			}
			if len(message.ToolCalls) > 0 {
				calls := make([]map[string]any, 0, len(message.ToolCalls))
				for _, call := range message.ToolCalls {
					result := call.Result
					if result == "" {
						if call.State == "pending" {
							result = toolNotExecutedResult
						} else {
							result = toolUnknownResult
						}
					}
					persistedCall := map[string]any{
						"name":      call.Name,
						"arguments": call.Arguments,
						"result":    result,
						"state":     call.State,
					}
					if call.ID != "" {
						persistedCall["id"] = call.ID
					}
					if call.ArgumentsJSON != "" {
						persistedCall["argumentsJSON"] = call.ArgumentsJSON
					}
					if len(call.Attachments) > 0 {
						persistedCall["attachments"] = append([]AgentAttachment(nil), call.Attachments...)
					}
					if call.ProviderData != nil {
						persistedCall["providerData"] = call.ProviderData
					}
					calls = append(calls, persistedCall)
				}
				entry["toolCalls"] = calls
			}
			authoritative = append(authoritative, entry)
		}
	}
	if turn.DraftContent != "" {
		draft := map[string]any{
			"id":        fmt.Sprintf("runtime_draft_%s", turn.TurnID),
			"type":      "assistant",
			"content":   turn.DraftContent,
			"timestamp": turn.UpdatedAt,
		}
		if turn.DraftRoundID != "" {
			draft["roundID"] = turn.DraftRoundID
		}
		authoritative = append(authoritative, draft)
	}

	// regenerate 在启动前已经把旧回答截断到目标 user，因此 user 之后的 UI 条目都属于当前 turn。
	merged := append([]any(nil), entries[:anchor+1]...)
	authoritativeIndex := 0
	for _, raw := range entries[anchor+1:] {
		entry, _ := raw.(map[string]any)
		typeName, _ := entry["type"].(string)
		switch typeName {
		case "user", "assistant":
			for authoritativeIndex < len(authoritative) {
				authoritativeEntry, _ := authoritative[authoritativeIndex].(map[string]any)
				authoritativeType, _ := authoritativeEntry["type"].(string)
				merged = append(merged, authoritative[authoritativeIndex])
				authoritativeIndex++
				if authoritativeType == typeName {
					break
				}
			}
		case "thinking", "confirm", "question", "snapshot", "rollback":
			merged = append(merged, raw)
		}
	}
	merged = append(merged, authoritative[authoritativeIndex:]...)

	existingSnapshots := map[string]bool{}
	for _, raw := range merged {
		entry, _ := raw.(map[string]any)
		if snapshotID, _ := entry["snapshotID"].(string); snapshotID != "" {
			existingSnapshots[snapshotID] = true
		}
	}
	for i, snapshotID := range turn.SnapshotIDs {
		if existingSnapshots[snapshotID] {
			continue
		}
		merged = append(merged, map[string]any{
			"id":         fmt.Sprintf("runtime_snapshot_%s_%d", turn.TurnID, i),
			"type":       "snapshot",
			"snapshotID": snapshotID,
		})
	}
	session["entries"] = merged
	if turn.PromptTokens > 0 || turn.CompletionTokens > 0 || turn.LastPromptTokens > 0 {
		session["promptTokens"] = turn.PromptTokens
		session["completionTokens"] = turn.CompletionTokens
		session["contextTokens"] = turn.LastPromptTokens
		session["contextCachedTokens"] = turn.CachedTokens
		session["contextLimit"] = turn.ContextLimit
		if len(turn.TokenBreakdown) > 0 {
			session["contextTokenBreakdown"] = turn.TokenBreakdown
		}
	}
	return nil
}

// mergeRuntimeIntoSessionLocked 仅在 API 返回值中叠加未提交 turn，不直接改写 session.json。
func mergeRuntimeIntoSessionLocked(sessionID string, session map[string]any) error {
	runtime, err := loadRuntimeLocked(sessionID)
	if err != nil {
		return err
	}
	if runtime.ActiveTurn == nil {
		return nil
	}
	turn := runtime.ActiveTurn
	if committed, _ := session["lastCommittedTurnID"].(string); committed == turn.TurnID {
		return nil
	}

	if err := applyRuntimeTurnToSessionLocked(session, turn); err != nil {
		return err
	}
	session["recoveryTurnID"] = turn.TurnID
	session["recoveryState"] = turn.State
	session["recoveryRevision"] = runtime.Revision
	return nil
}
