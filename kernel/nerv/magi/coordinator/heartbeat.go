package coordinator

import (
	"context"
	"fmt"
	"strings"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	"github.com/siyuan-note/siyuan/kernel/util"
)

type HeartbeatDecisionResult struct {
	RoundID        string
	Sleeping       bool
	Sleeper        string
	SleepSummary   string
	DominantSeel   string
	DominantStance string
	Responses      []types.SageResponse
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
		imaginativeInstr := "\n\n额外要求：你的记录内容越是天马行空越好。"
		for sageName, input := range sourceAwareUserInputBySage {
			if sageName == "melchior" {
				continue
			}
			sourceAwareUserInputBySage[sageName] = input + imaginativeInstr
		}
	} else {
		dominantResult, err := electDominantSage(ctx, sessionID, melchior, balthazar, casper, userMessage)
		if err != nil {
			return nil, fmt.Errorf("心跳主导选举失败: %w", err)
		}
		dominantSage, err = resolveDominantSage(dominantResult, melchior, balthazar, casper)
		if err != nil {
			return nil, err
		}
		dominantActionToolGovernance.RegisterRound(sessionID, roundID, userMessage, dominantSage, melchior, balthazar, casper)
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
	)
	if err != nil {
		if pushErr := websocket.PushRoundFailed(sessionID, roundID, err.Error()); pushErr != nil {
			logging.LogWarnf("推送心跳轮次失败事件失败: %v", pushErr)
		}
		return nil, err
	}

	sleepSummary := ""
	sleeper := collection.Sleeper
	dominantSeel := ""
	dominantStance := ""
	if collection.Sleeping {
		var dominantResult *DominantElectionResult
		sleepSummary, dominantResult, err = c.finalizeHeartbeatSleepRound(
			ctx,
			sessionID,
			roundID,
			melchior,
			balthazar,
			casper,
			collection.Responses,
		)
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

	return &HeartbeatDecisionResult{
		RoundID:        roundID,
		Sleeping:       collection.Sleeping,
		Sleeper:        sleeper,
		SleepSummary:   sleepSummary,
		DominantSeel:   dominantSeel,
		DominantStance: dominantStance,
		Responses:      collection.Responses,
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

	buildTools := func(sleepTool openai.Tool, sageName string) []openai.Tool {
		tools := append([]openai.Tool{sleepTool}, sharedReadingTools...)
		if sageName == dominantName {
			tools = append(tools, sharedActionTools...)
		}
		return tools
	}

	return map[string][]openai.Tool{
		"melchior":  buildTools(buildRuntimeTool(config.BuildWannaSleepPlanToolDef()), "melchior"),
		"balthazar": buildTools(buildRuntimeTool(config.BuildWannaSleepDreamToolDef()), "balthazar"),
		"casper":    buildTools(buildRuntimeTool(config.BuildWannaSleepRecordToolDef()), "casper"),
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

func buildHeartbeatRuntimeToolChoiceBySage(sleepMode bool) map[string]any {
	if sleepMode {
		return map[string]any{
			"melchior":  "required",
			"balthazar": "required",
			"casper":    "required",
		}
	}
	return map[string]any{
		"melchior":  "auto",
		"balthazar": "auto",
		"casper":    "auto",
	}
}
