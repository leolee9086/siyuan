# 文件属性 Dock (TikTocTak)

> **归属**: [文件浏览Dock与Monaco编辑器.ttt.md](../文件浏览Dock与Monaco编辑器.ttt.md)
> **目标**: 以 SACAssetsManager 完整历史中最终可工作的素材信息面板行为为基线，为 S-Forge 文件树建立共享多选、批量属性读取、元数据编辑和独立 Dock；工作空间及 Agent 绑定根使用同一 `rootID + relative path` 地址契约。

## 参考证据

| 行为 | 最终源码证据 | 最终语义 | 参考实现缺陷 |
| --- | --- | --- | --- |
| Dock 注册 | `94c8534a:src/shared/config/panelConfig.js` | `AssetsPanel`、`iconInfo`、`LeftBottom`，独立 Vue Dock | 无共享类型契约 |
| 选择聚合 | `94c8534a:source/UI/pannels/assetInfoPanel/assetInfoPanel.vue` | 消费全局 `选中的资源`；去重且路径集合不变时不重复查询 | 只比较路径，不处理请求乱序 |
| 图片轮播 | `94c8534a:source/UI/components/assetInfoPanel/assetsImage.vue`、`source/UI/components/refactor.js` | 多选轮播、滚轮/按钮切换、缩略图多源回退、名称聚合 | 把资产数组额外嵌套后拼接，存在无效首项 |
| 名称/格式/目录 | `94c8534a:src/toolBox/feature/forAssets/forAssetInfo.js` | 至多 3 个名称直接列出，否则“首项等 N 个文件”；格式相同时显示扩展名，否则“多种”；目录去重聚合 | 通过前端拼绝对路径，不适用于授权根 |
| 所在笔记 | `94c8534a:src/toolBox/useAge/forSiyuan/fromSiyuanData/fromSiyuanData.js` | 按素材路径查询引用该素材的笔记根块 | 只显示逗号分隔 ID |
| Eagle 元数据 | `94c8534a:src/toolBox/feature/forEagleFs/fromEagleFs.js` | 检测相邻 `metadata.json` 并提供批量导入入口 | 面板调用的 `importEagleMetas` 没有有效定义 |
| 标签 | `94c8534a:source/UI/components/assetInfoPanel/tags.vue`、`source/data/tags.js` | 聚合计数/逐文件两种视图；按标签打开结果；逐文件移除；批量编辑入口 | 新增标签入口未完成；聚合 chip 未连接打开动作 |
| 目录动作 | `94c8534a:source/UI/pannels/assetInfoPanel/assetinfoPanel.js` | 双击系统打开；右键以单/多目录素材页签打开 | 依赖 Electron 绝对路径和插件页签协议 |

## 冻结契约

### 选择端口

- 选择身份固定为 `{ rootID, path, kind, revision? }`，`path` 永远是根内 `/` 分隔相对路径；前端不提交绝对路径。
- 文件树、后续画廊/瀑布流和属性 Dock 共用一个应用级选择端口；Dock 销毁不清空其它表面建立的选择。
- 普通点击替换选择；`Ctrl/Cmd` 点击切换单项；`Shift` 点击按当前可见树顺序扩展范围；焦点与选择分离。
- 目录和文件均可选择；重复身份去重并保留选择顺序，主选择为最后一次显式选中的项目。
- 根刷新后移除已经不存在或失去授权的选择；异步属性响应带选择 revision，过期响应不得覆盖新选择。

### 后端属性端口

- 批量请求只接受最多 100 个 `{rootID, path}`，每项独立返回成功或稳定错误，不因一个失效项丢弃其它结果。
- 文件和目录都返回名称、相对路径、根显示信息、类型、扩展名、大小、修改时间、创建时间（平台可得时）、只读能力、链接/受限状态和 revision。
- 图片额外返回媒体类型、宽高、内容 URL 和调色板；普通文件不触发完整内容读取。
- 元数据身份为稳定根身份与规范相对路径的组合；主数据持久化在工作空间数据目录，Agent 只读根不写入外部目录。
- 写请求按 root capability 再校验：元数据写入不等同于文件写入；外部只读根允许保存 S-Forge 私有标签/注释/星级，但不允许改名、移动或写文件内容。
- 所有读取在同一次路径授权解析后完成；符号链接越界、根失效、文件消失和类型变化以逐项错误返回。

### 界面行为

- 无选择、单选、多选、目录、图片、普通文件、混合选择分别有真实状态，不使用固定星级、尺寸、大小或日期。
- 单选图片显示可检查的真实预览；多选图片可轮播，按钮和滚轮都不能越界；非图片项显示文件类型图标。
- 名称、格式、所在目录、总大小、尺寸、日期按当前选择实时聚合；混合值明确显示“多种”或范围。
- 标签提供聚合计数与逐文件视图、添加/移除/批量编辑；星级和注释真实持久化。来源、块绑定和 Eagle 导入只在后端契约具备后显示可执行入口。
- “系统打开目录”和“打开目录素材页签”通过宿主端口执行；属性 Dock 不接触操作系统绝对路径拼接。

## S-Forge 复用与缺口

- 复用 `kernel/filebrowser.Service` 的根聚合、授权解析、Stat/content URL/revision 和本地设备门禁。
- 复用 `kernel/assetmeta` 的 JSON 主数据、SQLite 标签/调色板索引和 palette 提取；不建立第二套标签数据库。
- 复用 `Custom`、`createVueComponentLoader`、现有 Dock 恢复/按钮/守卫/类型注册链。
- 当前代码事实：文件树与属性 Dock 已共用应用级多选端口；批量文件/目录属性、跨根元数据身份、完整索引字段和标签/RGB/HSL 查询已经落入工作区；两个 Dock 的声明、默认布局、类型守卫和模型工厂也已接线。
- 当前验证缺口：旧布局缺项恢复、跨列去重、默认列位置和两个 Vue 实例的独立销毁还缺少同一条恢复链上的聚焦测试；真实桌面布局恢复仍未验收。
- 当前功能缺口：属性面板已有聚合/逐文件标签、批量添加/逐文件移除、配置颜色与稳定回退色、星级、注释和图片轮播；仍未实现标签结果打开、标签树、颜色检索、目录动作、所在笔记/来源入口以及外部根图片调色板提取。

## 实施清单

- [x] 读取最终属性面板、图片轮播、标签数据和 Dock 注册调用链，记录参考缺陷。
- [x] 冻结共享选择、批量属性、外部根元数据、权限和请求竞态契约。
- [x] 为文件浏览器实现应用级共享多选状态，并接入树的普通/Ctrl/Shift 选择。
- [x] 实现批量文件/目录属性 API 和逐项错误包络。
- [x] 修正 `assetmeta` 主数据与索引字段差异，建立 `rootID + path` 稳定身份与迁移规则。
- [x] 注册 `sforge-file-properties` Dock，并由共享声明接入默认布局、类型守卫和模型工厂；此勾选只表示源码接线完成。
- [x] 通过生产 `initDockData` 聚焦测试验证浏览器/属性 Dock 的旧布局恢复、默认列位置、同位置跨列去重和跨位置去重；两个 Vue 实例的独立销毁也已由确定性测试覆盖。桌面持久化重启仍单列为交互验收。
- [x] 完成属性 Dock 的无选择、单选、多选、混合类型基础界面以及真实属性聚合；此勾选不包含桌面交互验收。
- [ ] 完成标签结果打开、标签树、颜色检索、目录动作和所在笔记/来源入口；聚合/逐文件标签、批量添加/移除、配置颜色、星级、注释和图片轮播已有源码及控制器测试基础。
- [ ] 覆盖权限、越界链接、文件消失、请求乱序和批量部分失败测试。
- [ ] 运行聚焦 Go、Vitest、前端逻辑检查与桌面交互验收。

## 当前实现证据

- `kernel/filebrowser/properties.go`：同一次根快照、最多 100 项、有界并发、输入顺序稳定、目录/文件/图片头属性和逐项稳定错误；根越界链接继续由统一授权解析拒绝。
- `kernel/fileproperties/service.go`：只组合 `filebrowser` 物理快照与 `assetmeta` 工作空间主数据；只读 Agent 根允许私有元数据写入，但不获得真实文件写权限；补丁支持 revision 前置条件和部分成功。
- `kernel/assetmeta/model.go`：旧 `data/assets/...` 地址保留既有 JSON 位置；其它根以 `{rootID, path}` 哈希键写入工作空间存储，同相对路径跨根不碰撞。
- `kernel/assetmeta/index.go`：临时 SQLite 索引升级为 `asset_key + root_id + path`，完整返回 annotation/boundBlockID/sourceID/tags/palettes；新增标签任意/全部匹配、RGB 容差、HSL 范围与环形 Hue 查询。旧临时表直接由 JSON 主数据重建，不保留双结构分支。
- `app/src/sforge/fileBrowser/FileBrowser.selection.ts`：应用级选择端口已接入递归树，普通点击替换、Ctrl/Cmd 切换、Shift 按当前可见顺序扩展；根刷新只剔除失效根，Dock 销毁不清空共享选择。
- `app/src/sforge/fileBrowser/FileBrowser.docks.ts`：文件浏览器与属性 Dock 共用纯声明定义，默认位置、列、图标、标题和尺寸由默认布局与恢复链共同消费；属性 Dock 注册仍在复验中。
- 聚焦验证：`go test ./assetmeta ./filebrowser ./fileproperties ./api -run 'Test(Index|Advanced|Manager|BatchProperties|Properties|Inspect|Update|FileBrowser)' -count=1` 通过。该证据只覆盖当前后端切片；外部根调色板提取、前端共享多选、属性 Dock 和桌面交互仍未完成。
- 前端聚焦验证（2026-08-07，本轮复跑）：`pnpm exec vitest --run test/sforge/fileBrowser` 为 11 个测试文件、28 个用例通过。旧摘要中的 25 个用例复跑时实际有 2 个动态导入超时/串扰失败，本轮改为静态生产入口并为两个实例分配独立卸载句柄后稳定通过。
- 严格类型检查（2026-08-07）：第一次 `pnpm run typecheck` 退出码为 2，全库共有 11683 条 TypeScript 诊断，目标筛选有 11 条；修正 Dock 空宿主边界和测试夹具后最终全库诊断为 11672 条，目标筛选为 0。全库退出码仍为 2，该结果只证明目标路径没有严格类型诊断。
- 恢复契约修正：旧布局恢复此前固定生成 `{width: 0, height: 0}` 且 `hotkeyLangId` 使用标题，与默认声明不一致；现由通用声明恢复函数复制完整尺寸、显示状态和快捷键字段，测试要求恢复对象与默认布局对象完全相等且尺寸对象不共享引用。

## 当前切片：Dock 恢复与生命周期

- [x] 以旧布局中完全缺失两个新类型为输入，调用生产 `initDockData`，验证浏览器恢复到左上列、属性恢复到左下列，且生成按钮可被生产类型守卫接受。
- [x] 以同列和跨列重复类型为输入，验证每种 Dock 类型最终最多保留一个，不依赖只检查渲染字符串的替身测试。
- [x] 分别初始化并销毁两个 `Custom` model，验证各自只卸载自己的 Vue 应用，销毁一个不会影响另一个。
- [x] 聚焦测试已回写为 11 个文件、28 个用例；桌面拖拽、持久化后重启与截图继续作为独立验收项。

## 下一切片：逐文件标签与标签颜色

- [x] 沿 `source/UI/components/assetInfoPanel/tags.vue`、`source/UI/components/tags/*` 和 `source/data/tags.js` 检查最终提交与历史峰值实现，记录聚合/逐文件切换、颜色来源、编辑和打开结果语义。
- [x] 冻结标签展示模型与颜色模型，使属性 Dock 只消费声明式标签状态，不直接拼接索引查询或持久化请求。
- [ ] 实现聚合与逐文件两种视图、逐项删除、批量添加以及可复用颜色呈现；缺少颜色的标签使用确定性回退而不是随机值。
- [ ] 补控制器和组件交互测试，验证混合选择、部分失败、请求乱序和颜色稳定性；完成后回写证据。

#### 历史审计记录（2026-08-07）

| 峰值提交 | 直接源码 | 已确认行为 | 需要修正的缺陷 |
| --- | --- | --- | --- |
| `0c2781bd` | `source/UI/components/assetInfoPanel/tags.vue`、`source/data/tags.js` | 首次同时展示按文件标签和聚合计数；按选中素材路径逐项读取标签 | 新增入口只是日志；未建立稳定刷新竞态边界 |
| `4d46523b` | 同上 | 每个文件标签可打开资源结果、逐项移除；有单文件/批量标签编辑入口 | 编辑器只打开选择器并记录日志，未完成写回；依赖绝对路径 |
| `f02deacf` | 同上 | 批量入口名称和调用点修正；移除逻辑继续按文件路径执行 | 历史中仍遗留旧函数模板调用，说明调用链没有契约校验 |
| `834b596d` | `source/UI/components/common/assetCard/tagsCell.vue`、`source/data/tags.js` | 笔记卡片也显示标签；标签可打开资源结果；笔记标签来自块查询 | 标签树/资源标签仍是另一套数据来源，未统一根身份 |
| `970f1a65` | `source/UI/components/common/assetCard/tagsCell.vue` | 标签 chip 视觉样式抽成可复用单元，颜色来自主题变量 | 没有每个标签的持久化颜色或颜色检索语义，参考项目并未提供该能力 |
| `94c8534a` | `source/UI/components/tags/tagItem.vue`、`tagTree.vue`、`source/data/tags.js` | 标签树支持打开资源、Ctrl 点击打开笔记搜索、拖放资源、更新/删除；数据按标签合并并标记已移除 | 资产路径数组仍是旧主数据；异步刷新没有 revision 抑制；聚合 chip 的打开事件缺失 |

冻结结论：参考项目最终版本没有独立的持久化标签颜色模型。S-Forge 保留 `assetmeta.TagInfo.Color` 作为可扩展增强，但颜色定义必须由 `assetmeta` 的定义服务/API 校验、原子保存并返回稳定 revision；属性 Dock 只消费 `TagPresentation`，不直接读写 JSON/SQLite。未配置颜色时使用基于规范化标签名的确定性 HSL 回退，并根据对比度选择前景色。

#### 冻结模型

- 后端 `TagDefinitionsSnapshot` 固定为 `{revision, items: [{name, color}]}`，`items` 按标签名稳定排序；写入使用完整快照与期望 revision，冲突返回稳定错误，不以最后写入静默覆盖并发修改。
- 标签身份按去除首尾空白后的 Unicode 小写名称比较，保留首个有效显示名称；空名称、控制字符、重复名称和非 `#RRGGBB` 颜色在服务边界拒绝，空颜色表示未配置。
- 前端 `TagPresentation` 固定包含 `{name, count, color, foreground, configured}`；聚合视图按文件去重计数，逐文件视图保留稳定 `{rootID, path}` 请求，所有删除/添加仍走属性批量更新端口。
- 配置颜色由标签定义快照提供；回退颜色只由规范化标签名计算，不写回持久层。标签结果打开、标签树和颜色检索只消费同一名称/颜色模型，各自保留独立查询与导航端口。

#### 当前推进

- 控制器/组件 P0 拆分由 [`属性Dock标签切片.shorterm.ttt.md`](属性Dock标签切片.shorterm.ttt.md) 跟踪，完成后回写并将短期文档移动到 `docs/ttt/archive/`。
- [x] `kernel/assetmeta/tags.go` 已实现标签定义快照、严格边界校验、稳定 revision、过期 revision 冲突和完整快照原子替换。
- [x] `go test ./assetmeta -run 'TestTagDefinitions|TestManagerUsesBoundStoreForAssetAndTagLifecycle' -count=1` 通过，覆盖等价输入 revision、大小写重复、非法颜色、持久化与重载。
- [x] 接入 `/api/s-forge/file-browser/tag-definitions` 和 `/set`；`go test ./api -run 'TestFileBrowser(TagDefinitions|Roots|Walk|Stat)' -count=1` 通过，覆盖本机门禁、完整快照解码和 400/409/503 映射。
- [x] 接入前端仓储、展示模型、逐文件界面和组件交互验证；`pnpm exec vitest --run test/sforge/fileBrowser` 为 13 个文件、33 个用例通过，目标严格类型诊断为 0，新增/修改文件 P0 lint 为 0。

## 2026-08-10 标签结果导航切片（已完成本轮逻辑）

- [x] 属性 Dock 的聚合标签和逐文件标签均提供真实“打开标签”动作，不再只有展示文本；动作通过 `openTagResults` 宿主端口发出。
- [x] 标签树与属性 Dock 共用 `FileBrowserTagNavigation.ts`，统一创建 `sforge-file-gallery` 全根标签查询页签，使用 `rootID: global` 和 `allRoots: true`，不再复制 `workspace` 根假设。
- [x] 保留现有 `assetmeta` 标签索引、定义快照和元数据批量写入策略，导航只消费标签名称，不直接读写后端存储。
- [x] 证据：`FileTagTreeDock.interaction.test.ts`、`FilePropertiesPanel.interaction.test.ts`（2 个文件、4 个用例）；`pnpm exec vitest run --config vitest.config.ts test/sforge/fileBrowser --reporter=dot`（31 个文件、110 个用例）；`git diff --check` 通过。
- [ ] 标签颜色检索、来源/所在笔记入口、目录动作和桌面 Dock 现场验收仍未完成；本切片不扩大为属性 Dock 全量完成结论。

## 完成条件

- [ ] SACAssetsManager 属性面板所有真实可工作行为都有 S-Forge 等价实现和证据；参考缺陷被修复而非复制。
- [ ] 工作空间与 Agent 根的文件/目录均可显示真实属性，元数据不会写入外部根。
- [ ] 两个 Dock 独立销毁/恢复后仍共享正确选择，乱序响应不会回退界面。
- [ ] 当前子任务结论回写父 TTT 后将本短期文档移动到 `docs/ttt/archive/`，保留审计轨迹。
