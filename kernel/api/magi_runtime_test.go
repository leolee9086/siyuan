package api

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/coordinator"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func TestMagiRuntimeManagerFinishHeartbeat_SleepsOnlyAfterMergedSleep(t *testing.T) {
	manager := newMagiRuntimeManager(time.Minute)
	run := &magiHeartbeatRun{}

	manager.mu.Lock()
	manager.activeHeartbeat = run
	manager.status = types.RuntimeStatus{
		State:      types.RuntimeStateHeartbeat,
		Awake:      true,
		WakeSource: "heartbeat",
		Reason:     "scheduled-heartbeat",
	}
	manager.mu.Unlock()

	manager.finishHeartbeat(run, &coordinator.HeartbeatDecisionResult{
		RoundID:      "heartbeat-round-1",
		Downtime:     true,
		DowntimeSummary: "合并后的睡前笔记",
	}, nil)

	status := manager.GetStatus()
	if status.State != types.RuntimeStateDowntime || status.Awake {
		t.Fatalf("期望全员休眠后 runtime 进入 sleeping，实际=%+v", status)
	}
	if status.Reason != "wanna-sleep" {
		t.Fatalf("期望 reason=wanna-sleep，实际=%s", status.Reason)
	}
	if status.LastDowntimeSummary != "合并后的睡前笔记" {
		t.Fatalf("期望保留合并后的睡前笔记，实际=%s", status.LastDowntimeSummary)
	}
}

func TestMagiRuntimeManagerFinishHeartbeat_KeepsAwakeWhenHeartbeatIncomplete(t *testing.T) {
	manager := newMagiRuntimeManager(time.Minute)
	run := &magiHeartbeatRun{}

	manager.mu.Lock()
	manager.activeHeartbeat = run
	manager.status = types.RuntimeStatus{
		State:      types.RuntimeStateHeartbeat,
		Awake:      true,
		WakeSource: "heartbeat",
		Reason:     "scheduled-heartbeat",
	}
	manager.mu.Unlock()

	manager.finishHeartbeat(run, &coordinator.HeartbeatDecisionResult{
		RoundID:  "heartbeat-round-2",
		Downtime: false,
	}, nil)

	status := manager.GetStatus()
	if status.State != types.RuntimeStateHeartbeat || !status.Awake {
		t.Fatalf("期望未全员休眠时保持 awake，实际=%+v", status)
	}
	if status.Reason != "heartbeat-incomplete" {
		t.Fatalf("期望 reason=heartbeat-incomplete，实际=%s", status.Reason)
	}
}

func TestMagiRuntimeManagerFinishHeartbeat_KeepsAwakeOnHeartbeatFailure(t *testing.T) {
	manager := newMagiRuntimeManager(time.Minute)
	run := &magiHeartbeatRun{}

	manager.mu.Lock()
	manager.activeHeartbeat = run
	manager.status = types.RuntimeStatus{
		State:      types.RuntimeStateHeartbeat,
		Awake:      true,
		WakeSource: "heartbeat",
		Reason:     "scheduled-heartbeat",
	}
	manager.mu.Unlock()

	manager.finishHeartbeat(run, nil, errors.New("boom"))

	status := manager.GetStatus()
	if status.State != types.RuntimeStateHeartbeat || !status.Awake {
		t.Fatalf("期望心跳失败后保持 awake，实际=%+v", status)
	}
	if status.Reason != "heartbeat-failed" {
		t.Fatalf("期望 reason=heartbeat-failed，实际=%s", status.Reason)
	}

	manager.mu.Lock()
	manager.activeHeartbeat = run
	manager.status.State = types.RuntimeStateHeartbeat
	manager.status.Awake = true
	manager.status.Reason = "scheduled-heartbeat"
	manager.mu.Unlock()

	manager.finishHeartbeat(run, nil, context.Canceled)
	status = manager.GetStatus()
	if status.State != types.RuntimeStateHeartbeat || !status.Awake {
		t.Fatalf("期望心跳中断后保持 awake，实际=%+v", status)
	}
	if status.Reason != "heartbeat-interrupted" {
		t.Fatalf("期望 reason=heartbeat-interrupted，实际=%s", status.Reason)
	}
}

func TestMagiRuntimeManagerApplyForegroundConsensus_UpdatesDominantStatus(t *testing.T) {
	manager := newMagiRuntimeManager(time.Minute)
	manager.BeginForeground("外部请求")

	manager.ApplyForegroundConsensus(&types.Message{
		Meta: map[string]interface{}{
			"roundId":        "external-round-1",
			"dominantSeel":   "melchior",
			"dominantStance": "科学家",
		},
	})

	status := manager.GetStatus()
	if status.State != types.RuntimeStateExternal || !status.Awake {
		t.Fatalf("期望仍处于 external/awake，实际=%+v", status)
	}
	if status.CurrentRoundID != "external-round-1" {
		t.Fatalf("期望写入 currentRoundId，实际=%s", status.CurrentRoundID)
	}
	if status.DominantSeel != "melchior" {
		t.Fatalf("期望写入 dominantSeel，实际=%s", status.DominantSeel)
	}
	if status.DominantStance != "科学家" {
		t.Fatalf("期望写入 dominantStance，实际=%s", status.DominantStance)
	}
	if status.DominantUpdatedAt == 0 {
		t.Fatal("期望刷新 dominantUpdatedAt")
	}
}

func TestMagiRuntimeManagerNotifyDominantSelected_UpdatesDominantImmediately(t *testing.T) {
	manager := newMagiRuntimeManager(time.Minute)
	manager.BeginForeground("外部请求")

	manager.NotifyDominantSelected("external-round-2", &coordinator.DominantElectionResult{
		DominantSeelName:    "balthazar",
		DominantDisplayName: "Balthazar",
		DominantStance:      "母亲",
	})

	status := manager.GetStatus()
	if status.CurrentRoundID != "external-round-2" {
		t.Fatalf("期望即时写入 currentRoundId，实际=%s", status.CurrentRoundID)
	}
	if status.DominantSeel != "balthazar" || status.DominantStance != "母亲" {
		t.Fatalf("期望即时写入主导者信息，实际=%+v", status)
	}
	if status.DominantUpdatedAt == 0 {
		t.Fatal("期望即时刷新 dominantUpdatedAt")
	}
}

func TestMagiRuntimeManagerBeginForeground_ClearsStaleDominant(t *testing.T) {
	manager := newMagiRuntimeManager(time.Minute)
	manager.status = types.RuntimeStatus{
		State:             types.RuntimeStateDowntime,
		Awake:             false,
		DominantSeel:      "melchior",
		DominantStance:    "科学家",
		DominantUpdatedAt: time.Now().UnixMilli(),
	}

	manager.BeginForeground("新的外部请求")

	status := manager.GetStatus()
	if status.DominantSeel != "" || status.DominantStance != "" || status.DominantUpdatedAt != 0 {
		t.Fatalf("期望开始前台请求时清空旧主导，实际=%+v", status)
	}
}

func TestMagiRuntimeManagerFinishForeground_ClearsLatestDominant(t *testing.T) {
	manager := newMagiRuntimeManager(time.Minute)
	manager.BeginForeground("外部请求")
	manager.ApplyForegroundConsensus(&types.Message{
		Meta: map[string]interface{}{
			"dominantSeel":   "casper",
			"dominantStance": "式波",
		},
	})

	manager.FinishForeground(nil)

	status := manager.GetStatus()
	if status.State != types.RuntimeStateDowntime || status.Awake {
		t.Fatalf("期望请求完成后进入 sleeping，实际=%+v", status)
	}
	if status.DominantSeel != "" || status.DominantStance != "" || status.DominantUpdatedAt != 0 {
		t.Fatalf("期望请求完成后清空主导者信息，实际=%+v", status)
	}
}

func TestMagiRuntimeManagerBuildHeartbeatPassiveRecallBasis_PrefersPreviousDialogue(t *testing.T) {
	manager := newMagiRuntimeManager(time.Minute)
	manager.status.LastDowntimeSummary = "上一轮睡前笔记"
	manager.RememberForegroundTurn("用户提到 alpha beta", "AI 回复 recall plan")

	basis := manager.buildHeartbeatPassiveRecallBasisLocked()
	if basis == nil {
		t.Fatal("期望生成上一轮对话召回依据")
	}
	if basis.Type != types.PassiveRecallBasisPreviousDialogue {
		t.Fatalf("期望 previous_dialogue，实际=%s", basis.Type)
	}
	if basis.UserMessage != "用户提到 alpha beta" {
		t.Fatalf("期望保留用户消息，实际=%s", basis.UserMessage)
	}
	if basis.AssistantReply != "AI 回复 recall plan" {
		t.Fatalf("期望保留 AI 回复，实际=%s", basis.AssistantReply)
	}
	if basis.Query != "用户提到 alpha beta\nAI 回复 recall plan" {
		t.Fatalf("期望 query 拼接用户消息和 AI 回复，实际=%q", basis.Query)
	}
}

func TestMagiRuntimeManagerBuildHeartbeatPassiveRecallBasis_FallsBackToPreviousSleep(t *testing.T) {
	manager := newMagiRuntimeManager(time.Minute)
	manager.status.LastDowntimeSummary = "上一轮睡前笔记 alpha beta"

	basis := manager.buildHeartbeatPassiveRecallBasisLocked()
	if basis == nil {
		t.Fatal("期望从睡前笔记生成召回依据")
	}
	if basis.Type != types.PassiveRecallBasisPreviousDowntime {
		t.Fatalf("期望 previous_sleep_note，实际=%s", basis.Type)
	}
	if basis.Query != "上一轮睡前笔记 alpha beta" || basis.DowntimeSummary != "上一轮睡前笔记 alpha beta" {
		t.Fatalf("期望 query 与 sleepSummary 使用上一轮睡前笔记，实际=%+v", basis)
	}
}

func TestMagiRuntimeManagerFinishHeartbeat_SleepingRoundClearsPreviousDialogueBasis(t *testing.T) {
	manager := newMagiRuntimeManager(time.Minute)
	run := &magiHeartbeatRun{}

	manager.RememberForegroundTurn("用户消息", "AI 回复")
	manager.mu.Lock()
	manager.activeHeartbeat = run
	manager.status.State = types.RuntimeStateHeartbeat
	manager.status.Awake = true
	manager.status.Reason = "scheduled-heartbeat"
	manager.mu.Unlock()

	manager.finishHeartbeat(run, &coordinator.HeartbeatDecisionResult{
		RoundID:      "heartbeat-round-3",
		Downtime:     true,
		DowntimeSummary: "新的睡前笔记",
	}, nil)

	basis := manager.buildHeartbeatPassiveRecallBasisLocked()
	if basis == nil {
		t.Fatal("期望休眠完成后仍能生成召回依据")
	}
	if basis.Type != types.PassiveRecallBasisPreviousDowntime {
		t.Fatalf("期望休眠完成后切换为 previous_sleep_note，实际=%s", basis.Type)
	}
	if basis.Query != "新的睡前笔记" {
		t.Fatalf("期望使用新的睡前笔记作为 query，实际=%q", basis.Query)
	}
}
