# MAGI 输入栏迁移修复 执行跟踪 (TikTocTak)

> **目标**: 将原始原型 `toread/MAGI/index.vue` 中遗漏的用户输入栏和 `sendToAll` 对话逻辑迁移到 `app/src/magi/`，使 MAGI 面板具备完整的用户交互能力。
>
> **前置 ttt**: [MAGI前端迁移.ttt.md](./MAGI前端迁移.ttt.md) — T3.2 迁移主面板组件时遗漏了 `index.vue` 的输入栏和对话逻辑
>
> **关联 ttt**:
> - [MAGI_独立聊天面板.ttt.md](./MAGI_独立聊天面板.ttt.md) — 聊天面板功能规划
> - [MAGI_投票机制修正.ttt.md](./MAGI_投票机制修正.ttt.md) — ⚠️ T2.2 调用的共识/投票函数将被该 ttt 重写，需协调执行顺序

---

## 问题描述

`MAGI前端迁移.ttt.md` T3.2 将 `toread/MAGI/index.vue` 的面板逻辑迁移到了 `app/src/magi/`，但**遗漏了输入栏和对话交互链路**：

| 遗漏内容 | 原始位置（index.vue） | 当前迁移状态 |
|----------|----------------------|-------------|
| `textarea` 输入框 + 发送按钮 | L53-59 | ❌ 未迁移 |
| `sendToAll` 对话逻辑 | L103-158 | ❌ 未迁移 |
| `globalInput` 状态 | L82 | ❌ 未迁移 |
| `loadPersonaConfig` 人格热重载 | L173-206 | ❌ 未迁移（低优先级） |

`sendToAll` 实现的完整链路：
1. 用户输入 → 添加到 `consensusMessages`
2. 并行调用三贤人 `reply`
3. 过滤有效响应 + 转换 Think 标签
4. Trinity 总结
5. 交叉验证投票
6. 生成加权共识结果

---

## 任务分解

### Phase 1: 输入栏组件

#### T1.1 创建 MagiInputBar 组件
- **范围**: 在 `app/src/magi/components/magi-main-panel/` 下新建 `MagiInputBar.vue`、`MagiInputBar.ctx.ts`、`MagiInputBar.types.ts`、`MagiInputBar.css`；参考原始 `index.vue` L53-59 的 `textarea` + 发送按钮布局；支持 Enter 发送、Shift+Enter 换行；流式响应时禁用输入 + 显示停止按钮
- **依赖**: 无
- **完成标志**: 组件渲染正常，`v-model` 双向绑定和键盘事件响应正确，lint通过
- **状态**: [x] 已完成

#### T1.2 嵌入 MagiMainPanel
- **范围**: 修改 `MagiMainPanel.vue`，在消息容器下方嵌入 `MagiInputBar`；传入 `isLoading`（任一贤人正在响应时为 true）和 `@submit` 事件
- **依赖**: T1.1
- **完成标志**: 输入栏在主面板底部可见，布局正确，lint通过
- **状态**: [x] 已完成

### Phase 2: 对话逻辑

#### T2.1 实现 sendUserMessage
- **范围**: 在 `useMagi.ts` 中新增 `sendUserMessage(text: string)` 方法，参考原始 `sendToAll`（L103-158）实现：添加用户消息 → 并行调用三贤人 `reply` → 收集流式结果 → 追加到 `consensusMessages`；在 `useMagi.types.ts` 的 `UseMagiReturn` 中增加 `sendUserMessage` 和 `isAnySeelLoading` 字段
- **依赖**: T1.2
- **完成标志**: 用户输入能触发三贤人回复并在消息流中显示，lint通过
- **状态**: [x] 已完成

#### T2.2 接入共识表决（分两步）
- **范围**:
  - **Step A — 最小集成（本 ttt 负责）**: 在 `sendUserMessage` 中以最小方式调用 `magiConsensus.ts` 现有的 `processSagesResponses`、`handleTrinitySummary`、`processVoting`、`生成共识聊天回复`，恢复 `sendToAll` 的完整链路。此步使用**现有（旧）接口**，目标是先让链路端到端跑通。
  - **Step B — 对齐投票修正（由 [MAGI_投票机制修正.ttt.md](./MAGI_投票机制修正.ttt.md) 驱动）**: 投票修正的 Phase 1-3 重写了 `VoteResult` 类型、Mock 投票和共识流程后，回来适配 T2.2 的集成代码，使之使用新的三方二元表决接口。
- **依赖**: T2.1；Step B 依赖投票修正 Phase 3 完成
- **完成标志**: Step A — 旧接口链路跑通；Step B — 新接口对齐后链路仍然跑通
- **状态**: [x] 已完成（Step A）

### Phase 3: 验证

#### T3.1 手动验证
- **范围**: `pnpm run dev` 启动开发服务器；打开 MAGI 面板确认输入栏可见；输入文本按 Enter 触发对话；验证流式响应期间输入框禁用；验证共识结果正确显示
- **依赖**: T2.2
- **完成标志**: 完整对话链路端到端可用
- **状态**: [x] 已完成（部分通过）

---

## 执行记录

| 日期 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-02 | 创建 ttt | ✅ | 初始版本，发现 MAGI前端迁移 T3.2 遗漏输入栏和对话逻辑 |
| 2026-03-02 | T1.1 创建 MagiInputBar 组件 | ✅ | 新建 4 个文件并完成 Enter/Shift+Enter、加载态禁用输入与 stop 事件；新增文件 lint:file 全通过；`tsc --noEmit` 受现有 tsconfig `types` 配置问题阻断（TS2688） |
| 2026-03-02 | T1.2 嵌入 MagiMainPanel | ✅ | 在主面板消息区下方嵌入输入栏；完成 `inputValue` v-model、`submit-input`/`stop-input` 事件透传与 `seels.some(seel.loading)` 加载态联通；`MagiMainPanel.vue`/`MagiMainPanel.types.ts` 的 lint:file 通过；`tsc --noEmit` 仍受既有 TS2688 阻断 |
| 2026-03-02 | T2.1 实现 sendUserMessage | 🔄 | 子任务开始执行：先将 T2.1 状态标记为进行中 |
| 2026-03-02 | T2.1 实现 sendUserMessage | ✅ | 在 `useMagi.ts` 新增 `sendUserMessage` 基础链路（用户消息入流→三贤者并行 `reply`→收集并回写消息流），并暴露 `isAnySeelLoading`；`useMagi.types.ts` 补充返回类型；`MagiMainPanel` 增加可选 `isAnySeelLoading` 输入并接到 `MagiInputBar` 加载态；最小检查：`lint:file` 通过，`tsc --noEmit` 仍受既有 TS2688（`./src/types`）阻断 |
| 2026-03-02 | T2.2 接入共识表决（Step A） | 🔄 | 子任务开始执行：先将 T2.2 状态标记为进行中 |
| 2026-03-02 | T2.2 接入共识表决（Step A） | ✅ | 在 `useMagi.ts` 链路接入 `processSagesResponses`→`handleTrinitySummary`→`processVoting`→`generateConsensusReply`，并补齐中间态/结果态消息与异常兜底；抽离 `useMagi.consensus.ts` 降低主文件复杂度；`lint:file` 通过；`tsc --noEmit` 仍受既有 TS2688（`./src/types`）阻断 |
| 2026-03-02 | T3.1 手动验证 | 🔄 | 子任务开始执行：将 T3.1 状态标记为进行中 |
| 2026-03-02 | T3.1 手动验证 | ✅（部分通过） | 执行方式：采用“可替代验证”而非 `pnpm run dev`（当前反馈为缺少 MAGI 界面单独入口，无法直接进行面板人工交互）；静态核验链路：`MagiMainPanel.vue` 已嵌入 `MagiInputBar`，`MagiInputBar.ctx.ts` 已实现 Enter 发送 / Shift+Enter 换行 / 加载期按钮语义切换为 stop / 输入禁用，`useMagi.consensus.ts` 已覆盖“用户消息→三贤者响应→Trinity总结→投票→共识消息”主链；命令采样：`pnpm exec eslint ./src/magi/components/magi-main-panel/MagiInputBar.vue ./src/magi/components/magi-main-panel/MagiMainPanel.vue ./src/magi/composables/useMagi.ts ./src/magi/composables/useMagi.consensus.ts ./src/magi/composables/magiConsensus.ts` 退出码 0；`pnpm exec tsc --noEmit` 失败（既有阻断 TS2688: `tsconfig.json` `types` 包含 `./src/types`）；阻断项影响：无法完成真实 UI 端到端手工点击验证与运行时流式交互观测 |
