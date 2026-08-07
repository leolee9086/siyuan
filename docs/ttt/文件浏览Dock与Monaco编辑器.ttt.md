# S-Forge 文件浏览 Dock 与 Monaco 编辑器 (TikTocTak)

> **目标**: 在 S-Forge 中实现一个可独立使用的文件浏览 Dock，默认浏览当前工作空间的全部文件，并聚合展示所有已绑定 Agent 任务目录的位置与内容；浏览、标签、颜色检索、预览、文件操作和编辑能力以 `D:\dev\SACAssetsManager` 的最完备历史实现为功能基线，并完整覆盖 `Zuoqiu-Yingyi/siyuan-plugin-monaco-editor` 的文件资源管理器与编辑器功能。
>
> **流程**: 先审计参考仓库和 S-Forge 现有能力，冻结领域契约；随后按可独立使用的里程碑逐步交付，每个里程碑完成聚焦验证后再推进。完成项移动到归档区，短期子 TTT 在成果回写后删除。

## 参考基线

| 参考 | 当前证据基线 | 用途 |
| --- | --- | --- |
| S-Forge | `multipleAI`，工作树起点 `git status --short --branch` 为干净且领先远端 16 个提交 | 复用既有 Dock、工作空间、任务目录、页签、文件树和资源元数据能力 |
| SACAssetsManager | `94c8534a7790bb3f991105a82a42863a04557f1b`，完整参考检出 `D:\dev\SACAssetsManager-ref` 共 951 个提交 | 审计最完备的浏览、遍历、缩略图、标签、颜色、筛选、选择、拖放、菜单和文件操作语义 |
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

**当前事实（部分实现）**：根聚合、节点级懒加载树源码、单层分页列表、只读内容接口和有界并发递归遍历已进入工作区。此前以 S-Forge 自身 `filepath.Walk` 为基线的性能结论已撤回；SACAssetsManager 最终 `fdirModified`、`fast-glob`、stock `fdir` 和常见 Go walker 已接入独立小规模校验工具，但完整 `D:\` 验收和目录遍历边界矩阵仍未完成。文件树已拆出独立 `FileBrowserTree.vue`，真实 DOM 挂载测试证明工作空间/Agent 根、递归层级、懒加载、折叠和目录双击打开 `sforge-file-gallery` 页签；真实瀑布流挂载测试证明查询范围、`VirtualMasonryGrid`/`AssetCard` 卡片投影、共享选择和文件打开端口。这里的结构是“侧边栏树 Dock + 独立瀑布流 Tab”，树 Dock 不渲染查询结果卡片。扩展名筛选、颜色/RGB/HSL/调色板查询、卡片尺寸和属性列投影已经接线并有挂载测试；桌面运行界面、TabRegistry 真实布局恢复、实际根媒体加载和大结果滚动仍缺证据，因此 M1 保持未完成。参考画廊的表格模式、框选多选、拖放批处理、面包屑子目录控制、外部索引入口和完整目录操作仍待实现。文件属性 Dock 已接入共享选择端口、批量属性、星级、注释、图片轮播、聚合/逐文件标签和标签树；标签结果完整打开链路、目录动作和来源入口仍待实现。

### M2：完整浏览与检索（可用版 2）

- 支持列表/网格/瀑布流/表格视图、排序、扩展名过滤、关键词和递归搜索、空结果/错误/取消状态、键盘多选和框选。
- 接入标签树、标签面包屑、标签编辑、星级/注释和标签颜色；支持按 RGB/HSL/调色板相似度检索，结果可跨工作空间和 Agent 根聚合。
- 验收：SACAssetsManager 历史矩阵中的浏览与检索条目逐项有测试证据；颜色查询实际命中索引而非仅前端过滤。

**当前切片（进行中）**：已确认资源管理的组合边界为“文件树 Dock + 独立资源瀑布流页签”，树 Dock 不再承载查询结果。扩展名筛选、颜色/RGB/HSL/调色板查询、卡片尺寸和属性列投影已接入 s-forge 现有 `VirtualMasonryGrid`/`AssetCard`，并由真实 Vue 挂载测试覆盖；框选多选、拖放批处理、表格模式、面包屑子目录控制和外部索引入口仍未完成。

### M3：文件操作与增量同步（可用版 3）

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

## 🟡 中期计划

- [ ] **M1：只读根与文件树 Dock**（见 [`文件浏览Dock前端.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/文件浏览Dock前端.shorterm.ttt.md)）
- [ ] **M1.1：文件树组合与交互修正**（见 [`文件树修正.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/文件树修正.shorterm.ttt.md)）
- [ ] **M2：浏览模式、标签和颜色检索**
- [ ] **M3：受控文件操作、监听和索引增量更新**
- [ ] **M4：Monaco 文件编辑与预览**（见 [`Monaco文件编辑与预览.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/Monaco文件编辑与预览.shorterm.ttt.md)）

### M0.5 当前切片证据

- 已完成：共享 `{rootID, path}` 多选、批量属性读取/逐项错误、属性 Dock 注册/恢复/独立销毁、星级/注释/图片轮播、聚合/逐文件标签、批量/逐文件标签修改、标签颜色定义与确定性回退色。
- 证据：`pnpm exec vitest --run test/sforge/fileBrowser`（13 个文件、33 个用例）；目标 `vue-tsc` 诊断 0；`go test ./assetmeta ./filebrowser ./fileproperties ./api -run 'Test(Index|Advanced|Manager|BatchProperties|Properties|Inspect|Update|FileBrowser|TagDefinitions)' -count=1` 通过；本次新增/修改文件 P0 lint 0。
- 保持未完成：桌面布局持久化重启/截图验收、真实媒体加载、完整标签结果打开链路、框选/拖放批处理、表格模式、面包屑子目录控制、目录动作、所在笔记/来源和外部根图片调色板提取。
- 标签树和标签结果查询已有源码接线与挂载测试；授权响应、颜色查询边界和桌面验收继续由 [`标签结果打开与颜色检索.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/标签结果打开与颜色检索.shorterm.ttt.md) 追踪。

## 🔴 远期计划

- [ ] **M5：大规模目录、跨界面一致性和发布级验证**（见 [`验证与交互验收.shorterm.ttt.md`](文件浏览Dock与Monaco编辑器/验证与交互验收.shorterm.ttt.md)）

## ℹ️ 维护指南

1. 每次变更先更新对应里程碑和子 TTT，再修改代码；不得用通过单个窄测试替代全范围验收。
2. 完成一个里程碑后记录实际文件、API、测试命令和残余风险，再将条目移动到归档区。
3. 子 TTT 完成后把关键结论回写到父文档，并将原文档连同证据移动到 `docs/ttt/archive/`；不得删除已完成任务的审计轨迹，长期架构决策保留在父文档。
4. 前端本次范围只处理 P0 及以下新增 lint 问题；既有 P1 以上问题不扩大范围，但不得用它们掩盖逻辑错误。

## 🏁 已归档/已完成

- 当前没有达到里程碑退出条件的归档项。
