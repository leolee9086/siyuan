package coordinator

import (
	"context"
	"fmt"

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
) (*HeartbeatDecisionResult, error) {
	if c == nil {
		return nil, fmt.Errorf("coordinator is nil")
	}

	roundID := util.RandString(16)
	if err := websocket.PushRoundStarted(sessionID, roundID, userMessage); err != nil {
		logging.LogWarnf("推送心跳轮次开始失败: %v", err)
	}

	claimedHistory := []types.ClaimedHistoryMessage{
		{
			Role:    string(types.RoleUser),
			Content: userMessage,
		},
	}
	sourceAwareUserInput := c.buildSourceAwareUserInput(
		sessionID,
		userMessage,
		sourceCtx,
		claimedHistory,
	)

	collection, err := c.collector.CollectHeartbeatResponses(
		ctx,
		sessionID,
		roundID,
		melchior,
		balthazar,
		casper,
		userMessage,
		sourceAwareUserInput,
		buildHeartbeatRuntimeToolsBySage(),
		buildHeartbeatRuntimeToolChoiceBySage(),
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

func buildHeartbeatRuntimeToolsBySage() map[string][]openai.Tool {
	return map[string][]openai.Tool{
		"melchior":  {buildHeartbeatRuntimeTool(config.BuildWannaSleepPlanToolDef())},
		"balthazar": {buildHeartbeatRuntimeTool(config.BuildWannaSleepDreamToolDef())},
		"casper":    {buildHeartbeatRuntimeTool(config.BuildWannaSleepRecordToolDef())},
	}
}

func buildHeartbeatRuntimeToolChoiceBySage() map[string]any {
	return map[string]any{
		"melchior":  "required",
		"balthazar": "required",
		"casper":    "required",
	}
}

func buildHeartbeatRuntimeTool(toolDef config.ToolDef) openai.Tool {
	return openai.Tool{
		Type: openai.ToolType(toolDef.Type),
		Function: &openai.FunctionDefinition{
			Name:        toolDef.Function.Name,
			Description: toolDef.Function.Description,
			Parameters:  toolDef.Function.Parameters,
		},
	}
}
