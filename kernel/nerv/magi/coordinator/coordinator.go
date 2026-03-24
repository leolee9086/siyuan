// Package coordinator 提供MAGI决策协调功能
package coordinator

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	"github.com/siyuan-note/siyuan/kernel/util"
)

var ErrAvatarDispatchRequired = errors.New("source requires avatar dispatch and direct MAGI response is disabled")

const defaultWorkspaceSnapshotInterval uint64 = 5

// IsAvatarDispatchRequired 判断错误是否为“仅允许Avatar路径”的路由阻断。
func IsAvatarDispatchRequired(err error) bool {
	return errors.Is(err, ErrAvatarDispatchRequired)
}

// Coordinator MAGI决策协调器
type Coordinator struct {
	collector *ResponseCollector
	trinity   *TrinityCoordinator
	avatar    *AvatarRuntime

	runtimeMu                 sync.Mutex
	roundBySession            map[string]uint64
	workspaceSnapshotInterval uint64
}

// NewCoordinator 创建决策协调器
func NewCoordinator(collectionTimeout time.Duration) *Coordinator {
	return &Coordinator{
		collector: NewResponseCollector(collectionTimeout),
		trinity:   NewTrinityCoordinator(collectionTimeout),
		avatar:    NewAvatarRuntime(),

		roundBySession:            map[string]uint64{},
		workspaceSnapshotInterval: defaultWorkspaceSnapshotInterval,
	}
}

// CoordinateDecision 协调完整决策流程
// 1. 收集三贤人响应
// 2. 判断是否需要审慎决策（D-001: 严格只看Melchior工具调用）
// 3. 如需投票：执行投票 → 根据结果决定是否继续
// 4. Trinity统合
// 5. 返回最终响应
func (c *Coordinator) CoordinateDecision(
	ctx context.Context,
	sessionId string,
	melchior, balthazar, casper, trinity *sages.Sage,
	userMessage string,
	sourceCtx *types.RequestSourceContext,
	claimedRecentHistory []types.ClaimedHistoryMessage,
) (*types.Message, error) {
	// 生成roundId
	roundId := util.RandString(16)

	// 推送轮次开始
	if err := websocket.PushRoundStarted(websocket.RuntimeMonitorSessionID, roundId, userMessage); err != nil {
		logging.LogWarnf("推送轮次开始失败: %v", err)
	}

	sourceAwareUserInput := c.buildSourceAwareUserInput(
		sessionId,
		userMessage,
		sourceCtx,
		claimedRecentHistory,
	)

	// 非绝对可信来源优先走 Avatar 路径：若无绑定则创建，有绑定则复用直答。
	if sourceCtx != nil && !sourceCtx.DirectResponseAllowed {
		msg, err := c.avatar.DispatchForSource(
			ctx,
			sessionId,
			roundId,
			userMessage,
			sourceAwareUserInput,
			sourceCtx,
			c.collector,
			melchior,
			balthazar,
			casper,
			trinity,
		)
		if err != nil {
			if pushErr := websocket.PushRoundFailed(websocket.RuntimeMonitorSessionID, roundId, err.Error()); pushErr != nil {
				logging.LogWarnf("推送轮次失败事件失败: %v", pushErr)
			}
			if IsAvatarUnavailable(err) {
				return nil, err
			}
			return nil, fmt.Errorf(
				"%w: channel=%s interface_kind=%s source_session_key=%s, dispatch_error=%v",
				ErrAvatarDispatchRequired,
				sourceCtx.Channel,
				sourceCtx.InterfaceKind,
				sourceCtx.SourceSessionKey,
				err,
			)
		}
		if err := websocket.PushConsensusEmitted(websocket.RuntimeMonitorSessionID, roundId, msg); err != nil {
			logging.LogWarnf("推送共识发出失败: %v", err)
		}
		return msg, nil
	}

	// 步骤1: 收集三贤人响应
	responses, err := c.collector.CollectResponses(
		ctx,
		sessionId,
		roundId,
		melchior,
		balthazar,
		casper,
		userMessage,
		sourceAwareUserInput,
	)
	if err != nil {
		// 推送轮次失败
		if pushErr := websocket.PushRoundFailed(websocket.RuntimeMonitorSessionID, roundId, err.Error()); pushErr != nil {
			logging.LogWarnf("推送轮次失败事件失败: %v", pushErr)
		}
		return nil, fmt.Errorf("收集贤者响应失败: %w", err)
	}

	// 步骤2: 判断是否需要审慎决策（D-001: 只看Melchior的requiresDeliberation）
	requiresDeliberation := c.checkDeliberationRequired(responses)

	var voteResult *VoteResult

	// 步骤3: 如需投票，执行投票流程
	if requiresDeliberation {
		voteResult, err = c.executeVoting(ctx, sessionId, roundId, melchior, balthazar, casper, responses, userMessage)
		if err != nil {
			// 推送轮次失败
			if pushErr := websocket.PushRoundFailed(websocket.RuntimeMonitorSessionID, roundId, err.Error()); pushErr != nil {
				logging.LogWarnf("推送轮次失败事件失败: %v", pushErr)
			}
			return nil, fmt.Errorf("投票流程失败: %w", err)
		}

		// 如果投票未通过，返回否决消息
		if !voteResult.Passed {
			msg := c.buildRejectionMessage()
			// 推送共识发出
			if err := websocket.PushConsensusEmitted(websocket.RuntimeMonitorSessionID, roundId, msg); err != nil {
				logging.LogWarnf("推送共识发出失败: %v", err)
			}
			return msg, nil
		}
	}

	// 步骤4: Trinity统合
	trinityResult, err := c.trinity.HandleTrinitySummary(ctx, sessionId, roundId, trinity, responses, sourceAwareUserInput)
	if err != nil {
		// 推送轮次失败
		if pushErr := websocket.PushRoundFailed(websocket.RuntimeMonitorSessionID, roundId, err.Error()); pushErr != nil {
			logging.LogWarnf("推送轮次失败事件失败: %v", pushErr)
		}
		return nil, fmt.Errorf("Trinity统合失败: %w", err)
	}

	// 步骤5: 构建最终响应
	msg := c.buildConsensusMessage(trinityResult, requiresDeliberation, voteResult, sourceCtx)

	// 推送共识发出
	if err := websocket.PushConsensusEmitted(websocket.RuntimeMonitorSessionID, roundId, msg); err != nil {
		logging.LogWarnf("推送共识发出失败: %v", err)
	}

	return msg, nil
}

// checkDeliberationRequired 检查是否需要审慎决策
// D-001: 严格只看Melchior的requiresDeliberation字段
func (c *Coordinator) checkDeliberationRequired(responses []types.SageResponse) bool {
	for _, resp := range responses {
		if resp.Seel == "melchior" {
			return resp.RequiresDeliberation
		}
	}
	return false
}

// executeVoting 执行投票流程
func (c *Coordinator) executeVoting(
	ctx context.Context,
	sessionId, roundId string,
	melchior, balthazar, casper *sages.Sage,
	responses []types.SageResponse,
	userMessage string,
) (*VoteResult, error) {
	// 提取Melchior的结论和审慎决策信息
	var melchiorConclusion string
	var proposedAction string
	var deliberationInitiator string
	var deliberationReason string
	for _, resp := range responses {
		if resp.Seel == "melchior" {
			melchiorConclusion = resp.Content
			if resp.RequiresDeliberation {
				deliberationInitiator = resp.Seel
				deliberationReason = resp.DeliberationReason
				proposedAction = resp.ProposedAction
				logging.LogInfof("executeVoting: 检测到审慎决策 - 发起者=%s, 原因=%s, 提案=%s",
					deliberationInitiator, deliberationReason, proposedAction)
			}
			break
		}
	}

	// 如果 Melchior 没有提供提案，直接报错
	if proposedAction == "" {
		return nil, fmt.Errorf("Melchior 发起审慎决策但未提供行动提案（proposed_action 字段为空）")
	}

	// 构建投票上下文
	voteCtx := VoteContext{
		UserMessage:        userMessage,
		MelchiorConclusion: melchiorConclusion,
	}

	// 执行投票
	return ProcessVoting(ctx, sessionId, roundId, balthazar, casper, proposedAction, voteCtx, deliberationInitiator, deliberationReason)
}

// buildRejectionMessage 构建否决消息
func (c *Coordinator) buildRejectionMessage() *types.Message {
	return &types.Message{
		ID:        "consensus-" + util.RandString(12),
		Type:      types.TypeConsensus,
		Content:   "经过审慎决策，该提案未获得通过。",
		Status:    types.StatusSuccess,
		Timestamp: time.Now().UnixMilli(),
		Meta: map[string]interface{}{
			"mode":   types.ConsensusModeCritical,
			"source": types.ConsensusSourceTrinitySynthesis,
			"vote": map[string]interface{}{
				"passed": false,
			},
		},
	}
}

// buildConsensusMessage 构建共识消息
func (c *Coordinator) buildConsensusMessage(
	trinityResult *TrinityResult,
	requiresDeliberation bool,
	voteResult *VoteResult,
	sourceCtx *types.RequestSourceContext,
) *types.Message {
	mode := types.ConsensusModeStandard
	if requiresDeliberation {
		mode = types.ConsensusModeCritical
	}

	meta := map[string]interface{}{
		"mode":   mode,
		"source": types.ConsensusSourceTrinitySynthesis,
	}

	if voteResult != nil {
		meta["vote"] = map[string]interface{}{
			"melchior":  voteResult.Melchior,
			"balthazar": voteResult.Balthazar,
			"casper":    voteResult.Casper,
			"passed":    voteResult.Passed,
		}
	}

	if sourceCtx != nil {
		identityID := strings.TrimSpace(sourceCtx.IdentityID)
		if identityID == "" {
			identityID = strings.TrimSpace(sourceCtx.PrincipalID)
		}
		nickname := strings.TrimSpace(sourceCtx.Nickname)
		if nickname == "" {
			nickname = identityID
		}
		meta["requestSource"] = map[string]interface{}{
			"requestId":             sourceCtx.RequestID,
			"channel":               sourceCtx.Channel,
			"principalId":           sourceCtx.PrincipalID,
			"identityId":            identityID,
			"nickname":              nickname,
			"interfaceId":           sourceCtx.InterfaceID,
			"interfaceKind":         sourceCtx.InterfaceKind,
			"sourceSessionKey":      sourceCtx.SourceSessionKey,
			"directResponseAllowed": sourceCtx.DirectResponseAllowed,
			"trustBase":             sourceCtx.TrustBase,
			"riskLevel":             sourceCtx.RiskLevel,
			"authStrength":          sourceCtx.AuthStrength,
			"modelIntent":           sourceCtx.ModelIntent,
		}
	}

	return &types.Message{
		ID:        "consensus-" + util.RandString(12),
		Type:      types.TypeConsensus,
		Content:   trinityResult.Content,
		Status:    types.StatusSuccess,
		Timestamp: time.Now().UnixMilli(),
		Meta:      meta,
	}
}

func (c *Coordinator) buildSourceAwareUserInput(
	sessionID, userMessage string,
	sourceCtx *types.RequestSourceContext,
	claimedRecentHistory []types.ClaimedHistoryMessage,
) string {
	if sourceCtx == nil {
		return userMessage
	}

	roundOrdinal := c.nextRoundOrdinal(sessionID)
	nickname := strings.TrimSpace(sourceCtx.Nickname)
	loginIdentity := resolveSourceLoginIdentity(sourceCtx)
	speakerLabel := resolveClaimedHistorySpeaker(sourceCtx)
	permissions := buildSourcePermissionEnvelope(sourceCtx)
	if nickname == "" {
		nickname = speakerLabel
	}

	payload := map[string]interface{}{
		"channel":       sourceCtx.Channel,
		"source":        sourceCtx.Channel,
		"trustBase":     sourceCtx.TrustBase,
		"riskLevel":     sourceCtx.RiskLevel,
		"principal":     sourceCtx.PrincipalID,
		"identityId":    loginIdentity,
		"nickname":      nickname,
		"speaker":       speakerLabel,
		"loginIdentity": loginIdentity,
		"permissions":   permissions,
		"interface":     sourceCtx.InterfaceID,
		"interfaceKind": sourceCtx.InterfaceKind,
		"conversation":  sourceCtx.ConversationID,
		"authStrength":  sourceCtx.AuthStrength,
	}

	claimedHistoryPayload := map[string]interface{}{
		"channel":       sourceCtx.Channel,
		"trustBase":     sourceCtx.TrustBase,
		"riskLevel":     sourceCtx.RiskLevel,
		"speaker":       speakerLabel,
		"loginIdentity": loginIdentity,
		"permissions":   permissions,
		"messages":      claimedRecentHistory,
	}
	runtimeClock := c.buildRuntimeClockPayload(roundOrdinal)
	workspaceSnapshot := c.buildWorkspaceSnapshotPayload(roundOrdinal, sourceCtx)
	return prompts.BuildSourceAwareUserInputWithRuntime(
		buildClaimedHistoryInstruction(speakerLabel),
		payload,
		claimedHistoryPayload,
		runtimeClock,
		workspaceSnapshot,
	)
}

func resolveSourceLoginIdentity(sourceCtx *types.RequestSourceContext) string {
	if sourceCtx == nil {
		return "身份不明"
	}
	identityID := strings.TrimSpace(sourceCtx.IdentityID)
	if identityID == "" {
		identityID = strings.TrimSpace(sourceCtx.PrincipalID)
	}
	if identityID == "" {
		return "身份不明"
	}
	return identityID
}

func resolveClaimedHistorySpeaker(sourceCtx *types.RequestSourceContext) string {
	if sourceCtx == nil {
		return "身份不明"
	}
	nickname := strings.TrimSpace(sourceCtx.Nickname)
	if nickname != "" {
		return nickname
	}
	return "身份不明"
}

func buildSourcePermissionEnvelope(sourceCtx *types.RequestSourceContext) map[string]interface{} {
	if sourceCtx == nil {
		return map[string]interface{}{
			"routeClass":            "unknown",
			"authStrength":          "unknown",
			"directResponseAllowed": false,
		}
	}
	routeClass := "unknown"
	if sourceCtx.RawAttributes != nil {
		if raw := strings.TrimSpace(sourceCtx.RawAttributes["routeClass"]); raw != "" {
			routeClass = raw
		}
	}
	return map[string]interface{}{
		"routeClass":            routeClass,
		"authStrength":          sourceCtx.AuthStrength,
		"directResponseAllowed": sourceCtx.DirectResponseAllowed,
	}
}

func buildClaimedHistoryInstruction(speakerLabel string) string {
	if strings.TrimSpace(speakerLabel) == "" {
		speakerLabel = "身份不明"
	}
	return fmt.Sprintf(
		"这是某个渠道宣称最新的消息历史。你要结合 request_source 与 claimed_recent_history，自行理解和判断这段消息历史中<%s>在表达什么，然后继续回应。",
		speakerLabel,
	)
}

func (c *Coordinator) nextRoundOrdinal(sessionID string) uint64 {
	key := strings.TrimSpace(sessionID)
	if key == "" {
		key = "__magi_anonymous_session__"
	}

	c.runtimeMu.Lock()
	defer c.runtimeMu.Unlock()

	next := c.roundBySession[key] + 1
	c.roundBySession[key] = next
	return next
}

func (c *Coordinator) buildRuntimeClockPayload(roundOrdinal uint64) map[string]interface{} {
	serverMillis := util.CurrentTimeMillis()
	now := util.Millisecond2Time(serverMillis)
	return map[string]interface{}{
		"serverTimeMillis": serverMillis,
		"now":              now.Format(time.RFC3339),
		"today":            now.Format("2006-01-02"),
		"timezone":         now.Location().String(),
		"round":            roundOrdinal,
	}
}

func (c *Coordinator) buildWorkspaceSnapshotPayload(roundOrdinal uint64, sourceCtx *types.RequestSourceContext) map[string]interface{} {
	if sourceCtx == nil {
		return nil
	}
	if sourceCtx.TrustBase != types.TrustLevelHigh {
		return nil
	}
	if c.workspaceSnapshotInterval == 0 || roundOrdinal%c.workspaceSnapshotInterval != 0 {
		return nil
	}

	workspaceDir := strings.TrimSpace(util.WorkspaceDir)
	if workspaceDir == "" {
		return nil
	}

	workspaceDir = filepath.Clean(workspaceDir)
	workspaceName := strings.TrimSpace(util.WorkspaceName)
	if workspaceName == "" {
		workspaceName = filepath.Base(workspaceDir)
	}

	snapshot := map[string]interface{}{
		"name":      workspaceName,
		"pathHint":  compactWorkspacePathHint(workspaceDir),
		"readOnly":  util.ReadOnly,
		"container": util.Container,
	}

	if stat, err := os.Stat(workspaceDir); err == nil {
		snapshot["exists"] = stat.IsDir()
		if stat.IsDir() {
			if entries, readErr := os.ReadDir(workspaceDir); readErr == nil {
				snapshot["topLevelEntries"] = len(entries)
			}
		}
	}
	return snapshot
}

func compactWorkspacePathHint(absPath string) string {
	segments := strings.FieldsFunc(absPath, func(r rune) bool {
		return r == '/' || r == '\\'
	})
	if len(segments) == 0 {
		return ""
	}
	if len(segments) == 1 {
		return segments[0]
	}
	return ".../" + segments[len(segments)-2] + "/" + segments[len(segments)-1]
}

// GetTrinityCoordinator 暴露Trinity协调器（用于ATF等特殊场景）
func (c *Coordinator) GetTrinityCoordinator() *TrinityCoordinator {
	return c.trinity
}
