# MAGI 审慎投票总是否决问题调查报告

## 问题描述

用户反馈审慎投票结果一直都是否决，怀疑后端的 nerv/magi 内部进行了不恰当的回退或默认消息而没有将消息真正提交决策。

## 调查发现

### 核心问题：proposedAction 参数传递错误

**位置**：`kernel/nerv/magi/coordinator/coordinator.go:223`

```go
// 执行投票
return ProcessVoting(ctx, sessionId, roundId, balthazar, casper, melchiorConclusion, voteCtx, deliberationInitiator, deliberationReason)
```

**问题分析**：

1. **参数混淆**：`ProcessVoting` 函数的第6个参数应该是 `proposedAction`（待审议提案），但实际传入的是 `melchiorConclusion`（Melchior的结论）。

2. **投票提示词结构**（`kernel/nerv/magi/prompts/voting.go:23-32`）：
   ```go
   func BuildVoteUserInput(proposedAction, userMessage, melchiorConclusion string) string {
       return fmt.Sprintf(`用户原始输入：
   %s

   Melchior 关键判断：
   %s

   待审议提案：
   %s`, userMessage, melchiorConclusion, proposedAction)
   }
   ```

3. **实际效果**：由于 `proposedAction` 和 `melchiorConclusion` 被传入了相同的值，投票时 Balthazar 和 Casper 看到的提示词是：
   ```
   用户原始输入：
   [用户消息]

   Melchior 关键判断：
   [某个内容]

   待审议提案：
   [完全相同的内容]  ← 这里重复了
   ```

4. **导致的后果**：
   - 提示词中"Melchior 关键判断"和"待审议提案"内容完全重复
   - LLM 可能因为看到重复内容而感到困惑
   - 没有明确的"提案"概念，只有判断的重复
   - Balthazar 和 Casper 可能因为提案不明确而倾向于保守地投否决票

5. **投票机制**：
   - Melchior 默认投批准票（`voting.go:104`）
   - 如果 Balthazar 和 Casper 都投否决票，结果是 1/3 批准，投票不通过
   - 需要 ≥2/3 批准才能通过（`voting.go:202`）

### 次要发现

1. **超时和失败处理**：
   - 投票超时（30秒）会被视为否决票（`voting.go:39, 151`）
   - LLM 请求失败也会被视为否决票（`voting.go:151`）
   - 这些是合理的保守策略，不是问题

2. **决策解析存在严重问题**（`voting.go:169-188`）：
   ```go
   func parseDecision(content string) string {
       // 优先尝试JSON解析
       var decision voteDecision
       if err := json.Unmarshal([]byte(content), &decision); err == nil {
           if decision.Decision == voteApprove || decision.Decision == voteReject {
               return decision.Decision
           }
       }
   
       //chu到文本关键词匹配
       if strings.Contains(content, voteApprove) {
           return voteApprove
       }
       if strings.Contains(content, voteReject) {
           return voteReject
       }
   
       // 保守否决
       return voteReject
   }
   ```
   
   **问题**：
   - 层层回退隐藏了真实的解析失败原因
   - JSON 解析失败时静默回退到文本匹配
   - 文本匹配失败时静默返回否决
   - 无法区分"LLM 明确投否决票"和"解析失败默认否决"
   - 调试困难，无法发现 LLM 输出格式问题
   
   **应该改为**：
   - 解析失败时记录详细日志（包括原始内容）
   - 返回错误而不是默认值
   - 让调用者明确知道解析失败并决定如何处理

3. **前端处理**：
   - 前端正确处理了投票事件（`app/src/magi/events/magiProjector.ts:268-297`）
   - 前端显示逻辑正常（`app/src/magi/components/seel-panel/SeelPanelVoteContent.vue`）

## 根本原因

**`proposedAction` 参数语义不清晰，导致调用时传入了错误的值。**

在当前的投票流程中：
- `melchiorConclusion` 是 Melchior 对用户输入的分析和判断
- `proposedAction` 应该是基于 Melchior 判断提出的具体行动方案

但在 `coordinator.go` 中，这两个概念被混为一谈，都使用了 `melchiorConclusion` 的值。

## 影响范围

- 所有触发审慎投票的场景
- Balthazar 和 Casper 的投票决策质量
- 最终的投票通过率

## 建议修复方案

### 方案1：明确提案内容（推荐）

从 Melchior 的响应中提取或构造明确的行动提案：

```go
// 在 executeVoting 函数中
var melchiorConclusion string
var proposedAction string  // 新增

for _, resp := range responses {
    if resp.Seel == "melchior" {
        melchiorConclusion = resp.Content
        // 提取或构造提案
        proposedAction = extractProposedAction(resp)  // 需要实现
        // ...
    }
}

// 调用时传入正确的参数
return ProcessVoting(ctx, sessionId, roundId, balthazar, casper, proposedAction, voteCtx, deliberationInitiator, deliberationReason)
```

### 方案2：简化提示词结构

如果 Melchior 的结论本身就是提案，那么应该调整投票提示词，避免重复：

```go
func BuildVoteUserInput(proposedAction, userMessage string) string {
    return fmt.Sprintf(`用户原始输入：
%s

待审议提案（由 Melchior 提出）：
%s`, userMessage, proposedAction)
}
```

并相应调整 `VoteContext` 结构，移除 `MelchiorConclusion` 字段。

## 验证方法

1. 添加日志输出投票提示词的完整内容
2. 检查 Balthazar 和 Casper 收到的提示词是否有重复内容
3. 修复后观察投票通过率是否提升

## 相关文件

- `kernel/nerv/magi/coordinator/coordinator.go:223` - 问题调用点
- `kernel/nerv/magi/coordinator/voting.go:46-54` - ProcessVoting 函数签名
- `kernel/nerv/magi/prompts/voting.go:23-32` - 投票提示词构建
- `kernel/nerv/magi/coordinator/voting.go:169-188` - 决策解析逻辑
