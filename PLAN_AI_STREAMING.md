# AI 流式响应改造计划

本计划旨在将思源笔记的 AI 对话功能从标准请求/响应模式改造为流式响应模式，以显著提升用户体验。

## 第一阶段：后端改造 (Go)

后端的改造是实现流式响应的基石。我们需要修改从 API 层到模型层，再到与 OpenAI 服务交互的整个链路。

### 1. 在 `util` 包中创建新的流式 `ChatGPTStream` 函数

**文件:** `kernel/util/openai.go`

**目标:** 创建一个 `ChatGPT` 的流式版本，利用 `go-openai` 库的流式能力。

**步骤:**

1.  **定义新函数 `ChatGPTStream`:**
    *   此函数将接收与现有 `ChatGPT` 函数类似的参数，但返回值将是一个 `(*openai.ChatCompletionStream, error)`，以便调用者可以接收流。
    *   函数签名: `func ChatGPTStream(msg string, contextMsgs []string, c *openai.Client, model string, maxTokens int, temperature float64, timeout int) (*openai.ChatCompletionStream, error)`

2.  **实现函数逻辑:**
    *   复用 `ChatGPT` 函数中构建 `reqMsgs` 的逻辑。
    *   在 `openai.ChatCompletionRequest` 中，增加 `Stream: true` 字段。
    *   调用 `c.CreateChatCompletionStream(ctx, req)` 来发起流式请求。
    *   返回 `stream` 和 `err`。

**新函数代码:**
```go
func ChatGPTStream(msg string, contextMsgs []string, c *openai.Client, model string, maxTokens int, temperature float64, timeout int) (*openai.ChatCompletionStream, error) {
    var reqMsgs []openai.ChatCompletionMessage
    // ... (复用现有构建 reqMsgs 的逻辑) ...
	for _, ctxMsg := range contextMsgs {
		if "" == ctxMsg {
			continue
		}

		reqMsgs = append(reqMsgs, openai.ChatCompletionMessage{
			Role:    "user",
			Content: ctxMsg,
		})
	}

	if "" != msg {
		reqMsgs = append(reqMsgs, openai.ChatCompletionMessage{
			Role:    "user",
			Content: msg,
		})
	}

	if 1 > len(reqMsgs) {
		return nil, nil // 或者返回一个特定的错误
	}

    req := openai.ChatCompletionRequest{
        Model:       model,
        MaxTokens:   maxTokens,
        Temperature: float32(temperature),
        Messages:    reqMsgs,
        Stream:      true, // 关键：开启流式响应
    }
    ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
    // 注意：这里的 context cancel 需要由调用方管理，或者采用不同的策略
    // 为简单起见，暂时让调用方负责 cancel
    
    return c.CreateChatCompletionStream(ctx, req)
}
```

### 2. 改造 `GPT` 接口和实现

**文件:** `kernel/model/ai.go`

**目标:** 使 `chat` 方法能够处理流式数据。

**步骤:**

1.  **修改 `GPT` 接口:**
    *   将 `chat` 方法修改为 `chatStream`，它将不再直接返回结果字符串，而是返回一个可供读取的流。
    *   **旧接口:** `chat(msg string, contextMsgs []string) (partRet string, stop bool, err error)`
    *   **新接口:** `chatStream(msg string, contextMsgs []string) (stream *openai.ChatCompletionStream, err error)`

2.  **修改 `OpenAIGPT` 实现:**
    *   实现新的 `chatStream` 接口。
    *   该方法将调用我们刚刚在 `util` 包中创建的 `ChatGPTStream` 函数。
    *   **旧实现:** `func (gpt *OpenAIGPT) chat(...) ...`
    *   **新实现:**
        ```go
        func (gpt *OpenAIGPT) chatStream(msg string, contextMsgs []string) (stream *openai.ChatCompletionStream, err error) {
            // 注意：这里的参数需要根据实际情况调整
            return util.ChatGPTStream(msg, contextMsgs, gpt.c, Conf.AI.OpenAI.APIModel, Conf.AI.OpenAI.APIMaxTokens, Conf.AI.OpenAI.APITemperature, Conf.AI.OpenAI.APITimeout)
        }
        ```
    *   **注意:** `CloudGPT` 的改造暂不考虑，可以后续实现或保留原样。

### 3. 改造 `chatGPTContinueWrite` 函数

**文件:** `kernel/model/ai.go`

**目标:** 调用流式接口并将数据流传递给 API 层。

**步骤:**

1.  **创建新的流式函数 `chatGPTContinueWriteStream`:**
    *   这个新函数将调用 `gpt.chatStream`。
    *   它将不再循环请求，而是直接返回从 `chatStream` 获得的流。
    *   **新函数签名:** `func chatGPTContinueWriteStream(msg string, contextMsgs []string, cloud bool) (stream *openai.ChatCompletionStream, err error)`

2.  **实现新函数:**
    ```go
    func chatGPTContinueWriteStream(msg string, contextMsgs []string, cloud bool) (stream *openai.ChatCompletionStream, err error) {
        // ... (复用 contextMsgs 长度检查的逻辑) ...

        var gpt GPT // 注意：这里需要确保 GPT 接口已经被更新
        if cloud {
            // 对于 CloudGPT，需要决定是暂不支持流式还是有其他实现
            return nil, errors.New("streaming not supported for CloudGPT")
        } else {
            gpt = &OpenAIGPT{c: util.NewOpenAIClient(...)}
        }
        
        return gpt.chatStream(msg, contextMsgs)
    }
    ```
    *   **注意:** 原有的 `chatGPTContinueWrite` 可以保留，用于非流式的功能，或者在确认所有调用点都更新后移除。

### 4. 改造 Gin API 处理函数 `api.chatGPT`

**文件:** `kernel/api/ai.go`

**目标:** 使用 Server-Sent Events (SSE) 将数据流式传输到前端。

**步骤:**

1.  **修改 `chatGPT` 函数:**
    *   它将调用新的 `model.chatGPTContinueWriteStream` 函数来获取数据流。
    *   它需要设置 SSE 相关的 HTTP Headers。
    *   它需要在一个循环中从流中读取数据，并将其作为 SSE 事件发送给客户端。

2.  **具体实现:**
    ```go
    func chatGPT(c *gin.Context) {
        // ... (复用现有的参数解析逻辑) ...
        msg := arg["msg"].(string)

        // 设置 SSE Headers
        c.Writer.Header().Set("Content-Type", "text/event-stream")
        c.Writer.Header().Set("Cache-Control", "no-cache")
        c.Writer.Header().Set("Connection", "keep-alive")
        c.Writer.Header().Set("Transfer-Encoding", "chunked")

        // 调用模型层的流式函数
        // 注意：这里的调用链需要根据实际修改来确定
        stream, err := model.chatGPTContinueWriteStream(msg, model.cachedContextMsg, false) // 这是一个示例调用
        if err != nil {
            // ... 错误处理 ...
            c.JSON(http.StatusInternalServerError, ret)
            return
        }
        if stream == nil {
            // 处理流为空的情况
            c.JSON(http.StatusOK, ret)
            return
        }
        defer stream.Close()

        clientDisconnected := c.Writer.CloseNotify()
        for {
            select {
            case <-clientDisconnected:
                return // 客户端断开连接
            default:
                response, err := stream.Recv()
                if errors.Is(err, io.EOF) {
                    return // 流结束
                }
                if err != nil {
                    // ... 错误处理 ...
                    return
                }
                
                // 发送 SSE 事件
                // 需要对内容进行 JSON 编码，以便前端可以解析
                data, _ := json.Marshal(map[string]string{
                    "content": response.Choices[0].Delta.Content,
                })
                c.Writer.WriteString("data: " + string(data) + "

")
                c.Writer.Flush()
            }
        }
    }
    ```
    *   **重要:** 为了简单起见，上面的代码片段省略了一些上下文管理和错误处理的细节。实际实现时需要更周全的考虑。

---

## 第二阶段：前端改造 (TypeScript)

前端的改造核心是使用 `fetch` API 来处理来自后端的 Server-Sent Events (SSE) 流，并实时更新聊天界面。

### 1. 改造 API 请求层

**目标:** 修改现有的 AI 对话请求函数，使其能够处理流式响应。

**可能的文件:** `app/src/ai/chat.ts` 或类似的网络请求模块。

**步骤:**

1.  **定位并修改 `fetch` 调用:**
    *   找到当前用于与 `/api/ai/chatGPT` 通信的函数。
    *   这个函数目前可能使用 `fetch(...).then(res => res.json())` 来获取一次性完整的响应。我们需要将其替换为能够处理流的模式。

2.  **实现流式处理逻辑:**
    *   使用 `fetch` 发起请求，但这次我们不直接调用 `.json()`。
    *   通过 `response.body.getReader()` 获取一个 `ReadableStreamDefaultReader`。
    *   在一个循环中调用 `reader.read()` 来不断获取数据块 (`Uint8Array`)。
    *   使用 `TextDecoder` 将数据块解码为字符串。
    *   SSE 事件通常以 `data: ` 开头，以 `

` 分隔。需要解析这些事件，提取其中的 JSON 数据。

**示例代码 (`chat.ts`):**

```typescript
// 这是一个新的或修改后的函数，用于处理流式聊天
// 它接收一个回调函数，用于在每次收到新消息片段时更新 UI
export const fetchStream = async (params: any, onMessage: (content: string) => void, onDone: () => void, onError: (error: Error) => void) => {
    const response = await fetch("/api/ai/chatGPT", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        onError(new Error(`HTTP error! status: ${response.status}`));
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("

");
            buffer = events.pop(); // 保留不完整的事件

            for (const event of events) {
                if (event.startsWith("data: ")) {
                    const dataStr = event.substring(6);
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.content) {
                            onMessage(data.content);
                        }
                    } catch (e) {
                        console.error("Failed to parse SSE data:", dataStr);
                    }
                }
            }
        }
    } catch (e) {
        onError(e);
    } finally {
        onDone();
        reader.releaseLock();
    }
};
```

### 2. 改造 UI 状态管理和组件

**目标:** 使聊天界面能够接收并实时追加显示的文本，而不是等待完整响应。

**可能的文件:** `app/src/dialog/ai/index.ts`, `app/src/protyle/wysiwyg/render.ts` 或相关的 UI 视图/组件。

**步骤:**

1.  **修改调用点:**
    *   找到调用第一步中 `fetch` 函数的地方（例如，当用户点击“发送”按钮时）。
    *   将其改为调用我们新的 `fetchStream` 函数。

2.  **实现 `onMessage` 回调:**
    *   在调用 `fetchStream` 时，传入一个 `onMessage` 回调函数。
    *   这个回调函数负责将收到的文本片段追加到当前正在显示的 AI 回复消息中。
    *   **首次**收到消息时，应在聊天窗口中创建一个新的、空的 AI 消息元素。
    *   **后续**收到消息时，将文本内容追加到该元素中。这会产生实时打字的效果。

3.  **实现 `onDone` 和 `onError` 回调:**
    *   `onDone`: 当流结束时被调用。可以在这里做一些清理工作，比如将 AI 回复消息的状态标记为“已完成”，或者重新启用发送按钮。
    *   `onError`: 处理在流式传输过程中可能发生的任何网络或解析错误。

**UI 逻辑示例 (`dialog/ai/index.ts`):**

```typescript
// 在处理用户发送消息的函数中

// 1. 禁用发送按钮，显示加载状态
// ...

// 2. 获取当前 AI 回复的 DOM 元素，或者创建一个新的
let aiResponseElement = this.element.querySelector(".b3-dialog__content .protyle-wysiwyg--ai");
if (!aiResponseElement) {
    // 假设 addMessage 是一个用于向聊天窗口添加新消息的函数
    aiResponseElement = this.addMessage("", "ai"); 
}

// 3. 调用流式 fetch
fetchStream(
    { msg: userInput },
    (contentChunk) => {
        // onMessage: 将新内容追加到 AI 回复元素中
        // 这里的实现取决于 Protyle 编辑器如何更新内容
        // 可能需要调用一个特定的编辑器 API 来追加文本
        const currentContent = aiResponseElement.innerHTML;
        aiResponseElement.innerHTML = currentContent + contentChunk.replace(/
/g, "<br>");
        // 滚动到底部
        this.element.querySelector(".b3-dialog__content").scrollTop = this.element.querySelector(".b3-dialog__content").scrollHeight;
    },
    () => {
        // onDone: 流结束，重新启用发送按钮
        console.log("Stream finished.");
        // ...
    },
    (error) => {
        // onError: 显示错误信息
        console.error("Stream error:", error);
        // ...
    }
);
```

## 总结

完成以上两个阶段的改造后，思源笔记的 AI 对话功能将实现流式响应。用户发送问题后，将立即看到 AI 的回答以打字机的效果逐字或逐句出现，无需等待整个回答生成完毕，从而极大地提升了交互的流畅性和即时感。
