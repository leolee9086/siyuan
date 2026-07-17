package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/88250/gulu"
	"github.com/gin-contrib/sse"
	"github.com/gin-gonic/gin"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel/cli"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel/trust"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel/wechat"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/coordinator"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prefix"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/session"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
	"github.com/siyuan-note/siyuan/kernel/util"
	shared "github.com/siyuan-note/siyuan/packages/websearch"
)

// MagiRequest 代表一个入队的任务请求
type MagiRequest struct {
	Req        openai.ChatCompletionRequest
	SessionID  string
	SourceCtx  *types.RequestSourceContext
	RequestCtx context.Context
	ResultChan chan MagiTaskResult
}

// MagiTaskResult 队列任务处理结果
type MagiTaskResult struct {
	ConsensusMsg *types.Message
	Err          error
}

// DispatcherTaskType 统一分发器任务类型
type DispatcherTaskType int

const (
	TaskTypeUserMessage DispatcherTaskType = iota
	TaskTypeHeartbeat
)

// DispatcherTask 统一分发器任务，替代 MagiRequest 成为队列中的唯一任务类型。
// 外部消息和心跳消息通过同一队列、同一分发器串行处理。
type DispatcherTask struct {
	Type DispatcherTaskType

	// 外部消息字段（TaskTypeUserMessage）
	Req        *openai.ChatCompletionRequest
	SessionID  string
	SourceCtx  *types.RequestSourceContext
	RequestCtx context.Context
	ResultChan chan MagiTaskResult

	// 心跳字段（TaskTypeHeartbeat）
	// 所有数据在 tryStartHeartbeat 中捕获，分发器直接使用，不再访问 runtime manager。
	Run                         *magiHeartbeatRun
	HeartbeatCtx                context.Context
	HeartbeatPrompt             string
	HeartbeatSourceCtx          *types.RequestSourceContext
	HeartbeatPassiveRecallBasis *types.PassiveRecallBasis
	HeartbeatIsSleepTime        bool
}

type magiPersonaRuntimeStatus struct {
	SubjectName   string
	SubjectID     string
	IsComplete    bool
	UsingPreset   bool
	PresetName    string
	Blocked       bool
	Message       string
	MissingFields []string
}

const (
	MagiTaskSourceGuardian   = "Guardian"
	MagiTaskTypeChat         = "Chat"
	MagiTaskPriorityP0       = "P0"
	maxClaimedRecentHistory  = 8
	maxMagiMonitorSessionID  = 120
	magiMonitorSessionPrefix = "magi-route-"
)

var (
	dispQueue       = NewDispatcherRingQueue(100) // 按保护环分级的优先队列
	onceMagi        sync.Once
	magiSessionMgr  *session.SessionManager
	magiSourceSID   sync.Map // sourceSessionKey -> sessionID
	magiCoordinator *coordinator.Coordinator
	magiConfigMgr   *config.ConfigManager
	magiMelchior    *sages.Sage
	magiBalthazar   *sages.Sage
	magiCasper      *sages.Sage
	magiRuntimeMgr  = newMagiRuntimeManager(defaultMagiHeartbeatInterval)
	magiInitErr     error
	magiPersonaMu   sync.RWMutex
	magiPersonaInfo = magiPersonaRuntimeStatus{
		SubjectName: "未配置",
	}
	// prefixDispatcher 前缀指令路由器，在 handleChannelInbound 最前置分流。
	// nil 表示未初始化（MAGI 组件未就绪），此时所有消息走原有 MAGI 对话流程。
	prefixDispatcher *prefix.Dispatcher
)

func setMagiPersonaRuntimeStatus(profile *marduk.IpipPersonaProfile, isComplete bool, presetName string) {
	subjectName := ""
	subjectID := ""
	if profile != nil {
		subjectName = strings.TrimSpace(profile.Subject.Name)
		subjectID = strings.TrimSpace(profile.Subject.ID)
	}

	normalizedPreset := strings.TrimSpace(presetName)
	usingPreset := !isComplete && normalizedPreset != ""
	if subjectName == "" {
		if normalizedPreset != "" {
			subjectName = normalizedPreset
		} else {
			subjectName = "未配置"
		}
	}

	magiPersonaMu.Lock()
	defer magiPersonaMu.Unlock()
	magiPersonaInfo = magiPersonaRuntimeStatus{
		SubjectName:   subjectName,
		SubjectID:     subjectID,
		IsComplete:    isComplete,
		UsingPreset:   usingPreset,
		PresetName:    normalizedPreset,
		Blocked:       false,
		Message:       "",
		MissingFields: nil,
	}
}

func setMagiPersonaRuntimeBlockedStatus(err error) string {
	message := strings.TrimSpace(err.Error())
	missingFields := make([]string, 0)
	var validationErr *marduk.PersonaProfileValidationError
	if errors.As(err, &validationErr) {
		missingFields = append(missingFields, validationErr.MissingFields...)
		if len(missingFields) > 0 {
			message = fmt.Sprintf(
				"当前主管AI人格档案缺少必填字段：%s。请打开适格者 PERSONA 录入面板补充后重新保存。",
				strings.Join(missingFields, ", "),
			)
		}
	}

	magiPersonaMu.Lock()
	defer magiPersonaMu.Unlock()
	magiPersonaInfo = magiPersonaRuntimeStatus{
		SubjectName:   "未配置",
		IsComplete:    false,
		UsingPreset:   false,
		PresetName:    "",
		Blocked:       true,
		Message:       message,
		MissingFields: missingFields,
	}
	return message
}

func getMagiPersonaRuntimeStatus() magiPersonaRuntimeStatus {
	magiPersonaMu.RLock()
	defer magiPersonaMu.RUnlock()
	return magiPersonaInfo
}

func initMagiCron() {
	onceMagi.Do(func() {
		// 初始化 MAGI 组件
		if err := initMagiComponents(); err != nil {
			logging.LogErrorf("初始化MAGI组件失败: %v", err)
			magiInitErr = err
		}
		go unifiedDispatcher()
		if magiInitErr == nil {
			magiRuntimeMgr.Start()
		}
	})
}

// BootstrapMagiRuntimeAsync 在内核启动阶段后台预热 MAGI 运行时。
// 这样心跳循环不会依赖首次 MAGI API/UI 访问才开始。
func BootstrapMagiRuntimeAsync() {
	go initMagiCron()
}

// initMagiComponents 初始化MAGI核心组件
func initMagiComponents() error {
	// 创建配置管理器（使用默认配置）
	magiConfigMgr = config.NewConfigManager("")

	// 从Marduk加载人格档案
	profile, isComplete, presetName, err := marduk.InitializeMAGIWithPersona()
	if err != nil {
		if blockedMessage := setMagiPersonaRuntimeBlockedStatus(err); blockedMessage != "" {
			util.PushErrMsg(blockedMessage, 10000)
		}
		return fmt.Errorf("加载Marduk人格档案失败: %w", err)
	}

	// 将人格档案传递给ConfigManager
	magiConfigMgr.SetPersonaProfile(profile)

	if !isComplete && presetName != "" {
		// 使用了预设人格，推送WebSocket通知
		msg := fmt.Sprintf("人格档案不完整，当前由预设人格 %s 负责回答，请完善人格档案", presetName)
		util.PushMsg(msg, 7000)
		logging.LogInfof("MAGI使用预设人格: %s", presetName)
	} else if isComplete {
		logging.LogInfof("MAGI已加载完整人格档案")
	}

	setMagiPersonaRuntimeStatus(profile, isComplete, presetName)

	// 创建 LLM 客户端，直接从 providers 读取 agent 模型，与 agentChat 一致
	var llmClient llm.Client
	if p, m := model.Conf.AI.GetAgentModel(); p != nil && m != nil {
		llmClient = llm.NewClientFromProvider(p, m, util.UserAgent,
			model.Conf.AI.EffectiveAPIProxy(model.Conf.System))
	}
	if llmClient == nil {
		return fmt.Errorf("MAGI agent model is not configured")
	}

	// 创建四个 Sage 实例
	magiMelchior, err = sages.NewMelchior(magiConfigMgr, llmClient)
	if err != nil {
		return err
	}
	magiBalthazar, err = sages.NewBalthazar(magiConfigMgr, llmClient)
	if err != nil {
		return err
	}
	magiCasper, err = sages.NewCasper(magiConfigMgr, llmClient)
	if err != nil {
		return err
	}

	// 创建 SessionManager（30分钟超时）
	magiSessionMgr = session.NewSessionManager(30 * time.Minute)
	magiSessionMgr.StartCleanup(5 * time.Minute)

	// 创建 Coordinator（30秒收集超时）
	magiCoordinator = coordinator.NewCoordinator(30 * time.Second)
	magiCoordinator.SetDominantSelectionObserver(magiRuntimeMgr)

	// 注入投票配置（超时、重试次数、退避基时）
	tc := magiConfigMgr.GetTimeoutConfig()
	magiCoordinator.SetVotingConfig(coordinator.VotingConfig{
		Timeout:     tc.VotingTimeout,
		MaxRetries:  tc.VotingMaxRetries,
		BackoffBase: tc.VotingBackoffBase,
	})

	// 初始化通道可信度配置目录（延迟加载，因为 util.ConfDir 在包 init 时可能未就绪）
	globalTrustMgr.EnsureConfigDir(util.ConfDir)

	// 注入全局身份解析器，供 coordinator 等包校验渠道用户身份
	trust.DefaultIdentityResolver = func(channelID, accountID, userID string) trust.ResolveResult {
		return globalTrustMgr.Resolve(channelID, accountID, userID)
	}

	// 注入全局信任配置提供者，供 coordinator 等包查询全量联系人信息
	trust.DefaultConfigProvider = globalTrustMgr.GetConfig

	// 注入全局渠道用户身份标签解析器，供 coordinator 等包查询联系人身份标签
	trust.DefaultChannelIdentityResolver = func(channelID, accountID, userID string) (string, string) {
		record := globalMagiIdentityStore.resolveIdentityByChannel(channelID, accountID, userID)
		if record == nil {
			return "", ""
		}
		return record.IdentityID, record.DisplayName
	}

	// 注入全局渠道用户身份绑定枚举器，供 coordinator 等包从身份存储获取全量绑定用户
	trust.DefaultChannelBindingEnumerator = func() []trust.ChannelBindingInfo {
		views, err := globalMagiIdentityStore.listViews()
		if err != nil {
			return nil
		}
		var out []trust.ChannelBindingInfo
		for _, v := range views {
			if !v.Enabled {
				continue
			}
			for _, b := range v.ChannelBindings {
				out = append(out, trust.ChannelBindingInfo{
					ChannelID:     b.ChannelID,
					AccountID:     b.AccountID,
					UserID:        b.UserID,
					IdentityLabel: v.IdentityID,
					DisplayName:   v.DisplayName,
				})
			}
		}
		return out
	}

	// 注册外部通道桥接器
	channel.GlobalBridge().SetHandler(handleChannelInbound)

	// 初始化渠道消息存储
	if err := channel.InitMessageStore(); err != nil {
		logging.LogWarnf("MAGI 渠道消息存储初始化失败: %v", err)
	}

	// 初始化 token 编码器（用于上下文 token 裁剪）
	if err := sages.InitTokenEncoders(); err != nil {
		logging.LogWarnf("MAGI token 编码器初始化失败: %v", err)
	}

	// 恢复已持久化的微信渠道适配器
	recoverWechatAdapters()

	// 初始化前缀指令路由器
	initPrefixDispatcher()

	logging.LogInfof("MAGI组件初始化完成")
	return nil
}

// initPrefixDispatcher 初始化前缀指令路由器。
// 从 conf/prefix-commands.json 加载配置，注册到 handleChannelInbound 的最前置分流。
func initPrefixDispatcher() {
	prefixConfigMgr = prefix.NewConfigManager(util.ConfDir)
	prefixDispatcher = prefix.NewDispatcher(globalTrustMgr)
	prefixDispatcher.SetCommands(prefixConfigMgr.GetCommands())
	logging.LogInfof("prefix dispatcher initialized with %d commands", len(prefixConfigMgr.GetCommands()))
}

func recoverWechatAdapters() {
	accountIDs := wechat.ListIndexedAccountIDs(util.ConfDir)
	if len(accountIDs) == 0 {
		return
	}

	for _, accountID := range accountIDs {
		instanceID := "wechat-" + accountID
		if _, exists := channel.Get(instanceID); exists {
			logging.LogInfof("MAGI 跳过恢复微信适配器 %s：已有活跃实例", accountID)
			continue
		}
		adapter := wechat.NewAdapter(accountID)
		if !adapter.IsConfigured() {
			logging.LogWarnf("MAGI 恢复微信适配器 %s 失败：凭证无效", accountID)
			continue
		}
		channel.Register(adapter)
		if err := adapter.Start(context.Background()); err != nil {
			logging.LogWarnf("MAGI 恢复微信适配器 %s 失败: %v", accountID, err)
			continue
		}
		logging.LogInfof("MAGI 已恢复微信适配器: account=%s", accountID)
	}
	if len(channel.All()) >= 1 {
		logging.LogInfof("MAGI 已恢复 %d 个渠道适配器", len(channel.All()))
	}
}

func magiPersonaStatus(c *gin.Context) {
	if authErr := requireMagiMainUIAccess(c); authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}
	initMagiCron()
	info := getMagiPersonaRuntimeStatus()
	c.JSON(http.StatusOK, gin.H{
		"subject_name":   info.SubjectName,
		"subject_id":     info.SubjectID,
		"is_complete":    info.IsComplete,
		"using_preset":   info.UsingPreset,
		"preset_name":    info.PresetName,
		"blocked":        info.Blocked,
		"message":        info.Message,
		"missing_fields": info.MissingFields,
		"runtime":        magiRuntimeMgr.GetStatus(),
	})
}

// unifiedDispatcher 统一分发器，串行处理所有 MAGI 任务。
// 外部消息和心跳消息按保护环优先级进入同一队列，高 ring 任务优先处理。
func unifiedDispatcher() {
	for {
		task := dispQueue.PopBlocking()
		switch task.Type {
		case TaskTypeHeartbeat:
			hbResult, err := magiCoordinator.CoordinateHeartbeat(
				task.HeartbeatCtx,
				magiRuntimeMonitorSessionID,
				magiMelchior,
				magiBalthazar,
				magiCasper,
				task.HeartbeatPrompt,
				task.HeartbeatSourceCtx,
				task.HeartbeatPassiveRecallBasis,
				task.HeartbeatIsSleepTime,
			)
			magiRuntimeMgr.finishHeartbeat(task.Run, hbResult, err)
			close(task.Run.done)
		default:
			result := handleMagiTask(task)
			task.ResultChan <- result
			close(task.ResultChan)
		}
	}
}

// magiChat 接口主入口，负责将请求转化为内部信封并入队
func magiChat(c *gin.Context) {
	// 确保单例调度器已启动
	initMagiCron()

	provider, agentModel := model.Conf.AI.GetAgentModel()
	if provider == nil || agentModel == nil || provider.APIKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI Provider not configured"})
		return
	}

	var req openai.ChatCompletionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logging.LogErrorf("magiChat ShouldBindJSON failed: %s", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Model == "" {
		req.Model = agentModel.Name
	}

	sourceCtx, authErr := resolveOpenAISourceContext(c, &req)
	if authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}

	logging.LogInfof("magiChat received request: model=[%s] stream=[%v] msgs_count=[%d]", req.Model, req.Stream, len(req.Messages))

	consensusMsg, err := submitMagiTask(c, req, sourceCtx)
	if err != nil {
		writeMagiTaskError(c, err)
		return
	}

	modelName := req.Model

	if req.Stream {
		sendStreamResponse(c, consensusMsg, modelName)
	} else {
		sendSyncResponse(c, consensusMsg, modelName)
	}
}

func submitMagiTask(c *gin.Context, req openai.ChatCompletionRequest, sourceCtx *types.RequestSourceContext) (*types.Message, error) {
	if magiInitErr != nil {
		return nil, fmt.Errorf("MAGI system not initialized: %w", magiInitErr)
	}
	if magiSessionMgr == nil {
		return nil, errors.New("MAGI session manager is not ready")
	}

	magiRuntimeMgr.InterruptHeartbeat()

	sessionID := getOrCreateSession(c, sourceCtx)
	if sessionID == "" {
		return nil, errors.New("MAGI session manager is not ready")
	}

	task := &DispatcherTask{
		Type:       TaskTypeUserMessage,
		Req:        &req,
		SessionID:  sessionID,
		SourceCtx:  sourceCtx,
		RequestCtx: c.Request.Context(),
		ResultChan: make(chan MagiTaskResult, 1),
	}

	if !dispQueue.Push(Ring0ExternalMessage, task) {
		return nil, errors.New("magi queue is full or processing too slow")
	}

	select {
	case result := <-task.ResultChan:
		return result.ConsensusMsg, result.Err
	case <-c.Request.Context().Done():
		return nil, c.Request.Context().Err()
	}
}

func writeMagiTaskError(c *gin.Context, err error) {
	if err == nil {
		return
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return
	}
	if coordinator.IsAvatarUnavailable(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if coordinator.IsAvatarDispatchRequired(err) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}
	if err.Error() == "no chat messages found" {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err.Error() == "magi queue is full or processing too slow" {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": err.Error()})
		return
	}
	logging.LogErrorf("MAGI任务处理失败: %v", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}

func handleMagiTask(task *DispatcherTask) (result MagiTaskResult) {
	if task.Type == TaskTypeHeartbeat {
		return MagiTaskResult{Err: errors.New("unexpected heartbeat task in handleMagiTask")}
	}

	// 外部通道消息没有 Req（无 OpenAI 请求体），直接从 SourceCtx 获取用户消息
	if task.Req == nil && task.SourceCtx != nil {
		return handleChannelTask(task)
	}

	req := task.Req

	// 检查初始化错误
	if magiInitErr != nil {
		return MagiTaskResult{Err: errors.New("MAGI system not initialized: " + magiInitErr.Error())}
	}

	claimedRecentHistory := extractClaimedRecentHistory(req.Messages)
	if len(claimedRecentHistory) == 0 {
		return MagiTaskResult{Err: errors.New("no chat messages found")}
	}
	lastUserMessage, hasUserMessage := findLastClaimedUserMessage(claimedRecentHistory)
	userMessage := buildClaimedUserMessagePreview(claimedRecentHistory)
	magiRuntimeMgr.BeginForeground(userMessage)
	defer func() {
		magiRuntimeMgr.FinishForeground(result.Err)
	}()

	// 防御性注入：通知贤者此轮由外部消息触发，覆盖可能残留的心跳轮次上下文
	injectForegroundSystemNote(task.SessionID)

	// 调用 Coordinator 执行决策。使用请求上下文承载取消信号，避免给整轮流程附加共享 deadline。
	ctx := task.RequestCtx
	if ctx == nil {
		ctx = context.Background()
	}

	consensusMsg, err := magiCoordinator.CoordinateDecision(
		ctx,
		task.SessionID,
		magiMelchior,
		magiBalthazar,
		magiCasper,
		userMessage,
		task.SourceCtx,
		claimedRecentHistory,
	)

	if err != nil {
		result = MagiTaskResult{Err: err}
		return
	}
	magiRuntimeMgr.ApplyForegroundConsensus(consensusMsg)
	if hasUserMessage {
		magiRuntimeMgr.RememberForegroundTurn(lastUserMessage, consensusMsg.Content)
	}
	result = MagiTaskResult{ConsensusMsg: consensusMsg}
	return
}

// handleChannelTask 处理来自外部通道的消息（无 OpenAI 请求体）。
func handleChannelTask(task *DispatcherTask) (result MagiTaskResult) {
	if magiInitErr != nil {
		return MagiTaskResult{Err: errors.New("MAGI system not initialized: " + magiInitErr.Error())}
	}

	userMessage := extractChannelUserMessage(task.SourceCtx)
	if userMessage == "" {
		return MagiTaskResult{Err: errors.New("empty channel message")}
	}

	magiRuntimeMgr.BeginForeground(userMessage)
	defer func() {
		magiRuntimeMgr.FinishForeground(result.Err)
	}()

	// 防御性注入：通知贤者此轮由外部消息触发，覆盖可能残留的心跳轮次上下文
	injectForegroundSystemNote(task.SessionID)

	ctx := task.RequestCtx
	if ctx == nil {
		ctx = context.Background()
	}

	consensusMsg, err := magiCoordinator.CoordinateDecision(
		ctx,
		task.SessionID,
		magiMelchior,
		magiBalthazar,
		magiCasper,
		userMessage,
		task.SourceCtx,
		nil,
	)
	if err != nil {
		return MagiTaskResult{Err: err}
	}

	magiRuntimeMgr.ApplyForegroundConsensus(consensusMsg)

	// 外部通道消息：决策完成后通过通道适配器回复
	if err := routeChannelOutbound(ctx, task.SourceCtx, consensusMsg.Content); err != nil {
		logging.LogErrorf("route channel outbound failed: %v", err)
	}

	return MagiTaskResult{ConsensusMsg: consensusMsg}
}

// extractChannelUserMessage 从外部通道的 SourceCtx 中提取用户消息。
func extractChannelUserMessage(sourceCtx *types.RequestSourceContext) string {
	if sourceCtx == nil {
		return ""
	}
	// RawAttributes 中由 channel bridge 写入用户消息原文
	if msg, ok := sourceCtx.RawAttributes["userMessage"]; ok {
		return msg
	}
	return ""
}

// injectForegroundSystemNote 向三贤者注入外部消息触发提示，防御性覆盖可能残留的心跳上下文。
func injectForegroundSystemNote(sessionID string) {
	note := "[系统提示] 外部消息已记录，请以 <source=user_message> 为准开始处理。"
	msg := types.ContextMessage{Role: types.RoleSystem, Content: note}
	if magiMelchior != nil {
		_ = magiMelchior.AddToContextWithSession(sessionID, msg)
	}
	if magiBalthazar != nil {
		_ = magiBalthazar.AddToContextWithSession(sessionID, msg)
	}
	if magiCasper != nil {
		_ = magiCasper.AddToContextWithSession(sessionID, msg)
	}
}

// handleChannelInbound 处理来自外部通道的入站消息。
// 注册为 channel.GlobalBridge 的回调。
func handleChannelInbound(ctx context.Context, msg *channel.InboundMessage) error {
	if magiSessionMgr == nil {
		return errors.New("MAGI session manager not ready")
	}
	magiRuntimeMgr.InterruptHeartbeat()

	channelType := msg.ChannelType
	channelInstanceID := msg.ChannelID
	accountID := msg.AccountID
	userID := msg.UserID

	if channelType == "cli" {
		return handleCLIInbound(ctx, msg)
	}

	// 前缀指令路由：命中前缀指令则执行 handler 不走 MAGI 对话流程。
	// 这是最前置的分流——在身份绑定检查之前，因为前缀指令（如收集/待办）
	// 不需要 MAGI 身份，只需要信任配置中的 TrustLevel 检查。
	if prefixDispatcher != nil {
		handled, err := prefixDispatcher.Dispatch(ctx, msg)
		if err != nil {
			logging.LogErrorf("prefix dispatch error: %v", err)
		}
		if handled {
			return nil
		}
	}

	sourceSessionKey := fmt.Sprintf("%s:%s:%s", channelType, accountID, userID)
	rawAttributes := map[string]string{
		"channelId":         channelType,
		"accountId":         accountID,
		"userId":            userID,
		"userMessage":       msg.Text,
		"conversationToken": msg.ConversationToken,
	}

	// 查询信任配置决定 DirectResponseAllowed
	trustResult := globalTrustMgr.Resolve(channelType, accountID, userID)
	directOK := trustResult.DirectAllowed

	identityID := accountID + ":" + userID
	nickname := firstNonEmpty(trustResult.Nickname, msg.Nickname)
	interfaceKind := channelType + "-bot"

	// 检测绑定码：格式 MB-XXXXXX
	userText := strings.TrimSpace(msg.Text)
	if strings.HasPrefix(userText, magiBindCodePrefix) {
		code := strings.TrimPrefix(userText, magiBindCodePrefix)
		bindIdentityID, ok := consumeBindCode(code)
		if ok {
			bindRecord, err := globalMagiIdentityStore.get(bindIdentityID)
			if err != nil || !bindRecord.Enabled {
				_ = routeChannelOutboundRaw(channelInstanceID, accountID, userID, "身份已禁用或不存在，请联系管理员。")
				return nil
			}
			_ = globalMagiIdentityStore.addChannelBinding(bindIdentityID, channelBinding{
				ChannelID: channelType,
				AccountID: accountID,
				UserID:    userID,
			})
			reply := fmt.Sprintf("绑定成功！欢迎 %s。", firstNonEmpty(bindRecord.DisplayName, bindRecord.IdentityID))
			_ = routeChannelOutboundRaw(channelInstanceID, accountID, userID, reply)
			return nil
		}
		_ = routeChannelOutboundRaw(channelInstanceID, accountID, userID, "绑定码无效或已过期，请在身份管理中重新生成。")
		return nil
	}

	// 尝试从身份卡绑定中解析该渠道用户的 MAGI 身份
	identityRecord := globalMagiIdentityStore.resolveIdentityByChannel(channelType, accountID, userID)

	// 未绑定用户：自动回复引导
	if identityRecord == nil {
		_ = routeChannelOutboundRaw(channelInstanceID, accountID, userID,
			"您尚未绑定身份。请在 MAGI 身份管理中获得绑定码后发送给我。")
		return nil
	}

	if identityRecord != nil {
		identityID = identityRecord.IdentityID
		if nickname == "" {
			nickname = firstNonEmpty(identityRecord.Nickname, identityRecord.DisplayName)
		}
		interfaceKind = fmt.Sprintf("%s-bot/%s", channelType, identityRecord.IdentityID)
		if identityRecord.RouteClass == "guardian" {
			directOK = true
		}
		rawAttributes["boundIdentityId"] = identityRecord.IdentityID
		if identityRecord.DisplayName != "" {
			rawAttributes["boundDisplayName"] = identityRecord.DisplayName
		}
		// 身份归属写回消息体，供 SaveInbound 落盘
		msg.IdentityID = identityRecord.IdentityID
		msg.IdentityDisplayName = firstNonEmpty(identityRecord.DisplayName, identityRecord.Nickname)
	}

	sourceCtx := &types.RequestSourceContext{
		Channel:               types.SourceChannelExternalAgent,
		PrincipalID:           userID,
		IdentityID:            identityID,
		Nickname:              nickname,
		InterfaceID:           channelInstanceID,
		InterfaceKind:         interfaceKind,
		SourceSessionKey:      sourceSessionKey,
		DirectResponseAllowed: directOK,
		TrustBase:             types.TrustLevel(trustResult.TrustBase),
		RiskLevel:             types.TrustLevel(trustResult.RiskLevel),
		AuthStrength:          types.AuthStrengthMedium,
		ModelIntent:           "general",
		RawAttributes:         rawAttributes,
	}

	sessionID := getOrCreateSession(nil, sourceCtx)
	if sessionID == "" {
		return errors.New("failed to create MAGI session for channel message")
	}

	task := &DispatcherTask{
		Type:       TaskTypeUserMessage,
		SessionID:  sessionID,
		SourceCtx:  sourceCtx,
		RequestCtx: ctx,
		ResultChan: make(chan MagiTaskResult, 1),
	}

	if !dispQueue.Push(Ring0ExternalMessage, task) {
		return errors.New("magi queue is full")
	}

	// 异步等待结果（不阻塞桥接器）
	go func() {
		select {
		case result := <-task.ResultChan:
			if result.Err != nil {
				logging.LogWarnf("channel message processing error: %v", result.Err)
				// 尝试发送错误提示
				_ = routeChannelOutbound(context.Background(), sourceCtx, "抱歉，处理消息时出现错误，请稍后再试。")
			}
		case <-ctx.Done():
		}
	}()

	return nil
}

// handleCLIInbound 处理来自 CLI 通道的入站消息。
// 跳过身份卡绑定流程，直接进入 MAGI 调度。
func handleCLIInbound(ctx context.Context, msg *channel.InboundMessage) error {
	channelInstanceID := msg.ChannelID
	accountID := msg.AccountID
	userID := msg.UserID
	channelType := msg.ChannelType

	sourceSessionKey := fmt.Sprintf("%s:%s:%s", channelType, accountID, userID)
	rawAttributes := map[string]string{
		"channelId":         channelType,
		"accountId":         accountID,
		"userId":            userID,
		"userMessage":       msg.Text,
		"conversationToken": msg.ConversationToken,
	}

	adapter, ok := channel.Get(channelInstanceID)
	if ok {
		if cliAdapter, ok2 := adapter.(*cli.Adapter); ok2 {
			ident := cliAdapter.Identity()
			rawAttributes["workingDir"] = ident.WorkingDir
			rawAttributes["scenario"] = ident.Scenario
			rawAttributes["authenticatedUser"] = ident.AuthenticatedUser
		}
	}

	trustResult := globalTrustMgr.Resolve(channelType, accountID, userID)

	authStrength := types.AuthStrengthWeak
	identityDecl := "身份未经校验"
	if userID != "unknown" && userID != "" {
		authStrength = types.AuthStrengthMedium
		identityDecl = "持有工作空间token，但身份未经校验"
	}

	// 身份归属写回消息体，供 SaveInbound 落盘
	msg.IdentityID = userID
	msg.IdentityDisplayName = msg.Nickname

	sourceCtx := &types.RequestSourceContext{
		Channel:               types.SourceChannelExternalAgent,
		PrincipalID:           userID,
		IdentityID:            userID,
		Nickname:              msg.Nickname,
		InterfaceID:           channelInstanceID,
		InterfaceKind:         "cli-tool",
		SourceSessionKey:      sourceSessionKey,
		DirectResponseAllowed: true,
		TrustBase:             types.TrustLevel(trustResult.TrustBase),
		RiskLevel:             types.TrustLevel(trustResult.RiskLevel),
		AuthStrength:          authStrength,
		ModelIntent:           "general",
		RawAttributes:         rawAttributes,
	}
	rawAttributes["identityDeclaration"] = identityDecl

	sessionID := getOrCreateSession(nil, sourceCtx)
	if sessionID == "" {
		return errors.New("failed to create MAGI session for CLI message")
	}

	task := &DispatcherTask{
		Type:       TaskTypeUserMessage,
		SessionID:  sessionID,
		SourceCtx:  sourceCtx,
		RequestCtx: ctx,
		ResultChan: make(chan MagiTaskResult, 1),
	}

	if !dispQueue.Push(Ring0ExternalMessage, task) {
		return errors.New("magi queue is full")
	}

	go func() {
		select {
		case result := <-task.ResultChan:
			if result.Err != nil {
				logging.LogWarnf("CLI message processing error: %v", result.Err)
				_ = routeChannelOutbound(context.Background(), sourceCtx, "抱歉，处理消息时出现错误，请稍后再试。")
			}
		case <-ctx.Done():
		}
	}()

	return nil
}

// routeChannelOutbound 将 MAGI 回复通过对应通道适配器发送出去。
func routeChannelOutbound(ctx context.Context, sourceCtx *types.RequestSourceContext, reply string) error {
	if sourceCtx == nil || reply == "" {
		return nil
	}

	channelID := sourceCtx.RawAttributes["channelId"]
	accountID := sourceCtx.RawAttributes["accountId"]
	if channelID == "" {
		return nil
	}

	instanceID := channelID + "-" + accountID
	adapter, ok := channel.Get(instanceID)
	if !ok {
		// 兼容旧数据：回退到 channelID 查询
		adapter, ok = channel.Get(channelID)
		if !ok {
			return fmt.Errorf("channel adapter not found: %s", instanceID)
		}
	}

	msg := &channel.OutboundMessage{
		ChannelID:         channelID,
		AccountID:         sourceCtx.RawAttributes["accountId"],
		UserID:            sourceCtx.PrincipalID,
		Text:              reply,
		ConversationToken: sourceCtx.RawAttributes["conversationToken"],
	}

	return adapter.SendMessage(ctx, msg)
}

// routeChannelOutboundRaw 直接向渠道发送消息，不依赖 sourceCtx。
func routeChannelOutboundRaw(channelID, accountID, userID, text string) error {
	adapter, ok := channel.Get(channelID)
	if !ok {
		return fmt.Errorf("channel adapter not found: %s", channelID)
	}
	return adapter.SendMessage(context.Background(), &channel.OutboundMessage{
		ChannelID: channelID,
		AccountID: accountID,
		UserID:    userID,
		Text:      text,
	})
}

func extractClaimedRecentHistory(messages []openai.ChatCompletionMessage) []types.ClaimedHistoryMessage {
	if len(messages) == 0 {
		return nil
	}

	history := make([]types.ClaimedHistoryMessage, 0, len(messages))
	for _, message := range messages {
		role := strings.TrimSpace(message.Role)
		content := strings.TrimSpace(message.Content)
		if role == "" || content == "" {
			continue
		}
		switch role {
		case openai.ChatMessageRoleUser, openai.ChatMessageRoleAssistant:
		case openai.ChatMessageRoleSystem:
			if _, ok := extractSourcePayloadFromText(content); ok {
				continue
			}
		default:
			continue
		}
		history = append(history, types.ClaimedHistoryMessage{
			Role:    role,
			Content: content,
		})
	}
	if len(history) > maxClaimedRecentHistory {
		history = history[len(history)-maxClaimedRecentHistory:]
	}
	return history
}

func buildClaimedUserMessagePreview(history []types.ClaimedHistoryMessage) string {
	if message, ok := findLastClaimedUserMessage(history); ok {
		return message
	}
	if len(history) == 0 {
		return ""
	}
	return history[len(history)-1].Content
}

func findLastClaimedUserMessage(history []types.ClaimedHistoryMessage) (string, bool) {
	for i := len(history) - 1; i >= 0; i-- {
		if strings.TrimSpace(history[i].Role) == openai.ChatMessageRoleUser {
			content := strings.TrimSpace(history[i].Content)
			if content != "" {
				return content, true
			}
		}
	}
	return "", false
}

// getOrCreateSession 获取或创建会话ID
func getOrCreateSession(_ *gin.Context, sourceCtx *types.RequestSourceContext) string {
	if magiSessionMgr == nil {
		return ""
	}

	// 尝试从来源会话键恢复固定会话
	if sourceCtx != nil && sourceCtx.SourceSessionKey != "" {
		if mappedID, ok := magiSourceSID.Load(sourceCtx.SourceSessionKey); ok {
			if existingID, castOK := mappedID.(string); castOK {
				if _, sessionOK := magiSessionMgr.GetSession(existingID); sessionOK {
					magiSessionMgr.UpdateActivity(existingID)
					return existingID
				}
			}
			magiSourceSID.Delete(sourceCtx.SourceSessionKey)
		}

		deterministicID := buildDeterministicMagiMonitorSessionID(sourceCtx.SourceSessionKey)
		if deterministicID != "" {
			if _, ok := magiSessionMgr.GetSession(deterministicID); ok {
				magiSessionMgr.UpdateActivity(deterministicID)
				magiSourceSID.Store(sourceCtx.SourceSessionKey, deterministicID)
				return deterministicID
			}
			session := magiSessionMgr.CreateSessionWithID(deterministicID, userIDFromSourceCtx(sourceCtx))
			magiSourceSID.Store(sourceCtx.SourceSessionKey, session.ID)
			return session.ID
		}
	}

	// 创建新会话
	userID := userIDFromSourceCtx(sourceCtx)
	session := magiSessionMgr.CreateSession(userID)
	if sourceCtx != nil && sourceCtx.SourceSessionKey != "" {
		magiSourceSID.Store(sourceCtx.SourceSessionKey, session.ID)
	}
	return session.ID
}

func userIDFromSourceCtx(sourceCtx *types.RequestSourceContext) string {
	if sourceCtx != nil && sourceCtx.PrincipalID != "" {
		return sourceCtx.PrincipalID
	}
	return "default-user"
}

func buildDeterministicMagiMonitorSessionID(sourceSessionKey string) string {
	normalized := strings.TrimSpace(sourceSessionKey)
	if normalized == "" {
		return ""
	}
	rawSessionID := magiMonitorSessionPrefix + normalized
	if len(rawSessionID) <= maxMagiMonitorSessionID {
		return rawSessionID
	}
	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(normalized))
	return fmt.Sprintf("%s%016x", magiMonitorSessionPrefix, hasher.Sum64())
}

// sendSyncResponse 发送同步响应
func sendSyncResponse(c *gin.Context, msg *types.Message, modelName string) {
	resp := openai.ChatCompletionResponse{
		ID:      "chatcmpl-magi-" + gulu.Rand.String(12),
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   modelName,
		Choices: []openai.ChatCompletionChoice{
			{
				Index: 0,
				Message: openai.ChatCompletionMessage{
					Role:    openai.ChatMessageRoleAssistant,
					Content: msg.Content,
				},
				FinishReason: "stop",
			},
		},
	}

	links := magiWebSearchLinks(msg)
	if len(links) == 0 {
		c.JSON(http.StatusOK, resp)
		return
	}
	// Keep the OpenAI-compatible response shape while exposing renderer-only
	// targets outside the model message. The map is never sent to an LLM.
	payload := make(map[string]interface{})
	raw, _ := json.Marshal(resp)
	if err := json.Unmarshal(raw, &payload); err != nil {
		c.JSON(http.StatusOK, resp)
		return
	}
	payload["webSearchLinks"] = links
	c.JSON(http.StatusOK, payload)
}

// sendStreamResponse 发送流式响应
func sendStreamResponse(c *gin.Context, msg *types.Message, modelName string) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Transfer-Encoding", "chunked")

	// 分块发送内容
	content := msg.Content
	chunkSize := 10 // 每次发送10个字符
	chunkID := "chatcmpl-magi-" + gulu.Rand.String(12)

	for i := 0; i < len(content); i += chunkSize {
		end := i + chunkSize
		if end > len(content) {
			end = len(content)
		}

		chunk := openai.ChatCompletionStreamResponse{
			ID:      chunkID,
			Object:  "chat.completion.chunk",
			Created: time.Now().Unix(),
			Model:   modelName,
			Choices: []openai.ChatCompletionStreamChoice{
				{
					Index: 0,
					Delta: openai.ChatCompletionStreamChoiceDelta{
						Content: content[i:end],
					},
				},
			},
		}

		c.Render(-1, sse.Event{Data: chunk})
		c.Writer.Flush()
		time.Sleep(10 * time.Millisecond)
	}

	// 发送结束标记
	finalChunk := openai.ChatCompletionStreamResponse{
		ID:      chunkID,
		Object:  "chat.completion.chunk",
		Created: time.Now().Unix(),
		Model:   modelName,
		Choices: []openai.ChatCompletionStreamChoice{
			{
				Index:        0,
				Delta:        openai.ChatCompletionStreamChoiceDelta{},
				FinishReason: "stop",
			},
		},
	}
	if links := magiWebSearchLinks(msg); len(links) > 0 {
		payload := make(map[string]interface{})
		raw, _ := json.Marshal(finalChunk)
		if err := json.Unmarshal(raw, &payload); err == nil {
			payload["webSearchLinks"] = links
			c.Render(-1, sse.Event{Data: payload})
		} else {
			c.Render(-1, sse.Event{Data: finalChunk})
		}
	} else {
		c.Render(-1, sse.Event{Data: finalChunk})
	}
	c.Render(-1, sse.Event{Data: "[DONE]"})
}

func magiWebSearchLinks(msg *types.Message) map[string]string {
	if msg == nil || msg.Meta == nil {
		return nil
	}
	links := make(map[string]string)
	switch raw := msg.Meta["webSearchLinks"].(type) {
	case map[string]string:
		for token, target := range raw {
			if strings.HasPrefix(token, "ref:web-") && shared.IsSearchResultURL(target) {
				links[token] = target
			}
		}
	case map[string]interface{}:
		for token, value := range raw {
			target, ok := value.(string)
			if ok && strings.HasPrefix(token, "ref:web-") && shared.IsSearchResultURL(target) {
				links[token] = target
			}
		}
	}
	if len(links) == 0 {
		return nil
	}
	return links
}

func magiListModels(c *gin.Context) {
	_, agentModel := model.Conf.AI.GetAgentModel()
	if agentModel == nil || agentModel.Name == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "模型名称未配置"})
		return
	}
	modelName := agentModel.Name

	// 模拟 /v1/models 响应
	c.JSON(http.StatusOK, gin.H{
		"object": "list",
		"data": []gin.H{
			{
				"id":       modelName,
				"object":   "model",
				"created":  0,
				"owned_by": "s-forge",
			},
		},
	})
}
