# S-Forge MAGI/EVA 主界面主题长期演进（TikTocTak）

> **目标**：为 S-Forge 主窗口增加一套与 MAGI 界面协调、具有 EVA 控制台式信息层级和动效语言的内置主题，并同时支持浅色/深色两种变体。主题可在主窗口和 MAGI 界面中独立选择、持久化和运行时切换，不修改或覆盖思源上游 `daylight`/`midnight`。
> **长期性质**：这是视觉系统和主题基础设施的长期任务，不以一次 CSS 覆盖完成为目标；每个阶段都必须留下 token、组件适配、截图和回归记录。
> **阶段化原则**：阶段化的目的，是避免长期任务在接续执行时一次性扩大验证范围，而不是把功能域永久延期。阶段边界只限制本次验证的范围，不构成暂停、保留或推迟实现的理由。只要 TTT 的终极目标尚未全部完成，所有阶段任务就必须继续执行；任何阶段只有在该阶段的全部任务完成、证据齐全并通过验收后才能关闭，不能通过切换阶段跳过未完成项。Protyle、独立入口、菜单/Dialog、块标、移动端和 Agent Dock 都属于本任务的待验收范围。
> **候选主题标识**：暂定 `sforge-eva-light` 与 `sforge-eva-dark`。最终名称在 Phase 0 完成资产注册和视觉基线后确定；如果主题系统要求一组主题共用包名，可改为单包双模式，但不能牺牲独立选择能力。

---

## 1. 关联任务

- [AgentPanel 持续改进](./AgentPanel_持续改进.ttt.md)：MAGI/Agent Dock、浮窗和 Tab 宿主需要使用同一套主题 token 和状态视觉。
- [AI Agent 设计](./AIagent设计.ttt.md)：MAGI 的角色、运行状态、消息和投票信息是该主题的主要语义来源。
- [Layout 非必要依赖解耦与开放扩展](./Layout_非必要依赖解耦与开放扩展.ttt.md)：主题不能依赖具体布局 DOM；布局新增宿主形态时必须继承主题变量和动效约束。
- [Protyle 非必要依赖解耦与独立包化](./Protyle_非必要依赖解耦与独立包化.ttt.md)：独立 Protyle 允许消费主题 token，但主题适配不能重新引入 App/Layout 直接依赖。
- [前端架构迁移](./前端架构迁移.ttt.md)：主题资源加载、运行时配置和 CSS 构建需要遵守前端资源边界。

关联规则：主题任务只拥有视觉 token、主题资源和组件样式适配；布局、Protyle、Agent 运行时的行为改动必须回写各自 TTT，不在本文件中复制业务实现计划。

---

## 2. 现状基线

### 2.1 主窗口主题链路

- 外观配置由 `app/src/config/appearance.ts`、`app/src/config/tabs/appearanceTab.ts` 和 `appearanceRuntime.ts` 编排。
- `app/src/util/assets/assets.ts` 根据 `themeLight/themeDark` 以及当前模式加载 `/appearance/themes/<name>/theme.css`，可选加载 `theme.js`。
- 主界面主要依赖 `--b3-theme-*` 变量，Protyle、菜单、Dialog、Layout、移动端和状态栏均通过这些变量消费主题。
- 上游默认主题仍是 `daylight` 和 `midnight`；新主题必须以新增目录/资源的方式注册，不直接修改上游目录。

### 2.2 MAGI 样式链路

- MAGI 入口位于 `app/src/magi/entry`，主面板、消息气泡、人格/身份、来源模拟、Trinity 监视器等组件各自拥有 CSS 文件。
- 当前样式大量直接使用 `#0ff`、`#0f0`、`#050c0c`、霓虹阴影和硬编码字体/间距；这些值形成了现有 MAGI 的视觉参考，但还不是可供主窗口复用的主题契约。
- MAGI 同时运行于桌面、普通 App 和移动模板，主题适配必须覆盖 `app/src/assets/template/magi/{desktop,app,mobile}` 的宿主背景、标题栏和安全区。

### 2.3 初步判断

当前最集中、最值得先隔离的不是某个颜色，而是“语义状态 -> 视觉 token”的映射缺失：运行中、心跳、休眠、异常、投票结果、消息层级、可交互/禁用等状态在主窗口和 MAGI 中使用了不同的硬编码表达。若直接复制 MAGI CSS 到主界面，会产生新的一套黏合层并放大主题切换风险。

---

## 3. 视觉目标与不变量

### 3.1 视觉方向

- 参考 MAGI 的控制台、终端和状态监视视觉，但主窗口仍然必须是可长期工作的知识工具，不能变成全屏装饰性 HUD。
- 借鉴 EVA 动画中的信息分层、警戒等级、状态指示、扫描/确认反馈和短促过渡；动效服务于状态理解，不用持续闪烁或大面积干扰编辑。
- 深色变体以近黑/石墨为底，使用青色、绿色、琥珀色、洋红色和红色分别表达中性、正常、警告、特殊和错误状态；浅色变体保留相同语义色的对比度和层级，不做简单反色。
- 主界面保持密度、边界、可读性和快速扫描；MAGI 可以更强烈，但不能脱离同一语义 token。
- 圆角、阴影、边框、字重、字距和动效时长都应成为 token；禁止在组件中重复写一组无法追踪的魔法值。

### 3.2 必须保持的不变量

- 不修改 `daylight`、`midnight` 和第三方主题的既有行为。
- 主题切换不改变布局 JSON、页签/浮窗生命周期、Protyle 事务、Agent 会话、WebSocket 或插件接口。
- 主窗口、MAGI、移动端和独立 Protyle 在同一主题变体下使用同一组语义 token；宿主差异只能体现在布局尺寸和可用交互上。
- `prefers-reduced-motion` 必须能够关闭非必要扫描、脉冲、闪烁和位移动效；状态颜色和文本语义不能只依赖动画表达。
- 主题资源可卸载或切换；不能依赖一次性注入后永不销毁的全局样式脚本。
- 主题 CSS 不直接导入 Layout、Protyle 或 MAGI 运行时模块；组件通过稳定类名和 token 消费主题。

### 3.3 当前非目标

- 不在首阶段重写整个主界面 DOM、Layout、Protyle 或 MAGI 组件结构。
- 不把主题实现成仅覆盖主窗口的“演示皮肤”，也不复制一套与思源菜单、Dialog、状态栏无关的伪 UI。
- 不将 EVA 角色、版权素材或大面积背景图作为主题功能依赖；视觉参考优先通过色彩、排版、边界和动效表达。
- 不以单张截图作为完成证明；必须覆盖浅/深、主窗口/MAGI、桌面/移动和关键状态。

---

## 4. 主题契约

### 4.1 语义 token 层

第一阶段至少定义以下 token 族，名称应与现有 `--b3-theme-*` 能力建立清晰映射：

- `--sforge-bg-*`：应用背景、内容背景、浮层背景、编辑器纸面。
- `--sforge-surface-*`：面板、菜单、Dialog、输入框、选中层和悬浮层。
- `--sforge-fg-*`：主文本、次文本、弱文本、反色文本和禁用文本。
- `--sforge-accent-*`：主强调色、次强调色、焦点环、链接和选中状态。
- `--sforge-signal-*`：normal、running、heartbeat、sleeping、warning、error、special。
- `--sforge-border-*` 与 `--sforge-shadow-*`：边界层级、内嵌线、浮层和焦点反馈。
- `--sforge-motion-*`：短反馈、中等过渡、面板进入/离开和脉冲周期。
- `--sforge-type-*`：UI 等宽字体、正文、标题、标签字距和数字显示。

`--b3-theme-background`、`--b3-theme-surface`、`--b3-theme-primary` 等上游变量仍是兼容入口。新主题可以在主题 CSS 内将它们映射到 S-Forge token，但不能要求 Protyle 或插件立即改用新变量。

### 4.2 组件层

建立覆盖范围清单并按优先级迁移：

1. 主窗口框架、顶栏、状态栏、Dock、Tab、Dialog、菜单和通知。
2. Protyle 工具栏、块标、编辑区、搜索/提示和独立入口。
3. MAGI 标题栏、运行状态、输入区、消息气泡、投票/来源面板和身份面板。
4. 移动端导航、底部工具栏、全屏面板和安全区。
5. 特殊状态：重建索引、WebSocket 断线、Agent 心跳、流式输出、错误和空态。

### 4.3 资源和加载层

- 新主题使用标准主题目录和现有 `loadAssets` 链路注册，不新增动态 import。
- 若需要 `theme.js`，只允许实现主题生命周期钩子和少量 DOM 能力增强；颜色、布局和大多数动效必须由 CSS 完成。
- 主题资源应能在正式构建、开发监听、独立 Protyle 页面和 MAGI 多入口中定位到同一份版本化资源。
- 主题包需要声明浅色/深色变体、最低版本、资源版本和可选能力；缺失资源必须回退到对应上游变量而不是白屏。

---

## 5. 阶段计划

## 🟢 近期计划（Phase 0：基线与契约）

- [ ] **采集视觉基线**
  - 在当前 `daylight`、`midnight` 和 MAGI 页面分别截取桌面宽屏、窄窗口、移动尺寸截图。
  - 覆盖主窗口、设置/菜单/Dialog、编辑器、Agent Dock/MAGI 主面板、消息流、运行状态和错误状态。
  - 记录截图尺寸、入口 URL、主题配置、构建版本和已知差异，作为后续视觉回归基线。

- [ ] **盘点主题变量和硬编码颜色**
  - 生成现有 `--b3-theme-*` 使用清单和 MAGI CSS 中直接颜色/阴影/字体/动效值清单。
  - 将值按“语义状态”“组件结构”“纯装饰”分类，不按出现次数机械决定优先级。
  - 验收：形成可追踪的 token 映射表和组件迁移清单。

- [x] **确定主题命名与注册契约**
  - 选定 `sforge-eva-light`/`sforge-eva-dark` 或最终替代名称，并确定资源目录、版本字段和主题选择器显示文本。
  - 验证 `appearance.lightThemes/darkThemes`、主题切换、重启恢复和第三方主题回退。

- [x] **冻结第一版 token 契约**
  - 先定义背景/表面/文本/强调/信号/边界/动效/字体 token，不改业务逻辑。
  - 为浅色和深色分别定义对比度、禁用态、焦点态和错误态；用可读性检查排除仅凭肉眼判断。

- [ ] **完成第一批视觉基线**
  - 2026-07-16 已完成主窗口浅色/深色、MAGI 桌面浅色/深色和 MAGI 移动深色截图；主窗口设置页和 MAGI 状态面板作为第一批基线，完整矩阵仍待补齐。
  - 该项在完整矩阵、入口、尺寸和已知差异全部记录前保持未完成。

## 🟡 当前执行计划（Phase 1：跨宿主垂直适配与验收）

- [x] **建立主窗口浅色/深色主题资源基座**
  - 在不修改 `daylight/midnight` 的前提下新增主题目录和 CSS。
  - 验收：主题能通过设置和顶部入口选择，切换后布局、编辑和插件行为不变。

- [ ] **完成主窗口全表面垂直适配**
  - 在同一可回归切片内完成框架、Layout、Dock、Tab、Dialog、菜单、状态栏、Protyle 基础表面和块标的浅/深色适配。
  - 不以“组件很多”作为拆出范围的理由；每个未适配组件都必须有明确 token、截图和回归记录。

- [x] **建立 MAGI token 适配层**
  - 将 `app/src/magi/**/*.css` 中的硬编码主色、背景、边界、状态色和动效时长替换为 MAGI token 别名，别名最终落到 `sforge` 语义 token。
  - 保持现有 MAGI 类名、Vue 组件行为和消息/状态协议；禁止在主题任务中复制 MAGI 运行逻辑。
  - 验收：主窗口和 MAGI 在同一主题变体下拥有协调的背景、文字、焦点、状态和错误层级。

- [x] **实现 EVA 信息状态和动效规范**
  - 为运行中、心跳、休眠、警戒、错误、投票收敛、流式输出设计统一的颜色、边框、图标、短过渡和可选脉冲。
  - 为 `prefers-reduced-motion` 提供静态替代；不让持续动画占用编辑器注意力或阻塞输入。
  - 验收：在没有声音和动画的情况下，用户仍能通过文本、颜色和结构识别状态。

- [ ] **完成独立 Protyle 与宿主能力适配**
  - 独立 Protyle 只消费必要主题变量，不引入完整 App DOM；同一切片内验证工具栏、菜单、Dialog、块标、编辑区和状态栏可读性。
  - 独立入口的截图和主窗口截图必须使用同一主题变体，避免只验证主窗口 token 是否存在。

- [ ] **完成移动端与 Agent Dock 适配**
  - 适配 MAGI 移动模板、主界面移动导航、全屏面板、安全区和 Agent Dock/Tab/浮窗。
  - 验收必须包含 390×844 和至少一个桌面尺寸，并检查没有横向溢出、遮挡或透明层级错误。

- [ ] **完成跨宿主回归切片**
  - 对浅色/深色、主窗口/MAGI/独立 Protyle/移动端执行同一套 token、资源加载、控制台和截图检查。
  - 只有该项完成后，Phase 1 才能关闭；后续 Phase 2 只处理 schema、实验场和产品化，不接收本阶段遗漏的基础适配。

## 🔵 远期计划（Phase 4+：视觉系统产品化）

- [ ] 建立主题 token 的类型/Schema 校验，主题缺失变量时在开发环境诊断并安全回退。
- [ ] 建立主题组件样例页或视觉实验场，支持主窗口/MAGI/Protyle 组件并排比较。
- [ ] 将主题状态事件与类型化事件/RPC 能力结合，使外部 MAGI/Agent 宿主能消费状态语义而不依赖 CSS 类名。
- [ ] 评估将 S-Forge 主题 token 作为可复用微前端主题包输出，但不提前移动主界面源码到 `packages`。

---

## 6. 截图与浏览器验收

每个可见阶段必须生成并保留截图，不接受只看 CSS diff 的验收。最低矩阵：

| 入口 | 浅色 | 深色 | 尺寸 |
|---|---:|---:|---|
| 主窗口框架 + Layout | 必须 | 必须 | 1440×900、1024×768 |
| Protyle 编辑器 + 菜单/Dialog | 必须 | 必须 | 1280×800、390×844 |
| MAGI 主面板 + 消息流 | 必须 | 必须 | 1440×900、390×844 |
| Agent Dock/Tab/浮窗 | 必须 | 必须 | 1280×800 |
| 运行/警戒/错误/空态 | 必须 | 必须 | 至少一个桌面尺寸 |

截图验收要求：

- 主题切换后没有未替换的白色/黑色硬块、不可读文本、焦点丢失或状态色冲突。
- 主界面和 MAGI 的边界、字号、密度和状态色协调，但不强求每个组件完全同构。
- 截图中不得出现横向/纵向溢出、动效导致布局跳动、文本与控件重叠或移动端安全区遮挡。
- 浏览器测试记录控制台错误、资源 404、主题切换耗时和截图路径；WebGPU 等环境警告需与主题问题区分。

---

## 7. 风险与决策记录

- **主题污染上游**：新主题只新增资源目录和注册项，不直接改 `daylight/midnight`；主题 CSS 只覆盖语义变量和明确组件类。
- **MAGI 风格孤岛**：先抽取 token，再迁移组件；禁止把 MAGI 的霓虹值散落复制到主窗口 CSS。
- **动效干扰编辑**：所有持续动画必须有 reduced-motion 和低刺激替代，编辑器输入、选区、菜单定位优先级高于装饰。
- **颜色对比不足**：浅色/深色分别做对比度检查，警告/错误不能只通过红绿区分，必要时同时使用图标、文本或边框形态。
- **主题切换破坏运行时**：复用现有 `loadAssets` 和主题销毁链路，切换前后检查 `window.destroyTheme`、Layout 序列化和 MAGI Vue 挂载状态。
- **截图失真**：截图必须注明浏览器、viewport、DPR、主题配置和构建产物，避免把旧 bundle 或 service worker 缓存误认为新主题效果。

---

## 8. 当前进度记录

### 2026-07-16：建立长期任务

- [x] 确认主窗口主题通过 `appearance.lightThemes/darkThemes`、`loadAssets` 和 `/appearance/themes/<name>/theme.css` 加载。
- [x] 确认 MAGI 主面板、消息、状态监视器、身份和移动模板拥有独立 CSS，需要通过 token 适配而不是复制样式。
- [x] 建立与 AgentPanel、AI Agent、Layout、Protyle 和前端架构 TTT 的关联。
- [x] 新增 `sforge-eva-light` 与 `sforge-eva-dark` 主题目录、主题元数据和第一版语义 token，并保持 `daylight`/`midnight` 不变。
- [x] 新增 MAGI 独立入口主题加载器 `app/src/magi/utils/environment/magiTheme.ts`；桌面、App 入口均能从宿主配置加载同一主题资源，加载失败时保留 MAGI 自身回退 token。
- [x] MAGI 根布局和主面板已消费 S-Forge/EVA token，运行/心跳/休眠/错误状态、焦点反馈和 `prefers-reduced-motion` 已有统一适配。
- [x] 构建验证通过：`build:magi-desktop`、`build:magi-app`、`build:app`；当前产物目录体积分别为 MAGI Desktop 1,037,802 bytes、MAGI App 1,460,973 bytes、主 App 6,769,020 bytes、Protyle App 6,229,063 bytes。体积包含目录内静态资源，不能直接作为压缩后网络体积。
- [x] 浏览器验证通过：主窗口浅色/深色主题切换、MAGI Desktop 与 MAGI App 入口、390×844 移动视口；主题 CSS 链接、`data-theme-mode`、`--sforge-accent`/`--b3-theme-primary` 和横向溢出均已检查。MAGI 入口控制台无错误；主窗口仅观察到已有 i18n 缺省提示和 ONNX Runtime WebGPU provider 警告，与主题无关。
- [ ] 当前 Phase 1 验收尚未完成：独立 Protyle、主窗口移动导航、Dialog/菜单/块标和 Agent Dock 是本阶段的待验收项，不是被刻意延期到后续阶段的范围。
- [ ] 终极目标未完成前持续执行：阶段切换只缩小单次验证范围，不关闭或移除任何尚未验收的功能域。

### 2026-07-16：第一阶段截图与产物

截图保存在 `docs/ttt/assets/sforge-eva/`：

- [x] `main-light-1280x720.png`：主窗口浅色编辑器基线。
- [x] `main-dark-1280x720.png`：主窗口深色设置/布局基线。
- [x] `main-dark-mobile-390x844.png`：主窗口深色移动视口基线。
- [x] `magi-desktop-light-1280x720.png`、`magi-desktop-dark-1280x720.png`：MAGI 桌面浅/深色状态面板。
- [x] `magi-dark-mobile-390x844.png`：MAGI 移动视口，确认无横向溢出。
- [x] `protyle-standalone-dark-mobile-390x844.png`：独立 Protyle 当前配置主题覆盖层，页面状态 `ready`，横向溢出为 `0`。

### 2026-07-16：背景层与玻璃表面回归

- [x] 网格背景收回到 `body` 的唯一底层画布；不再绑定 `.fn__flex-1`、`layout-tab-container`、菜单或列表项，避免网格在各功能区域重复平铺。
- [x] 主布局改为可透出底层网格的冷硬玻璃表面：布局框架、Dock、编辑区和菜单分别使用不同透明度与网格层级，列表项保持轻量状态层，不逐项叠加角线框架。
- [x] 主要布局面板增加内收的 MAGI 式角线框架；伪元素完全位于边框盒内部，不改变滚动测量。
- [x] 浅色/深色运行时检查：`body` 保持网格 `background-image`，主题表面使用半透明背景透出网格，`html` 横向溢出为 `0`，主要容器 `scrollWidth === clientWidth`。
- [x] 新截图：`assets/sforge-eva/main-light-glass-1280x720.png`、`assets/sforge-eva/main-dark-glass-1280x720.png`。
- [ ] 这只是主窗口背景层的一次垂直切片，不能视为主题完成；独立 Protyle、Dialog/菜单、块标、移动端、Agent Dock 和 MAGI 全组件仍需按同一契约继续验收。

### 2026-07-16：浮层与定位上下文回归

- [x] 对照上游 `app/src/assets/scss/component/_menu.scss` 与 `_dialog.scss`，确认 `.b3-menu` 和 `.b3-dialog` 宿主必须保留 `position: fixed`；主题只给 `.b3-dialog__container` 和 `.b3-tab-bar` 设置相对定位，未覆盖浮层宿主。
- [x] 修复浅色/深色主题中误将 `.b3-menu` 改为 `position: relative` 的规则；菜单恢复为视口浮层，右键实测挂在 `body` 下并按触发坐标定位。
- [x] 移除布局祖先、菜单和 Dialog 表面的 `backdrop-filter`。这些滤镜会为包含 Protyle 块标、菜单子菜单等 `position: fixed` 后代的树建立新的定位/堆叠上下文；视觉层改由半透明表面、网格和角线框架表达。
- [x] 主窗口深色运行时复核：`.b3-menu` 为 `position: fixed`，实测 `left=700px/top=286px`；`.protyle-gutters` 为 `position: fixed`，首个块悬浮时坐标为 `x=496/y=231`，与块内容起点对齐；`#layouts.scrollWidth === #layouts.clientWidth === 1196`。
- [x] 新截图：本次运行时复核画面已确认菜单不再落入页面底部，块标显示在首个块左侧；正式截图矩阵仍需继续补齐。

### 2026-07-16：独立 Protyle 主题加载回归

- [x] 独立入口先加载对应 `daylight/midnight` 回退 CSS，再按 `appearance.mode/modeOS` 选择 `themeLight/themeDark` 覆盖层；缺失覆盖资源时保留默认主题，不阻塞编辑器启动。
- [x] 在 `http://127.0.0.1:6806/stage/build/protyle-app/` 验证深色配置：`themeDefaultStyle=/appearance/themes/midnight/theme.css`、`themeStyle=/appearance/themes/sforge-eva-dark/theme.css?v=0.1.0`、状态为 `ready`、`--sforge-accent` 与 `--b3-theme-primary` 同值、横向溢出为 `0`。
- [x] 在 `390×844` 视口重新加载并保存截图，确认正文、块标和编辑区没有横向溢出或空白渲染；控制台仅有已有的 i18n 缺省警告。

### 2026-07-16：社区主题参考基线

- [x] 按 GitHub 公开仓库关注度拉取社区主题参考到 `D:\dev\siyuan-theme-references`，使用本机代理 `127.0.0.1:7890` 完成 `dark-plus`、`qyl-theme`、`asri`、`tsundoku`、`rem-craft` 和官方 `theme-sample` 的浅克隆。
- [x] 记录参考版本：Dark+ `f0704dc147685acb029cb7fbefe3bf2fa3eb8356`、QYL `e87e0079014eeb15662c33a80226878897f7869f`、Asri `68cf0a1311b8eb04ef0ce441c52ed2cd0ece2c00`、Tsundoku `1b00e22941020f77b842b6d7a37dc0e6f536fd1`、Rem-Craft `f0af698915d9be866accd2b5e85b00e3dd072bb9`、官方示例 `4d0275f41fa72651ad327efd03010f300ec759fc`。
- [x] 采用官方 `theme-sample` 的 `theme.json` 契约：补齐 `url`、`minAppVersion`、多语言 `description/readme`、`keywords`，使用 BCP 47 语言标签，并保留主题包内 README。
- [x] 采用 Dark+/QYL/Rem-Craft 的模块化思路作为后续约束：主题资源内部按组件职责组织；当前 S-Forge 第一版仍保持单 CSS 入口，后续组件扩展不得散落到业务源码或重复复制 MAGI 运行逻辑。
- [x] 参考 Tsundoku/Dark+ 的兼容层范围，补齐工具栏、页签、提示、卡片、Protyle 代码/标记和上游按钮状态变量，S-Forge token 仍是唯一语义来源。
- [ ] 参考仓库只用于结构、契约和覆盖范围研究，不复制其品牌样式、插件专属选择器或版权素材；S-Forge 主题仍需完成自己的截图矩阵和跨宿主回归。

### 2026-07-16：顶部/底部界面铬层透明度回归

- [x] 运行时计算样式确认顶部 `.toolbar` 与底部 `.status` 曾被 `--b3-toolbar-background: var(--sforge-surface-1)` 直接接管；旧 `surface-1` 的实际 alpha 约为 `0.465`，因此网格和内容明显透出。
- [x] 新增 `--sforge-bg-chrome-base`、`--sforge-bg-tab-base`，先按应用背景与 EVA 强调色做相对 `color-mix`，再分别叠加 `88%`/`78%` 透明度；这样保留玻璃感，同时让顶部、底部成为稳定的界面铬层。
- [x] `--b3-toolbar-background`、`--b3-toolbar-blur-background`、`--b3-tab-background` 以及移动端 `.toolbar/.status/.keyboard` 覆盖统一指向新的铬层变量，避免基础组件绕过局部主题规则。
- [x] 通过主题初始化链路刷新当前主题版本到 `0.1.1` 后复核：`.toolbar`、`.status`、`.layout__dockb` 实际计算背景 alpha 为 `0.88`，没有引入 `backdrop-filter`、`transform`、`filter` 或新的定位上下文。
- [x] 保留回归截图：`assets/sforge-eva/main-dark-chrome-1280x720.png`、`assets/sforge-eva/main-light-chrome-1280x720.png`。

### 2026-07-16：Dock 按钮轨道透明度补漏

- [x] 复核截图与真实 DOM 后确认上一轮覆盖范围不完整：`.layout__dockb` 是底部布局面板，不是左右 Dock 按钮栏；实际 `#dockLeft`、`#dockRight` 和 `.dock__items` 仍为完全透明。
- [x] 新增 `--sforge-bg-dock-rail-base` 与 `--sforge-bg-dock-rail`，为 `#dockLeft/#dockRight/#dockBottom` 提供独立的 `92%` 半透明 EVA 轨道表面，并保留左右/顶部 1px 边界线。
- [x] 顶部 `.toolbar` 增加底部盒内边界线，底部 `.status` 增加顶部盒内边界线；所有新增边界均位于 `box-sizing: border-box` 元素内，不改变 Dock、Layout 的尺寸测量。
- [x] 深色与浅色运行时复核：工具栏/状态栏 alpha 为 `0.88`，左右 Dock 轨道 alpha 为 `0.92`；主题版本更新为 `0.1.2`，页面与 `#layouts` 的横向/纵向溢出均为 `0`。
- [x] 新增回归截图：`assets/sforge-eva/main-dark-dock-rail-1280x720.png`、`assets/sforge-eva/main-light-dock-rail-1280x720.png`。

### 2026-07-16：Protyle 属性态外框回归

- [x] 复现并确认颜色不协调的直接来源：主题全局 `:focus-visible` 规则把 `--sforge-shadow-focus` 应用到可编辑的 `.protyle-wysiwyg.protyle-wysiwyg--attr`，在整块编辑器外形成超出边界的青色矩形。
- [x] 对深色/浅色主题的属性态编辑器显式设置 `border: 0`、`box-shadow: none`，并单独清除其 `:focus-visible` 外框；块选中、悬浮和输入控件的状态反馈仍保留。
- [x] 独立 Protyle 运行时复核：属性态元素聚焦后仍可获得焦点，计算值为 `border: 0`、`box-shadow: none`，页面横向/纵向溢出均为 `0`。
- [x] 主题版本更新为 `0.1.3`，保留回归截图：`assets/sforge-eva/protyle-attr-border-fixed-1280x720.png`。

### 2026-07-16：浅色主题玻璃层重调

- [x] 浅色运行时复核发现原有 `rgb(247 251 251 / .6)`、`rgb(241 247 247 / .7)` 等近白基底叠加后视觉上接近实色，网格和层次被抹平。
- [x] 将浅色内容、编辑区、表面、页签、工具栏和 Dock 轨道改为冷白/蓝灰基底的相对 `color-mix`，降低面层 alpha；强调青色只保留在边界线和交互状态。
- [x] 浅色运行时确认主编辑区可见网格，工具栏 alpha 为 `0.72`、Dock 轨道 alpha 为 `0.78`，布局无横向/纵向溢出。
- [x] 浅色主题版本更新为 `0.1.5`，同步深色主题元数据版本，保留回归截图：`assets/sforge-eva/main-light-glass-balanced-1280x720.png`。

### 2026-07-16：浅色主题 SCIFI 玻璃材质重构

- [x] 放弃继续调整单个浅青色面层，改为统一的三层材质系统：底层技术网格和限界线、中层冷白/蓝灰半透明玻璃、上层青色导轨与少量琥珀状态角线。
- [x] 参考 Asri 的 vibrancy 表面分层、QYL 的菜单与布局边界约束，以及 MAGI 的控制台导轨语言；只吸收成熟主题的结构方法，不复制品牌样式或会改变浮层定位的实现。
- [x] 新增 `--sforge-glass-*`、`--sforge-console-edge-*` 相对颜色 token，并将主布局、页签、Dock、顶部/底部铬层、Protyle、菜单、设置 Dialog、输入框和 Agent 浮层统一映射到同一材质体系。
- [x] Protyle 改为单一主玻璃承载层，`.protyle-content/.protyle-background/.protyle-title` 保持透明；面包屑独立使用高强度玻璃铬层，避免多层半透明叠加后重新变成实色。
- [x] 主布局圆角收紧至 `5px`，活动页签和 Dock 活动按钮增加盒内导轨、冷白高光与小范围阴影；布局边界继续使用盒内阴影和伪元素，不增加真实外边框。
- [x] 布局祖先继续禁止 `transform`、`filter`、`backdrop-filter`、`contain` 和裁剪；后续仅在确认无 fixed 后代的 Dialog 容器上使用真实背景模糊，菜单宿主仍保持无滤镜，雾化由无后代伪元素承载，避免改变子菜单定位上下文。
- [x] 浅色/深色主题元数据同步提升至 `0.2.0`，用于刷新主题资源缓存。

### 2026-07-16：双主题霓虹动效、网格与角标收敛

- [x] 深色交互改为青色主光、橙色警戒外溢和少量紫色余辉；活动 Dock、页签、按钮、Agent 建议项、开关和消息卡片使用扫描/呼吸动效，并继续由 `prefers-reduced-motion` 提供静态替代。
- [x] 浅色区域底色降低饱和度，青/橙/紫只承担导轨、焦点和状态标识；背景基础网格和主布局、Protyle、Agent 局部双向网格分别增强，避免只在 `body` 上绘制后被玻璃面板遮没。
- [x] 所有主布局面板角标统一收敛为 `14px × 14px` 的纯 `L` 形，只保留一条短水平线和一条短垂直线；删除斜切段、续接短横线和右 Dock 特例。右 Dock 角标右缘与标题左缘实测保留 `2px` 间隔。
- [x] 修复消息提示卡片在深色主题下使用 `--b3-theme-on-primary` 导致深字叠深底的问题；消息卡片现在显式使用主题前景色、可读玻璃背景、青色普通状态边界和橙红错误状态边界。
- [x] AI 输入区聚焦态不再复用全局强焦点阴影和大范围霓虹脉冲；改为独立的小范围呼吸脉冲，外层保留窄青边、约 `8px` 青色余辉和极弱橙色环境光，内部 ProseMirror 的重复 `:focus-visible` 阴影显式清除。
- [x] 主题资源版本同步提升至 `0.3.5`，并通过 `/api/ui/reloadTheme` 刷新运行时主题元数据；浏览器确认浅色/深色链接均使用新版资源。
- [x] 运行时回归：`.layout__center/.layout__dockl/.layout__dockr` 仍无真实边框、`transform`、`filter`、`backdrop-filter` 或 `contain`；`#commonMenu` 仍挂在 `body` 下并保持 `position: fixed`；`#layouts.scrollWidth === clientWidth` 且 `scrollHeight === clientHeight`。
- [x] 验证通过：`pnpm run typecheck:protyle-contract`、`git diff --check`、主题 JSON 解析。
- [x] 新增截图：`assets/sforge-eva/main-light-neon-grid-1280x720.png`、`assets/sforge-eva/main-dark-neon-grid-1280x720.png`、`assets/sforge-eva/main-dark-simple-corners-1280x720.png`、`assets/sforge-eva/main-dark-agent-input-focus-1280x720.png`、`assets/sforge-eva/main-dark-agent-input-focus-pulse-1280x720.png`。

## 9. 已归档/已完成

- 暂无。
