// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	"github.com/siyuan-note/logging"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/packages/agentqueue"
)

var (
	ErrAgentNoActiveTurn     = errors.New("agent session has no active turn")
	ErrAgentTurnMismatch     = errors.New("agent turn does not match expected turn")
	ErrAgentTurnNotSteerable = errors.New("agent turn is not steerable")
)

type agentSteerPayload struct {
	UserEntryID   string              `json:"userEntryID"`
	BlockHTML     string              `json:"blockHTML,omitempty"`
	References    []agent.Reference   `json:"references,omitempty"`
	EditorContext agent.EditorContext `json:"editorContext,omitempty"`
}

type agentTurnState struct {
	TurnID         string               `json:"turnID,omitempty"`
	Phase          agent.AgentTurnPhase `json:"phase"`
	Steerable      bool                 `json:"steerable"`
	AwaitingCommit bool                 `json:"awaitingCommit"`
}

// agentTurnController owns the linearization gate shared by steer admission and sealing.
type agentTurnController struct {
	mu        sync.Mutex
	sessionID string
	manager   *agentqueue.InboxManager
	turnID    string
	phase     agent.AgentTurnPhase
	sealed    bool
}

func newAgentTurnController(sessionID string, manager *agentqueue.InboxManager) *agentTurnController {
	return &agentTurnController{
		sessionID: sessionID,
		manager:   manager,
		sealed:    true,
	}
}

func (control *agentTurnController) TurnStarted(turnID string) {
	control.mu.Lock()
	control.turnID = turnID
	control.phase = agent.AgentTurnStarting
	control.sealed = false
	control.mu.Unlock()
}

func (control *agentTurnController) SetPhase(turnID string, phase agent.AgentTurnPhase) {
	control.mu.Lock()
	defer control.mu.Unlock()
	if control.turnID != turnID {
		return
	}
	control.phase = phase
	if phase == agent.AgentTurnAwaitingCommit {
		control.sealed = true
	}
}

func (control *agentTurnController) ClaimSteers(turnID string, final bool) ([]agent.AgentSteerInput, error) {
	control.mu.Lock()
	defer control.mu.Unlock()
	if control.turnID == "" {
		return nil, ErrAgentNoActiveTurn
	}
	if control.turnID != turnID {
		return nil, ErrAgentTurnMismatch
	}
	if final {
		control.phase = agent.AgentTurnSealing
		control.sealed = true
	} else {
		control.phase = agent.AgentTurnBoundary
	}
	cutoff := control.manager.SnapshotVersioned(control.sessionID).NextSeq
	claimed, err := control.manager.ClaimSteerBatch(control.sessionID, turnID, cutoff)
	if err != nil {
		return nil, err
	}
	steers := make([]agent.AgentSteerInput, 0, len(claimed))
	for _, input := range claimed {
		steer, decodeErr := decodeAgentSteer(input)
		if decodeErr != nil {
			for _, claimedInput := range claimed {
				_ = control.manager.MarkFailed(control.sessionID, claimedInput.ID)
			}
			return nil, decodeErr
		}
		steers = append(steers, steer)
	}
	if final && len(steers) > 0 {
		// A claimed final steer continues the same turn and reopens admission.
		control.phase = agent.AgentTurnBoundary
		control.sealed = false
	}
	return steers, nil
}

func decodeAgentSteer(input *agentqueue.Input) (agent.AgentSteerInput, error) {
	if input == nil || input.Semantics != agentqueue.SemanticsSteer {
		return agent.AgentSteerInput{}, fmt.Errorf("invalid claimed steer")
	}
	payload := agentSteerPayload{}
	if len(input.Payload) > 0 {
		if err := json.Unmarshal(input.Payload, &payload); err != nil {
			return agent.AgentSteerInput{}, fmt.Errorf("decode steer payload: %w", err)
		}
	}
	return agent.AgentSteerInput{
		InputID:       input.ID,
		UserEntryID:   payload.UserEntryID,
		Content:       input.Content,
		BlockHTML:     payload.BlockHTML,
		References:    append([]agent.Reference(nil), payload.References...),
		EditorContext: payload.EditorContext,
	}, nil
}

func (control *agentTurnController) AcknowledgeSteers(_ string, inputIDs []string, injected bool) {
	for _, inputID := range inputIDs {
		var err error
		if injected {
			err = control.manager.MarkInjected(control.sessionID, inputID)
		} else {
			err = control.manager.MarkFailed(control.sessionID, inputID)
		}
		if err != nil {
			logging.LogErrorf("update steer state failed (session %s input %s): %s", control.sessionID, inputID, err)
		}
	}
}

func (control *agentTurnController) TurnTerminated(turnID string) {
	control.mu.Lock()
	defer control.mu.Unlock()
	if control.turnID != turnID {
		return
	}
	control.phase = agent.AgentTurnAwaitingCommit
	control.sealed = true
	control.failPendingSteersLocked(turnID)
}

func (control *agentTurnController) RestoreAwaitingCommit(turnID string) {
	if turnID == "" {
		return
	}
	control.mu.Lock()
	defer control.mu.Unlock()
	control.turnID = turnID
	control.phase = agent.AgentTurnAwaitingCommit
	control.sealed = true
	control.failPendingSteersLocked(turnID)
}

func (control *agentTurnController) failPendingSteersLocked(turnID string) {
	cutoff := control.manager.SnapshotVersioned(control.sessionID).NextSeq
	claimed, err := control.manager.ClaimSteerBatch(control.sessionID, turnID, cutoff)
	if err != nil {
		logging.LogErrorf("claim remaining steer after turn termination failed (session %s turn %s): %s", control.sessionID, turnID, err)
		return
	}
	for _, input := range claimed {
		if markErr := control.manager.MarkFailed(control.sessionID, input.ID); markErr != nil {
			logging.LogErrorf("fail remaining steer after turn termination failed (session %s input %s): %s", control.sessionID, input.ID, markErr)
		}
	}
}

func (control *agentTurnController) AdmitSteer(input *agentqueue.Input) (agentqueue.SubmitResult, error) {
	if input == nil {
		return agentqueue.SubmitResult{}, agentqueue.ErrNilInput
	}
	control.mu.Lock()
	defer control.mu.Unlock()
	if control.turnID == "" {
		return agentqueue.SubmitResult{}, ErrAgentNoActiveTurn
	}
	if input.ExpectedTurnID != control.turnID {
		return agentqueue.SubmitResult{}, ErrAgentTurnMismatch
	}
	if control.sealed || !isSteerablePhase(control.phase) {
		return agentqueue.SubmitResult{}, ErrAgentTurnNotSteerable
	}
	return control.manager.Submit(input)
}

func (control *agentTurnController) PromoteQueuedInput(inputID, expectedTurnID string, expectedQueueVersion int64) (*agentqueue.Input, int64, error) {
	control.mu.Lock()
	defer control.mu.Unlock()
	if control.turnID == "" {
		return nil, 0, ErrAgentNoActiveTurn
	}
	if expectedTurnID != control.turnID {
		return nil, 0, ErrAgentTurnMismatch
	}
	if control.sealed || !isSteerablePhase(control.phase) {
		return nil, 0, ErrAgentTurnNotSteerable
	}
	return control.manager.PromotePendingQueue(control.sessionID, inputID, expectedQueueVersion, expectedTurnID)
}

func (control *agentTurnController) Interrupt(expectedTurnID string) error {
	control.mu.Lock()
	defer control.mu.Unlock()
	if control.turnID == "" {
		return ErrAgentNoActiveTurn
	}
	if expectedTurnID != control.turnID {
		return ErrAgentTurnMismatch
	}
	if control.sealed || !isInterruptiblePhase(control.phase) {
		return ErrAgentTurnNotSteerable
	}
	control.sealed = true
	control.phase = agent.AgentTurnSealing
	cutoff := control.manager.SnapshotVersioned(control.sessionID).NextSeq
	claimed, err := control.manager.ClaimSteerBatch(control.sessionID, control.turnID, cutoff)
	if err != nil {
		return err
	}
	for _, input := range claimed {
		if markErr := control.manager.MarkFailed(control.sessionID, input.ID); markErr != nil {
			return markErr
		}
	}
	return nil
}

func (control *agentTurnController) Commit(turnID string) (bool, error) {
	control.mu.Lock()
	defer control.mu.Unlock()
	if control.turnID == "" {
		return false, nil
	}
	if control.turnID != turnID {
		return false, ErrAgentTurnMismatch
	}
	control.turnID = ""
	control.phase = ""
	control.sealed = true
	return true, nil
}

func (control *agentTurnController) State() agentTurnState {
	control.mu.Lock()
	defer control.mu.Unlock()
	return agentTurnState{
		TurnID:         control.turnID,
		Phase:          control.phase,
		Steerable:      control.turnID != "" && !control.sealed && isSteerablePhase(control.phase),
		AwaitingCommit: control.turnID != "" && control.phase == agent.AgentTurnAwaitingCommit,
	}
}

func isSteerablePhase(phase agent.AgentTurnPhase) bool {
	switch phase {
	case agent.AgentTurnBoundary, agent.AgentTurnProvider, agent.AgentTurnToolRunning:
		return true
	default:
		return false
	}
}

func isInterruptiblePhase(phase agent.AgentTurnPhase) bool {
	switch phase {
	case agent.AgentTurnStarting, agent.AgentTurnBoundary, agent.AgentTurnProvider, agent.AgentTurnToolRunning:
		return true
	default:
		return false
	}
}
