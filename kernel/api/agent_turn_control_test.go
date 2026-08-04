// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"errors"
	"fmt"
	"sync"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/packages/agentqueue"
)

func TestAgentTurnGateLinearizesAdmissionAndSealing(t *testing.T) {
	manager := agentqueue.NewInboxManager(256)
	control := newAgentTurnController("session-gate", manager)
	control.TurnStarted("turn-1")
	control.SetPhase("turn-1", agent.AgentTurnProvider)

	const admissions = 100
	start := make(chan struct{})
	var wg sync.WaitGroup
	var mu sync.Mutex
	accepted := map[string]bool{}
	claimed := map[string]bool{}
	for i := 0; i < admissions; i++ {
		id := fmt.Sprintf("steer-%03d", i)
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, err := control.AdmitSteer(&agentqueue.Input{
				ID: id, SessionID: "session-gate", Semantics: agentqueue.SemanticsSteer,
				ExpectedTurnID: "turn-1", Content: id,
			})
			if err == nil {
				mu.Lock()
				accepted[id] = true
				mu.Unlock()
				return
			}
			if !errors.Is(err, ErrAgentTurnNotSteerable) {
				t.Errorf("admit %s: %v", id, err)
			}
		}()
	}
	close(start)
	first, err := control.ClaimSteers("turn-1", true)
	if err != nil {
		t.Fatal(err)
	}
	for _, input := range first {
		claimed[input.InputID] = true
	}
	wg.Wait()

	// 最终领取若取得输入会重新开放当前 turn；再次封口可领取竞争窗口内成功的 admission。
	for {
		batch, claimErr := control.ClaimSteers("turn-1", true)
		if claimErr != nil {
			t.Fatal(claimErr)
		}
		for _, input := range batch {
			claimed[input.InputID] = true
		}
		if len(batch) == 0 {
			break
		}
	}
	mu.Lock()
	defer mu.Unlock()
	for id := range accepted {
		if !claimed[id] {
			t.Fatalf("accepted steer was lost at sealing: %s", id)
		}
	}
	if _, err = control.AdmitSteer(&agentqueue.Input{
		ID: "after-seal", SessionID: "session-gate", Semantics: agentqueue.SemanticsSteer,
		ExpectedTurnID: "turn-1", Content: "late",
	}); !errors.Is(err, ErrAgentTurnNotSteerable) {
		t.Fatalf("admission after final seal: %v", err)
	}
}

func TestAgentTurnTerminationFailsAcceptedUnclaimedSteers(t *testing.T) {
	manager := agentqueue.NewInboxManager(16)
	control := newAgentTurnController("session-terminal", manager)
	control.TurnStarted("turn-1")
	control.SetPhase("turn-1", agent.AgentTurnProvider)
	if _, err := control.AdmitSteer(&agentqueue.Input{
		ID: "steer-1", SessionID: "session-terminal", Semantics: agentqueue.SemanticsSteer,
		ExpectedTurnID: "turn-1", Content: "guide",
	}); err != nil {
		t.Fatal(err)
	}

	control.TurnTerminated("turn-1")
	snapshot := manager.SnapshotVersioned("session-terminal")
	if len(snapshot.Items) != 1 || snapshot.Items[0].State != agentqueue.StatusFailed {
		t.Fatalf("terminal steer state: %+v", snapshot)
	}
	if _, err := control.AdmitSteer(&agentqueue.Input{
		ID: "steer-late", SessionID: "session-terminal", Semantics: agentqueue.SemanticsSteer,
		ExpectedTurnID: "turn-1", Content: "late",
	}); !errors.Is(err, ErrAgentTurnNotSteerable) {
		t.Fatalf("late steer admission: %v", err)
	}
	state := control.State()
	if state.Phase != agent.AgentTurnAwaitingCommit || !state.AwaitingCommit || state.Steerable {
		t.Fatalf("terminal turn state: %+v", state)
	}
}

func TestAgentTurnInterruptRejectsAwaitingCommitWithoutChangingBarrier(t *testing.T) {
	manager := agentqueue.NewInboxManager(4)
	control := newAgentTurnController("session-interrupt-terminal", manager)
	control.TurnStarted("turn-1")
	control.SetPhase("turn-1", agent.AgentTurnProvider)
	control.TurnTerminated("turn-1")

	if err := control.Interrupt("turn-1"); !errors.Is(err, ErrAgentTurnNotSteerable) {
		t.Fatalf("interrupt terminal turn: %v", err)
	}
	state := control.State()
	if state.TurnID != "turn-1" || state.Phase != agent.AgentTurnAwaitingCommit || !state.AwaitingCommit {
		t.Fatalf("interrupt changed commit barrier: %+v", state)
	}
}
