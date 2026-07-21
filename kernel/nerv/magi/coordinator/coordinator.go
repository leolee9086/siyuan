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
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
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

// DominantSelectionObserver 接收主导者选举完成通知。
type DominantSelectionObserver interface {
	NotifyDominantSelected(roundID string, election *DominantElectionResult)
}

// ToolCallSnapshot 工具调用快照，记录最近一次调用的上下文。
// 用于实现超时未调用提醒等钩子（TODO: 全局提醒、辅助者提醒等更多钩子待实现）。
type ToolCallSnapshot struct {
	LastRound uint64            // 最近一次调用的心跳轮次
	Args      map[string]string // 从工具参数中提取的关键字段（由 ToolRemindPolicy.ContextKeys 定义）
	UpdatedAt time.Time         // 最近一次调用的时间
}

// Coordinator MAGI决策协调器
type Coordinator struct {
	collector *ResponseCollector
	avatar    *AvatarRuntime

	runtimeMu                 sync.Mutex
	dominantSelectionObserver DominantSelectionObserver
	clockRoundBySession       map[string]uint64 // 心跳总轮数（睡眠+清醒混合），仅用于时钟展示
	awakeRoundBySession       map[string]uint64 // 清醒心跳轮数，用于提醒系统计算
	sleepRoundBySession       map[string]uint64 // 睡眠心跳轮数
	workspaceSnapshotInterval uint64
	toolCallRecords           map[string]*ToolCallSnapshot        // tool name → 最近一次调用快照
	toolRemindPolicies        map[string]*config.ToolRemindPolicy // tool name → 提醒策略（初始化时构建）
}

// NewCoordinator 创建决策协调器
func NewCoordinator(collectionTimeout time.Duration) *Coordinator {
	c := &Coordinator{
		collector: NewResponseCollector(collectionTimeout),
		avatar:    NewAvatarRuntime(),

		clockRoundBySession:       map[string]uint64{},
		awakeRoundBySession:       map[string]uint64{},
		sleepRoundBySession:       map[string]uint64{},
		workspaceSnapshotInterval: defaultWorkspaceSnapshotInterval,
		toolCallRecords:           map[string]*ToolCallSnapshot{},
	}
	c.toolRemindPolicies = buildToolRemindPoliciesLocked()
	return c
}

// buildToolRemindPoliciesLocked 集中构建所有工具的提醒策略。
// 遍历所有定义的工具，提取设置了 RemindPolicy 的策略。
// 新增有提醒需求的工具只需在 ToolDef 中设置 Meta.RemindPolicy 即可自动纳入。
func buildToolRemindPoliciesLocked() map[string]*config.ToolRemindPolicy {
	defs := []config.ToolDef{
		config.BuildSendChannelMessageToolDef(),
		// TODO: 新增有提醒需求的工具在此处添加
	}
	m := map[string]*config.ToolRemindPolicy{}
	for _, d := range defs {
		if d.Meta.RemindPolicy != nil {
			m[d.Function.Name] = d.Meta.RemindPolicy
		}
	}
	return m
}

// SetDominantSelectionObserver 设置主导者选举监听器。
func (c *Coordinator) SetDominantSelectionObserver(observer DominantSelectionObserver) {
	c.dominantSelectionObserver = observer
}

// SetVotingConfig 设置投票配置，传播给 AvatarRuntime 和行动工具治理
func (c *Coordinator) SetVotingConfig(cfg VotingConfig) {
	c.avatar.SetVotingConfig(cfg)
	dominantActionToolGovernance.SetVotingConfig(cfg)
}

// SetWorkspaceSnapshotInterval 设置工作区快照的轮次间隔。
// interval 为 0 表示禁用快照。
func (c *Coordinator) SetWorkspaceSnapshotInterval(interval uint64) {
	if c == nil {
		return
	}
	c.runtimeMu.Lock()
	defer c.runtimeMu.Unlock()
	c.workspaceSnapshotInterval = interval
}

func (c *Coordinator) notifyDominantSelected(roundID string, election *DominantElectionResult) {
	if c == nil || election == nil {
		return
	}

	c.runtimeMu.Lock()
	observer := c.dominantSelectionObserver
	c.runtimeMu.Unlock()
	if observer == nil {
		return
	}

	observer.NotifyDominantSelected(roundID, election)
}

// CoordinateDecision 协调完整决策流程
// 1. 收集三贤人响应
// 2. 判断是否需要审慎决策（D-001: 严格只看Melchior工具调用）
// 3. 如需投票：执行投票 → 根据结果决定是否继续
// 4. 由主导者承担最终回复/统合职责
// 5. 返回最终响应
func (c *Coordinator) CoordinateDecision(
	ctx context.Context,
	sessionId string,
	melchior, balthazar, casper *sages.Sage,
	userMessage string,
	sourceCtx *types.RequestSourceContext,
	claimedRecentHistory []types.ClaimedHistoryMessage,
) (*types.Message, error) {
	return c.CoordinateDecisionWithOptions(
		ctx,
		sessionId,
		melchior,
		balthazar,
		casper,
		userMessage,
		sourceCtx,
		claimedRecentHistory,
		DecisionOptions{},
	)
}

type DecisionOptions struct {
	ReplyStreamObserver ReplyStreamObserver
}

func (c *Coordinator) CoordinateDecisionWithOptions(
	ctx context.Context,
	sessionId string,
	melchior, balthazar, casper *sages.Sage,
	userMessage string,
	sourceCtx *types.RequestSourceContext,
	claimedRecentHistory []types.ClaimedHistoryMessage,
	options DecisionOptions,
) (*types.Message, error) {
	// 生成roundId
	roundId := util.RandString(16)

	// 推送轮次开始
	if err := websocket.PushRoundStarted(websocket.RuntimeMonitorSessionID, roundId, userMessage); err != nil {
		logging.LogWarnf("推送轮次开始失败: %v", err)
	}

	passiveRecallBasis := buildExternalPassiveRecallBasis(userMessage, sourceCtx)
	sourceAwareUserInputBySage := c.buildSourceAwareUserInputBySage(
		sessionId,
		userMessage,
		sourceCtx,
		claimedRecentHistory,
		passiveRecallBasis,
	)
	sourceAwareUserInput := resolveSourceAwareInputForSage(sourceAwareUserInputBySage, "melchior", userMessage)

	// 非绝对可信来源优先走 Avatar 路径：若无绑定则创建，有绑定则复用直答。
	if sourceCtx != nil && !sourceCtx.DirectResponseAllowed {
		msg, err := c.avatar.DispatchForSourceWithReplyStream(
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
			options.ReplyStreamObserver,
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
		attachWebSearchMeta(msg, collectWebSearchMetaFromSages(sessionId, melchior, balthazar, casper))
		if err := websocket.PushConsensusEmitted(websocket.RuntimeMonitorSessionID, roundId, msg); err != nil {
			logging.LogWarnf("推送共识发出失败: %v", err)
		}
		return msg, nil
	}

	msg, _, err := c.coordinateDominantDirectReplyWithReplyStream(
		ctx,
		sessionId,
		roundId,
		melchior,
		balthazar,
		casper,
		userMessage,
		sourceAwareUserInputBySage,
		sourceCtx,
		options.ReplyStreamObserver,
	)
	if err != nil {
		if pushErr := websocket.PushRoundFailed(websocket.RuntimeMonitorSessionID, roundId, err.Error()); pushErr != nil {
			logging.LogWarnf("推送轮次失败事件失败: %v", pushErr)
		}
		return nil, err
	}
	attachWebSearchMeta(msg, collectWebSearchMetaFromSages(sessionId, melchior, balthazar, casper))

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
			"source": types.ConsensusSourceDominantSynthesis,
			"vote": map[string]interface{}{
				"passed": false,
			},
		},
	}
}

// buildConsensusMessage 构建共识消息
func (c *Coordinator) buildConsensusMessage(
	content string,
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
		"source": types.ConsensusSourceDominantSynthesis,
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
		Content:   content,
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
	roundOrdinal := c.nextClockRoundOrdinal(sessionID)
	return c.buildSourceAwareUserInputWithRoundOrdinal(
		userMessage,
		sourceCtx,
		claimedRecentHistory,
		nil,
		roundOrdinal,
	)
}

func (c *Coordinator) buildSourceAwareUserInputBySage(
	sessionID, userMessage string,
	sourceCtx *types.RequestSourceContext,
	claimedRecentHistory []types.ClaimedHistoryMessage,
	passiveRecallBasis *types.PassiveRecallBasis,
) map[string]string {
	roundOrdinal := c.nextClockRoundOrdinal(sessionID)
	passiveRecallBySage := buildPassiveRecallPayloadsBySage(passiveRecallBasis)
	inputs := map[string]string{}
	for _, sageName := range []string{"melchior", "balthazar", "casper"} {
		var passiveRecall interface{}
		if passiveRecallBySage != nil {
			passiveRecall = passiveRecallBySage[sageName]
		}
		inputs[sageName] = c.buildSourceAwareUserInputWithRoundOrdinal(
			userMessage,
			sourceCtx,
			claimedRecentHistory,
			passiveRecall,
			roundOrdinal,
		)
	}
	return inputs
}

func (c *Coordinator) buildSourceAwareUserInputWithRoundOrdinal(
	userMessage string,
	sourceCtx *types.RequestSourceContext,
	claimedRecentHistory []types.ClaimedHistoryMessage,
	passiveRecall interface{},
	roundOrdinal uint64,
) string {
	userMessage = strings.TrimSpace(userMessage)
	if sourceCtx == nil {
		return userMessage
	}

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
	sourceContent := userMessage
	if sourceContent == "" {
		sourceContent = buildClaimedHistoryInstruction(speakerLabel)
	}
	identityDecl := prompts.BuildIdentityDeclarationBlock(
		loginIdentity,
		string(sourceCtx.AuthStrength),
		string(sourceCtx.Channel),
		string(sourceCtx.TrustBase),
		sourceCtx.InterfaceKind,
	)
	return prompts.BuildSourceAwareUserInputFull(
		sourceContent,
		payload,
		claimedHistoryPayload,
		runtimeClock,
		workspaceSnapshot,
		passiveRecall,
		identityDecl,
	)
}

func buildExternalPassiveRecallBasis(
	userMessage string,
	sourceCtx *types.RequestSourceContext,
) *types.PassiveRecallBasis {
	if sourceCtx == nil || strings.TrimSpace(sourceCtx.InterfaceKind) != "magi-main-ui" {
		return nil
	}
	userMessage = strings.TrimSpace(userMessage)
	if userMessage == "" {
		return nil
	}
	return &types.PassiveRecallBasis{
		Type:        types.PassiveRecallBasisUserMessage,
		Query:       userMessage,
		UserMessage: userMessage,
	}
}

func resolveSourceAwareInputForSage(
	inputsBySage map[string]string,
	sageName string,
	fallback string,
) string {
	if len(inputsBySage) == 0 {
		return fallback
	}
	if input := strings.TrimSpace(inputsBySage[strings.TrimSpace(sageName)]); input != "" {
		return input
	}
	if input := strings.TrimSpace(inputsBySage["melchior"]); input != "" {
		return input
	}
	return fallback
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

func (c *Coordinator) nextClockRoundOrdinal(sessionID string) uint64 {
	key := strings.TrimSpace(sessionID)
	if key == "" {
		key = "__magi_anonymous_session__"
	}

	c.runtimeMu.Lock()
	defer c.runtimeMu.Unlock()

	next := c.clockRoundBySession[key] + 1
	c.clockRoundBySession[key] = next
	return next
}

// nextAwakeRoundOrdinal 递增并返回清醒心跳轮次数。用于提醒系统，与睡眠心跳轮次隔离。
func (c *Coordinator) nextAwakeRoundOrdinal(sessionID string) uint64 {
	key := strings.TrimSpace(sessionID)
	if key == "" {
		key = "__magi_anonymous_session__"
	}
	c.runtimeMu.Lock()
	defer c.runtimeMu.Unlock()
	next := c.awakeRoundBySession[key] + 1
	c.awakeRoundBySession[key] = next
	return next
}

// currentAwakeRoundOrdinal 获取当前清醒心跳轮次数，不递增。
func (c *Coordinator) currentAwakeRoundOrdinal(sessionID string) uint64 {
	key := strings.TrimSpace(sessionID)
	if key == "" {
		key = "__magi_anonymous_session__"
	}
	c.runtimeMu.Lock()
	defer c.runtimeMu.Unlock()
	return c.awakeRoundBySession[key]
}

// nextSleepRoundOrdinal 递增并返回睡眠心跳轮次数。
func (c *Coordinator) nextSleepRoundOrdinal(sessionID string) uint64 {
	key := strings.TrimSpace(sessionID)
	if key == "" {
		key = "__magi_anonymous_session__"
	}
	c.runtimeMu.Lock()
	defer c.runtimeMu.Unlock()
	next := c.sleepRoundBySession[key] + 1
	c.sleepRoundBySession[key] = next
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
