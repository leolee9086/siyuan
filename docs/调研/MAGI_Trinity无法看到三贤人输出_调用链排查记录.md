# MAGI Trinity 无法看到三贤人输出：调用链排查记录（2026-03-16）

## 约束
- 不修改任何代码。
- 仅基于真实调用链与运行日志排查，不做主观猜测。

## 调用链（从入口到 Trinity）
1. `api/magi.go` `handleMagiTask` 调用 `Coordinator.CoordinateDecision`。
2. `coordinator/coordinator.go` 进入 `collector.CollectResponses` 收集三贤人输出。
3. `coordinator/collector.go` 在 `buildSageResponse` 中构建 `types.SageResponse{Content, Seel...}`。
4. `coordinator/trinity.go` `buildIntrospectionInput` 从 `validResponses` 取 `melchior/balthazar/casper` 内容。
5. `coordinator/trinity.go` `injectIntrospection` 将：
   - `think_about(input=userInput)` 作为 assistant tool call 注入；
   - `think_result=introspection` 作为 tool 消息注入。
6. `coordinator/trinity.go` `callTrinity` 首轮 `SendMessage(" ")`，后续多轮 `SendContinuation(...)`。

## 逐项排查与排除

### C1. 三贤人输出是否成功产生
- 证据（日志）：
  - `SEEL_REPLY_COMPLETED seelName=melchior` 有非空 `message.content`（如 line 19, 62, 109）。
  - `SEEL_REPLY_COMPLETED seelName=balthazar` 有非空 `message.content`（如 line 28, 70, 113）。
  - `SEEL_REPLY_COMPLETED seelName=casper` 有非空 `message.content`（如 line 24, 66, 105）。
- 结论：**“三贤人完全没有输出”可排除**。

### C2. 三贤人输出是否组装并注入到 Trinity 首轮请求
- 代码证据：
  - `coordinator/trinity.go:99-104`：`buildIntrospectionInput` 直接取三贤人内容。
  - `coordinator/trinity.go:146+`：`injectIntrospection` 注入 `introspection_call + tool_result`。
- 日志证据：
  - `LLM_REQUEST_SENT seelName=trinity` 首轮（line 39）包含：
    - `introspection_call`；
    - tool 内容 `"逻辑告诉我... 情绪告诉我... 直觉告诉我..."`。
- 结论：**“首轮没有传给 Trinity”可排除**。

### C3. Trinity 续写轮是否仍能看到 introspection（高概率根因）
- 代码证据（链路）：
  - `coordinator/trinity.go:210`：续写使用 `SendContinuation`。
  - `coordinator/trinity.go:274,297,304`：每轮未完成时会追加 assistant/tool/system(continuation prompt) 到上下文。
  - `config/manager.go:264-265`：Trinity 默认 `message_count=3`。
  - `sages/sage.go:265-272`：`message_count` 策略会裁剪为最近 `Count` 条消息。
- 日志证据（同一轮连续请求）：
  - line 39：`HasIntrospection=True`、`HasThinkResult=True`。
  - line 40-44：`HasIntrospection=False`，仅剩 `speak_start/speak_continue` 续写链。
  - 统计结果：`trinity_llm_requests=74`，其中 `introspection_requests=16`，`continuation_requests=58`。
  - 每轮都多次请求：`trinity_rounds=16`，`rounds_with_multiple_turns=16`，`max_turns=6`。
- 结论：**首轮后大量续写请求丢失三贤人结论**，与“Trinity 看不到三贤人输出”高度一致。

### C4. 系统并不保证“三贤人都成功”进入 Trinity（次高概率）
- 代码证据：
  - `collector.go:114-115`：只要求“至少 2 个贤者成功”即可继续统合。
- 日志证据：
  - line 338：`melchior` 失败（`wanna_speak_start 与 wanna_speak_stop 必须成对调用`）。
  - line 340：该轮 Trinity 首轮 introspection 出现空段：`逻辑告诉我：` 后直接空行。
  - 统计：`blank_logic_introspection_count=1`。
- 结论：**存在“并非三贤人齐全”就进入 Trinity 的路径**，会造成 Trinity 输入不完整。

### C5. 放大偏航的非主因
- `prompts/trinity.go:6` 的 `BuildTrinityIntrospectionInput` 不做缺失贤者回退文本，缺失即空段。
- Trinity 请求前缀包含较长人格唤醒材料（日志可见大量 `seraph/echo`），当 introspection 在续写轮被裁掉时，更容易漂移到自述型输出。

## 当前结论（按可能性排序）
1. **P0**：Trinity 续写阶段因 `message_count=3` 裁剪，导致三贤人输出只在首轮可见，后续 58 条续写请求不可见。
2. **P1**：收集层允许 2/3 成功即进入统合，导致部分轮次本身就不是完整“三贤人输入”。
3. **P2**：缺失输入无回退文案 + 长人格前缀，放大了“看不到三贤人输出”后的行为偏航。

## 附：本次使用的关键定位点
- 代码：
  - `kernel/nerv/magi/coordinator/coordinator.go`
  - `kernel/nerv/magi/coordinator/collector.go`
  - `kernel/nerv/magi/coordinator/trinity.go`
  - `kernel/nerv/magi/coordinator/toolcall_context.go`
  - `kernel/nerv/magi/sages/sage.go`
  - `kernel/nerv/magi/config/manager.go`
  - `kernel/nerv/magi/prompts/trinity.go`
- 日志：
  - `kernel/.tmp_magi_api_live_full.log`
