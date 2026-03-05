# Avatar架构问题检查报告

## 检查时间
2026-03-05

## 问题清单

### 1. Runtime提取记忆种子（违反设计原则）

**位置**: `app/src/magi/core/nerv/avatar.runtime.ts:114-137`

**问题描述**: 
Runtime通过`pickRecentMemorySeed`函数直接决定暴露哪些记忆给Avatar，包括暴露模式（full/partial/distorted）的语义决策。

**设计要求**:
根据设计文档，记忆种子的选择和脱敏策略应该由三贤者在创建Avatar时决定，而不是由runtime机械执行。

**当前代码**:
```typescript
function pickRecentMemorySeed(
    consensusMessages: AvatarRuntimeDeps["consensusMessages"],
    exposureMode: "full" | "partial" | "distorted",
): string {
    const candidate = consensusMessages
        .filter((message) => message.type === "user" || message.type === "consensus")
        .slice(-AVATAR_MEMORY_SEED_MAX)
        .map((message) => message.content.trim())
        .filter((content) => Boolean(content));
    // ... 语义决策逻辑
}
```

**状态**: ❌ 问题仍然存在

---

### 2. 架构术语暴露给Avatar

**位置**: `app/src/magi/core/nerv/avatar.toolset.ts:14-18`

**问题描述**:
Avatar系统提示词中暴露了"Avatar"这个架构术语。

**设计要求**:
Avatar不应该知道自己是"Avatar"，这是架构层的术语。应该使用人格层的描述。

**当前代码**:
```typescript
export const AVATAR_META_TOOL_PROMPT = `你是 Avatar。你必须牢记：
1. 你是当前通道的执行分身，只负责完成该通道任务。
2. 你必须使用 report_to_core 向主系统汇报进度/风险/心跳。
```

**状态**: ❌ 问题仍然存在

---

### 3. 三贤者元数据标记暴露角色标签

**位置**: `app/src/magi/core/wise/promptTemplates/Melchior.ts:80`

**问题描述**:
Melchior的系统提示词中包含`[MELCHIOR_META]`标记，暴露了角色标签。

**设计要求**:
三贤者不应该知道自己是"MELCHIOR"、"BALTHASAR"、"CASPER"，这些是架构层的标签。

**当前代码**:
```typescript
输出协议（必须遵守）：
1. 正常正文照常输出，不要 JSON 包裹全文。
2. 在回复末尾单独追加一行标记：
[MELCHIOR_META]requires_deliberation=true|false[/MELCHIOR_META]
3. 当任务涉及不可逆后果、高风险或需要严肃审慎决策时，标记为 true；否则为 false。
```

**状态**: ❌ 问题仍然存在

---

### 4. Avatar工具约束描述

**位置**: `app/src/magi/core/nerv/avatar.runtime.ts:183`

**问题描述**:
之前误认为Avatar不能调用外部工具。

**当前代码**:
```typescript
执行约束：
1. 你可调用当前执行环境可用的外部工具；需要同步状态时调用 report_to_core。
```

**状态**: ✅ 描述正确，Avatar可以调用外部工具

---

## 需要修复的问题总结

1. **Runtime提取记忆种子** - 需要重构为由三贤者决定
2. **架构术语暴露** - "Avatar"术语需要替换为人格层描述
3. **元数据标记暴露角色标签** - `[MELCHIOR_META]`等标记需要改为通用标记

## 正确的部分

1. Avatar创建流程（Melchior发起 → 三贤者投票 → Trinity综合）- ✅ 已正确实现
2. Avatar工具权限描述 - ✅ 正确说明可调用外部工具
