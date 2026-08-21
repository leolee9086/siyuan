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
| `siyuan-testing` | Playwright 端到端测试；测试数据属于 `SiYuan Testing` 笔记本 |
| `petal` | SiYuan 插件 API 声明（插件系统名为 "petal"）；供插件使用，不是内核的 Go 依赖 |
| `lute` | Markdown/Kramdown AST 引擎 —— 编辑器 + `.sy` 格式的来源。**本分叉改用 `leolee9086/lute` fork**（见下） |
| `dejavu` | 数据仓库 / 同步引擎（加密快照） |
| `riff` | 间隔重复（SRS）记忆卡片调度器 |
| `gulu` | 通用 Go 工具库（`gulu.Ret`、`gulu.JSON`、……） |
| `eventbus` | 进程内事件总线 |
| `filelock` | 跨平台文件锁（`.sy` 读写） |
| `httpclient` | HTTP 客户端封装（云端 / 同步 / 集市调用） |
| `logging` | 内核各处使用的分级日志 |
| `go-sqlite3` / `pdfcpu` | 维护者的 fork，通过 `kernel/go.mod` 中的永久 `replace` 引入（请保留） |
| `epub` / `clipboard` / `go-humanize` / `vitess-sqlparser` / `dataparser` / `encryption` | 较小的 Go 库（导出 / 剪贴板 / 格式化 / SQL 解析 / 数据解析 / 加密） |

### 分叉特有的依赖

| 仓库 / 路径 | 说明 |
|---|---|
| `leolee9086/lute` | 分叉的 Markdown 引擎 fork，通过 `kernel/go.mod` 的 `replace` 替换 `88250/lute`；本地检出位置见 `docs/SFORGE.md` |
| `packages/`、`kernelSDKTS/`、`extensions/` | 仓库内的本地包与个人插件（以 `link:` 方式依赖，非 Go 模块） |

### 跨仓库注意事项（上游）

- **修改任何 Go 依赖（Lute / dejavu / gulu / eventbus / riff / filelock / httpclient / logging / go-sqlite3 / pdfcpu / epub / ……）：** 这些依赖由内核以 Go 模块方式引入（`kernel/go.mod`）。要测试本地修改，可在 `kernel/go.mod` 中添加临时 `replace` 指向你的本地检出 —— 但**切勿提交该 `replace`**，它会破坏其他人的构建。
- **重新构建 `lute.min.js`：** 它是 Go 项目 `lute` 的 JS 构建产物 —— 在上游生成并检入 `app/stage/protyle/js/lute/`。不要在这里编辑它；修改 `lute`（本分叉为 `leolee9086/lute`）、重新构建后把产物复制进来。
- **移动端应用（`siyuan-android` / `siyuan-ios` / `siyuan-harmony`）：** 每个都是独立的原生应用，封装本仓库构建的内核。构建步骤见各项目自己的 README。
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
   - 例外：在 `_kernel` 对象内部，使用下一个递增的数字键将新条目追加到**末尾**
   - 每种语言都必须妥善翻译 —— 不要在所有语言文件中复制相同文本
   - 所有本地化字符串中的省略号使用三个 ASCII 句点（`...`）；不要使用 Unicode 省略号字符（`…` 或 `……`）
   - 域名：`ld246.com` 仅出现在 `zh-CN.json` 中；其他所有语言使用 `liuyun.io`
   - 修改 i18n 文件后，运行 `python scripts/check-lang-keys.py` 验证所有语言文件的键完整性
2. **Windows 脚本：** 优先使用 Node.js / Python；除非必要，避免使用 PowerShell
3. **前端验证：** 不要使用 `npx webpack` 或 `pnpm dev` 验证改动；改动后运行 `cd app && pnpm run lint` 检查代码风格
4. **前端构建：** 不要运行 `pnpm build` —— 开发者会手动运行 `pnpm dev`，`pnpm build` 会与之冲突，产生损坏的构建产物
5. **内核开发：** 修改 Go 代码后，不要编译内核二进制或重启运行中的内核；两者都由开发者手动处理（本分叉由 Forge Supervisor 热替换，见第 5 章）
6. **图标：** 不要手写 SVG；尽可能使用 `app/appearance/icons/litheness/icon.js` 中已有的图标
7. **用户指南：** 编辑用户指南时，遵循 `docs/SY-FORMAT.md`
8. **Git：**
   - **绝不**运行 `git commit` / `git push`，除非被明确要求 —— 没有例外
   - 提交时，遵循最近提交的风格
   - 仅当存在相关 issue 时，在提交标题末尾追加完整 issue/PR URL（可点击的完整 URL，不要用 `#NNN` 短形式）；绝不要把 URL 放在提交正文中，也不要编造 URL
9. **GitHub：** 所有 GitHub 操作优先使用 GitHub CLI（`gh`）。如果 `gh` 不可用或不支持该操作，则回退到 GitHub API 或网页界面
10. **Issue 标题：** 无论用户以何种语言提出，凡是要求生成 issue 标题，一律提供英文；不要以 `Fix` 开头，直接描述观察到的行为
11. **LD246：** 访问 `ld246.com` 时，将 HTTP `User-Agent` 头设置为 `SiYuan-Coding-Agent`

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
5. **Markdown：** 不要手动换行；每一行（段落、表格行、列表项等）保持单行
6. **TypeScript/JavaScript：** 必须使用分号，使用双引号，用空格缩进
7. **Go：** 编辑后用 `gofmt` 格式化

### 分叉补充

- 允许中文变量名；允许较冗长的注释（个人习惯，便于维护者理解）
- TypeScript 使用严格模式；涉及 UI 路由边界时优先走 CaliburRouter（Zod 校验）

---

## 9. 回复风格

1. **语言：** 与用户语言保持一致；不要在句中途混用语言（专有名词 / 标识符保持原样）
