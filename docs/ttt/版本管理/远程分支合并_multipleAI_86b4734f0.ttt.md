# multipleAI 合并 origin/dev 执行跟踪（86b4734f0）

> **最终目标**：按照 `docs/规程/版本管理/远程分支合并.procedure.md`，将上游 `origin/dev` 的 `86b4734f0` 合并到 S-Forge `multipleAI` 的 `28f028b9e`，逐项保留上游新改进与本地特有改进，并完成合并提交和全量验证。
>
> **当前目标**：198 个冲突已全部按意图融合并暂存；执行合并后的 Kernel、前端、语言键、静态检查和构建契约完整回归。
>
> **下一步任务**：按项目规程运行完整回归并记录每项证据；随后审计未暂存变更、残余冲突标记和双方功能映射，保留备份直至最终审计完成。

---

## 不变量

1. 共同基线固定为 `93d6098fcf181a6ce00d9d172e03c51a512c3753`，本地侧固定为 `28f028b9ea7bd423ba77916dcd9ff43446358ad7`，上游侧固定为 `86b4734f0bd2c9046de97fd29cae47c8fb308fdb`。
2. 不按冲突文本表面或文件存在性直接选择 `ours/theirs`；每项处置必须基于共同基线、本地提交意图、上游提交意图和工作区完整实现。
3. 本地重构作为架构骨架时，逐项映射上游行为到实际承接模块；上游完整重写而本地仅有机械适配时，保留上游语义并重新适配本地架构。
4. 任何功能取舍都不属于本次合并；两侧存在的功能均需保留，除非两侧已经以等价或更强实现覆盖，并有代码与测试证据。
5. 每个冲突在修改前必须有本轮重新生成的 `.backup` 和 `.remote`；缺失侧以零字节文件表示该侧不存在，记录冲突类型。
6. 每完成一个文件或紧密相关模块，立即验证、暂存并更新本文，不累计未记录的批量处置。
7. 锁文件不手工拼接，依赖清单按共有依赖取适用新版本、双方独有依赖均保留后，由包管理器重新生成。
8. 合并完成前不清理 `.backup/.remote`；完成逐项审计后统一清理。
9. `kernel/agent/session_test.go` 保持上游测试文件原样，不追加 S-Forge 测试；本地 targetKind、任务目录 capability 等测试放入独立 `session_task_directory_test.go`，不得通过删减任一侧用例降低维护压力。

## 合并基线

| 项目 | 值 |
|---|---|
| 当前分支 | `multipleAI` |
| 本地 HEAD | `28f028b9e` |
| 上游 MERGE_HEAD | `86b4734f0`（`origin/dev`） |
| merge-base | `93d6098fc` |
| 冲突总数 | 198 |
| 当前剩余冲突 | 0 |
| 三方修改 | 193 |
| 本地删除、上游修改 | 3 |
| 双方新增 | 2 |
| 本地独有提交数 | 2709 |
| 上游独有提交数 | 1083 |

## 近期计划

- [x] **Phase 0：本轮备份与意图索引**
  - [x] 重新生成 198 组 `.backup/.remote`，逐个验证 blob 哈希。
  - [x] 为每个冲突生成两侧触及该文件的提交列表，按模块归类。
- [-] **Phase 1：包管理、构建配置与多语言资源**
  - 逐项融合依赖、Electron 构建、安装器和语言键；重建锁文件并验证语言键集合。
- [ ] **Phase 2：核心入口、配置、布局、移动端与 Agent**
  - 保留 S-Forge 宿主抽象、Agent/MAGI/独立入口和 Forge 模式，同时吸收上游入口、AI Agent、MCP 与移动端改进。
- [ ] **Phase 3：Protyle 与编辑器功能**
  - 对本地拆分模块执行一对多映射，逐项移植上游编辑器、数据库视图和交互修复。
- [ ] **Phase 4：Kernel 与存储层**
  - 融合上游加密笔记本、数据库、索引、AI/MCP 等改进与 S-Forge MAGI、向量库、Forge 工具和运行模式。
- [ ] **Phase 5：锁文件重建、全局验证与提交**
  - 清除冲突标记，运行语言、前端、Kernel 和构建规程要求的验证。
  - 逐项审计双方改进，清理本轮备份，完成合并提交。

## 验收标准

- [ ] `git diff --name-only --diff-filter=U` 为空。
- [ ] 不存在冲突标记，所有冲突均有意图分析和处置记录。
- [ ] 上游 1083 个提交涉及冲突文件的实质行为均已映射或有等价覆盖证据。
- [ ] S-Forge 的 Agent/MAGI、Forge 模式、独立入口、宿主 Port、向量数据库和本地重构均保留。
- [ ] i18n 键检查、前端规定测试与 lint、Kernel 规定测试与 vet、必要构建验证通过。
- [ ] 合并提交同时包含本地 HEAD 与上游 MERGE_HEAD 作为父提交。

## 风险

- 198 个冲突跨越前端、编辑器和 Kernel，文本相似度无法证明语义完整。
- Agent、Protyle 和 Kernel 均存在本地拆分或重写，一对多映射容易遗漏上游增量行为。
- 上游新增加密笔记本、数据库和索引行为与 S-Forge 本地存储扩展交叉，必须以相关测试而非编译通过作为证据。
- 当前运行中的 Forge Kernel 基于合并前产物，只用于保持开发界面可访问，不作为合并后验证证据。

## 已归档/已完成

- [x] **2026-07-22：确认合并状态与规程**
  - 确认当前已处于 `origin/dev` 合并中，不存在另行保护未提交功能的需求。
  - 阅读 `docs/规程/版本管理/远程分支合并.procedure.md`，明确三方意图、逐行代码、一对多映射和备份强制要求。
  - 确认上一轮 `远程分支合并_multipleAI_93d6098fc.ttt.md` 的基线不同，不复用其状态。

- [x] **2026-07-22：`app/package.json` 意图融合**
  - 本地意图：S-Forge 品牌、统一动态 Webpack 多目标、Forge/Agent/MAGI/Protyle 独立入口、本地链接包、Vitest 浏览器测试与质量脚本。
  - 上游意图：3.7.3 发布元数据、pnpm 11.12.0、Electron 42.6.1、electron-builder 26.15.7、`typecheck` 纳入 lint、开发签名、内置封面 `sharp` 与加密笔记本密码强度 `zxcvbn`。
  - 处置：保留本地 `name/desktopName` 与多目标脚本骨架；采用上游版本和工具升级；加入 `typecheck`、`sign:dev`、`sharp`、`@types/zxcvbn`、`zxcvbn`；保留双方全部独有依赖。
  - 验证：JSON 解析通过；脚本、开发依赖、运行依赖三组键的两侧并集检查无缺失；S-Forge 身份和上游发布版本断言通过；无冲突标记且 `git diff --check` 通过；文件已暂存。

- [x] **2026-07-22：Electron Builder 六平台配置意图融合**
  - 文件：`electron-builder.yml`、Windows ARM64、macOS x64/ARM64、Linux x64/ARM64 共六份配置。
  - 本地意图：S-Forge 产品名、应用 ID、产物名、协议名、Linux 可执行名和 `tiktoken` 运行资源。
  - 上游意图：`f42f57234` 显式设置 `publish: null` 防止 Electron Builder 误发布；3.7.2 发布变更把 `appearance/covers` 内置封面加入全部平台资源。
  - 处置：六文件均保留 S-Forge 发布身份，加入 `publish: null`，同时保留 `appearance/covers` 与 `tiktoken`；修正 Linux x64 配置中 `syncDesktopName` 逸出 `linux` 映射的错误缩进。
  - 验证：六文件逐项断言品牌、禁发布、封面、tiktoken 和 Linux 可执行名；无冲突标记且 `git diff --check` 通过；文件已暂存。环境中没有可直接复用的 YAML 解析包，未为合并临时新增依赖；两次失败的校验尝试分别为缺少解析包和校验路径前缀错误，均发生在暂存前并已明确修正。

- [x] **2026-07-22：`app/nsis/installer.nsh` 生命周期融合**
  - 本地意图：S-Forge 默认安装目录、应用进程名、全局配置目录和默认工作空间目录；保留 Kernel CLI 硬链接与 PATH 安装/清理。
  - 上游意图：`68566144b` 为 #18258 增加安装阶段日志、进程清理返回值和失败位置记录；`e28b5623a` 删除与 Electron Builder 重复定义的 `customFiles_*`，把 payload 日志收口到 `customInstall`。
  - 处置：保留完整上游日志与栈平衡逻辑，将日志文件和待清理进程适配为 `S-Forge-install.log` / `S-Forge.exe`；保留本地安装、配置和工作空间路径；未恢复上游已删除的重复宏。
  - 验证：逐项断言两侧关键行为及重复宏不存在；无冲突标记且 `git diff --check` 通过；文件已暂存。当前环境未安装 `makensis`，最终打包语法验证需由现有构建链执行。

- [x] **2026-07-22：21 个 `app/appearance/langs/*.json` 结构化三方融合**
  - 三方结果：每种语言仅有 4 个本地独有新增键；上游各有 219 至 610 个独立新增/修改路径；双方异改路径为 0。
  - 本地意图：`addAllAiModels` 与代理自动探测三项；本地 AV 拆分模块当前仍调用 `insertRowTip`。
  - 上游意图：完整采用 3.7.3 的语言更新；`8050f0fc1` 用更通用的 `databaseItemFiltered` 承接大型数据库视图导航提示并删除旧 `insertRowTip`。
  - 处置：以上游完整对象为主体，在对象顶部加入 S-Forge 四键；将原先误用英文的代理三项补成 21 种对应语言；临时保留 `insertRowTip` 与上游 `databaseItemFiltered` 并存，待 AV 渲染冲突处理时迁移本地调用，避免资源先删导致缺文案。
  - 验证：结构化断言确认上游全部顶层值未丢失、本地 `addAllAiModels/insertRowTip` 未丢失、代理三键均存在；`scripts/check-lang-keys.py` 检查 21 文件、2240 个预期键，缺失与意外键均为 0；无冲突标记且 `git diff --check` 通过；21 文件已暂存。

- [x] **2026-07-22：`app/pnpm-lock.yaml` 进入受控重建状态**
  - 两侧锁文件备份已在 Phase 0 完成 blob 哈希校验；不手工拼接生成物。
  - `app/package.json` 依赖意图融合完成后，按规程将冲突锁文件暂存删除。
  - Phase 5 使用 `packageManager=pnpm@11.12.0` 重新生成，并核对 Electron、sharp、zxcvbn、Agent/MAGI 与本地链接包依赖。

- [x] **2026-07-22：`app/electron/main.js` 宿主与生命周期融合**
  - 本地意图：Linux Wayland IME 与国产桌面 X11 兼容、混合内容支持、`forge` Kernel 模式、MAGI 独立窗口及关闭语义。
  - 上游意图：Windows 开发协议注册、抖音 Referer、最大化窗口正常边界保存、去重 `--port`、Obsidian 目录对话框单例、`--lang` 快捷方式、系统关机安全退出/崩溃标记、更新安装全过程协调及残留 Kernel 处理。
  - 处置：变量区合并 MAGI 与上游关机/更新状态；启动区合并协议注册、`--lang` 隔离、Chromium 参数和 Linux 兼容；`initMainWindow` 使用上游端口快照；Kernel 进程采用上游端口快照/进程跟踪并保持 S-Forge `forge` 模式；更新安装锁优先于常规退出，随后设置 `isAppQuitting` 释放 MAGI 窗口。
  - 合并中发现：本地 `684385d` 曾把通用命令行块移到 `app.whenReady` 前，三方自动合并与顶部融合产生重复 `argStart` 声明；`node --check` 确定性复现后，保留满足协议与 Chromium 初始化时序的顶部实现，删除后置重复块。
  - 验证：`node --check` 通过；逐项断言上述本地与上游行为、禁止重复 `--port` 和禁止回退到 `dev` 模式；命令行解析块仅一份；无冲突标记且 `git diff --check` 通过；文件已暂存。
  - Lint 证据：`pnpm exec eslint electron/main.js --no-fix` 未通过，共 102 项，主体为当前配置没有声明 Electron/Node 全局及 CommonJS `require`，另有文件既有结构项；不记录为通过。该命令按 pnpm 11.12 自动补齐了升级依赖并生成工作区锁文件，但索引仍保持锁文件待最终核验重建的删除状态。

- [x] **2026-07-22：`app/src/constants.ts` 常量融合**
  - 本地意图：MAGI IPC、语义搜索、本地 Agent 工具和本地格式化后的完整常量集合。
  - 上游意图：块引用拖拽 MIME、更新安装 IPC、菜单快捷键属性、拖拽距离/鼠标延迟、三项 Dock 切换快捷键，以及 `IObject` 到 `Record<string,string>` 的类型收紧。
  - 处置：保留本地常量类和键位对象格式，逐项加入上游 7 组语义变更；没有用上游整文件覆盖本地常量。
  - 验证：逐项断言上游 7 组与本地 MAGI/语义搜索常量；无冲突标记且 `git diff --check` 通过；文件已暂存。定向 ESLint 仅报文件 855 行超过 300 行规则，未报告新增代码类别错误，不记录为 lint 通过。第一次行为校验因工作目录前缀重复而失败，修正路径后通过。

- [x] **2026-07-22：`app/src/dialog/processSystem.ts` 多宿主系统生命周期融合**
  - 本地意图：取消条件编译，以 `isMobile()`、`isElectron` 和平台适配层在同一产物中支持桌面、移动与 Web；`forceQuit()` 统一承接 Electron、Android、iOS、Harmony 和纯 Web 退出；保留可选插件集合及已拆分的 `kernelError` 模块。
  - 上游意图：`e4443a2ad` 在文件 Dock 尚未建立时避免引用计数更新崩溃；`68566144b` 与 `76512d844b` 将桌面更新安装交给 Electron 主进程协调并补齐浏览器退出；`1aae29eb1` 发布同步成功事件；`09bd20e44` 区分数据索引重建文案。
  - 处置：保留运行时宿主判断并加入 Dock 可选链；通过现有 `ipcInvoke` 适配层发起 `SIYUAN_INSTALL_UPDATE`，删除不可用的静态 `ipcRenderer` 与条件编译标记；非 Electron 安装退出及取消安装均复用 `forceQuit()`；同步成功事件置于移动/桌面分支前；保留上游 `rebuildDataIndex`。
  - 验证：六项行为断言覆盖无冲突标记、Electron IPC、禁止静态 `ipcRenderer`、Dock 空值保护、同步事件时序及取消路径宿主退出；`git diff --check` 通过；文件已暂存。
  - Lint 证据：`pnpm exec eslint src/dialog/processSystem.ts --no-fix` 仅报告该本地聚合文件原有的三项结构限制：`setDefRefCount` 62 行、`processSync` 69 行、文件 403 个实际代码行；没有本次融合新增的导入、类型或风格错误，不记录为 lint 通过，后续按本地模块拆分边界单独治理。

- [x] **2026-07-22：`app/src/dialog/index.ts` 与模板辅助模块一对多融合**
  - 本地意图：Dialog 已拆为构造、HTML、事件和生命周期模块，并增加全屏、自清理监听、Vue 标题、自定义关闭位置及非模态浮层能力；`index.ts` 只保留统一生命周期骨架。
  - 上游意图：`22fe2656f`、`f55096ab6`、`a6c0bff84` 针对 #18283 让默认外置关闭按钮仅在移动端显示、移动标题右侧保留 38px，并修复透明遮罩 `style` 属性前缺少空格。
  - 处置：删除误落入构造函数的上游旧模板块，将三项展示语义映射到 `dialogHelpers.html.ts`；默认外置按钮在桌面端隐藏，显式 `inside` / `inside-body` 扩展保持不变；保留本地非模态 Dialog、全屏和销毁生命周期。同步移除模板拆分后遗留的未使用 `isNotCtrl` 导入。
  - 验证：八项行为断言覆盖冲突清理、本地生命周期骨架、模板唯一承接位置、透明属性、桌面/移动关闭按钮、移动标题留白、自定义关闭位置和 AbortSignal 生命周期；`git diff --check` 通过；两个实现文件已暂存。第一次行为断言因 PowerShell 引号转义错误在检查前终止，改用精确片段断言后通过。
  - Lint 证据：未使用导入警告已修复。定向 ESLint 仍报告 `app/src/dialog` 现有 16 文件超过目录上限，以及 `Dialog.listen` 对 `EventTarget.addEventListener` 的四参数适配；已按项目既有格式标注 `第三方接口适配`，但当前规则同样未识别 `protyle/runtime/dialog.port.ts` 中既有的相同标注，因此不记录为 lint 通过。目录重组需在合并后按职责规划，避免在冲突处理中机械搬移共享模块。

- [x] **2026-07-22：`dialog/tooltip.ts` 与 `block/popover.ts` 跨拆分模块融合**
  - 本地意图：Tooltip 定位、DOMPurify、异步请求中止和 Block Popover 已拆分到 `dialog/tooltip.ts`、`block/popover.ts`、`block/popover/{tooltip,target,refDefs}.ts` 及实际使用的 `block/panel/Panel.editor.ts`；入口不再承载单体实现。
  - 上游意图：`9be711d63` 允许鼠标停留在可滚动 Tooltip 上；`d46e8de49` 更新虚拟引用查询契约，不再传当前块排除项；`7fdf7b349` 将思源链接中的 AV 条目/视图/分组传到浮窗并在编辑器加载后定位；`d6eb1878d` 阻止发布模式发起本地资源和镜像数据库受限请求。
  - 处置：移除 `tooltipTargetElement` 全局状态及所有转发，非触发区域仅在不是可滚动 Tooltip 时隐藏；`showTooltip` / `hideTooltip` 保持同步 DOM 时序并使用元组参数维持原调用 API；发布状态通过已有环境访问器注入两个请求边界；虚拟引用直接调用新服务端契约；URI 投影同时保留 `avItemID/avViewID/avGroupID` 和 URL 单元格 `dataset.href`。
  - 一对多消费链：实际 BlockPanel 使用 `block/panel/Panel.editor.ts`，因此在该路径补入当前增强版 `activateAVLocateWithRetry`，设置 `select: false`、`highlight: true`、`persistView: false`；同时补回拆分时遗漏的 `databaseAttr: true`，没有仅修改已不被入口使用的旧 `block/Panel.ts`。
  - 验证：九项行为断言覆盖同步 Tooltip 契约、全局状态删除、可滚动驻留、两类发布请求阻断、虚拟引用新契约、AV 字段投影、实际 Panel 定位和数据库属性；无冲突标记、旧依赖残留，`git diff --check` 通过；本紧密模块文件已暂存。
  - Lint 证据：本轮新增的参数数量、类型位置、无效导入、显式返回类型和条件注释问题均已修正。按用户指示不在合并阶段继续扩展既有 lint 架构改造；最后一次全批次检查仍包含旧有工厂约束、模块级 AbortController 状态和 `dialog` 目录数量限制，因此不记录为 lint 通过。

- [x] **2026-07-22：`app/src/asset/index.ts` 资源路径安全融合**
  - 本地意图：图片使用独立 Vue 组件渲染，PDF 使用 `PDFviewer.vue`，音频/视频保留轻量 HTML；运行时平台判断替代条件编译，并保留 PDF 标注页跳转。
  - 上游意图：`2229686df` 对进入 `img/audio/video src` 属性的资源路径执行 HTML 转义，修复路径含引号时的属性闭合注入风险。
  - 处置：保留本地 Vue PDF 与图片组件骨架；组件 prop 继续传真实路径，避免 HTML 实体破坏 URL；仅对仍通过 `innerHTML` 拼接的音频和视频计算统一 `escapedAssetURL`，复用上游的 `Lute.EscapeHTMLStr` 安全语义。
  - 验证：六项断言覆盖 Vue PDF、图片组件、音频转义、视频转义、禁止原始路径直接插值及 PDF 页跳转；无冲突标记且 `git diff --check` 通过；文件已暂存。定向 lint 仅报告本地既有的插件通知 `forEach` 和 Vue 重写后未使用的 `_isInit`，按合并阶段范围不继续扩展，不记录为 lint 通过。

- [x] **2026-07-22：`app/src/assets/scss/business/_custom.scss` 双功能样式融合**
  - 本地意图：保留 `[data-custom-assistant-name]` 对多 AI 生成内容的背景、左侧标记及代码块/表格差异化样式。
  - 上游意图：加入数据库属性、关系反链、行操作、窄容器布局及数据库条目面板的完整样式体系。
  - 处置：两组功能没有共享状态或参数化差异，直接保留各自完整选择器和内部规则；没有为表面去重而耦合两套独立界面。
  - 验证：断言本地 AI 选择器与上游反链、属性、行操作和条目选择器均存在；独立 Sass 编译通过；无冲突标记且 `git diff --check` 通过；文件已暂存。

- [x] **2026-07-22：移动样式入口与 iframe 交互样式融合**
  - 文件：`app/src/assets/scss/mobile.scss`、`app/src/assets/scss/protyle/_wysiwyg.scss`。
  - 本地意图：移动产物加载 Agent 面板样式；布局拖拽期间通过计数锁类为 iframe 覆盖交互遮罩，避免 iframe 截获拖拽事件。
  - 上游意图：移动产物加载首次使用引导；iframe 非文本块禁用文本选择，改善光标和选择行为。
  - 处置：移动入口同时导入 `ai_agent` 与 `onboarding`；iframe 规则同时保留条件遮罩和常态 `user-select: none`，二者作用时机与语义不同，不互相替代。
  - 验证：两侧导入和三项 iframe 行为断言通过；两个 SCSS 均独立完整编译通过；无冲突标记且 `git diff --check` 通过；文件已暂存。pnpm 仅输出既有 `pnpm.onlyBuiltDependencies` 字段迁移警告，不作为合并阶段阻断项，留待锁文件重建阶段统一核验。

- [x] **2026-07-22：`app/src/config/assets.ts` 缺失资源引用定位融合**
  - 本地意图：配置资源页已适配统一运行时平台判断、拆分后的 DOM/网络/编辑器工具、独立 Tab 插件入口和统一 i18n。
  - 上游意图：缺失资源返回引用块 ID；列表安全编码 ID，并提供按钮在移动端打开首个引用块、桌面端打开引用浮窗。
  - 处置：`escapeAttr/escapeHtml` 统一从本地 `util/DOM/escape` 导入；移动打开沿用 `openMobileFileById`；桌面浮窗映射到实际使用的 `block/panel/Panel`；用 `isMobile()` 运行时分流替换上游条件编译标记，保留同一构建产物的多宿主能力。
  - 验证：六项断言覆盖安全属性编码、引用 ID 数据、移动打开、桌面浮窗、运行时分流和真实拆分路径；无冲突标记且 `git diff --check` 通过；文件已暂存。定向 ESLint 仅报告该本地聚合模块既有的 4 个超长函数及 526 行文件限制，没有本次融合新增的导入或未定义符号问题；按合并阶段范围记录但不扩展拆分重构。

- [x] **2026-07-22：全局命令路由承接三项 Dock 固定切换**
  - 冲突文件：`app/src/boot/globalEvent/command/global.ts`；实际承接文件：`global/commands.ts`、`global/desktop/{index,navigation,imports}.ts`。
  - 本地意图：旧单体快捷键 `switch` 已拆为命令契约、根平台域、桌面职责子路由和具体执行器，并通过布局访问器隔离全局状态。
  - 上游意图：增加 `switchLeftDock`、`switchRightDock`、`switchBottomDock` 三项命令，分别调用对应 Dock 的 `togglePin()`。
  - 处置：没有恢复冲突中自动插入的上游旧单体 `switch`；将三项命令逐层加入本地命令常量、桌面域识别、桌面导航路由和执行器，执行器通过 `getSiyuanLayout()` 获取布局并精确切换对应方位。
  - 验证：三项命令均具备常量、主路由、子路由和执行分支；本次新增的 `else`、嵌套分支和分支注释 lint 已修复；无冲突标记且 `git diff --check` 通过，相关文件已暂存。定向 ESLint 剩余项仅为本地现有 CaliburRouter/命令对象的模块级可变状态规则，不在合并阶段改写路由初始化架构。

- [x] **2026-07-22：`app/src/config/util/snippets.ts` 移动端 Dialog 适配融合**
  - 本地意图：网络与平台工具已迁移到职责子目录，配置功能使用运行时平台判断。
  - 上游意图：代码片段 Dialog 在移动端使用全视口并为标题栏预留关闭按钮空间；精确选择标题输入框，并调整发布服务开关布局。
  - 处置：从本地真实 `util/platform/functions` 同时导入 `isMobile` 与 `objEquals`；保留自动合入的全部上游 Dialog 尺寸、输入选择器和发布开关变更。
  - 验证：五项行为断言覆盖平台导入、移动宽高、精确输入选择器及发布开关；无冲突标记且 `git diff --check` 通过；文件已暂存。定向 ESLint 仅报告既有 `openSnippets` 及其回调超过函数长度限制，没有本次融合新增问题。

- [x] **2026-07-22：`app/src/boot/globalEvent/event.ts` 全局交互事件融合**
  - 本地意图：保留统一构建产物的 `isBrowser` 运行时分支，以及迁移后的平台、网络和触摸桥工具路径。
  - 上游意图：用户交互为加密笔记本续期且发布模式不触达；Tab 拖拽提前停止滚动；标题/列表项拖拽时控制浮动文件 Dock；触摸结束先取消手动桥接，并以位移、长按阈值和最近指针类型决定是否合成右键菜单。
  - 处置：合并触摸桥三个 API，并将 `isWindow`、`fetchPost` 映射到本地 `util/platform`、`util/network`；保留 `isBrowser`；其它上游事件行为完整保留。`touchDragBridge.ts` 实现冲突单独作为下一紧密步骤处理。
  - 验证：十项断言覆盖两侧导入、发布阻断、续期 API、Tab 拖拽、文件 Dock、桥接取消和鼠标来源判断；无冲突标记且 `git diff --check` 通过；文件已暂存。定向 ESLint 仅报告既有事件聚合函数及 dragover 回调超过函数长度限制，没有本次融合新增问题。

- [x] **2026-07-22：`app/src/util/touchDragBridge.ts` Touch/Pointer 状态机融合**
  - 本地意图：相对共同基线仅把旧实现的部分单行早返回机械改为花括号块；没有独有业务行为。旧桥已包含表格、AV、块宽、背景图和标签拖拽白名单。
  - 上游意图：以 `LongPressGate`、`DragState` 和 `manualState` 重写为统一 Touch/Pointer 双路径状态机，区分鼠标合成触摸，支持 Android 外接鼠标、拖拽延迟、滚动让行、手动 mouseup 清理及完整 cancel 生命周期。
  - 处置：以上游统一状态机为骨架，删除冲突中旧 `manualTouchActive`、`handleManualTouch*` 和 `handleDrag*` 重复实现；确认上游白名单已完整覆盖本地旧行为，没有并存两套状态机。保留两处本地花括号风格并修正缩进。
  - 验证：十一项关键契约断言覆盖门禁、Touch/Pointer、继续/结束、取消、输入源导出和表格白名单；断言旧状态、旧函数名和旧阈值常量均不存在；无冲突标记且 `git diff --check` 通过；文件已暂存。定向 ESLint 仅报告上游新状态机 429 个实际代码行及 `handleTouchStart` 58 行，不在合并阶段拆分刚落地的交互状态机。

- [x] **2026-07-22：`app/src/boot/globalEvent/dragover.ts` 双轴拖拽滚动融合**
  - 本地意图：将 ghost 清理拆为 Dock/通用路径，补齐父元素和滚动状态空值保护，以 `undefined` 表示可选动画状态。
  - 上游意图：`dragOverScroll` 增加可选横/纵方向，横向使用左右边缘和 `scrollLeft`；目标元素或方向变化时停止旧动画并启动新动画。
  - 处置：保留本地清理骨架与 `undefined` 状态，加入 `direction`；采用上游完整双轴位置和速度算法，并用早返回扁平化新增控制流，删除冲突后残留的旧纵向重复计算。
  - 验证：九项断言覆盖本地清理、方向状态、状态复位、空值保护、双轴滚动和目标/方向切换；本次融合产生的 `else` 与嵌套分支 lint 已清零；无冲突标记且 `git diff --check` 通过；文件已暂存。后续 lint 剩余为本地既有函数/导出注释要求，以及上游兼容调用新增的第 4 个可选 `direction` 参数；合并阶段不改造全部调用协议，也不添加缺乏依据的豁免。

- [x] **2026-07-22：`app/src/config/tabs/aiTab.ts` AI 配置组并集注册**
  - 本地意图：增加独立 `ai.commandReview` 模型选择与超时配置，供 Agent Bash 命令审核使用。
  - 上游意图：增加 Agent 流空闲超时、视觉理解、图像生成、嵌入测试/维度和重排模型配置。
  - 处置：保留当前前端与 Kernel 共同消费的 `window.siyuan.config.ai` 配置模型；注册顺序中同时保留命令审核、视觉、图像生成、MCP、嵌入和重排组，没有按“新旧配置”推断替换任何一组。
  - 验证：十三项配置路径与注册调用断言通过；无冲突标记且 `git diff --check` 通过；文件已暂存。定向 ESLint 仅报告上游扩展后的 `registerAiAgentGroup` 53 行和 `registerAiEmbeddingGroup` 57 行超过函数长度限制，没有本次融合新增配置问题。

- [x] **2026-07-22：`app/src/config/tabs/appearanceTab.ts` 外观与宿主生命周期融合**
  - 本地意图：保留 `isElectron` 驱动的字体与本地路径能力，以及本地配置构建器重构。
  - 上游意图：字体范围扩至 9-72；增加通知细粒度开关；桌面/移动模式切换后走正常退出并由用户重启；移动端通过统一入口打开代码片段社区。
  - 处置：同时保留 `isElectron` 与已融合的 `exitSiYuan`；保留上游自动合入的通知、字体范围、模式切换提示和 `openByMobile` 行为；明确禁止恢复直接 `window.location.href` 重载。
  - 验证：十一项行为断言覆盖双方宿主能力、字体范围、通知 Dialog、正常退出和移动链接；旧直接重载路径不存在；无冲突标记且 `git diff --check` 通过；文件已暂存。定向 ESLint 的 8 项均为该 608 行本地聚合模块既有的文件/函数长度限制，没有本次融合新增问题。

- [x] **2026-07-22：`app/src/config/tabs/fileTab.ts` 文件树配置职责融合**
  - 本地意图：桌面配置中提供文件树内部设置的独立 Tab 入口；移动 Kernel 容器不注册桌面文件树组。
  - 上游意图：原标签交互组改为行为组，增加文档图标与父文档点击展开开关；增加顶层笔记本文档设置并在保存后刷新对应文件树。
  - 处置：拆成两个明确组：`tabs` 仅承接本地独立入口，`behavior` 承接上游与原文件树交互配置；非移动 Kernel 容器同时注册。`setNoteBook` 映射到本地 `util/file/pathName`，回调通过运行时容器判断刷新移动 Dock 或桌面模型，移除条件编译标记。
  - 验证：十五项断言覆盖双方导入、两个组、四项关键设置、两类刷新和双组注册；不存在条件编译残留；无冲突标记且 `git diff --check` 通过；文件已暂存。定向 ESLint 仅报告两个既有长注册函数及文件 302 个实际代码行（超限 2 行），按合并阶段范围不重拆配置模块。

- [x] **2026-07-22：`app/src/config/tabs/accessTab.ts` 访问与加密笔记本配置融合**
  - 本地意图：认证码入口使用本地 `setAccessAuthCode`；Electron 外链通过平台适配器打开，非 Electron 宿主不静态依赖 Electron shell。
  - 上游意图：增加加密笔记本启停、主密码强度/修改、备份导入导出、迁移待完成提示、空闲自动锁及后端拒绝时 UI 回滚；移动宿主使用 `openByMobile`。
  - 处置：同步/异步请求与平台判断映射到本地 `util/network`、`util/platform`；同时保留 `isElectron/openExternal/setAccessAuthCode` 与 zxcvbn/加密 Dialog；本地服务器链接使用运行时 `isElectron ? openExternal : openByMobile`，不恢复静态 shell 和条件编译。
  - 验证：十六项断言覆盖双方导入、密码强度、加密状态/启停/备份/改密/自动锁 API 及两类链接路径；无条件编译和静态 shell 残留；无冲突标记且 `git diff --check` 通过；文件已暂存。定向 lint 发现并删除本次无消费的 `Constants` 导入；剩余 7 项均为完整加密设置合入后的文件/函数长度限制，合并阶段不拆分该功能链。

- [x] **2026-07-22：`app/src/config/index.ts` 设置入口与 Bazaar 拆分映射**
  - 本地意图：设置入口使用 imports 网关、运行时移动判断、延迟注册文件树 Tab，以及拆分后的 `config/bazzar` 面板和 `_renderReadme(type, data, downloaded)` 契约。
  - 上游意图：移动端可直接打开指定设置 Tab；Bazaar README 支持社区/已下载来源，受信任门禁保护，使用真实 frontend 缩小查询，并对缺包显示安全转义后的可见错误。
  - 处置：向细粒度 config imports 网关加入 `getFrontend/showMessage/escapeHtml`；移动菜单因 `popMenu()` 与菜单初始化均为同步，直接激活目标项，删除上游无依据的固定 200ms 延迟；资源 URL 表扩展为 `bazaar/downloaded` 两类，旧三参数调用默认社区来源；设置页挂载后调用本地 `_renderReadme`，没有恢复已删除的旧 Bazaar 单体或调用其不存在的 `switchBazaarTab`。
  - 验证：十项断言覆盖本地拆分入口、移动 Tab、两类 URL、信任门禁、frontend、缺包提示和下载态渲染；不存在旧单体导入、未实现方法、固定延迟或条件编译；无冲突标记且 `git diff --check` 通过，入口与 imports 网关已暂存。定向 lint 中本次新增的嵌套判断、固定延迟和信任分支注释问题已修复；其余为本地既有函数/导出注释、目录数量和上游四参数公共签名规则，不扩展重构。

- [x] **2026-07-22：删除冲突 `app/src/config/bazaar.ts` 的一对多行为归并**
  - 本地意图：旧 1200 行 Bazaar 单体已删除，实际功能拆到 `config/bazzar/{bazaar,bazaarRender,bazaarInstallHandlers,...}.ts`；设置入口只消费拆分对象。
  - 上游意图：`76797cf18` 攭善 URI 打开社区/已下载 README 的来源隔离；`f58018555` 调整插件系统全局禁用交互，只隐藏设置入口而不禁用整卡，插件加载完成后重绘列表，并在事件层阻断禁用状态下打开设置。
  - 处置：URI 来源、信任门禁、已安装查询及下载态 README 已在 `config/index.ts` 映射；拆分渲染器改为仅为真实存在设置能力的插件生成设置动作，插件系统禁用时隐藏动作且不添加整卡禁用类；安装、单插件启用和全局启用均在 `loadPlugin(s)` 完成后重绘插件列表；设置动作处理器再次检查全局禁用状态。完成映射后保留本地对旧单体的删除。
  - 验证：全仓仅 `setting/tabs.ts` 和 `config/index.ts` 消费 `config/bazzar`，没有旧 `config/bazaar` 消费者；断言整卡禁用旧行为不存在、五项插件设置/加载行为存在；无冲突标记且 `git diff --check` 通过；拆分实现与删除已暂存。定向 ESLint 仅报告拆分模块既有文件/函数长度规则，没有新增未定义、无效导入或控制流问题。

- [x] **2026-07-22：`app/src/emoji/index.ts` 动态图标解析去重融合**
  - 本地意图：Emoji 单体已拆分，动态图标 URL 状态解析由 `emoji.dynamic.ts` 的 `parseDynamicState()` 唯一承接。
  - 上游意图：将旧内联动态图标对象从 `IObject` 放宽为 `Record<string, any>`，不改变默认值或 URL 参数解析行为。
  - 处置：保留本地类型更强的 helper 调用；不复制上游功能完全相同的内联对象与 `URLSearchParams` 解析，避免形成两套实现。
  - 验证：断言 helper 导入、解析调用及事件绑定存在，旧内联 URL 解析不存在；无冲突标记且 `git diff --check` 通过；文件已暂存。

- [x] **2026-07-22：`app/src/history/history.ts` 历史索引专用文案融合**
  - 本地意图：历史模块使用统一 `siyuanI18n` 访问器，不直接散落读取全局语言对象。
  - 上游意图：索引重建按钮使用专用 `rebuildHistoryIndex`，与数据索引等其它重建操作区分。
  - 处置：采用 `${siyuanI18n.rebuildHistoryIndex}`，同时保留本地 i18n 边界与上游专用语义。
  - 验证：中英文语言资源均存在该键；固定文本断言、无冲突标记和 `git diff --check` 通过；文件已暂存。首次 PowerShell 断言把模板字面量误解析为路径，改用固定文本检索后通过，未产生代码变更。

- [x] **2026-07-22：`app/src/editor/deleteFile.ts` 加密笔记本文档查询融合**
  - 本地意图：删除确认文案、响应处理和批量路径收集已拆为小函数；编辑器跨目录依赖通过 `editor/imports.ts` 网关转发。
  - 上游意图：查询待删除文档信息时，若属于加密笔记本则附带 notebook ID，使 Kernel 选择 InBox 块树与内容数据库。
  - 处置：`isEncryptedBox` 当前在 `util/pathName.ts` 只有一份实现且被大量上游调用，编辑器网关转发该唯一实现，不复制到拆分路径；`deleteFile` 构造带可选 notebook 的参数并继续复用本地 `handleDocInfoResponse`，没有恢复重复确认文案。
  - 验证：五项断言覆盖网关、加密判断、notebook 参数和本地响应 helper；本次新增分支注释 lint 已修复；无冲突标记且 `git diff --check` 通过，文件与网关已暂存。定向 ESLint 最终仅剩 `editor` 目录 22 文件超过目录数量限制，合并阶段不搬迁整目录。

- [x] **2026-07-22：`app/src/protyle/ui/padding.ts` 水平边距算法去重与导出**
  - 本地意图：保留 Protyle 移动端、打字机模式、背景/标题同步和宽度 CSS 变量应用；原水平算法为本地私有函数。
  - 上游意图：新增可复用 `getEditorHorizontalPadding(width, fullWidth)`，供数据库行/属性面板共享。
  - 处置：将两侧完全一致的黄金比例/96px/24-16px 算法合并为唯一导出函数；`getPadding` 读取 Protyle 自定义全宽属性后调用该函数，保留本地宿主和 DOM 应用逻辑，没有保留重复算法。
  - 验证：断言唯一 helper、全宽属性、移动/打字机分支及宽度变量；修复冲突清理时遗漏的 `setPadding` 闭合并通过 ESLint 语法解析；新增控制流 lint 已扁平化。剩余仅项目导入注释和同步导出架构规则，后者不能形式化改 async，否则会破坏现有同步调用链；无冲突标记且 `git diff --check` 通过；文件已暂存。

- [x] **2026-07-22：`app/src/protyle/ui/initUI.ts` 上游增量一对多映射**
  - 本地意图：400 行 UI 单体已拆为 `dom.ts`、`event.ts`、`loading.ts`、`padding.ts`，`initUI.ts` 只顺序调用唯一初始化链。
  - 上游意图：挂载数据库属性面板；选择层增加容器；toolbar 缩放触发尺寸回调；移动端外接鼠标支持 hover 且隔离数据库属性面板；嵌入块 gutter 使用操作上下文；gutter 按钮通过 `getNodeElement` 定位；属性面板边距与正文对齐。
  - 处置：DOM、事件和 padding 行为分别映射到对应拆分模块；`initUI.ts` 以已审计本地薄入口重建，没有保留上游单体，避免 DOM/事件/padding 各初始化两次。移动端只响应 `pointerType=mouse` 的 pointerover；手指和触控笔不触发桌面 gutter。
  - 验证：十一项跨模块断言覆盖属性面板、选择容器、resize、嵌入上下文、移动 pointer、属性隔离、gutter 定位、边距和薄入口调用；无冲突标记且 `git diff --check` 通过，四个模块已暂存。联合 ESLint 中本次 toolbar 分支注释已修复；剩余为 `event.ts` 合入后 314 行、薄入口既有导出注释及 padding 同步导出架构规则，合并阶段不作额外拆分或形式化异步改造。

- [x] **2026-07-22：`editor/openLink.ts` 与 `protyle/util/compatibility.ts` 唯一移动链接实现融合**
  - 本地意图：编辑器链接入口依赖 `editor/imports.ts` 与拆分后的 `utils.openBy`、`util.openAsset`；`openByMobile` 唯一实现位于 Protyle compatibility 层并由编辑器重新导出；平台与 IPC 使用运行时适配，不恢复条件编译。
  - 上游意图：所有链接在常规本地/外部分流前识别 SiYuan URI；iOS 16.7 前打开资产时只编码路径、保留 `?box=...` 等查询参数；新增 `initWindowOpenOverride` 统一接管 SiYuan URI，并允许移动原生宿主注入外链处理器。
  - 处置：保留本地拆分骨架，在 `openLink` 中以 `protyle.app` 优先调用本地唯一 `processSiYuanUri`；删除冲突中的第二份 `openByMobile`，将 iOS path/query 修复迁入 compatibility 层唯一实现；保留 `initWindowOpenOverride`，改用本地平台常量、URI 处理器和 Dialog Port，不恢复动态导入的旧 `util/uri` 平行实现。
  - 验证：两个文件均无冲突标记；全仓排除审计备份后仅一处 `export const openByMobile`；五项断言覆盖 SiYuan URI 前置处理、路径单独编码、查询原样附加、窗口覆盖和宿主外链注入；定向 ESLint 可完成语法解析，报告 13 项既有参数/注释/大文件规则，没有解析错误。遵照合并阶段边界未围绕这些规则重构；`git diff --cached --check` 通过，两个文件已暂存。

- [x] **2026-07-22：`app/src/editor/index.ts` 编辑器初始化增量映射**
  - 本地意图：Editor 使用 `IEditorOptions` 与 `editor/imports.ts`，Protyle 初始化保留在本地 helper 中，并通过运行时平台适配更新窗口模型状态，不恢复继承旧 Model 和条件编译。
  - 上游意图：编辑器 Protyle 启用数据库属性面板；恢复布局时将加密笔记本 `notebookId` 从 Editor 透传给 Protyle。
  - 处置：在本地 helper 的参数、Protyle 选项和调用处贯通 `notebookId`，并设置 `databaseAttr: true`；向唯一 `IEditorOptions` 增加可选字段。同步修正该 helper 回调读取不存在的 `options.status`，改为读取刚创建的 `editor.protyle.options.status`，没有恢复上游重复私有初始化函数。
  - 验证：五项断言覆盖数据库属性、三段 notebook 透传与真实 status 来源；无冲突标记且 `git diff --cached --check` 通过，入口与类型文件已暂存。定向 ESLint 仅余本地既有的 Protyle 工厂命名规则和 editor 目录数量规则，按合并阶段边界不扩展重构。`protyle/index.ts` 对 notebook 字段的最终接收仍在其待处理冲突中，保留为后续链路验收项。

- [x] **2026-07-22：`app/src/editor/util.ts` 上游增量向拆分模块一对多映射**
  - 本地意图：`util.ts` 只负责打开流程编排，已打开对象查找、未初始化页签、编辑器切换、大纲、反链、面板同步、按 ID 打开和系统路径打开分别由 `util.*.ts` / `utils.*.ts` 唯一实现；新页签创建位于 `layout/utils/newTab.ts`。
  - 上游意图：数据库行页签以 `avID + itemID` 作为稳定身份；`openNewTab` 时禁止复用已打开/未初始化/分屏页签；自定义内置模型统一走恢复工厂；加密笔记本的动态正文、大纲和反链请求携带 notebook；未初始化页签继续保存 `scrollPosition`。
  - 处置：重建本地薄编排入口并增加四项 facade 转发，现有消费者无需切换导入路径且没有复制实现；唯一自定义页签身份函数由已打开和未初始化查找共同使用；分屏复用显式受 `openNewTab` 控制；三个请求分别在其职责模块附加加密 notebook。新建页签补入专用数据库行模型，并恢复两类 Editor 创建与未初始化数据的滚动位置透传。由于本地 TabRegistry 的通用 Custom 生命周期不能表达数据库行模型的 ghost Protyle/ResizeObserver 销毁语义，这一真实差异保留专用工厂，不强行参数化合并。
  - 验证：十项行为断言覆盖数据库行身份、强制新页签、三类 notebook 参数、专用模型、两段滚动位置和 facade；全仓四项能力各仅一处 `export const` 实现；相关文件无冲突标记且 `git diff --cached --check` 通过，十个文件已暂存。定向 ESLint 中本轮新增的 `any`、类型断言、嵌套分支和分支说明问题已清理；剩余为拆分模块既有同步导出、参数数量及旧分支说明规则，遵照合并阶段范围不继续扩展。

- [x] **2026-07-22：`app/src/layout/Tab.ts` 动态图标属性转义融合**
  - 本地意图：Tab 使用布局生命周期接口、运行时 Electron IPC、跨 iframe 拖拽交互锁及拆分后的平台/DOM 工具。
  - 上游意图：动态 `options.icon` 进入 SVG `xlink:href` 前同时转义 HTML 与属性引号，阻断恶意图标参数闭合属性。
  - 处置：保留本地完整 Tab 骨架，直接复用 `util/DOM/escape.ts` 现有 `escapeAttr` 与 `escapeHtml` 组合；没有恢复旧 `util/escape`、静态 Electron 或第二套转义函数。
  - 验证：五项断言覆盖双重转义、拖拽锁与运行时 Electron 分支；无冲突标记且 `git diff --cached --check` 通过，文件已暂存。定向 ESLint 仅报告本地既有 85 行构造函数限制，合并阶段不为单行安全修复重拆 Tab 生命周期。

- [x] **2026-07-22：`app/src/layout/Wnd.ts` 页签横向拖拽滚动一对多映射**
  - 本地意图：Wnd 的 header/drop 与面板分屏拖拽已分别委托给 `Wnd.drag.ts`，主类只绑定一次事件；运行时 Electron、布局生命周期和模型销毁均由本地适配层承接。
  - 上游意图：页签拖拽经过横向溢出的 tab bar 时调用 `dragOverScroll(..., "x")`，允许自动左右滚动。
  - 处置：删除冲突中会与本地委托重复注册的旧单体 header/drop 监听器；在实际唯一 `bindHeaderDragEvents` 的页签拖拽分支中获取 tab bar 边界并调用已融合的双轴 `dragOverScroll`。
  - 验证：四项断言覆盖两类唯一绑定、横向参数和 dragover 监听；主类及拖拽模块无冲突标记，`git diff --cached --check` 通过并已暂存。定向 ESLint 仅报告两个文件既有长函数/文件规则，没有本次映射产生的解析或控制流错误。

- [x] **2026-07-22：`app/src/layout/tabUtil.ts` Custom 页签复制统一恢复链**
  - 本地意图：`setTabPosition` 已拆到 `window/setHeader.ts`，包含 macOS/全屏/窗口按钮安全区与类型守卫；TabRegistry 是通用 Custom 扩展点，布局恢复由 `newModelByInitData` 统一编排。
  - 上游意图：窗口按钮右侧间距修正 4px；复制 Custom 页签改为调用 `newModelByInitData`，从而支持数据库行等内置模型。
  - 处置：保留并重新导出本地更完整的唯一 `setTabPosition`，不恢复旧 100 行平行布局算法；`copyTab` 统一传递 `instance/customModelType/customModelData` 给 `newModelByInitData`，删除原注册表、卡片和插件三段重复分派。数据库行的实际内置恢复将随 `layout/util.ts` 冲突闭合。
  - 验证：六项断言覆盖唯一布局入口、统一模型工厂、旧分派删除及本地窗口安全区；无冲突标记且 `git diff --cached --check` 通过，文件已暂存。定向 ESLint 仅剩该文件既有长函数/文件规则，未围绕它们扩展拆分。

- [x] **2026-07-22：`app/src/layout/util.ts` 布局恢复增量向拆分模块映射**
  - 本地意图：`layout/util.ts` 是兼容 facade 与唯一模型恢复工厂；反序列化、序列化、URL 恢复、窗口和 UI 已拆到独立模块；TabRegistry 承接通用 Custom，内置模型保留自身生命周期。
  - 上游意图：关闭的加密笔记本不恢复 Editor/数据库行；数据库行视为内置 Custom 并可创建专用模型；AV URL 恢复排队并激活条目定位；布局完成统一调用 `afterLayoutReady`；序列化仅在 Editor 三项身份完整时落盘，并保存/恢复 `databaseRowId`；Editor 恢复透传 notebook。
  - 处置：以本地 180 行 facade 重建冲突入口，未保留旧 800 行单体。加密门禁进入反序列化分发前，缺失插件过滤排除卡片与数据库行，AV 定位进入 URL helper，布局就绪替换逐插件旧循环；Editor 序列化和唯一 `newModelByInitData` 工厂分别保存/恢复 notebook、databaseRowId 与属性面板状态。数据库行继续使用专用模型以保持 ghost Protyle、ResizeObserver 和销毁生命周期，不强行塞入通用 Custom 注册回调。
  - 验证：九项行为断言全部通过；全仓布局目录仅一处 `export const newModelByInitData`；五个相关模块无冲突标记且 `git diff --cached --check` 通过并已暂存。定向 ESLint完成语法解析；本轮新增的嵌套/else 与回调说明已处理，剩余为拆分模块既有显式返回类型、同步导出和结构规则，合并阶段不继续扩展。

- [x] **2026-07-23：`app/src/layout/topBar.ts` 工具栏恢复标题融合**
  - 本地意图：工作空间名称来自平台解耦入口，同时保留 Bazaar Hub、独立 i18n、运行时 Electron IPC 与安全的交通灯位置检查。
  - 上游意图：工具栏从隐藏切回显示时，以当前聚焦页签文本恢复窗口标题；没有页签标题时回到工作空间标题。
  - 处置：只从唯一标题模块引入 `setTitle`，保留本地 `getWorkspaceName` 来源及全部宿主能力；未引入冲突中的第二份工作空间名称实现。
  - 验证：五项断言覆盖标题恢复、本地 Bazaar/i18n 与唯一导入；无冲突标记且 `git diff --cached --check` 通过，文件已暂存。定向 ESLint 仅报告既有长函数/文件规则，合并阶段不展开。

- [x] **2026-07-23：`app/src/layout/dock/Tag.ts` 标签过滤与内嵌编辑器融合**
  - 本地意图：Tag 使用拆分的 HTML/排序/事务 helper，并允许展开标签搜索结果后直接挂载可编辑 Protyle；Tree、配置、菜单和网络访问均走本地适配层。
  - 上游意图：标签面板支持多关键词即时过滤、输入法组合事件、完整数据补载、并发刷新合并，以及过滤前后展开状态恢复。
  - 处置：保留本地 Protyle 展开与拆分骨架，复用唯一 `tagFilter.ts` 算法接入完整过滤状态机；HTML helper 增加紧凑搜索控件。刷新或过滤替换 Tree DOM 前统一销毁内嵌编辑器，避免残留 Protyle、观察器与 DOM 引用；没有恢复上游旧构造函数。
  - 验证：四项 `node:test` 覆盖关键词拆分、全关键词匹配、祖先保留和 HTML 实体匹配，全部通过；九项行为断言覆盖 UI、IME、并发、展开状态、过滤算法和编辑器销毁；无冲突标记且 `git diff --cached --check` 通过，相关文件已暂存。定向 ESLint 仅剩 Tag 文件长度及辅助文件既有注释/返回类型规则，合并阶段不扩展处理。

- [x] **2026-07-23：`app/src/layout/dock/Bookmark.ts` 书签过滤、拖放与内嵌编辑器融合**
  - 本地意图：Bookmark 项可展开为可编辑 Protyle，面板依赖本地拆分后的 Tree、网络、菜单与编辑器入口。
  - 上游意图：加入多关键词过滤、IME、并发刷新合并、过滤前后展开状态恢复，以及 block ref、gutter、file、tab 四类书签拖放和 `updateAttrs` 刷新。
  - 处置：保留内嵌 Protyle 与其独立生命周期；Tree 数据替换和折叠前销毁编辑器。完全一致的纯过滤算法只保留在 `bookmarkFilter.ts`，拖放状态机因与过滤/编辑器没有共享状态，独立为 `BookmarkDropController`；外部 JSON 与属性事务通过细粒度 guard 校验，不用类型断言信任载荷，也不静默吞掉解析错误。
  - 验证：Bookmark 过滤 3 项与 Tag 回归 4 项 `node:test` 共 7/7 通过；无冲突标记，`git diff --cached --check` 通过，6 个相关实现/测试文件已暂存。定向 ESLint 确认本轮原有类型断言和 `else` 已清理；剩余为目录容量、注释密度、`Bookmark.ts` 325 行及纯过滤 helper 形式规则，遵照合并阶段边界不继续扩散结构调整。

- [x] **2026-07-23：`app/src/layout/dock/Backlink.ts` 加密笔记本读取隔离融合**
  - 本地意图：保留 Tree、网络、菜单、编辑器入口和 i18n 的拆分路径，以及反链结果中的内嵌 Protyle 编辑能力。
  - 上游意图：加密笔记本反链查询必须携带 notebook，使 Kernel 走 box 级独立数据源；首次查询时从当前编辑器确定 notebook。
  - 处置：以本地完整 Backlink 为骨架接入 `isEncryptedBox` 和当前编辑器查找。将上游只检查 `rootId` 的逻辑修正为 `rootId || blockId`：本地反链 Tab 使用前者，构造时没有 `rootId` 的固定 Dock 使用后者；只在确定为加密笔记本时附加 notebook，不增加失败回退请求。编辑器切换触发的另一条查询继续由已融合的 `util.updateBacklinkGraph.ts` 唯一承接相同隔离语义。
  - 验证：七项行为断言覆盖本地拆分路径/i18n、加密判断、两类根 ID 和 notebook 参数；无冲突标记且 `git diff --cached --check` 通过，文件已暂存。定向 ESLint 仅报告该既有 685 行单体及五个长函数限制，没有新增类型、导入或控制流问题，合并阶段不重构整个面板。

- [x] **2026-07-23：`app/src/layout/dock/Files.ts` 24 项上游增量向拆分文件树一对多映射**
  - 本地意图：约 1700 行旧单体已拆为薄主类、初始化、HTML、事件、拖放、树导航、WebSocket 和菜单模块；各状态机只在职责模块内维护。
  - 上游意图：加密笔记本创建/解锁/锁图标；顶层笔记本文档；文档图标与标题动作；空子项同步；文档树折叠动画；路径循环保护；文件树/笔记本手工排序事件；Agent 触发的笔记本重命名同步；专用数据索引文案；移除首次启动自动挂载帮助文档。
  - 处置：以本地 228 行主类为骨架，将上游 24 个提交逐项投影到 19 个实际模块。新增 `docActions.ts` 作为 WebSocket、设置和移动操作的唯一文档动作 DOM 投影；新增 `sortRefresh.ts` 承接两类排序事件；保留上游唯一 `fileTreeAnimation.ts` 并接入 toggle/getLeaf/onLsHTML。顶层文档统一使用 notebook ID，不恢复过渡期 `boxDocID`；加密能力按配置显式显示；关闭区解锁使用当前 Files 实例 App。首次启动 `mountHelp` 已按上游删除。
  - 关键融合修正：本地发布权限菜单原判断为 `!publish.enable`，按实际功能语义及上游实现修正为启用发布时显示；外部文档 JSON/拖放仍由原职责模块处理。完全一致的 `genNotebook/genFileHTML`、展开动画与动作计算各保留唯一实现，没有把上游旧单体并存进主类。
  - 验证：17 项行为断言覆盖薄宿主、顶层文档、加密、图标/标题动作、动画、循环检测、排序、重命名、子项同步、索引文案及 gutter 首项语义，全部通过；19 个相关模块以 esbuild 独立解析打包通过；关键 lint 分类（解析、未使用、断言、未定义、`else`、导入）无结果；无冲突标记且 `git diff --cached --check` 通过，相关文件已暂存。全量 `tsc` 被其它 128 个待解冲突标记阻断，不记录为通过；其余 lint 主要为既有注释/参数/函数长度规则，合并阶段不扩散治理。

- [x] **2026-07-23：`app/src/layout/dock/index.ts` 上游 Dock 状态增量向拆分模块映射**
  - 本地意图：Dock 构造、拖放、尺寸、离开事件、布局、模型切换和数据恢复均已拆分，主类只编排唯一初始化链；保留 S-Forge 扩展 Dock 注册和 `ILayoutModel` 契约。
  - 上游意图：拖拽启动阈值使用 `Constants.SIZE_DRAG_THRESHOLD`；固定/浮动切换始终重置 Dock 位置和透明度；隐藏状态移除布局外边距；左右 Dock 保持 8px 最小高度。
  - 处置：恢复本地薄构造器，未保留上游旧单体中的第二套 DnD、resize 和 mouseleave 监听。阈值常量映射到唯一 `dock.dnd.ts`；其余三项状态语义进入主类已有 `togglePin/resetDockPosition`。同时删除自动合并造成的浮动切换重复 reset。
  - 验证：8 项断言覆盖拆分初始化、单事件链和四项上游行为；`index.ts` 与 `dock.dnd.ts` 独立 esbuild 解析通过；关键 lint 分类为空；无冲突标记且 `git diff --cached --check` 通过，两个文件已暂存。

- [x] **2026-07-23：Agent 会话面板删除/修改冲突的一对多映射**
  - 本地意图：旧 `AgentSessionPanel` 类已删除，会话面板拆为 `session-panel/controller.ts`、`view.ts`、types、菜单和目录动作模块；支持目标过滤、任务目录、独立生命周期和可测试视图。
  - 上游意图：会话标题重命名输入在 IME 组合期间不响应 Enter/Escape，避免中文输入被提前提交或取消。
  - 处置：保持旧类删除，将 `event.isComposing` 门禁映射到 `session-panel/view.ts` 唯一重命名 keydown 处理器；没有恢复第二套会话面板。搜索输入既有 IME 处理继续保留。
  - 验证：旧类排除审计备份后无消费者；新 controller/view 独立 esbuild 解析通过；关键 lint 分类为空；`git diff --cached --check` 通过，删除冲突已闭合并暂存。

- [x] **2026-07-23：Agent 会话认证、目标能力与检查点并发语义融合**
  - 本地意图：`SessionStore.ts` 作为统一网络入口，类型集中在唯一 `SessionStore.types.ts`；所有请求动态合并工作空间 API token 与 MAGI owner token；会话列表支持 `targetKind`；保留任务目录 capability 的列举、绑定、追加和解绑。
  - 上游意图：会话保存使用 checkpoint v2、revision 前置条件和深拷贝快照；同会话写入串行排队；读取拒绝旧 revision 覆盖当前状态；恢复运行时 revision 独立比较；删除等待未完成保存；保存与删除错误显式抛出。
  - 处置：以本地职责拆分为骨架，将上游消息上下文、工具状态和恢复字段并入唯一类型文件；保存/删除请求统一合并 app、checkpoint、工作空间与 owner 认证头，任务目录请求只附 app 与认证头。保留目标过滤和全部目录 API。删除上游 `waitForPendingSave` 的空 `catch`，使保存失败确定性阻断后续读取和删除并传播原错误，禁止以旧服务端状态静默继续。
  - 验证：`SessionStore.headers.test.ts` 7 项测试覆盖认证头、MAGI 目标、checkpoint 头、revision 更新、同会话串行保存、失败传播和三次旧读隔离，全部通过；`SessionStore.ts` 独立 esbuild 解析通过；无冲突标记且相关差异 `git diff --check` 通过。遵照合并阶段边界未运行全量 lint。

- [x] **2026-07-23：Agent Composer 完整宿主与独立宿主能力分流**
  - 共同基线与本地意图：原 Composer 使用 Tiptap；本地仅增加独立挂载所需 `setText`，并迁移到唯一 `util/DOM/escape`。独立 Agent 页面和 MAGI 最小宿主不创建完整 `App`/WebSocket，必须继续能够独立启动。
  - 上游意图：完整应用 Composer 改用 Protyle，取得块 HTML、原生块引用/拖放、嵌入块渲染、本地撤销和 Protyle hint；Agent 消息持久化及渲染开始依赖 `blockHTML` 与 `renderBlockHTML`。
  - 处置：没有强行让最小宿主构造完整 App，也没有放弃上游 Protyle 能力。`AgentComposer.ts` 成为薄选择器：宿主显式提供 `App` 时使用 Protyle，独立页/MAGI 使用 Tiptap；两者共同实现唯一 `ComposerHandle`，包括文本、块 HTML、引用、草稿、历史和渲染钩子。Tiptap 以自身文档 HTML 承接块 HTML，Protyle 保留原生块渲染；主控制器待融合调用已透传 `this.app`。两种编辑器原先重复的历史浏览算法抽到唯一 `AgentComposer.history.ts`；Protyle 空内容初始化也收口为单一 helper。
  - 验证：Composer 运行时选择与共享历史 4 项测试、SessionStore 回归 7 项测试共 11/11 通过；5 个 Composer 模块独立 esbuild 解析通过；无 Composer 冲突标记且相关差异 `git diff --check` 通过。首次测试因纯 Node 环境误用 `document` 失败，测试宿主改为不依赖 DOM 的哑对象后通过；这是测试夹具修正，不是实现回退。未运行全量 lint。

- [x] **2026-07-23：Agent 消息富渲染与交互事件并集融合**
  - 本地意图：渲染器使用唯一 `util/DOM/escape` 与 `editor/processSiYuanUri`；语言对象支持最小宿主缺省；Todo、问题卡、思考卡、复制按钮和 Markdown 后处理采用已整理的类型与控制流。
  - 上游意图：工具调用可标记运行中；重试文案国际化；用户 `protyle-wysiwyg` 与助手 `b3-typography` 均执行高亮；图片和图表支持双击预览；完整 App 宿主通过单一事件委托处理块引用、文件标注、标签、SiYuan URI 和普通链接，并覆盖异步嵌入内容。
  - 处置：在现有唯一渲染器中直接取行为并集。运行中 class 合入本地 `for...of`；高亮选择器覆盖两类消息结构；保留上游预览和一次性绑定标记；完整事件委托取代本地逐链接监听，同时仍调用本地唯一 URI 处理器。`app` 缺失时只跳过完整应用链接动作，基础富渲染和预览继续执行，符合独立宿主 capability 边界。
  - 验证：9 项行为断言覆盖运行中工具、双消息结构高亮、图片/图表预览、块引用、文件标注、标签、事件委托和本地 URI 入口；文件独立 esbuild 解析通过；无冲突标记且 `git diff --check` 通过。未为该单文件运行全量 lint。

- [x] **2026-07-23：Agent 主控制器 28 个冲突块的宿主/检查点/富消息融合**
  - 本地意图：保留 MAGI/native 双目标、身份持续会话、独立页/Tab/浮窗/Dock、多实例请求隔离、细粒度 capabilities、拆分 session controller、任务目录、web search/通用工具卡、宿主通知与生命周期；MAGI 已发送消息不允许重做，执行过工具的原生轮次也从严阻断重做。
  - 上游意图：会话 turn/revision 检查点、被中断轮次恢复、权威提交响应、用户消息编辑重发、块 HTML、用户消息富渲染、运行中工具标识、确认 effects、keyless provider、独立 Agent Lute、折叠 Dock 滚动恢复、标题延迟提交、前端工具结果重试和 content revision。
  - 处置：逐段融合 28 个冲突块，没有整文件选边。主控制器继续只消费 `AgentPanelCapabilities`，上游内置 frontend action registry 由完整 App capability 承接，核心不直接导入；旧 `AgentSessionPanel` 未恢复。Composer 根据是否注入 App 选择 Protyle/Tiptap。模型变化保留本地身份签名并移除 API key 前置条件以支持 keyless provider。MAGI 仍走 main-ui 渠道历史与流式 adapter，`saveSession` 对 MAGI 明确返回且不写原生存储；原生会话合入 revision/turn 提交和恢复。工具调用以 callID 为身份，详细工具卡与运行中 badge 共存，持久化保留 state。409 直接重载权威会话。历史重做在 MAGI、已执行工具或待确认动作存在时阻断；普通无副作用消息保留编辑/重发。前端工具结果合并 owner/session 认证、三次传输尝试，并在最终失败后显式抛出。
  - 生命周期修正：折叠滚动 `ResizeObserver` 进入本地构造链并在 `destroy()` 断开；所有直接 `showMessage`、用户富渲染、编辑器上下文和插件动作调用均收口到对应 Port。单文件静态检查发现并删除两个融合后未使用导入；其余 25 项为 4267 行既有主类及长函数规则，按合并阶段边界记录但不展开拆分。esbuild 对既有 `dayjs` namespace 调用给出项目普遍存在的运行时警告，不在本次冲突中改变全仓 dayjs 导入约定。
  - 验证：`node:test` AgentHistory 4/4、Agent Panel 目录 Vitest 30/30 通过；25 项行为断言覆盖本地目标/宿主能力与上游检查点、编辑、keyless、块 HTML、工具状态和显式错误；AgentChat 独立 esbuild 解析通过；关键 lint 类别（未使用、未定义、解析、断言、`else`）为空；无冲突标记且 `git diff --check` 通过。第一次把 `node:test` 文件连同 Vitest 目录一起运行时，文件自身 TAP 4/4 但 Vitest按“无 Vitest suite”退出；随后按各自 runner 分开执行并全部通过。

- [x] **2026-07-23：Agent SSE 与 History 紧密协议审计**
  - 契约核对：前端 `sessionID/userEntryID/contentRevision/editorContext/pluginActions/reasoningEffort` 与上游 Kernel `agentChatRequest` 字段逐项一致；turn、tool call/progress/result、confirm effects、done 和 frontend tool call 与 `writeSSE` 输出一致。`AgentHistory` 的用户轮次定位、工具副作用判断、revision 隔离和引用过滤均由主控制器实际消费。
  - 审计修正：自动合入的 SSE 解析仍有两处畸形 JSON 静默跳过，并遗漏 Kernel 已发送的 `confirm.effects` 投影。新增 `AgentSSEProtocolError` 与可测试的 `parseAgentSSEEvent()`；畸形载荷和未知事件均显式进入唯一错误回调，effects 完整映射到确认卡。HTTP 409 读取失败仍保留有注释的 i18n 错误路径，不属于静默失败。
  - 验证：新增 3 项协议测试覆盖 callID、effects、畸形 JSON 和未知事件；Agent Panel Vitest 由 30 项增至 33/33，agentSSE 独立 esbuild 解析与 `git diff --check` 通过。定向 lint 仅报告该上游协议文件 354 行、两个长函数及测试目录忽略提示，按合并阶段边界记录，不为结构规则拆分协议状态机。

- [x] **2026-07-23：智能编辑菜单一对多映射与旧聊天入口删除保持**
  - 本地意图：`ai/actions.ts` 已拆为填充、编辑 Dialog、自定义 Dialog、过滤、菜单模板和点击处理模块，并增加 AI Chat、最近文档及跨平台入口；旧 `ai/chat.ts` 已由流式 `chatStream.ts` 取代。
  - 上游意图：过滤后没有可见条目时不访问空焦点；Enter 时没有焦点项直接返回；块标“智能编辑”过滤框移除容易混淆的 AI 占位。上游对 `actions.ts` 的其它内容仍是共同基线旧单体。
  - 处置：用本地约 300 行编排模块恢复冲突文件，未保留上游 `fillContent/editDialog/customDialog/filterAI/click` 第二套实现。焦点空值由现有 `actions.filterAIMenuItems.ts` 可选链覆盖，Enter 门禁加入 `handleKeyDown`，占位移除映射到唯一 `actions.generateBuildingMenuHTML.ts`。`chat.ts` 保持删除；当前唯一旧消费者是待处理冲突 `protyle/wysiwyg/keydown.ts`，后续必须改向 `chatStream.ts`。
  - 验证：8 项行为断言覆盖六个拆分入口、两项空值保护、占位移除和旧 fillContent 删除；三个实际模块独立 esbuild 解析通过；关键 lint 类别为空，无冲突标记且 `git diff --check` 通过。其余 lint 为本地既有结构规则，合并阶段不展开。

- [x] **2026-07-23：桌面启动链上游增量向本地平台封装映射**
  - 本地意图：`onGetConfig.ts` 已移除条件编译和 Electron 静态依赖，统一通过 platform、环境访问器与窗口 timer；布局恢复、Emoji 响应、resize 和完整 App Port 工厂均由本地拆分启动链承接。
  - 上游意图：启动时设置 Windows body 标记；布局恢复后打开首次使用界面；注册 `window.open` 的 SiYuan URI 拦截；独立窗口增加可拖拽区域。
  - 处置：保留本地启动链作为唯一骨架，将四项行为直接映射到现有入口；URI 处理改用已确定的唯一 `editor/processSiYuanUri`。没有恢复 `electron/fs/path` 静态导入、条件编译或上游旧 resize 单体。独立窗口语言继续使用本地环境代理，仅合入拖拽结构。
  - 验证：共同基线到上游仅有上述四项行为增量；文件无冲突标记，独立 esbuild 解析及 `git diff --check` 通过。按合并阶段约束未为结构性 lint 扩散重构。

- [x] **2026-07-23：Dock 固定切换命令与加密笔记本键盘门禁融合**
  - 上游意图：命令面板和全局键盘入口增加左、右、底部 Dock 固定状态切换；加密笔记本禁止快捷制卡与间隔重复，读取重命名信息时显式传 notebook。
  - 本地意图：命令列表运行时按 `isMobile/isElectron` 过滤；返回/前进、打开文件和 DOM 转义均使用本地拆分路径；全局键盘入口通过无条件平台封装运行。
  - 处置：桌面命令列表加入三项 Dock 命令，移动端列表保持原能力边界；三项热键直接调用已有 Dock `togglePin()`。加密门禁覆盖编辑器快捷制卡、文件树制卡及重复入口，重命名参数仅对加密笔记本附加 notebook。导入继续使用本地 `util/platform/backForward` 与 `editor/utils.openFileById`，只从当前唯一 `util/pathName` 增加 `isEncryptedBox`。
  - 验证：两文件相对本地侧差异仅为上述上游行为；无冲突标记，独立 esbuild 解析及 `git diff --check` 通过。未执行与本阶段无关的全文件 lint 重构。

- [x] **2026-07-23：主应用启动编排与上游首次使用/定位/排序事件融合**
  - 本地意图：主入口通过本地 network/platform/file/editor 拆分路径运行，注册导出预览、Bazaar、MAGI Identity、Protyle Dialog Port、S-Forge 状态与唯一主 WebSocket；浏览器/Electron 由运行时平台分流。
  - 上游意图：首次使用数据在主 UI 启动前确保并等待 notebook 就绪；WebSocket 接收 onboarding 与两类文件树排序事件；SiYuan URL 支持 AV item/view/group 定位；移动原生壳运行桌面 bundle 时恢复 WebView 软键盘；浏览器兼容通知服从用户配置。
  - 处置：保留本地主入口为骨架，新增 onboarding、AV locate 和 `Files` 消费者；首次使用确保完成后通过本地 `setNoteBook` 回调启动 UI，Chrome 提示同时保留 `isBrowserDesktop` 边界和通知开关。排序事件调用此前已融合的唯一 Files 方法，AV URI 通过本地 `openFileById.afterOpen` 激活队列。移动壳逻辑纳入 `isBrowser` 运行时分支，Electron 继续走 IPC wrapper。移除 2025 年初次引入 transformer 时遗留的启动探针 `embeddingText("测试")`；正式语义搜索与 embedding Dock 消费者继续保留，避免每次启动无条件加载模型。
  - 验证：上游新增字段已由当前 URI 类型与 `openFileById.afterOpen` 契约承接；两类排序方法存在；文件无冲突标记，独立 esbuild 解析及 `git diff --check` 通过。定向 ESLint 只报告入口文件/构造器/消息回调长度三项结构规则，没有解析、未使用导入或未定义错误；按用户指定的合并阶段边界记录而不拆分入口。

- [x] **2026-07-23：公共菜单外链运行时分流去重与加密参数融合**
  - 本地意图：Electron shell、资源打开与移动端行为均使用本地 platform/editor 拆分模块，条件编译已由 `isElectron` 运行时分流取代。
  - 上游意图：文档提醒和重命名在加密笔记本中携带 notebook；属性 Dialog 在移动端全屏；外链默认打开前识别 SiYuan URI。
  - 处置：保留本地唯一外链分支，删除自动合并产生的第二套条件编译实现；在 Electron 默认打开动作中调用唯一 `editor/processSiYuanUri`，未命中才交给 shell。加密查询参数、移动 Dialog 尺寸和更具体的属性类型均保留。
  - 验证：相对本地侧差异仅为上述上游增量；文件无冲突标记，独立 esbuild 解析及 `git diff --check` 通过。解析器仅提示项目既有 `dayjs` namespace 调用，按合并阶段边界记录而不改动全仓导入约定。

- [x] **2026-07-23：菜单核心上游行为向拆分 helper 映射**
  - 本地意图：`Menu.ts` 仅负责菜单宿主生命周期、DOM 容器、工厂和滚动锁；菜单事件、定位、菜单项生成、键盘导航与插件子菜单均有独立模块，支持独立宿主。
  - 上游意图：悬停菜单只匹配直接子菜单并忽略已打开子菜单内部事件；AV action 菜单按 action 锚点定位；IME 组合期间不导航；带 `data-menu-keymap` 的输入框支持回车关闭、方向键边界和 Electron undo/redo；键盘焦点可落到 keymap 输入行。
  - 处置：保留本地拆分骨架，将直接子菜单/重复悬停抑制和 action 锚点几何算法放入 `Menu.uills.ts`，将 keymap 输入及 `electronUndo` 放入 `Menu.bindMenuKeydown.ts`，平台依赖通过 `menus/imports.ts` 转发。删除冲突文件中自动合入的旧单体 `bindMenuKeydown` 和 `subMenu`，继续使用 `Menu.subMenu.ts` 与独立键盘模块，没有维护平行实现。
  - 验证：`Menu.ts`、`Menu.uills.ts`、`Menu.Item.ts`、`Menu.bindMenuKeydown.ts` 与 `menus/imports.ts` 无冲突标记，独立 esbuild 解析和 `git diff --check` 通过。定向 lint 仅剩主类既有嵌套/else 及 helper 长度提示；新增 keymap 分支已补齐注释和类型推导，未扩展结构性拆分。

- [x] **2026-07-23：工作区菜单 Dock 命令与数据迁移入口融合**
  - 本地意图：工作区菜单保留 S-Forge/Bazaar 入口、环境语言代理、平台拆分路径和 Dock `togglePin` 行为。
  - 上游意图：Dock 固定切换菜单使用 `switchLeftDock/switchRightDock/switchBottomDock` 热键标识与 accelerator；可写工作区显示数据迁移入口。
  - 处置：保留本地 `DOM/upDownHint`、Bazaar 和 `siyuanI18n` 实现，采用上游 Dock 类型化 ID、图标和 accelerator，并接入已有 `openDataMigration` 模块。没有恢复旧 `leftDock/rightDock/bottomDock` 命令别名，避免与全局 keydown/命令面板分叉。
  - 验证：文件无冲突标记，独立 esbuild 解析及 `git diff --check` 通过；仅提示项目既有 `dayjs` namespace 调用，未扩展无关 lint 治理。

- [x] **2026-07-23：文件树导航菜单上游增量向多选拆分模块映射**
  - 本地意图：导航主菜单使用 runtime platform、独立 `Menu.Item`、本地 file/network/editor 路径；多选菜单已拆到唯一 `navigation.initMultiMenu.ts`，事务保留正反操作。
  - 上游意图：父文档展开模式提供“打开文档”；笔记本可改图标；加密笔记本隐藏制卡、文档信息查询携带 notebook、导出前提示风险；多选导出同样受风险确认保护。
  - 处置：删除冲突中上游旧内联 `initMultiMenu`，把加密导出确认作为细粒度回调注入现有多选模块；加密判定同样以函数参数注入，并补齐上游遗漏的多选制卡门禁。主菜单继续使用本地 `editor/utils.openFileById` 和 runtime `isMobile`，避免恢复条件编译；笔记本/文档打开、改图标、单项制卡门禁、属性查询参数和两类导出确认均保留。
  - 验证：主菜单与多选模块无冲突标记，两个入口独立 esbuild 解析及 `git diff --check` 通过；搜索确认旧内联多选实现已删除，所有两处多选调用均显式注入导出确认与加密判定。

- [x] **2026-07-23：Protyle 菜单旧单体增量向 ref/tag/zoomOut 拆分模块映射**
  - 本地意图：`menus/protyle.ts` 是表格菜单与拆分模块再导出的薄入口；asset/content/ref/tag/image/link/iframe/zoomOut 等均只有一个实际实现。
  - 上游意图：引用与标签输入使用 `data-menu-keymap` 接入统一键盘状态机；标签联想可继续截获 Enter/Escape，重命名前关闭菜单；zoomOut 的主加载和两条焦点补偿 `getDoc` 在加密笔记本中携带 notebook。
  - 处置：从冲突中删除约 2053 行上游旧菜单单体，不恢复任何平行实现。anchor 移除自身 Enter/undo 监听并交由统一菜单键盘模块；tag 保留联想列表专属处理，隐藏列表后的 Enter/undo 由统一状态机承接，并删除四个未被调用的旧输入 helper。zoomOut 新增唯一同步请求参数构造器，三个请求路径共同使用；加密判定经 editorMenu imports 转发。
  - 验证：薄入口及五个承接模块无冲突标记，六个入口独立 esbuild 解析和 `git diff --check` 通过；定向 lint 发现并修复本次产生的未使用 `htmlState`，请求参数 helper 补充同步契约说明。剩余结果均为原有函数长度、参数数量、返回类型和模块常量结构规则，合并阶段仅记录。

- [x] **2026-07-23：AI 配置五类模型选择器、远程缓存与搜索能力融合**
  - 本地意图：保留命令审核专用模型组、Provider 远程模型缓存、批量添加缓存模型，以及当前模型不在远程列表时保留原值并显式警告。
  - 上游意图：增加视觉理解与图片生成模型组，并将远程模型列表升级为可搜索选择菜单。
  - 处置：统一 `ModelPickerGroup` 为 editing、agent、commandReview、vision、imageGeneration 五类，所有配置变化同步刷新五个选择器；保留缓存持久化及批量添加。删除原生 select 与可搜索 input 两套等价实现，形成唯一可搜索选择器；当前模型缺失时保留原值和警告，选中远程有效模型后立即清除警告。上游旧 `util/upDownHint` 与 Electron 静态导入映射到本地 `util/DOM/upDownHint`、运行时平台判断和 `platform/electron/shell` 适配层。
  - 验证：文件无冲突标记，独立 esbuild 语法转换和 `git diff --check` 通过；定向 lint 未发现解析、未使用或未定义问题。剩余 17 项均为该 1491 行既有模块的文件/函数长度结构规则，合并阶段记录但不拆分。

- [x] **2026-07-23：块工具上游插入/撤销/嵌入语义向本地拆分模块映射**
  - 本地意图：`block/util.ts` 保留超级块布局、跳转和插入编排，取消超级块、插入目标解析、新块构造分别由 `util.cancelSB.ts`、`util.getInsertTargetBlock.ts`、`util.createNewBlockElement.ts` 唯一承接；外部依赖经 `block/imports.ts` 转发。
  - 上游意图：取消超级块时跳过装饰节点并识别嵌入块真实父级；位置查询携带 notebook；插入空块接受直接 Element 目标，记录撤销焦点上下文，并在折叠标题判断时跳过装饰节点。
  - 处置：以本地薄入口和三个 helper 为骨架，未恢复上游旧 `cancelSB` 与插入单体。`getPreviousBlockSibling`、`getEmbedChildOperationParentID`、`getUndoFocusContext` 通过本地 imports 转发；取消超级块的初始/撤销前兄弟、嵌入父级及 notebook 查询进入专属模块；跳转请求增加 notebook；插入目标支持 string/Element，列表更新和删除撤销均携带原始焦点上下文；折叠标题创建使用语义前兄弟。
  - 验证：五个实际模块无冲突标记，独立 esbuild 语法转换与 `git diff --check` 通过；定向 lint 未发现解析、未使用或未定义问题。上游四类增量均已映射，未引入平行实现。

- [x] **2026-07-23：移动端 Backlinks、Files、Outline 上游增量向拆分架构映射**
  - Backlinks：保留本地 file/network 与环境化 i18n 路径，同时加入加密笔记本判定；仅在加密场景为反链请求携带 notebook。
  - Files：保持 `MobileFiles.ts` 控制器、`.event.ts` 点击路由、`.ws.ts` 消息/模板、`.render.ts` 列表渲染四模块唯一实现。点击模块承接发布权限开关、动画折叠、加密笔记本解锁和 Box Doc 打开；消息模块承接锁定图标、Box Doc 根节点、子文档计数、挂载/重命名及移动删除状态；渲染模块承接统一展开动画和空节点保护；控制器承接指针触摸桥、拖拽阈值、排序事件、过期 notebook 信息合并、Box Doc 定位与精确发布 ID 集合。删除上游旧单体重复实现，并补回本地拆分时遗漏但仍有实际消费者的发布权限项点击行为。
  - Outline：保持筛选/事务和菜单拆分模块，新增独立 `MobileOutline.sort.ts` 承接触摸/鼠标桥接拖拽状态机。主控制器增加带请求序号隔离的 `reload()`、加密 notebook 参数、文档标题、实时 IME 筛选和正确列表滚动容器；事务 helper 复用唯一 reload 链；菜单 helper 增加转换 unfocus、DOM 插入聚焦、异步响应的 Protyle/root 身份及响应结构校验，防止切换文档后误写。
  - 验证：Backlinks 与 Files/Outline 共九个实际模块无冲突标记；各组独立 esbuild 语法转换、`git diff --check` 通过；定向 lint 未发现解析、未使用或未定义问题。Files 主类未恢复 ws/event/render 的平行实现，Outline 拖拽未塞回主类。

- [x] **2026-07-23：移动编辑器打开链与返回/前进状态融合**
  - 本地意图：`getCurrentEditor` 保持在 `mobile/util/getCurrentEditor.ts` 唯一实现，打断 closePanel、keyboardToolbar 与 editor 的循环依赖；文档内容继续走本地 network、DOM、renderer registry 和拆分 zoomOut 路径。
  - 上游意图：移动打开支持 notebook、afterOpen 和 forceReload；加密笔记本的 block info/getDoc/getDocInfo 请求携带 notebook；Protyle 初始化写入 notebook/databaseAttr；历史栈可按 notebook 清理，恢复后刷新数据库属性面板。
  - 处置：未恢复 `mobile/editor.ts` 中上游内联的 `getCurrentEditor`，仅扩展唯一 `openMobileFileById` 契约并保留所有回调路径；返回/前进模块保留本地 content renderer 与路径，合入精确栈清理、两条加密请求和数据库属性刷新。
  - 验证：两文件无冲突标记，独立 esbuild 语法转换、`git diff --check` 通过；定向 lint 未发现解析、未使用或未定义问题。

- [x] **2026-07-23：移动搜索与主菜单加密/生命周期入口融合**
  - 搜索保持 `search.ts` 请求编排、`search.event.ts` 事件和 `search.render.ts` 渲染三模块；仅当全部 idPath 属于同一加密 notebook 时附加 notebook，跨 notebook 与全局查询维持原语义。未恢复上游旧搜索单体依赖。
  - 主菜单保留本地环境化 i18n、独立 getCurrentEditor、平台路径、设置页 helper 及 AI/Huawei 可见性门禁；合入加密笔记本新建、数据迁移、`afterLayoutReady(app)` 插件生命周期和安全退出。账户入口与安全退出按独立命令保留，设置页继续走唯一 `openSettingTabModel`，未复制第二套 openModel 编排。
  - 验证：两入口及搜索拆分模块独立 esbuild 语法转换、`git diff --check` 通过；定向 lint 未发现解析、未使用或未定义问题，无冲突标记。

- [x] **2026-07-23：移动框架启动与 WebSocket 消息路由闭合**
  - `initFramework` 保留本地独立 getCurrentEditor、network/assets/path 和平台工具入口；Outline 打开/刷新统一调用 `reload()`，URI 启动支持 AV item/view/group 排队定位与打开后激活，无 URI 时接入移动 onboarding。
  - `onMessage` 保留本地拆分的 reloadSync/setRefDynamicText 与 file path；新增 notebook 关闭/删除时按身份清理返回前进栈并在当前编辑器所属 notebook 被关闭时销毁编辑器，接入 onboarding 恢复以及文件树/笔记本排序事件。
  - 验证：两文件无冲突标记，独立 esbuild 语法转换、`git diff --check` 通过；定向 lint 未发现解析、未使用或未定义问题。

- [x] **2026-07-23：移动键盘工具栏上游增量向 menu/action 拆分模块映射**
  - 本地意图：主模块负责键盘可见性和 selection 生命周期，菜单 HTML/斜杠菜单由 `keyboardToolbar.menu.ts` 承接，点击命令由 `keyboardToolbar.action.ts` 承接。
  - 处置：删除冲突中的上游旧 getSlashItem/renderSlashMenu、内联 HTML 和点击状态机；Android 专用图片选择入口进入 menu，移除重复关闭按钮并修复共同基线中 kbd 按钮缺失 svg 起始标签；通用 toolbar 类型转发进入 action；主模块合入滚动定时器取消、多选保护、键盘 change 事件和重复隐藏通知抑制。
  - 验证：三个模块无冲突标记，独立 esbuild 语法转换、`git diff --check` 通过；定向 lint 未发现解析、未使用或未定义问题，主模块未恢复平行菜单/点击实现。

- [x] **2026-07-23：移动主入口键盘锁、onboarding、URL 与平台行为融合**
  - 本地意图：保留 S-Forge MODEL_HANDLERS/OPEN_MOBILE_FILE_BY_ID 注册、network/processMessage、平台 ID/iOS、独立 getCurrentEditor、TouchDragBridge 与环境化启动链。
  - 上游意图：移动浏览器 focus/click 同样启用键盘锁；按平台设置 visual viewport 并服从浏览器兼容通知开关；配置就绪后确保 onboarding；覆盖 window.open；SiYuan URL 支持 AV item/view/group 定位。
  - 处置：清除冲突中的第二套旧路径导入，以本地入口导入集合为骨架补入 `armKeyboardLock`、`ensureOnboarding`、`initWindowOpenOverride`、`isInIOS`、AV locate 和 `openByMobile`；正文自动合入的行为逐项核对并保留，未移除 S-Forge 启动注册。
  - 验证：入口无冲突标记，独立 esbuild 语法转换和 `git diff --check` 通过；定向 lint 未发现解析、未使用或未定义问题。移动端冲突组闭合。

- [x] **2026-07-23：插件加载完成与布局挂载生命周期屏障融合**
  - 本地意图：loader 保持 imports/API.environment 入口、显式插件校验和 `loader.afterLoad.ts` 唯一 UI/Dock 挂载实现。
  - 上游意图：启动阶段异步加载插件时记录 `onload + kernel.init` Promise，布局就绪后等待完成再执行 afterLoad，避免插件尚未初始化便挂载 UI。
  - 处置：未恢复上游旧 require/eval/loadPlugin/addPluginDock 单体；在本地 `loadPluginJS` 中建立 WeakMap Promise 屏障，`afterLayoutReady(app)` 按插件等待并调用唯一 `afterLoadPlugin`。初始化和布局观察链均显式记录失败，不吞掉 kernel 初始化异常。
  - 验证：loader 与 afterLoad 模块无冲突标记，独立 esbuild 语法转换、`git diff --check` 通过；定向 lint 未发现解析、未使用或未定义问题，addPluginDock 仍只有拆分模块一份实现。

- [x] **2026-07-23：Protyle Breadcrumb 与 Export 上游增量向拆分模块映射**
  - Breadcrumb 本地意图：事件、渲染、菜单和上传逻辑保持现有拆分边界，不恢复上游旧单体。
  - Breadcrumb 处置：上游四类加密 notebook 参数由 `withEncryptedNotebook` 唯一纯函数承接，分别映射到文档属性、上下文读取、移动面包屑和桌面渲染请求；Android 图片选择与通用资源选择复用同一 DOM/上传处理器；移除重构后已无调用路径的第二个移动菜单方法，其有效资源转换动作并入唯一入口。
  - Export 处置：Markdown、浏览器 HTML 与本地导出统一增加加密内容明示确认；浏览器压缩包进入现有 `saveExportFile` 平台链；PDF 临时内容携带文档 ID；图片截图的错误图片占位选项由确认流程创建一次，以最小 capture 对象注入整图和分页截图，未复制旧 `exportImage` 单体。
  - 验证：目标文件无冲突标记，10 个模块独立 esbuild 语法转换和定向 `git diff --check` 通过；新增截图确认路径定向 lint 清零。旧 `export/index.ts` 文件/函数长度与其他已存结构规则留待合并后专项治理，不在本阶段扩展重构。

- [x] **2026-07-23：Protyle Header 加密请求、Box Doc 语义与题头图库融合**
  - 本地意图：`Background` 保持为 init/event/upload/image/tag/render 薄组合器；标题菜单的复制、文件操作与宿主菜单保持 helper 边界。
  - 处置：将加密 notebook 参数构造提升到 `util/pathName.ts` 唯一 `withEncryptedNotebook` 实现，Breadcrumb 与 Title 共享；Title 三处文档信息请求及标题菜单请求全部附带正确笔记本身份。
  - Box Doc：复制 DOM 显式附带 notebook；笔记本根隐藏移动/删除文件动作，搜索改为笔记本根范围；加密笔记本隐藏闪卡操作。这些差异分别进入 copy/file-operation/search/riff 的真实承接点。
  - 题头图：图片 manifest、分类卡片、资源复制和随机图片进入现有 `background/image.ts`；CSS 图案仍作为 manifest 无结果时的既有能力。同时恢复本地拆分时遗漏的标签拖拽排序，并使用上游 `SIZE_DRAG_THRESHOLD` 而非硬编码阈值。
  - 验证：Header、Background 子模块、通用加密参数 helper 和 Breadcrumb 消费者完成独立 esbuild 转换，`git diff --check` 通过；定向 lint 未发现未使用、未定义或类型边界问题，image/tags 文件长度只记录待后续专项拆分。

- [x] **2026-07-23：Protyle Gutter 重复渲染、embed 边界与菜单 capability 融合**
  - 本地意图：`Gutter` 仅作为宿主适配器，事件、HTML 渲染、定位和菜单继续由拆分模块承接。
  - 处置：移除 `gutter/index.ts` 中在 `renderGutter()` 后重复执行的旧渲染链；新增 `gutter.node.ts` 统一解析普通块、嵌入块和 AV 节点；加密笔记本未详细的属性请求及闪卡/属性菜单设置门禁。
  - embed 处置：块标带 `data-embed-id`，只匹配对应嵌入上下文；嵌入目标本身禁止结构修改，嵌入子块按边界内能力执行；标题剪切/删除、移动、重复、跳转和跨边界插入不会从嵌入菜单暴露。
  - Agent 与 AV：桌面普通块和多选菜单增加共享 `addBlockToAgent` 能力边界，不直接引入 AgentChat；加密 notebook 隐藏该入口与 flashcard/AI；AV 文件路径按 notebook 身份分流。
  - 验证：Gutter 18 个模块独立 esbuild 通过，定向 diff 检查通过；当前仅保留上游已存的 dayjs 构建警告，未引入新的解析/未定义问题。已存的文件长度规则在合并后专项拆分，不改变本轮行为。

- [x] **2026-07-23：Protyle Hint/Preview 上游语义向拆分模块映射**
  - 本地意图：`Hint` 保持薄控制器，引用查询、渲染、AV 填充与斜杠命令继续由 `extend.hintRef.ts`、`index.render.ts`、`index.fill.av.ts`、`index.fill.ts` 和 `index.fill.slash.ts` 分别承接；Preview 的 Dialog、外链和编辑器动作继续使用本地跨宿主端口。
  - Hint 处置：引用、嵌入和搜索请求统一复用 `withEncryptedNotebook`，没有复制加密判断；轻量编辑器的斜杠查询与填充进入渲染/填充模块；新建文档和子文档统一使用 `getBlockRefAnchorText`；AV 替换事务增加 `blockID/context.protyleID`，撤销语义使用原 `previousID`，并移除事务提交前直接改写行 ID 的路径。
  - Preview 处置：外链先由唯一 `processSiYuanUri` 分派，未命中后再按本地 `isElectron/openExternal` 或浏览器宿主打开；未恢复上游静态 Electron 条件编译分支。
  - 验证：8 个目标模块独立 esbuild 语法转换全部通过，无冲突标记且 `git diff --check` 通过。定向 ESLint 未发现本次新增的解析、未定义或未使用问题；结果中的函数/文件长度、既有参数数量及既有未使用导入属于本地拆分模块已有结构债，按合并阶段范围记录，不在本组扩大重构。

- [x] **2026-07-23：Protyle AV 模板、属性、行操作、定位与虚拟滚动增量向拆分架构映射**
  - 架构处置：保持 `render.ts` 为渲染入口、`render.table.ts` 为表格 HTML/后处理、`render.refresh.ts` 为事务刷新；`cell.ts` 继续作为五行 facade；Gallery 与 Kanban 统一复用异步 `getRowHTML`；未恢复上游重复的表格渲染、刷新、卡片 HTML 和旧菜单单体。
  - 数据与交互：属性面板保留反向关联、模板净化、可撤销删除和过期响应隔离；列对齐、模板新建、条目打开/重新绑定、解绑、卡片选择快照和条目链接复制进入真实拆分模块；默认模板 ID 仅接受具备有效内容的模板。
  - 定位与虚拟化：渲染请求接入 view/item/group/block 定位参数、渲染令牌和过期结果隔离；表格、Gallery、Kanban 均保留定位窗口、绝对行偏移和滚动回填；刷新链按渲染数据判断条目是否被过滤，重复条目定位到目标，并隔离新增条目焦点请求。
  - 复用与路径：`cover.ts` 复用本地唯一 `util/DOM/escape`；卡片封面统一由 `getCardCoverImageHTML` 生成；本地 network、DOM、runtime Dialog 和 `siyuanI18n` 路径继续作为宿主边界，没有新增等价工具函数。
  - 验证：AV 目录 34 个变更 TypeScript 模块逐文件 esbuild 语法转换通过，目录无冲突标记且 `git diff --check` 通过；Node Test Runner 下封面转义/压缩/适配 4/4 通过。定向 ESLint 仅报告 `render.ts`、`render.table.ts`、`render.refresh.ts` 的文件/函数长度结构规则，未发现解析、未定义或未使用错误；合并阶段记录该结构债，不为通过验收扩大刷新状态机重构。

- [x] **2026-07-23：Protyle 嵌入渲染、Lute 工厂与主入口宿主能力融合**
  - `setLute.ts` 保持环境访问器和共享编辑器单例；上游 Agent 专用 Markdown 语义由唯一 `getAgentLute` 承接，每次返回隔离实例，不复制 load/config helper。
  - `blockRender.ts` 保留 JS、关键词、语义和 SQL 四种本地查询分发及内容渲染注册表；异步完成回调沿 `SearchContext` 贯穿全部查询与嵌套嵌入，服务端 `allowChildOperation` 映射为 DOM 能力属性，SQL 查询复用 `withEncryptedNotebook`。
  - `protyle/index.ts` 合入 lite `LocalUndo`、notebook 身份、空内容事务保护、数据库属性面板/独立数据库行刷新和两条加密 getDoc 链；大纲与数据库行刷新分别扩展 `IProtyleLayoutPort` 的细粒度能力，具体 `getAllModels()` 遍历仅存在完整 App 适配器，独立入口继续使用明确 no-op。
  - 验证：`setLute.ts`、`blockRender.ts`、`render.types.ts`、Protyle 主入口及三项 Port 文件逐文件 esbuild 语法转换和 `git diff --check` 通过，无冲突标记。定向 ESLint 只剩本地文件既有注释/返回类型、Port fallback 注释、工厂既有条件结构及主入口长度规则；本次新增的类型说明、上下文参数聚合和生命周期边界已按规则修正。

- [x] **2026-07-23：Protyle 滚动、上传与双模式撤销契约融合**
  - 滚动：按索引加载文档复用 `withEncryptedNotebook`，保留本地 Browser 事件和 Dialog Port，不恢复旧网络/Tooltip 路径。
  - 上传：lite 编辑器提交 `assetsDirPath=/assets/`，普通编辑器提交 root ID；继续复用唯一 `performXHRUpload`、确认和失败清理链，未恢复冲突中的第二套 XHR。
  - 撤销：kernel Undo/Redo 在请求前刷新 pending input 并等待事务队列；跨文档确认保留本地已拆 helper。新增 `IUndo` 与 `LocalUndo` 支持 lite 前端操作日志，正反回放共享 `markLastInsertRange`、焦点恢复和工具栏 Range 同步；`replace` 明确进入公共契约，补齐上游接口遗漏。
  - 依赖边界：事务提交、pending 屏障和焦点恢复继续经 `undo/imports.ts` 逐项转发；Electron 快捷键保留运行时 `isElectron/ipcSend`，未恢复静态 `ipcRenderer`。
  - 验证：滚动、上传及四个 Undo 实际模块逐文件 esbuild 语法转换和 `git diff --check` 通过，目录无冲突标记；新增 imports/types/helper/LocalUndo 代码按定向 lint 修至仅剩 `Undo`/`LocalUndo` 公共 class 构造契约规则，`globalUndo.ts` 仍仅有既存模块级镜像与互斥锁规则。

- [x] **2026-07-23：Protyle Toolbar 上游交互增量向本地拆分架构映射**
  - 架构处置：保留 `toolbar/index.ts` 薄入口以及 `ToolbarItemFactory.ts`、`renderToolbar.ts`、`renderPanel.ts`、`showRender/*`、`setInlineMark.ts` 等既有职责边界，未恢复约两千行上游旧单体；所有子面板通过唯一清理路径复位内联布局和 resize 回调。
  - 功能融合：lite 插件工具栏过滤进入 `filterPluginToolbar`；移动键盘插件项经工厂唯一创建并去重；跨块选择不再改写 Selection，工具栏上下位置依据 Range 实际矩形；源码面板加入八方向缩放、软换行行号与 resize 同步，`ui/dom.ts` 通过 `subElementResizeCB` 通知面板布局刷新。
  - 依赖边界：新增 `showRender/imports.ts` 作为源码面板细粒度 DOM、平台和环境能力入口，行号 HTML 复用项目唯一 `escapeHtml`，没有复制转义、定位、平台或环境访问实现。
  - 验证：10 个变更 TypeScript 入口逐文件 esbuild 解析通过，Toolbar 目录无冲突标记且 `git diff --check` 通过；新增 `imports.ts`、行号、自动布局和模板模块定向 lint 均为零错误。工厂与入口仍报告目录容量、既有 import 注释/网关及历史模块级映射表规则，`renderPanel.ts`/`renderToolbar.ts` 仍有既有函数结构规则，合并阶段记录而不扩大重构。

- [x] **2026-07-23：Protyle 插入、加载与 Selection 拆分契约融合**
  - 插入：保留本地 `network/fetch`、`list.updateOrder` 和拆分表格路径；上游合并单元格复制通过 `getTableRangeCells` 逻辑网格映射，行内标签插入复用唯一 `fixAdjacentTags`，列表粘贴按目标顶层类型转换并用 `getPreviousBlockSibling` 生成撤销位置。
  - 加载：保留本地内容渲染注册表、Dialog Port、运行时平台和语言访问器；文档信息及前后动态加载均携带加密 notebook，加载后刷新数据库属性面板；只读 WYSIWYG、根标题定位和用户滚动中止强化定位语义完整合入。
  - Selection：恢复本地 facade 和 `selection.range.ts` 拆分；表格 WBR 使用行列索引定位克隆单元格，不再在真实 DOM 临时增删 class；新增 `selection.undo.ts` 以块实例索引和文本偏移捕获/恢复 Undo 焦点，并通过 `util/imports.ts` 仅转发可编辑元素查询能力。
  - 验证：六个相关入口逐文件 esbuild 解析通过，无冲突标记且 `git diff --check` 通过；新增 Undo 模块除 util 目录既有容量超限外无 lint 问题。`selection.range.ts` 定向 lint 展开 124 项既有 import、注释、断言和控制流规则，本轮新增行断言已改为确定性 `HTMLTableRowElement` 检查，未扩大历史模块治理。

- [x] **2026-07-23：编辑器拖拽上游增量向 `dnd/*` 拆分架构映射**
  - 架构处置：恢复 `editorCommonEvent.ts` 为事件绑定薄入口，九个上游提交的行为分别进入 fileTree、routing、gutter、list、moveTo、drag 和 dragover helper；没有恢复约两千行拖拽单体。drop 入口以 `finally` 清理 DOM 指示与全局状态，异常继续向外传播。
  - 列表与事务：列表容器在 drop 时解析为实际列表项，但保留 col 超级块中的整列列表目标；内容块只能落在列表项合法内容位置，子列表间隙移动会等待事务完成并立即结束路由；移动和复制到不同列表 subtype 时同步转换标记/任务状态并生成可撤销 update，非法 subtype 或缺失 action 元素明确抛错。
  - 多宿主语义：lite 拖拽固定使用复制语义，Shift 在 lite 下明确映射为引用；书签块引用与 Alt 引用共用落点指示和插入链，数据库目标被前置阻断；加密文档结构转换重载复用 `withEncryptedNotebook`，折叠标题和超级块位置复用 `getNextBlockSibling/getPreviousBlockSibling` 跳过属性占位。
  - 复用与测试：新增共享 `blockReferenceDrop.guard.ts`，Bookmark Dock 与 Protyle 共用同一 JSON 解析、工作空间隔离、ID 校验和去重实现；DnD 通过 `dnd/imports.ts` 获取细粒度跨目录能力。纯函数测试覆盖同工作空间去重、跨工作空间隔离、畸形 JSON 和错误结构，4/4 通过。
  - 验证：17 个变更 TypeScript 入口逐文件 esbuild 解析通过，相关目录无冲突标记且 `git diff --check` 通过；新增共享 guard、DnD imports 和 block-ref helper 除既有目录容量超限外均无 lint 问题。list/move helper 的剩余报告为文件原有 import、注释、参数及同步 DOM 契约规则，本轮新增 subtype 策略已按 lint 移除 switch/else。

- [x] **2026-07-23：WYSIWYG 六个窄冲突的上游增量融合**
  - Callout：保留本地唯一 `getCalloutDialogHTML` 和语言/对话框端口，只在模板工厂加入固定 16px 图标预览字号，未恢复上游重复内联模板。
  - 属性点击与快捷键：通用属性继续走本地拆分 `openFileAttr`；数据库属性根据宿主能力切换固定面板、打开旧属性面板或 `zoomOut` 到目标块，DOM 缺失明确抛错；Hotkey 保留本地平台/clearSelect 路径，并合入折叠块 notebook、加密 Home/End 动态加载。
  - Enter/List/Move：回车事务携带 Undo 焦点和嵌入子块 operation context；列表反向缩进、删除与撤销位置使用 `getPreviousBlockSibling/getParentBlock`；上下移动使用块级前后兄弟并刷新超级块 resize，同时继续复用本地 `list.updateOrder` 和 DOM 滚动工具。
  - 验证：六个文件逐文件 esbuild 解析通过，无冲突标记且 `git diff --check` 通过；`commonClick.ts` 新增数据库 helper 的参数、嵌套和条件说明 lint 已全部修正，剩余报告为 WYSIWYG 目录容量及文件既有 import/通用 helper 规则。

- [x] **2026-07-23：WYSIWYG Keydown 上游增量向中间件路由映射**
  - 保留 `keydown.ts` 中间件编排入口，未恢复上游旧键盘单体；框选区域的系统复制在 `keydown.guards.ts` 放行，跨块 Range 的 Escape 在 `keydown.crossBlock.ts` 放行并由 `keydown.escape.ts` 转为去重顶层块选择。
  - 文档重命名信息请求在 `keydown.attr.ts` 复用 `withEncryptedNotebook`；`openLink` 经实际签名核对继续传递本地 `IProtyle`，未套用上游已经不适用于本地 API 的 `app` 参数。
  - 新增 `matchHotKey` 与 `withEncryptedNotebook` 通过既有 `wysiwyg/imports.ts` 细粒度转发；Escape 多块选择拆为独立 helper，新增分支不再推高既有正常 Escape 处理函数长度。
  - 验证：入口、四个行为中间件、打开链接契约及 imports 网关逐文件 esbuild 解析通过，无冲突标记且 `git diff --check` 通过；imports 新增项除 WYSIWYG 目录容量超限外 lint 为零，Escape/Attr/Guard 的剩余报告属于文件既有签名、import 与控制流规则。

- [x] **2026-07-23：WYSIWYG Remove 嵌入边界与拆分列表删除融合**
  - 保留 `remove.ts` 主删除流程与 `remove.removeLi.ts` 唯一列表删除实现，删除上游文件尾约 227 行旧 `removeLi` 单体；两处调用同时保留 Embed 边界校验与本地异步事务等待。
  - 多块删除、引述/Callout、代码块、超级块和普通块撤销位置统一使用块级兄弟及 Embed operation parent；顶级列表首项拆出复用同一 `getOperationParentID`，未在拆分模块复制等价算法。
  - 动态加载请求改用项目唯一 `withEncryptedNotebook` 参数构造；继续保留本地 Layout Port、network/platform/DOM 拆分路径、列表顺序与超级块宽度重平衡。
  - 验证：`remove.ts` 与 `remove.removeLi.ts` 独立 esbuild 语法转换通过，无冲突标记且定向 `git diff --check` 通过。Bundle 验证被尚待处理的 `transaction.ts`、Search 等冲突确定性阻断，不记录为通过；定向 lint 中本次新增的未使用导入已清零，剩余为两个文件原有的函数/文件长度和嵌套结构规则，合并阶段记录但不扩散重构。

- [x] **2026-07-23：WYSIWYG Index 上游事件增量向拆分模块映射**
  - 恢复本地薄入口，并删除抽取后仍残留的拖拽框选、composition/input/keyup 和图片双击重复监听器；旧拖拽处理此前会覆盖 `setupDragSelect` 注册结果，旧输入处理会导致同一输入绑定两次，现均由拆分模块唯一承接。
  - 上游增量分别映射到输入调度、Gallery 选择、拖拽框选、超级块缩放、表格剪切、动态加载、复制、点击导航和表格菜单模块：Undo 前可冲刷待提交输入；表格合并同步抑制额外 input；AV DOM/虚拟快照/表头一致；内容区保留原生 Range，padding 区使用滚动稳定的矩形选择；表格重建恢复内外滚动；数据库项 URI 走统一 URI 分派。
  - 加密读取统一复用 `withEncryptedNotebook` 或显式 notebook 契约；普通链接继续使用本地 `openLink(protyle, ...)` 签名；Gallery Shift/Ctrl 复用同一状态同步 helper，未保留等价重复实现。
  - 验证：入口及 16 个承接模块逐文件 esbuild 语法转换通过，新增 `PendingInputScheduler` Node 测试 2/2；无冲突标记且定向 `git diff --check` 通过。独立转换仅保留项目既有 dayjs namespace 警告；定向 lint 的本次未使用导入与新增规则已修正，剩余为目录容量和既有长函数/文件结构项，合并阶段记录但不扩散重构。

- [x] **2026-07-23：WYSIWYG Transaction 串行提交与 Editable Embed 融合**
  - 保留本地 `transaction.promise/fold/onTransaction/turns` 拆分骨架，未恢复上游约 1774 行旧单体；主入口取消全局防抖数组，改为每个 Protyle 通过 `queueTransaction` 严格按提交顺序写入，当前请求失败保持可观察，后续请求继续执行，不静默吞掉当前错误。
  - Editable Embed 的 update/delete/move/insert 在提交前同步同 ID 普通副本和嵌入副本，依据操作上下文保护当前编辑 DOM；受影响查询块使用 Set 去重，并在内核写入完成后重渲染，避免查询早于写入得到旧数据。
  - 合入 lite 只更新本地 DOM、Undo 输入冲刷链、callback、undoContext、AV 对齐/新建模板/属性面板刷新、Fold 属性精确同步、加密动态加载、块级兄弟、Embed operation parent、转换 unfocus 和表格内外滚动恢复；旧 setAttrs 对缺少 fold 字段时错误移除折叠态的问题一并修正。
  - 验证：10 个事务/Undo 模块逐文件 esbuild 语法转换通过；`transactionQueue.test.ts` 3 项覆盖同实例串行、跨实例独立、失败可观察且后续继续，与输入调度 2 项合计 5/5 通过；无冲突标记且定向 `git diff --check` 通过。第一次队列测试依赖单次微任务启动的时序假设，改用显式 started 信号后稳定通过；定向 lint 无未使用项，剩余为拆分模块既有长函数/文件和控制流结构规则。

- [x] **2026-07-23：Search 资源索引文案与加密范围融合**
  - 资源菜单继续使用本地 Menu/环境访问器和拆分 submenu，只把重建操作改为上游专用 `rebuildAssetContentIndex` 文案，避免与系统“重建索引”混淆；同步补齐已存在于 21 份语言资源中的 i18n 类型键。
  - `util.ts` 保持拆分入口，未恢复上游约 100 行 `inputEvent` 重复实现；单一加密 box 的全文与 Kernel 语义搜索携带 notebook，多 box/全局搜索保持原查询语义。
  - 本地 Embedding 语义兜底复用同一加密 box 判定并过滤结果，避免 Kernel 查询正确隔离后由本地兜底混入其他身份/笔记本数据；同时修复拆分后 `finishBlockSearch` 仍按旧多参数签名调用的问题。
  - 验证：`assets.ts`、`util.ts`、`inputEvent.ts` 独立 esbuild 语法转换通过，无冲突标记且定向 `git diff --check` 通过；定向 lint 无未使用或新增规则问题，剩余为 Search 文件原有长度/参数结构项。

- [x] **2026-07-23：Types 配置、Notebook 与 Protyle 运行时契约融合**
  - `config.d.ts` 保留本地命令审核与旧 OpenAI 配置类型，同时纳入上游视觉、图像生成、重排模型和 Embedding 维度，形成实际 AI 配置能力并集。
  - `INotebook` 同时保留 MAGI 工作空间使用的 `aiMainNotebook` 标记和文件树/移动端使用的 `subFileCount`；两者具有独立消费者，不以任选一侧方式处置。
  - `IProtyle` 的背景类型继续指向实际导出类 `header/Background.ts`，并加入上游数据库属性面板；保留本地 `IUndo` 契约和可取消 loading 控制器，不恢复已删除且无当前消费者要求的旧 Preview 字段。
  - 验证：三份声明文件经 TypeScript AST 解析无语法诊断；实际类路径及双方字段消费者核对通过；无冲突标记且定向 `git diff --check` 通过。声明文件被当前 ESLint 配置忽略，因此不把该检查记录为 lint 通过。

- [x] **2026-07-23：Tree 块拖拽与新建笔记本导入融合**
  - `Tree.ts` 同时保留本地 Backlink/Bookmark 空子树箭头语义与上游 `blockDraggable` 属性；Bookmark 的只读门禁、dragStart/dragEnd 控制器继续使用同一 Tree 实例，不另建重复拖拽路径。
  - `mount.ts` 保留本地 util 分层、平台判断、编辑器打开入口和 i18n 环境访问器，同时纳入上游 `.sy.zip` 笔记本导入、可折叠导入区和 Obsidian Vault 入口。
  - Obsidian 能力通过运行时 `isElectron` 隐藏并使用现有延迟 IPC 适配层，未恢复条件编译或 Electron 静态导入；浏览器端仍可使用 `.sy.zip` 导入，桌面端追加 Obsidian 目录选择和已有导入任务流程。
  - 验证：两文件 TypeScript AST 解析通过；8 项行为断言覆盖 draggable、箭头规则、Electron 门禁、无静态 Electron 依赖、IPC 适配器及两类导入入口；无冲突标记且定向 `git diff --check` 通过。定向 lint 未出现新增导入/异步问题，剩余为 Tree 既有长函数/文件与上游扩展后的 mount 长函数结构规则，合并阶段不扩散重构。

- [x] **2026-07-23：同步重载加密范围与 URI 安全定位融合**
  - `reloadSync.ts` 保持本地移动/桌面运行时分流；移动主编辑器标题请求与桌面各编辑器/大纲请求均携带加密 notebook，移动编辑器重载后同步刷新当前大纲，随后仍只在移动分支刷新文件树并返回。
  - `uri.ts` 保留本地 URI 处理器拆分、平台运行时分流和 IPC 适配器；数据库项目链接在打开前排队 AV 定位请求，并分别通过桌面 Model 回调和移动 Protyle 回调激活，普通块动作语义不变。
  - 插件自定义页签在渲染前校验图标标识符；Bazaar URI 在动态加载设置模块前校验包名，并支持 `readme-installed` 从已下载资源读取。实际插件事件和插件自定义模型仍为不同路径，不重复打开页签。
  - 验证：三模块 TypeScript AST 解析通过；10 项定向断言覆盖移动加密/大纲、AV 双端定位、插件图标、Bazaar 校验/来源及无条件编译/静态 Electron 依赖；`bazaarPackage.test.ts` 4/4 通过；无冲突标记且定向 `git diff --check` 通过。本轮新增的批量导出、switch 和类型断言 lint 项已修正，剩余为 util 目录既有容量、reloadSync 长函数及 uri 原有注释规则。

- [x] **2026-07-23：独立窗口初始化与窗口消息行为融合**
  - `window/init.ts` 保持本地 WebFrame/IPC 适配器、环境访问器、Emoji/Tab 类型守卫和 resize 拆分；加入独立窗口 URI 打开覆盖，并用 `afterLayoutReady` 等待插件异步加载后挂载，避免逐插件提前或重复执行 UI 生命周期。
  - 原生 Dialog 覆盖继续由运行时 Electron 门禁保护；活动页签仍通过类型守卫恢复，Dock 过渡后继续设置标签位置。resize 中的同步 Dialog 遍历按 lint 改为 `for...of`。
  - `onWindowsMsg.ts` 保留本地无 switch 分派、直接/按模式锁屏和 Electron 样式守卫；吸收上游 6px 顶部容差，并按 #18121 移除只允许独立窗口更新拖拽区域的旧门禁，使主窗口只读标签栏也能正确切换拖拽区域。
  - 验证：两文件 TypeScript AST 解析通过；10 项定向断言覆盖运行时适配、URI 覆盖、插件生命周期、Tab 恢复、过渡定位、拖拽容差/范围/类型及锁屏命令；无冲突标记且定向 `git diff --check` 通过。定向 lint 修正本轮触发的 forEach/判断/定时器说明后，剩余为 init 文件既有的逐导入注释规范，合并阶段不扩展整文件注释重写。

- [x] **2026-07-23：Kernel Go 依赖并集与校验和重建**
  - `go.mod` 采用上游公共依赖升级，保留本地 yaegi、workspace websearch、string-metrics 及 logging 本地替换；gowebdav、excelize、x/crypto、x/image 使用上游新版本，未保留同模块双版本。
  - `go.sum` 未手工拼接两侧生成物；清除冲突块后由 Go 1.26 的 `go mod tidy` 根据最终依赖图完整重建。
  - 验证：`go mod verify` 报告 `all modules verified`；本地四类依赖/replace 与上游关键升级逐项断言存在；无冲突标记且定向 `git diff --check` 通过。

- [x] **2026-07-23：MCP Tool 处理器契约并集**
  - `Tool` 同时保留本地普通 `Handler`、流式 `ProgressHandler` 和上游可取消 `ContextHandler`；统一使用 `map[string]any`，不改变既有工具注册端的调用语义。
  - 保留上游 `ReadOnlyHint`、ActionEffects、EffectScope 和 `EffectsFor`，并与本地进度快照、执行未知标记共存，供 Agent 确认/快照/流式渲染链使用。
  - 验证：独立 `go test mcp/tools/types.go` 通过；无冲突标记且定向 `git diff --check` 通过。完整 `mcp/tools` 包测试待其余工具文件冲突闭合后执行。

- [x] **2026-07-23：Agent Session 测试所有权拆分**
  - `session_test.go` 保持上游 stage 3 内容原样，承载修订冲突、运行时恢复、重做、幂等提交、异常元数据和工具执行状态测试；不在该文件内混入本地测试。
  - S-Forge 自有的 targetKind、任务目录 capability store、权限和删除生命周期三项测试原样迁入 `session_task_directory_test.go`，避免后续上游更新反复形成整文件冲突。
  - 验证：两文件分别与合并索引 stage 3/stage 2 blob 哈希一致，测试函数名集合无重复，冲突标记和定向 `git diff --check` 通过；包级测试待 `session.go/agent.go` 契约闭合后补充，不将未执行记录为通过。

- [x] **2026-07-23：Agent Session 修订协议与任务目录 capability 融合**
  - 以上游逐会话锁、revision/expectedRevision、运行时权威恢复、commitTurnID 幂等提交和执行状态恢复为持久化主干，保留本地 targetKind 索引/过滤与工作空间级多任务目录 capability。
  - 客户端夹带的 `taskDirectory` 在新会话和既有会话未知字段合并两条路径均被剔除；会话删除先持有会话锁并清理 capability，读取或写入 capability store 失败直接返回带上下文错误，不继续形成半删除状态。
  - Session 索引的时间从最终合并数据读取，targetKind 同样从最终数据规范化，避免客户端省略字段时把已有 MAGI 会话误归为原生 Agent。
  - 验证：双方 session.go 函数名集合在合并结果中均无缺失；5 项断言覆盖 revision lock、runtime commit、targetKind、capability 防注入和删除错误传播；gofmt、无冲突标记和定向 `git diff --check` 通过。包级测试仍由 `agent.go` 冲突阻断，闭合后补记执行结果。

## 滚动记录

- **2026-07-22**：创建本轮 TTT。尚未修改任何冲突内容；下一步重新生成并校验全部本轮备份。
- **2026-07-22**：从合并索引 stage 2/3 重新导出 198 组 `.backup/.remote`，共 396 个文件。逐文件执行 `git hash-object`，全部与对应 stage blob 一致；缺失侧固定为零字节并校验为空 blob `e69de29...`。校验清单写入忽略目录 `.forge-runtime/merge-backup-manifest.json`。首次使用 `git show --output` 的尝试因输出仍进入标准输出而产生空文件，哈希校验立即失败，随后已由原始 blob 导出完整覆盖，不计为有效备份。
- **2026-07-22**：完成 `app/src/dialog/processSystem.ts` 后，剩余冲突由 166 降至 165；继续处理同目录入口及其配置依赖。
- **2026-07-22**：完成 `app/src/dialog/index.ts` 及其一对多模板映射后，剩余冲突由 165 降至 164。
- **2026-07-22**：完成 Tooltip/Block Popover 跨拆分模块融合后，剩余冲突由 164 降至 162；后续 lint 仅修复合并新增问题，不扩展既有架构治理范围。
- **2026-07-22**：完成资源入口安全融合后，剩余冲突由 162 降至 161。
- **2026-07-22**：完成 `_custom.scss` 双功能样式融合后，剩余冲突由 161 降至 160；合并阶段 lint 仅处理本次融合直接引入的问题，不扩展既有架构重构。
- **2026-07-22**：完成移动样式入口与 iframe 交互样式融合后，剩余冲突由 160 降至 158。
- **2026-07-22**：完成缺失资源引用定位融合后，剩余冲突由 158 降至 157。
- **2026-07-22**：完成三项 Dock 固定切换的一对多路由映射后，剩余冲突由 157 降至 156。
- **2026-07-22**：完成代码片段移动端 Dialog 适配后，剩余冲突由 156 降至 155。
- **2026-07-22**：完成全局交互事件融合后，剩余冲突由 155 降至 154；下一步闭合 `touchDragBridge.ts` 实现链。
- **2026-07-22**：完成 Touch/Pointer 单状态机融合后，剩余冲突由 154 降至 153；下一步闭合其 `dragover.ts` 依赖。
- **2026-07-22**：完成双轴拖拽滚动融合后，剩余冲突由 153 降至 152。
- **2026-07-22**：完成 AI 配置组并集注册后，剩余冲突由 152 降至 151。
- **2026-07-22**：完成外观配置与宿主生命周期融合后，剩余冲突由 151 降至 150。
- **2026-07-22**：完成文件树配置职责融合后，剩余冲突由 150 降至 149。
- **2026-07-22**：完成访问与加密笔记本配置融合后，剩余冲突由 149 降至 148。
- **2026-07-22**：完成设置入口与 Bazaar 拆分映射后，剩余冲突由 148 降至 147。
- **2026-07-22**：完成旧 Bazaar 单体的上游行为一对多归并并保留本地删除后，剩余冲突由 147 降至 146。
- **2026-07-22**：完成动态图标解析去重融合后，剩余冲突由 146 降至 145。
- **2026-07-22**：完成历史索引专用文案融合后，剩余冲突由 145 降至 144。
- **2026-07-22**：完成加密笔记本文档删除查询融合后，剩余冲突由 144 降至 143。
- **2026-07-22**：完成水平边距算法去重与导出后，剩余冲突由 143 降至 142。
- **2026-07-22**：完成 Protyle UI 初始化上游增量的一对多映射后，剩余冲突由 142 降至 141。
- **2026-07-22**：完成编辑器链接与 Protyle compatibility 唯一实现融合后，剩余冲突由 141 降至 139；定向 lint 仅用于确认融合未产生解析错误，不扩展处理既有结构规则。
- **2026-07-22**：完成 Editor 初始化增量向本地 helper 与类型契约映射后，剩余冲突由 139 降至 138；下一步对大型 `editor/util.ts` 执行一对多行为映射。
- **2026-07-22**：完成 `editor/util.ts` 四项上游功能向七个实际拆分模块及新页签工厂映射后，剩余冲突由 138 降至 137；兼容入口只转发唯一实现。
- **2026-07-22**：完成 Tab 动态 SVG 图标属性转义融合后，剩余冲突由 137 降至 136。
- **2026-07-22**：完成 Wnd 页签横向拖拽滚动向唯一拖拽模块映射后，剩余冲突由 136 降至 135；未保留重复事件状态机。
- **2026-07-22**：完成 `tabUtil.ts` 页签复制统一恢复链后，剩余冲突由 135 降至 134；布局位置算法继续由本地唯一多平台实现承接。
- **2026-07-22**：完成布局模型恢复、加密门禁、AV URL 定位和序列化增量向五个拆分模块映射后，剩余冲突由 134 降至 133；中央 util 保持薄 facade。
- **2026-07-23**：完成工具栏恢复窗口标题融合后，剩余冲突由 133 降至 132。
- **2026-07-23**：完成标签过滤状态机与本地内嵌 Protyle 生命周期融合后，剩余冲突由 132 降至 131；过滤单测 4/4 通过。
- **2026-07-23**：完成书签过滤、四类拖放与本地内嵌 Protyle 生命周期融合后，剩余冲突由 131 降至 130；相关纯函数回归共 7/7 通过，下一步处理 Backlink。
- **2026-07-23**：完成 Backlink 加密笔记本 box 级读取隔离融合并补齐固定 Dock 首次查询后，剩余冲突由 130 降至 129；下一步处理 Files。
- **2026-07-23**：完成文件树 24 项上游增量向本地拆分架构的一对多映射后，剩余冲突由 129 降至 128；17 项行为断言与 19 模块独立解析通过，下一步闭合 Dock 入口及排序事件路由。
- **2026-07-23**：完成 Dock 状态与拖拽阈值增量向唯一拆分模块映射后，剩余冲突由 128 降至 127；下一步进入 Agent Dock 冲突组。
- **2026-07-23**：完成 Agent 会话面板删除/修改冲突映射后，剩余冲突由 127 降至 126；旧类保持删除，IME 修复进入新视图唯一实现。
- **2026-07-23**：完成 Agent 会话存储认证、目标能力与上游 checkpoint/revision 并发语义融合后，剩余冲突由 126 降至 125；7 项定向测试通过，下一步处理 Composer。
- **2026-07-23**：完成 Agent Composer 的完整 App/最小宿主能力分流后，剩余冲突由 125 降至 124；共享历史消除等价重复，11 项相关测试通过，下一步处理消息渲染器。
- **2026-07-23**：完成 Agent 消息富渲染与完整宿主事件委托融合后，剩余冲突由 124 降至 123；9 项行为断言与独立解析通过，下一步进入 AgentChat 主控制器。
- **2026-07-23**：完成 AgentChat 28 个冲突块的宿主能力、MAGI、检查点恢复、富消息和工具流融合后，剩余冲突由 123 降至 122；AgentHistory 4/4、Agent Panel 30/30 通过，下一步核对 SSE/History 紧密契约并进入 AI 入口组。
- **2026-07-23**：完成 Agent SSE/History 与 Kernel 契约核对，修复畸形帧静默丢弃和 confirm effects 丢失；Agent Panel 33/33 通过，冲突数保持 122，下一步进入 `app/src/ai`。
- **2026-07-23**：完成智能编辑菜单上游三项增量向本地拆分模块映射，并保持旧 `ai/chat.ts` 删除；剩余冲突由 122 降至 120，旧消费者将在 Protyle 键盘冲突中迁移。
- **2026-07-23**：完成桌面启动链四项上游增量向本地 platform/环境访问器架构映射；剩余冲突由 120 降至 119，下一步处理全局命令面板与键盘事件。
- **2026-07-23**：完成 Dock 固定切换命令和加密笔记本键盘门禁融合；剩余冲突由 119 降至 117，下一步处理主应用入口 `app/src/index.ts`。
- **2026-07-23**：完成主应用首次使用、AV 定位、文件树排序事件和移动壳键盘恢复融合，并移除遗留启动模型探针；剩余冲突由 117 降至 116，下一步进入菜单冲突组。
- **2026-07-23**：完成公共菜单外链运行时分流去重、SiYuan URI 入口和加密查询参数融合；剩余冲突由 116 降至 115，继续处理菜单核心与工作区菜单。
- **2026-07-23**：完成菜单核心事件、action 定位、IME/keymap 输入行为向拆分 helper 映射并删除旧单体重复实现；剩余冲突由 115 降至 114，下一步处理工作区菜单。
- **2026-07-23**：完成工作区菜单 Dock 命令标识、accelerator 和数据迁移入口融合；剩余冲突由 114 降至 113，下一步处理菜单导航与 Protyle 菜单组。
- **2026-07-23**：完成导航菜单打开文档、改图标、加密导出/制卡/属性门禁融合，上游旧多选单体映射到现有拆分模块；剩余冲突由 113 降至 112，下一步处理 Protyle 菜单。
- **2026-07-23**：完成 Protyle 菜单 keymap、标签联想/重命名和三条加密 zoomOut 请求映射，删除约 2053 行旧单体重复实现；剩余冲突由 112 降至 111，菜单冲突组闭合。
- **2026-07-23**：完成 AI 配置五类模型选择器、Provider 远程缓存和可搜索列表的确定性融合，并移除等价的原生下拉重复实现；剩余冲突由 111 降至 110，下一步处理 `app/src/block/util.ts`。
- **2026-07-23**：完成块工具插入目标、撤销焦点、嵌入父级和加密 notebook 增量向三个拆分 helper 的映射；剩余冲突由 110 降至 109，下一步进入移动端冲突组。
- **2026-07-23**：完成移动端 Backlinks、Files、Outline 的加密、Box Doc、动画、拖拽排序、持续重载和异步菜单增量映射；剩余冲突由 109 降至 106，下一步处理移动端编辑器/入口/菜单与框架工具链。
- **2026-07-23**：完成移动编辑器打开契约与返回/前进栈的加密、回调和属性刷新融合，同时保持 `getCurrentEditor` 唯一拆分实现；剩余冲突由 106 降至 104。
- **2026-07-23**：完成移动搜索的单加密 notebook 参数与主菜单的加密笔记本、数据迁移、插件布局就绪、安全退出融合；剩余冲突由 104 降至 102。
- **2026-07-23**：完成移动框架 AV/onboarding 启动链和消息层 notebook 生命周期、排序事件路由；剩余冲突由 102 降至 100。
- **2026-07-23**：完成移动键盘工具栏 Android 图片、可见性事件、定时器隔离和通用动作转发向拆分模块映射；剩余冲突由 100 降至 99。
- **2026-07-23**：完成移动主入口键盘锁、viewport、onboarding、window.open 与 AV URL 定位融合；剩余冲突由 99 降至 98，移动端冲突组闭合，下一步处理插件加载器。
- **2026-07-23**：完成插件异步初始化与布局挂载屏障融合，并保持 afterLoad/Dock 唯一拆分实现；剩余冲突由 98 降至 97，下一步进入 Protyle 主体冲突组。
- **2026-07-23**：完成 Breadcrumb 加密请求/Android 图片入口与 Export 加密确认/平台保存/截图占位语义融合；剩余冲突由 97 降至 93，下一步处理 Protyle Gutter 与 Header。
- **2026-07-23**：完成 Header 加密请求、Box Doc 菜单语义、图片封面库与标签拖拽恢复；剩余冲突由 93 降至 90，下一步继续映射 Gutter 的 embed/加密/交互增量。
- **2026-07-23**：完成 Gutter 唯一渲染入口、embed 节点边界、加密菜单能力和 Agent mention 入口融合；剩余冲突由 90 降至 89，下一步进入 Protyle Hint/Preview 冲突组。
- **2026-07-23**：完成 Hint 加密/轻量模式/AV 事务/引用锚文本增量向拆分模块映射，并为 Preview 接入 SiYuan URI 分派；剩余冲突由 89 降至 86，下一步进入 Protyle AV 渲染冲突组。
- **2026-07-23**：完成 AV 属性、模板、行操作、定位与虚拟滚动增量向 34 个拆分模块映射，封面 Node 测试 4/4 通过；整个 AV 组验证后立即暂存，剩余冲突由 86 降至 73，下一步处理 Protyle 渲染与主入口。
- **2026-07-23**：完成 Protyle 嵌入渲染、Agent Lute、lite Undo、加密文档读取及大纲/数据库行细粒度宿主能力融合；三个冲突文件分别验证后及时暂存，剩余冲突由 73 降至 70，下一步处理滚动、工具栏、撤销和上传。
- **2026-07-23**：完成滚动加密读取、lite 上传和 kernel/lite 双模式撤销融合，四个冲突文件按验证完成顺序及时暂存；剩余冲突由 70 降至 66，下一步集中处理工具栏单体到拆分模块的行为映射。
- **2026-07-23**：完成 Toolbar lite/移动插件、Selection 定位、源码面板缩放与软换行行号向本地拆分模块映射；变更模块验证后立即暂存，剩余冲突由 66 降至 65，下一步进入 Protyle util 冲突组。
- **2026-07-23**：完成插入、加载与 Selection facade/Range/Undo 焦点融合，三个冲突文件及其拆分承接模块验证后立即暂存；剩余冲突由 65 降至 62，下一步单独处理编辑器拖拽拆分组。
- **2026-07-23**：完成列表合法性、subtype 转换、书签块引用、lite 复制/引用、加密重载和拖拽失败清理向 `dnd/*` 映射；入口与承接模块验证后立即暂存，剩余冲突由 62 降至 61，下一步进入 WYSIWYG 冲突组。
- **2026-07-23**：完成 Callout、属性点击、快捷键、Enter、List 与 Move 六个窄冲突融合并立即暂存；剩余冲突由 61 降至 55，下一步处理 WYSIWYG 键盘路由及三个大型拆分冲突。
- **2026-07-23**：完成框选复制、跨块 Escape、加密重命名和多块 Escape 选择向 Keydown 中间件映射，验证后立即暂存；剩余冲突由 55 降至 54，下一步处理 Remove 及 Index/Transaction 大型拆分冲突。
- **2026-07-23**：完成 Remove 的 Embed 删除边界、operation parent、加密动态加载和列表删除增量映射，删除旧单体重复实现并及时暂存；剩余冲突由 54 降至 53，下一步处理 WYSIWYG Index/Transaction 大型拆分冲突。
- **2026-07-23**：完成 Index 输入、选择、缩放、剪切、加密读取与导航增量向拆分模块映射，删除两组残留重复监听器并及时暂存；剩余冲突由 53 降至 52，下一步处理 WYSIWYG Transaction 大型拆分冲突。
- **2026-07-23**：完成 Transaction 串行写入、Editable Embed、副本同步、加密 Fold、AV 操作与转换位置语义映射，验证后立即暂存；剩余冲突由 52 降至 51，WYSIWYG 冲突组闭合，下一步进入 Search。
- **2026-07-23**：完成 Search 专用资源索引文案和加密 box 的 Kernel/本地语义双路径隔离，两个冲突文件及承接模块验证后立即暂存；剩余冲突由 51 降至 49，下一步处理 Types。
- **2026-07-23**：完成 Types 的 AI 配置并集、Notebook 双字段和 Protyle 实际类型路径融合，验证后立即暂存；剩余冲突由 49 降至 46，下一步处理 util/file/window。
- **2026-07-23**：完成 Tree 块拖拽和新建笔记本 `.sy.zip`/Obsidian 导入向本地运行时平台架构映射，验证后立即暂存；剩余冲突由 46 降至 44，继续处理 reloadSync/URI/window。
- **2026-07-23**：完成同步重载的移动加密/大纲刷新及 URI 的 AV 定位、插件/Bazaar 安全增量映射，验证后立即暂存；剩余冲突由 44 降至 42，下一步处理 window 冲突。
- **2026-07-23**：完成独立窗口 URI 覆盖、异步插件布局生命周期及窗口拖拽/锁屏消息融合，验证后立即暂存；剩余冲突由 42 降至 40，前端冲突组闭合，下一步进入 Kernel。
- **2026-07-23**：完成 Kernel 依赖并集与 go.sum 受控重建，`go mod verify` 通过后立即暂存；剩余冲突由 40 降至 38，继续处理 Agent/MCP 紧密契约。
- **2026-07-23**：完成 MCP Tool 处理器、进度和副作用契约并集，独立解析测试通过后立即暂存；剩余冲突由 38 降至 37，继续处理 Agent 执行链。
- **2026-07-23**：按测试所有权拆分 Session 测试，上游 `session_test.go` 保持原样、本地三项测试迁入专用文件并立即暂存；剩余冲突由 37 降至 36，包级执行等待 Session/Agent 生产代码闭合。
- **2026-07-23**：完成 Session revision/runtime 与本地 targetKind/task-directory capability 融合，静态并集和关键行为断言通过后立即暂存；剩余冲突由 36 降至 35，包级测试待 agent.go 闭合。
- **2026-07-23**：完成 `kernel/agent/tools.go` 的执行契约融合草稿，统一上下文取消、进度回调、幂等字段、任务目录授权和 execution-unknown 语义；调用方尚未闭合，暂不计入已解决冲突，下一步处理 `agent.go` 的会话隔离等待通道与运行时事件协议。
- **2026-07-24**：完成 Agent/Agent API/AI 配置/OpenAI 客户端紧密契约的融合草稿：交互等待通道按会话隔离且只接受一次，runtime turn 与 owner/task-directory/进度/执行未知语义并存，敏感会话不进入全局广播；AI 配置保留 OpenAI、CommandReview、WebSearch、Rerank、Vision、ImageGeneration 并集，客户端以单一配置工厂组合代理与模型专属请求参数。当前仍待解决 `util` 依赖冲突后执行包级测试，未验证暂存前剩余冲突仍记 35。
- **2026-07-24**：完成 `util` OCR 错误构造、相对时间分钟单位、桌面/移动日志 API 与版本常量融合并立即暂存；保留 Forge 模式常量，版本与上游应用统一为 3.7.3，剩余冲突由 35 降至 31。Agent 包测试现由 `treenode/node.go` 未解决冲突阻塞。
- **2026-07-24**：完成 `treenode/node.go` 的空 `src` 属性解析融合，采用上游 `bytes.Cut` 保留空属性合法语义并消除重复索引；`go test ./treenode` 通过后立即暂存，剩余冲突由 31 降至 30。
- **2026-07-24**：完成 AI 配置与 OpenAI 客户端正式融合并暂存：保留本地 OpenAI/CommandReview/WebSearch、上游 Rerank/Vision/ImageGeneration、keyless Provider、MCP 唯一 ID、请求/流超时；单一客户端配置工厂统一代理、User-Agent、Azure 与 MiniMax extra body。`go test ./conf`、`go test ./util` 均通过，剩余冲突由 30 降至 28。
- **2026-07-24**：完成 `filesys/tree.go` 加密树写入链去重，保留 `util.WriteFileByMmap` 唯一实现与 `filelock.WriteFile` 明确兜底，删除未再调用的文件内 mmap 复制；`go test ./filesys` 通过后立即暂存，剩余冲突由 28 降至 27。
- **2026-07-24**：完成 SQL FTS/缓存/队列/批量更新融合并立即暂存：采用上游 external-content FTS 的 blocks rowid 绑定与“先更新 FTS、再更新 blocks”顺序，保留本地加密 box 路由、IAL 同步和队列耗时观测；删除已被 `util.WriteFileByMmap`/rowid 查询取代的重复 FTS rowid 全局映射，修正 box 维度引用缓存。`go test ./sql` 核心测试通过；需要 FTS5 的等价性与 rowid 计划测试以 `-tags fts5` 通过，默认环境中的 FTS5 性能/可用性测试因 SQLite 模块不可用单独记录，不收窄核心范围。剩余冲突由 27 降至 22。
- **2026-07-24**：完成 Agent 执行链正式验证并暂存：`agent.go`、`tools.go` 与 `mcp/tools/frontend.go` 统一 runtime turn、会话复合键/只接受一次、Forge/任务目录确认、命令审核、进度、取消和 execution-unknown；`go test ./agent` 通过，剩余冲突由 22 降至 19。
- **2026-07-24**：完成 Model 依赖组七文件融合并暂存：Notebook 同时保留 AI 主笔记本、子文件数和加密状态；导出使用加密读锁且多 ID 块引唯一实现；模板/事务保留多 ID 引用并吸收跨边界降级与 box 级动态锚文本；树加载统一进入 box-aware helper。`go test ./model` 通过，剩余冲突由 19 降至 12。
- **2026-07-24**：完成 API AV 弃用参数与本地导入路径错误日志 API 融合并暂存，使用上游直接日志方法保持消息唯一构造，剩余冲突由 12 降至 10；下一步闭合 `api/file.go` 与 `api/router.go` 后运行完整 API 包测试。
- **2026-07-24**：完成 Agent/File/Router API 紧密组融合并暂存：Agent API 保留 runtime revision/commit、所有者与任务目录隔离、会话复合键和敏感会话广播门禁；文件复制保留结构化参数、工作区/加密路径、symlink 与敏感路径门禁并删除重复目标初始化；路由同时注册 AI 主笔记本与加密笔记本接口。权限测试改为确定性验证真实等待通道缺失时返回 409、错误所有者返回 403，不恢复旧的静默成功语义；适配 `model.Close` 新返回值后 `go test ./api` 通过，剩余冲突由 10 降至 7。下一步处理配置与 Model AI 紧密组。
- **2026-07-24**：完成 `conf/box.go` 与 `model/ai.go` 配置契约组并暂存：笔记本配置同时保留 AI 主笔记本标识和上游版本化加密包络；编辑 AI 保留本地 Claude/代理调用链，并在唯一客户端构造处接入上游按模型注入额外请求参数的工厂，Provider 与迁移配置选择逻辑未新增分支。`go test ./conf`、`go test ./model` 与定向 `git diff --check` 通过，剩余冲突由 7 降至 5。下一步处理 MCP 两文件。
- **2026-07-24**：完成 MCP 处理器与 Web Search 工具组并暂存：标准与 2026 协议的 `tools/list` 均使用 `GetAvailableTools()`，防止 Forge 和任务目录工具脱离运行模式/会话上下文暴露；Web Search 保留唯一的增强实现，覆盖本地引擎、Exa/Parallel、进度、结构化错误与可信来源保护，上游单一 Exa 查询语义已被完整覆盖。`go test ./mcp/...` 与定向 `git diff --check` 通过，剩余冲突由 5 降至 3。下一步联动处理 CLI/Server/Mobile 启动链。
- **2026-07-24**：完成 CLI/Server/Mobile 启动链并暂存：CLI 保持原 `workspacePath`、`resolveWorkingDir()`、Forge 模式、`--no-browser` 与资产元数据初始化，仅吸收上游 CLI 日志级别应用；Server repo diff 路由采用边界校验、加密笔记本解锁检查和读锁；Mobile 采用显式格式日志并启动插件管理器。`go test ./cli/cmd`、`go test ./server`、`go test ./mobile` 与定向 `git diff --check` 通过，剩余冲突由 3 降至 0。进入合并后完整回归，局部包测试不替代最终证据。
- **2026-07-24**：首次合并后核心门禁 `go test -short -tags fts5 ./...` 完整运行 93.7 秒后失败，未缩小门禁：`av/TestRollupRelativeDateFilter` 将未来 rollup 日期错误纳入 before-today；`nerv/magi/coordinator/TestCoordinateDecision_AvatarHeartbeatTimeoutReturns404UntilRewriteDone` 的成功期望与当前 Avatar 强制分派错误语义冲突。其余包均通过，包括 Agent、API、Model、SQL、MCP、Server、MAGI 其余包和全部向量包。下一步分别定向复现并按行为契约修复生产回归或过期测试断言，然后重跑同一全包门禁。
- **2026-07-24**：首次门禁的两项失败已按生产语义修复并暂存。AV rollup 缓存指纹现包含实际引用目标值，目标值解析由指纹与构建共享唯一函数；构建前克隆目标值，避免数字格式化污染来源并造成伪失效。Avatar 原型阶段仅暴露明确要求的 `buildAvatar` 运行时工具，与既有 synthesize 阶段保持同一确定性工具调用语义，删除宽工具集包装。AV 三项专项与 Avatar 两项专项连续 5 次通过，随后 `go test -short -tags fts5 ./av` 和 `go test -short -tags fts5 ./nerv/magi/coordinator` 整包通过；下一步重跑完整核心门禁。
- **2026-07-24**：修复后的第二次核心门禁 `go test -short -tags fts5 ./...` 完整通过，耗时 46.2 秒，覆盖 Kernel 全部包、FTS5、MAGI 和向量库；随后独立 `go vet -tags fts5 ./...` 完整通过，耗时 24.2 秒。Kernel 合并回归门禁闭合，下一步执行前端测试、类型检查、语言键和 lint。
- **2026-07-24**：前端测试编排完成并验证。新增单一测试分类源，将 `node:test`、Vitest 单元测试和需运行 Kernel/性能资源的集成测试分开；Node 集合 12 文件、119 用例通过。Vitest 注册 Vue SFC 转换和 `happy-dom`，默认脚本以十文件独立进程组执行以隔离跨文件残留句柄，完整 76 文件、465 用例通过（114 秒）；集成测试仍保留在显式 `test:integration`，未从测试树删除。修复合并后遗留的 `util/DOM`、`util/assets`、`util/lib` 路径，并恢复纯类型化 `matchCondition` 至 `util/lib`，其基础和键盘场景测试通过。`pnpm-lock.yaml` 已由 pnpm 重建并恢复跟踪。
- **2026-07-24**：按用户要求新增 `lint:cycles`（Madge + TS 配置）并执行静态循环依赖检查。初始简单环路径折叠为 9 个强连通组件；以合并前本地 `28f028b9e` 为基线分析后，识别出 Mobile Outline 的 4 文件新增组件。创建 `MobileOutlinePort` 类型契约，让菜单、展开与排序行为模块仅依赖最小 Port，而主类单向组合这些行为；组件已移除，当前剩余 8 个组件均为既有大型架构组件或本地基线组件。未修改 `imports.ts`，该机制继续作为耦合探针。后续继续审查大组件新增接入点及完成类型/lint/语言检查。
- **2026-07-24**：前端联合回归完成：`pnpm test` 通过，包含 Node 119 项和 Vitest 76 文件、465 项。`pnpm run typecheck:protyle-contract` 通过；根目录语言键检查 21 文件、2240 预期键通过。主 `pnpm run typecheck` 即使给予 8GB V8 堆仍在约 7-8 分钟后因 TypeScript 内存耗尽退出，未产生源码诊断；未缩窄检查范围，作为最终审计未闭合项保留。`lint:cycles` 的全量执行继续报告既有 8 个强连通组件，Mobile Outline 新组件已消除。
- **2026-07-24**：按“以类型与参数传递解耦”的后续约束，进一步将 Mobile Outline 的宽 `MobileOutlinePort` 收敛为可组合的 DOM、Tree API、会话、持久化、选择与重载契约；菜单、过滤、展开、事务、焦点保持与拖拽排序各自只声明所需能力。类型模块位于 `mobile/dock/outline/ports.types.ts`，使用结构化 `MobileOutlineTreeApi` 而非导入具体 `Tree` 或主 `MobileOutline`，保留 `imports.ts` 作为耦合探针。新类型模块的 lint 通过；既有主类/行为文件的超长函数 lint 与此次类型收紧无关，未在合并收尾中混入结构性重写。
- **2026-07-24**：上述细粒度端口抽取完成后重新执行 `pnpm test`：Node `node:test` 119/119 通过；Vitest 76 个文件、465/465 通过（118.5 秒）。暂存差异检查通过；全量 TypeScript 检查的既有内存耗尽记录保持不变，未通过缩小检查范围掩盖该问题。
- **2026-07-29**：完成 Gutter 悬停链的合并后运行时纠偏。`protyle/ui/event.ts` 不再调用并不存在于真实 Gutter 实例上的 `getNodeElement`，而是与 Gutter 渲染链共用 `gutter.node.ts` 的唯一节点解析器；普通块悬停运行测试 `1/1` 通过。完整 `vue-tsc` 可结束并报告 `12,274` 条待处理诊断，本次新增的解析模块与运行测试诊断均为 `0`；`event.ts` 的既有生命周期诊断继续由前端类型门禁 TTT 追踪。
