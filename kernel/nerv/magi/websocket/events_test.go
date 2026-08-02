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

package websocket

import (
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func TestPushRoundStarted(t *testing.T) {
	err := PushRoundStarted("test-session", "round-1", "测试输入")
	if err != nil {
		t.Errorf("PushRoundStarted() error = %v", err)
	}
}

func TestPushSeelReplyStarted(t *testing.T) {
	msg := &types.Message{
		ID:        "melchior-123",
		Type:      types.TypeMelchior,
		Content:   "",
		Status:    types.StatusStreaming,
		Timestamp: 1234567890,
	}
	err := PushSeelReplyStarted("test-session", "round-1", "melchior", "Melchior", "测试输入", msg)
	if err != nil {
		t.Errorf("PushSeelReplyStarted() error = %v", err)
	}
}

func TestPushSeelReplyChunk(t *testing.T) {
	msg := &types.Message{
		ID:        "melchior-123",
		Type:      types.TypeMelchior,
		Content:   "部分内容",
		Status:    types.StatusStreaming,
		Timestamp: 1234567890,
	}
	err := PushSeelReplyChunk("test-session", "round-1", "melchior", "Melchior", msg)
	if err != nil {
		t.Errorf("PushSeelReplyChunk() error = %v", err)
	}
}

func TestPushSeelReplyCompleted(t *testing.T) {
	msg := &types.Message{
		ID:        "melchior-123",
		Type:      types.TypeMelchior,
		Content:   "完整内容",
		Status:    types.StatusSuccess,
		Timestamp: 1234567890,
		Meta: map[string]interface{}{
			"requiresDeliberation": true,
			"reason":               "需要审慎决策",
		},
	}
	err := PushSeelReplyCompleted("test-session", "round-1", "melchior", "Melchior", msg)
	if err != nil {
		t.Errorf("PushSeelReplyCompleted() error = %v", err)
	}
}

func TestPushSeelReplyFailed(t *testing.T) {
	err := PushSeelReplyFailed("test-session", "round-1", "balthazar", "Balthazar", "请求超时")
	if err != nil {
		t.Errorf("PushSeelReplyFailed() error = %v", err)
	}
}

func TestPushSeelToolActivityUpdated(t *testing.T) {
	call := types.ToolCall{
		ID:    "tool-activity-1",
		Index: 2,
		Type:  "function",
		Function: types.ToolCallFunction{
			Name:      "note_keyword_search",
			Arguments: `{"query":"缓存"}`,
		},
	}
	err := PushSeelToolActivityUpdated(
		"test-session", "round-1", "melchior", "Melchior", call,
		"completed", `{"matchedBlockCount":1}`, "",
	)
	if err != nil {
		t.Errorf("PushSeelToolActivityUpdated() error = %v", err)
	}
}

func TestPushVotingStart(t *testing.T) {
	err := PushVotingStart("test-session", "round-1", "提议的行动方案", 1, "melchior", "Melchior", "需要进一步复核风险")
	if err != nil {
		t.Errorf("PushVotingStart() error = %v", err)
	}
}

func TestPushVotingProgress(t *testing.T) {
	err := PushVotingProgress("test-session", "round-1", "balthazar", "Balthazar", types.VoteApprove, "证据充分", 50, 1)
	if err != nil {
		t.Errorf("PushVotingProgress() error = %v", err)
	}
}

func TestPushVotingResult(t *testing.T) {
	details := []VoteDetail{
		{Name: "Balthazar", Decision: "批准", Reason: "执行风险可控"},
		{Name: "Casper", Decision: "批准", Reason: "直觉上可行"},
	}
	err := PushVotingResult("test-session", "round-1", details, true, "写入工作日志", 1, "melchior", "需要留痕")
	if err != nil {
		t.Errorf("PushVotingResult() error = %v", err)
	}
}

func TestPushVotingFailed(t *testing.T) {
	err := PushVotingFailed("test-session", "round-1", "投票超时", 50)
	if err != nil {
		t.Errorf("PushVotingFailed() error = %v", err)
	}
}

func TestPushDominantSynthesisCompleted(t *testing.T) {
	err := PushDominantSynthesisCompleted("test-session", "round-1", "主导者统合内容")
	if err != nil {
		t.Errorf("PushDominantSynthesisCompleted() error = %v", err)
	}
}

func TestPushConsensusEmitted(t *testing.T) {
	msg := &types.Message{
		ID:        "consensus-123",
		Type:      types.TypeConsensus,
		Content:   "最终共识",
		Status:    types.StatusSuccess,
		Timestamp: 1234567890,
	}
	err := PushConsensusEmitted("test-session", "round-1", msg)
	if err != nil {
		t.Errorf("PushConsensusEmitted() error = %v", err)
	}
}

func TestPushRoundFailed(t *testing.T) {
	err := PushRoundFailed("test-session", "round-1", "决策流程失败")
	if err != nil {
		t.Errorf("PushRoundFailed() error = %v", err)
	}
}

func TestPushContextHistoryTrimmed(t *testing.T) {
	err := PushContextHistoryTrimmed(
		"test-session",
		"round-1",
		"trinity",
		"Trinity",
		8,
		6,
		2,
		"message_count",
		6,
		0,
	)
	if err != nil {
		t.Errorf("PushContextHistoryTrimmed() error = %v", err)
	}
}

func TestEventIDGeneration(t *testing.T) {
	id1, _ := generateEventID()
	id2, _ := generateEventID()
	if id1 == id2 {
		t.Error("generateEventID() should generate unique IDs")
	}
}
