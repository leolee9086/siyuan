---
title: MAGI 接口与主笔记本特性落地
date: 2026-02-21
description: 实现 MAGI 后端接口，并强制将会话历史物理化存储到 S-forge 绑定的主 AI 笔记本的日记中。
---

# MAGI 接口与主笔记本特性落地执行跟踪 (TikTocTak)

> **目标**: 完成 MAGI 认知引擎的最基础物理映射层：拥有一个对外表现为标准 LLM 接口的 API，但在内部会将所有对话隐式且强制地持久化为思源笔记（Siyuan）块记录。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 核心原则

- **对外透明**: 接口行为对接 Naked LLM。
- **强制持久化**: 内部将所有对话隐式且强制持久化为思源块记录。
- **数据一致性**: 实时推送让用户能在日记像连载小说一样看到。

**验证检查清单**:
- [ ] 编译通过 `go build ./kernel/...`
- [ ] 每次对话产生时，思源主 AI 笔记本的日记文档实时刷新并正确追加入内容块
- [ ] 落卷时必须同时调用 `broadcastTransactions` 和 `model.FlushTxQueue()`。

---

## 🟢 近期计划 

- [ ] **Phase 2: 接口同步落盘与主笔记本特性落地 (P0)**
  - **背景**: 在接口流转中，利用 `model.CreateDailyNote` 和 `model.PerformTransactions` 将 User 和 AI 的对话分别包装为特定的 Callout 块并追加到当天的日记文档末尾。
  - **行动**:
    1. **S-forge 扩展配置: 主 AI 笔记本绑定**
       - 为了让 MAGI 知道往哪里写记忆，需要在 `s-forge` 的扩展配置中增加 `MainAINotebook` 字段。
       - **配置项**: `Conf.SForge.MainAINotebook` (存储 Box ID)
       - **前端约束**: 若打开当前工作空间时检测到该配置为空，前端需强制弹窗引导用户创建并绑定主 AI 笔记本，不可跳过此流程。
    2. **后端接口增强: `/api/s-forge/magi/v1/chat/completions`**
       - 拦截已建成的 `magiChat` 对话端点，在转包和收包时加塞伪黑盒落盘操作：
       - **鉴权与配置断言**: 校验系统是否启用了 OpenAI API (`isOpenAIAPIEnabled`) 且 S-forge 已绑定主笔记本。
       - **定位或创建专属日记**:
         - 调用 `p, _, err := model.CreateDailyNote(Conf.SForge.MainAINotebook)` 获取（或创建）当天的日记文档路径。
         - 通过 `parentID := util.GetTreeID(p)` 提取出日记的根块 ID。
       - **物理化落盘 - 用户提问**:
         - 将用户的输入 `msg` 包装为指定样式的 Markdown/DOM 行内引述块。
         - **规范**: `CalloutType` 为 `quote`，`CalloutIcon` 为 `👤`，`CalloutTitle` 为 `[User]`。
         - 构建 `model.Transaction` (Action: `appendInsert`) 并执行 `model.PerformTransactions`，将提问实际写入日记底层。
       - **LLM 网络调用**:
         - 带着**未重组**的常规上下文或者系统提示词（本期以简单的 Naked LLM 调用为主，暂调用 `model.chatGPTContinueWrite` 或复用现有底层 GPT 请求）。
       - **物理化落盘 - AI 答复**:
         - 将 LLM 返回的文本 `ret` 包装为 AI 样式的 Callout。
         - **规范**: `CalloutType` 为 `light`，`CalloutIcon` 为 `🤖`，`CalloutTitle` 为 `[MAGI]`。
         - 再次执行 Transaction `appendInsert` 落盘日记。
       - **返回响应**:
         - 将 `ret` 通过标准 `gulu.Ret` API JSON 格式吐给前端。
    3. **数据一致性与推送**
       - 所有通过 `PerformTransactions` 触发的数据修改，都需要调用 `broadcastTransactions(transactions)` 和 `model.FlushTxQueue()`。这样一来，用户如果在思源里打开了这个专属日记，就能**实时**看到对话像连载小说一样一行行被追加到末尾，极具物理实感。
  - **验收标准**: 前端 API 正常通信，同时在思源 UI 界面内观察到该主日记有两段新增的 User/AI 小说式连载对话流。
  - **参考文档**: `kernel/model/conf.go`、`kernel/model/transaction.go`、`kernel/api/magi.go`

---

## 🟡 中期计划 

- [ ] **Phase 3: 上下文组装装配器 (Context Builder) (P1)**
  - **背景**: 下一个 TTT 集中处理的任务之一。
  - **行动**: 拦截现有的裸 LLM 请求，在调用网络前，去扫描日记文档，通过物理顺序读取所有的 `Callout`，将连续的 `quote` 和 `light` 块智能坍缩成标准 OpenAI 阵列 `[{"role":...}]` 并注入 System Prompt。

- [ ] **Phase 4: 三贤人切片引入 (P2)**
  - **背景**: 下一个 TTT 集中处理的任务之二。
  - **行动**: 扩展落盘阶段的生成物，生成包含 `CalloutType: info` 的三贤人嵌套块。

---

## 🔴 远期计划 

（暂无）

---

## 🏁 已归档/已完成

- [x] **Phase 1: 透明转发 (P0)** (2026-02-23)
  - **背景**: 建立最小可用的 OpenAI 兼容端点，将外部请求透明转发给思源内部已配置的 LLM（`Conf.AI.OpenAI.*`），本阶段不涉及任何笔记操作。
  - **完成情况**: 完成了端到端的通信桥接与原生 BaseURL BUG 修复。测试完毕，已经通过 Git 原理原子提交。
  - **成果文件**: `kernel/api/magi.go` 等
  - **参考文档**: `MAGI_Chat接口第一阶段_透明转发.ttt.md`
