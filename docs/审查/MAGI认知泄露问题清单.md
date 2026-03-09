# MAGI认知泄露问题清单

## 问题定义

**认知泄露**：指在提示词、消息内容、工具调用等任何可能被LLM感知的地方，暴露了MAGI系统的内部架构、技术名称、组件关系等信息。

**核心原则**：Trinity和三贤人必须完全不知道MAGI系统的存在，不知道彼此的技术名称（Melchior/Balthazar/Casper/Trinity），只能通过抽象概念（逻辑/情绪/直觉）进行交互。

## 严重泄露点（P0 - 必须立即修复）

### 1. 系统提示词直接暴露身份和系统名称
**文件**: `kernel/nerv/magi/prompts/core.go`

**问题代码**:
```go
MelchiorSystemPrompt = "你是Melchior，MAGI系统的神学思维贤者。"
BalthazarSystemPrompt = "你是Balthazar，MAGI系统的科学思维贤者。"
CasperSystemPrompt = "你是Casper，MAGI系统的人文思维贤者。"
```

**影响**: 直接告诉LLM它们是"MAGI系统"的一部分，并且暴露了技术名称。

**修复方案**: 
- 移除"MAGI系统"字样
- 移除技术名称（Melchior/Balthazar/Casper）
- 使用抽象角色描述

**建议提示词**:
```go
MelchiorSystemPrompt = "你现在需要从逻辑分析的角度思考问题。"
BalthazarSystemPrompt = "你现在需要从情感共鸣的角度思考问题。"
CasperSystemPrompt = "你现在需要从直觉判断的角度思考问题。"
```

### 2. 投票提示词暴露Melchior名称
**文件**: `kernel/nerv/magi/prompts/voting.go`

**问题代码**:
```go
Melchior 关键判断：
%s
```

**影响**: 在投票流程中暴露了"Melchior"这个技术名称。

**修复方案**: 使用抽象描述
```go
逻辑分析结论：
%s
```

### 3. Avatar创建提示词暴露MAGI和贤者名称
**文件**: `kernel/nerv/magi/prompts/avatar.go`

**问题代码**:
```go
3. 提示词不得暴露 MAGI 内部路由、投票细节。
Melchior 发起结果：
%s
```

**影响**: 虽然要求"不得暴露MAGI"，但在任务描述中又使用了"Melchior"和"MAGI"。

**修复方案**: 
```go
3. 提示词不得暴露系统内部路由、决策细节。
逻辑分析结果：
%s
```

## 中等泄露点（P1 - 应该修复）

### 4. Trinity内省fallback常量命名
**文件**: `kernel/nerv/magi/prompts/trinity.go`

**问题**: 常量名称暴露了内部结构
```go
TrinityFallbackMelchior = "我还在整理逻辑线索。"
TrinityFallbackBalthazar = "我还在感受这件事的情绪波动。"
TrinityFallbackCasper = "我暂时没有明确的本能倾向。"
```

**影响**: 虽然常量值本身没问题，但常量名称在代码中暴露了结构。

**修复方案**: 重命名常量
```go
TrinityFallbackLogic = "我还在整理逻辑线索。"
TrinityFallbackEmotion = "我还在感受这件事的情绪波动。"
TrinityFallbackIntuition = "我暂时没有明确的本能倾向。"
```

## 低风险点（P2 - 可选修复）

### 5. 代码注释和日志中的技术名称
**影响范围**: 整个`kernel/nerv/magi`模块

**问题**: 代码注释、日志输出、错误消息中大量使用技术名称。

**评估**: 这些不会直接传递给LLM，风险较低，但为了代码一致性，建议在面向LLM的部分使用抽象术语。

### 6. WebSocket事件名称
**文件**: `kernel/nerv/magi/websocket/events.go`

**问题**: 事件名称包含技术术语
```go
EventTrinitySynthesisCompleted = "TRINITY_SYNTHESIS_COMPLETED"
```

**评估**: 这些事件名称主要用于前端显示和调试，不直接传递给LLM，风险较低。

## 修复优先级

1. **立即修复（P0）**: 系统提示词（core.go）
2. **尽快修复（P0）**: 投票提示词（voting.go）
3. **尽快修复（P0）**: Avatar提示词（avatar.go）
4. **计划修复（P1）**: Trinity fallback常量命名
5. **可选修复（P2）**: 代码注释和日志

## 验证方法

修复后需要验证：
1. 所有传递给LLM的提示词中不包含"MAGI"、"Melchior"、"Balthazar"、"Casper"、"Trinity"等技术名称
2. 使用抽象概念："逻辑"、"情绪"、"直觉"、"统合"等
3. 前端实现已经正确（参考`app/src/magi_backup_20260308_112813/composables/consensus/magiConsensus.content.ts`）

## 参考实现

前端正确实现示例（`magiConsensus.content.ts:44-58`）:
```typescript
export function buildTrinityIntrospectionInput(
    validResponses: SageResponse[],
    requestSourceBrief: string = "",
): string {
    const melchior = findSageContent(validResponses, "MELCHIOR", "我还在整理逻辑线索。");
    const balthazar = findSageContent(validResponses, "BALTHASAR", "我还在感受这件事的情绪波动。");
    const casper = findSageContent(validResponses, "CASPER", "我暂时没有明确的本能倾向。");

    return `逻辑告诉我：${melchior}

情绪告诉我：${balthazar}

直觉告诉我：${casper}
${requestSourceBrief ? `\n\n${requestSourceBrief}` : ""}`;
}
```

注意：虽然代码中使用了技术名称（用于查找），但最终传递给Trinity的内容完全使用抽象概念。
