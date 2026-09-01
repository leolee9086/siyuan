# AGENTS.md

## 0. 仓库身份：本仓库不是思源笔记官方原版

**本仓库是 [`siyuan-note/siyuan`](https://github.com/siyuan-note/siyuan) 的个人分叉（S-Forge / sforge），不是官方原版仓库。** 维护者为 `leolee9086`，用于个人使用场景，代码有大量本地修改。

- **产品与分支身份**：`app/package.json` 中 `name: "s-forge"`、`desktopName: "org.b3log.sforge"`；当前开发分支为 `multipleAI`。
- **分叉权威说明**：动手前**先读 [`docs/SFORGE.md`](docs/SFORGE.md)**（分叉原因、非兼容性、fork 依赖、贡献政策）。`README.md` 顶部有 S-forge 分叉横幅，README 主体保留上游原文以降低合并冲突。
- **贡献政策**：这是自用修改版，**不接受 PR**，issue 可能长期得不到回复（见 `docs/SFORGE.md`）。
- **与上游的关系**：通过 `upstream-sync` 流程把上游 siyuan-dev 的提交**语义移植**（`semantic-port` / `exact-port`）到本仓库，审计记录在 `docs/upstream-sync/`；**不保证及时跟进官方功能更新与 bug 修复**，因此可能存在上游没有的功能缺失或 bug。
- **主要差异**（详见 `docs/SFORGE.md`）：
  - **forge 模式（工坊模式）**：本分叉新增的运行模式，不属于上游。工作空间默认在源码目录内（`.dev-workspace`），支持多 clone 并行开发互不干扰；启动示例：`go run . serve --workspace=../.dev-workspace --mode forge --wd=../app`（Electron 开发环境也以 `--mode forge` 启动内核）。
  - **Forge 运行时与 Supervisor**：`.forge-runtime/` 下的内核热替换、健康检查、页面探测机制，以及 `.githooks/` 提交门禁（见第 5 章）。
  - **多 AI（MAGI）与 agent 运行时**：`kernel/agent/`（Go 侧 AI agent 运行时，与上游共享的模块，本地持续重点开发）、`app/src/agent/`、`app/src/magi/`（后两者为本地独有,app/src/agent为上游单文件内容的拆分重构版本）；前端构建目标新增 `magi-app` / `magi-desktop` / `magi-mobile` / `magi-identity`。
  - **Vue 化 UI**：部分 UI 组件迁移到 Vue 实现（`@vitejs/plugin-vue`、`vue-tsc`）；TypeScript 使用严格模式。
  - **fork 依赖**：如 `leolee9086/lute` 替换 `88250/lute`（支持 `((id1 id2 id3 "text"))` 多 ID 块引用语法），见 `kernel/go.mod` 的 `replace` 指令。
  - **本地包**：`packages/caliburRouter`（Zod 边界的 UI 路由）、`packages/dehaze`（WebGPU 图像去雾）、`kernelSDKTS`（思源内核 API 客户端）、`extensions/`（个人插件）。
  - **编码习惯**：可能使用中文变量名、较冗长的注释（个人习惯，避免看不懂自己的代码）；包含大量 AI 辅助编码。

以下章节继承上游指南并补充分叉特有内容；标注「上游」的条目以官方 siyuan 仓库为准。

---

## 0.1 工作前必读

**开始任何工作之前，必须先阅读 [`docs/agent负面行为记录.md`](docs/agent负面行为记录.md)。** 该文件记录 agent 违反规则的行为及纠正要求；遗忘或违反其中的记录会重复同样的错误。特别是：

- 未获用户明确授权，不得执行任何 git 写操作（commit / revert / reset / rebase / push 等）。
- 不得将自己的幻觉或错误归因于用户的要求；规程既有规定以规程原文为准。

---

## 1. 架构

**架构（上游）：** Go 内核（`kernel/`）+ TypeScript 前端（`app/`），另有一个独立的 `export` 构建产物（全局 `Protyle`，入口 `src/protyle/method.ts`），用于在导出的 HTML / PDF 预览中渲染富内容。版本号读取自 `kernel/go.mod`、`app/package.json`、`kernel/util/working.go`。

**架构（分叉扩展）：** 在标准 webpack 产物（`app` / `desktop` / `mobile` / `export`）之外，新增 `magi-app` / `magi-desktop` / `magi-mobile` / `magi-identity` / `protyle-app` / `agent-app` 等构建目标；`kernel/agent/`（AI agent 运行时）与 `kernel/mcp/`（MCP 服务器）为上游与本地共享的模块，本地在其上持续扩展；另有 Forge Supervisor 相关逻辑；前端引入 Vue 组件与 CaliburRouter 路由边界。

---

## 2. 所需工具链（上游）

| 工具 | 版本 | 权威来源 |
|---|---|---|
| Go | 见 `go` 指令 | `kernel/go.mod` |
| Node（+ pnpm） | 见 CI 矩阵 | `.github/workflows/cd.yml`、`app/package.json`（`packageManager` 字段） |

---

## 3. 相关仓库（导航）

### 上游相关仓库

SiYuan 横跨多个仓库。本仓库（分叉）继承上游的架构与依赖关系：

| 仓库 | 角色 / 须知 |
|---|---|
| `siyuan` | **上游原版** —— 内核 + Electron/web/平板 UI；本仓库是其分叉 |
| `siyuan-android` / `siyuan-ios` / `siyuan-harmony` | 封装 gomobile 内核的原生应用；各平台构建步骤不同 —— 参见各项目 README |
| `siyuan-chrome` | 浏览器扩展（网页剪藏）；仅通过 HTTP 与运行中的内核通信 |
| `siyuan-testing` | Playwright 端到端测试；测试数据属于 `SiYuan Testing` 笔记本 —— 参见该仓库的 `AGENTS.md` |
| `petal` | SiYuan 插件 API 声明（插件系统名为 "petal"）；供插件使用，不是内核的 Go 依赖 |
| `lute` | Markdown/Kramdown AST 引擎 —— 编辑器 + `.sy` 格式的来源，也是内置 `lute.min.js`（GopherJS 构建、供前端使用）的来源。上游检出位于 `$GOPATH/src/github.com/88250/lute`，并非同级仓库；**本分叉改用 `leolee9086/lute` fork**（见下） |
| `dejavu` | 数据仓库 / 同步引擎（加密快照） |
| `riff` | 间隔重复（SRS）记忆卡片调度器 |
| `gulu` | 通用 Go 工具库（`gulu.Ret`、`gulu.JSON`、……） |
| `eventbus` | 进程内事件总线 |
| `filelock` | 跨平台文件锁（`.sy` 读写） |
| `httpclient` | HTTP 客户端封装（云端 / 同步 / 集市调用） |
| `logging` | 内核各处使用的分级日志 |
| `go-sqlite3` / `pdfcpu` | 维护者的 fork，通过 `kernel/go.mod` 中的永久 `replace` 引入（请保留） |
| `epub` / `clipboard` / `go-humanize` / `vitess-sqlparser` / `dataparser` / `encryption` | 较小的 Go 库（导出 / 剪贴板 / 格式化 / SQL 解析 / 数据解析 / 加密） |

以上 Go 库均为 `kernel/go.mod` 中的依赖。GitHub 组织：各 `siyuan-` 应用与大部分库位于 `siyuan-note/*`；lute、gulu 及维护者 fork（go-sqlite3 / pdfcpu）位于 `88250/*`。

### 分叉特有的依赖

| 仓库 / 路径 | 说明 |
|---|---|
| `leolee9086/lute` | 分叉的 Markdown 引擎 fork，通过 `kernel/go.mod` 的 `replace` 替换 `88250/lute`；本地检出位置见 `docs/SFORGE.md` |
| `packages/`、`kernelSDKTS/`、`extensions/` | 仓库内的本地包与个人插件（以 `link:` 方式依赖，非 Go 模块） |

### 跨仓库注意事项（上游）

- **修改任何 Go 依赖（Lute / dejavu / gulu / eventbus / riff / filelock / httpclient / logging / go-sqlite3 / pdfcpu / epub / ……）：** 这些依赖由内核以 Go 模块方式引入（`kernel/go.mod`）。要测试本地修改，可在 `kernel/go.mod` 中添加临时 `replace` 指向你的本地检出 —— 但**切勿提交该 `replace`**，它会破坏其他人的构建。
- **重新构建 `lute.min.js`：** 它是 Go 项目 `lute` 的 JS 构建产物 —— 在上游生成并检入 `app/stage/protyle/js/lute/`。不要在这里编辑它；修改 `lute`（本分叉为 `leolee9086/lute`）、重新构建后把产物复制进来。
- **类型声明：** 修改 `app/src/types/` 下或其他暴露给插件的 TypeScript 声明与常量时，须在同一任务中同步 `petal` 仓库中对应的声明与常量。
- **移动端应用（`siyuan-android` / `siyuan-ios` / `siyuan-harmony`）：** 每个都是独立的原生应用，封装本仓库构建的内核。如何构建、植入内核绑定并接线，参见各项目自己的 README —— 各平台的工具链与步骤不同，此处不展开。
- **`siyuan-chrome`：** 独立的 TypeScript 项目；仅通过 `docs/API.md` 中记录的公开 HTTP API 与运行中的 SiYuan 实例交互。

---

## 4. 仓库结构

### 顶层（上游）

| 路径 | 内容 |
|---|---|
| `kernel/` | Go 后端 —— 服务器、数据引擎、API、全部领域逻辑 |
| `app/` | TypeScript 前端（Electron/web），由 webpack 构建到 `app/stage/build/` |
| `app/appearance/` | 主题、图标、**i18n**（`appearance/langs/*.json`） |
| `app/stage/` | 由内核提供的构建输出 |
| `app/changelogs/` | 按版本划分的更新日志 markdown |
| `.github/` | `CONTRIBUTING.md`（+zh-CN）、`SECURITY.md`、`CODE_OF_CONDUCT.md`、`PULL_REQUEST_TEMPLATE.md`、issue 模板、`workflows/` |
| `scripts/` | 发布打包：`win-build.bat`、`darwin-build.sh`、`linux-build.sh`、`parse-changelog.py`、`check-lang-keys.py` |

### 分叉特有路径

| 路径 | 内容 |
|---|---|
| `docs/SFORGE.md` | 分叉说明（**必读**） |
| `docs/upstream-sync/` | 上游语义移植的审计与证据（`Upstream-Commit` / `Upstream-Series` / `Upstream-Disposition` 标记） |
| `.forge-runtime/` | Forge Supervisor 运行状态：`commit-runtime-gate.json`（提交门禁记录）、`operations/`（操作日志） |
| `.githooks/` | 提交门禁 git hooks（通过 `core.hooksPath` 启用，见第 5 章） |
| `packages/` | 本地包：`caliburRouter`、`dehaze` 等 |
| `kernelSDKTS/` | 思源内核 API 客户端（TypeScript） |
| `extensions/` | 个人插件源码（合并自个人插件仓库） |
| `toread/`、`trashed/` | 个人资料整理目录（非构建产物） |

### `kernel/` 下的主要包（上游）

| 包 | 职责 |
|---|---|
| `main.go`（`//go:build !mobile`） | 桌面端入口 → `cli/cmd` |
| `cli/cmd/` | Cobra CLI 子命令（`serve`、`notebook`、`block`、`search`、`sql`、`export`、`repo`、`sync`、……） |
| `model/` | **核心领域**（约 70 个文件）：块/树、事务、索引、搜索、属性视图、导出、历史、同步、记忆卡片、AI、CalDAV/CardDAV、认证 |
| `treenode/` | 基于 Lute AST 的内存树 + `blocktree.db`（`BlockTree{ID,RootID,ParentID,BoxID,Path,HPath,Type,...}`） |
| `av/` | **属性视图**（数据库）引擎：值、筛选、排序、布局（表格/看板/画廊） |
| `sql/` | **嵌入式 SQLite**（`siyuan.db`、`history.db`、`asset_content.db`）+ FTS5；异步索引队列 |
| `search/` | FTS 分词辅助、中日韩转换（`hanconv.go`） |
| `bazaar/` | 集市：插件/挂件/主题/图标/模板 |
| `filesys/` | 在磁盘上读写 `.sy` 文件（通过 `filelock`） |
| `server/` | Gin 服务器引导（`serve.go`）：中间件、TLS/cmux、WebDAV/CalDAV/CardDAV、WebSocket、MCP |
| `api/` | HTTP 路由注册（`router.go::ServeAPI`，约 400 个端点）+ 各区域处理器 |
| `conf/` | 配置结构体 |
| `util/` | 横切关注点：`working.go`（工作空间、`Boot()`）、`lute.go`、`i18n.go`、`websocket.go`（melody 推送）、`result.go`（API 信封） |
| `plugin/` | 插件子系统（内核侧） |
| `mcp/` | MCP（模型上下文协议）服务器 |
| `agent/` | **AI agent 运行时（上游与本地共享的模块，本地重点开发区域）** |
| `mobile/`、`harmony/` | `//go:build mobile` gomobile 绑定，用于 Android/iOS/HarmonyOS |

### 前端（`app/src/`）要点（上游）

| 目录 | 用途 |
|---|---|
| `index.ts` | 主 `App` 类 —— 启动 SPA、打开主 WebSocket、处理 WS 推送事件 |
| `window/` | 独立的 Electron 窗口变体 |
| `protyle/` | **块编辑器** —— `wysiwyg/`、`toolbar/`、`gutter/`、`breadcrumb/`、`hint/`、`scroll/`、`undo/`、`preview/`、`render/`（含 `render/av/`） |
| `editor/`、`layout/`、`menus/`、`dialog/`、`config/`、`mobile/`、`ai/`、`sync/`、`history/`、`search/`、`card/` | 功能模块 |
| `util/fetch.ts` | `fetchGet`/`fetchPost` —— 所有内核调用 |
| `layout/Model.ts` | 所有 UI 绑定的 WebSocket 客户端 |
| `constants.ts` | 全局常量（版本、ID、存储键） |

**webpack 产物（上游）：** 四个 webpack 配置各自向 `app/stage/build/{app,desktop,mobile,export}/` 输出独立 bundle，内核的 `serveAppearance` 依据 User-Agent 选择所服务的 bundle。`export` bundle 与其余三者不同：它不是应用 UI，而是客户端库（全局 `Protyle`，入口 `src/protyle/method.ts`），暴露代码高亮、数学公式（KaTeX）与图表（Mermaid/flowchart/graphviz/…）的渲染器，由导出流程组装的 HTML 页面加载（桌面 PDF 预览窗口与独立导出的 HTML 文件），使富内容在编辑器之外渲染。

**分叉前端扩展：** `app/src/agent/`（agent 聊天界面，本地独有）、`app/src/magi/`（多 AI 面板，本地独有）、`app/test/`（测试套件，见第 5 章）。

---

## 5. 提交检查与 Forge 运行时（本仓库特有）

### 提交门禁（`.githooks/`）

本仓库通过 `core.hooksPath` 指向 `.githooks/`，`git commit` 会执行 `app/scripts/forge-commit-runtime-gate.js`。**普通提交按暂存文件路径分流**：

- 含 `kernel/` 路径 → 跑 `go test -short -tags fts5 ./...`（Go 全量测试，short 模式）
- 其他路径（前端、文档等）→ **不触发任何测试**

`pre-commit` 门禁失败会**阻止提交**（另有 `git diff --cached --check` 空白检查）；`post-commit` 门禁失败**不阻止提交**，只记录到 `.forge-runtime/operations/`（Git 已创建提交，部署失败不能追溯性地使源验证失败）。

### push 门禁（`pre-push`）

普通提交跳过前端测试后，由 `pre-push` 钩子兜底：**推送时对即将推送的提交范围执行全量测试**，任一失败即阻止推送：

- 范围内含 `kernel/` 路径 → `go test -short -tags fts5 ./...`
- 范围内含前端运行路径（`app/src/`、`app/appearance/`、`app/test/`、`app/scripts/`、`.githooks/`、`app/package.json`、`app/pnpm-lock.yaml`、`app/webpack*`）→ 全量 `pnpm test`（= `test:node` + `test:vitest`，遍历 `src/` 与 `test/` 下全部 `*.test.*` / `*.spec.*` 文件，按 10 个一组、单 worker 串行跑完，任一组失败即门禁失败）

### post-commit 运行时交付

若提交包含内核运行时变更，则通过 Forge Supervisor **热替换内核**；前端变更不再以测试为门禁，仅记录 revision（`runFrontendUpdate` 返回 `tests: "skipped"`）。随后执行健康检查：Supervisor 就绪探测（连续 2 次成功）、内核探测、6 个页面 HTTP 200（`/`、`/stage/build/agent-app/`、`magi-desktop/`、`magi-mobile/`、`magi-identity/`、`protyle-app/`）。状态记录在 `.forge-runtime/commit-runtime-gate.json`。

### 测试边界

- `pnpm test` 是全量单元测试，但**不包含** `test:browser`（Playwright chromium 浏览器测试，需先构建 `protyle-app` / `agent-app`）与 `test:integration`（forge-runtime-supervisor 等集成测试）——两者需单独运行。
- GitHub CI **没有** PR 测试门禁：`cd.yml` 仅在发布 tag 时构建（含 `check:siyuan-types`），`siyuan-types.yml` 仅在改动特定文件时校验 types 包。未经过本机 hooks 的提交（如直接 push）在 CI 中不会运行任何测试。
- 测试设施：vitest 4（happy-dom）+ Playwright + `node:test`（tsx）+ 集成测试。

---

## 6. 不要手动编辑

- `app/stage/protyle/js/lute/lute.min.js`（由上游 `88250/lute` 或分叉 `leolee9086/lute` 构建）
- `app/stage/build/**`、`app/src/types/dist/**`
- `app/changelogs/**`（由独立工具生成）
- `app/kernel/SiYuan-Kernel*`、`*.syso`、`kernel/kernel.aar`
- `app/pandoc/*`
- `.forge-runtime/` 下的状态文件由提交门禁脚本维护，不要手动编辑

---

## 7. 项目特定规则

### 上游规则

1. **i18n：**
   - 新键放在每个 `langs/*.json` 对象的**顶部**；添加到所有语言文件（以 `en.json` 为参考）
   - `langs/*.json` 使用制表符缩进，每层嵌套一个制表符；不要用空格缩进
   - 例外：在 `_kernel` 对象内部，使用下一个递增的数字键将新条目追加到**末尾**
   - 每种语言都必须妥善翻译 —— 不要在所有语言文件中复制相同文本
   - 所有本地化字符串中的省略号使用三个 ASCII 句点（`...`）；不要使用 Unicode 省略号字符（`…` 或 `……`）
   - 设置描述提示字符串不得以句号或等价句末标点结尾（例如 `.`、`。` 或 `।`）
   - 域名：`ld246.com` 仅出现在 `zh-CN.json` 中；其他所有语言使用 `liuyun.io`
   - 在 `zh-TW` 本地化与繁体中文用户指南中，思源内容模型术语 Block 译为 `區塊`；不得缩写为 `塊`
   - 复合词中统一使用 `區塊`，例如 `內容區塊`、`子區塊`、`父區塊`、`嵌入區塊`、`程式碼區塊`、`區塊 ID`、`區塊標`、`區塊級`
   - Block Reference 译为 `區塊引用`，Blockquote 译为 `引述區塊`；不要混淆或颠倒词序
   - 统计内容块数量时用 `個區塊`，不要把 `塊` 用作量词或缩写
   - 不要把普通词语中的 `塊` 机械替换为 `區塊`；保留非内容块术语，如数据分块的 `分塊`、Checkbox 的 `覈取方塊`
   - 保持繁体中文界面与用户指南之间的区块术语一致
   - 修改 i18n 文件后，运行 `python scripts/check-lang-keys.py` 验证所有语言文件的键完整性
2. **跨平台脚本：**
   - 不要假设当前 shell 是 Bash、zsh 或 PowerShell。使用 shell 特有语法前先确认 shell；否则避免 `&&`、heredoc、`/dev/null` 等构造
   - 简单序列使用独立的命令调用并设置命令工作目录，而不是用 `cd` 与另一条命令串联
   - 多步逻辑编写并运行临时 Node.js 或 Python 脚本；在 Windows 上除非必要避免 PowerShell
   - 不要通过 shell 管道、PowerShell here-string、`python -c` 或 `node -e` 传递非 ASCII 文本；改为用文件编辑工具将文本写入 UTF-8 文件再消费该文件
3. **前端验证：** 不要使用 `npx webpack` 或 `pnpm dev` 验证改动；改动后运行 `cd app && pnpm run lint` 检查代码风格
4. **前端构建：** 不要运行 `pnpm build` —— 开发者会手动运行 `pnpm dev`，`pnpm build` 会与之冲突，产生损坏的构建产物
5. **内核开发：** 修改 Go 代码后，不要编译内核二进制或重启运行中的内核；两者都由开发者手动处理（本分叉由 Forge Supervisor 热替换，见第 5 章）
6. **图标：** 不要手写 SVG；尽可能使用 `app/appearance/icons/litheness/icon.js` 中已有的图标
   - 若无合适图标，从官方 [Lucide 图标库](https://lucide.dev/icons/) 选取，仅调整描边宽度等属性以匹配既有图标风格；保留上游路径数据
   - 向 `app/appearance/icons/litheness/icon.js` 添加图标时，同一次变更在 `app/appearance/icons/index.html` 中添加预览条目并保持顺序一致
7. **用户指南：** 编辑用户指南时，遵循 `docs/SY-FORMAT.md`
   - 功能新增或更改快捷键时，同一次变更更新用户指南中的快捷键文档；若不确定应放置的小节，询问用户
   - 应用内 UI 导航路径用分段 `kbd` 文本标记表示：每个导航层级使用一个 `TextMarkType: "kbd"` 的 `NodeTextMark`，相邻层级之间放置一个包含 ` - ` 的纯 `NodeText`
   - `kbd` 路径嵌入正文时，两侧紧邻普通文本时路径外侧恰好各留一个 ASCII 空格；块的开头或结尾不加外层空格
   - 第一个 `kbd` 紧跟全角标点（例如 `，` 或 `、`）时省略左侧外层空格；此规则适用于包括中文和日文在内的所有语言，但不适用于半角标点
   - `kbd` 后紧跟标点（无论全角或半角）时省略右侧外层空格；分段 UI 路径内部的 ` - ` 分隔符保持不变
8. **Git：**
   - **绝不**运行 `git commit` / `git push`，除非被明确要求 —— 没有例外
   - 被明确要求提交时，遵循最近提交的风格（gitmoji 前缀 + 英文主题）
   - 仅当存在相关 issue 时，在提交标题末尾追加完整 issue/PR URL（可点击的完整 URL，不要用 `#NNN` 短形式）；绝不要把 URL 放在提交正文中，也不要编造 URL
9. **GitHub：** 所有 GitHub 操作优先使用 GitHub CLI（`gh`），包括读取 issue、评论、PR、提交、状态与元数据。如果 `gh` 不可用或不支持该操作，则回退到 GitHub API 或网页界面
   - 创建 issue 时使用英文标题和中文正文，正文首段为对应的中文标题；不要使用仓库的 issue 模板或复刻其表单字段，直接撰写简洁、针对任务的正文
   - 当所选端点支持标签时，可在同一创建或更新载荷中包含标签。之后只需验证 issue 或 PR 本身成功（编号、标题与正文）；无需检查标签是否生效，也不要仅为打标签再发一次请求 —— 操作者缺少推送权限时 GitHub 会静默丢弃标签变更
   - 对于包含非 ASCII 文本的 GitHub 写操作，或在 Windows 上/shell 编码不确定时，使用以下基于文件的流程；纯 ASCII 请求不适用：
     1. 用文件编辑工具（而非内联 shell 命令）将请求载荷创建为 UTF-8 JSON
     2. 以唯一名称（如 `siyuan-gh-<operation>-<timestamp>.json`）存放在操作系统临时目录；不得把临时载荷留在仓库内
     3. 用 `gh api --method <method> "<endpoint>" --input "<absolute-json-path>"` 调用相应端点
     4. 检查返回资源并用 `gh api` 读回，逐字核对已发布文本（含换行与非 ASCII 字符）
     5. 删除临时 JSON 文件并确认其不存在
   - issue 评论示例：将 `{"body":"<评论内容>"}` 写入 UTF-8 JSON 文件，运行 `gh api --method POST "repos/{owner}/{repo}/issues/<number>/comments" --input "<absolute-json-path>"`，按 `id` 读回返回的评论后再删除文件
10. **Issue 标题：** 无论用户以何种语言提出，凡是要求生成 issue 标题，一律提供英文；不要以 `Fix` 开头。这些规则根据 issue 性质选择标题措辞，不是要求打 GitHub 标签
    - Bug：客观描述问题或症状，而不是以修复视角撰写
    - 对现有功能的改进：从改进视角撰写，优先 `Improve ...`
    - 此前不存在的能力：从支持视角撰写，优先 `Support ...`
    - 性质不明时，从 issue 内容推断视角
11. **LD246：** 访问 `ld246.com` 时，将 HTTP `User-Agent` 头设置为 `SiYuan-Coding-Agent`
12. **可配置项：**
    - 将可配置桌面菜单项的 `data-id` 与可配置停靠栏条目的 `data-type` 视为持久化配置标识。除非同一变更为既有可见性与顺序配置做迁移，否则不得重命名或复用
    - 新增、删除、重命名、移动可配置桌面菜单项或停靠栏条目，或更改其 `data-id` / `data-type` 时，同一变更中更新 `app/src/config/entryVisibility/catalog.ts`（含类型、层级、标签、Simple 配置默认值与默认位置）并更新相关测试
    - 为每个可配置桌面菜单分隔线提供稳定 `data-id`，并在目录中以 `separator` 注册。目录顺序须与实际菜单声明顺序一致，因为它定义了内置顺序以及新条目并入既有自定义配置的位置
    - 保持父子路径与实际菜单层级一致。停靠栏条目仅支持可见性配置，不参与排序
    - 相关测试须覆盖目录一致性、分隔线位置、顺序迁移与插件槽位保留。配置后的菜单不得出现开头、结尾或连续分隔线
    - 菜单的 `ignore` 选项控制条件渲染，不得用于让条目退出可见性或顺序配置

### 分叉特有规则

1. **不向本仓库发 PR**（自用修改版，见 `docs/SFORGE.md`）；不要假设上游功能在本仓库可用
2. **upstream-sync 移植提交**须带 `Upstream-Commit` / `Upstream-Series` / `Upstream-Disposition` 标记，并在 `docs/upstream-sync/` 记录审计证据
3. **提交信息风格**：本分支使用 conventional commits 前缀（`feat` / `fix` / `refactor` / `docs` / `chore` / `merge` / `tools` 等）
4. **AGENTS.md 以中文为主**；英文原版（上游原文）保留在 `AGENTS.en.md`

---

## 8. 编码规范

### 上游规范

1. **注释：** 代码注释每行不超过 120 个字符
2. **注释：** 描述代码做什么，而不是它替换了什么 —— 不要在注释中引用旧实现
3. **注释：** 用中文写注释
4. **标点：** 使用与语言相配的标点（例如中文用中文标点 ，。：；！？「」，不要用 ASCII）；不要在代码中硬编码标点 —— 放入 i18n 语言文件，让每种语言环境渲染自己的标点。适用于注释、用户指南、`.md` 文档等
5. **UI 路径：** 在所有语境（代码注释、UI 文本、i18n、用户指南、文档、issue/PR 内容及回复）中，导航层级之间用前后带空格的连字符分隔（例如 `设置 - 快捷键 - 通用`）；不要使用 `→` 等箭头符号
6. **Markdown：** 不要手动换行；每一行（段落、表格行、列表项等）保持单行
7. **TypeScript/JavaScript：** 必须使用分号，使用双引号，用空格缩进
8. **CSS：** 因性能影响，不要使用 `:has()` 选择器
9. **Go：** 编辑后用 `gofmt` 格式化

### 分叉补充

- 允许中文变量名；允许较冗长的注释（个人习惯，便于维护者理解）
- TypeScript 使用严格模式；涉及 UI 路由边界时优先走 CaliburRouter（Zod 校验）

---

## 9. 回复风格

1. **语言：** 与用户语言保持一致；不要在句中途混用语言（专有名词 / 标识符保持原样）
