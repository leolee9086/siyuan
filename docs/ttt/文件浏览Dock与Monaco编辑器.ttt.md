# S-Forge 文件浏览 Dock 与 Monaco 编辑器 (TikTocTak)

> **目标**: 在 S-Forge 中实现一个可独立使用的文件浏览 Dock，默认浏览当前工作空间的全部文件，并聚合展示所有已绑定 Agent 任务目录的位置与内容；浏览、标签、颜色检索、预览、文件操作和编辑能力以 `D:\dev\SACAssetsManager` 的最完备历史实现为功能基线，并完整覆盖 `Zuoqiu-Yingyi/siyuan-plugin-monaco-editor` 的文件资源管理器与编辑器功能。
>
> **流程**: 先审计参考仓库和 S-Forge 现有能力，冻结领域契约；随后按可独立使用的里程碑逐步交付，每个里程碑完成聚焦验证后再推进。完成项和短期子 TTT 在成果回写后移动到归档区，保留审计轨迹，不删除。

## 参考基线

| 参考 | 当前证据基线 | 用途 |
| --- | --- | --- |
| S-Forge | `multipleAI`，工作树起点 `git status --short --branch` 为干净且领先远端 16 个提交 | 复用既有 Dock、工作空间、任务目录、页签、文件树和资源元数据能力 |
| SACAssetsManager | 完整参考检出 `D:\dev\SACAssetsManager-02e3b4d47aa4414bd397a94d7daa1747a3cb45e6`，共 951 个提交；detached 工作树为 `02e3b4d4`，`master/origin/master` 为 `94c8534a` | 审计最完备的浏览、遍历、缩略图、标签、颜色、筛选、选择、拖放、菜单和文件操作语义 |
| siyuan-plugin-monaco-editor | `edce237dab4ef807be3b8647087543bcb87d1ca7`，`D:\dev\.references\siyuan-plugin-monaco-editor` 共 1521 个提交 | 审计文件资源管理器、块/历史/快照/收集箱/代码片段/网络文件编辑、Vditor、差异查看和设置功能 |

## 复用边界

- Dock 组合根复用 `app/src/layout/dock/dock.factory.ts`、`dock.init.ts`、`dock.button.ts`、`dock.guard.ts` 和 `Dock` 布局模型；文件树既有 `Files` 领域保持稳定，不复制一套 Dock 生命周期。
- 工作空间路径复用 `kernel/util.WorkspaceDir`、`DataDir`、路径规范化和 `filelock` 原子文件能力；所有新 API 使用现有 API 包络、鉴权和路由注册方式。
- Agent 目录复用 `kernel/agent/session.go` 的 workspace-owned capability store、权限枚举、会话锁和路径校验；浏览器只消费已解析 capability，不接受客户端伪造绝对根路径。
- 标签和颜色复用 `kernel/assetmeta` 的 JSON 主数据、SQLite 索引、调色板提取和前端 `app/src/asset` 类型/API；高级检索扩展既有索引，不引入第二套元数据源。
- 文件打开复用现有页签/编辑器入口和 `platform/localPath` 能力；Monaco 适配层只负责编辑模型与 UI，不绕过后端路径授权。
- 不保留临时双协议、旧 API 转发层或仅为开发轨迹留下的兼容副本；迁移完成后删除未使用的适配代码和实验入口。

## 里程碑与可用版本

### M0：审计与契约冻结（当前进行中）

- 产出两套参考历史功能矩阵，标出证据提交、最完备实现文件、S-Forge 复用点和缺口。
- 冻结 `FileRoot`、`FileEntry`、`FileQuery`、`FileOperation`、`FileEditorDocument` 和错误包络契约。
- 验收：契约测试可在无 UI 环境运行；每个后续功能都有唯一 owner 和 API 入口；没有新增临时兼容层。

### M1：只读文件根与树（可用版 1）

- 默认根为工作空间根；额外根为全部会话中仍存在的 Agent 绑定目录，返回稳定 root ID、显示名、绝对位置、权限和会话来源。
- 支持目录展开、分页/流式子项、面包屑、刷新、文件统计、文本/图片/PDF/音视频/D5A 等已有预览入口和双击打开。
- 验收：工作空间和至少两个绑定目录可同时浏览；路径遍历、越权根和失效 capability 被拒绝；重启后根集合可恢复。

**当前事实（部分实现）**：根聚合、节点级懒加载树源码、单层分页列表、只读内容接口和有界并发递归遍历已进入工作区。此前以 S-Forge 自身 `filepath.Walk` 为基线的性能结论已撤回；SACAssetsManager 最终 `fdirModified`、`fast-glob`、stock `fdir` 和常见 Go walker 已接入独立小规模校验工具，但完整 `D:\` 验收和目录遍历边界矩阵仍未完成。文件树已拆出独立 `FileBrowserTree.vue`，真实 DOM 挂载测试证明工作空间/Agent 根、递归层级、懒加载、折叠和目录双击打开 `sforge-file-gallery` 页签；真实瀑布流挂载测试证明查询范围、`VirtualMasonryGrid`/`AssetCard` 卡片投影、共享选择和文件打开端口。这里的结构是“侧边栏树 Dock + 独立文件标签 Dock + 独立瀑布流 Tab”，标签树不再嵌入任务文件树，树 Dock 不渲染查询结果卡片。扩展名筛选、颜色/RGB/HSL/调色板查询、卡片尺寸和属性列投影已经接线并有挂载测试；面包屑、递归开关和子目录包含选择已接入 `listDirectory` 与后端范围查询。目录画廊筛选状态已按 `SACAssetsManager-02e3b4d47aa4414bd397a94d7daa1747a3cb45e6@94c8534a` 对齐：空扩展名显示占位而不伪装成 `.bmp`；带路径页签忽略历史 query，全根结果清空保留范围但清空扩展名/标签/颜色，当前查询与初始页签 query 分离，刷新不再恢复旧 `.tmp`；无标签/颜色/尺寸/星级门槛的默认查询通过 `filebrowser.ScanContext` 枚举授权根中的未索引文件，标签/调色板等元数据门槛继续走 `assetmeta`，证据见 `标签结果打开与颜色检索.shorterm.ttt.md`。桌面运行界面、TabRegistry 真实布局恢复、实际根媒体加载和大结果滚动仍缺证据，因此 M1 保持未完成。参考画廊的表格模式、框选多选、拖放批处理、外部索引入口和完整目录操作仍待实现。文件属性 Dock 已接入共享选择端口、批量属性、星级、注释、图片轮播、聚合/逐文件标签和标签树；SAC 标签删除/拖放/Ctrl 笔记搜索、来源入口和完整目录动作仍待实现。

### M2：完整浏览与检索（可用版 2）

- 支持列表/网格/瀑布流/表格视图、排序、扩展名过滤、关键词和递归搜索、空结果/错误/取消状态、键盘多选和框选。
- 接入标签树、标签面包屑、标签编辑、星级/注释和标签颜色；支持按 RGB/HSL/调色板相似度检索，结果可跨工作空间和 Agent 根聚合。
- 验收：SACAssetsManager 历史矩阵中的浏览与检索条目逐项有测试证据；颜色查询实际命中索引而非仅前端过滤。

**当前切片（进行中）**：已确认资源管理的组合边界为“文件树 Dock + 独立文件标签 Dock + 独立资源瀑布流页签”，树 Dock 不再承载查询结果，标签 Dock 复用标签树/计数/颜色模型并通过共享页签入口打开结果。扩展名筛选、颜色/RGB/HSL/调色板查询、卡片尺寸和属性列投影、面包屑子目录控制已接入 s-forge 现有 `VirtualMasonryGrid`/`AssetCard` 和真实后端查询；空筛选生命周期已完成为当前查询状态与初始页签数据分离，默认无元数据筛选使用授权 `filebrowser` 遍历覆盖未索引文件；框选多选、拖放批处理、表格模式和外部索引入口仍未完成。

> **状态修正（2026-08-08）**：上面的切片快照保留历史原文；表格模式已实现首个可用切片，复用列表虚拟化引擎并覆盖预览、名称、路径、标签、尺寸、大小、类型列。框选多选、拖放批处理、完整列配置和外部索引入口仍属于后续切片。

### M3：文件操作与增量同步（可用版 3）

> 基础操作切片已完成并归档：[`archive/文件操作基础切片.shorterm.ttt.md`](archive/文件操作基础切片.shorterm.ttt.md)。移动和删除切片已完成；批量操作、拖放批处理、监听增量更新和下载/打包仍属于本里程碑后续切片。

- 支持新建、重命名、移动、复制、删除、批量操作、拖放上传/移动、下载/打包、剪贴板路径、外部打开和撤销/失败回滚提示。
- 按 root capability 权限控制读写/命令操作，接入文件监听、增量索引、缩略图缓存和取消任务；只读目录不显示或不执行写操作。
- 验收：原子写入、同名冲突、跨根操作、断点取消和权限错误均有后端测试；前端能正确反映监听变更。

### M4：Monaco 文件查看与编辑（可用版 4）

- 覆盖参考插件资源管理器菜单、拖放移动、批量上传、外拖下载、文件/目录操作、编辑器页签、预览页签和设置。
- 覆盖本地工作空间/Agent 文件、网络文件、代码片段、收集箱、文件历史、文档历史和快照的查看/差异/可写语义；支持编码选择、语言识别、Markdown/Kramdown、Vditor、自动保存、Ctrl+S、Alt+Z、编辑方案、资源上传和 KaTeX/补全能力。
- 所有引用 Monaco Editor 或参考插件结构的代码在产品文档和源码致谢中标注来源、版本、许可证和链接；不得复制参考仓库的无关兼容代码。
- 验收：每个功能映射到一个可执行测试或交互证据；只读内容不能出现保存入口；并发修改、保存失败和超大文件状态可见。

### M5：收口与性能（可用版 5）

- 完成跨 Dock/页签/AgentChat/资源对话框的一致打开与刷新；建立大目录分页、取消、虚拟化、缩略图和索引性能基线。
- 删除实验代码、重复类型、死入口和临时兼容层；补齐文档、致谢、语言键和迁移说明。
- 验收：聚焦 Go/Vitest/浏览器交互测试通过；前端只记录 P0 及以下本次新增问题，既有 P1+ lint 债务单独登记。

## 🟢 近期计划

- [ ] **M0.1：完成 SACAssetsManager 功能历史审计**（见 [`SACAssetsManager功能历史审计.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/SACAssetsManager功能历史审计.shorterm.ttt.md)）
- [ ] **M0.2：完成 Monaco 插件功能、许可证和致谢审计**（见 [`Monaco编辑器功能覆盖审计.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/Monaco编辑器功能覆盖审计.shorterm.ttt.md)）
- [ ] **M0.3：冻结文件根、查询、操作和编辑文档契约**（见 [`文件根目录与后端能力.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/文件根目录与后端能力.shorterm.ttt.md)）
- [ ] **M0.4：统一后端递归遍历抽象与 Agent 调用方**（见 [`后端文件系统遍历统一抽象.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/后端文件系统遍历统一抽象.shorterm.ttt.md)）
- [ ] **M0.4.1：冻结并守恒 `gulu.File.Grep` 业务行为**（见 [`gulu.File.Grep行为守恒.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/gulu.File.Grep行为守恒.shorterm.ttt.md)）
- [x] **M0.4.2：Windows UAC 真实 symbolic-link 与 pnpm junction 验收**（见 [`Windows symbolic-link UAC验收.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/Windows%20symbolic-link%20UAC验收.shorterm.ttt.md)）
- [ ] **M0.5：冻结并实现共享选择与文件属性 Dock**（见 [`文件属性Dock.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/文件属性Dock.shorterm.ttt.md)）
- [x] **M0.6：图片预览与缩略图适配**（已归档：[`archive/图片预览与缩略图适配.shorterm.ttt.md`](archive/图片预览与缩略图适配.shorterm.ttt.md)）

## 🟡 中期计划

- [ ] **M1：只读根与文件树 Dock**（见 [`文件浏览Dock前端.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/文件浏览Dock前端.shorterm.ttt.md)）
- [ ] **M1.1：文件树组合与交互修正**（见 [`文件树修正.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/文件树修正.shorterm.ttt.md)）
- [ ] **M2：浏览模式、标签和颜色检索**
- [~] **M3：受控文件操作、监听和索引增量更新**（移动/删除切片已完成，批量与监听增量仍待实现）
- [ ] **M4：Monaco 文件编辑与预览**（见 [`Monaco文件编辑与预览.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/Monaco文件编辑与预览.shorterm.ttt.md)）

### M4.1 当前切片

- [~] 本地文本文件读写契约已冻结，见 [`Monaco文件读写契约.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/Monaco文件读写契约.shorterm.ttt.md)；当前先落深层 `fswalk` 和 Kernel API，尚未宣称 Monaco UI 完成。

### M0.5 当前切片证据

- 已完成：共享 `{rootID, path}` 多选、批量属性读取/逐项错误、属性 Dock 注册/恢复/独立销毁、星级/注释/图片轮播、聚合/逐文件标签、批量/逐文件标签修改、标签颜色定义与确定性回退色。
- 证据：`pnpm exec vitest --run test/sforge/fileBrowser`（21 个文件、60 个用例）；`pnpm run typecheck:protyle-contract` 通过；目标文件 `vue-tsc` 诊断 0；`go test ./assetmeta ./filequery ./api -count=1` 和 `git diff --check` 通过；本次新增/修改文件 P0 逻辑/类型错误 0。
- 保持未完成：桌面布局持久化重启/截图验收、真实媒体加载、SAC 标签删除/拖放/Ctrl 笔记搜索、框选/拖放批处理、表格模式、目录动作、所在笔记/来源和外部根图片调色板提取。
- 标签树和标签结果查询已有源码接线与挂载测试；授权响应、颜色查询边界和桌面验收继续由 [`标签结果打开与颜色检索.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/标签结果打开与颜色检索.shorterm.ttt.md) 追踪。

## 🔴 远期计划

- [ ] **M5：大规模目录、跨界面一致性和发布级验证**（见 [`验证与交互验收.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/验证与交互验收.shorterm.ttt.md)）

## 2026-08-08 筛选条件为空回归证据

- [x] 修正旧目录页签把筛选条件持久化到 `file.query` 的迁移问题：带路径页签启动时移除历史 query，空表单不再恢复 `.tmp`、关键词、标签或颜色。
- [x] 全根结果页签只保存打开入口的稳定来源（根、标签、调色板）；关键词、扩展名、尺寸、星级和分页属于组件运行期状态，空查询只保留 `allRoots` 和排序，不会把旧 `.tmp` 写回页签。
- [x] 为页签增加稳定的 `scope` 标记，筛选条件变化不会把全根结果误判为目录页签；目录范围变化通过组件 key 强制重建空筛选表单。
- [x] 扩展名菜单保留当前查询中的扩展名，即使当前结果为空也能直接取消该条件。
- [x] 规范化空数组/空字符串请求，并保留全根范围语义；目录页签仍只使用 root/path，标签结果仍可携带显式全根 query。
- [x] 证据：`pnpm exec vitest --run test/sforge/fileBrowser/FileBrowserGalleryTab.interaction.test.ts test/sforge/fileBrowser/FileBrowserSearchPanel.interaction.test.ts test/sforge/fileBrowser/FileBrowserPanel.interaction.test.ts test/sforge/fileBrowser/FileTagTreeDock.interaction.test.ts`（4 个文件、11 个用例）；`pnpm run typecheck:protyle-contract`；目标文件 `vue-tsc` 筛选诊断无新增输出；`git diff --check` 通过。
- [x] `pnpm run dev:once` 的 app、desktop、mobile、magi、protyle 和 agent 构建目标全部成功，`FileBrowserPanel.scss` 不再触发 `Unknown word //`。
- [ ] 完整文件浏览测试和桌面真实布局验收仍按 M1/M2 条目追踪；当前仍不把聚焦挂载测试等同于桌面验收。

## 2026-08-08 运行期筛选与缺省元数据回归

- [x] 修正全根页签筛选归属：提交/清空/刷新只更新组件当前查询，不再把 `.tmp`、关键词或新扩展名写入 `file.query`；销毁并重建页签后扩展名控件仍为空。
- [x] 保留标签结果页的稳定标签来源；清空时运行期标签和扩展名被移除，重新打开仍按标签入口范围查询，不把历史扩展名带回。
- [x] `FileBrowser.query.guards.ts` 接受 Go `omitempty` 省略的 `width`、`height`、`fileSize`，归一化为 `0`；非法非数值仍拒绝，调色板逐项收窄。
- [x] 回归证据：`pnpm exec vitest --run test/sforge/fileBrowser`（21 个文件、60 个用例）；`pnpm run typecheck:protyle-contract`；目标 `vue-tsc` 诊断 0；`git diff --check`。
- [ ] Git 提交门禁和桌面真实窗口验收按用户要求暂不处理；完整大目录媒体验收仍属于 M1/M2 未完成项。

## 2026-08-08 扩展名筛选刷新回归

- [x] 修正扩展名菜单变更未进入查询请求的链路：按参考画廊增加 300ms 防抖自动提交，手动提交/清空/销毁取消待执行刷新。
- [x] 保持领域职责分离：前端只构造 `exts` 查询契约，后端继续由 `filequery` 统一枚举并过滤，未新增前端卡片二次过滤。
- [x] 证据：`FileBrowserSearchPanel.interaction.test.ts`、`FileBrowserGalleryTab.interaction.test.ts` 共 13 个用例通过；此前 `pnpm exec vitest --run test/sforge/fileBrowser` 的全量回归需在本轮改动后重新执行。
- [ ] 桌面真实窗口的扩展名结果纯度和快速连续选择竞态仍待验收。

## 2026-08-08 文件根父子归并回归（已完成切片）

- [x] 发现工作空间 `D:\\dev` 与 Agent 子目录被作为两个顶层根重复加载；已冻结并实现“最小祖先顶层 + 子根挂载元数据 + 原 root ID 别名解析”语义。
- [x] 后端完成物理路径父子归并、能力范围守恒和全根查询去重，证据由 [`archive/文件根父子归并.shorterm.ttt.md`](archive/文件根父子归并.shorterm.ttt.md) 维护。
- [x] 前端树只显示一套父子目录状态，并保留绑定来源和位置提示；21 个文件、65 个用例通过。

## 2026-08-08 图片预览与缩略图适配（已完成切片）

- [x] 对齐 `SACAssetsManager` 的路径编码与图片服务契约：资源 URL 解析区分根相对、相对资产、`file:` 和远程地址；缩略图 MIME 按实际字节返回。
- [x] 修复根相对文件浏览 URL 被 `baseURL` 二次拼接导致加载应用壳 `text/plain` 的问题；图片、音视频资源共用解析入口。
- [x] 证据：真实 6806 原图请求返回 `200 / image/png / 276560 bytes`；真实路径包含中文、空格和嵌套目录的 Go HTTP fixture 通过；Go 缩略图/API/文件根/查询测试、前端 22 个文件浏览相关文件共 68 个用例、URL 回归、类型检查和 `dev:once` 构建通过。
- [x] 子 TTT 已移动到 [`archive/图片预览与缩略图适配.shorterm.ttt.md`](archive/图片预览与缩略图适配.shorterm.ttt.md)，保留完整证据。

## 2026-08-08 图片地址适配补强

- [x] 修正 `Asset` 图片分支仍把原始路径传给渲染器的问题；图片、音视频现在统一使用解析后的地址，避免根相对文件浏览 API 被再次拼接到 `baseURL`。
- [x] 文件预览页签、文件属性 Dock 和 `AssetCard` 缩略图统一经过 `resolveAssetURL`；相对 `<base href>`、根相对 `/api/...`、传统相对资源、`file:`/远程地址均有明确语义。
- [x] 增加 Windows 盘符、UNC 和 `\\?\\` 扩展路径转换为合法 `file:` URL 的边界测试；普通路径中的空格按 URL 组件编码。
- [x] 当前证据：`pnpm exec vitest --run test/asset/assetUrl.test.ts test/sforge/fileBrowser/FileBrowser.open.test.ts test/sforge/fileBrowser/FileBrowserGalleryTab.interaction.test.ts test/sforge/fileBrowser/FilePropertiesPanel.interaction.test.ts`（4 个文件、16 个用例）；`go test ./thumbnail ./api ./filebrowser ./filequery -count=1`；目标文件 `lint:file`；`pnpm run typecheck:protyle-contract`；`git diff --check`。
- [x] 6806 运行页签已完成真实复核：展开 `D:\\dev\\.artifacts\\passive-income\\guide-render` 后双击 `page-2.png`，图片元素实际请求 `/api/s-forge/file-browser/content/root-ebc8c460379294ef/.artifacts/passive-income/guide-render/page-2.png`，返回 `200` 图片响应，`complete=true`、`naturalWidth=1241`、`naturalHeight=1754`；现场截图中不再显示破图。本轮未重启运行中的 Kernel。
- [x] 同一目录的资源画廊已完成现场复核：画廊显示 `已加载 3 / 3 个文件`，`AssetCard` 缩略图实际请求 `/api/s-forge/file-browser/thumbnail?...page-1.png&size=360`，图片 `complete=true`、`naturalWidth=543`，说明缩略图入口也使用同源 API 地址。
- [x] 本轮全量文件浏览回归：`pnpm exec vitest --run test/sforge/fileBrowser`（21 个文件、66 个用例）；图片 URL 边界测试另通过 `test/asset/assetUrl.test.ts`（4 个用例）。

## 2026-08-08 查询错误可诊断性与遍历性能证据

- [x] 将查询响应守卫错误拆为包络级和条目级：包络指出 `data.assets/totalCount/pageCount`，条目指出索引、相对路径、字段和实际类型；保留严格拒绝，不以放宽校验掩盖协议漂移。
- [x] 真实本地目录响应验证通过：`root-ebc8c460379294ef/旧文件/新建文件夹` 返回 `200/674/4`（当前页/总数/页数），前端守卫解析通过。
- [x] 诊断改动未增加成功热路径的错误字符串分配；调色板和可选字段校验使用定长循环。解析 200 条真实条目约 `0.6-0.9ms`。
- [x] Windows 小规模遍历基线：原生批量目录快照 `4.93ms` 对逐项 `Lstat` `78.33ms`；原生并行递归 `23.02ms` 对 `filepath.Walk` `225.73ms`。该证据仅用于回归趋势，完整 D 盘验收仍未完成。
- [x] `pnpm run dev:once` 已重新生成 app/desktop/mobile/magi/protyle/agent 目标，SCSS 通过，错误诊断代码已进入实际桌面 bundle。
- [ ] 运行时若仍出现错误，应依据新消息中的 `data.assets[index] (path)` 和字段类型继续定位；当前不把附件首批合法响应误判为后端包络错误。

## 2026-08-08 图片地址与失败回退补强

- [x] `resolveAssetURL` 已统一文件浏览原图、缩略图、资源卡片、文件预览、属性 Dock 和图片编辑器的地址语义；根相对 `/api/...` 不再被 `baseURL` 二次拼接，传统相对资产、`file:`、UNC 和远程 URL 保持独立处理。
- [x] 对齐 `SACAssetsManager` 的透明像素占位策略：图片卡片加载期间保持稳定高度，加载失败后切换透明像素和图片图标；表格行、预览页签、属性 Dock 和编辑器不再暴露浏览器原生破图标。
- [x] 真实 6806 复核（未重启当前 Kernel）：`D:\\dev\\.artifacts\\passive-income\\guide-render\\page-2.png` 原图请求为 `200/image/png`，`naturalWidth=1241`、`naturalHeight=1754`；同目录画廊缩略图为 `naturalWidth=543`。失败回退和 URL 边界由 Vitest 覆盖。
- [x] `pnpm exec vitest --run test/sforge/fileBrowser`：22 个文件、68 个用例；图片专项 4 个文件、9 个用例；`pnpm run typecheck:protyle-contract`、`pnpm run dev:once`、`go test ./thumbnail ./api ./filebrowser ./filequery -count=1` 和 `git diff --check` 通过。
- [ ] 当前运行中的 6806 页签已重载并复核成功原图，但尚未在真实页签触发故障 URL 回退；仍需补采失败地址的 UI 回退状态，不能把单元测试代替桌面验收。

## 2026-08-08 用户截图现场复核

- [x] 在当前 6806 运行页签按截图路径展开 `D:\\dev\\.artifacts\\passive-income\\guide-render` 并双击 `page-2.png`，确认 `img.currentSrc` 为 `/api/s-forge/file-browser/content/root-ebc8c460379294ef/.artifacts/passive-income/guide-render/page-2.png`。
- [x] 现场 DOM 证据：图片 `complete=true`、`naturalWidth=1241`、`naturalHeight=1754`，失败占位数量为 `0`；同一 URL 直接请求返回 `200`、`Content-Type: image/png`、原始字节 `276560`。
- [x] 截图中的 `200 / text/plain / 440 B` 不是当前根授权内容协议的响应；它对应旧版把根相对 API 地址拼入应用 `baseURL` 后命中的应用壳。当前源码与 `dev:once` 产物均经过 `resolveAssetURL`，不会再走该地址。
- [x] 已在现场页签执行强制重载并复核成功；旧 bundle 缓存导致的历史破图状态已清除。

## ℹ️ 维护指南

1. 每次变更先更新对应里程碑和子 TTT，再修改代码；不得用通过单个窄测试替代全范围验收。
2. 完成一个里程碑后记录实际文件、API、测试命令和残余风险，再将条目移动到归档区。
3. 子 TTT 完成后把关键结论回写到父文档，并将原文档连同证据移动到 `docs/ttt/archive/`；不得删除已完成任务的审计轨迹，长期架构决策保留在父文档。
4. 前端本次范围只处理 P0 及以下新增 lint 问题；既有 P1 以上问题不扩大范围，但不得用它们掩盖逻辑错误。

## 🏁 已归档/已完成

- 图片显示错误复核已完成并归档：[`archive/图片显示错误复核.shorterm.ttt.md`](archive/图片显示错误复核.shorterm.ttt.md)。

## 2026-08-08 用户图片显示错误复核（已完成）

- [x] 根据用户截图与旧 bundle 源码对照定位 `200 / text/plain` 旧地址成因：根相对 API 被拼入静态 `baseURL`；当前源码和新 bundle 已移除该路径。
- [x] 对照 `SACAssetsManager` 的本地资源契约：缩略图使用受控缩略图入口，原图使用受控原图入口；路径中的中文、空格、嵌套目录和根相对 API 地址保持可解码且不落到应用壳。
- [x] 为 `Asset` 页签、文件预览页签、资源卡片、表格行和属性 Dock 统一接入 URL 解析；失败时保持稳定占位，不暴露浏览器破图标。
- [x] 已完成构建和真实运行页面复核；原图与缩略图均使用 `/api/s-forge/file-browser/...` 同源受控地址，图片实际加载尺寸为 `1241 × 1754`，对应短期 TTT 已归档。

证据详见归档子 TTT：[`archive/图片显示错误复核.shorterm.ttt.md`](archive/图片显示错误复核.shorterm.ttt.md)。

## 2026-08-08 用户截图现场再次复核（已完成）

- [x] 重新执行 `pnpm run dev:once`，app、desktop、mobile、magi、protyle 和 agent 构建全部成功；desktop 产物已更新。
- [x] 强制重载 `http://127.0.0.1:6806/stage/build/desktop/` 后，保留截图中的 `D:\\dev\\.artifacts\\passive-income\\guide-render\\page-2.png` 资源页签，图片元素 `complete=true`、`naturalWidth=1241`、`naturalHeight=1754`，失败占位为 0。
- [x] 现场最终地址为 `/api/s-forge/file-browser/content/root-ebc8c460379294ef/.artifacts/passive-income/guide-render/page-2.png`，服务端响应 `200 / image/png / 276560 bytes`；不再请求 `/stage/build/desktop/api/...` 静态壳。
- [x] 结论：用户截图中的 `200 / text/plain / 440 B` 属于旧 bundle 缓存；当前源码、最新 desktop bundle 和强制重载后的真实页面均已按 `SACAssetsManager` 的受控原图/缩略图语义工作。

## 2026-08-08 操作交互测试时序修正

- [x] 树操作交互测试等待工作空间首次自动展开完成，并按节点名称精确定位 `notes` 与 `old.txt`；不再把父目录嵌套文本误识别为文件节点。
- [x] 菜单替身的 `remove` 同步清空上一轮菜单项，创建、重命名、复制均从当前真实树节点菜单动作触发并验证父目录刷新。
- [x] 该基础操作子 TTT 已回写后移动到 [`archive/文件操作基础切片.shorterm.ttt.md`](archive/文件操作基础切片.shorterm.ttt.md)，原文保留。

本次仅刷新构建产物和现场证据，未改动已归档子 TTT。

## 2026-08-08 构建后图片现场复核（已完成）

- [x] 在本轮 `pnpm run dev:once` 之后重新加载 `http://127.0.0.1:6806/stage/build/desktop/`，桌面目标产物更新为 `main.07cc2d07da5cdc9033de.js`。
- [x] 按截图路径展开 `D:\\dev\\.artifacts\\passive-income\\guide-render` 并双击 `page-2.png`；图片 `currentSrc` 为 `http://127.0.0.1:6806/api/s-forge/file-browser/content/root-ebc8c460379294ef/.artifacts/passive-income/guide-render/page-2.png`。
- [x] 现场 DOM 结果：`complete=true`、`naturalWidth=1241`、`naturalHeight=1754`；截图中图片内容正常显示，未出现浏览器破图标。
- [x] 交互回归：`pnpm exec vitest --run test/asset/assetUrl.test.ts test/asset/AssetCard.interaction.test.ts test/sforge/fileBrowser/FileBrowser.open.test.ts test/sforge/fileBrowser/FileBrowserGalleryTab.interaction.test.ts test/sforge/fileBrowser/FilePropertiesPanel.interaction.test.ts`，5 个文件、19 个用例通过；`pnpm run dev:once` 和 `git diff --check` 通过。

## 2026-08-08 旧页签图片地址兼容补强

- [x] 保留现有 `resolveAssetURL` 统一入口，并新增针对旧桌面 bundle 形成的
  `api/s-forge/file-browser/...` 与 `/stage/build/.../api/s-forge/file-browser/...`
  地址的定向归一化；普通静态资源、`file:` 和远程地址不改变语义。
- [x] 新增 URL 回归测试，覆盖缺失前导斜杠和静态构建目录前缀，确保恢复旧布局时
  仍请求应用 origin 下的受控文件浏览 API，而不是 440 B 的应用壳文本。
- [x] 证据：`pnpm exec vitest --run test/asset/assetUrl.test.ts`（6 个用例）、
  `pnpm exec vitest --run test/asset/AssetCard.interaction.test.ts test/sforge/fileBrowser/FileBrowserGalleryTab.interaction.test.ts`
  （2 个文件、9 个用例）、`git diff --check` 通过。
- [x] 本轮桌面 bundle 更新后重新加载用户截图中的 `page-2.png` 页签：
  `currentSrc=http://127.0.0.1:6806/api/s-forge/file-browser/content/root-ebc8c460379294ef/.artifacts/passive-income/guide-render/page-2.png`，
  服务端返回 `200 image/png`，图片自然尺寸 `1241 × 1754`，失败占位数量为 `0`。
- [x] 当前证据确认旧布局地址兼容已进入 `main.70e6717c5fc0020ac6ac.js`；
  该补强与已有图片预览切片共同完成，子 TTT 已归档至
  [`archive/图片地址兼容回退.shorterm.ttt.md`](archive/图片地址兼容回退.shorterm.ttt.md)。

## 2026-08-08 图片入口构建后再次复核

- [x] `pnpm run dev:once` 全部目标构建成功，桌面产物为 `main.07cc2d07da5cdc9033de.js`。
- [x] 强制重载 6806 桌面页后，截图中的 `page-2.png` 继续使用应用根受控内容地址，
  `complete=true`、自然尺寸 `1241 × 1754`；没有浏览器破图占位。
- [x] 真实内容请求返回 `200`、`Content-Type: image/png`、`276560` 字节；画廊缩略图仍使用
  `/api/s-forge/file-browser/thumbnail`，没有回落到 `/stage/build/.../api/...` 静态壳。
- [x] 回归：前端 5 个文件、19 个用例；`go test ./thumbnail ./api ./filebrowser ./filequery -count=1`；
  `git diff --check` 均通过。

## 2026-08-08 图片入口统一收口（本轮）

- [x] 旧资源菜单 `renderAssetsPreview` 的图片和文件缩略图也统一调用 `resolveAssetURL`；不再让该历史入口单独生成未归一化地址。
- [x] `pnpm exec vitest --run test/asset/assetUrl.test.ts test/asset/AssetCard.interaction.test.ts test/sforge/fileBrowser/FileBrowser.open.test.ts test/sforge/fileBrowser/FileBrowserGalleryTab.interaction.test.ts test/sforge/fileBrowser/FilePropertiesPanel.interaction.test.ts`：5 个文件、19 个用例通过；`git diff --check` 通过。
- [x] `pnpm run dev:once` 全部目标构建成功；本轮桌面产物为 `main.33b968ccd4ddd5110541.js`。
- [x] 构建后重新加载 6806 页面并恢复截图中的 `page-2.png` 页签：`currentSrc=http://127.0.0.1:6806/api/s-forge/file-browser/content/root-ebc8c460379294ef/.artifacts/passive-income/guide-render/page-2.png`，`complete=true`、自然尺寸 `1241 × 1754`；图片内容正常显示。
- [x] 直接服务端证据保持为 `200 / image/png / 276560 bytes`；没有再次命中 `/stage/build/desktop/...` 应用壳。

## 2026-08-08 当前运行页再次核验（已完成）

- [x] 从现有 6806 页面读取 `page-2.png` 的真实 DOM 状态：`currentSrc` 为应用根
  `http://127.0.0.1:6806/api/s-forge/file-browser/content/root-ebc8c460379294ef/.artifacts/passive-income/guide-render/page-2.png`，
  `complete=true`、`naturalWidth=1241`、`naturalHeight=1754`，图片失败标记为 `false`。
- [x] 当前页面截图中资源页签已显示图片内容；未出现用户截图中的破图标或 `200 / text/plain / 440 B` 静态壳响应。
- [x] 本轮窄回归仍为 5 个文件、19 个用例通过；`git diff --check` 通过。测试输出中的 `localhost:3000` 404 是未启动的独立测试 API，不影响替身仓储用例结果。

## 2026-08-08 图片预览组件边界回归（已完成）

- [x] 新增 `app/test/sforge/fileBrowser/FileBrowserPreviewPanel.interaction.test.ts`：带 `/stage/build/desktop/` 基址时，文件浏览内容地址仍解析到应用根；模拟图片加载失败后切换为受控占位，不暴露浏览器破图标。
- [x] 图片地址专项回归：`pnpm exec vitest --run test/sforge/fileBrowser/FileBrowserPreviewPanel.interaction.test.ts test/asset/assetUrl.test.ts test/asset/AssetCard.interaction.test.ts`，3 个文件、9 个用例通过。
- [x] 最新 `pnpm run dev:once` 全部目标构建成功；`go test ./thumbnail ./api ./filebrowser ./filequery -count=1` 通过；`git diff --check` 通过。
- [x] 构建后运行页面再次打开 `D:\\dev\\.artifacts\\passive-income\\guide-render\\page-2.png`：`currentSrc=http://127.0.0.1:6806/api/s-forge/file-browser/content/root-ebc8c460379294ef/.artifacts/passive-income/guide-render/page-2.png`，`complete=true`、自然尺寸 `1241 × 1754`，画面正常显示。

## 2026-08-08 图片适配与专项回归（本轮）

- [x] 保留 `SACAssetsManager` 的职责分层：缩略图由受控 thumbnail 服务生成，原图由受控 content 服务流式返回；前端只负责把根相对 API 解析到应用 origin，并在失败时显示稳定占位。
- [x] `Asset` 页签、文件预览、`AssetCard`、表格行和文件属性 Dock 继续共用 `resolveAssetURL`；旧布局中的 `api/...` 与 `/stage/build/.../api/...` 地址仍按同源规则归一化。
- [x] 新增 `FileBrowser.editor.constants.ts`，使文件打开端口读取编辑器页签类型时不加载 Monaco；文本文件打开测试不再被编辑器依赖解析污染。
- [x] 专项回归：图片/文件浏览 6 个测试文件、21 个用例通过；`pnpm run typecheck:protyle-contract`、`pnpm run dev:once` 和 `git diff --check` 通过。
- [x] 6806 接口复核：原图 `200 image/png`、自然尺寸 `1241 × 1754`；缩略图 `200 image/jpeg`、自然尺寸 `543 × 768`，均未命中 `/stage/build/desktop/api/...`。

## 2026-08-08 图片失败回退适配（已完成）

- [x] 在统一 `assetUrl` 入口解析文件浏览器 `content` 地址，按同一 `rootID` 和根内相对路径生成受控 `thumbnail` 回退地址；不暴露本地绝对路径，也不改变普通资产和远程 URL 语义。
- [x] 图片编辑器保持原图优先，原图 `error` 时切换同根缩略图；地址变化会重置尝试次数和失败状态，最终失败显示稳定的应用占位而不是浏览器破图标。
- [x] 参考 `SACAssetsManager` 的图片卡片策略：缩略图入口继续使用固定尺寸，加载失败保持稳定尺寸和占位图标；大图页签不因回退而降低正常原图清晰度。
- [x] 证据：`pnpm exec vitest run test/asset/assetUrl.test.ts test/asset/AssetCard.interaction.test.ts`（2 个文件、9 个用例）；文件浏览打开、画廊、预览和属性交互测试（4 个文件、14 个用例）；`pnpm run typecheck:protyle-contract`；`pnpm run lint:file -- src/asset/assetUrl.ts src/components/panels/imageEditor.vue --show-all`；`git diff --check`。
- [x] 边界覆盖中文目录、空格文件名、旧构建页签地址和普通资产 URL；真实 6806 页面仍验证 `page-2.png` 原图为 `200/image/png/1241×1754`，缩略图为同源受控响应。
- [ ] 未强制制造损坏文件来替换当前用户页签；最终失败态由组件状态逻辑和 URL 单元测试覆盖，真实成功路径已在桌面页面复核。

## 2026-08-08 图片预览与属性 Dock 二级回退补强（已完成）

- [x] 文件预览页签与文件属性 Dock 统一采用“原图 -> 同 rootID 缩略图 -> 应用占位”的失败处理链；地址变化、选择变化和轮播切换都会清除旧失败状态。
- [x] 图片编辑器切换回原图时改用当前有效图片源，不会在原图失败后绕过缩略图回退再次请求损坏地址。
- [x] 新增预览页签与属性 Dock 的两阶段失败事件测试，验证第一次失败确实切换 `/api/s-forge/file-browser/thumbnail`，第二次失败才显示占位。
- [x] 验证：图片/属性专项 4 个文件、14 个用例通过；`pnpm run typecheck:protyle-contract`、目标 lint、`pnpm run dev:once`、`git diff --check` 通过。
- [x] 构建后 6806 真实页面复核：`page-2.png` 的受控原图地址仍返回 `200 image/png`，自然尺寸 `1241 × 1754`；没有静态构建目录前缀或破图标。

## 2026-08-08 中心图片页签回归补强（已完成）

- [x] 新增 `app/test/asset/ImageEditor.interaction.test.ts`，真实挂载中心图片页签并验证旧静态构建前缀归一化、原图失败后的同根缩略图回退，以及二次失败时的应用占位。
- [x] 图片/文件浏览专项回归为 5 个文件、15 个用例；`pnpm run typecheck:protyle-contract`、目标 lint、`pnpm run dev:once` 和改动文件 `git diff --check` 均通过。
- [x] 构建后强制重载 `6806` 页面复核截图中的 `page-2.png`：内容接口 `200 image/png`，`currentSrc` 为应用根受控 URL，`naturalWidth=1241`、`naturalHeight=1754`，失败占位数量为 `0`。

证据已回写并保留在归档子 TTT：[`archive/图片失败回退适配.shorterm.ttt.md`](archive/图片失败回退适配.shorterm.ttt.md)。

## 2026-08-08 构建后图片现场复核（本轮）

- [x] `pnpm run dev:once` 后强制刷新 6806，按截图路径重新打开 `page-2.png`；图片内容正常显示。
- [x] 现场 `currentSrc` 为应用根受控 `file-browser/content` 地址，`complete=true`、自然尺寸 `1241 × 1754`；直接响应为 `200/image/png/276560` 字节。
- [x] 旧 `/stage/build/desktop/api/...` 应用壳地址未再出现；图片、预览页签、属性 Dock 的原图/缩略图回退链与 `SACAssetsManager` 的受控原图/缩略图职责保持一致。

## 2026-08-08 当前工作区构建复核（已完成）

- [x] `pnpm run dev:once` 当前工作区全目标构建成功，包含 app、desktop、mobile、magi、protyle、agent、bazaar 和 export 目标。
- [x] 6806 原图接口返回 `200 image/png`、`276560` 字节；同根缩略图接口返回 `200 image/png`、`227011` 字节，均未命中静态构建目录。
- [x] 图片专项 5 个文件、15 个用例，`pnpm run typecheck:protyle-contract`、目标 lint 与 `git diff --check` 均通过。

## 2026-08-08 文件树拖放移动里程碑（已完成）

- [x] 文件树已有的递归拖放事件现在贯通 `filebrowser.Move`、API `/operations/move`、前端操作仓储和 `FileBrowserPanel`；拖放只接受 `application/x-sforge-file`，目标严格为目录/根。
- [x] Move 契约固定为 `sourceRootID/sourcePath` 与 `destinationRootID/destinationPath`，来源按浏览能力、目标按最具体挂载写能力授权；根本身、目标冲突、重叠、越界、链接和只读挂载均由领域/Walker 守卫。
- [x] 成功后刷新来源父目录和目标目录，展开状态由原节点协调保留，选择定位到移动后的根内地址；错误通过现有消息入口和 Panel 状态呈现。
- [x] 证据：`go test ./fswalk ./filebrowser ./api -count=1`；前端文件浏览专项 11 个文件、34 个用例；`pnpm run typecheck:protyle-contract`；`git diff --check`。
- [x] 详细记录已归档至 [`archive/文件树拖放移动.shorterm.ttt.md`](archive/文件树拖放移动.shorterm.ttt.md)。

## 2026-08-08 图片显示适配最终复核

- [x] 对照 `SACAssetsManager` 的原图优先、受控缩略图回退和透明占位策略，文件浏览器图片入口统一通过 `resolveAssetURL`，旧静态构建前缀也会归一化到应用根 API。
- [x] 图片/文件浏览专项 7 个文件、25 个用例，Go `thumbnail/api/filebrowser/filequery` 聚焦测试，`typecheck:protyle-contract`、`pnpm run dev:once`、`git diff --check` 均通过。
- [x] 6806 当前页签现场验证 `page-2.png` 为 `200 image/png`，`naturalWidth=1241`、`naturalHeight=1754`、失败占位数量为 `0`；同根缩略图接口也返回 `200 image/png`。
- [x] 图片失败适配记录继续保存在归档子 TTT：[`archive/图片失败回退适配.shorterm.ttt.md`](archive/图片失败回退适配.shorterm.ttt.md)。

## 2026-08-08 用户截图路径现场复验（已完成）

- [x] 重新执行 `pnpm run dev:once`，桌面目标产物构建成功（`main.44e656cac4b357e1f67f.js`）。
- [x] 在 `http://127.0.0.1:6806/stage/build/desktop/` 按用户截图路径展开目录并双击 `page-2.png`；页面图片元素实际 `currentSrc` 为应用根 `/api/s-forge/file-browser/content/root-ebc8c460379294ef/.artifacts/passive-income/guide-render/page-2.png`，`complete=true`、自然尺寸 `1241 × 1754`，`broken=false`。
- [x] 直接接口复核原图为 `200 image/png / 276560` 字节，同根缩略图为 `200 image/png / 227011` 字节；没有请求 `/stage/build/desktop/api/...`，截图中的浏览器破图状态已消除。

## 2026-08-09 图片加载稳定性补强（本轮）

- [x] 图片中心页签按 `SACAssetsManager` 的加载顺序补齐稳定占位：图片解码完成前隐藏原生 `<img>`，避免 `text/plain` 或损坏响应短暂显示浏览器破图图标；成功后再居中并启用交互。
- [x] 原图 -> 同 rootID 缩略图 -> 应用占位的状态在文件切换时完整重置；无有效回退地址时使用透明像素占位，不产生空 `src` 请求。
- [x] 新增 `ImageEditor.interaction.test.ts` 的稳定布局回归，覆盖加载前占位和加载后解除隐藏；旧构建前缀、首次失败回退、二次失败占位测试继续保留。
- [x] 证据：`pnpm exec vitest --run test/asset/ImageEditor.interaction.test.ts test/sforge/fileBrowser/FileBrowserPreviewPanel.interaction.test.ts`（2 个文件、4 个用例）；`pnpm run typecheck:protyle-contract`；`pnpm run dev:once` 全目标构建成功；`git diff --check`。
- [x] 6806 真实页面复核：`page-2.png` 请求仍为应用根 `/api/s-forge/file-browser/content/...`，`complete=true`、自然尺寸 `1241 x 1754`，加载占位已移除且无失败占位。

## 2026-08-09 原图/缩略图来源隔离修正（当前有效）

> 说明：本节覆盖并纠正本文件及归档子 TTT 中此前关于“失败回退、透明像素、图标占位”的实现记录；历史记录保留用于审计，不代表当前行为。

- [x] 原图入口（图片编辑器、文件预览页签、文件属性 Dock）始终只使用解析后的 `file-browser/content` 原图地址；原图加载失败后不再请求缩略图或任何其他图片源。
- [x] 缩略图入口（资源瀑布流卡片、文件画廊表格行）始终只使用传入的 `thumbnailUrl`；缩略图加载失败后不替换为透明像素、图标或原图。
- [x] 删除 `EMPTY_IMAGE_DATA_URL`、`getFileBrowserThumbnailURL` 及所有失败后的自动切换状态；加载失败统一呈现明确的错误文字。
- [x] 删除图片加载遮罩和图片失败图标伪占位；失败状态不伪造成功，也不制造第二个图片请求。
- [x] 专项回归：6 个 Vitest 文件、16 个用例通过；全量 `pnpm run typecheck` 仍有仓库既有错误，相关 `assetUrl.ts` 返回类型错误已修复。
- [x] 文件浏览全套回归：29 个文件、90 个用例通过；输出中的 `localhost:3000` 404 属于未启动的独立接口，不是图片入口的替换请求。
- [x] `pnpm run typecheck:protyle-contract`、`pnpm run dev:once` 和 `git diff --check` 通过；全量类型检查剩余错误集中在既有文件及既有 Vue 属性类型规则。

## 2026-08-09 图片来源契约再次收紧（当前有效）

> 本节是对本文件及归档记录中所有“回退、占位、透明像素”描述的当前实现覆盖；历史条目保留作为审计轨迹，不代表现行行为。

- [x] `AssetItem.thumbnailUrl` 改为必填。`AssetCard` 不再根据 `path` 猜测或生成第二个缩略图地址；旧资源选择对话框在组装结果时显式构造自己的缩略图入口。
- [x] 原图入口（图片编辑器、文件预览页签、属性 Dock）只解析并渲染原图 `file-browser/content` 地址；处理结果类型异常不再回到原图，空地址、解析错误和加载错误分别显示明确错误。
- [x] 缩略图入口（资产卡片、文件画廊表格行、旧 `renderAssetsPreview`）只渲染其传入或该业务明确构造的缩略图地址；缩略图失败不替换为原图、透明像素或图标。
- [x] `resolveAssetURL` 删除 `http://localhost` 运行时伪基址和无效地址原样返回逻辑；空地址、无有效基址和解析错误抛出可观察错误。
- [x] 旧资源预览为图片错误安装捕获监听并渲染错误文本；资产元数据读取/提取失败不再静默吞掉，也不再构造空元数据对象。
- [x] 回归证据：图片与文件浏览专项 36 个 Vitest 文件、113 个用例通过（来源隔离窄回归 6 个文件、18 个用例）；`pnpm run typecheck:protyle-contract`、目标 lint、`pnpm run dev:once`、`git diff --check` 通过。
- [x] 全量 `pnpm run typecheck` 仍由仓库既有诊断失败；本轮未新增资源来源契约错误，既有 Vue `xlink:href` 等诊断不在本轮范围内。

## 2026-08-09 失败状态显式化补强（当前有效）

- [x] `AssetMasonryDialog` 检索失败不再清空结果并显示“暂无内容”；保留已有结果或显示明确错误文本，并提供真实重试入口。
- [x] 缩略图服务不再注册 `FileIconProvider`；Windows Shell 缩略图生成失败时不再返回文件图标，避免把图标伪装成缩略图。缩略图生成失败由 API 显式返回失败状态。
- [x] 回归证据：`pnpm exec vitest --run test/asset/AssetMasonryDialog.interaction.test.ts test/asset/AssetCard.interaction.test.ts`（2 个文件、3 个用例）；`go test ./thumbnail ./api -count=1`；此前图片/文件浏览专项回归保持通过。
- [ ] 真实桌面窗口中故障图片和不支持格式的 404 错误展示仍待 M1/M2 现场验收；不以图标、透明像素或空结果替代错误。

## 2026-08-09 Windows 根解析统一修正（当前有效）

- [x] 定位 `filebrowser` API 的 `Access is denied`：领域层重复使用
  `filepath.EvalSymlinks`，与 Windows `fswalk` 原生句柄解析的行为不一致；失败发生在
  根校验阶段，不是目录为空，也不是缩略图响应替换。
- [x] 新增 `fswalk.ResolvePathTarget` 作为统一平台解析契约，`filebrowser` 不再维护第二份
  路径目标解析实现；目录根、文件入口和挂载根均复用同一 Windows API 路径。
- [x] 证据：`go test ./filebrowser -count=1`；`go test ./api -run
  'TestFileBrowserRootsAndListUseRootRelativePaths|TestFileBrowserThumbnailResponsePreservesProviderMime'
  -count=1 -v`；`go test ./fswalk -run 'TestReadDirectoryReturnsMetadata|TestWalkStableAndBounded' -count=1`，全部通过。
- [ ] D 盘大规模枚举、完整目录边界矩阵和桌面真实根恢复仍未完成；本修正不扩大为性能验收结论。

## 2026-08-09 颜色筛选与画廊模式选择器修正（当前有效）

- [x] 颜色筛选条件行只在高级颜色条件启用后挂载；颜色入口和 RGB 取色器均使用独立的圆形彩虹边框，原生 `input[type=color]` 仍是唯一真实颜色输入，禁用态显示明确的不可用状态。
- [x] 画廊布局模式不再依赖图标按钮的悬浮提示；改为带当前值、键盘可操作的紧凑 `布局模式` 选择器，继续驱动现有 `masonry/grid/justified/list/table` 布局引擎和表格行投影。
- [x] 修正颜色条件行异步挂载后的交互测试等待，并将空结果测试改为验证实际保留的标签来源条件；不以失效扩展名作为伪筛选证据。
- [x] `pnpm exec vitest --run test/sforge/fileBrowser/FileBrowserSearchPanel.interaction.test.ts test/sforge/fileBrowser/FileBrowserGalleryTab.interaction.test.ts --reporter=dot`：2 个文件、15 个用例通过。
- [ ] 尚待在真实桌面页签复核彩虹环在明暗主题下的对比度、窄 Dock 下布局选择器的宽度，以及全量文件浏览专项回归。

## 2026-08-09 视图模式选择器参考行为纠正（当前有效）

> 覆盖上一节中“文字下拉框”的临时实现记录；历史内容保留，当前源码以本节为准。

- [x] 画廊顶栏使用参考项目同类的图标分段按钮组，不再使用原生文字下拉框；按钮直接切换五种已接入布局投影。
- [x] 模式按钮提供当前激活态、可访问名称、悬浮提示和原生键盘触发；容器响应式仍以 Dock 容器宽度为边界。
- [x] 聚焦挂载回归覆盖五种模式切换并验证表格标题投影；`FileBrowserGalleryTab` 9 个用例通过。
- [x] `pnpm exec vitest --run test/sforge/fileBrowser --reporter=dot`：29 个文件、92 个用例通过；`pnpm run dev:once` 全目标构建成功；`pnpm run typecheck:protyle-contract` 和 `git diff --check` 通过。
- [x] 构建后真实桌面页验证五个按钮可见（计算 `opacity=1`），并完成表格/瀑布流现场切换；大结果滚动和布局恢复仍保留为未完成验收项。

## 2026-08-09 文件删除与确认切片（已完成）

- [x] `filebrowser.Service.Delete` 复用 `fswalk.Walker.RemoveTree`，保留根保护、链接预检、普通文件限制、授权挂载和取消语义；返回删除文件/目录计数。
- [x] Kernel 接入 `POST /api/s-forge/file-browser/operations/delete`，删除请求只携带 `rootID` 与根内相对路径；根删除返回 `400`，越权/链接和只读路径继续按现有错误映射拒绝。
- [x] 文件树菜单按最具体挂载 capability 显示删除；Panel 使用统一破坏性确认框，成功后刷新父目录、清理共享选择子树并显示实际计数，失败保留明确错误。
- [x] 证据：`go test ./filebrowser -count=1`、`go test ./api -run TestFileBrowserMutationOperationsUseRootRelativeContracts -count=1`、`pnpm exec vitest --run test/sforge/fileBrowser --reporter=dot`（30 个文件、97 个用例，含真实 Panel 删除确认）、`pnpm run typecheck:protyle-contract`、`git diff --check`。
- [x] 子 TTT 已移入 [`archive/文件删除与确认.shorterm.ttt.md`](archive/文件删除与确认.shorterm.ttt.md)，保留原始实现轨迹。

## 2026-08-09 批量文件删除切片（已完成）

- [x] 在单项删除契约之外新增独立 `BatchDeleteRequest/BatchDeleteResult`；每项仍只携带 `rootID` 与根内相对路径，限制 1-100 项，规范化重复地址在写入前拒绝。
- [x] 后端按根分组、路径深度降序执行 `fswalk.Walker.RemoveTree`，父子同时选中时先处理子项；响应按输入顺序保留每项成功结果或稳定错误码，部分失败不伪装为整体成功。
- [x] 文件树工具栏接入共享选择端口和统一确认框；只提交具备最具体写 capability 的非根节点，成功项清理选择并刷新受影响父目录，失败项保留并显示后端消息。
- [x] 修复 `FileBrowserEditor.preferences.ts` 末尾裸 `\\n` 导致的 P0 解析错误；文件浏览全量转换恢复。
- [x] 证据：`go test ./filebrowser -count=1`；`go test ./api -run 'TestFileBrowser(BatchDelete|MutationOperations)' -count=1 -v`；`pnpm exec vitest --run test/sforge/fileBrowser --reporter=dot`（30 个文件、98 个用例）；`pnpm run typecheck:protyle-contract`；文件浏览范围 typecheck 无新增诊断；`git diff --cached --check`。
- [x] 子 TTT 已移入 [`archive/批量文件操作.shorterm.ttt.md`](archive/批量文件操作.shorterm.ttt.md)，保留契约和证据；批量复制/移动、拖放批处理、进度取消和监听增量仍保持未完成状态。

## 2026-08-09 批量复制/移动与多选拖放切片（已完成）

- [x] 在单项 `Copy`/`Move` 之外新增独立批量契约：目标路径是已存在目录，源项保留自身名称；根授权、链接、重叠、冲突和遍历继续复用现有领域与 `fswalk.Walker`。
- [x] API 接入 `operations/copy-batch` 与 `operations/move-batch`，返回按输入顺序排列的逐项成功/失败结果；前端仓储和守卫严格区分 `copy`/`move`，不把错误响应当作成功。
- [x] 树拖放载荷在多选时携带多个 `{rootID,path}`，单项拖放仍调用旧接口；多项拖放调用 `move-batch`，成功项清理共享选择并刷新来源父目录和目标目录。
- [x] 工具栏新增批量复制入口和独立目标目录对话框，明确允许目标根本身；部分失败显示服务端逐项错误。
- [x] 证据：`go test ./filebrowser -run 'Test(CopyBatch|MoveBatch|BatchTransfer|DeleteBatch)' -count=1`、`go test ./api -run 'TestFileBrowserBatch(CopyAndMove|Delete)' -count=1`；`pnpm exec vitest --run test/sforge/fileBrowser --reporter=dot`（30 个文件、101 个用例）；`pnpm run typecheck:protyle-contract`；`pnpm run dev:once`；`git diff --check`。
- [x] 详细契约和残余风险已保存在并归档于 [`archive/文件树批量复制移动.shorterm.ttt.md`](archive/文件树批量复制移动.shorterm.ttt.md)。
- [ ] 后台进度/取消、大目录增量监听、外部系统拖放和桌面真实窗口冲突 UI 仍未完成；`go test ./api -count=1` 的既有 Agent Windows 权限失败不作为本切片成功证据。

## 2026-08-09 批量操作边界模块拆分（已完成）

- [x] 批量复制/移动/删除响应守卫从通用 `FileBrowser.guards.ts` 移入 `FileBrowser.operation.guards.ts`，保持单项操作守卫与批量部分成功契约分层。
- [x] 拖放项结构守卫移入 `FileBrowser.drag.guards.ts`；`FileBrowser.drag.ts` 保留路径规范化和载荷编排，先规范化再执行结构守卫，避免反斜杠根内路径被错误拒绝。
- [x] 拖放、批量仓储、批量交互和面板交互聚焦回归：4 个文件、14 个用例通过；`pnpm run typecheck:protyle-contract` 通过。
- [x] 完整 `pnpm exec vitest --run test/sforge/fileBrowser`：30 个文件、101 个用例通过；`go test ./filebrowser -run 'Test(CopyBatch|MoveBatch|BatchTransfer|DeleteBatch)' -count=1` 和 `go test ./api -run 'TestFileBrowserBatch(CopyAndMove|Delete)' -count=1` 通过；`pnpm run typecheck:protyle-contract` 与 `pnpm run dev:once`（全目标）通过代理 `http://127.0.0.1:7890` 执行。
- [ ] 目录级 `folder-item-limit` P15 是既有 fileBrowser 目录债务，不在本次逻辑修正范围内；后台进度/取消、大目录增量监听、外部系统拖放和桌面真实窗口冲突 UI 仍未完成。

## 2026-08-09 文件画廊项上下文菜单切片（已完成）

- [x] 真实对照 `SACAssetsManager/source/UI/siyuanCommon/menus/galleryItem.js` 及其 `galleryItemMenu/menuItems.js`，确认打开来源笔记、默认应用、资源管理器、所在目录新页签、复制地址/链接/缩略图和文件操作分组的最终入口；未按关键词猜测菜单。
- [x] 新增 `app/src/sforge/fileBrowser/FileBrowserGalleryMenu.ts`，卡片和表格行通过同一上下文事件进入；菜单动作只声明式调用既有 `openBy`、剪贴板、属性 Dock、打开页签和文件操作端口。
- [x] 绑定块存在时显示“所在笔记”，资源根直接根/挂载根均按 `rootID` 可靠解析；根不存在或删除权限不足保留明确页签错误。
- [x] 删除完成后清理共享选择并维护已加载/总数/分页游标；删除菜单使用“删除”而非伪装成回收站，保持当前后端真实语义。
- [x] 子 TTT 已归档至 [`archive/文件画廊项菜单切片.shorterm.ttt.md`](archive/文件画廊项菜单切片.shorterm.ttt.md)，保留参考契约、测试证据和未完成边界。
- [x] 证据：`pnpm exec vitest --run test/sforge/fileBrowser/FileBrowserGalleryMenu.test.ts test/sforge/fileBrowser/FileBrowserGalleryTab.interaction.test.ts test/sforge/fileBrowser/FileBrowserGalleryTableRow.interaction.test.ts`（3 个文件、13 个用例）；`pnpm exec vitest --run test/sforge/fileBrowser`（31 个文件、103 个用例）；`go test ./filebrowser ./filequery ./fileproperties`；`pnpm run typecheck:protyle-contract`；`git diff --check`。
- [ ] SACAssetsManager 的 Efu、插件/颜色分析、批处理压缩去重、移动/硬链接/软链接、上传和真实桌面 Shell/索引刷新验收仍未完成，不在本切片中宣称完成。

## 2026-08-10 画廊筛选自动刷新与表格列对齐切片（已完成）

- [x] 参考画廊的运行期刷新语义扩展到关键词、标签、根范围、颜色/RGB/HSL/调色板参数、排序和扩展名；统一 300ms 防抖，手动提交、清空和卸载会取消待执行请求，不把旧筛选重新写入页签来源。
- [x] 属性列选择改用现有 `FileBrowserMultiSelect`，增加内部 key 与显示标签分离能力；扩展名控件仍复用同一组件和原有值契约。
- [x] 表格表头与表格行共用 `--sforge-file-table-columns`，窄容器通过同一列变量同步收缩并隐藏末列，避免独立栅格造成表头/内容错位。
- [x] 回归证据：`pnpm exec vitest --run test/sforge/fileBrowser`（31 个文件、105 个用例）；`pnpm run typecheck:protyle-contract`；`git diff --check`。
- [ ] 真实桌面窗口中的容器断点、颜色面板明暗主题对比度和大结果滚动仍需现场验收；Efu/Everything provider、批处理菜单、插件入口和外部索引仍未完成，provider 审计见 [`Efu与Everything provider迁移.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/Efu与Everything%20provider迁移.shorterm.ttt.md)。

## 2026-08-10 画廊多选、框选与目录拖放切片（已完成本轮逻辑）

- [x] 共享 `FileBrowserSelectionStore` 增加基于 `{rootID,path}` 地址序列的单项、范围和批量选择入口；树节点选择契约保持不变，属性 Dock 继续复用同一选择端口。
- [x] 画廊卡片和表格行使用统一的 `data-file-key`/`data-gallery-index`、键盘焦点和选择事件；Ctrl/Meta 追加或移除、Shift 按当前结果顺序选区，方向键移动、Enter 打开、Escape 清空。
- [x] 画廊内容空白区增加真实框选矩形，只命中当前已布局 DOM 项；框选结果仍经共享选择端口提交，不在组件内维护第二份选择状态。
- [x] 卡片与表格行的拖放载荷会在当前可见选择超过一项时携带多个根内地址；目录画廊接入现有单项 `move`/批量 `moveBatch` 仓储，部分失败保留服务端错误并刷新范围，未添加万能写入接口。
- [x] 证据：选择、表格行和画廊专项 3 个测试文件、17 个用例通过；`pnpm run typecheck:protyle-contract`、`git diff --check` 通过。联网环境变量按要求使用 `http://127.0.0.1:7890`。
- [ ] 真实桌面窗口的多列框选命中、虚拟滚动远端焦点、目录拖放冲突提示和批量移动现场验收仍未完成；当前挂载测试不替代桌面验收。

## 2026-08-10 画廊互斥显示状态修正（本轮完成逻辑切片）

- [x] `FileBrowserGalleryTab.vue` 使用单一 `galleryDisplayState` 管理 `loading/error/empty/ready`，资源网格和状态提示不再由互不排斥的模板条件同时渲染。
- [x] 修复截图中的资源卡片与“此目录没有可展示的资源”并存问题；真实资源出现时空提示和“没有匹配资源”均不挂载。
- [x] 证据：`pnpm exec vitest run --config vitest.config.ts test/sforge/fileBrowser/FileBrowserGalleryTab.interaction.test.ts --reporter=verbose`，10/10 通过；改动范围未触及提交门禁。
- [ ] 真实桌面窗口与大结果分页的 A 级状态验收仍未完成，不能用本地挂载测试替代。
