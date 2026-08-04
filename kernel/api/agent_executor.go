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
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
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

const agentEventDisconnectGrace = 30 * time.Second

// ErrAgentSessionBusy 表示同一会话已有活动订阅（单流限制）。
// 当前由 runningSessions 409 互斥保证不可达；此处为防御性约束，
// 也是未来 Phase 1 放开 409（运行中入队）时的单流边界信号。
var ErrAgentSessionBusy = errors.New("agent session already has an active subscription")
var errAgentModelUnavailable = errors.New("agent model is unavailable")

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
	ModelID string `json:"modelID,omitempty"`

	UserEntryID     string               `json:"userEntryID"`
	BlockHTML       string               `json:"blockHTML,omitempty"`
	ContentRevision int64                `json:"contentRevision"`
	Language        string               `json:"language"`
	References      []agent.Reference    `json:"references,omitempty"`
	EditorContext   agent.EditorContext  `json:"editorContext,omitempty"`
	PluginActions   []agent.PluginAction `json:"pluginActions,omitempty"`
	Regenerate      bool                 `json:"regenerate,omitempty"`
	ReasoningEffort string               `json:"reasoningEffort,omitempty"`

	// OwnerIdentityID / OwnerExpiresAt 来自请求鉴权（optionalAgentOwnerAuthorization），
	// 用于外部目录会话的授权边界透传。
	OwnerIdentityID string `json:"ownerIdentityID,omitempty"`
	OwnerExpiresAt  int64  `json:"ownerExpiresAt,omitempty"`

	// 超时与重试参数（毫秒存储，可序列化；执行器转回 time.Duration）。
	ConfirmTimeoutMs    int64 `json:"confirmTimeoutMs"`
	MaxRetries          int   `json:"maxRetries"`
	RequestTimeoutMs    int64 `json:"requestTimeoutMs"`
	StreamIdleTimeoutMs int64 `json:"streamIdleTimeoutMs"`
}

type agentTurnRequestOptions struct {
	ModelID         string
	UserEntryID     string
	BlockHTML       string
	ContentRevision int64
	Language        string
	References      []agent.Reference
	EditorContext   agent.EditorContext
	PluginActions   []agent.PluginAction
	Regenerate      bool
	ReasoningEffort string
}

func buildAgentTurnParams(options agentTurnRequestOptions, ownerAuth *agentOwnerAuthorization) (*agentChatTurnParams, error) {
	var provider *conf.Provider
	var selectedModel *conf.Model
	if options.ModelID != "" {
		provider, selectedModel = model.Conf.AI.GetModel(options.ModelID)
	} else {
		provider, selectedModel = model.Conf.AI.GetAgentModel()
	}
	if provider == nil || selectedModel == nil {
		return nil, errAgentModelUnavailable
	}
	confirmTimeout := time.Duration(model.Conf.AI.Agent.ConfirmTimeout) * time.Second
	if confirmTimeout <= 0 {
		confirmTimeout = 120 * time.Second
	}
	maxRetries := model.Conf.AI.Agent.MaxRetries
	if maxRetries < 0 {
		maxRetries = 0
	}
	requestTimeout := time.Duration(provider.RequestTimeout) * time.Second
	if requestTimeout <= 0 {
		requestTimeout = 30 * time.Second
	}
	streamIdleTimeout := time.Duration(model.Conf.AI.Agent.StreamIdleTimeout) * time.Second
	if streamIdleTimeout <= 0 {
		streamIdleTimeout = 120 * time.Second
	}
	params := &agentChatTurnParams{
		ModelID:             options.ModelID,
		UserEntryID:         options.UserEntryID,
		BlockHTML:           options.BlockHTML,
		ContentRevision:     options.ContentRevision,
		Language:            options.Language,
		References:          append([]agent.Reference(nil), options.References...),
		EditorContext:       options.EditorContext,
		PluginActions:       append([]agent.PluginAction(nil), options.PluginActions...),
		Regenerate:          options.Regenerate,
		ReasoningEffort:     options.ReasoningEffort,
		ConfirmTimeoutMs:    confirmTimeout.Milliseconds(),
		MaxRetries:          maxRetries,
		RequestTimeoutMs:    requestTimeout.Milliseconds(),
		StreamIdleTimeoutMs: streamIdleTimeout.Milliseconds(),
	}
	if ownerAuth != nil {
		params.OwnerIdentityID = ownerAuth.IdentityID
		params.OwnerExpiresAt = ownerAuth.ExpiresAt
	}
	return params, nil
}

func encodeAgentTurnParams(params *agentChatTurnParams) (json.RawMessage, error) {
	data, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(data), nil
}

func decodeAgentTurnParams(input *agentqueue.Input) (*agentChatTurnParams, error) {
	if input == nil {
		return nil, agentqueue.ErrNilInput
	}
	if params, ok := input.Metadata[turnParamsKey].(*agentChatTurnParams); ok && params != nil {
		return params, nil
	}
	if len(input.Payload) == 0 {
		return nil, errors.New("agent turn payload is missing")
	}
	params := &agentChatTurnParams{}
	if err := json.Unmarshal(input.Payload, params); err != nil {
		return nil, fmt.Errorf("decode agent turn payload: %w", err)
	}
	return params, nil
}

// agentEventSubscription 是一次请求（一个 SSE 连接）的响应订阅。
// 执行器把 AgentChat 产生的事件转发到 ch；handler 从 ch 读取并 writeSSE。
type agentLegacySubscription struct {
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
	initErr   error
	turn      *agentTurnController
	hub       *agentSessionEventHub

	stopCh         chan struct{}
	stopOnce       sync.Once
	commitCh       chan struct{}
	queueChangedCh chan struct{}

	// idleTimeout 空闲自动回收阈值（<=0 使用默认 agentExecutorIdleTimeout）。
	// 测试可注入小值以加速回收路径验证。
	idleTimeout time.Duration
	// maxRetained 每批消息处理后保留的 inbox 历史项数（<=0 使用默认
	// agentqueue.DefaultMaxRetained）。测试可注入小值验证 Prune。
	maxRetained int
	// doneCh 在 run goroutine 退出时关闭（测试确认 goroutine 已回收）。
	doneCh chan struct{}

	mu              sync.Mutex
	commitMu        sync.Mutex
	committedTurnID string
	sub             *agentLegacySubscription // 旧 /chat 的单次响应订阅
	turnCtx         context.Context
	turnCancel      context.CancelFunc
	disconnectTimer *time.Timer
	disconnectGrace time.Duration
	// anchorStore 独立持久化 input 与 turn 的关联，避免扩展上游 runtime.json 结构。
	anchorStore agentExecutorAnchorStore

	// runTurnFn 可注入的 turn 执行函数（测试用）；nil 时使用默认实现 runAgentChat。
	runTurnFn func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent
}

var (
	agentExecutorsMu sync.Mutex
	agentExecutors   = map[string]*agentSessionExecutor{}

	// agentInboxManager 是所有 agent 会话的统一消息入口（全局单例）。
	agentInboxManager = agentqueue.NewInboxManager(agentqueue.DefaultCapacity)
)

// isAgentExecutorSessionActive 只检查已经存在的执行器，不为读取状态创建新实例。
// turnCancel 覆盖 turnID 建立前的 starting 窗口，turn.State 覆盖流关闭后的提交屏障。
func isAgentExecutorSessionActive(sessionID string) bool {
	agentExecutorsMu.Lock()
	executor := agentExecutors[sessionID]
	agentExecutorsMu.Unlock()
	if executor == nil {
		return false
	}
	executor.mu.Lock()
	streamActive := executor.turnCancel != nil
	executor.mu.Unlock()
	return streamActive || executor.turn.State().TurnID != ""
}

// getAgentExecutor 返回指定会话的执行器，不存在时懒创建并启动常驻 goroutine。
func getAgentExecutor(sessionID string) *agentSessionExecutor {
	agentExecutorsMu.Lock()
	defer agentExecutorsMu.Unlock()
	if ex, ok := agentExecutors[sessionID]; ok {
		return ex
	}
	inbox := agentInboxManager.GetOrCreateInbox(sessionID)
	initErr := prepareAgentInboxPersistence(inbox, util.DataDir)
	ex := newAgentSessionExecutor(sessionID, agentInboxManager)
	anchorStore, anchorErr := newFileAgentExecutorAnchorStore(util.DataDir)
	if anchorErr == nil {
		ex.anchorStore = anchorStore
	} else if initErr == nil {
		initErr = anchorErr
	}
	if initErr == nil {
		initErr = ex.reconcilePersistedRuntime()
	}
	ex.initErr = initErr
	agentExecutors[sessionID] = ex
	go ex.run()
	return ex
}

func prepareAgentInboxPersistence(inbox *agentqueue.SessionInbox, dataDir string) error {
	if inbox == nil || inbox.HasStorage() {
		return nil
	}
	if strings.TrimSpace(dataDir) == "" {
		return errors.New("agent queue persistence data directory is empty")
	}
	storage, err := agentqueue.NewFileStorage(filepath.Join(dataDir, "storage", "ai", "agent", "queues"))
	if err != nil {
		return err
	}
	inbox.AttachStorage(storage)
	_, err = inbox.RestoreFromStorage()
	return err
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
		if store, err := newFileAgentExecutorAnchorStore(util.DataDir); err == nil {
			if deleteErr := store.Delete(sessionID); deleteErr != nil {
				logging.LogErrorf("delete agent executor anchor failed (session %s): %s", sessionID, deleteErr)
			}
		}
		return
	}
	ex.stop()
	if err := ex.anchorStore.Delete(sessionID); err != nil {
		logging.LogErrorf("delete agent executor anchor failed (session %s): %s", sessionID, err)
	}
	ex.manager.RemoveSession(sessionID)
}

func (e *agentSessionExecutor) stop() {
	e.stopOnce.Do(func() {
		e.mu.Lock()
		cancel := e.turnCancel
		e.turnCancel = nil
		if e.disconnectTimer != nil {
			e.disconnectTimer.Stop()
			e.disconnectTimer = nil
		}
		e.mu.Unlock()
		if cancel != nil {
			cancel()
		}
		close(e.stopCh)
	})
}

// newAgentSessionExecutor 创建执行器并预注册 inbox。
// 预注册保证 WaitNext 返回真实信号 channel（否则会话不存在时返回 nil 永久挂起）。
// 使用 GetOrCreateInbox 而非 RegisterInbox：空闲回收（selfStop）后 inbox 保留，
// 重建时复用已有 inbox，避免覆盖竞态窗口内刚入队的消息。
func newAgentSessionExecutor(sessionID string, manager *agentqueue.InboxManager) *agentSessionExecutor {
	manager.GetOrCreateInbox(sessionID)
	executor := &agentSessionExecutor{
		sessionID:       sessionID,
		manager:         manager,
		stopCh:          make(chan struct{}),
		commitCh:        make(chan struct{}, 1),
		queueChangedCh:  make(chan struct{}, 1),
		idleTimeout:     agentExecutorIdleTimeout,
		disconnectGrace: agentEventDisconnectGrace,
		maxRetained:     agentqueue.DefaultMaxRetained,
		doneCh:          make(chan struct{}),
		hub:             newAgentSessionEventHub(sessionID),
		anchorStore:     newMemoryAgentExecutorAnchorStore(),
	}
	executor.turn = newAgentTurnController(sessionID, manager)
	executor.hub.setSubscriberCountChanged(executor.onEventSubscriberCountChanged)
	return executor
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
		case <-e.commitCh:
			e.safeDrain()
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			timer.Reset(idle)
		case <-e.queueChangedCh:
			e.publishQueueState()
		case <-timer.C:
			if e.selfStop() {
				return
			}
			// 队列非空（与刚到达的消息竞态）：放弃回收，重置计时继续处理。
			timer.Reset(idle)
		}
	}
}

func init() {
	agentInboxManager.Subscribe(func(sessionID string) {
		agentExecutorsMu.Lock()
		executor := agentExecutors[sessionID]
		agentExecutorsMu.Unlock()
		if executor == nil {
			return
		}
		select {
		case executor.queueChangedCh <- struct{}{}:
		default:
		}
	})
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
	if e.turn.State().TurnID != "" || e.hub.subscriberCount() > 0 {
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

// drain 只在有响应订阅且上一 turn 已提交时精确领取新 turn 输入。
// 旧 /chat 的 user_message 优先于后台 queue；每次 queue 只提升一条，且绝不调用
// 会把 steer 当作普通消息兜底消费的通用 Take。
func (e *agentSessionExecutor) drain() {
	for {
		if state := e.turn.State(); state.TurnID != "" {
			return
		}
		e.mu.Lock()
		if e.sub == nil && e.hub.subscriberCount() == 0 {
			e.mu.Unlock()
			return
		}
		input, err := e.manager.ClaimNextUserMessage(e.sessionID)
		if err == nil && input == nil {
			input, err = e.manager.ClaimNextQueued(e.sessionID)
		}
		e.mu.Unlock()
		if err != nil {
			logging.LogErrorf("agent executor claim failed (session %s): %s", e.sessionID, err)
			return
		}
		if input == nil {
			return
		}
		e.runTurn(input)
	}
}

func (e *agentSessionExecutor) commitTurn(turnID string) error {
	e.commitMu.Lock()
	defer e.commitMu.Unlock()
	e.mu.Lock()
	streamActive := e.turnCancel != nil
	e.mu.Unlock()
	if streamActive {
		state := e.turn.State()
		if state.TurnID == "" {
			return nil
		}
		if state.TurnID != turnID {
			return ErrAgentTurnMismatch
		}
		e.committedTurnID = turnID
		return nil
	}
	return e.releaseCommittedTurnLocked(turnID)
}

// releaseCommittedTurnLocked 在事件转发已释放 turn 上下文后结算输入并解除下一轮屏障。
// 调用方必须持有 commitMu。
func (e *agentSessionExecutor) releaseCommittedTurnLocked(turnID string) error {
	state := e.turn.State()
	if state.TurnID == "" {
		return nil
	}
	if state.TurnID != turnID {
		return ErrAgentTurnMismatch
	}
	anchor, err := e.anchorStore.Load(e.sessionID)
	if err != nil {
		return err
	}
	if anchor != nil {
		if anchor.TurnID != "" && anchor.TurnID != turnID {
			return fmt.Errorf("agent executor anchor turn mismatch")
		}
		if err = e.completeSourceInput(anchor.InputID); err != nil {
			return err
		}
		if err = e.anchorStore.Delete(e.sessionID); err != nil {
			return err
		}
	}
	committed, err := e.turn.Commit(turnID)
	if err != nil {
		return err
	}
	if !committed {
		return nil
	}
	e.committedTurnID = ""
	e.hub.publish("turn_committed", map[string]any{
		"turnID": turnID, "queueVersion": e.manager.SnapshotVersioned(e.sessionID).QueueVersion,
	})
	e.hub.publish("turn_phase", map[string]any{"turnID": turnID, "phase": agent.AgentTurnIdle})
	e.publishSessionState()
	e.signalDrain()
	return nil
}

func (e *agentSessionExecutor) reconcilePersistedRuntime() error {
	anchor, err := e.anchorStore.Load(e.sessionID)
	if err != nil {
		return err
	}
	recovery, err := agent.InspectRuntimeTurnRecovery(e.sessionID)
	if err != nil {
		return err
	}
	if recovery == nil {
		if anchor == nil {
			return nil
		}
		if anchor.TurnID == "" {
			if err = e.releaseUnstartedSourceInput(anchor.InputID); err != nil {
				return err
			}
			return e.anchorStore.Delete(e.sessionID)
		}
		if anchor.TurnID != "" {
			committed, committedErr := agent.IsTurnCommitted(e.sessionID, anchor.TurnID)
			if committedErr != nil {
				return committedErr
			}
			if !committed {
				return errors.New("agent executor anchor references a missing runtime turn")
			}
			if err = e.completeSourceInput(anchor.InputID); err != nil {
				return err
			}
		}
		return e.anchorStore.Delete(e.sessionID)
	}
	if recovery.State == "running" {
		if err = agent.FinalizeOrphanedTurn(e.sessionID); err != nil {
			return err
		}
		recovery, err = agent.InspectRuntimeTurnRecovery(e.sessionID)
		if err != nil || recovery == nil {
			return err
		}
	}
	if anchor != nil {
		if anchor.TurnID != "" && anchor.TurnID != recovery.TurnID {
			return errors.New("agent executor anchor does not match runtime turn")
		}
		if anchor.TurnID == "" {
			anchor.TurnID = recovery.TurnID
			if err = e.anchorStore.Save(*anchor); err != nil {
				return err
			}
		}
		if recovery.Committed {
			if err = e.completeSourceInput(anchor.InputID); err != nil {
				return err
			}
			return e.anchorStore.Delete(e.sessionID)
		}
		if err = e.reclaimSourceInput(anchor.InputID); err != nil {
			return err
		}
	}
	if !recovery.Committed {
		e.turn.RestoreAwaitingCommit(recovery.TurnID)
	}
	return nil
}

func (e *agentSessionExecutor) releaseUnstartedSourceInput(inputID string) error {
	snapshot := e.manager.SnapshotVersioned(e.sessionID)
	for _, item := range snapshot.Items {
		if item.Input == nil || item.Input.ID != inputID {
			continue
		}
		if item.State == agentqueue.StatusInjecting {
			_, err := e.manager.ReleaseClaim(e.sessionID, inputID)
			return err
		}
		return nil
	}
	return nil
}

func (e *agentSessionExecutor) beginInputAnchor(inputID string) error {
	if inputID == "" {
		return errors.New("agent executor input id is empty")
	}
	existing, err := e.anchorStore.Load(e.sessionID)
	if err != nil {
		return err
	}
	if existing != nil {
		if existing.InputID == inputID {
			return nil
		}
		return errors.New("agent executor still has an active input anchor")
	}
	return e.anchorStore.Save(agentExecutorAnchor{SessionID: e.sessionID, InputID: inputID})
}

func (e *agentSessionExecutor) bindInputTurn(inputID, turnID string) error {
	if inputID == "" || turnID == "" {
		return errors.New("agent executor input or turn id is empty")
	}
	anchor, err := e.anchorStore.Load(e.sessionID)
	if err != nil {
		return err
	}
	if anchor == nil || anchor.InputID != inputID {
		return errors.New("agent executor input anchor is missing")
	}
	if anchor.TurnID != "" && anchor.TurnID != turnID {
		return errors.New("agent executor input anchor turn changed")
	}
	if anchor.TurnID == turnID {
		return nil
	}
	anchor.TurnID = turnID
	return e.anchorStore.Save(*anchor)
}

func (e *agentSessionExecutor) clearInputAnchor(inputID string) error {
	anchor, err := e.anchorStore.Load(e.sessionID)
	if err != nil || anchor == nil {
		return err
	}
	if inputID != "" && anchor.InputID != inputID {
		return errors.New("agent executor input anchor changed")
	}
	return e.anchorStore.Delete(e.sessionID)
}

func (e *agentSessionExecutor) reclaimSourceInput(inputID string) error {
	snapshot := e.manager.SnapshotVersioned(e.sessionID)
	for _, item := range snapshot.Items {
		if item.Input == nil || item.Input.ID != inputID {
			continue
		}
		switch item.State {
		case agentqueue.StatusPending:
			_, err := e.manager.ClaimByID(e.sessionID, inputID, item.Input.Semantics)
			return err
		case agentqueue.StatusInjecting, agentqueue.StatusInjected:
			return nil
		default:
			return nil
		}
	}
	return nil
}

func (e *agentSessionExecutor) completeSourceInput(inputID string) error {
	snapshot := e.manager.SnapshotVersioned(e.sessionID)
	for _, item := range snapshot.Items {
		if item.Input == nil || item.Input.ID != inputID {
			continue
		}
		if item.State == agentqueue.StatusInjected {
			return nil
		}
		if item.State == agentqueue.StatusPending {
			if _, err := e.manager.ClaimByID(e.sessionID, inputID, item.Input.Semantics); err != nil {
				return err
			}
		}
		if item.State == agentqueue.StatusPending || item.State == agentqueue.StatusInjecting {
			return e.manager.MarkInjected(e.sessionID, inputID)
		}
		return nil
	}
	return nil
}

func (e *agentSessionExecutor) signalDrain() {
	select {
	case e.commitCh <- struct{}{}:
	default:
	}
}

func notifyAgentExecutorTurnCommitted(sessionID, turnID string) {
	if turnID == "" {
		return
	}
	agentExecutorsMu.Lock()
	executor := agentExecutors[sessionID]
	agentExecutorsMu.Unlock()
	if executor == nil {
		return
	}
	if err := executor.commitTurn(turnID); err != nil {
		logging.LogErrorf("commit agent executor turn failed (session %s turn %s): %s", sessionID, turnID, err)
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
	if e.initErr != nil {
		e.mu.Unlock()
		return nil, e.initErr
	}
	if e.sub != nil {
		e.mu.Unlock()
		return nil, ErrAgentSessionBusy
	}
	e.sub = &agentLegacySubscription{
		ctx: ctx,
		ch:  make(chan agent.AgentEvent, agentEventBufferSize),
	}
	ch := e.sub.ch
	e.mu.Unlock()
	// 订阅可能建立在一次已被无订阅执行器消费的唤醒之后，显式唤醒可确保保留输入继续执行。
	e.signalDrain()
	return ch, nil
}

func (e *agentSessionExecutor) subscribeEvents(ctx context.Context, after int64) (<-chan agentSessionEvent, func(), error) {
	if e.initErr != nil {
		return nil, nil, e.initErr
	}
	ch, unsubscribe := e.hub.subscribe(ctx, after)
	e.publishSessionState()
	e.signalDrain()
	return ch, unsubscribe, nil
}

func (e *agentSessionExecutor) onEventSubscriberCountChanged(count int) {
	if count > 0 {
		e.mu.Lock()
		if e.disconnectTimer != nil {
			e.disconnectTimer.Stop()
			e.disconnectTimer = nil
		}
		e.mu.Unlock()
		e.signalDrain()
		return
	}
	state := e.turn.State()
	if state.TurnID == "" || state.AwaitingCommit {
		return
	}
	e.mu.Lock()
	if e.sub != nil || e.turnCancel == nil || e.disconnectTimer != nil {
		e.mu.Unlock()
		return
	}
	grace := e.disconnectGrace
	if grace <= 0 {
		grace = agentEventDisconnectGrace
	}
	e.disconnectTimer = time.AfterFunc(grace, func() {
		e.disconnectTurnAfterGrace(state.TurnID)
	})
	e.mu.Unlock()
}

func (e *agentSessionExecutor) disconnectTurnAfterGrace(expectedTurnID string) {
	e.mu.Lock()
	e.disconnectTimer = nil
	hasLegacySubscriber := e.sub != nil
	turnCancel := e.turnCancel
	e.mu.Unlock()
	if hasLegacySubscriber || turnCancel == nil || e.hub.subscriberCount() > 0 {
		return
	}
	if err := e.interruptTurn(expectedTurnID); err != nil && !errors.Is(err, ErrAgentNoActiveTurn) {
		logging.LogErrorf("disconnect grace interrupt failed (session %s turn %s): %s", e.sessionID, expectedTurnID, err)
	}
}

func (e *agentSessionExecutor) publishSessionState() {
	state := e.turn.State()
	e.hub.publish("session_state", map[string]any{
		"turnID":          state.TurnID,
		"phase":           state.Phase,
		"steerable":       state.Steerable,
		"awaitingCommit":  state.AwaitingCommit,
		"subscriberCount": e.hub.subscriberCount(),
		"queue":           e.manager.SnapshotVersioned(e.sessionID),
	})
}

func (e *agentSessionExecutor) publishQueueState() {
	e.hub.publish("queue_state", map[string]any{"queue": e.manager.SnapshotVersioned(e.sessionID)})
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
	agentqueue.SemanticsQueue:       (*agentSessionExecutor).runQueuedAgentChat,
}

// runTurn 执行一次 turn：按语义选择执行函数，并把事件转发到订阅 channel。
func (e *agentSessionExecutor) runTurn(input *agentqueue.Input) {
	e.mu.Lock()
	sub := e.sub
	if sub == nil && e.hub.subscriberCount() == 0 {
		e.mu.Unlock()
		if _, err := e.manager.ReleaseClaim(e.sessionID, input.ID); err != nil {
			logging.LogErrorf("release unstarted agent input failed (session %s input %s): %s", e.sessionID, input.ID, err)
		}
		return
	}
	baseCtx := context.Background()
	if sub != nil {
		baseCtx = sub.ctx
	}
	turnCtx, turnCancel := context.WithCancel(baseCtx)
	e.turnCtx = turnCtx
	e.turnCancel = turnCancel
	e.mu.Unlock()
	if err := e.beginInputAnchor(input.ID); err != nil {
		e.failTurnBeforeStart(sub, input, err)
		return
	}

	var events <-chan agent.AgentEvent
	if runFn := e.runTurnFn; runFn != nil {
		// 测试注入优先（见 newTestExecutor）。
		events = runFn(turnCtx, input)
	} else if runner, ok := turnRunners[input.Semantics]; ok {
		events = runner(e, turnCtx, input)
	} else {
		// 未注册语义（正常流程不会发生：agentChat handler 只投递 user_message）。
		// 防御：记录并标记失败，避免静默丢弃。
		logging.LogErrorf("agent executor: unregistered semantics %q (session %s)", input.Semantics, e.sessionID)
		_ = e.manager.MarkFailed(e.sessionID, input.ID)
		if err := e.clearInputAnchor(input.ID); err != nil {
			logging.LogErrorf("clear unregistered agent input anchor failed (session %s input %s): %s", e.sessionID, input.ID, err)
		}
		e.finishTurn(sub)
		return
	}
	e.forwardEvents(sub, input, turnCtx, events)
}

// forwardEvents 只消费一次 AgentChat 流，并同时投影到旧 /chat 与会话事件 Hub。
func (e *agentSessionExecutor) forwardEvents(sub *agentLegacySubscription, input *agentqueue.Input, turnCtx context.Context, events <-chan agent.AgentEvent) {
	turnID := ""
	anchorBound := false
	for {
		select {
		case ev, ok := <-events:
			if !ok {
				if turnCtx.Err() != nil {
					_ = e.manager.Cancel(e.sessionID, input.ID)
				} else {
					_ = e.manager.MarkInjected(e.sessionID, input.ID)
				}
				e.finishInputAnchor(input.ID, turnID, anchorBound)
				e.publishQueueState()
				e.finishTurn(sub)
				return
			}
			if ev.Type == "turn" && ev.TurnID != "" {
				turnID = ev.TurnID
			} else if ev.TurnID == "" {
				if turnID == "" {
					turnID = e.turn.State().TurnID
				}
				ev.TurnID = turnID
			}
			if !anchorBound && turnID != "" {
				if err := e.bindInputTurn(input.ID, turnID); err != nil {
					logging.LogErrorf("bind agent input anchor failed (session %s input %s turn %s): %s", e.sessionID, input.ID, turnID, err)
				} else {
					anchorBound = true
				}
			}
			e.hub.publishAgentEvent(ev)
			if sub != nil {
				select {
				case sub.ch <- ev:
				case <-turnCtx.Done():
					e.drainCancelledTurnEvents(events)
					_ = e.manager.Cancel(e.sessionID, input.ID)
					e.finishInputAnchor(input.ID, turnID, anchorBound)
					e.publishQueueState()
					e.finishTurn(sub)
					return
				}
			}
		case <-turnCtx.Done():
			e.drainCancelledTurnEvents(events)
			_ = e.manager.Cancel(e.sessionID, input.ID)
			e.finishInputAnchor(input.ID, turnID, anchorBound)
			e.publishQueueState()
			e.finishTurn(sub)
			return
		}
	}
}

func (e *agentSessionExecutor) failTurnBeforeStart(sub *agentLegacySubscription, input *agentqueue.Input, err error) {
	if input != nil {
		if markErr := e.manager.MarkFailed(e.sessionID, input.ID); markErr != nil {
			logging.LogErrorf("mark agent input after anchor failure failed (session %s input %s): %s", e.sessionID, input.ID, markErr)
		}
	}
	event := agent.AgentEvent{Type: "error", Error: err.Error()}
	e.hub.publishAgentEvent(event)
	if sub != nil {
		sub.ch <- event
	}
	e.publishQueueState()
	e.finishTurn(sub)
}

func (e *agentSessionExecutor) finishInputAnchor(inputID, turnID string, anchorBound bool) {
	state := e.turn.State()
	if state.TurnID == "" {
		if err := e.clearInputAnchor(inputID); err != nil {
			logging.LogErrorf("clear unstarted agent input anchor failed (session %s input %s): %s", e.sessionID, inputID, err)
		}
		return
	}
	if anchorBound || turnID == "" {
		return
	}
	if err := e.bindInputTurn(inputID, turnID); err != nil {
		logging.LogErrorf("persist terminal agent input anchor failed (session %s input %s turn %s): %s", e.sessionID, inputID, turnID, err)
	}
}

func (e *agentSessionExecutor) drainCancelledTurnEvents(events <-chan agent.AgentEvent) {
	for event := range events {
		e.hub.publishAgentEvent(event)
	}
}

// finishTurn 关闭订阅 channel（通知 SSE 循环流结束）并清理当前订阅。
func (e *agentSessionExecutor) finishTurn(sub *agentLegacySubscription) {
	e.mu.Lock()
	if sub != nil && e.sub == sub {
		e.sub = nil
	}
	cancel := e.turnCancel
	e.turnCtx = nil
	e.turnCancel = nil
	e.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	if sub != nil {
		close(sub.ch)
	}
	e.releaseDeferredCommit()
}

func (e *agentSessionExecutor) releaseDeferredCommit() {
	e.commitMu.Lock()
	defer e.commitMu.Unlock()
	if e.committedTurnID == "" {
		return
	}
	if err := e.releaseCommittedTurnLocked(e.committedTurnID); err != nil {
		logging.LogErrorf("release committed agent turn failed (session %s turn %s): %s", e.sessionID, e.committedTurnID, err)
	}
}

func (e *agentSessionExecutor) interruptTurn(expectedTurnID string) error {
	if err := e.turn.Interrupt(expectedTurnID); err != nil {
		return err
	}
	e.mu.Lock()
	cancel := e.turnCancel
	e.mu.Unlock()
	if cancel == nil {
		return ErrAgentTurnNotSteerable
	}
	e.hub.publish("interrupted", map[string]any{"turnID": expectedTurnID})
	cancel()
	return nil
}

// runAgentChat 是 SemanticsUserMessage 语义的 turn 执行函数（已在 turnRunners 注册）：
// 按请求参数重建 client 并调用 agent.AgentChat。
func (e *agentSessionExecutor) runAgentChat(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
	params, err := decodeAgentTurnParams(input)
	if err != nil {
		logging.LogErrorf("decode agent turn parameters failed (session %s input %s): %s", e.sessionID, input.ID, err)
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
	return agent.AgentChatWithControl(ctx, client, m.Name, e.sessionID,
		params.UserEntryID, params.ContentRevision, input.Content, params.Language,
		params.References, params.EditorContext, params.PluginActions, params.Regenerate,
		time.Duration(params.ConfirmTimeoutMs)*time.Millisecond, params.MaxRetries,
		params.ReasoningEffort, taskDirectory, params.OwnerIdentityID, params.OwnerExpiresAt,
		time.Duration(params.RequestTimeoutMs)*time.Millisecond, time.Duration(params.StreamIdleTimeoutMs)*time.Millisecond, e.turn)
}

func (e *agentSessionExecutor) runQueuedAgentChat(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
	params, err := decodeAgentTurnParams(input)
	if err != nil {
		return e.failClaimedInput(input, err)
	}
	if params.UserEntryID == "" {
		return e.failClaimedInput(input, errors.New("queued agent user entry id is missing"))
	}
	binding, err := agent.GetTaskDirectoryBinding(e.sessionID)
	if err != nil {
		return e.failClaimedInput(input, err)
	}
	if binding != nil {
		if params.OwnerExpiresAt <= time.Now().Unix() {
			return e.failClaimedInput(input, errors.New("verified device owner authorization expired"))
		}
		if !subtleConstantTimeStringEqual(binding.OwnerIdentityID, params.OwnerIdentityID) {
			return e.failClaimedInput(input, errors.New("verified device owner access is required"))
		}
	}
	var editorContext *agent.EditorContext
	if hasAgentEditorContext(params.EditorContext) {
		value := params.EditorContext
		editorContext = &value
	}
	revision := params.ContentRevision
	if !params.Regenerate {
		revision, err = agent.AppendQueuedUserEntry(e.sessionID, agent.SessionEntry{
			ID:            params.UserEntryID,
			Type:          "user",
			Content:       input.Content,
			BlockHTML:     params.BlockHTML,
			References:    append([]agent.Reference(nil), params.References...),
			EditorContext: editorContext,
			Timestamp:     input.CreatedAt,
		})
		if err != nil {
			return e.failClaimedInput(input, err)
		}
	}
	e.hub.publish("input_promoted", map[string]any{
		"inputID": input.ID, "userEntryID": params.UserEntryID, "content": input.Content,
		"blockHTML": params.BlockHTML, "references": params.References, "editorContext": params.EditorContext,
		"queueVersion": e.manager.SnapshotVersioned(e.sessionID).QueueVersion,
	})
	params.ContentRevision = revision
	if input.Metadata == nil {
		input.Metadata = map[string]any{}
	}
	input.Metadata[turnParamsKey] = params
	return e.runAgentChat(ctx, input)
}

func hasAgentEditorContext(editorContext agent.EditorContext) bool {
	return editorContext.ActiveDocID != "" || editorContext.ActiveDocTitle != "" || editorContext.NotebookID != "" ||
		editorContext.FocusedBlockID != "" || len(editorContext.SelectedBlockIDs) > 0 || len(editorContext.VisibleBlockIDs) > 0
}

func (e *agentSessionExecutor) failClaimedInput(input *agentqueue.Input, err error) <-chan agent.AgentEvent {
	if input != nil {
		if markErr := e.manager.MarkFailed(e.sessionID, input.ID); markErr != nil {
			logging.LogErrorf("mark agent input failed (session %s input %s): %s", e.sessionID, input.ID, markErr)
		}
	}
	ch := make(chan agent.AgentEvent, agentEventErrorBuffer)
	ch <- agent.AgentEvent{Type: "error", Error: err.Error()}
	close(ch)
	return ch
}
