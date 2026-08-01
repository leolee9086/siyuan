# AgentComposer.tiptap.ts 拆分重构跟踪

## 任务目标

将 `app/src/layout/dock/agent/AgentComposer.tiptap.ts`（当前 424 物理行 / 400 实际代码行）拆分为多个模块，使：

- 文件实际代码行数 ≤ 300（lint 规则 `code-size/max-lines`）
- 每个函数实际代码行数 ≤ 50（lint 规则 `code-size/max-lines-per-function`）
- 消除全部 TS 类型错误（12 个）
- 保留原有行为不变

## 拆分方案

| 新文件 | 职责 |
|---|---|
| `composer/AgentComposer.suggestion.ts` | 建议菜单核心：打开/关闭/渲染/键盘导航/视口定位，合并 @ 与 / 两个菜单的重复代码 |
| `composer/AgentComposer.tiptap.extensions.ts` | Tiptap 扩展配置：@ 引用 Mention（items/command/render）与 / 技能建议逻辑 |
| `AgentComposer.tiptap.ts` | 保留编辑器编排、历史浏览、发送处理与 ComposerHandle 契约 |

## 任务状态

- [ ] 备份原始文件（已完成 → `AgentComposer.tiptap.ts.bak`）
- [ ] 创建 `AgentComposer.suggestion.ts`（菜单核心模块）
- [ ] 创建 `AgentComposer.tiptap.extensions.ts`（扩展配置模块）
- [ ] 重构 `AgentComposer.tiptap.ts` 主体
- [ ] lint 检查通过（`cd app && pnpm run lint:file -- src/layout/dock/agent/AgentComposer.tiptap.ts` 及相关新文件）
- [ ] 类型检查通过
- [ ] 核对行为等价性

## 失败记录

（无）
