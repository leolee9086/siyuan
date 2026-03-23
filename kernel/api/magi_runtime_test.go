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
		Sleeping:     true,
		SleepSummary: "合并后的睡前笔记",
	}, nil)

	status := manager.GetStatus()
	if status.State != types.RuntimeStateSleeping || status.Awake {
		t.Fatalf("期望全员休眠后 runtime 进入 sleeping，实际=%+v", status)
	}
	if status.Reason != "wanna-sleep" {
		t.Fatalf("期望 reason=wanna-sleep，实际=%s", status.Reason)
	}
	if status.LastSleepSummary != "合并后的睡前笔记" {
		t.Fatalf("期望保留合并后的睡前笔记，实际=%s", status.LastSleepSummary)
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
		Sleeping: false,
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
