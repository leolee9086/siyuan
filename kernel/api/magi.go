package api

import (
	"context"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/88250/gulu"
	"github.com/gin-contrib/sse"
	"github.com/gin-gonic/gin"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// MagiRequest 代表一个入队的任务请求
type MagiRequest struct {
	Ctx      *gin.Context
	Req      openai.ChatCompletionRequest
	DoneChan chan struct{}
}

const (
	MagiTaskSourceGuardian = "Guardian"
	MagiTaskTypeChat       = "Chat"
	MagiTaskPriorityP0     = "P0"
)

var (
	magiQueue = make(chan *MagiRequest, 100) // 简易缓冲区，后续按需演进为优先级队列
	onceMagi  sync.Once
)

func initMagiCron() {
	onceMagi.Do(func() {
		go magiDispatcher()
	})
}

// magiDispatcher 扮演内部单线程 Cron 调度器的雏形。
// 第一阶段：它仅确保任务被串行化消化，保障 Trinity 上下文注入单线程原则。
func magiDispatcher() {
	for reqTask := range magiQueue {
		// 取出任务后，转交实际处理逻辑（此处为同步阻塞执行该任务）
		handleMagiTask(reqTask)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 封装信封入队（此处为外部直接 Chat 对话）
	// TTT 第一阶段需求：封装但暂不在信封处理过深，确保成功排队与唤回
	task := &MagiRequest{
		Ctx:      c,
		Req:      req,
		DoneChan: make(chan struct{}),
	}

	select {
	case magiQueue <- task:
		// 等待调度器消费完本任务
		<-task.DoneChan
	case <-c.Request.Context().Done():
		// 客户端断开连接
		return
	case <-time.After(30 * time.Second): // 简易排队超时防卡死
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Magi queue is full or processing too slow"})
	}
}

func handleMagiTask(task *MagiRequest) {
	defer close(task.DoneChan)

	req := task.Req
	c := task.Ctx

	// 抽出 messages 到 msg 和 contextMsgs
	msg, contextMsgs := extractMessagesToContext(req.Messages)

	// 获取思源已配置的 OpenAI Client
	client := util.NewOpenAIClient(
		model.Conf.AI.OpenAI.APIKey,
		model.Conf.AI.OpenAI.APIProxy,
		model.Conf.AI.OpenAI.APIBaseURL,
		model.Conf.AI.OpenAI.APIUserAgent,
		model.Conf.AI.OpenAI.APIVersion,
		model.Conf.AI.OpenAI.APIProvider,
	)

	// 根据是否 Stream 分发
	if req.Stream {
		magiChatStream(c, msg, contextMsgs, client, req)
	} else {
		magiChatSync(c, msg, contextMsgs, client, req)
	}
}

func extractMessagesToContext(messages []openai.ChatCompletionMessage) (msg string, contextMsgs []string) {
	if len(messages) == 0 {
		return "", nil
	}

	// 取最后一条 role=user 的作为 msg
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == openai.ChatMessageRoleUser {
			msg = messages[i].Content
			// 将之前的转为 context
			for j := 0; j < i; j++ {
				// 组装格式以兼容 util.ChatGPT 预期（奇数为 user，偶数为 assistant）
				contextMsgs = append(contextMsgs, messages[j].Content)
			}
			return
		}
	}

	// 兜底：如果没找到 user，把最后一条内容本身当作输入
	msg = messages[len(messages)-1].Content
	return
}

func magiChatSync(c *gin.Context, msg string, contextMsgs []string, client *openai.Client, req openai.ChatCompletionRequest) {
	// 调用现成 util (对应 `model.OpenAIGPT.chat`)
	modelName := req.Model
	if modelName == "" {
		modelName = model.Conf.AI.OpenAI.APIModel
	}

	partRet, stop, err := util.ChatGPT(
		msg, contextMsgs, client, modelName,
		model.Conf.AI.OpenAI.APIMaxTokens, model.Conf.AI.OpenAI.APITemperature, model.Conf.AI.OpenAI.APITimeout,
		model.Conf.AI.OpenAI.APIProvider, model.Conf.AI.OpenAI.APIKey, model.Conf.AI.OpenAI.APIProxy, model.Conf.AI.OpenAI.APIBaseURL,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if stop {
		// 被阻断
	}

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
					Content: partRet,
				},
				FinishReason: "stop",
			},
		},
	}

	c.JSON(http.StatusOK, resp)
}

func magiChatStream(c *gin.Context, msg string, contextMsgs []string, client *openai.Client, req openai.ChatCompletionRequest) {
	// 暂留：对接 go-openai 的 CreateChatCompletionStream
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Transfer-Encoding", "chunked")

	modelName := req.Model
	if modelName == "" {
		modelName = model.Conf.AI.OpenAI.APIModel
	}

	// 重新拼装为 OpenAI 标准请求体打给底层，这里复原了刚才拆出来的历史
	streamReq := openai.ChatCompletionRequest{
		Model:       modelName,
		Messages:    req.Messages, // 透传原始 messages 下去
		MaxTokens:   model.Conf.AI.OpenAI.APIMaxTokens,
		Temperature: float32(model.Conf.AI.OpenAI.APITemperature),
		Stream:      true,
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(model.Conf.AI.OpenAI.APITimeout)*time.Second)
	defer cancel()

	stream, err := client.CreateChatCompletionStream(ctx, streamReq)
	if err != nil {
		c.SSEvent("error", err.Error())
		return
	}
	defer stream.Close()

	c.Stream(func(w io.Writer) bool {
		response, err := stream.Recv()
		if err != nil {
			// io.EOF or others
			c.Render(-1, sse.Event{Data: "[DONE]"})
			return false
		}
		c.Render(-1, sse.Event{Data: response})
		return true // 继续循环
	})
}

func magiListModels(c *gin.Context) {
	modelName := model.Conf.AI.OpenAI.APIModel
	if modelName == "" {
		modelName = "gpt-4o" // fallback
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
