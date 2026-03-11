# 基础 AI 执行层流式输出改造与对接执行跟踪 (TikTocTak)

> **目标**: 目前 `kernel/model/ai.go` 和 `kernel/util/openai.go` 中的原生 ChatGPT 接口封层过厚，导致无法使用流式输出（Streaming）、函数调用（Function Calling）等高级特性。本任务旨在重构基础执行层，**保留现有简单接口的同时，提供一个全量暴露 `go-openai` 能力的原子化 Raw 接口**。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 📋 核心原则

### 问题定义

当前 `util.ChatGPT` 函数对 `github.com/sashabaranov/go-openai` 官方库进行了极其严苛的封装，将极为丰富的 `ChatCompletionRequest` 硬生生压缩成了只有 `model`, `maxTokens`, `temperature` 这三个参数。这不仅导致了无法使用原生的 Stream 数据流（导致 MAGI 这种长耗时应用体验极差），也彻底封死了未来使用 Tools（工具调用）、ResponseFormat（强制 JSON 输出）等高级能力的路径。

### 架构决策

**已确定方案：能力全量下放，提供原子化的 Raw 接口，并保留旧有封装以向后兼容。**

**决策理由**:
1. **彻底解耦与全量暴露**: 不要再去定义二手的包装结构。在底层模块中直接暴露一个接收 `openai.ChatCompletionRequest` 的原生接口。让底层回归纯粹的管道（Pipeline）角色，只负责鉴权、反向代理、限流与重试，不再插手业务参数。
2. **天生支持 Stream 与高级特性**: 因为 `ChatCompletionRequest` 原生带有 `Stream bool` 标志，底层接口只需要根据这个标志决定是调用 `CreateChatCompletion` 还是 `CreateChatCompletionStream`。
3. **向后兼容性极佳 (Backward Compatibility)**: 旧有的 `ChatGPT` 和 `chatGPTContinueWrite` 等封装接口**完全保留不动**（或者只是在内部转调新的 Raw 接口）。这就确保了诸如翻译、摘要、起名等老业务模块即使不做任何改动也能平稳运行。

### 验收检查清单

- [ ] `kernel/util/openai.go` 提供了接收 `openai.ChatCompletionRequest` 的基础 Raw 接口。
- [ ] Raw 接口能够根据请求体中的 `Stream` 标志，分别处理阻塞响应与基于 Callback（或 Channel）的流式推送。
- [ ] 原有依赖 `model.ChatGPT()` 的老业务不受影响。
- [ ] `adapter/llm_client.go` 中新的 `LLMClient` 实现了对 Raw 接口的安全代理。

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**把对应的任务剪切粘贴到最底下的【已归档】列表里，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，就从【中期计划】里挑几个任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **验证优先**：新老接口的兼容性测试需重于单纯的接口开发。

---

## 🟢 近期计划

- [ ] **Phase 1: 底层工具库原子化升级 (`kernel/util/openai.go`) (P1)**
  - **背景**: 将底层的能力全量下放，提供完整的 `go-openai` 通信管道。
  - **行动**:
    1. 在 `kernel/util/openai.go` 中新增 Raw 接口，例如：
       `func RawChatCompletion(ctx context.Context, c *openai.Client, req openai.ChatCompletionRequest, onStream func(chunk string)) (*openai.ChatCompletionResponse, error)`
    2. 在实现内部，判断 `req.Stream`：
       - 若为 `false`，调用阻塞式的 `c.CreateChatCompletion`，返回完整的 Response。
       - 若为 `true`，调用 `c.CreateChatCompletionStream`。持续读取 `Recv()`，将每个分块通过 `onStream` 回推，并在流结束时汇总所有内容组装成一个模拟的 `*openai.ChatCompletionResponse` 统一返回。
    3. **现有封装绝对保留**：不要删除原有的 `ChatGPT` 等简单接口。
  - **验收**:
    - 运行孤立 `go test`，传入原生的 `ChatCompletionRequest`（带 Stream），确认正常吐字。
    - 验证 Siyuan 本地老 AI 请求未受破坏。

- [ ] **Phase 2: 执行层代理器重构 (`kernel/agent/adapter/llm_client.go`) (P1)**
  - **背景**: 建立新一代的 AI 客户端代理，用于承载复杂业务逻辑（如 MAGI）对 Raw 能力的调用。
  - **行动**:
    1. 在 `adapter/llm_client.go` 中建立和完善 `LLMClient` 结构。
    2. 提供泛用的核心调用接口，安全透传 `RawChatCompletion`。
    3. 承接 API 错误统一翻译与拦截工作。

---

## 🟡 中期计划

- [ ] **Phase 3: MAGI 引擎流式透传编排 (`kernel/agent/engine.go` & `trinity.go`) (P1)**
  - **背景**: MAGI 中枢需要正确按需编排流式与阻塞调用，并将数据推送到 WebSocket (前端)。
  - **行动**:
    1. `MAGIEngine` 接口重新定型：
       `Think(ctx context.Context, sessionID string, inputMessage Message, onDelta func(chunk string)) error`
    2. 在 `trinity.go` 和 `wise_man.go` 的编排流中：
       - 调用三贤人侧写时：传入 `stream = false`。
       - 最终 Trinity 产出回复时：传入 `stream = true`。
    3. 在最终的 `onDelta` 回调函数中，持续将拿到的 token 通过 Siyuan 的 `util.PushMsg`（或专门 WebSocket event）推送到前端。
  - **验收**:
    - 确认前端在 Trinity 深思时显示“正在思考”，并只在最终出字时呈现打字机效果。

---

## 🔴 远期计划

- [ ] **Phase 4: 全局流式体验优化与监控 (P2)**
  - **愿景**: 流式输出断线重连或终止逻辑优化，添加后端生成速率（TPS）监控。

---

## 🏁 已归档/已完成

*(暂无)*
