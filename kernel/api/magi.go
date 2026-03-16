package api

import (
	"context"
	"errors"
	"fmt"
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
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/coordinator"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/session"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// MagiRequest 代表一个入队的任务请求
type MagiRequest struct {
	Req        openai.ChatCompletionRequest
	SessionID  string
	SourceCtx  *types.RequestSourceContext
	ResultChan chan MagiTaskResult
}

// MagiTaskResult 队列任务处理结果
type MagiTaskResult struct {
	ConsensusMsg *types.Message
	Err          error
}

type magiPersonaRuntimeStatus struct {
	SubjectName string
	SubjectID   string
	IsComplete  bool
	UsingPreset bool
	PresetName  string
}

const (
	MagiTaskSourceGuardian = "Guardian"
	MagiTaskTypeChat       = "Chat"
	MagiTaskPriorityP0     = "P0"
)

var (
	magiQueue       = make(chan *MagiRequest, 100) // 简易缓冲区，后续按需演进为优先级队列
	onceMagi        sync.Once
	magiSessionMgr  *session.SessionManager
	magiSourceSID   sync.Map // sourceSessionKey -> sessionID
	magiCoordinator *coordinator.Coordinator
	magiConfigMgr   *config.ConfigManager
	magiMelchior    *sages.Sage
	magiBalthazar   *sages.Sage
	magiCasper      *sages.Sage
	magiTrinity     *sages.Sage
	magiInitErr     error
	magiPersonaMu   sync.RWMutex
	magiPersonaInfo = magiPersonaRuntimeStatus{
		SubjectName: "ZHI",
	}
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
		SubjectName: subjectName,
		SubjectID:   subjectID,
		IsComplete:  isComplete,
		UsingPreset: usingPreset,
		PresetName:  normalizedPreset,
	}
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
		go magiDispatcher()
	})
}

// initMagiComponents 初始化MAGI核心组件
func initMagiComponents() error {
	// 创建配置管理器（使用默认配置）
	magiConfigMgr = config.NewConfigManager("")

	// 从Marduk加载人格档案
	profile, isComplete, presetName, err := marduk.InitializeMAGIWithPersona()
	if err != nil {
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

	// 创建 LLM 客户端（从全局配置）
	llmClient := llm.NewClientFromConf(model.Conf.AI.OpenAI)

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
	magiTrinity, err = sages.NewTrinity(magiConfigMgr, llmClient)
	if err != nil {
		return err
	}

	// 创建 SessionManager（30分钟超时）
	magiSessionMgr = session.NewSessionManager(30 * time.Minute)
	magiSessionMgr.StartCleanup(5 * time.Minute)

	// 创建 Coordinator（30秒收集超时）
	magiCoordinator = coordinator.NewCoordinator(30 * time.Second)

	logging.LogInfof("MAGI组件初始化完成")
	return nil
}

func magiPersonaStatus(c *gin.Context) {
	if authErr := requireMagiMainUIAccess(c); authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}
	initMagiCron()
	info := getMagiPersonaRuntimeStatus()
	c.JSON(http.StatusOK, gin.H{
		"subject_name": info.SubjectName,
		"subject_id":   info.SubjectID,
		"is_complete":  info.IsComplete,
		"using_preset": info.UsingPreset,
		"preset_name":  info.PresetName,
	})
}

// magiDispatcher 扮演内部单线程 Cron 调度器的雏形。
// 第一阶段：它仅确保任务被串行化消化，保障 Trinity 上下文注入单线程原则。
func magiDispatcher() {
	for reqTask := range magiQueue {
		// 取出任务后，转交实际处理逻辑（此处为同步阻塞执行该任务）
		result := handleMagiTask(reqTask)
		reqTask.ResultChan <- result
		close(reqTask.ResultChan)
	}
}

// magiChat 接口主入口，负责将请求转化为内部信封并入队
func magiChat(c *gin.Context) {
	// 确保单例调度器已启动
	initMagiCron()

	if "" == model.Conf.AI.OpenAI.APIKey {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "OpenAI API Key not configured"})
		return
	}

	var req openai.ChatCompletionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logging.LogErrorf("magiChat ShouldBindJSON failed: %s", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Model == "" {
		req.Model = model.Conf.AI.OpenAI.APIModel
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
	task := &MagiRequest{
		Req:        req,
		SessionID:  getOrCreateSession(c, sourceCtx),
		SourceCtx:  sourceCtx,
		ResultChan: make(chan MagiTaskResult, 1),
	}

	select {
	case magiQueue <- task:
	case <-c.Request.Context().Done():
		return nil, c.Request.Context().Err()
	case <-time.After(30 * time.Second): // 简易排队超时防卡死
		return nil, errors.New("magi queue is full or processing too slow")
	}

	select {
	case result := <-task.ResultChan:
		return result.ConsensusMsg, result.Err
	case <-c.Request.Context().Done():
		return nil, c.Request.Context().Err()
	case <-time.After(120 * time.Second):
		return nil, errors.New("magi task wait timeout")
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
	if err.Error() == "no user message found" {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err.Error() == "magi queue is full or processing too slow" {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": err.Error()})
		return
	}
	if err.Error() == "magi task wait timeout" {
		c.JSON(http.StatusGatewayTimeout, gin.H{"error": err.Error()})
		return
	}
	logging.LogErrorf("MAGI任务处理失败: %v", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}

func handleMagiTask(task *MagiRequest) MagiTaskResult {
	req := task.Req

	// 检查初始化错误
	if magiInitErr != nil {
		return MagiTaskResult{Err: errors.New("MAGI system not initialized: " + magiInitErr.Error())}
	}

	// 提取用户消息
	userMessage := extractUserMessage(req.Messages)
	if userMessage == "" {
		return MagiTaskResult{Err: errors.New("no user message found")}
	}

	// 调用 Coordinator 执行决策
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	consensusMsg, err := magiCoordinator.CoordinateDecision(
		ctx,
		task.SessionID,
		magiMelchior,
		magiBalthazar,
		magiCasper,
		magiTrinity,
		userMessage,
		task.SourceCtx,
	)

	if err != nil {
		return MagiTaskResult{Err: err}
	}
	return MagiTaskResult{ConsensusMsg: consensusMsg}
}

// extractUserMessage 从消息列表中提取用户消息
func extractUserMessage(messages []openai.ChatCompletionMessage) string {
	if len(messages) == 0 {
		return ""
	}

	// 取最后一条 role=user 的消息
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == openai.ChatMessageRoleUser {
			return messages[i].Content
		}
	}

	// 没有找到用户消息，返回空字符串让上层报错
	return ""
}

// getOrCreateSession 获取或创建会话ID
func getOrCreateSession(c *gin.Context, sourceCtx *types.RequestSourceContext) string {
	// 尝试从请求头获取 session ID
	sessionID := sanitizeMagiSessionID(c.GetHeader("X-MAGI-Session-ID"))
	if sessionID != "" {
		if _, ok := magiSessionMgr.GetSession(sessionID); ok {
			magiSessionMgr.UpdateActivity(sessionID)
			if sourceCtx != nil && sourceCtx.SourceSessionKey != "" {
				magiSourceSID.Store(sourceCtx.SourceSessionKey, sessionID)
			}
			return sessionID
		}
		// 当前端已建立 websocket 订阅时，允许用该 ID 显式创建会话以确保事件可回投到同一连接。
		userID := "default-user"
		if sourceCtx != nil && sourceCtx.PrincipalID != "" {
			userID = sourceCtx.PrincipalID
		}
		session := magiSessionMgr.CreateSessionWithID(sessionID, userID)
		if sourceCtx != nil && sourceCtx.SourceSessionKey != "" {
			magiSourceSID.Store(sourceCtx.SourceSessionKey, session.ID)
		}
		return session.ID
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
	}

	// 创建新会话
	userID := "default-user"
	if sourceCtx != nil && sourceCtx.PrincipalID != "" {
		userID = sourceCtx.PrincipalID
	}
	session := magiSessionMgr.CreateSession(userID)
	if sourceCtx != nil && sourceCtx.SourceSessionKey != "" {
		magiSourceSID.Store(sourceCtx.SourceSessionKey, session.ID)
	}
	return session.ID
}

func sanitizeMagiSessionID(raw string) string {
	sessionID := strings.TrimSpace(raw)
	if sessionID == "" || len(sessionID) > 128 {
		return ""
	}
	for _, r := range sessionID {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= 'A' && r <= 'Z':
		case r >= '0' && r <= '9':
		case r == '-', r == '_', r == '.', r == ':':
		default:
			return ""
		}
	}
	return sessionID
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

	c.JSON(http.StatusOK, resp)
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
	c.Render(-1, sse.Event{Data: finalChunk})
	c.Render(-1, sse.Event{Data: "[DONE]"})
}

func magiListModels(c *gin.Context) {
	modelName := model.Conf.AI.OpenAI.APIModel
	if modelName == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "模型名称未配置"})
		return
	}

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
