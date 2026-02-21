---
title: MAGI 接口与主笔记本特性落地
date: 2026-02-21
description: 实现 MAGI 后端接口，并强制将会话历史物理化存储到 S-forge 绑定的主 AI 笔记本的日记中。
---

# TTT: MAGI 接口与主笔记本特性落地

## 1. 目标与范围 (Goal & Scope)
本阶段的核心目标是完成 MAGI 认知引擎的最基础物理映射层：**拥有一个对外表现为标准 LLM 接口的 API，但在内部会将所有对话隐式且强制地持久化为思源笔记（Siyuan）块记录。**

*   **In Scope**: 
    1. 在 S-forge 全局配置中硬绑定一个“主 AI 笔记本” (Main AI Notebook)。
    2. 实现后端 `/api/s-forge/magi/chat` 接口，行为对齐 Naked LLM。
    3. 在接口流转中，利用 `model.CreateDailyNote` 和 `model.PerformTransactions` 将 User 和 AI 的对话分别包装为特定的 Callout 块并追加到当天的日记文档末尾。
*   **Out of Scope**: 三贤人 (Three Wise Men) 嵌套生成机制、历史上下文重组聚合算法（本期 TTT 仅关注“写入口”，暂不处理复杂的“读出口”上下文重组）。

## 2. 详细设计 (Design Details)

### 2.1 S-forge 扩展配置: 主 AI 笔记本绑定
为了让 MAGI 知道往哪里写记忆，需要在 `s-forge` 的扩展配置中增加 `MainAINotebook` 字段。
*   **配置项**: `Conf.SForge.MainAINotebook` (存储 Box ID)
*   **前端约束**: 若打开当前工作空间时检测到该配置为空，前端需强制弹窗引导用户创建并绑定主 AI 笔记本，不可跳过此流程。

### 2.2 后端接口: `/api/s-forge/magi/chat`
在 `kernel/api/router.go` 的 S-forge 路由组下注册新的对话终点。其核心逻辑必须封装成伪黑盒操作：

1. **鉴权与配置断言**: 校验系统是否启用了 OpenAI API (`isOpenAIAPIEnabled`) 且 S-forge 已绑定主笔记本。
2. **定位或创建专属日记**:
    *   调用 `p, _, err := model.CreateDailyNote(Conf.SForge.MainAINotebook)` 获取（或创建）当天的日记文档路径。
    *   通过 `parentID := util.GetTreeID(p)` 提取出日记的根块 ID。
3. **物理化落盘 - 用户提问**:
    *   将用户的输入 `msg` 包装为指定样式的 Markdown/DOM 行内引述块。
    *   **规范**: `CalloutType` 为 `quote`，`CalloutIcon` 为 `👤`，`CalloutTitle` 为 `[User]`。
    *   构建 `model.Transaction` (Action: `appendInsert`) 并执行 `model.PerformTransactions`，将提问实际写入日记底层。
4. **LLM 网络调用**:
    *   带着**未重组**的常规上下文或者系统提示词（本期以简单的 Naked LLM 调用为主，暂调用 `model.chatGPTContinueWrite` 或复用现有底层 GPT 请求）。
5. **物理化落盘 - AI 答复**:
    *   将 LLM 返回的文本 `ret` 包装为 AI 样式的 Callout。
    *   **规范**: `CalloutType` 为 `light`，`CalloutIcon` 为 `🤖`，`CalloutTitle` 为 `[MAGI]`。
    *   再次执行 Transaction `appendInsert` 落盘日记。
6. **返回响应**:
    *   将 `ret` 通过标准 `gulu.Ret` API JSON 格式吐给前端。

### 2.3 数据一致性与推送 (Data Consistency)
所有通过 `PerformTransactions` 触发的数据修改，都需要调用 `broadcastTransactions(transactions)` 和 `model.FlushTxQueue()`。这样一来，用户如果在思源里打开了这个专属日记，就能**实时**看到对话像连载小说一样一行行被追加到末尾，极具物理实感。

## 3. 下一步计划 (Next Steps)
完成此路通调后，下一个 TTT 将集中处理：
1. **上下文组装装配器 (Context Builder)**: 也就是拦截现有的裸 LLM 请求，在调用网络前，去扫描日记文档，通过物理顺序读取所有的 `Callout`，将连续的 `quote` 和 `light` 块智能坍缩成标准 OpenAI 阵列 `[{"role":...}]` 并注入 System Prompt。
2. **三贤人切片引入**: 扩展落盘阶段的生成物，生成包含 `CalloutType: info` 的三贤人嵌套块。
