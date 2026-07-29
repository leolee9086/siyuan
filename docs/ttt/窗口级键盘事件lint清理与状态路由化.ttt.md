# 窗口级键盘事件 lint 清理与状态路由化执行跟踪 (TikTocTak)

> **目标**: 将 `app/src/boot/globalEvent/keydown/windowKeyDown/windowKeyDown.ts` 从当前 300+ lint 错误的硬编码控制流，重构为“同层 imports 网关 + environment/global 封装 + 状态收集 + 状态空间路由 + 执行器”的可维护结构，并完成单文件 lint 清零。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从“近期计划”中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到“已归档/已完成”区域。
> 4. 将“中期计划”中的条目提升到“近期计划”。

## 核心原则

1. **先备份再重构**: 修改 `windowKeyDown.ts` 前必须保留可直接回退的备份文件。
2. **状态优先于分支**: 优先沿用 `app/src/protyle/wysiwyg/keydown.list` 的“显式事实收集 + 状态空间路由 + 执行器”模式；收集器只负责直白收集事实，不在收集阶段归并命令、意图或顺序语义。
3. **边界显式化**: 业务文件禁止直接父级导入，统一经同层 `imports.ts` 转发；禁止直接访问 `window`，统一走 `*.environment.ts` / `*.global.ts`。
4. **行为保持不变**: 快捷键优先级、对话框处理顺序、Esc 退场逻辑和插件命令行为必须与现状一致或有明确的兼容解释。
5. **单点验证**: 每一阶段结束都要跑 `pnpm run lint:file -- src/boot/globalEvent/keydown/windowKeyDown/windowKeyDown.ts` 做单文件核对。

## 验证检查清单

- [x] `windowKeyDown.ts` 不再直接从父级路径导入。
- [x] `windowKeyDown.ts` 不再直接访问 `window`。
- [x] `windowKeyDown.ts` 不再承载大段硬编码控制流。
- [x] 状态收集、路由决策、执行落地已拆到同目录子模块。
- [x] `sendGlobalShortcut` 与切换对话框相关流程保持可用。
- [x] 单文件 lint 检查通过。

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，必须剪切粘贴到【已归档/已完成】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：以 lint 输出、行为验证和成果文件为准，不凭感觉宣布完成。

## 🟢 近期计划

- [ ] **Phase 4: 将相关 click/keyup 协作点迁回统一状态边界 (P1)**
- [-] **Phase 3.3: 修复 `dialog/state.ts` 特殊对话框键类型收窄 (P0)**
  - **背景**: `app/src/boot/globalEvent/keydown/windowKeyDown/dialog/state.ts` 在 `SPECIAL_DIALOG_KEYS.includes(dialogKey)` 处把 `string` 传给字面量联合数组，触发 TypeScript 2345。
  - **行动**: 为特殊对话框键补充受控类型守卫，消除 `dialogKey` 宽泛字符串与特殊对话框联合类型之间的不兼容，并做最小回归验证。
  - **背景**: `switchDialogEvent.ts` 等协作点仍与切换对话框共享状态耦合。
  - **行动**: 视本次重构结果决定是否进一步抽离共享状态访问器。

## 🟡 中期计划

- [ ] **Phase 5: 评估窗口级键盘总路由继续拆分 (P2)**
  - **背景**: 若状态和命令数量继续增长，仍可能出现单模块过重。
  - **行动**: 评估是否继续拆为 dialog/system/escape/navigation 等子路由。

## 🏁 已归档/已完成

- [x] **移除旧窗口键盘聚合实现、保留墓碑并登记替代关系 (P0)** [已完成 2026-07-29]
  - **背景**：`app/src/boot/globalEvent/keydown.ts` 在窗口路由与全局快捷键拆分完成后仍保留 `windowKeyDown`、`sendGlobalShortcut` 和 `sendUnregisterGlobalShortcut` 三份重复实现，已无源码或测试消费者，但仍被全量 TypeScript 检查收录。
  - **替代映射**：`windowKeyDown` 由 `keydown/windowKeyDown/windowKeyDown.ts` 唯一提供；`sendGlobalShortcut` 与 `sendUnregisterGlobalShortcut` 分别由 `keydown/windowKeyDown/globalShortcut/send.ts` 和 `unregister.ts` 唯一提供。三个现行入口均保留可搜索的替代关系注释。
  - **处理依据**：生产事件入口 `globalEvent/event.ts` 与配置、快捷键消费者均直达上述现行模块；仓库搜索确认旧文件无导入者，旧文件除这三个导出外没有公共表面。原实现删除后在同路径保留无运行时逻辑、无依赖、无公共导出的墓碑模块，旧命名导入会在编译期显式失败。
  - **验证证据**：删除前窗口路由专项测试 `36/36` 通过；删除后继续以全量类型检查、循环门禁和同一专项测试验证替代关系完整。

- [x] **Phase 3.4: 按阶段重排 windowKeyDown 目录结构 (P0)** [已完成 2026-04-24]
  - **背景**: 现有 `windowKeyDown/` 虽然已经做了状态路由化，但目录仍按 `dialog/system/navigation` 领域拆分，导致状态收集阶段也被拆散到多个子域目录中，违背“状态收集 => 路由导航 => 子集处理”的阶段边界。
  - **完成情况**:
    - 新增 `state/`，把原先散落在 `dialog/system/navigation` 下的 facts 收集合并为统一收集器，入口改为一次性收集完整状态。
    - 新增 `route/`，把 `facts -> command` 与根层域优先级路由统一收敛到路由阶段目录。
    - 新增 `subset/`，把对话框、系统、导航和 UI 的最终命令执行收敛到子集处理阶段目录，并保留切换对话框工厂、Esc 退场链与导航兜底链等叶子辅助模块。
    - 删除旧的 `dialog/`、`system/`、`navigation/` 领域目录，使目录语义直接对齐处理流程，而不是继续以领域切割状态阶段。
  - **成果文件**:
    - `app/src/boot/globalEvent/keydown/windowKeyDown/state/`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/route/`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/subset/`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/windowKeyDown.ts`
    - `docs/ttt/窗口级键盘事件lint清理与状态路由化.ttt.md`
  - **验证命令**:
    - `cd app && pnpm exec eslint "src/boot/globalEvent/keydown/windowKeyDown/**/*.ts" "src/boot/globalEvent/keydown/windowKeyDown/*.ts"`
    - `cd app && pnpm exec tsc --noEmit --pretty false --skipLibCheck --target es2022 --module esnext --moduleResolution node --lib es2022 --lib dom --strictNullChecks true src/boot/globalEvent/keydown/windowKeyDown/windowKeyDown.ts 2>&1 | Select-String "windowKeyDown"`

- [x] **Phase 3.3: 退回显式事实收集并对齐备份行为 (P0)** [已完成 2026-04-24]
  - **背景**: `windowKeyDown` 在上一轮状态化后仍残留 `resolve*Command`/归并字段，导致导航与系统收集器重新退化成命令解释层；同时根路由里的部分导航分发顺序也和 `windowKeyDown.ts.bak.2026-04-21-router-refactor` 不完全一致。
  - **完成情况**:
    - 删除了 `WindowKeyDownState` 中残留的 `tabExecCommand/tabIndex/tabRelative/layoutCommand/deferredSearchCommand`，统一改为显式事实 + 执行期参数恢复。
    - `navigation/state.ts` 改为只收集页签、布局、搜索与最近关闭等显式热键事实，并只保留 `pluginCommand` 这一类真正需要下传的载荷。
    - `dialog/state.ts` 与 `system/state.ts` 清理掉多余的派生归并字段，修正切换对话框的 next/prev 辅助热键匹配不应错误依赖另一侧热键存在的问题。
    - 根 `windowKeyDown.ts` 的统一状态空间路由重新对齐备份文件中的导航执行顺序：`closeTab -> recentClosed -> goToTab* -> closeOthers... -> layout...`，避免热键冲突时发生行为漂移。
    - `switchDialogEvent.ts` 不再经 `windowKeyDown.ts` 间接共享状态，而是直接读写 `switchDialog.global.ts`，把共享切换对话框实例收敛到单点。
  - **成果文件**:
    - `app/src/boot/globalEvent/keydown/windowKeyDown/windowKeyDown.ts`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/dialog/state.ts`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/system/state.ts`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/navigation/state.ts`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/types.ts`
    - `app/src/boot/globalEvent/keydown/switchDialogEvent.ts`
    - `app/src/boot/globalEvent/keydown/imports.ts`
    - `docs/ttt/窗口级键盘事件lint清理与状态路由化.ttt.md`
  - **验证命令**:
    - `cd app && pnpm run lint:file -- src/boot/globalEvent/keydown/windowKeyDown/windowKeyDown.ts`
    - `cd app && pnpm run lint:file -- src/boot/globalEvent/keydown/windowKeyDown/dialog/state.ts`
    - `cd app && pnpm run lint:file -- src/boot/globalEvent/keydown/windowKeyDown/types.ts`
    - `cd app && pnpm run lint:file -- src/boot/globalEvent/keydown/switchDialogEvent.ts`
    - `cd app && pnpm run lint:file -- src/boot/globalEvent/keydown/imports.ts`
    - `cd app && pnpm exec eslint "src/boot/globalEvent/keydown/windowKeyDown/**/*.ts" "src/boot/globalEvent/keydown/windowKeyDown/*.ts"`

- [x] **Phase 3.2: 清除 stage 残余契约并改为状态空间直出执行器 (P0)** [已完成 2026-04-23]
  - **背景**: 虽然 `windowKeyDown.ts` 已经把 dialog/system/navigation 合并为一份统一状态空间，但类型命名和注释里仍残留“路由结果/阶段”语义，容易再次把正交分割退化成额外的优先级轴。
  - **完成情况**:
    - 删除了 `types.ts` 中残留的 `*RouteResult` 契约，补充 `WindowKeyDownExecutor` 与 `UIWindowKeyHandledCommand`，让统一状态空间分割直接产出执行器类型。
    - `windowKeyDown.ts` 入口改为显式消费统一执行器类型，不再保留任何 `stage` 或“命令结果再解释”的概念残留。
    - 同步修正了 `dialog/system/navigation` 执行器与根入口的注释术语，统一为“域命令/状态空间分割”语义。
  - **成果文件**:
    - `app/src/boot/globalEvent/keydown/windowKeyDown/windowKeyDown.ts`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/types.ts`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/dialog/executors.ts`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/system/executors.ts`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/navigation/executors.ts`
    - `docs/ttt/窗口级键盘事件lint清理与状态路由化.ttt.md`
  - **验证命令**:
    - `cd app && pnpm run lint:file -- src/boot/globalEvent/keydown/windowKeyDown/windowKeyDown.ts`
    - `cd app && pnpm run lint:file -- src/boot/globalEvent/keydown/windowKeyDown/types.ts`
    - `cd app && pnpm run lint:file -- src/boot/globalEvent/keydown/windowKeyDown/dialog/executors.ts`
    - `cd app && pnpm run lint:file -- src/boot/globalEvent/keydown/windowKeyDown/system/executors.ts`
    - `cd app && pnpm run lint:file -- src/boot/globalEvent/keydown/windowKeyDown/navigation/executors.ts`
    - `cd app && pnpm exec eslint "src/boot/globalEvent/keydown/windowKeyDown/**/*.ts" "src/boot/globalEvent/keydown/windowKeyDown/*.ts"`
    - `cd app && pnpm exec tsc --noEmit --pretty false --strict --strictNullChecks --strictFunctionTypes --strictBindCallApply --strictPropertyInitialization --noImplicitAny --noImplicitThis --useUnknownInCatchVariables --exactOptionalPropertyTypes --noUncheckedIndexedAccess --target ES2022 --module ESNext --moduleResolution bundler --types node --skipLibCheck src/boot/globalEvent/keydown/windowKeyDown/windowKeyDown.ts src/boot/globalEvent/keydown/windowKeyDown/types.ts src/boot/globalEvent/keydown/windowKeyDown/dialog/executors.ts src/boot/globalEvent/keydown/windowKeyDown/system/executors.ts src/boot/globalEvent/keydown/windowKeyDown/navigation/executors.ts`

- [x] **立项：windowKeyDown lint 清理与状态路由化 TTT 创建** [已完成 2026-04-21]
  - **背景**: 需要为本次较复杂的 lint 清理和结构重构建立正式追踪文档。
  - **完成情况**: 已按 TTT 规程创建目标、原则、阶段、验收标准与归档区。
  - **成果文件**:
    - `docs/ttt/窗口级键盘事件lint清理与状态路由化.ttt.md`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/windowKeyDown.ts.bak.2026-04-21-router-refactor`
  - **参考文档**:
    - `docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`
    - `docs/ttt/键盘事件处理重构.ttt.md`

- [x] **Phase 1: 建立重构护栏与路由骨架 (P0)** [已完成 2026-04-21]
  - **背景**: 原始 `windowKeyDown.ts` 同时命中目录规模、导入边界、控制流复杂度和注释规则，必须先建立可回退、可追踪的重构护栏。
  - **完成情况**:
    - 保留了 `windowKeyDown.ts` 备份文件。
    - 建立了本 TTT 文档并持续滚动更新。
    - 根入口改造成薄编排层，子域目录改成 `dialog/system/navigation` 领域聚合结构。
  - **成果文件**:
    - `app/src/boot/globalEvent/keydown/windowKeyDown/windowKeyDown.ts`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/windowKeyDown.ts.bak.2026-04-21-router-refactor`
    - `docs/ttt/窗口级键盘事件lint清理与状态路由化.ttt.md`

- [x] **Phase 2: 迁移窗口级按键状态与执行逻辑 (P0)** [已完成 2026-04-21]
  - **背景**: 现有逻辑把切换对话框、Esc 退场、系统快捷键、布局命令和插件命令揉在同一入口中，难以维护也难以补全 lint 约束。
  - **完成情况**:
    - 统一收敛为单一 `WindowKeyDownState` 状态空间定义。
    - 入口改为“同一状态对象逐阶段富化”的编排方式。
    - 对话框、系统、导航阶段都改为“状态收集 + 路由 + 执行器”结构。
    - 根 `imports.ts` 被压缩为基础设施级依赖出口，各子域在本目录内完成领域聚合。
  - **成果文件**:
    - `app/src/boot/globalEvent/keydown/windowKeyDown/types.ts`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/dialog/`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/system/`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/navigation/`

- [x] **Phase 3: lint 收口与行为回归 (P1)** [已完成 2026-04-21]
  - **背景**: 架构拆分完成后，仍需收口注释、导出规则、异步导出规则和剩余结构性 lint 问题。
  - **完成情况**:
    - 删除了冗余的 `commands.ts`，解除根目录条目超限。
    - 修正了各子域 `imports.ts` 的注释边界。
    - 拆分了系统阶段的 Esc 退场链与命令处理器，消除了超长文件问题。
    - 已按“单一状态空间 + 单次统一路由”要求，合并原先 dialog/system/navigation 三套路由切片为统一意图空间，并删除三份平行 router。
    - 目录级 ESLint 检查已通过。
  - **验证命令**:
    - `cd app && pnpm exec eslint "src/boot/globalEvent/keydown/windowKeyDown/**/*.ts" "src/boot/globalEvent/keydown/windowKeyDown/*.ts"`

- [x] **Phase 3.1: 将菜单系统与 AV 面板并入统一状态空间 (P0)** [已完成 2026-04-22]
  - **背景**: 根入口仍残留菜单系统与 AV 面板的硬编码抢占分支，违背“状态空间是唯一分发依据”的重构目标。
  - **完成情况**:
    - 在统一 `WindowKeyDownState` 中补充 `uiIntent`，把菜单系统与 AV 面板纳入同一份状态空间。
    - 在统一路由器中增加 `ui` 阶段，使菜单系统与 AV 面板经由命令映射进入统一执行流。
    - 删除入口层对 `bindMenuKeydown()` 与 `bindAVPanelKeydown()` 的直接硬编码分支，只保留统一执行器中的兼容调用。
    - 清理了调试过程中新增的额外备份文件，保持目录条目数继续满足上限约束。
  - **成果文件**:
    - `app/src/boot/globalEvent/keydown/windowKeyDown/windowKeyDown.ts`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/types.ts`
    - `app/src/boot/globalEvent/keydown/windowKeyDown/dialog/state.ts`
    - `docs/ttt/窗口级键盘事件lint清理与状态路由化.ttt.md`
  - **验证命令**:
    - `cd app && pnpm exec eslint "src/boot/globalEvent/keydown/windowKeyDown/**/*.ts" "src/boot/globalEvent/keydown/windowKeyDown/*.ts"`
    - `cd app && pnpm exec tsc --noEmit --pretty false --strict --strictNullChecks --strictFunctionTypes --strictBindCallApply --strictPropertyInitialization --noImplicitAny --noImplicitThis --useUnknownInCatchVariables --exactOptionalPropertyTypes --noUncheckedIndexedAccess --target ES2022 --module ESNext --moduleResolution bundler --types node --skipLibCheck src/boot/globalEvent/keydown/windowKeyDown/windowKeyDown.ts src/boot/globalEvent/keydown/windowKeyDown/dialog/state.ts src/boot/globalEvent/keydown/windowKeyDown/system/state.ts src/boot/globalEvent/keydown/windowKeyDown/navigation/state.ts src/boot/globalEvent/keydown/windowKeyDown/types.ts`

- [x] **Phase 3.2: 设置 Dialog 的 Esc 退场回归 (P0)** [已完成 2026-07-28]
  - **背景**：设置面板采用非模态透明穿透遮罩，不允许遮罩点击关闭；用户报告设置打开后 `Esc` 也不退出，需要区分 Dialog 栈注册与 Calibur 路由问题。
  - **完成情况**：确认 Dialog 构造与 `executeEscape()` 读写同一 `window.siyuan.dialogs` 注册表；新增状态空间测试，证明非组合输入的 `Escape` 在无菜单和专用 Dialog 抢占时由根路由选择 `system` 域并产出 `ESCAPE`，执行器销毁栈顶 Dialog。真实桌面设置搜索框聚焦场景按 `Esc` 后设置 Dialog 已移除。
  - **验证证据**：`test/globalEvent/windowKeyDown/dialogEscape.runtime.test.ts` 与 Dialog 按钮测试合计 `8/8` 通过。未增加兼容分支或静默路径，现有路由无需修改。
