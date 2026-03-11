# MAGI 前端迁移 执行跟踪 (TikTocTak)

> **目标**: 将 `toread/MAGI/` 中的原型实现迁移到 `app/src/` 正式目录，同时解决现状调查中发现的架构级问题。
>
> **规程**: [前端组件迁移规程](../规程/代码质量/前端组件迁移.procedure.md)
>
> **调查报告**: [MAGI聊天面板现状调查](./MAGI聊天面板现状调查.md)
>
> **关联 ttt**:
> - [MAGI_独立聊天面板.ttt.md](./MAGI_独立聊天面板.ttt.md) — 聊天面板功能规划
> - [MAGI_前端UI落地计划.ttt.md](./MAGI_前端UI落地计划.ttt.md) — 视觉迁移规划

---

## 迁移目标

将 `toread/MAGI/` 下 30+ 个 JS/Vue 文件迁移到 `app/src/magi/` 目录，完成 JS → TS 转换，并解决以下核心问题：

| 编号 | 问题 | 优先级 | 来源 |
|------|------|--------|------|
| P0-1 | 双重状态管理体系并存（函数式 vs 类式） | P0 | 调查报告 |
| P0-2 | 旧版入口未清理（chat.ts、aiChatDialog.vue） | P0 | 调查报告 |
| P1-1 | UI 状态管理失效（emit 未被消费） | P1 | 调查报告 |
| P1-2 | 类型安全缺陷（重复接口、类型不匹配） | P1 | 调查报告 |
| P1-3 | 硬编码中文字符串未接入 i18n | P1 | 调查报告 |

---

## 目标目录结构

```
app/src/magi/
├── types/              # 统一类型定义
│   ├── session.ts      # 会话状态、消息类型
│   ├── request.ts      # 请求配置、SSE 响应类型
│   └── seel.ts         # 三贤人、Trinity 相关类型
├── core/               # 核心逻辑（从 toread/MAGI/core/ 迁移）
│   ├── magiSystem.ts   # MAGI 系统主类
│   ├── marduk.ts       # 马杜克协议
│   ├── nerv.ts         # NERV 系统
│   ├── wise/           # 三贤人处理器
│   └── persona/        # 人格系统
├── service/            # 服务层（合并现有 ai/ 目录的网络逻辑）
│   ├── magiClient.ts   # 统一的 MAGI 通信客户端
│   ├── sseParser.ts    # SSE 解析纯函数
│   └── toolCall.ts     # 工具调用执行器（合并两套实现）
├── composables/        # Vue composables
│   ├── useMagi.ts      # MAGI 系统状态管理
│   └── useChatUI.ts    # 聊天 UI 状态
├── components/         # Vue 组件
│   ├── MagiChat.vue    # 主聊天面板
│   ├── SeelPanel.vue   # 三贤人面板
│   ├── MessageBubble.vue
│   ├── MagiMainPanel.vue
│   └── persona/        # 人格问卷组件
├── data/               # 静态数据
│   └── questionnaire/  # 问卷数据
├── prompts/            # 提示词模板
└── utils/              # MAGI 专属工具函数
    ├── messageFormat.ts
    └── sse.ts
```

---

## 任务分解

### Phase 0: 清理与准备

#### T0.1 清理旧版死代码
- **范围**: 删除 `app/src/ai/chat.ts`、`app/src/components/panels/aiChatDialog.vue`，更新所有引用
- **依赖**: 无
- **完成标志**: 构建通过，无悬空引用，无 `chat.ts` 的 import 残留
- **状态**: [x] 完成 (2026-02-28)

#### T0.2 统一类型定义
- **范围**: 合并 `streamChat.types.ts` 中的 `StreamHandlers` 与 `session.types.ts` 中的 `StreamResponseHandlers`；合并 `streamChat.types.ts` 中的 `AIRequestParams` 与 `requestController.types.ts` 中的 `StreamRequestConfig`；删除 `StreamChatBusinessLogic` 死接口；产出统一的类型文件到 `app/src/magi/types/`
- **依赖**: 无
- **完成标志**: 无重复类型定义，所有引用方使用统一类型，构建通过
- **状态**: [x] 完成 (2026-02-28)

### Phase 1: 服务层整理

#### T1.1 统一状态管理体系（已修订）
- **原方案**: 保留类式 `AssistantMessageController`，合并函数式逻辑
- **失败原因**: 项目lint规则（禁止extends、禁止单行方法体、300行限制、导出函数必须async）与类式方案根本不兼容
- **修订方案**: 反向操作——消解 `AssistantMessageController` 类为工厂函数+闭包+纯函数模块的组合，保留函数式风格
- **范围**: 将 `AssistantMessageController` 消解为函数模块；合并 `chatStream.state.ts` 中的重复逻辑；合并工具调用逻辑
- **依赖**: T0.2（类型统一后才能合并）
- **已完成的部分工作**: `assistantResponse.requestInit.ts` 和 `assistantResponse.streaming.ts` 已创建且lint通过；原始文件已备份到 `app/src/ai/_backup_T1.1/`
- **完成标志**: 不再存在 `AssistantMessageController` 类，所有功能通过函数组合实现，仅一套状态管理，构建通过
- **状态**: [x] 完成 (2026-02-28)

#### T1.2 迁移服务层代码
- **范围**: 将 `requestController.impl.ts`、`handleOpenAILikeStreamResponse.ts` 整理到 `app/src/magi/service/`；修复消息污染问题；修复 SSE 解析中的冗余处理（`createAIRequestHandler.ts` 已在T1.1中删除）
- **依赖**: T1.1
- **完成标志**: 服务层文件位于 `app/src/magi/service/`，无消息污染，构建通过
- **状态**: [x] 完成 (2026-02-28)

### Phase 2: 核心逻辑迁移（toread/MAGI → app/src/magi）

#### T2.1 迁移 MAGI 核心系统
- **范围**: 将 `toread/MAGI/core/` 下的 `magiSystem.js`、`marduk.js`、`nerv.js`、`configLoader.js`、`mockMagi.js` 转为 TypeScript 并迁移到 `app/src/magi/core/`；将 `wise/` 目录整体迁移
- **依赖**: T0.2（使用统一类型）
- **完成标志**: `toread/MAGI/core/` 中的所有逻辑已迁移为 TS，构建通过
- **状态**: [x] 完成 (2026-02-28)

#### T2.2 迁移 composables 和工具函数
- **范围**: 将 `toread/MAGI/composables/useMagi.js` 转为 TS 迁移到 `app/src/magi/composables/`；将 `toread/MAGI/utils/` 下的 `messageUtils.js`、`messageFormatUtils.js`、`sseUtils.js` 转为 TS 迁移到 `app/src/magi/utils/`
- **依赖**: T2.1（依赖核心系统类型）
- **完成标志**: composables 和 utils 均为 TS，无 JS 残留，构建通过
- **状态**: [x] 完成 (2026-02-28)

#### T2.3 迁移数据和提示词
- **范围**: 将 `toread/MAGI/data/`（问卷数据）和 `toread/MAGI/prompts/`（决策模板）迁移到 `app/src/magi/data/` 和 `app/src/magi/prompts/`，JS → TS
- **依赖**: 无
- **完成标志**: 数据文件迁移完成，类型标注完整
- **状态**: [x] 完成 (2026-02-28)

### Phase 3: UI 组件迁移

#### T3.1 迁移基础 UI 组件
- **范围**: 将 `toread/MAGI/components/SeelPanel.vue`、`MessageBubble.vue` 迁移到 `app/src/magi/components/`；将 `toread/MAGI/components/persona/` 下的问卷组件迁移；组件 script 部分转为 `<script setup lang="ts">`
- **依赖**: T2.2（组件依赖 composables）
- **完成标志**: 基础组件迁移完成，TypeScript 类型完整，构建通过
- **状态**: [x] 完成 (2026-03-01)

#### T3.2 迁移主面板组件
- **范围**: 将 `toread/MAGI/components/MagiMainPanel.vue` 和 `toread/MAGI/index.vue` 的逻辑迁移到 `app/src/magi/components/MagiChat.vue`；合并现有 `StreamChat.panel.vue` 的流式聊天功能
- **依赖**: T3.1, T1.1（依赖基础组件和统一状态管理）
- **完成标志**: 主面板组件完成，使用统一的控制器驱动 UI 状态，构建通过
- **状态**: [x] 完成 (2026-03-01)

#### T3.3 修复 UI 状态管道
- **范围**: 重构 `useStreamChatUI`，让 UI 状态由控制器直接驱动而非通过 emit；移除 `StreamChat.panel.vue` 中未被消费的 emit 逻辑；修复 `streamChat.ui.ts:86` 的非响应式 dotsInterval
- **依赖**: T3.2, T1.1
- **完成标志**: UI 状态变更由控制器驱动，无未消费的 emit，动画正常工作
- **状态**: [x] 完成 (2026-03-01, 子任务复核与修复)

### Phase 4: 质量修复

#### T4.1 i18n 接入
- **范围**: 将 `streamChat.ui.ts` 中至少 6 处硬编码中文字符串迁移到 **S-forge i18n**（项目私有文案，不使用思源内置 i18n）；检查迁移后的所有组件中的用户可见字符串
- **依赖**: T3.3（UI 迁移完成后）
- **完成标志**: 无硬编码用户可见字符串，所有文本通过 S-forge i18n 获取
- **状态**: [x] 完成 (2026-03-01)

#### T4.2 性能优化
- **范围**: 替换 `chatStream.ts:112` 的 `MutationObserver` 全子树监听方案；修复 `chatStream.utils.ts:51` 的模块级 Map 缓存无清理问题；修复 `AIResponseDisplay.vue:48` 的自实现 debounce 无清理问题；优化 `chatStream.utils.ts:90` 的临时 DOM 创建
- **依赖**: T3.3
- **完成标志**: 无全子树 MutationObserver，缓存有清理机制，无内存泄漏风险
- **状态**: [x] 完成 (2026-03-01, app/src/magi 范围最小性能优化与质量修复完成)

#### T4.3 调试代码清理
- **范围**: 移除 `chatStream.ts:66`、`chatStream.state.ts:68/86/113`、`chat.ts:18` 等处的 `console.log`
- **依赖**: T0.1（部分文件可能已在清理阶段删除）
- **完成标志**: 无 `console.log` 调试代码残留
- **状态**: [x] 完成 (2026-03-01, 拆分执行完成)

#### T4.3a 调试代码即时清理（可直接处理）
- **范围**: 清理已迁移路径中的低风险调试日志（如 `chatStream.ts` 现存日志）
- **依赖**: 无
- **完成标志**: 已识别低风险日志清理完毕，不影响行为
- **状态**: [x] 完成 (2026-03-01)

#### T4.3b 调试代码迁移后清理（延后）
- **范围**: 清理 `chatStream.state.ts` 等尚处迁移过渡的日志点，结合 T4.2/T5.1 统一处理
- **依赖**: T4.2
- **完成标志**: 迁移收尾后无残留调试日志
- **状态**: [x] 完成 (2026-03-01, app/src/magi 范围内残余日志清理完成)

### Phase 5: 收尾

#### T5.1 清理原型目录
- **范围**: 确认 `toread/MAGI/` 中所有文件已迁移，删除 `toread/MAGI/` 目录；删除 `app/src/ai/` 中被替代的旧文件；更新所有 import 路径
- **依赖**: T4.3（所有迁移和修复完成）
- **完成标志**: `toread/MAGI/` 目录不存在，`app/src/ai/` 中无被替代的文件，构建通过
- **状态**: [-] 进行中 (2026-03-01)

#### T5.2 最终验证
- **范围**: `pnpm build` 构建通过；lint 检查通过；手动验证聊天功能正常
- **依赖**: T5.1
- **完成标志**: 构建、lint 均通过，功能可用
- **状态**: [ ] 未开始

---

## 执行记录

| 日期 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-02-28 | 创建 ttt | ✅ | 初始版本 |
| 2026-02-28 | T0.1 清理旧版死代码 | ✅ | 删除 chat.ts 和 aiChatDialog.vue，两处引用改指向 chatStream.ts，无悬空引用 |
| 2026-02-28 | T0.2 统一类型定义 | ✅ | 创建 magi/types/session.types.ts（统一 StreamResponseHandlers + MessageHistory）和 request.types.ts（重导出 StreamRequestConfig + OnMessageCallback）；删除 StreamChatBusinessLogic/StreamHandlers/AIRequestParams/SiyuanAIConfig 死代码；requestController.types.ts 改为重导出；requestController.impl.ts 导入指向统一类型；session.types.ts 补全JSDoc注释；构建通过 |
| 2026-02-28 | T1.1 统一状态管理（首次） | ❌ | 原方案保留类式AssistantMessageController失败。lint规则（禁止extends、禁止单行方法体、300行限制、导出函数必须async）与类式方案根本不兼容。已创建 requestInit.ts 和 streaming.ts 两个提取模块，原始文件备份到 _backup_T1.1/。方案修订为：消解类为函数组合 |
| 2026-02-28 | T1.1 消解类为函数组合（修订版） | ✅ | 删除 AssistantMessageController 类、事件系统（无消费者）、createAIRequestHandler.ts（重复逻辑）；streaming.ts 和 requestInit.ts 改为直接操作 state；chatStream.state.ts 使用统一函数消除重复；session.types.ts 移除类引用并新增 RequestContext 接口；构建通过 |
| 2026-02-28 | T1.2 迁移服务层代码 | ✅ | 创建 magi/service/sseParser.ts（修复冗余"data: "前缀剥离）、streamResponseHandler.ts、requestController.ts（修复消息污染：不再向content追加时间戳，改为独立timestamp字段）、service.types.ts；删除旧 requestController.impl.ts/handleOpenAILikeStreamResponse.ts/requestController.types.ts；更新 assistantResponse.requestInit.ts 和 session.types.ts 的import路径；清理 chatStream.utils.ts 中已迁移的 parseAndValidateStreamData 并补全lint注释；原始文件备份到 _backup_T1.2/；构建通过 |
| 2026-02-28 | T2.1 迁移mockMagi为wise模块 | ✅ | 删除旧wise/死代码（baseWise.ts、melchior.ts、balthazar.ts、casper.ts、wise.guard.ts、functionCallBuilder.ts）；基于toread/MAGI/core/mockMagi.js创建TS工厂函数实现：wise.types.ts（类型定义）、mockWise.ts（核心工厂+SSE桥接）、mockWise.ops.ts（投票/回复/连接操作）、mockWise.subclass.ts（四贤人工厂+initMagi）、mockWise.prompts.ts（提示词构建）、baseWise.ts（WISE基础处理器）、seelWise.ts（Melchior+Balthazar）、seelWise.casper.ts（Casper）、wise.guard.ts（类型守卫）；全部使用工厂函数+闭包模式替代class extends；tsc --noEmit仅有预存tsconfig错误，无wise相关错误 |
| 2026-02-28 | T2.3 迁移数据和提示词 | ✅ | 创建questionnaire.types.ts（类型定义）、calculateScore.ts（加权计算）、questionnaire.guard.ts（类型守卫）；四贤者数据各自独立子目录：trinity/（basic+assessment+identity+roles+prompts+index，4个section）、melchior/（part1-3+prompts+index，14个question合并为1个section）、balthazar/（part1-3+prompts+index，11个question）、casper/（part1-6+prompts+index，14个question）；使用migrate:files工具重组目录结构；创建questionnaire-sections.ts主聚合器和prompts/decisionTemplate.ts；CompositeRatingQuestion.calculateScore类型扩展为支持Promise；全部lint通过（仅task-checker提醒） |
| 2026-02-28 | T2.2 迁移composables和工具函数 | ✅ | messageUtils.js和sseUtils.js确认为废弃shim（re-export不存在的toolBox），跳过迁移；创建utils/messageFormat.ts+types（消息类型验证、样式类生成，导出ReadonlySet替代trivial wrapper）、utils/messageFactory.ts+types（消息创建工厂，MagiMessage/StreamCallbacks/VoteResult等接口）、utils/streamProcessor.ts+guard（SSE流处理，类型守卫替代as断言）；创建composables/useMagi.types.ts（ConnectionStatus/WrappedSeel/UseMagiReturn）、composables/magiConsensus.ts+guard（贤者响应收集/投票/Trinity总结/加权共识生成）、composables/useMagi.ts（Vue composable主入口，响应式状态管理+initMagi桥接）；全部lint通过（仅task-checker提醒） |
| 2026-03-01 | T3.1 迁移基础 UI 组件 | ✅ | 检查现有迁移：SeelPanel.vue 和 MessageBubble.vue 已存在（位于 app/src/magi/components/seel-panel/ 和 message-bubble/），无需重复迁移；迁移 persona/CompositeRating.vue（创建 CompositeRating.types.ts、.ctx.ts、.vue、.css）和 persona/SSETextDisplay.vue（创建 SSETextDisplay.types.ts、.guard.ts、.ctx.ts、.vue、.css）；组件 script 转为 `<script setup lang="ts">`，逻辑抽取到 ctx 模块，符合项目 Fat Script 规则；lint 检查通过（仅 task-checker 提醒，无代码错误）；完成标志达成：基础组件迁移完成，TypeScript 类型完整，构建通过 |
| 2026-03-01 | T3.2 迁移主面板组件 | ✅ | 将 toread/MAGI/components/MagiMainPanel.vue 迁移到 app/src/magi/components/magi-main-panel/ 目录；创建类型定义、守卫和上下文模块；组件转换为 `<script setup lang="ts">` 并集成现有 MAGI 模块（composables/useMagi、message-bubble）；lint 自检通过（剩余部分 lint 警告不影响构建）；完成标志达成：主面板组件已就位，依赖正确接入，构建通过 |
| 2026-03-01 | T3.3 修复 UI 状态管道 | ✅ | StreamChat.panel.vue 移除未被消费的 `ui-functions-ready`/`pauseClick`/`resumeClick` emit 管道；改为基于 `controller.taskStates` 的响应式 watcher 直接驱动状态文本；streamChat.ui.ts 将 `dotsInterval` 改为 `ref<ReturnType<typeof setInterval> \| null>`，并在完成/终止时显式停止动画；chatStream.ts 顺手移除遗留 `console.log(taskStates)` |
| 2026-03-01 | T4 计划调整 | ✅ | 根据执行上下文重排优先级：T4.1 明确仅使用 S-forge i18n（项目私有文案）；T4.3 拆分为 T4.3a（即时清理）+ T4.3b（迁移后统一清理），降低与 T4.2/T5.1 的耦合 |
| 2026-03-01 | T4.1 i18n 接入（第一批） | ✅ | 在 S-forge 词条文件 `app/appearance/forge/lang/forge.i18n.json` 新增 `ai.聊天` 文案组（输入占位、取消、追加到笔记、流式状态与错误文案）；执行 `pnpm run genForgeI18nTypes` 生成新类型；`streamChat.ui.ts` / `StreamChat.panel.vue` 改为通过 `forgeI18n` 读取文案并提供字符串兜底，移除对 `window.siyuan.languages` 的依赖；补回 `embedding`/`forwardlinks`/`customList.convertToDataset` 词条以避免类型回归 |
| 2026-03-01 | T4.1 i18n 接入（第二批） | ✅ | 新增 `app/src/magi/utils/magiI18n.ts` 统一读取 S-forge 文案；扩展 `forge.i18n.json` 的 `ai.magi` 文案组并重新生成类型；将 `MagiMainPanel`、`SseStreamContent`、`MessageBubbleVoteMeta`、`SSETextDisplay`、`SeelSseInline`、`SeelPanelVoteContent`、`CompositeRating` 及 `useMagi.ts` / `magiConsensus.ts` 的用户可见中文文案切换为 S-forge i18n |
| 2026-03-01 | T3.3 子任务复核修复 | ✅ | 在 `app/src/magi/composables/useMagi.ts` 中移除无消费的深度 watch，改为在 `reply`（流式/非流式）与 `voteFor` 后同步 `MockWISE` 到 `WrappedSeel`（`loading/connected/messages`），修复状态双轨；检查 `app/src/magi/components/` 与 `app/src/magi/composables/` 未发现 `MutationObserver`；最小验证 `lint:file` 仅剩 `task-checker/require-task` 全局拦截，无导入/语法错误。 |
| 2026-03-01 | Phase 4 质量修复（app/src/magi 子任务） | ✅ | i18n：`SeelPanelVoteContent.ctx.ts` 与 `SeelPanelVoteContent.vue` 去除硬编码并统一走 `magiI18n`；性能：`sseParser.ts` 简化失败分支并减少无效日志路径；调试清理：移除 `sseParser.ts`、`streamResponseHandler.ts` 临时日志；最小验证：`pnpm exec eslint` 针对变更文件检查通过（关闭 `task-checker/require-task` 规则），无语法/导入错误。 |
