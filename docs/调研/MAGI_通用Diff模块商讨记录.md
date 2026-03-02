# MAGI 通用 Diff 模块商讨记录

> 更新日期: 2026-03-02  
> 关联 ttt: [docs/ttt/MAGI_通用Diff模块选型与落地.ttt.md](../ttt/MAGI_通用Diff模块选型与落地.ttt.md)

## 1. 已确认边界

1. 当前阶段不做“可编辑 Diff”。
2. 当前阶段目标是“只读差异展示”，服务 PersonaSeed 的建议查看。
3. 展示与交互范围收敛在“代码/文本片段级”，不与专业编辑器竞争。
4. 依赖引入必须先评审并得到明确确认，再安装接入。

## 2. 参考实现调研（Gemini / Aider）

### 2.1 Gemini CLI（参考仓库）

- 仓库: `https://github.com/google-gemini/gemini-cli`
- 本地快照: `toread/_refs/gemini-cli`
- 提交: `703759c`

观察：

1. CLI 侧核心 diff 能力基于 `diff` 包，而非内嵌重型编辑器。  
   证据：`toread/_refs/gemini-cli/packages/cli/package.json:45`，`"diff": "^8.0.3"`
2. Core 层以 patch / lines 比对为主，先算差异再交给上层展示。  
   证据：`toread/_refs/gemini-cli/packages/core/src/tools/diff-utils.ts:7`  
   证据：`toread/_refs/gemini-cli/packages/core/src/tools/diffOptions.ts:7`
3. 仅在 VS Code companion 场景使用宿主编辑器 diff 视图（`vscode.diff`），不是 CLI 内置重编辑器。  
   证据：`toread/_refs/gemini-cli/packages/vscode-ide-companion/src/diff-manager.ts:120`

结论：Gemini 的模式是“差异内核轻量 + 宿主展示适配”，符合我们现阶段做通用模块与降级兜底的方向。

### 2.2 Aider（参考仓库）

- 仓库: `https://github.com/Aider-AI/aider`
- 本地快照: `toread/_refs/aider`
- 提交: `b235160`

观察：

1. Aider 的交互核心是统一 diff 文本流与 patch 流，不依赖浏览器重编辑器。  
   证据：`toread/_refs/aider/aider/commands.py:657`
2. Web GUI 展示层直接把 diff 作为代码块显示（`language="diff"`）。  
   证据：`toread/_refs/aider/aider/gui.py:129`
3. 依赖里存在 `diff-match-patch`，但主展示仍是统一 diff 文本范式。  
   证据：`toread/_refs/aider/requirements.txt:74`

结论：Aider 也验证了“先统一 diff 文本协议，再按渠道渲染”的可行性，适合片段级场景。

## 3. 候选方案池（不局限 Monaco/CodeMirror）

以下为 2026-03-02 的 npm 快照（`npm view`）：

| 候选 | 适配层级 | 最新版本 | 最近更新时间 | unpacked size | 备注 |
|---|---|---:|---|---:|---|
| `diff` | 差异算法内核 | 8.0.3 | 2026-01-28 | 509,886 B | 纯算法，最灵活 |
| `diff2html` | 算法+HTML渲染 | 3.4.56 | 2026-01-31 | 2,022,814 B | 快速出效果，但 HTML 输出风格固定 |
| `@git-diff-view/vue` | Vue 组件级 | 0.0.40 | 2026-02-26 | 1,031,696 B | Vue 友好，接入快 |
| `v-code-diff` | Vue 组件级 | 1.13.1 | 2024-08-29 | 1,474,637 B | 维护节奏偏慢 |
| `@codemirror/merge` | 编辑器级 | 6.12.0 | 2026-02-15 | 181,328 B | 能力强，仍有编辑器接入成本 |
| `monaco-editor` | 编辑器级 | 0.55.1 | 2026-02-11 | 72,633,330 B | 能力强但体积极重 |

补充：

1. `@codemirror/merge` 的包体本身不大，但真实接入需联动 `@codemirror/state/view/language` 等生态包。
2. `monaco-editor` 即使只读，也会明显增加加载与构建负担；应作为后续“更强代码查看/编辑”阶段方案，不适合作为本阶段起点。

## 4. 初步判断（供讨论）

### 4.1 当前阶段最稳妥路径

推荐 `diff` 作为首阶段唯一硬依赖（或优先复用项目已有能力），自研轻量 Vue 展示层：

1. 与“片段级 + 只读”目标高度对齐。
2. 可精确控制样式和交互（接受/拒绝/定位问题）。
3. 为后续适配器模式留足空间，避免早期绑死在某个编辑器框架。
4. 可在移动端做更细的性能控制（折叠、截断、懒渲染）。

### 4.2 次优捷径（更快可见结果）

如果你希望更快看到 UI 效果，可考虑 `@git-diff-view/vue` 作为“展示层加速器”：

1. Vue 直接可用，落地速度快。
2. 但需要接受其组件风格与后续定制边界。
3. 仍建议保留统一 `DiffModel` 内核，避免将业务结构直接绑死到第三方组件 props。

### 4.3 暂不建议

1. 首阶段直接上 `monaco-editor`：与“片段级只读”目标不匹配，体积负担过重。
2. 首阶段直接上完整 `CodeMirror Merge`：虽可行，但会把任务重心提前转到编辑器适配，而不是先建立通用差异协议。

## 5. 建议的分阶段收敛

### Phase A（当前）

1. 冻结统一数据协议 `DiffModel`（old/new/hunks/meta）。
2. 先实现只读 `inline` 视图（必要时再扩 `split`）。
3. 支持“建议定位跳转”所需的行号/片段索引映射。

### Phase B（可选增强）

1. 根据实际体验决定是否引入 `@git-diff-view/vue` 替代/补充渲染层。
2. 引入前先做一轮性能与样式可控性对比（移动端优先）。

### Phase C（未来代码能力升级）

1. 当 MAGI 进入更强代码查看/编辑能力阶段，再评估 `@codemirror/merge` 或 `monaco-editor`。
2. 该阶段目标会变化为“片段编辑+上下文浏览”，不应提前在当前阶段透支复杂度。

## 6. 已确认决策（2026-03-02）

1. 依赖策略：仅引入“算法层”依赖，不引入渲染层三方组件。
2. 渲染策略：Diff 渲染由项目自行实现，但必须保留后续对接能力（adapter/renderer 可插拔）。
3. 粒度策略：首版差异视图先收敛为“行级”，并预留扩展到“字级/词级”的模型字段与渲染接口。

## 7. 下一步实施约束（冻结）

1. 首阶段算法层预选 `diff` 包（只负责生成行级变更模型，不耦合 UI）。
2. 首阶段 UI 先实现 `inline` 视图，`split` 作为扩展模式保留接口。
3. 数据协议中显式保留 `inlineSegments`（可选）与 `capabilities`（可选），为未来字级高亮与渲染器对接预留空间。
4. 组件层不得直接依赖具体算法库输出结构，必须经过统一 `DiffModel` 转换层。

已落地：

1. `app/src/util/diff/diff.types.ts`
2. `app/src/util/diff/diff.engine.ts`
3. `app/src/components/common/diff/LineDiffViewer.vue`
4. `app/src/components/common/diff/LineDiffViewer.css`
5. `app/src/magi/entry/persona-seed-panel/components/PersonaSeedConvergencePanel.vue`（描述建议差异接线）

说明：

1. 公共工具层已定义 `DiffModel`、`DiffEngine`、`DiffRendererAdapter` 协议，并不绑定 MAGI 目录。
2. `inlineSegments` 与 `DiffCapabilities` 已作为扩展预留字段进入模型。
3. 首版仍按行级优先，未引入任何渲染层三方依赖。
4. PersonaSeed 已接入“描述建议 -> 行级差异预览”。

## 8. 外部资料索引

- Monaco API（createDiffEditor）: https://microsoft.github.io/monaco-editor/typedoc/functions/editor.createDiffEditor.html
- CodeMirror merge 包: https://www.npmjs.com/package/%40codemirror/merge
- diff2html 包: https://www.npmjs.com/package/diff2html
- `@git-diff-view/vue` 包: https://www.npmjs.com/package/%40git-diff-view/vue
- Gemini CLI 仓库: https://github.com/google-gemini/gemini-cli
- Aider 仓库: https://github.com/Aider-AI/aider
