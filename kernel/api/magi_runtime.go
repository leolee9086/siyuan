package api

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/coordinator"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const (
	defaultMagiHeartbeatInterval     = 5 * time.Minute
	defaultMagiHeartbeatInitialDelay = 30 * time.Second
	magiRuntimeMonitorSessionID      = websocket.RuntimeMonitorSessionID
	magiHeartbeatPrincipalID         = "system-cron"
	magiHeartbeatInterfaceID         = "magi-heartbeat"
	magiHeartbeatConversationID      = "heartbeat-loop"
)

type magiHeartbeatRun struct {
	cancel context.CancelFunc
	done   chan struct{}
}

type magiRuntimeManager struct {
	mu                sync.RWMutex
	status            types.RuntimeStatus
	heartbeatInterval time.Duration
	stopCh            chan struct{}
	activeHeartbeat   *magiHeartbeatRun
	foregroundBusy    int32
}

func newMagiRuntimeManager(interval time.Duration) *magiRuntimeManager {
	if interval <= 0 {
		interval = defaultMagiHeartbeatInterval
	}
	now := time.Now().UnixMilli()
	return &magiRuntimeManager{
		status: types.RuntimeStatus{
			State:     types.RuntimeStateSleeping,
			Awake:     false,
			Reason:    "startup",
			UpdatedAt: now,
		},
		heartbeatInterval: interval,
		stopCh:            make(chan struct{}),
	}
}

func clearDominantRuntimeStatus(status *types.RuntimeStatus) {
	if status == nil {
		return
	}
	status.DominantSeel = ""
	status.DominantStance = ""
	status.DominantUpdatedAt = 0
}

func (m *magiRuntimeManager) Start() {
	if m == nil {
		return
	}
	m.pushCurrentStatus()
	logging.LogInfof("MAGI runtime manager started, first heartbeat in %s, interval=%s", m.initialHeartbeatDelay(), m.heartbeatInterval)
	go m.heartbeatLoop()
}

func (m *magiRuntimeManager) heartbeatLoop() {
	initialDelay := m.initialHeartbeatDelay()
	var initialHeartbeat <-chan time.Time
	if initialDelay > 0 {
		timer := time.NewTimer(initialDelay)
		defer timer.Stop()
		initialHeartbeat = timer.C
	} else {
		m.tryStartHeartbeat()
	}

	ticker := time.NewTicker(m.heartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-initialHeartbeat:
			initialHeartbeat = nil
			m.tryStartHeartbeat()
		case <-ticker.C:
			m.tryStartHeartbeat()
		case <-m.stopCh:
			return
		}
	}
}

func (m *magiRuntimeManager) initialHeartbeatDelay() time.Duration {
	if m == nil {
		return 0
	}
	if m.heartbeatInterval <= 0 || m.heartbeatInterval < defaultMagiHeartbeatInitialDelay {
		return m.heartbeatInterval
	}
	return defaultMagiHeartbeatInitialDelay
}

func (m *magiRuntimeManager) tryStartHeartbeat() {
	if m == nil || magiCoordinator == nil || magiInitErr != nil {
		return
	}
	if atomic.LoadInt32(&m.foregroundBusy) > 0 || len(magiQueue) > 0 {
		return
	}

	m.mu.Lock()
	if m.activeHeartbeat != nil {
		m.mu.Unlock()
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	run := &magiHeartbeatRun{
		cancel: cancel,
		done:   make(chan struct{}),
	}
	m.activeHeartbeat = run

	now := time.Now()
	nowMillis := now.UnixMilli()
	m.status.State = types.RuntimeStateHeartbeat
	m.status.Awake = true
	m.status.WakeSource = "heartbeat"
	m.status.Reason = "scheduled-heartbeat"
	m.status.CurrentTask = buildHeartbeatTaskPreview(now)
	m.status.CurrentRoundID = ""
	clearDominantRuntimeStatus(&m.status)
	m.status.LastHeartbeatAt = nowMillis
	m.status.LastWakeAt = nowMillis
	m.status.UpdatedAt = nowMillis
	status := m.status
	m.mu.Unlock()

	m.pushStatus(status)

	go func(active *magiHeartbeatRun) {
		defer close(active.done)

		result, err := magiCoordinator.CoordinateHeartbeat(
			ctx,
			magiRuntimeMonitorSessionID,
			magiMelchior,
			magiBalthazar,
			magiCasper,
			buildHeartbeatPrompt(now),
			buildHeartbeatSourceContext(),
		)
		m.finishHeartbeat(active, result, err)
	}(run)
}

func (m *magiRuntimeManager) finishHeartbeat(
	run *magiHeartbeatRun,
	result *coordinator.HeartbeatDecisionResult,
	err error,
) {
	if m == nil {
		return
	}

	nowMillis := time.Now().UnixMilli()

	m.mu.Lock()
	if m.activeHeartbeat == run {
		m.activeHeartbeat = nil
	}
	if atomic.LoadInt32(&m.foregroundBusy) > 0 {
		m.mu.Unlock()
		return
	}

	m.status.CurrentTask = ""
	m.status.UpdatedAt = nowMillis
	if result != nil {
		m.status.CurrentRoundID = strings.TrimSpace(result.RoundID)
		if dominantSeel := strings.TrimSpace(result.DominantSeel); dominantSeel != "" {
			m.status.DominantSeel = dominantSeel
			m.status.DominantStance = strings.TrimSpace(result.DominantStance)
			m.status.DominantUpdatedAt = nowMillis
		} else {
			clearDominantRuntimeStatus(&m.status)
		}
	} else {
		clearDominantRuntimeStatus(&m.status)
	}

	switch {
	case err != nil && errors.Is(err, context.Canceled):
		m.status.State = types.RuntimeStateHeartbeat
		m.status.Awake = true
		m.status.Reason = "heartbeat-interrupted"
	case err != nil:
		m.status.State = types.RuntimeStateHeartbeat
		m.status.Awake = true
		m.status.Reason = "heartbeat-failed"
	case result != nil && result.Sleeping:
		m.status.State = types.RuntimeStateSleeping
		m.status.Awake = false
		m.status.WakeSource = ""
		m.status.LastSleepAt = nowMillis
		m.status.LastSleepSummary = strings.TrimSpace(result.SleepSummary)
		m.status.Reason = "wanna-sleep"
	default:
		m.status.State = types.RuntimeStateHeartbeat
		m.status.Awake = true
		m.status.Reason = "heartbeat-incomplete"
	}

	status := m.status
	m.mu.Unlock()

	m.pushStatus(status)
}

func (m *magiRuntimeManager) InterruptHeartbeat() {
	if m == nil {
		return
	}

	m.mu.RLock()
	active := m.activeHeartbeat
	m.mu.RUnlock()
	if active == nil {
		return
	}

	active.cancel()
	select {
	case <-active.done:
	case <-time.After(1500 * time.Millisecond):
	}
}

func (m *magiRuntimeManager) BeginForeground(taskPreview string) {
	if m == nil {
		return
	}

	atomic.StoreInt32(&m.foregroundBusy, 1)
	nowMillis := time.Now().UnixMilli()

	m.mu.Lock()
	m.status.State = types.RuntimeStateExternal
	m.status.Awake = true
	m.status.WakeSource = "external"
	m.status.Reason = "external-request"
	m.status.CurrentTask = truncateRuntimeText(taskPreview, 160)
	m.status.CurrentRoundID = ""
	clearDominantRuntimeStatus(&m.status)
	m.status.LastWakeAt = nowMillis
	m.status.UpdatedAt = nowMillis
	status := m.status
	m.mu.Unlock()

	m.pushStatus(status)
}

func (m *magiRuntimeManager) NotifyDominantSelected(roundID string, election *coordinator.DominantElectionResult) {
	if m == nil || election == nil {
		return
	}

	nowMillis := time.Now().UnixMilli()

	m.mu.Lock()
	if trimmedRoundID := strings.TrimSpace(roundID); trimmedRoundID != "" {
		m.status.CurrentRoundID = trimmedRoundID
	}
	if dominantSeel := strings.TrimSpace(election.DominantSeelName); dominantSeel != "" {
		m.status.DominantSeel = dominantSeel
		m.status.DominantStance = strings.TrimSpace(election.DominantStance)
		m.status.DominantUpdatedAt = nowMillis
	}
	m.status.UpdatedAt = nowMillis
	status := m.status
	m.mu.Unlock()

	m.pushStatus(status)
}

func (m *magiRuntimeManager) ApplyForegroundConsensus(message *types.Message) {
	if m == nil || message == nil || len(message.Meta) == 0 {
		return
	}

	dominantSeel := readConsensusMetaString(message.Meta, "dominantSeel")
	dominantStance := readConsensusMetaString(message.Meta, "dominantStance")
	roundID := readConsensusMetaString(message.Meta, "roundId")
	if dominantSeel == "" && dominantStance == "" && roundID == "" {
		return
	}

	nowMillis := time.Now().UnixMilli()

	m.mu.Lock()
	if roundID != "" {
		m.status.CurrentRoundID = roundID
	}
	if dominantSeel != "" {
		m.status.DominantSeel = dominantSeel
		m.status.DominantStance = dominantStance
		m.status.DominantUpdatedAt = nowMillis
	}
	m.status.UpdatedAt = nowMillis
	status := m.status
	m.mu.Unlock()

	m.pushStatus(status)
}

func (m *magiRuntimeManager) FinishForeground(err error) {
	if m == nil {
		return
	}

	atomic.StoreInt32(&m.foregroundBusy, 0)
	nowMillis := time.Now().UnixMilli()

	m.mu.Lock()
	m.status.State = types.RuntimeStateSleeping
	m.status.Awake = false
	m.status.WakeSource = ""
	m.status.CurrentTask = ""
	m.status.CurrentRoundID = ""
	clearDominantRuntimeStatus(&m.status)
	m.status.LastSleepAt = nowMillis
	m.status.UpdatedAt = nowMillis
	switch {
	case err != nil && errors.Is(err, context.Canceled):
		m.status.Reason = "external-interrupted"
	case err != nil:
		m.status.Reason = "external-failed"
	default:
		m.status.Reason = "external-completed"
	}
	status := m.status
	m.mu.Unlock()

	m.pushStatus(status)
}

func (m *magiRuntimeManager) GetStatus() types.RuntimeStatus {
	if m == nil {
		return types.RuntimeStatus{}
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

func (m *magiRuntimeManager) pushCurrentStatus() {
	m.pushStatus(m.GetStatus())
}

func (m *magiRuntimeManager) pushStatus(status types.RuntimeStatus) {
	if err := websocket.PushRuntimeStatusUpdated(magiRuntimeMonitorSessionID, status); err != nil {
		logging.LogWarnf("推送MAGI运行态失败: %v", err)
	}
}

func buildHeartbeatTaskPreview(now time.Time) string {
	return fmt.Sprintf("heartbeat wake @ %s", now.Format(time.RFC3339))
}

func buildHeartbeatPrompt(now time.Time) string {
	return prompts.BuildCoreSageHeartbeatWakePrompt(now.Format(time.RFC3339))
}

func buildHeartbeatSourceContext() *types.RequestSourceContext {
	return &types.RequestSourceContext{
		RequestID:             "req-heartbeat-" + util.RandString(12),
		Channel:               types.SourceChannelSystemCron,
		PrincipalID:           magiHeartbeatPrincipalID,
		IdentityID:            magiHeartbeatPrincipalID,
		Nickname:              "System Cron",
		InterfaceID:           magiHeartbeatInterfaceID,
		InterfaceKind:         "system-cron-job",
		ConversationID:        magiHeartbeatConversationID,
		SourceSessionKey:      "system-cron:system-cron:magi-heartbeat:heartbeat-loop",
		DirectResponseAllowed: false,
		CallerID:              "magi-heartbeat",
		TrustBase:             types.TrustLevelHigh,
		RiskLevel:             types.TrustLevelLow,
		AuthStrength:          types.AuthStrengthStrong,
		ModelIntent:           "system-cron",
		RawAttributes: map[string]string{
			"routeClass": "system-cron",
			"identityId": magiHeartbeatPrincipalID,
			"nickname":   "System Cron",
		},
	}
}

func truncateRuntimeText(text string, limit int) string {
	text = strings.TrimSpace(text)
	if limit <= 0 || len(text) <= limit {
		return text
	}
	return text[:limit] + "..."
}

func readConsensusMetaString(meta map[string]interface{}, key string) string {
	if len(meta) == 0 {
		return ""
	}
	value, ok := meta[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	default:
		return strings.TrimSpace(fmt.Sprint(typed))
	}
}
