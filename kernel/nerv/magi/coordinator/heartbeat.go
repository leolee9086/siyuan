package coordinator

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	"github.com/siyuan-note/siyuan/kernel/util"
)

type HeartbeatDecisionResult struct {
	RoundID         string
	Downtime        bool
	DowntimeSage    string
	DowntimeSummary string
	DominantSeel    string
	DominantStance  string
	Responses       []types.SageResponse
}

func (c *Coordinator) CoordinateHeartbeat(
	ctx context.Context,
	sessionID string,
	melchior, balthazar, casper *sages.Sage,
	userMessage string,
	sourceCtx *types.RequestSourceContext,
	passiveRecallBasis *types.PassiveRecallBasis,
	isSleepTime ...bool,
) (*HeartbeatDecisionResult, error) {
	if c == nil {
		return nil, fmt.Errorf("coordinator is nil")
	}

	roundID := util.RandString(16)
	melchior.MarkCurrentRoundHeartbeat(sessionID, roundID)
	balthazar.MarkCurrentRoundHeartbeat(sessionID, roundID)
	casper.MarkCurrentRoundHeartbeat(sessionID, roundID)
	if err := websocket.PushRoundStarted(sessionID, roundID, userMessage); err != nil {
		logging.LogWarnf("推送心跳轮次开始失败: %v", err)
	}

	defer dominantActionToolGovernance.UnregisterRound(sessionID, roundID)

	claimedHistory := []types.ClaimedHistoryMessage{
		{
			Role:    string(types.RoleUser),
			Content: userMessage,
		},
	}
	sourceAwareUserInputBySage := c.buildSourceAwareUserInputBySage(
		sessionID,
		userMessage,
		sourceCtx,
		claimedHistory,
		passiveRecallBasis,
	)
	sourceAwareUserInput := resolveSourceAwareInputForSage(sourceAwareUserInputBySage, "melchior", userMessage)

	sleepMode := len(isSleepTime) > 0 && isSleepTime[0]
	var dominantSage *sages.Sage
	if sleepMode {
		c.nextSleepRoundOrdinal(sessionID)
		// 睡眠模式的天马行空要求属于服务端系统指令，使用 <source=seraph> 信封封装，
		// 避免裸文本出现在 </source> 之外干扰信任判定。
		imaginativeInstr := "\n\n" + prompts.BuildSourcedMessageContent("seraph", "额外要求：你的记录内容越是天马行空越好。")
		for sageName, input := range sourceAwareUserInputBySage {
			if sageName == "melchior" {
				continue
			}
			sourceAwareUserInputBySage[sageName] = input + imaginativeInstr
		}
	} else {
		c.nextAwakeRoundOrdinal(sessionID)

		actionPlans, planErr := collectActionPlans(ctx, sessionID, melchior, balthazar, casper, userMessage)
		if planErr != nil {
			logging.LogWarnf("行动计划收集失败（降级为无计划选举）: %v", planErr)
			actionPlans = nil
		}

		dominantResult, err := electDominantSageWithExclusionsAndSituations(
			ctx, sessionID, melchior, balthazar, casper, userMessage, nil, nil, actionPlans,
		)
		if err != nil {
			return nil, fmt.Errorf("心跳主导选举失败: %w", err)
		}
		dominantSage, err = resolveDominantSage(dominantResult, melchior, balthazar, casper)
		if err != nil {
			return nil, err
		}
		dominantActionToolGovernance.RegisterRound(sessionID, roundID, userMessage, dominantSage, melchior, balthazar, casper)

		// 注入工具调用提醒（仅非睡眠模式，基于上一轮的记录）。
		// 提醒是服务端生成的系统指令，使用 <source=seraph> 信封封装，
		// 避免裸文本出现在 </source> 之外干扰信任判定。
		reminders := c.buildHeartbeatReminders(sessionID, dominantSage)
		for sageName, reminder := range reminders {
			if reminder != "" {
				sourceAwareUserInputBySage[sageName] += "\n\n" + prompts.BuildSourcedMessageContent("seraph", reminder)
			}
		}
	}
	collection, err := c.collector.CollectHeartbeatResponses(
		ctx,
		sessionID,
		roundID,
		melchior,
		balthazar,
		casper,
		userMessage,
		sourceAwareUserInput,
		sourceAwareUserInputBySage,
		buildHeartbeatRuntimeToolsBySage(sleepMode, dominantSage),
		buildHeartbeatRuntimeToolChoiceBySage(sleepMode),
		sleepMode,
	)
	if err != nil {
		// context 取消时有部分结果也返回，供外部做中断摘要
		if errors.Is(err, context.Canceled) && collection != nil && len(collection.Responses) > 0 {
			c.updateToolCallRecords(collection.Responses, sessionID)
			compressArchivedQueryResults(sessionID, melchior, balthazar, casper)
			return &HeartbeatDecisionResult{
				RoundID:         roundID,
				Downtime:        false,
				DowntimeSage:    "",
				DowntimeSummary: "",
				DominantSeel:    "",
				DominantStance:  "",
				Responses:       collection.Responses,
			}, context.Canceled
		} else {
			if pushErr := websocket.PushRoundFailed(sessionID, roundID, err.Error()); pushErr != nil {
				logging.LogWarnf("推送心跳轮次失败事件失败: %v", pushErr)
			}
			return nil, err
		}
	} else {
		// 更新工具调用记录（无论是否睡眠模式，均采集本次轮次的工具调用）
		c.updateToolCallRecords(collection.Responses, sessionID)
	}

	sleepSummary := ""
	sleeper := collection.DowntimeSage
	dominantSeel := ""
	dominantStance := ""
	if collection.AllDowntime {
		var dominantResult *DominantElectionResult
		if sleepMode {
			sleepSummary, dominantResult, err = c.finalizeHeartbeatSleepRound(
				ctx, sessionID, roundID, melchior, balthazar, casper, collection.Responses,
			)
		} else {
			sleepSummary, dominantResult, err = c.finalizeHeartbeatRestRound(
				ctx, sessionID, roundID, melchior, balthazar, casper, collection.Responses,
			)
		}
		if err != nil {
			if pushErr := websocket.PushRoundFailed(sessionID, roundID, err.Error()); pushErr != nil {
				logging.LogWarnf("推送心跳轮次失败事件失败: %v", pushErr)
			}
			return nil, err
		}
		if dominantResult != nil {
			dominantSeel = dominantResult.DominantSeelName
			dominantStance = dominantResult.DominantStance
		}
		sleeper = "all"
	}

	compressArchivedQueryResults(sessionID, melchior, balthazar, casper)

	return &HeartbeatDecisionResult{
		RoundID:         roundID,
		Downtime:        collection.AllDowntime,
		DowntimeSage:    sleeper,
		DowntimeSummary: sleepSummary,
		DominantSeel:    dominantSeel,
		DominantStance:  dominantStance,
		Responses:       collection.Responses,
	}, nil
}

func buildHeartbeatRuntimeToolsBySage(sleepMode bool, dominantSage *sages.Sage) map[string][]openai.Tool {
	if sleepMode {
		return map[string][]openai.Tool{
			"melchior":  {buildRuntimeTool(config.BuildWannaSleepPlanToolDef())},
			"balthazar": {buildRuntimeTool(config.BuildWannaSleepDreamToolDef())},
			"casper":    {buildRuntimeTool(config.BuildWannaSleepRecordToolDef())},
		}
	}
	sharedReadingTools := buildHeartbeatReadingRuntimeTools()
	sharedActionTools := buildHeartbeatActionRuntimeTools()

	dominantName := ""
	if dominantSage != nil {
		dominantName = strings.TrimSpace(dominantSage.GetName())
	}

	buildTools := func(sageName string) []openai.Tool {
		tools := make([]openai.Tool, len(sharedReadingTools))
		copy(tools, sharedReadingTools)
		if sageName == dominantName {
			tools = append(tools, sharedActionTools...)
		}
		return tools
	}

	return map[string][]openai.Tool{
		"melchior":  buildTools("melchior"),
		"balthazar": buildTools("balthazar"),
		"casper":    buildTools("casper"),
	}
}

// buildWorkLogRestToolForSage 返回对应贤者的工作日志工具。仅非睡眠模式使用。
func buildWorkLogRestToolForSage(sageName string) openai.Tool {
	switch strings.TrimSpace(sageName) {
	case "melchior":
		return buildRuntimeTool(config.BuildWannaRestPlanToolDef())
	case "balthazar":
		return buildRuntimeTool(config.BuildWannaRestDreamToolDef())
	case "casper":
		return buildRuntimeTool(config.BuildWannaRestRecordToolDef())
	default:
		return openai.Tool{}
	}
}

func buildHeartbeatActionRuntimeTools() []openai.Tool {
	tools := []openai.Tool{
		buildRuntimeTool(config.BuildWriteDiaryToolDef()),
		buildRuntimeTool(config.BuildCreateNoteDocumentToolDef()),
		buildRuntimeTool(config.BuildAppendNoteBlocksToolDef()),
		buildRuntimeTool(config.BuildModifyNoteBlockToolDef()),
		buildRuntimeTool(config.BuildRevertNoteBlockToolDef()),
		buildRuntimeTool(config.BuildSendChannelMessageToolDef()),
	}
	if util.IsForgeMode() {
		tools = append(
			tools,
			buildRuntimeTool(config.BuildForgeDevRepoEditToolDef()),
			buildRuntimeTool(config.BuildForgeDevRepoBatchReplaceToolDef()),
			buildRuntimeTool(config.BuildForgeDevRepoBashToolDef()),
		)
	}
	return tools
}

func buildHeartbeatReadingRuntimeTools() []openai.Tool {
	tools := []openai.Tool{
		buildRuntimeTool(config.BuildNoteKeywordSearchToolDef()),
		buildRuntimeTool(config.BuildNoteByIDReadToolDef()),
		buildRuntimeTool(config.BuildSearchWebToolDef()),
		buildRuntimeTool(config.BuildFetchWebPageToolDef()),
		buildRuntimeTool(config.BuildInspectWebSearchEnginesToolDef()),
		buildRuntimeTool(config.BuildListMagiChannelsToolDef()),
		buildRuntimeTool(config.BuildListMagiContactsToolDef()),
	}
	if util.IsForgeMode() {
		tools = append(
			tools,
			buildRuntimeTool(config.BuildForgeDevRepoListToolDef()),
			buildRuntimeTool(config.BuildForgeDevRepoReadToolDef()),
			buildRuntimeTool(config.BuildForgeDevRepoSearchToolDef()),
		)
	}
	return tools
}

func buildHeartbeatRuntimeToolChoiceBySage(_ bool) map[string]any {
	return nil
}

// updateToolCallRecords 遍历贤者响应，提取有提醒策略的工具调用并更新快照。
// 仅记录清醒心跳轮次，与睡眠心跳轮次隔离。
// 全局提醒、辅助者提醒等更多钩子的记录更新在此统一完成，待实现。
func (c *Coordinator) updateToolCallRecords(responses []types.SageResponse, sessionID string) {
	if c == nil || len(c.toolRemindPolicies) == 0 {
		return
	}
	currentRound := c.currentAwakeRoundOrdinal(sessionID)
	now := time.Now()

	for _, resp := range responses {
		argsByName := resp.ToolArgumentsByName
		for toolName, argsList := range argsByName {
			policy, ok := c.toolRemindPolicies[toolName]
			if !ok || policy == nil || len(argsList) == 0 {
				continue
			}
			// 用最后一次参数更新记录
			rawArgs := argsList[len(argsList)-1]
			snapshot := &ToolCallSnapshot{
				LastRound: currentRound,
				Args:      extractToolCallContext(rawArgs, policy.ContextKeys),
				UpdatedAt: now,
			}
			c.runtimeMu.Lock()
			c.toolCallRecords[toolName] = snapshot
			c.runtimeMu.Unlock()
		}
	}
}

// extractToolCallContext 从工具调用参数的 JSON 中提取指定字段的值。
func extractToolCallContext(rawArgs string, keys []string) map[string]string {
	if len(keys) == 0 || strings.TrimSpace(rawArgs) == "" {
		return nil
	}
	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(rawArgs), &parsed); err != nil {
		return nil
	}
	result := map[string]string{}
	for _, key := range keys {
		if v, ok := parsed[key]; ok {
			if s, ok := v.(string); ok {
				result[key] = s
			}
		}
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

// buildHeartbeatReminders 构建当前轮次需要注入的提醒，按贤者名称返回。
// 根据 RemindScope 分发到不同贤者：
//   - RemindScopeGlobal：所有贤者
//   - RemindScopeDominant：仅主导贤者
//   - RemindScopeAssistant：仅辅助贤者
//
// TODO: 当前 RemindPolicy 尚未声明 Scope，统一按主导者分发。后续在 ToolRemindPolicy 中加入 Scope 字段后，此处应区分三种钩子。
func (c *Coordinator) buildHeartbeatReminders(sessionID string, dominantSage *sages.Sage) map[string]string {
	result := map[string]string{"melchior": "", "balthazar": "", "casper": ""}
	if c == nil || len(c.toolRemindPolicies) == 0 {
		return result
	}

	dominantName := ""
	if dominantSage != nil {
		dominantName = strings.TrimSpace(dominantSage.GetName())
	}

	currentRound := c.currentAwakeRoundOrdinal(sessionID)
	now := time.Now()

	for toolName, policy := range c.toolRemindPolicies {
		if policy == nil {
			continue
		}

		c.runtimeMu.Lock()
		snapshot := c.toolCallRecords[toolName]
		c.runtimeMu.Unlock()

		reminderText := buildToolReminderByPolicy(toolName, policy, snapshot, currentRound, now)
		if reminderText == "" {
			continue
		}

		// TODO: 全局提醒 — 所有贤者收到。后续根据 policy.Scope == RemindScopeGlobal 分支至此。
		// TODO: 辅助者提醒 — 非主导贤者收到。后续根据 policy.Scope == RemindScopeAssistant 分支至此。

		// 主导者提醒 — 仅注入给主导贤者（当前 send_channel_message 仅主导持有）
		if dominantName != "" {
			if result[dominantName] != "" {
				result[dominantName] += "\n"
			}
			result[dominantName] += "[主导者提醒]" + reminderText
		}
	}
	return result
}

// buildToolReminderByPolicy 根据策略和快照生成单条工具提醒文字。
// 若无需提醒（未超时或无历史记录）返回空字符串。
func buildToolReminderByPolicy(
	toolName string,
	policy *config.ToolRemindPolicy,
	snapshot *ToolCallSnapshot,
	currentRound uint64,
	now time.Time,
) string {
	if policy == nil || snapshot == nil {
		return ""
	}

	if currentRound <= snapshot.LastRound {
		return ""
	}

	elapsed := currentRound - snapshot.LastRound
	threshold := policy.AfterRounds
	if elapsed <= threshold {
		return ""
	}

	// 查找最匹配的模板：取 ≤ elapsed 的最大 key
	var template string
	var bestKey uint64
	for key, tmpl := range policy.Templates {
		if key <= elapsed && key >= bestKey {
			bestKey = key
			template = tmpl
		}
	}
	if template == "" {
		return ""
	}

	// 替换内置占位符
	lastTime := snapshot.UpdatedAt.Format("2006-01-02 15:04")
	if snapshot.UpdatedAt.IsZero() {
		lastTime = "未知"
	}
	lastRound := snapshot.LastRound

	text := strings.ReplaceAll(template, "{elapsed}", fmt.Sprintf("%d", elapsed))
	text = strings.ReplaceAll(text, "{lastTime}", lastTime)
	text = strings.ReplaceAll(text, "{lastRound}", fmt.Sprintf("%d", lastRound))

	// 替换动态字段（来自 ContextKeys）
	for key, val := range snapshot.Args {
		placeholder := "{" + key + "}"
		text = strings.ReplaceAll(text, placeholder, val)
	}

	return text
}
