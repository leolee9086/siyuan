package util

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/liushuangls/go-anthropic/v2"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
)

// CallClaudeChatCompletion 通过 go-anthropic/v2 桥接调用 Claude 兼容接口
func CallClaudeChatCompletion(msg string, contextMsgs []string, modelName string, maxTokens int, temperature float64, timeout int, apiKey, apiProxy, apiBaseURL string) (ret string, stop bool, err error) {

	// 1. 初始化 Anthropic Client
	clientOptions := []anthropic.ClientOption{}
	if apiBaseURL != "" {
		cleanURL := strings.TrimRight(apiBaseURL, "/")
		cleanURL = strings.TrimSuffix(cleanURL, "/v1/messages")
		cleanURL = strings.TrimSuffix(cleanURL, "/messages")
		cleanURL = strings.TrimSuffix(cleanURL, "/v1")
		cleanURL = strings.TrimRight(cleanURL, "/")

		if !strings.HasSuffix(cleanURL, "/v1") {
			cleanURL = cleanURL + "/v1"
		}

		clientOptions = append(clientOptions, anthropic.WithBaseURL(cleanURL))
	}

	transport := &http.Transport{}
	if apiProxy != "" {
		if proxyUrl, pErr := url.Parse(apiProxy); pErr == nil {
			transport.Proxy = http.ProxyURL(proxyUrl)
		} else {
			logging.LogErrorf("Claude API proxy parse failed: %v", pErr)
		}
	}
	httpClient := &http.Client{
		Transport: transport,
		Timeout:   time.Duration(timeout) * time.Second,
	}
	clientOptions = append(clientOptions, anthropic.WithHTTPClient(httpClient))

	client := anthropic.NewClient(apiKey, clientOptions...)

	// 2. 组装 Message 历史
	var reqMsgs []anthropic.Message
	for _, ctxMsg := range contextMsgs {
		if "" == ctxMsg {
			continue
		}
		// 默认简化为用户角色；在完整的 Claude API 中，往往要求 u/a 相间。
		// 这里暂以单方面的信息输入为准，由于 ChatGPT 原实现也全部为 role: user
		reqMsgs = append(reqMsgs, anthropic.NewUserTextMessage(ctxMsg))
	}

	if "" != msg {
		reqMsgs = append(reqMsgs, anthropic.NewUserTextMessage(msg))
	}

	if len(reqMsgs) < 1 {
		stop = true
		return
	}

	if maxTokens == 0 {
		maxTokens = 4096 // Claude 强制要求 MaxTokens，给个默认值
	}

	tempVar := float32(temperature)
	// 3. 构建请求体
	req := anthropic.MessagesRequest{
		Model:       anthropic.Model(modelName),
		Messages:    reqMsgs,
		MaxTokens:   maxTokens,
		Temperature: &tempVar,
	}

	// 4. 发起请求
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	resp, invokeErr := client.CreateMessages(ctx, req)
	if invokeErr != nil {
		PushErrMsg("Requesting Claude failed, please check kernel log for more details", 3000)
		logging.LogErrorf("create claude message failed: %s", invokeErr)
		stop = true
		err = invokeErr
		return
	}

	if len(resp.Content) < 1 {
		stop = true
		return
	}

	// 5. 组装结果（抹平差异）
	buf := &strings.Builder{}
	for _, c := range resp.Content {
		if c.Type == anthropic.MessagesContentTypeText {
			buf.WriteString(*c.Text)
		}
	}

	if resp.StopReason == anthropic.MessagesStopReasonMaxTokens || resp.StopReason == "length" {
		stop = false
	} else {
		stop = true
	}

	ret = buf.String()
	ret = strings.TrimSpace(ret)
	return
}

// CallClaudeChatCompletionMagi 是专供 MAGI 等传递了完整 []openai.ChatCompletionMessage 的拦截使用
func CallClaudeChatCompletionMagi(reqMsgs []openai.ChatCompletionMessage, modelName string, maxTokens int, temperature float64, timeout int, apiKey, apiProxy, apiBaseURL string) (ret string, stop bool, err error) {

	clientOptions := []anthropic.ClientOption{}
	if apiBaseURL != "" {
		cleanURL := strings.TrimRight(apiBaseURL, "/")
		cleanURL = strings.TrimSuffix(cleanURL, "/messages")
		cleanURL = strings.TrimRight(cleanURL, "/")

		if !strings.HasSuffix(cleanURL, "/v1") {
			cleanURL = cleanURL + "/v1"
		}

		clientOptions = append(clientOptions, anthropic.WithBaseURL(cleanURL))
	}

	transport := &http.Transport{}
	if apiProxy != "" {
		if proxyUrl, pErr := url.Parse(apiProxy); pErr == nil {
			transport.Proxy = http.ProxyURL(proxyUrl)
		}
	}
	httpClient := &http.Client{
		Transport: transport,
		Timeout:   time.Duration(timeout) * time.Second,
	}
	clientOptions = append(clientOptions, anthropic.WithHTTPClient(httpClient))

	client := anthropic.NewClient(apiKey, clientOptions...)

	var claudeMsgs []anthropic.Message
	for _, m := range reqMsgs {
		role := anthropic.RoleUser
		if m.Role == openai.ChatMessageRoleAssistant {
			role = anthropic.RoleAssistant
		}
		claudeMsgs = append(claudeMsgs, anthropic.Message{
			Role: role,
			Content: []anthropic.MessageContent{
				anthropic.NewTextMessageContent(m.Content),
			},
		})
	}

	if len(claudeMsgs) < 1 {
		stop = true
		return
	}
	if maxTokens == 0 {
		maxTokens = 4096
	}

	tempVar := float32(temperature)
	req := anthropic.MessagesRequest{
		Model:       anthropic.Model(modelName),
		Messages:    claudeMsgs,
		MaxTokens:   maxTokens,
		Temperature: &tempVar,
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	resp, invokeErr := client.CreateMessages(ctx, req)
	if invokeErr != nil {
		err = invokeErr
		stop = true
		return
	}

	if len(resp.Content) < 1 {
		stop = true
		return
	}

	buf := &strings.Builder{}
	for _, c := range resp.Content {
		if c.Type == anthropic.MessagesContentTypeText {
			buf.WriteString(*c.Text)
		}
	}

	if resp.StopReason == anthropic.MessagesStopReasonMaxTokens || resp.StopReason == "length" {
		stop = false
	} else {
		stop = true
	}

	ret = buf.String()
	ret = strings.TrimSpace(ret)
	return
}
