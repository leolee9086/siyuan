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
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/coordinator"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const (
	defaultMagiHeartbeatInterval             = 5 * time.Minute
	magiHeartbeatSleepIntervalFirst          = 30 * time.Minute
	magiHeartbeatSleepIntervalSecond         = 45 * time.Minute
	magiHeartbeatSleepIntervalSubsequent     = 60 * time.Minute
	defaultMagiHeartbeatInitialDelay         = 30 * time.Second
	magiRuntimeMonitorSessionID              = websocket.RuntimeMonitorSessionID
	magiHeartbeatPrincipalID                 = "system-cron"
	magiHeartbeatInterfaceID                 = "magi-heartbeat"
	magiHeartbeatConversationID              = "heartbeat-loop"
	magiDefaultSleepScheduleStartHour        = 0  // 午夜
	magiDefaultSleepScheduleEndHour          = 8  // 早上
)

type magiHeartbeatRun struct {
	cancel    context.CancelFunc
	done      chan struct{}
	roundID   string
	sessionID string
}

type magiRuntimeManager struct {
	mu                sync.RWMutex
	status            types.RuntimeStatus
	heartbeatInterval time.Duration
	stopCh            chan struct{}
	activeHeartbeat   *magiHeartbeatRun
	foregroundBusy    int32
	lastRoundHasUser  bool
	lastRoundUser     string
	lastRoundReply    string
	lastRoundSleep    string

	sleepCycleCount int // 连续完成的睡眠心跳次数，用于渐进式间隔

	postWakeFromSleep bool // 睡眠时段被外部唤醒后进入工作过渡期
	postWakeWorkCycle int  // 过渡期内完成的工作心跳轮数，驱动等差数列间隔 (n+1)*5min
}

func newMagiRuntimeManager(interval time.Duration) *magiRuntimeManager {
	if interval <= 0 {
		interval = defaultMagiHeartbeatInterval
	}
	now := time.Now().UnixMilli()
	return &magiRuntimeManager{
		status: types.RuntimeStatus{
			State:     types.RuntimeStateDowntime,
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
	if initialDelay > 0 {
		timer := time.NewTimer(initialDelay)
		select {
		case <-timer.C:
			m.tryStartHeartbeat()
		case <-m.stopCh:
			timer.Stop()
			return
		}
		timer.Stop()
	} else {
		m.tryStartHeartbeat()
	}

	lastHeartbeat := time.Now()

	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			now := time.Now()
			interval := m.heartbeatInterval
			if m.postWakeFromSleep && m.isSleepTime(now) {
				interval = m.postWakeHeartbeatInterval()
				if interval > 30*time.Minute {
					m.postWakeFromSleep = false
					m.postWakeWorkCycle = 0
					m.sleepCycleCount = 0
					interval = m.sleepHeartbeatInterval()
				} else {
					m.postWakeWorkCycle++
				}
			} else if m.isSleepTime(now) {
				interval = m.sleepHeartbeatInterval()
			} else {
				m.sleepCycleCount = 0
				m.postWakeFromSleep = false
				m.postWakeWorkCycle = 0
			}
			if now.Sub(lastHeartbeat) >= interval {
				lastHeartbeat = now
				m.tryStartHeartbeat()
			}
		case <-m.stopCh:
			return
		}
	}
}

func (m *magiRuntimeManager) sleepHeartbeatInterval() time.Duration {
	switch m.sleepCycleCount {
	case 0:
		return magiHeartbeatSleepIntervalFirst
	case 1:
		return magiHeartbeatSleepIntervalSecond
	default:
		return magiHeartbeatSleepIntervalSubsequent
	}
}

func (m *magiRuntimeManager) postWakeHeartbeatInterval() time.Duration {
	return time.Duration(m.postWakeWorkCycle+1) * 5 * time.Minute
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

func (m *magiRuntimeManager) isSleepTime(now time.Time) bool {
	startHour := magiDefaultSleepScheduleStartHour
	endHour := magiDefaultSleepScheduleEndHour
	if model.Conf != nil && model.Conf.AI != nil && model.Conf.AI.OpenAI != nil {
		if h := model.Conf.AI.OpenAI.MAGISleepStartHour; h > 0 && h <= 23 {
			startHour = h
		}
		if h := model.Conf.AI.OpenAI.MAGISleepEndHour; h > 0 && h <= 23 {
			endHour = h
		}
	}
	hour := now.Hour()
	if startHour < endHour {
		return hour >= startHour && hour < endHour
	}
	return hour >= startHour || hour < endHour
}

func (m *magiRuntimeManager) tryStartHeartbeat() {
	if m == nil || magiCoordinator == nil || magiInitErr != nil {
		return
	}

	m.mu.Lock()
	if m.activeHeartbeat != nil {
		m.mu.Unlock()
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	run := &magiHeartbeatRun{
		cancel: cancel,
		done:   done,
	}
	m.activeHeartbeat = run

	now := time.Now()
	nowMillis := now.UnixMilli()
	isSleep := m.isSleepTime(now) && !m.postWakeFromSleep
	m.status.State = types.RuntimeStateHeartbeat
	m.status.Awake = true
	m.status.WakeSource = "heartbeat"
	if m.postWakeFromSleep {
		m.status.Reason = "post-wake-work-heartbeat"
	} else {
		m.status.Reason = "scheduled-heartbeat"
	}
	m.status.CurrentTask = buildHeartbeatTaskPreview(now)
	m.status.CurrentRoundID = ""
	clearDominantRuntimeStatus(&m.status)
	m.status.LastHeartbeatAt = nowMillis
	m.status.LastWakeAt = nowMillis
	m.status.UpdatedAt = nowMillis
	passiveRecallBasis := m.buildHeartbeatPassiveRecallBasisLocked()
	sourceCtx := buildHeartbeatSourceContext()
	prompt := buildHeartbeatPrompt(now, isSleep)
	status := m.status
	m.mu.Unlock()

	m.pushStatus(status)

	task := &DispatcherTask{
		Type:                        TaskTypeHeartbeat,
		Run:                         run,
		HeartbeatCtx:                ctx,
		HeartbeatPrompt:             prompt,
		HeartbeatSourceCtx:          sourceCtx,
		HeartbeatPassiveRecallBasis: passiveRecallBasis,
		HeartbeatIsSleepTime:        isSleep,
	}

	if !dispQueue.Push(Ring1Heartbeat, task) {
		cancel()
		close(done)
		m.mu.Lock()
		if m.activeHeartbeat == run {
			m.activeHeartbeat = nil
		}
		m.mu.Unlock()
	}
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
		if result != nil {
			roundID := strings.TrimSpace(result.RoundID)
			if roundID != "" {
				_ = websocket.PushRoundCancelled(websocket.RuntimeMonitorSessionID, roundID, "heartbeat-interrupted-by-external-message")
			}
			if len(result.Responses) > 0 {
				interruptedSummary := coordinator.FinalizeHeartbeatInterrupted(result.Responses)
				m.status.LastDowntimeSummary = interruptedSummary
			}
		}
	case err != nil:
		m.status.State = types.RuntimeStateHeartbeat
		m.status.Awake = true
		m.status.Reason = "heartbeat-failed"
	case result != nil && result.Downtime:

		m.status.LastDowntimeSummary = strings.TrimSpace(result.DowntimeSummary)
		m.lastRoundHasUser = false
		m.lastRoundUser = ""
		m.lastRoundReply = ""
		m.lastRoundSleep = strings.TrimSpace(result.DowntimeSummary)
		m.status.Reason = "wanna-sleep"
		m.sleepCycleCount++
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
	m.sleepCycleCount = 0
	if m.isSleepTime(time.Now()) {
		m.postWakeFromSleep = true
		m.postWakeWorkCycle = 0
	}
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
	m.status.State = types.RuntimeStateDowntime
	m.status.Awake = false
	m.status.WakeSource = ""
	m.status.CurrentTask = ""
	m.status.CurrentRoundID = ""
	clearDominantRuntimeStatus(&m.status)
	m.status.LastDowntimeAt = nowMillis
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

func (m *magiRuntimeManager) RememberForegroundTurn(userMessage string, assistantReply string) {
	if m == nil {
		return
	}

	userMessage = strings.TrimSpace(userMessage)
	assistantReply = strings.TrimSpace(assistantReply)
	if userMessage == "" {
		return
	}

	m.mu.Lock()
	m.lastRoundHasUser = true
	m.lastRoundUser = userMessage
	m.lastRoundReply = assistantReply
	m.lastRoundSleep = ""
	m.mu.Unlock()
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

func (m *magiRuntimeManager) buildHeartbeatPassiveRecallBasisLocked() *types.PassiveRecallBasis {
	if m == nil {
		return nil
	}

	if m.lastRoundHasUser {
		queryParts := make([]string, 0, 2)
		if trimmedUser := strings.TrimSpace(m.lastRoundUser); trimmedUser != "" {
			queryParts = append(queryParts, trimmedUser)
		}
		if trimmedReply := strings.TrimSpace(m.lastRoundReply); trimmedReply != "" {
			queryParts = append(queryParts, trimmedReply)
		}
		query := strings.TrimSpace(strings.Join(queryParts, "\n"))
		if query != "" {
			return &types.PassiveRecallBasis{
				Type:           types.PassiveRecallBasisPreviousDialogue,
				Query:          query,
				UserMessage:    strings.TrimSpace(m.lastRoundUser),
				AssistantReply: strings.TrimSpace(m.lastRoundReply),
			}
		}
	}

	sleepSummary := strings.TrimSpace(m.lastRoundSleep)
	if sleepSummary == "" {
		sleepSummary = strings.TrimSpace(m.status.LastDowntimeSummary)
	}
	if sleepSummary == "" {
		return nil
	}
	return &types.PassiveRecallBasis{
		Type:         types.PassiveRecallBasisPreviousDowntime,
		Query:        sleepSummary,
		DowntimeSummary: sleepSummary,
	}
}

func buildHeartbeatTaskPreview(now time.Time) string {
	return fmt.Sprintf("heartbeat wake @ %s", now.Format(time.RFC3339))
}

func buildHeartbeatPrompt(now time.Time, sleepTime bool) string {
	if sleepTime {
		return prompts.BuildCoreSageHeartbeatSleepPrompt(now.Format(time.RFC3339))
	}
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
