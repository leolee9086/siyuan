// Package coordinator 提供MAGI决策协调功能
package coordinator

import (
	"context"
	"fmt"
	"sync"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// DifferentInputs 三贤人的不同输入内容
type DifferentInputs struct {
	MelchiorInput  string
	BalthazarInput string
	CasperInput    string
}

// DifferentInputsResult 三贤人的不同输入响应结果
type DifferentInputsResult struct {
	Melchior  *types.SageResponse
	Balthazar *types.SageResponse
	Casper    *types.SageResponse
}

// CoordinateWithDifferentInputs 协调三贤人使用不同输入内容（用于ATF测试等特殊场景）
// 这是MAGI对外暴露的第二个公开接口，仅用于需要给三贤人发送不同内容的场景
func (c *Coordinator) CoordinateWithDifferentInputs(
	ctx context.Context,
	sessionId string,
	melchior, balthazar, casper *sages.Sage,
	inputs *DifferentInputs,
) (*DifferentInputsResult, error) {
	// 生成roundId
	roundId := util.RandString(16)

	// 推送轮次开始
	if err := websocket.PushRoundStarted(sessionId, roundId, "ATF测试"); err != nil {
		logging.LogWarnf("推送轮次开始失败: %v", err)
	}

	// 并发收集三贤人响应
	result := &DifferentInputsResult{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	errCh := make(chan error, 3)

	// Melchior
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := websocket.PushSeelReplyStarted(sessionId, roundId, melchior.GetName(), melchior.GetDisplayName(), inputs.MelchiorInput, nil); err != nil {
			logging.LogWarnf("推送Melchior开始响应失败: %v", err)
		}
		msg, err := c.collector.collectSingleSageResponse(ctx, sessionId, roundId, melchior, inputs.MelchiorInput)
		if err != nil {
			errCh <- fmt.Errorf("melchior响应失败: %w", err)
			return
		}
		mu.Lock()
		result.Melchior = msg
		mu.Unlock()
	}()

	// Balthazar
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := websocket.PushSeelReplyStarted(sessionId, roundId, balthazar.GetName(), balthazar.GetDisplayName(), inputs.BalthazarInput, nil); err != nil {
			logging.LogWarnf("推送Balthazar开始响应失败: %v", err)
		}
		msg, err := c.collector.collectSingleSageResponse(ctx, sessionId, roundId, balthazar, inputs.BalthazarInput)
		if err != nil {
			errCh <- fmt.Errorf("balthazar响应失败: %w", err)
			return
		}
		mu.Lock()
		result.Balthazar = msg
		mu.Unlock()
	}()

	// Casper
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := websocket.PushSeelReplyStarted(sessionId, roundId, casper.GetName(), casper.GetDisplayName(), inputs.CasperInput, nil); err != nil {
			logging.LogWarnf("推送Casper开始响应失败: %v", err)
		}
		msg, err := c.collector.collectSingleSageResponse(ctx, sessionId, roundId, casper, inputs.CasperInput)
		if err != nil {
			errCh <- fmt.Errorf("casper响应失败: %w", err)
			return
		}
		mu.Lock()
		result.Casper = msg
		mu.Unlock()
	}()

	wg.Wait()
	close(errCh)

	// 检查错误
	for err := range errCh {
		if err != nil {
			if pushErr := websocket.PushRoundFailed(sessionId, roundId, err.Error()); pushErr != nil {
				logging.LogWarnf("推送轮次失败事件失败: %v", pushErr)
			}
			return nil, err
		}
	}

	return result, nil
}
