// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package api

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/siyuan-note/logging"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
	"github.com/siyuan-note/siyuan/packages/agentqueue"
)

// turnParamsKey 是 agentChatTurnParams 在 Input.Metadata 中的键。
// Metadata 为扩展字段，不参与调度，仅作为请求参数到执行器的进程内透传通道。
const turnParamsKey = "agentChatTurnParams"

// agentEventBufferSize 是响应订阅 channel 的缓冲大小。
// 与 agent.AgentChat 内部事件缓冲一致（agent/agent.go 的 256），
// 在 SSE 消费慢时提供背压缓冲，避免执行器转发频繁阻塞。
const agentEventBufferSize = 256

// agentEventErrorBuffer 是错误返回 channel 的缓冲大小（单事件）。
const agentEventErrorBuffer = 1

// agentExecutorIdleTimeout 是执行器空闲自动回收的默认阈值：
// 超过该时长没有消息处理（队列持续为空），执行器自我停止并移出注册表，
// 下次请求由 getAgentExecutor 懒重建。防止高并发 / 大量一次性会话场景下
// 常驻 goroutine 数量随会话数无限增长。
const agentExecutorIdleTimeout = 10 * time.Minute

// ErrAgentSessionBusy 表示同一会话已有活动订阅（单流限制）。
// 当前由 runningSessions 409 互斥保证不可达；此处为防御性约束，
// 也是未来 Phase 1 放开 409（运行中入队）时的单流边界信号。
var ErrAgentSessionBusy = errors.New("agent session already has an active subscription")

// agentChatTurnParams 是启动一次 AgentChat（一个 turn）所需的全部请求级参数。
//
// 由 agentChat handler（消费者）在构造 Input 时打包放入 Metadata，执行器取用后
// 重建 client 并调用 agent.AgentChat。所有字段均可 JSON 序列化（client 不在其中，
// 由执行器按 ModelID 从当前配置重建），为后续 Phase 4 队列持久化留出余地。
type agentChatTurnParams struct {
	// ModelID 是请求体里的原始模型标识（req.Model 原样透传，可能是
	// providerID:modelID 复合 ID / model ID / 显示名 / 名称）。
	// 非空时执行器走 model.Conf.AI.GetModel(ModelID)，为空回退
	// GetAgentModel()——与 agentChat handler 的模型选择路径逐字一致，
	// 避免用解析后的 Name 重建时命中同名模型导致 provider 漂移。
	ModelID string

	UserEntryID     string
	ContentRevision int64
	Language        string
	References      []agent.Reference
	EditorContext   agent.EditorContext
	PluginActions   []agent.PluginAction
	Regenerate      bool
	ReasoningEffort string

	// OwnerIdentityID / OwnerExpiresAt 来自请求鉴权（optionalAgentOwnerAuthorization），
	// 用于外部目录会话的授权边界透传。
	OwnerIdentityID string
	OwnerExpiresAt  int64

	// 超时与重试参数（毫秒存储，可序列化；执行器转回 time.Duration）。
	ConfirmTimeoutMs    int64
	MaxRetries          int
	RequestTimeoutMs    int64
	StreamIdleTimeoutMs int64
}

// agentEventSubscription 是一次请求（一个 SSE 连接）的响应订阅。
// 执行器把 AgentChat 产生的事件转发到 ch；handler 从 ch 读取并 writeSSE。
type agentEventSubscription struct {
	// ctx 是请求上下文（handler 传入）。前端断开 / 请求取消时，
	// AgentChat 通过该 ctx 感知并保存 interrupted 状态。
	ctx context.Context
	ch  chan agent.AgentEvent
}

// agentSessionExecutor 是单个 agent 会话的常驻执行器（中断模型核心）。
//
// 每个会话一个常驻 goroutine：空闲时阻塞在 InboxManager.WaitNext 上
// （Go channel 阻塞，闲时零 CPU，等价于 OS 中进程挂起等待中断）；
// 消息入队（Submit）触发唤醒，执行器 Take 输入并启动一次 AgentChat
// （turn 执行体，保持单次运行语义），事件经订阅转发到 SSE 响应渠道；
// turn 结束后回到 WaitNext 阻塞，等待下一次中断。
//
// 资源治理：长时间空闲（超过 idleTimeout）时执行器自我停止并移出注册表，
// 下次请求由 getAgentExecutor 懒重建——防止高并发 / 大量一次性会话场景下
// 常驻 goroutine 数量随会话数无限增长；每批消息处理结束后清理 inbox
// 历史项（Prune），防止高频会话 items 无限累积。
//
// 外部行为与改造前完全一致：HTTP 端点、SSE 事件类型、runningSessions
// 语义（409 互斥、streamStart/streamEnd）均不变；变的只是内部驱动模型
// （请求驱动 → 中断驱动）。
type agentSessionExecutor struct {
	sessionID string
	manager   *agentqueue.InboxManager

	stopCh chan struct{}

	// idleTimeout 空闲自动回收阈值（<=0 使用默认 agentExecutorIdleTimeout）。
	// 测试可注入小值以加速回收路径验证。
	idleTimeout time.Duration
	// maxRetained 每批消息处理后保留的 inbox 历史项数（<=0 使用默认
	// agentqueue.DefaultMaxRetained）。测试可注入小值验证 Prune。
	maxRetained int
	// doneCh 在 run goroutine 退出时关闭（测试确认 goroutine 已回收）。
	doneCh chan struct{}

	mu  sync.Mutex
	sub *agentEventSubscription // 当前请求的响应订阅（runningSessions 互斥保证同时至多一个）

	// runTurnFn 可注入的 turn 执行函数（测试用）；nil 时使用默认实现 runAgentChat。
	runTurnFn func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent
}

var (
	agentExecutorsMu sync.Mutex
	agentExecutors   = map[string]*agentSessionExecutor{}

	// agentInboxManager 是所有 agent 会话的统一消息入口（全局单例）。
	agentInboxManager = agentqueue.NewInboxManager(agentqueue.DefaultCapacity)
)

// getAgentExecutor 返回指定会话的执行器，不存在时懒创建并启动常驻 goroutine。
func getAgentExecutor(sessionID string) *agentSessionExecutor {
	agentExecutorsMu.Lock()
	defer agentExecutorsMu.Unlock()
	if ex, ok := agentExecutors[sessionID]; ok {
		return ex
	}
	ex := newAgentSessionExecutor(sessionID, agentInboxManager)
	agentExecutors[sessionID] = ex
	go ex.run()
	return ex
}

// stopAgentExecutor 停止并移除指定会话的执行器（会话删除时调用）。
func stopAgentExecutor(sessionID string) {
	agentExecutorsMu.Lock()
	ex := agentExecutors[sessionID]
	delete(agentExecutors, sessionID)
	agentExecutorsMu.Unlock()
	if ex == nil {
		// 执行器可能已被 selfStop（空闲回收）移出注册表，但 inbox 仍可能残留在
		// manager 中——会话删除时必须一并清理（RemoveSession 幂等，对不存在的
		// inbox 无害）。生产路径 getAgentExecutor 固定使用全局 manager。
		agentInboxManager.RemoveSession(sessionID)
		return
	}
	close(ex.stopCh)
	ex.manager.RemoveSession(sessionID)
}

// newAgentSessionExecutor 创建执行器并预注册 inbox。
// 预注册保证 WaitNext 返回真实信号 channel（否则会话不存在时返回 nil 永久挂起）。
// 使用 GetOrCreateInbox 而非 RegisterInbox：空闲回收（selfStop）后 inbox 保留，
// 重建时复用已有 inbox，避免覆盖竞态窗口内刚入队的消息。
func newAgentSessionExecutor(sessionID string, manager *agentqueue.InboxManager) *agentSessionExecutor {
	manager.GetOrCreateInbox(sessionID)
	return &agentSessionExecutor{
		sessionID:   sessionID,
		manager:     manager,
		stopCh:      make(chan struct{}),
		idleTimeout: agentExecutorIdleTimeout,
		maxRetained: agentqueue.DefaultMaxRetained,
		doneCh:      make(chan struct{}),
	}
}

// run 是执行器主循环：阻塞等待中断 → 排空队列 → 回到阻塞。
//
// 空闲计时：队列持续为空超过 idleTimeout 时自我停止（selfStop），由下次
// 请求懒重建，防止常驻 goroutine 随会话数无限增长。排空完成后重置计时，
// 避免长任务（耗时超过 idleTimeout）结束后被过期信号误回收。
func (e *agentSessionExecutor) run() {
	idle := e.idleTimeout
	if idle <= 0 {
		idle = agentExecutorIdleTimeout
	}
	timer := time.NewTimer(idle)
	defer timer.Stop()
	defer close(e.doneCh)

	for {
		select {
		case <-e.stopCh:
			return
		case <-e.manager.WaitNext(e.sessionID):
			e.safeDrain()
			// 排空完成后重置空闲计时（清空排空期间可能已触发的过期信号）。
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			timer.Reset(idle)
		case <-timer.C:
			if e.selfStop() {
				return
			}
			// 队列非空（与刚到达的消息竞态）：放弃回收，重置计时继续处理。
			timer.Reset(idle)
		}
	}
}

// selfStop 空闲回收：将执行器移出注册表并退出 goroutine。
//
// 返回 false 表示放弃回收（队列非空：可能有刚到达的消息，信号与计时同时
// 就绪时 select 随机选中本分支，此时不应回收）。返回 true 表示已回收。
//
// 注意：回收时不移除 inbox（RemoveSession）——移除会丢弃竞态窗口内刚入队
// 的消息；保留空 inbox 由下次 getAgentExecutor 的 RegisterInbox 覆盖，
// 或会话删除时由 stopAgentExecutor 清理。
func (e *agentSessionExecutor) selfStop() bool {
	agentExecutorsMu.Lock()
	defer agentExecutorsMu.Unlock()
	if agentExecutors[e.sessionID] != e {
		return false
	}
	if e.manager.PendingCount(e.sessionID) > 0 {
		return false
	}
	delete(agentExecutors, e.sessionID)
	return true
}

// safeDrain 捕获单次排空中的 panic，避免执行器 goroutine 整体退出
// （panic 后仍回到主循环继续处理后续消息）；排空结束后清理 inbox 历史项，
// 防止高频会话 items 无限累积（正常 / panic / err 路径均覆盖）。
func (e *agentSessionExecutor) safeDrain() {
	defer func() {
		if r := recover(); r != nil {
			logging.LogErrorf("agent executor drain panic (session %s): %v\n%s", e.sessionID, r, logging.ShortStack())
		}
		maxRetained := e.maxRetained
		if maxRetained <= 0 {
			maxRetained = agentqueue.DefaultMaxRetained
		}
		_ = e.manager.Prune(e.sessionID, maxRetained)
	}()
	e.drain()
}

// drain 循环取出当前所有可投递输入并逐个执行 turn（直到队列为空）。
func (e *agentSessionExecutor) drain() {
	for {
		input, err := e.manager.Take(e.sessionID, "")
		if err != nil {
			logging.LogErrorf("agent executor take failed (session %s): %s", e.sessionID, err)
			return
		}
		if input == nil {
			return
		}
		e.runTurn(input)
	}
}

// subscribe 注册当前请求的响应订阅并返回事件 channel（handler 的 SSE 循环读取）。
// handler 必须先 subscribe 再 Submit，保证执行器启动 turn 时订阅已就绪。
//
// 同一会话已存在活动订阅时返回 ErrAgentSessionBusy（单流限制）——不关闭旧
// channel：关闭仍可能被 runTurn 写入的 channel 会触发 panic，且 Phase 1
// 放开 409（运行中入队）后该路径将可到达，需在此明确拒绝而非破坏旧流。
func (e *agentSessionExecutor) subscribe(ctx context.Context) (<-chan agent.AgentEvent, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.sub != nil {
		return nil, ErrAgentSessionBusy
	}
	e.sub = &agentEventSubscription{
		ctx: ctx,
		ch:  make(chan agent.AgentEvent, agentEventBufferSize),
	}
	return e.sub.ch, nil
}

// unsubscribe 解除当前订阅（handler 的 defer 调用）。
func (e *agentSessionExecutor) unsubscribe() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.sub = nil
}

// turnRunner 是单条输入的 turn 执行函数（按语义分发）。
// 语义表驱动（开闭原则）：新增语义只需在 turnRunners 注册，无需修改 runTurn 主循环。
type turnRunner func(e *agentSessionExecutor, ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent

// turnRunners 按输入语义分发 turn 执行函数。
var turnRunners = map[agentqueue.InputSemantics]turnRunner{
	agentqueue.SemanticsUserMessage: (*agentSessionExecutor).runAgentChat,
}

// runTurn 执行一次 turn：按语义选择执行函数，并把事件转发到订阅 channel。
func (e *agentSessionExecutor) runTurn(input *agentqueue.Input) {
	e.mu.Lock()
	sub := e.sub
	e.mu.Unlock()
	if sub == nil {
		// 无订阅者（正常流程不会发生：handler 先 subscribe 再 Submit）。
		e.manager.MarkFailed(e.sessionID, input.ID)
		return
	}

	var events <-chan agent.AgentEvent
	if runFn := e.runTurnFn; runFn != nil {
		// 测试注入优先（见 newTestExecutor）。
		events = runFn(sub.ctx, input)
	} else if runner, ok := turnRunners[input.Semantics]; ok {
		events = runner(e, sub.ctx, input)
	} else {
		// 未注册语义（正常流程不会发生：agentChat handler 只投递 user_message）。
		// 防御：记录并标记失败，避免静默丢弃。
		logging.LogErrorf("agent executor: unregistered semantics %q (session %s)", input.Semantics, e.sessionID)
		e.manager.MarkFailed(e.sessionID, input.ID)
		return
	}
	e.forwardEvents(sub, input, events)
}

// forwardEvents 把 turn 事件转发到订阅 channel，直到流结束或请求取消。
func (e *agentSessionExecutor) forwardEvents(sub *agentEventSubscription, input *agentqueue.Input, events <-chan agent.AgentEvent) {
	for {
		select {
		case ev, ok := <-events:
			if !ok {
				// AgentChat channel 关闭。区分正常结束与取消：
				// ctx 已取消（请求中断）→ 标记 cancelled；否则为正常完成（done/error）。
				if sub.ctx.Err() != nil {
					_ = e.manager.Cancel(e.sessionID, input.ID)
				} else {
					e.manager.MarkInjected(e.sessionID, input.ID)
				}
				e.finishTurn(sub)
				return
			}
			select {
			case sub.ch <- ev:
			case <-sub.ctx.Done():
				// 请求取消：排空剩余事件直到 AgentChat 自行结束（保存 interrupted）。
				for range events {
				}
				_ = e.manager.Cancel(e.sessionID, input.ID)
				e.finishTurn(sub)
				return
			}
		case <-sub.ctx.Done():
			// 请求取消：AgentChat 会因 ctx 取消自行收尾，排空等待其结束。
			for range events {
			}
			_ = e.manager.Cancel(e.sessionID, input.ID)
			e.finishTurn(sub)
			return
		}
	}
}

// finishTurn 关闭订阅 channel（通知 SSE 循环流结束）并清理当前订阅。
func (e *agentSessionExecutor) finishTurn(sub *agentEventSubscription) {
	e.mu.Lock()
	if e.sub == sub {
		e.sub = nil
	}
	e.mu.Unlock()
	close(sub.ch)
}

// runAgentChat 是 SemanticsUserMessage 语义的 turn 执行函数（已在 turnRunners 注册）：
// 按请求参数重建 client 并调用 agent.AgentChat。
func (e *agentSessionExecutor) runAgentChat(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
	params, ok := input.Metadata[turnParamsKey].(*agentChatTurnParams)
	if !ok || params == nil {
		ch := make(chan agent.AgentEvent, agentEventErrorBuffer)
		ch <- agent.AgentEvent{Type: "error", Error: model.Conf.Language(28)}
		close(ch)
		return ch
	}

	var provider *conf.Provider
	var m *conf.Model
	if params.ModelID != "" {
		provider, m = model.Conf.AI.GetModel(params.ModelID)
	} else {
		provider, m = model.Conf.AI.GetAgentModel()
	}
	if provider == nil || m == nil {
		ch := make(chan agent.AgentEvent, agentEventErrorBuffer)
		ch <- agent.AgentEvent{Type: "error", Error: model.Conf.Language(193)}
		close(ch)
		return ch
	}

	client := util.NewOpenAIClientWithModel(provider.APIKey, provider.BaseURL, m.Name, model.Conf.AI.EffectiveAPIProxy(model.Conf.System))
	taskDirectory, _ := agent.GetTaskDirectoryBinding(e.sessionID)
	return agent.AgentChat(ctx, client, m.Name, e.sessionID,
		params.UserEntryID, params.ContentRevision, input.Content, params.Language,
		params.References, params.EditorContext, params.PluginActions, params.Regenerate,
		time.Duration(params.ConfirmTimeoutMs)*time.Millisecond, params.MaxRetries,
		params.ReasoningEffort, taskDirectory, params.OwnerIdentityID, params.OwnerExpiresAt,
		time.Duration(params.RequestTimeoutMs)*time.Millisecond, time.Duration(params.StreamIdleTimeoutMs)*time.Millisecond)
}
