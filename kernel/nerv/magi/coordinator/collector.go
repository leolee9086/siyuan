// Package coordinator 提供MAGI决策协调功能
package coordinator

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
)

// ResponseCollector 响应收集器
type ResponseCollector struct {
	timeout        time.Duration
	workLogHistory *workLogHistoryStore
}

type CollectResponsesOptions struct {
	AllowWannaSleep            bool
	IsSleepMode                bool
	RuntimeTools               []openai.Tool
	RuntimeToolChoice          any
	RuntimeToolsBySage         map[string][]openai.Tool
	RuntimeToolChoiceBySage    map[string]any
	ModelInputBySage           map[string]string
	IsExternalMessageTriggered bool
}

type HeartbeatCollectionResult struct {
	Responses      []types.SageResponse
	AllDowntime    bool
	DowntimeSage   string
	DowntimeSummary string
}

// NewResponseCollector 创建响应收集器
func NewResponseCollector(timeout time.Duration) *ResponseCollector {
	return &ResponseCollector{
		timeout:        timeout,
		workLogHistory: newWorkLogHistory(),
	}
}

// CollectResponses 并发收集三贤人的响应
// 至少需要2个贤者成功响应，否则返回错误
func (rc *ResponseCollector) CollectResponses(
	ctx context.Context,
	sessionId, roundId string,
	melchior, balthazar, casper *sages.Sage,
	userMessage string,
	modelInput string,
) ([]types.SageResponse, error) {
	result, err := rc.collectResponsesWithOptions(
		ctx,
		sessionId,
		roundId,
		melchior,
		balthazar,
		casper,
		userMessage,
		modelInput,
		CollectResponsesOptions{},
	)
	if err != nil {
		return nil, err
	}
	return result.Responses, nil
}

func (rc *ResponseCollector) CollectHeartbeatResponses(
	ctx context.Context,
	sessionId, roundId string,
	melchior, balthazar, casper *sages.Sage,
	userMessage string,
	modelInput string,
	modelInputBySage map[string]string,
	runtimeToolsBySage map[string][]openai.Tool,
	runtimeToolChoiceBySage map[string]any,
	isSleepMode bool,
) (*HeartbeatCollectionResult, error) {
	return rc.collectResponsesWithOptions(
		ctx,
		sessionId,
		roundId,
		melchior,
		balthazar,
		casper,
		userMessage,
		modelInput,
		CollectResponsesOptions{
			AllowWannaSleep:         true,
			IsSleepMode:             isSleepMode,
			RuntimeToolsBySage:      runtimeToolsBySage,
			RuntimeToolChoiceBySage: runtimeToolChoiceBySage,
			ModelInputBySage:        modelInputBySage,
		},
	)
}

func (options CollectResponsesOptions) forSage(sage *sages.Sage) CollectResponsesOptions {
	if sage == nil {
		return options
	}

	cloned := options
	if tools, ok := options.RuntimeToolsBySage[strings.TrimSpace(sage.GetName())]; ok {
		cloned.RuntimeTools = tools
	}
	if choice, ok := options.RuntimeToolChoiceBySage[strings.TrimSpace(sage.GetName())]; ok {
		cloned.RuntimeToolChoice = choice
	}
	cloned.RuntimeToolsBySage = nil
	cloned.RuntimeToolChoiceBySage = nil
	cloned.ModelInputBySage = nil
	return cloned
}

func (rc *ResponseCollector) collectResponsesWithOptions(
	ctx context.Context,
	sessionId, roundId string,
	melchior, balthazar, casper *sages.Sage,
	userMessage string,
	modelInput string,
	options CollectResponsesOptions,
) (*HeartbeatCollectionResult, error) {
	derivedCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	// 结果channel
	type result struct {
		response *types.SageResponse
		err      error
		sageName string
	}
	resultCh := make(chan result, 3)

	// 并发收集三个贤者的响应
	var wg sync.WaitGroup
	wg.Add(3)

	// Melchior
	go func() {
		defer wg.Done()
		streamMessage := buildSeelStreamMessage(roundId, melchior)
		// 推送贤者开始响应
		if err := websocket.PushSeelReplyStarted(websocket.RuntimeMonitorSessionID, roundId, melchior.GetName(), melchior.GetDisplayName(), userMessage, streamMessage); err != nil {
			logging.LogWarnf("推送Melchior开始响应失败: %v", err)
		}
		resp, err := rc.collectSingleSageResponse(
			derivedCtx,
			sessionId,
			roundId,
			melchior,
			resolveCollectorModelInputForSage(modelInput, options.ModelInputBySage, melchior),
			options.forSage(melchior),
		)
		resultCh <- result{response: resp, err: err, sageName: "melchior"}
	}()

	// Balthazar
	go func() {
		defer wg.Done()
		streamMessage := buildSeelStreamMessage(roundId, balthazar)
		// 推送贤者开始响应
		if err := websocket.PushSeelReplyStarted(websocket.RuntimeMonitorSessionID, roundId, balthazar.GetName(), balthazar.GetDisplayName(), userMessage, streamMessage); err != nil {
			logging.LogWarnf("推送Balthazar开始响应失败: %v", err)
		}
		resp, err := rc.collectSingleSageResponse(
			derivedCtx,
			sessionId,
			roundId,
			balthazar,
			resolveCollectorModelInputForSage(modelInput, options.ModelInputBySage, balthazar),
			options.forSage(balthazar),
		)
		resultCh <- result{response: resp, err: err, sageName: "balthazar"}
	}()

	// Casper
	go func() {
		defer wg.Done()
		streamMessage := buildSeelStreamMessage(roundId, casper)
		// 推送贤者开始响应
		if err := websocket.PushSeelReplyStarted(websocket.RuntimeMonitorSessionID, roundId, casper.GetName(), casper.GetDisplayName(), userMessage, streamMessage); err != nil {
			logging.LogWarnf("推送Casper开始响应失败: %v", err)
		}
		resp, err := rc.collectSingleSageResponse(
			derivedCtx,
			sessionId,
			roundId,
			casper,
			resolveCollectorModelInputForSage(modelInput, options.ModelInputBySage, casper),
			options.forSage(casper),
		)
		resultCh <- result{response: resp, err: err, sageName: "casper"}
	}()

	// 等待所有goroutine完成
	go func() {
		wg.Wait()
		close(resultCh)
	}()

	// 收集结果
	var responses []types.SageResponse
	var successCount int
	var errMessages []string
	heartbeatResult := &HeartbeatCollectionResult{}

	for res := range resultCh {
		if res.err != nil {
			errMessages = append(errMessages, fmt.Sprintf("%s: %v", res.sageName, res.err))
		} else if res.response != nil {
			responses = append(responses, *res.response)
			successCount++
		}
	}

	heartbeatResult.Responses = responses
	heartbeatResult.AllDowntime = successCount == 3 && countDowntimeResponses(responses) == 3
	if heartbeatResult.AllDowntime {
		heartbeatResult.DowntimeSage = "all"
		return heartbeatResult, nil
	}

	// 检查是否至少有2个成功
	if successCount < 2 {
		// 如果是因为 context 取消导致收集不足，返回部分结果而非直接失败
		if ctx.Err() == context.Canceled {
			return heartbeatResult, ctx.Err()
		}
		return nil, fmt.Errorf("至少需要2个贤者成功响应，实际成功: %d, 错误: %v", successCount, errMessages)
	}

	return heartbeatResult, nil
}

func resolveCollectorModelInputForSage(
	defaultModelInput string,
	modelInputBySage map[string]string,
	sage *sages.Sage,
) string {
	if sage == nil || len(modelInputBySage) == 0 {
		return defaultModelInput
	}
	if resolved := strings.TrimSpace(modelInputBySage[strings.TrimSpace(sage.GetName())]); resolved != "" {
		return resolved
	}
	return defaultModelInput
}

func buildSeelStreamMessage(roundId string, sage *sages.Sage) *types.Message {
	return buildSeelStreamMessageWithMeta(roundId, sage, nil)
}

func buildSeelStreamMessageWithMeta(roundId string, sage *sages.Sage, meta map[string]interface{}) *types.Message {
	var metaCopy map[string]interface{}
	if len(meta) > 0 {
		metaCopy = make(map[string]interface{}, len(meta))
		for key, value := range meta {
			metaCopy[key] = value
		}
	}

	return &types.Message{
		ID:        fmt.Sprintf("%s-%s-stream", roundId, sage.GetName()),
		Type:      types.TypeAI,
		Content:   "",
		Status:    types.StatusStreaming,
		Timestamp: time.Now().UnixMilli(),
		Meta:      metaCopy,
	}
}
