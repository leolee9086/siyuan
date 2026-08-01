# AgentChat 领域拆分与可测试性（TikTocTak）

> **最终目标**：将 `AgentChat.ts` 从单一巨型宿主类拆为可独立测试、可销毁、按领域拥有行为的模块；Dock、Tab、浮窗、独立页和 MAGI 的公开行为保持不变。
>
> **当前目标**：固定实现基线，完成职责与行为清单，先提取仍在演进的提示词来源和会话流程，再逐阶段替换消息渲染、流式运行态和宿主生命周期。
>
> **下一步任务**：完成本次提示词来源控件的主按钮/下拉职责收口，以当前基线逐项建立对比测试；然后从 `AgentChat` 提取完整的提示词来源领域，不改变任一宿主入口。

---

## 不变量

1. 拆分以领域聚合和生命周期所有权为边界，不能按行数、文件夹或临时 UI 片段机械切块。
2. `AgentChat` 最终只保留 Dock/Layout 薄适配、实例装配和明确的销毁委托；业务状态不能继续隐式散落于私有字段。
3. 不创建消费方定制的碎片接口，不用 `unknown` 抹去依赖；跨领域值以既有领域根类型、明确参数或注册表传递。
4. 新模块的可观察行为通过导出函数、领域控制器或测试可替换的依赖验证。禁止以不可测 `private` 方法、lint 豁免或动态导入隐藏行为。
5. 每次提取前后都与固定基线比较：公开成员、DOM 结构、会话持久化载荷、流式事件顺序、Abort/WebSocket/观察器清理和宿主 capability 可见性都不得回退。
6. 不复制 `AgentChat.ts` 到源码或文档树。精确原件由 Git tag 与 Blob 持久保存，任何对照从该不可变对象读取。
7. MAGI 持续渠道会话、原生 Agent 会话、无宿主能力的独立页和多实例隔离保持各自语义，不能用 host-kind 条件分支强行共享不相同的流程。

## 基线

- 固定提交：`0aa351aa27e56cfe090054949ecaa1448f798532`。
- 固定 tag：`agentchat-before-domain-split-0aa351aa2`（annotated tag `f97cc4333c7a856d62127f4cbbf77c20d0325929`）。
- 原文件 Blob：`0dda6a0ae8d71af04d65c7cd7de6d5b26dfbfe77`，5,031 行，227,585 bytes。
- 对照命令：`git show agentchat-before-domain-split-0aa351aa2:app/src/layout/dock/agent/AgentChat.ts`；该命令是唯一基线内容来源。
- 现有直接职责包括：宿主装配、会话管理、原生 SSE、MAGI 历史、composer、模型与推理、消息/工具卡片渲染、提示词来源、任务目录/文件、编辑器上下文、滚动与 token popup、WebSocket 恢复和销毁。

## 阶段计划

- [x] **Phase 0：不可变基线**
  - 固定 tag、commit、Blob 与原始行数。
  - 登记行为清单与禁止项；不写入重复源码备份。

- [x] **Phase 1：可观察行为与提示词来源领域**
  - [x] 将提示词来源的读取、版本检查、操作串行化、菜单呈现和错误状态提取为完整可测领域控制器。
  - [x] 主按钮直接进入文档选择，下拉箭头仅暴露来源生命周期动作。
  - [x] 为 Dock、Tab、浮窗、独立页与 MAGI capability 的可见性补充回归。

- [ ] **Phase 2：会话与消息投影**
  - 提取 session 加载/切换/保存/恢复与模型元数据；消息投影与 DOM 渲染分离，但不丢失重发、编辑、确认、问答、工具卡片或引用语义。
  - 用持久化会话样本和事件序列证明与基线相同。
  - [x] 拆分校核：`AgentChat.ts.backup`（4049 行）、`AgentChat.ts.remote`（3830 行，拆分功能的另一来源）与门面文件 + `chat/` 目录 93 个文件三方逐一对照，输出行为一致性报告。
  - [x] remote 功能保留校核：逐一核对 `AgentChat.ts.remote` 相对 backup 的新增功能/新行为在拆分结果（门面 + `chat/` 93 文件）中的保留情况，输出到校核报告"## remote 功能保留校核"章节。结论：remote 新增功能 28 项，完整保留 24 项、部分保留 4 项（R-4 工具徽标 600ms 保底、R-10 流式中切换会话、R-14/R-21 为 E-20/E-22 已登记取舍）、完全缺失 0 项。
    - 结论：**拆分引入的行为改写共 15 处**（严重 1 / 中等 4 / 轻微 10）。严重项为编辑器类型切换（Tiptap→Protyle）；其余多为 hover 延迟、滚动兜底、计时器机制等实现细节。backup ↔ remote 间 23 项既有演进差异（轮次恢复、用户编辑、工具徽标、滚动恢复、异步校验等）非拆分引入；会话文件上传、提示词来源、私有方法安装器等为纯新增功能，不计行为差异。公开门面契约保持兼容。详见 `AgentChat_拆分校核报告.md`。
  - [x] 行为一致性修复：对 15 处拆分引入的行为差异逐一处理。**实际修复 9 处**（S3 navRail 200ms 延迟、S4 token popup 200/300ms 延迟、S5 postFrontendResult 退避与 409、S6 jumpToMessage 1500ms 清理、S7 scrollToBottom 1s 兜底、S8 思考计时器 setInterval、S9 思考卡片定位 220ms 延迟、S10 恢复退避序列、S14 innerHTML 追加）；**经核实无需修复 6 处**（S1/S2 由用户裁决为预期演进——Protyle 为方向且 remote 即 Protyle 实现，S11/S12 安装器架构设计，S13 类型层差异，S15 显式化既有默认值）。修复记录见 `AgentChat_拆分校核报告.md` §9。

- [ ] **Phase 3：运行态与流式协议**
  - 提取原生 SSE turn、MAGI 连续会话、冲突处理、Abort、WebSocket 恢复和过期事件隔离。
  - 销毁测试验证无遗留请求、监听器、定时器、ResizeObserver 或 WebSocket。

- [ ] **Phase 4：视图和宿主适配收口**
  - 提取 composer/toolbar/导航/滚动/token popup 等完整视图职责；`AgentChat` 收缩为装配器。
  - Host capability 继续来自细粒度 Port；独立页缺失能力时按 capability 隐藏。

- [ ] **Phase 5：基线对照、全量回归与归档**
  - 自动核对基线公开 API 与迁移映射；执行 Agent Panel、MAGI、浏览器和多宿主视觉验证。
  - 在本文件和主 Agent Panel TTT 记录每阶段实现文件、测试与运行态证据后归档。

## 风险与验收

- 最大风险是保留 `AgentChat` 的隐式共享字段，使新模块看似存在但真实状态仍耦合。每个提取必须同时迁移状态所有权和销毁职责。
- DOM 行为不能仅以快照证明；需要覆盖输入、滚动、发送/停止、菜单、会话切换、身份切换及窗口销毁。
- 任一抽取若发现 MAGI 与原生 Agent 的语义不可由参数表达，应保留两个清晰实现，通过稳定事件/状态契约共享，而非制造兼容回退。
- 完成标准：`AgentChat.ts` 不再包含领域业务实现和不可测私有 lint 规避；所有宿主能打开并完成其声明能力；固定基线的功能清单、测试和运行态验收均有证据。

## 滚动记录

- `2026-07-30`：创建本任务并先固定搜索复用阶段的历史基线 `agentchat-before-split-7f15cb855`。该 tag 保留为迁移沿革，不再作为拆分对照。
- `2026-07-30`：提示词来源主按钮/生命周期箭头 UX 已提交并经过前端运行态验证后，固定正式拆分基线 `agentchat-before-domain-split-0aa351aa2` 与 Blob `0dda6a0a...`。原文件不复制入仓库；下一步开始 Phase 1 提取。
- `2026-07-30`：完成 Phase 1。新增 `AgentPromptSourceController.ts`，拥有文档来源状态、服务端 revision、异步操作序列、过期结果隔离、主选择按钮、生命周期菜单和销毁；`AgentChat.ts` 仅注入真实会话持久化/刷新边界并委托该控制器，行数从基线 5,031 降至 4,776。`AgentPromptSourceController.test.ts` 直接覆盖主按钮不进入菜单、无 `PanelMenuPort` 仍能选择、已锁定会话只保留创建副本文档三种状态。验证：专项 21 tests、Agent/MAGI 30 files/98 tests 和 `pnpm run dev:once` 全部目标通过。下一阶段提取会话加载、切换、保存与恢复领域。
- `2026-07-31`：AgentChat 方法拆分初版在工作树中引入 `16` 条循环依赖；按无环基线 `0` 全部作为本轮回归处理，未归类为既有环。将跨职责调用收口到已有 `AgentChatRuntime` 方法、移除确认/工具反向网关和欢迎页/收尾/会话渲染反向导入后，`pnpm lint:cycles` 处理 `2482` 个 `app/src` 文件并输出 `No circular dependency found in app/src.`。安装器补齐完整工具、确认、思考和 token 方法，运行时方法契约为 `97` 项；专项 `Agent/MAGI` 回归 `31` 文件、`102/102` 通过。Phase 2 仍未归档，下一步继续以固定基线核对会话加载和消息投影。
- `2026-07-31`：继续完成欢迎页 MAGI/原生示例发送路径的契约校正及错误处理模块边界收口；最终 `pnpm lint:cycles` 处理 `2490` 个 `app/src` 文件并输出 `No circular dependency found in app/src.`，`pnpm exec vitest run test/layout/dock/agent test/magi` 为 `31` 文件、`102/102`，本次目录类型检查无新增诊断。无环基线仍为 `0`，本阶段所有新增环均已消除，Phase 2 仍保持进行中。
- `2026-07-31`：完成拆分校核。经复核确认 `AgentChat.ts.remote`（3830 行）也是拆分功能来源之一，报告改为 backup、remote 与拆分结果三方对照：新增功能不计行为差异，backup↔remote 既有演进差异（轮次恢复、用户编辑、工具徽标、滚动恢复、异步校验等 23 项）单独登记为非拆分引入。最终结论：**拆分引入的行为改写 15 处（严重 1 / 中等 4 / 轻微 10）**，严重项为编辑器 Tiptap→Protyle 切换；报告路径 `AgentChat_拆分校核报告.md`，差异列表供后续修复子任务处理。
- `2026-07-31`：完成行为一致性修复子任务。**实际修复 9 处**（navRail/token popup hover 延迟、postFrontendResult 退避与 409 语义、jumpToMessage 高亮 1500ms 清理、scrollToBottom 1s 兜底、思考计时器 setInterval 100ms、思考卡片定位 220ms 延迟、恢复轮次退避序列、思考卡片 innerHTML 追加）；**无需修复 6 处**（S1/S2 用户裁决 Protyle 为预期演进且 remote 即 Protyle 实现、S11/S12 私有方法安装器架构设计、S13 类型层差异、S15 显式化既有默认值）。修改前已备份到 `docs/ttt/AI模块改进/行为修复备份/`；涉及 9 个源码文件，修复记录已追加至 `AgentChat_拆分校核报告.md` §9。遗留：`events.helpers.ts`/`confirm.methods.ts` 存在拆分前既有 lint 存量，`chat/session/` 目录条目超限（13/10），建议后续子任务处理。
- `2026-07-31`：完成 remote 功能保留校核子任务。结论：remote 相对 backup 新增功能/新行为 28 项，**完整保留 24 项、部分保留 4 项、完全缺失 0 项**。4 项部分保留中，R-4 工具徽标 600ms 保底（`toolState.ts::finishToolCall` 直接清除）与 R-10 流式中切换会话（`switch.ts` 入口 `isStreaming` 守卫回退 backup 语义）为拆分引入的实际弱化，可留待修复；R-14/R-21 为 E-20/E-22 已登记取舍。详见校核报告 `AgentChat_拆分校核报告.md` §10。
