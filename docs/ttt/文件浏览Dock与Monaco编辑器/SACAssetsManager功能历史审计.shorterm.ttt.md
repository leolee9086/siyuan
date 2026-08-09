# SACAssetsManager 功能历史审计 (TikTocTak)

> **归属**: [文件浏览Dock与Monaco编辑器.ttt.md](../文件浏览Dock与Monaco编辑器.ttt.md)
> **目标**: 基于完整参考检出 `D:\dev\SACAssetsManager-02e3b4d47aa4414bd397a94d7daa1747a3cb45e6` 的 951 个提交和 `master` 当前 `94c8534` 语义，找出文件浏览器每类功能的最完备实现、证据提交、数据流和 S-Forge 接入点。该检出当前为 detached `02e3b4d4`，历史对象和 `master` 仍在同一工作树中。

## 审计规则

- 先按功能关键词定位历史提交，再读取最终相关文件和调用链；“提交存在”不等于功能可用。
- 同一功能以最后一个通过运行时/测试证据且没有被后续回退的实现为准；迁移提交只作为路径变更证据。
- 记录 SAC 的行为语义，不直接复制其 Node/Express/插件运行时实现。

## 覆盖矩阵

| 功能域 | 已发现的最完备历史线索 | S-Forge 当前复用点 | 状态 |
| --- | --- | --- | --- |
| 本地磁盘根与目录树 | `070a0157`、`eb19e6fb`、`2a449b7f`、`1d25cbc7` | `WorkspaceDir`、任务 capability、B3 树视觉原语 | 已完成树专项审计，待实现 |
| 本地任意根、子目录画廊和面包屑 | `321b90b3`、`39cf7be9`、`9c015c13`、`d6acc882` | 文件根契约、后续画廊查询状态 | 待读取最终代码 |
| 后端流式遍历、取消和大目录性能 | `16431502`、`fe61c2bb`、`3470f56f`、`eb19e6fb`、`4d1aa8b7` | Go `filelock.Walk`、API SSE/事件、现有 watcher | 待建立等价契约 |
| 缩略图/格式加载器 | `93e25dfd`、`0d9adee8`、`d704d758`、`74ccc2e4`、`fe57a8c7` | `thumbnail` provider、asset API、assetmeta 尺寸 | 待逐项映射 |
| 标签树、编辑、面包屑 | `5f986631`、`a78241fc`、`d80a0e17`、`f02deacf`、`4d46523b`、`834b596d` | `assetmeta` tags、思源 Tag Dock、Vue 标签组件 | 待读取最终代码 |
| 颜色索引、缓存、相似度搜索 | `2dac4129`、`a50e9077`、`fb60f9ed`、`48765f94`、`0feab962` | `assetmeta` palettes/HSL/SQLite | 待补齐请求字段与算法证据 |
| 瀑布流/表格/列表/排序 | `1185f401`、`b92d0741`、`cda0db5b`、`1f2861af`、`8a6bac3a` | `AssetMasonryDialog`、布局虚拟化 | 待确认最终组件 |
| 选择、键盘、拖放和批处理菜单 | `c2051019`、`58dd46e4`、`7116336c`、`74d63f9e`、`3ebca79a` | Siyuan Menu、文件树 DnD、Agent 上传 | 待逐项映射 |
| 打开/复制/移动/删除/重命名/打包 | `d1295a05`、`2c1722e9`、`8324ad50`、`ed1cb03b`、`2beecabd` | 文件 API、页签、系统打开入口、filelock | 待建立受控操作 API |
| 音视频/PDF/代码/D5A/EFU | `b669b241`、`2abd36dd`、`2beecabd`、`127a1dba`、`d3e5b35d` | 既有 preview/open 入口、D5A 相关能力 | 待读取最终加载器 |
| Everything/AnyTXT/扩展名过滤 | `4929432d`、`c3cbbfe3`、`788fc016`、`ce2024ff`、`709da276` | Go 搜索/SQLite；外部索引需明确可选边界 | 待决定本地等价实现 |
| 文件监听、数据库、缓存 | `52074303`、`1ae1550d`、`e5cc389e`、`7c1877ad`、`c039687d` | Forge watcher、SQLite、索引队列 | 待建立迁移方案 |
| 文件属性 Dock | `722c92c1`、`f02deacf`、`2abd36dd`、`acb5d770`、`94c8534a` | `filebrowser` Stat/root、`assetmeta` 主数据与索引、Custom Dock | 已完成最终调用链审计并冻结 S-Forge 契约，见 `文件属性Dock.shorterm.ttt.md` |

## 证据记录

- 当前参考目录为 `D:\dev\SACAssetsManager-02e3b4d47aa4414bd397a94d7daa1747a3cb45e6`，detached `HEAD=02e3b4d4`；`master/origin/master=94c8534a`，共 951 个历史提交。工作树删除状态不影响 `git show` 读取对象。
- 主检出 `D:\dev\SACAssetsManager` 只保留一个迁移后的提交，不能作为历史完整性证据。

### 本地磁盘目录树专项结论

- 最终组合入口为 `source/UI/components/collectionPanel.vue`，依次挂载收藏、标签树、本地磁盘树和本地 API；本地磁盘树不是素材结果卡片。
- `source/UI/components/fileSystem/diskInfosTiny.vue` 在 `94c8534a` 中负责磁盘常驻根、容量信息、刷新、面板折叠和扁平化展开状态；单击磁盘或目录调用 `toggleSUbFolders`，首次展开请求 `/count-etries`，再次单击移除该路径全部后代，双击通过 `click-galleryLocalFIleicon` 打开本地素材画廊。
- `source/UI/components/fileSystem/FolderList.vue` 负责目录行、文件数/目录数、祖先选择高亮、辅助线和单击/双击 300ms 多击分流；右键调用已有文件夹菜单。`DiskItem.vue` 负责卷标、总量、可用量和占用百分比。
- `/count-etries` 的最终调用链是 `source/server/apiService.js` 到 `source/server/handlers/entry-counter.js`。处理器先列出直接子目录，再对每个子目录统计一层文件数和目录数，返回 `name/fileCount/folderCount/show`；`maxCount` 在最终响应切片，目录树请求显式传 100。
- `070a0157` 首次建立本地文档树；`eb19e6fb` 增加收起后代、祖先状态、计数、辅助线以及大目录 100 项上限，并改用多击分流；`2a449b7f` 把树拆为 `diskInfosTiny.vue`、`FolderList.vue`、`DiskItem.vue`；`1d25cbc7` 只修正迁移后的显示/导入。`2a449b7f..94c8534a` 的树业务差异只有多击工具与图标组件迁移，最终行为仍以上述三组件为准。
- `054ec71b` 将目录统计从 `fast-glob` 改为带缓存的 `fdir` 一层遍历；后续版本仍对所有直接子目录使用 `Promise.all`。S-Forge 等价实现应保留一层计数和分页上限，同时采用有界并发，避免把参考实现的无界并发缺陷一并移植。
- `source/UI/components/common/breadCrumb/localbreadCrumb.vue` 是画廊侧配套界面而非 Dock 树：它展示路径面包屑、直接子目录缩略条、文件/目录数量、每个子目录的包含开关，以及“显示子路径”开关生成的局部 glob 查询。该行为属于后续画廊切片，不能用目录树完成度代替。

### 文件属性 Dock 专项结论

- 最终 Dock 注册证据为 `94c8534a:src/shared/config/panelConfig.js`：`AssetsPanel` 使用 `iconInfo`、`LeftBottom` 和独立 Vue 组件入口。最终面板消费全局 `选中的资源`，不是面板本地临时选择。
- `assetInfoPanel.vue` 与 `forAssetInfo.js` 负责选择去重、名称/格式/目录聚合、所在笔记查询、Eagle `metadata.json` 检测、系统打开目录和多目录素材页签；`assetsImage.vue` 负责按钮/滚轮轮播和缩略图多源回退；`tags.vue` 与 `source/data/tags.js` 负责标签聚合/逐文件视图、移除、标签结果和批量编辑入口。
- 参考实现本身仍有明确残缺：注释与来源没有持久化，星级固定为五颗星，尺寸/大小/日期没有随选择更新，导出只写日志，`importEagleMetas` 缺少有效定义，标签新增入口部分断链。S-Forge 的完成标准是保留真实业务语义并补齐这些缺陷，不以逐文件复制组件为验收。
- S-Forge 目标选择地址固定为 `rootID + relative path`，批量属性 API 逐项返回，外部只读 Agent 根的私有元数据集中写入工作空间数据目录；详细契约和实施状态见 `文件属性Dock.shorterm.ttt.md`。

## 完成条件

- [ ] 每一行功能域都有最终源码文件、调用入口和 S-Forge 目标契约。
- [ ] 被判定为“最完备”的实现经过至少一个行为测试或可复现运行路径确认。
- [ ] 关键结论回写父 TTT 后将本短期文档移动到 `docs/ttt/archive/`，保留审计轨迹。
