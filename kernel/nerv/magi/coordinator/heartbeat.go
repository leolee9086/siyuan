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
	RoundID      string
	Sleeping     bool
	Sleeper      string
	SleepSummary string
	Responses    []types.SageResponse
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
		buildHeartbeatRuntimeTools(),
		"required",
	)
	if err != nil {
		if pushErr := websocket.PushRoundFailed(sessionID, roundID, err.Error()); pushErr != nil {
			logging.LogWarnf("推送心跳轮次失败事件失败: %v", pushErr)
		}
		return nil, err
	}

	return &HeartbeatDecisionResult{
		RoundID:      roundID,
		Sleeping:     collection.Sleeping,
		Sleeper:      collection.Sleeper,
		SleepSummary: collection.SleepSummary,
		Responses:    collection.Responses,
	}, nil
}

func buildHeartbeatRuntimeTools() []openai.Tool {
	toolDef := config.BuildWannaSleepToolDef()
	return []openai.Tool{
		{
			Type: openai.ToolType(toolDef.Type),
			Function: &openai.FunctionDefinition{
				Name:        toolDef.Function.Name,
				Description: toolDef.Function.Description,
				Parameters:  toolDef.Function.Parameters,
			},
		},
	}
}
