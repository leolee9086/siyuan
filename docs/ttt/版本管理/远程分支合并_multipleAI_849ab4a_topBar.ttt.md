# multipleAI 合并远程分支执行跟踪

目标：在 `multipleAI` 分支上完成 `leolee9086/multipleAI` 的合并，当前 `MERGE_HEAD=849ab4aff31fa1e3eba2cb1e77600fd389bf4ea0`，`merge-base=2fcc6eeed5f3d583b2665080e69279dbfddb2f80`。

## 强制流程

1. 每次只处理一个冲突文件。
2. 处理单个文件前，先列出该文件上游自 merge-base 以来的 commit。
3. 对上游 commit 和 `.remote`/`.backup` 差异逐项判断：已存在于本地、需要移植、或需要在本地重构后的子模块中承接。
4. 修改后只验证当前文件及其承接子模块，不批量处理其他文件。
5. 当前文件验证通过后，记录处置结果，再 `git add` 当前文件和本记录。
6. 所有冲突完成并验证通过后，统一清理 `.backup`/`.remote` 临时文件。
7. 本地不使用 `/// #if` 条件编译；上游条件编译变更只提取语义，落地时使用运行时判断或现有平台封装。

## 当前状态

- [x] 已读取 `docs/规程/版本管理/参考源码拉取.procedure.md`
- [x] 已读取 `docs/规程/版本管理/远程分支合并.procedure.md`
- [x] 已确认 `toread/` 被 `.gitignore` 忽略
- [x] 已为冲突文件生成同目录 `.backup` 和 `.remote` 参照文件
- [x] 已处理 `app/src/block/popover.ts`

## 单文件处理记录

### app/src/block/popover.ts

状态：已处理，等待全局验证。

上游 commit：

1. `fbe6b7569`：调整鼠标仍在 `#tooltip` 上时的隐藏策略，避免 `showTooltip` 与 `hideTooltip` 循环闪烁。
2. `1fa30d480`：为 Tab tooltip 相关导入和逻辑增加 `/// #if !MOBILE` 条件编译。
3. `df69dd1ef`：引入 `tooltipTargetElement`，鼠标在 tooltip 上但离开触发元素时正常隐藏。
4. `07be79c11`：将 `getIdFromSYProtocol` 替换为 `parseSiYuanUriInfo(... )?.id ?? ""`。

处置结果：

- 保留本地 `popover.ts` 拆分架构，未恢复上游单文件实现。
- `df69dd1ef` 已移植到 `app/src/block/popover.ts` 的 `处理非Tooltip元素`，通过 `tooltipTargetElement.contains(target)` 判断鼠标是否仍在触发元素范围内。
- `df69dd1ef` 的依赖转发已补到 `app/src/block/imports.ts`。
- `07be79c11` 已移植到 `app/src/block/popover/refDefs.ts`，并在 `app/src/block/popover/imports.ts` 改为转发 `parseSiYuanUriInfo`。
- `1fa30d480` 的 Tab tooltip 逻辑已由本地拆分后的 `app/src/block/popover/tooltip.ts::handleTabTooltip` 承接；不引入 `/// #if`，如需区分平台必须使用运行时判断或现有平台封装。
- `dialog/tooltip.ts` 仍是独立冲突文件；后续处理该文件时必须保留 `tooltipTargetElement` 的导出与 `showTooltip`/`hideTooltip` 中的赋值/清空。

验证：

- `app/src/block/popover.ts`、`app/src/block/popover/imports.ts`、`app/src/block/popover/refDefs.ts`、`app/src/block/imports.ts` 无冲突标记。
- `git diff --check -- app/src/block/popover.ts app/src/block/popover/imports.ts app/src/block/popover/refDefs.ts app/src/block/imports.ts` 通过。

### app/src/block/util.ts

状态：已处理，等待全局验证。

上游 commit：

1. `9bea5eda1`：取消超级块时提前清理 `sb__resize` 手柄，避免手柄作为无 `data-node-id` 的子节点参与 move；同时上游删除了 `getSbChildCount`，本地保留该函数，因为多个本地拆分模块仍依赖它统计真实块节点。
2. `189d5ae85`：将手柄清理提前到克隆超级块快照之前，并新增 `rebalanceSbWidth` / `refreshSbAndPersistWidth`，用于列布局超级块子块进出后重新均衡宽度并写入事务。
3. `d396fda66`：`insertEmptyBlock` 改为 async，列布局超级块中插入空块时通过 `turnsIntoOneTransaction({ getOperations: true })` 将自动合并并入同一个 transaction。

处置结果：

- 保留本地 `util.ts` + `util.cancelSB.ts` + `util.createNewBlockElement.ts` + `util.getInsertTargetBlock.ts` 的拆分架构。
- `9bea5eda1` / `189d5ae85` 的手柄清理已移植到 `app/src/block/util.cancelSB.ts`，在构建超级块快照前移除 `:scope > .sb__resize`。
- `189d5ae85` 的 `rebalanceSbWidth` / `refreshSbAndPersistWidth` 已移植到 `app/src/block/util.ts`，保留本地中文注释与显式类型。
- `d396fda66` 已移植到 `app/src/block/util.ts::insertEmptyBlock`，非列表插入场景中构造 `undoOperations` 后，将列布局超级块的相邻块合并操作通过 `getOperations: true` 并入同一个事务。
- 上游 `jumpToParent` 中的 `/// #if !MOBILE` 未引入；本地继续使用 `isMobile` 运行时判断。

验证：

- `app/src/block/util.ts`、`app/src/block/util.cancelSB.ts` 无冲突标记。
- `app/src/block/util.ts`、`app/src/block/util.cancelSB.ts` 无 `/// #if/#else/#endif` 条件编译。
- `git diff --check -- app/src/block/util.ts app/src/block/util.cancelSB.ts` 通过。

### app/src/boot/globalEvent/command/global.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，将 `editReadonly` 命令从 `setReadOnly(!window.siyuan.config.editor.readOnly)` 改为 `editorConfigApi.patch("editor.readOnly", !window.siyuan.config.editor.readOnly)`，并把导入从 `config/util/setReadOnly` 替换为 `config/tabs/editorRuntime`。

处置结果：

- 保留本地 `global.ts` + `global/*` 的 CaliburRouter 拆分架构，未恢复上游旧单文件大 switch。
- 上游文件中的 `/// #if MOBILE`、`/// #else`、`/// #if !BROWSER`、`/// #endif` 条件编译未引入；平台分流继续由 `isMobile` 运行时判断和桌面子模块封装承接。
- `1fa30d480` 的只读设置 API 变更已移植到 `app/src/boot/globalEvent/command/global/common.ts::executeEditReadonlyCommonGlobalCommand`，使用 `editorConfigApi.patch("editor.readOnly", !getSiyuanConfig().editor.readOnly)`，保留本地通过环境封装读取配置的方式。
- `app/src/boot/globalEvent/command/global/imports.ts` 已改为转发 `editorConfigApi`，并移除本命令域对 `setReadOnly` 的依赖。

验证：

- `app/src/boot/globalEvent/command/global.ts`、`app/src/boot/globalEvent/command/global/common.ts`、`app/src/boot/globalEvent/command/global/imports.ts` 无冲突标记。
- `app/src/boot/globalEvent/command/global.ts`、`app/src/boot/globalEvent/command/global/common.ts`、`app/src/boot/globalEvent/command/global/imports.ts` 无 `/// #if/#else/#endif` 条件编译。
- `rg -n "setReadOnly" app/src/boot/globalEvent/command/global app/src/boot/globalEvent/command/global.ts` 无命中；`editorConfigApi` 命中 `common.ts` 与 `imports.ts`。
- `git diff --check -- app/src/boot/globalEvent/command/global.ts app/src/boot/globalEvent/command/global/common.ts app/src/boot/globalEvent/command/global/imports.ts` 通过。

### app/src/boot/globalEvent/command/panel.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，删除命令面板在命令列表为空时插入空状态提示并聚焦该提示项的逻辑。
2. `448d569e6`：修复命令面板无法上下选中，在命令列表生成后重新给 `firstElementChild` 添加 `b3-list-item--focus`。

处置结果：

- 保留本地 `panel.ts` 的运行时平台判断实现，未引入上游历史中的 `/// #if MOBILE`、`/// #else`、`/// #if !BROWSER`、`/// #endif` 条件编译。
- `448d569e6` 的首项聚焦语义已由本地 `else { listElement.firstElementChild.classList.add("b3-list-item--focus"); }` 承接。
- 未采用远程最终版的裸 `listElement.firstElementChild.classList.add(...)`，因为本地保留的 `childElementCount === 0` 分支可在命令列表为空时显示提示并避免空指针。
- `1fa30d480` 删除空状态提示的变更未移植；判定为本地空列表保护更完整，且不影响上游后续焦点修复。

验证：

- `app/src/boot/globalEvent/command/panel.ts` 无冲突标记。
- `app/src/boot/globalEvent/command/panel.ts` 无 `/// #if/#else/#endif` 条件编译。
- `rg -n "firstElementChild|childElementCount|_kernel\\[122\\]" app/src/boot/globalEvent/command/panel.ts` 确认同时保留空列表保护与首项聚焦。
- `git diff --check -- app/src/boot/globalEvent/command/panel.ts` 通过。

### app/src/boot/onGetConfig.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，将启动后的外观应用逻辑从 `appearance.onSetAppearance(window.siyuan.config.appearance)` 改为 `appearanceConfigApi.apply(window.siyuan.config.appearance)`，并替换对应导入。
2. `129a9c2ac`：增强 SYLink / SiYuan URI 处理，将 `processSYLink` 调用和导入替换为 `processSiYuanUri`。

处置结果：

- 保留本地 `onGetConfig.ts` 中的运行时 `isElectron` 判断、`ipcSend`/`ipcInvoke`/`ipcOn` 封装、环境访问器和拆分后的 resize/emoji 处理函数，未恢复远程 `ipcRenderer` 直连写法。
- `1fa30d480` 已移植：导入 `appearanceConfigApi`，启动后调用 `appearanceConfigApi.apply(getSiyuanConfig().appearance)`，保留本地通过 `getSiyuanConfig()` 读取配置的方式。
- `129a9c2ac` 已移植：导入 `processSiYuanUri`，在 `Constants.SIYUAN_OPEN_URL` 的 `ipcOn` 监听回调中调用 `processSiYuanUri(app, url)`。
- 上游文件中的 `/// #if !BROWSER` 条件编译未引入；原生对话框覆盖继续通过 `if (isElectron) { initNativeDialogOverride(); }` 运行时判断实现。

验证：

- `app/src/boot/onGetConfig.ts` 无冲突标记。
- `app/src/boot/onGetConfig.ts` 无 `/// #if/#else/#endif` 条件编译。
- `rg -n "appearanceConfigApi|appearance\\.onSetAppearance|processSYLink|processSiYuanUri|ipcRenderer\\.on|ipcOn\\(Constants\\.SIYUAN_OPEN_URL" app/src/boot/onGetConfig.ts` 确认已切换到 `appearanceConfigApi` / `processSiYuanUri` / `ipcOn`，且无旧 `appearance.onSetAppearance` 与 `processSYLink` 调用。
- `git diff --check -- app/src/boot/onGetConfig.ts` 通过。

### app/src/config/assets.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，将 `app/src/config/image.ts` 重命名为 `app/src/config/assets.ts`，新增 `collectAssetsTabSearchStrings` / `mountAssetsTab` 以接入新设置面板搜索与挂载流程，并将内部对象名从 `image` 调整为 `assets`。

处置结果：

- 保留本地资源管理实现中的内部 Plugin 页签注册、独立未引用资源页签、独立缺失资源页签和本地路径/平台封装导入。
- 移植上游新增的 `collectAssetsTabSearchStrings`、`mountAssetsTab` 与 `switchSettingPanelSubTab` 接入逻辑。
- 文件主体采用上游 `assets` 对象命名，内部调用已从 `image.*` 改为 `assets.*`。
- 保留 `export const image = assets` 作为本地旧配置入口兼容层，避免后续处理 `config/index.ts` 前丢失本地调用契约。
- 删除当前文件未使用的 `openFile` 导入，并将内部资源页签 `_renderList` 第三个参数从布尔值修正为 `"unrefAssets"` / `"lostAssets"`，保持本文件类型契约一致。
- 上游重命名文件中的 `/// #if !MOBILE` / `/// #if !BROWSER` 条件编译未引入；本地继续使用 `isMobile()` 与 `isElectron` 运行时判断。

验证：

- `app/src/config/assets.ts` 无冲突标记。
- `app/src/config/assets.ts` 无 `/// #if/#else/#endif` 条件编译。
- `rg -n "export const image|collectAssetsTabSearchStrings|mountAssetsTab|switchSettingPanelSubTab" app/src/config/assets.ts` 确认新设置入口和旧兼容导出均存在。
- `rg -n "image\\." app/src/config/assets.ts` 无命中；`rg -n "openFile" app/src/config/assets.ts` 无命中。
- `git diff --check -- app/src/config/assets.ts` 通过。

### app/src/config/util/about.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，从 `app/src/config/util/about.ts` 移除 `setAccessAuthCode`，远程最终版仅保留 `getCloudURL` 与 `getIndexURL`。

处置结果：

- 保留本地 `setAccessAuthCode` 公共函数，因为旧桌面设置 `app/src/config/about.ts` 与移动端设置 `app/src/mobile/settings/about.ts` 当前仍在调用该函数，直接采用远程删除会破坏现有运行路径。
- `setAccessAuthCode` 保持本地拆分后的导入路径：`Dialog`、`Constants`、`fetchPost`、`isMobile` 均使用本地封装模块。
- 为避免新设置页和旧设置页授权码弹窗行为分叉，`app/src/config/tabs/accessTab.ts` 的 `mountAuthCodeButton` 已改为调用 `setAccessAuthCode()`，不再复制弹窗实现。
- 上游新设置 UI 中的 Electron 条件编译未引入；`openLocalServer` 继续用 `isElectron` 运行时判断和 `openExternal` 封装实现。

验证：

- `app/src/config/util/about.ts`、`app/src/config/tabs/accessTab.ts` 无冲突标记。
- `app/src/config/util/about.ts`、`app/src/config/tabs/accessTab.ts` 无 `/// #if/#else/#endif` 条件编译。
- `app/src/config/util/about.ts`、`app/src/config/tabs/accessTab.ts` 无 `from "electron"` / `ipcRenderer` 直连导入。
- `rg -n "setAccessAuthCode" app/src --glob "!app/src/config/util/about.ts"` 确认旧桌面设置、移动端设置与新设置页都指向同一公共函数。
- `git diff --check -- app/src/config/util/about.ts app/src/config/tabs/accessTab.ts` 通过。

### app/src/dialog/processSystem.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，将 `getDockByType` / `Files` 导入纳入 `/// #if !MOBILE` 条件编译块，让移动端构建不包含桌面文件树停靠栏依赖。

处置结果：

- 保留本地运行时平台判断骨架，不引入上游 `/// #if !MOBILE`、`/// #if MOBILE`、`/// #if !BROWSER` 条件编译。
- 上游避免移动端访问桌面文件树依赖的语义已由本地 `const liElement = isMobile() ? window.siyuan.mobile.docks.file.element... : (getDockByType("file").data.file as Files).element...` 承接。
- 保留本地 `isElectron` + `ipcSend` 封装，未恢复远程 `ipcRenderer` 直连。
- `lockScreen`、`exitSiYuan`、`transactionError`、`processSync` 中原上游条件编译分支继续使用运行时判断实现。

验证：

- `app/src/dialog/processSystem.ts` 无冲突标记。
- `app/src/dialog/processSystem.ts` 无 `/// #if/#else/#endif` 条件编译。
- `app/src/dialog/processSystem.ts` 无 `from "electron"` / `ipcRenderer` 直连导入。
- `rg -n "getDockByType|Files|isMobile\\(\\) \\?|ipcSend|isElectron" app/src/dialog/processSystem.ts` 确认桌面依赖在运行时桌面分支使用，Electron IPC 走封装。
- `git diff --check -- app/src/dialog/processSystem.ts` 通过。

### app/src/dialog/tooltip.ts

状态：已处理，等待全局验证。

上游 commit：

1. `df69dd1ef`：为 tooltip 增加 `tooltipTargetElement`，记录当前 tooltip 对应的触发元素；`showTooltip` 设置该元素，`hideTooltip` 清空该元素。

处置结果：

- 保留本地 tooltip 拆分后的定位 helper、`imports.ts` 环境封装、`getWindowWidth` / `getWindowHeight` / `getDOMPurify` 访问方式。
- 移植上游 `tooltipTargetElement` 导出，并在本地 `showTooltip` 中设置为当前 `target`。
- 本地 `hideTooltip` 保持异步函数签名，同时加入 `tooltipTargetElement = null`，承接上游隐藏时清空触发元素的行为。
- 该变更已与 `app/src/block/imports.ts` / `app/src/block/popover.ts` 的使用链对齐，避免鼠标仍在触发元素内时被误隐藏。

验证：

- `app/src/dialog/tooltip.ts` 无冲突标记。
- `app/src/dialog/tooltip.ts` 无 `/// #if/#else/#endif` 条件编译。
- `rg -n "tooltipTargetElement|export const showTooltip|export const hideTooltip|window\\.DOMPurify|window\\.inner" app/src/dialog/tooltip.ts app/src/block/imports.ts app/src/block/popover.ts` 确认新增状态导出和使用链存在，且未退回全局 `window` 直接尺寸/DOMPurify 访问。
- `git diff --check -- app/src/dialog/tooltip.ts` 通过。

### app/src/editor/openLink.ts

状态：已处理，等待全局验证。

上游 commit：

1. `129a9c2ac`：增强 SYLink 处理，新增 `processSiYuanUri`，用 `isSiYuanUriProtocol` / `parseSiYuanUriInfo` 处理 `siyuan://` 与 `web+siyuan://`，并将块 URI 与插件 URI 拆成独立处理函数。
2. `a1e16b283`：将 `parseSiYuanUriBlockInfo` 统一命名为 `parseSiYuanUriInfo`，并把块/插件 URI 内部处理函数收为模块私有。

处置结果：

- 重建 `app/src/editor/openLink.ts`，保留本地拆分后的 `openAsset`、`openBy`、`openFileById`、`openExternal`、`ipcSend`、`isElectron`、`isMobile` 等运行时封装，未引入远程 `shell` / `ipcRenderer` 直连或 `/// #if` 条件编译。
- 新增 `app/src/editor/processSiYuanUri.ts`，集中承接上游 `processSiYuanUri`、块 URI、插件 URI 处理语义，并由 `openLink.ts` 转发 `processSiYuanUri` / `processSYLink`。`processSYLink` 仅作为兼容旧调用的别名保留。
- 插件 URI 按上游语义改为解码后的精确插件名匹配；未匹配插件名时在非移动端打开自定义插件页签，默认标题和图标按上游逻辑回退到 `pluginNameOrTabType` / `iconPlugin`。
- 块 URI 使用 `parseSiYuanUriInfo`，保留 `focus` / `fullscreen` 语义；块存在时按运行时平台打开桌面或移动端块，并在 Electron 中用 `ipcSend(Constants.SIYUAN_CMD, "show")` 前置窗口。
- `app/src/protyle/util/compatibility.ts` 的 `openByMobile` 已从旧 `processSYLink` 切到新 `processSiYuanUri`，移动端打开 `siyuan://` 会优先走新协议处理；原生 iOS / Android / Harmony 打开逻辑仍只有这一处实现，避免复制维护。
- `app/src/editor/imports.ts` 补充 `isSiYuanUriProtocol` / `parseSiYuanUriInfo` 转发，并移除不再需要的 `openByMobile` 转发，减少编辑器 imports 与兼容层之间的循环风险。

验证：

- `app/src/editor/openLink.ts`、`app/src/editor/processSiYuanUri.ts`、`app/src/editor/imports.ts`、`app/src/protyle/util/compatibility.ts`、`app/src/util/pathName.ts` 无冲突标记。
- 上述文件无 `/// #if/#else/#endif` 条件编译。
- 上述文件无 `from "electron"` / `ipcRenderer.` 直连。
- `rg -n "processSYLink\\(" app/src --glob "!app/src/editor/openLink.ts" --glob "!app/src/editor/processSiYuanUri.ts"` 无旧函数调用。
- `rg -n "processSiYuanUri\\(|open-siyuan-url-plugin|open-siyuan-url-block|decodeURIComponent|web\\+siyuan|openByMobile" ...` 确认新 URI 行为、插件解码匹配和移动端入口均存在。
- `git diff --check -- app/src/editor/openLink.ts app/src/editor/processSiYuanUri.ts app/src/editor/imports.ts app/src/protyle/util/compatibility.ts app/src/util/pathName.ts` 通过。

### app/src/emoji/index.ts

状态：已处理，等待全局验证。

上游 commit：

1. `5e0a1a4be`：动态日期图标语言参数改为符合 RFC 5646，将旧值 `zh_CN` / `zh_CHT` / `en_US` 映射为 `zh-CN` / `zh-TW` / `en`。
2. `1fa30d480`：New settings UI，调整 `Files` 导入的 `/// #if !MOBILE` 条件编译范围。

处置结果：

- 保留本地 `emoji/index.ts` 的拆分结构：动态图标解析由 `app/src/emoji/emoji.dynamic.ts::parseDynamicState` 负责，面板 HTML 与事件绑定继续走 `emoji.panel` / `emoji.dynamic`。
- 将 `5e0a1a4be` 的旧语言值兼容映射移植到 `parseDynamicState`，避免本地拆分后遗漏真实执行点。
- 未引入上游 `/// #if !MOBILE` 条件编译；文件树与大纲更新继续用本地 `platform === "browser-mobile"` / `platform !== "browser-mobile"` 运行时判断控制。

验证：

- `app/src/emoji/index.ts`、`app/src/emoji/emoji.dynamic.ts` 无冲突标记。
- `app/src/emoji/index.ts`、`app/src/emoji/emoji.dynamic.ts` 无 `/// #if/#else/#endif` 条件编译。
- `rg -n "zh_CN|zh_CHT|en_US|parseDynamicState|platform === \"browser-mobile\"|platform !== \"browser-mobile\"|getDockByType|Files" app/src/emoji/index.ts app/src/emoji/emoji.dynamic.ts` 确认上游语言映射与本地运行时平台分支均存在。
- `git diff --check -- app/src/emoji/index.ts app/src/emoji/emoji.dynamic.ts` 通过。

### app/src/index.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，将账号刷新入口从旧 `account.onSetaccount()` 改为新设置模块 `onSetaccount()`，并将外观 WebSocket 更新从 `updateAppearance(data.data)` 改为 `appearanceConfigApi.apply(data.data)`。
2. `07be79c11`：配合 SiYuan URI 解析重构，将 `window.openFileByURL` 从 `isSYProtocol` / `getIdFromSYProtocol` / `getSearch("focus")` 切换为 `parseSiYuanUriInfo(openURL)`。

处置结果：

- 保留本地主入口骨架：S-Forge `EventBus`、`setProcessMessageUIDependencies`、`SForgeSymbols.MODEL_HANDLERS`、`export-preview/register`、`bazaar-hub/register`、in-note plugin 初始化、Forge i18n、S-Forge/MAGI 状态栏按钮、`embeddingText` 调试入口等本地结构均保留。
- 移植 `1fa30d480`：导入 `onSetaccount`，启动获取云端用户后调用 `onSetaccount()`；导入 `appearanceConfigApi`，`setAppearance` WebSocket 分支调用 `appearanceConfigApi.apply(data.data)`。
- 移植 `07be79c11`：导入 `parseSiYuanUriInfo`，`window.openFileByURL` 使用解析结果中的 `id` / `focus`，移除旧 `getIdFromSYProtocol`、`isSYProtocol`、`getSearch` 依赖。
- 上游条件编译未引入；浏览器退出、Chrome 提示和 ready-to-show 分支继续用本地 `isBrowser` / `isBrowserDesktop` / `ipcSend` 运行时判断。
- 移除未使用的 `siyuanI18n` 导入，避免后续 lint 噪声。

验证：

- `app/src/index.ts` 无冲突标记。
- `app/src/index.ts` 无 `/// #if/#else/#endif` 条件编译。
- `app/src/index.ts` 无 `from "electron"` / `ipcRenderer.` 直连。
- `rg -n "updateAppearance|account\\.onSetaccount|getIdFromSYProtocol|isSYProtocol|getSearch\\(|isBrowser\\(|siyuanI18n" app/src/index.ts` 无命中。
- `rg -n "appearanceConfigApi\\.apply|onSetaccount\\(|parseSiYuanUriInfo|window\\.openFileByURL|isBrowserDesktop|ipcSend\\(Constants\\.SIYUAN_READY_TO_SHOW\\)" app/src/index.ts` 确认上游变更与本地运行时分支均存在。
- `git diff --check -- app/src/index.ts` 通过。

### app/src/layout/dock/AgentChat.ts

状态：已处理，等待全局验证。

上游 commit：

1. `9a16f4eac`、`1a277e067`、`c40e9af12`、`d98767f7a`、`58cc4c01e`、`43b700c11`、`9a063b0bc`、`8f19a8962`、`55e446ce9`、`01a38fb49`、`2484f0b17`、`f067cc05a`：AI Agent 功能序列，涉及模型选择、无模型状态、设置变更刷新、跨实例会话同步、上下文 token 使用量、token 分类弹窗、错误回滚、发送按钮可用性和会话持久化字段。

处置结果：

- 保留本地 `app/src/layout/dock/AgentChat.ts` 的 S-Forge 架构增量：`genUUID` 继续走 `../../util/platform/genID`，`escapeAriaLabel` / `escapeHtml` 与 `setPosition` 继续走本地 `../../util/DOM/*` 封装，移动端上下文捕获继续通过 `isMobile` 运行时分支读取 `window.siyuan.mobile`，未引入条件编译。
- 移植上游模型选择控件：移除本地旧 `modelTrigger` / `modelMenu` 自定义菜单，统一为远程新增的原生 `<select class="agent-chat__model-select">`，并保留上游“provider 启用且有 apiKey、model 启用且有 displayName/name 才可选”的过滤、无模型占位、失效模型自动回退和 `updateSendButtonState()` 联动。
- 移植上游设置变更刷新：保留 `checkConfigChangedHandler`、`MutationObserver` 和 `countUsableModels`，设置对话框关闭或窗口 focus 后会刷新模型选择器；注释同步为 select 语义，避免旧 trigger 名称继续误导维护。
- 移植上游上下文 token 体系：保留 `contextTokens`、`contextTokenBreakdown`、`contextCachedTokens`、`contextLimit` 字段，`usage` SSE 事件通过 `appendUsage(event.lastPromptTokens, event.tokenBreakdown, event.cachedTokens, event.contextLimit)` 覆盖式更新，底部圆环与 token 分类弹窗使用同一 `contextUsageLevel()` 配色算法。
- 移植上游 token 分类弹窗：保留 hover/click 展示、外部点击/resize 关闭、缓存命中百分比、分类百分比和 `formatTokenCount()`；弹窗定位改用本地 `../../util/DOM/setPosition`，未退回全局 `window.innerWidth/innerHeight` 直连实现。
- 旧本地 `sessionPromptTokens` / `sessionCompletionTokens` / `sessionTotalDuration` / `responsePromptTokens` / `responseCompletionTokens` / `tokenTimerId` 统计链未保留，因为远程已改为后端提供的上下文用量协议；当前文件和 `app/src/util/agentSSE.ts` / `app/src/layout/dock/SessionStore.ts` 已使用同一 context token 字段，避免两套 token 统计口径长期分叉。
- 保留上游跨实例会话同步语义：`streamStart` 立即 `reloadFromDisk()` 并显示镜像占位，`streamEnd` 只解除占位等待后续 `update` 重绘，`update` 从磁盘刷新，旧的矛盾注释已删除，只保留代码实际行为。
- 保留上游无模型/配置错误路径：`handleConfigError()` 在未配置模型时回滚刚追加的用户消息并显示可操作错误卡，发送按钮和 composer 禁用态统一由 `updateSendButtonState()` 控制。

验证：

- `app/src/layout/dock/AgentChat.ts` 无冲突标记。
- `app/src/layout/dock/AgentChat.ts` 无 `/// #if/#else/#endif` 条件编译。
- `app/src/layout/dock/AgentChat.ts` 无 `from "electron"` / `ipcRenderer.` 直连。
- `rg -n "modelTrigger|modelMenu|modelMenuIndex|sessionPromptTokens|sessionCompletionTokens|sessionTotalDuration|responsePromptTokens|responseCompletionTokens|tokenTimerId|promptTokens|completionTokens|durationMs|trigger" app/src/layout/dock/AgentChat.ts` 无命中，确认旧模型菜单与旧 token 累加链已清干净。
- `rg -n "contextTokens|contextTokenBreakdown|contextCachedTokens|contextLimit|modelSelect|checkConfigChanged|updateSendButtonState|handleConfigError|reloadFromDisk|showTokenBreakdownPopup|captureEditorContext|isMobile|setPosition" app/src/layout/dock/AgentChat.ts app/src/layout/dock/SessionStore.ts app/src/util/agentSSE.ts` 确认上游 AI Agent 增量和本地运行时封装均存在。
- `git diff --check -- app/src/layout/dock/AgentChat.ts` 通过。

### app/src/layout/dock/AgentComposer.ts

状态：已处理，等待全局验证。

上游 commit：

1. `5fb5a6ca5`：在 Agent 输入框中拦截 `Ctrl/Cmd+Z`、`Ctrl/Cmd+Shift+Z`、`Ctrl+Y` 冒泡，避免触发全局撤销/重做并影响文档编辑器。
2. `9a063b0bc`：为 `mountComposer` 增加可选 `onChange` 回调，所有 doc update 都通知外部，用于控制发送按钮启用/禁用。

处置结果：

- 保留本地 `AgentComposer.ts` 使用 `../../util/DOM/escape` 的封装路径，未引入上游非 DOM 入口。
- 保留上游撤销/重做快捷键隔离逻辑：快捷键只 `stopPropagation()`，返回 `false` 让 TipTap History 继续处理输入框自己的历史。
- 保留上游 `OnChangeCallback` 与 `mountComposer(host, onSend, onChange?)` 签名；`editor.on("update")` 先调用 `onChange()`，再按本地 slash 菜单状态决定是否继续扫描 `/` 命令。
- 与已处理的 `AgentChat.ts` 对齐：`mountComposer(..., () => this.updateSendButtonState())` 已承接该回调，发送按钮状态不再依赖复制逻辑或旧 token/UI 分支。

验证：

- `app/src/layout/dock/AgentComposer.ts` 无冲突标记。
- `app/src/layout/dock/AgentComposer.ts` 无 `/// #if/#else/#endif` 条件编译。
- `app/src/layout/dock/AgentComposer.ts` 无 `from "electron"` / `ipcRenderer.` 直连。
- `rg -n "OnChangeCallback|mountComposer\\(|onChange|Ctrl\\+Z|Ctrl\\+Shift\\+Z|Ctrl\\+Y|stopPropagation|suggestionMenu && !slashActive" app/src/layout/dock/AgentComposer.ts app/src/layout/dock/AgentChat.ts` 确认上游增量和 `AgentChat` 接入均存在。
- `git diff --check -- app/src/layout/dock/AgentComposer.ts` 通过。

### app/src/layout/dock/Files.ts

状态：已处理，等待全局验证。

上游 commit：

1. `419277392`：文件树拖拽新增自定义双区提示，桌面端隐藏原生 drag image，触屏保留 DOM ghost，并在拖拽过程中维护 `window.siyuan.dragTitle`。
2. `38cfd2f6e`：拖拽提示标题颜色改为 `--b3-tooltips-color`。
3. `ab1a79c7e`：将拖拽提示提取到公共 `app/src/protyle/util/dragTip.ts`，导出 `hideDragTip`、`showDragTip`、`transparentImgSrc`。
4. `1fa30d480`：文件树排序设置保存改为提交完整 `fileTree` 配置并用服务端响应回写 `window.siyuan.config.fileTree`。

处置结果：

- `app/src/layout/dock/Files.ts` 保留本地拆分后的入口骨架，只负责面板初始化、WebSocket 回调、`init`、`getLeaf`、`selectItem` 和发布权限开关刷新；未把远程单文件拖拽/菜单实现塞回主文件，避免与 `Files/dnd.*`、`Files/moreMenu.ts` 形成双实现。
- `app/src/protyle/util/dragTip.ts` 已包含上游公共拖拽提示实现和 `--b3-tooltips-color` 标题颜色，作为文件树和编辑器拖拽提示的单一事实来源保留。
- 将上游拖拽开始语义移植到 `Files/dnd.onDragStart.ts`：补齐拖拽预览创建、桌面端 `transparentImgSrc` 透明 drag image、触屏 DOM ghost、`SIYUAN_DROP_FILE` 数据、`dragTitle` 和 `dragElement.innerText`；笔记本根节点继续按上游使用 `data-path` 兜底，保证根排序 drop 能继续执行。
- 将上游拖拽悬停提示移植到 `Files/dnd.onDragOver.ts`：在本地拆分后的排序/合法性判断后按 `dragover__top`、`dragover__bottom`、`dragover` 显示 `dragTipMoveBefore/After/Child` 或 `dragTip2DocBefore/After/Child`，所有非法早退路径隐藏全局拖拽提示。
- 将上游清理语义移植到 `Files/dnd.ts`、`Files/dnd.onDragEnd.ts`、`Files/dnd.onDrop.ts`：`dragleave`、`dragend`、`drop` 均隐藏 `dragTip` 并在结束/drop 时清空 `window.siyuan.dragTitle`；Electron 样式重置继续走本地 `ipcSend` 与 `isElectron` 运行时封装，未引入 `ipcRenderer` 直连。
- 将上游排序保存语义移植到 `Files/moreMenu.ts`：`setFiletree` 请求改为 `{ ...config.fileTree, sort }`，回调中用 `response.data` 回写 `config.fileTree` 后再 `setNoteBook(() => init(false))`，不再手写字段列表或本地先改 `sort`。

验证：

- `rg -n '^[<]{7}|^[=]{7}|^[>]{7}' app/src/layout/dock/Files.ts app/src/layout/dock/Files app/src/protyle/util/dragTip.ts` 无冲突标记。
- `rg -n '///\\s*#if|///\\s*#else|///\\s*#endif' app/src/layout/dock/Files.ts app/src/layout/dock/Files app/src/protyle/util/dragTip.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\\.' app/src/layout/dock/Files.ts app/src/layout/dock/Files app/src/protyle/util/dragTip.ts` 无 Electron 直连。
- `rg -n 'hideDragTip|showDragTip|transparentImgSrc|dragTitle|dragTipMoveBefore|dragTip2DocBefore|setFiletree|response\\.data' app/src/layout/dock/Files.ts app/src/layout/dock/Files app/src/protyle/util/dragTip.ts` 确认拖拽提示、drag title、排序配置回写均存在于本地拆分模块。
- `git diff --check -- app/src/layout/dock/Files.ts app/src/layout/dock/Files/dnd.ts app/src/layout/dock/Files/dnd.onDragStart.ts app/src/layout/dock/Files/dnd.onDragOver.ts app/src/layout/dock/Files/dnd.onDragEnd.ts app/src/layout/dock/Files/dnd.onDrop.ts app/src/layout/dock/Files/moreMenu.ts app/src/protyle/util/dragTip.ts` 通过。

### app/src/layout/dock/Inbox.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，将 Inbox 未订阅提示中的 iOS 判断从 `window.siyuan.config.system.container === "ios"` 改为 `isInIOS()`，并将 iOS 文案索引从 `_kernel[122]` 改为 `_kernel[295]`。

处置结果：

- 保留本地 `Inbox.ts` 的运行时平台结构：`isMobile` 控制移动/桌面 UI 和 `setPanelFocus` 调用，未引入上游 `/// #if MOBILE` / `/// #if !MOBILE` 条件编译。
- 保留本地封装导入路径：`fetchPost/fetchSyncPost` 继续走 `../../util/network/fetch`，`needSubscribe` 继续走 `../../util/platform/needSubscribe`，菜单、路径和 DOM escape 继续走本地拆分模块。
- 移植上游实质改动：从 `../../protyle/util/compatibility` 增加 `isInIOS` 导入，未订阅提示改为 `isInIOS() ? window.siyuan.languages._kernel[295] : ...`，不再依赖 `config.system.container === "ios"`。

验证：

- `rg -n '[<]{7}|[=]{7}|[>]{7}' app/src/layout/dock/Inbox.ts` 无冲突标记。
- `rg -n '///\\s*#if|///\\s*#else|///\\s*#endif' app/src/layout/dock/Inbox.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\\.' app/src/layout/dock/Inbox.ts` 无 Electron 直连。
- `rg -n 'isInIOS\\(|_kernel\\[295\\]|container === "ios"|_kernel\\[122\\]|isMobile|setPanelFocus|getDockByType' app/src/layout/dock/Inbox.ts` 确认上游 iOS 文案改动和本地运行时平台分支均存在，旧 iOS 判断/旧文案索引无命中。
- `git diff --check -- app/src/layout/dock/Inbox.ts` 通过。

### app/src/layout/getAll.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，将 `Protyle` 改为 type-only import；把桌面端函数的条件编译改到函数内部；`getAllTabs(type?: TTab | string)` 新增类型过滤能力，支持已初始化模型和未初始化 tab 的 `data-initdata` 匹配。

处置结果：

- 保留本地运行时架构：移动端继续通过 `isMobile` 返回空模型/空 tab/空 dock 或读取 `getSafeSiyuanMobile()`；桌面端继续通过 `getSafeSiyuanLayout()`、`getSafeSiyuanConfig()`、`getSiyuanDialogs()`、`getSiyuanBlockPanels()` 等封装访问全局状态，未引入上游 `/// #if/#else/#endif` 条件编译。
- 移植上游 type-only import：`Protyle` 改为 `import type { Protyle } from "../protyle";`，同时移除本地未使用的 `Model` 导入，避免后续 lint 噪声。
- 保留本地 `Forwardlink` 模型收集：`IModels.forwardlink` 继续由 `Forwardlink` 实例填充；递归收集函数统一覆盖 `Layout` 与 `Wnd`，避免模型收集和 tab 收集在中心布局结构上走两套行为。
- 移植上游 `getAllTabs(type)`：无参数保持原来的全量返回；有参数时按 `Search/Asset/Editor/Graph/Backlink/Outline/Custom` 过滤，并补入本地 `Forwardlink` / `forwardlink` 匹配。
- 移植上游未初始化 tab 匹配：当 `tab.model` 尚未创建时读取 `headElement[data-initdata]`，按 `instance` 或 `Custom.customModelType` 与传入 `type` 匹配，解析失败时保留上游 `console.log` 诊断。
- 保留本地 dock 配置安全读取：`getAllDocks()` 继续使用 `getSafeSiyuanConfig()?.uiLayout` 和可选链遍历左右底 dock，不退回 `window.siyuan.config.uiLayout.*` 直连。

验证：

- `rg -n '[<]{7}|[=]{7}|[>]{7}' app/src/layout/getAll.ts` 无冲突标记。
- `rg -n '///\\s*#if|///\\s*#else|///\\s*#endif' app/src/layout/getAll.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\\.' app/src/layout/getAll.ts` 无 Electron 直连。
- `rg -n 'getAllTabs\\(|type\\?: TTab|customModelType|Forwardlink|import type \\{ Protyle \\}|getSafeSiyuanLayout|getSafeSiyuanConfig|isMobile|matchesUninitializedTab|getTabsForTabs' app/src/layout/getAll.ts` 确认上游过滤能力、未初始化 tab 匹配、本地 `Forwardlink` 和安全运行时访问均存在。
- `git diff --check -- app/src/layout/getAll.ts` 通过。

### app/src/layout/status.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，仅调整 `toggleDockBar` import 所在条件编译区位置；未修改状态栏点击、帮助菜单、统计请求或计数渲染逻辑。

处置结果：

- 保留本地运行时平台实现：`initStatus()`、`countSelectWord()`、`countBlockWord()` 继续使用 `isMobile` 运行时早退，未引入上游 `/// #if !MOBILE` 条件编译。
- 保留本地封装导入路径：`fetchPost` 继续走 `../util/network/fetch`，`mountHelp` 继续走 `../util/file/mount`，`MenuItem` 继续走 `../menus/Menu.Item`，未退回远程旧路径。
- 保留本地 Electron 封装：调试菜单继续通过 `isElectron` 与 `ipcSend(Constants.SIYUAN_CMD, "openDevTools")` 打开开发者工具，未引入 `from "electron"` 或 `ipcRenderer.send` 直连。
- 保留本地状态栏扩展点：`StatusBarRegistry` 的 `渲染所有状态栏按钮()` 仍在 `initStatus()` 末尾执行，避免 S-Forge/MAGI 状态栏按钮丢失。
- 上游唯一实质 diff 是 import 顺序调整，已由本地 import 列表覆盖，无需额外迁移业务逻辑。

验证：

- `rg -n '[<]{7}|[=]{7}|[>]{7}' app/src/layout/status.ts` 无冲突标记。
- `rg -n '///\\s*#if|///\\s*#else|///\\s*#endif' app/src/layout/status.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\\.' app/src/layout/status.ts` 无 Electron 直连。
- `rg -n 'isMobile|isElectron|ipcSend|fetchPost|mountHelp|MenuItem|toggleDockBar|渲染所有状态栏按钮|StatusBarRegistry' app/src/layout/status.ts` 确认本地运行时判断、封装路径、上游相关 import 和状态栏扩展点均存在。
- `git diff --check -- app/src/layout/status.ts` 通过。

### app/src/layout/tabUtil.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，调整 `setTabPosition()` 在非独立窗口时的中心布局收集条件。
2. `a2d6b3ec7`：为 `setTabPosition(onlyPadding, onlyClear)` 增加 `onlyClear` 参数，允许工具栏显示状态下也清理/重算 tab header 状态。
3. `581398d8d`：修复 #17601，将 `--b3-toolbar-drag-left/right` 的重置方式从 `removeProperty()` 改为默认写入 `"8px"`。

处置结果：

- 保留本地模块拆分：`tabUtil.ts` 继续从 `../window/setHeader` 导入并 re-export `setTabPosition`，没有把上游整段实现复制回 `tabUtil.ts`，避免 `tabUtil.ts` 与 `window/setHeader.ts` 形成两份可漂移实现。
- 移植 `a2d6b3ec7` 到单一实现：`app/src/window/setHeader.ts` 的 `setTabPosition` 签名改为 `(onlyPadding = false, onlyClear = false)`，非独立窗口早退条件同步为 `!hideToolbar && !onlyClear`；现有 `topBar.ts` 中的 `setTabPosition(false, true)` 调用因此不会被忽略。
- 移植 `581398d8d` 到单一实现：`toolbarDragElement` 存在时默认写入 `--b3-toolbar-drag-left/right: 8px`，不再用 `removeProperty()` 清除。
- 保留本地安全实现：`window/setHeader.ts` 继续使用 `getSiyuanLayout()`、`getSiyuanConfig()`、`getWindowInnerWidth()`、`isHTMLElement()`、`isElectronStyle()` 等运行时封装，并保留 S-Forge 全屏状态 CSS 类判断；未引入条件编译或 Electron 直连。
- 清理 `tabUtil.ts` 因不再内联上游实现而多余的 `getAllWnds` 导入，避免后续 lint 噪声。

验证：

- `rg -n '[<]{7}|[=]{7}|[>]{7}' app/src/layout/tabUtil.ts app/src/window/setHeader.ts` 无冲突标记。
- `rg -n '///\\s*#if|///\\s*#else|///\\s*#endif' app/src/layout/tabUtil.ts app/src/window/setHeader.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\\.' app/src/layout/tabUtil.ts app/src/window/setHeader.ts` 无 Electron 直连。
- `rg -n 'setTabPosition\\(|onlyClear|--b3-toolbar-drag-left|--b3-toolbar-drag-right|removeProperty\\("--b3-toolbar-drag|getAllWnds|export \\{ setTabPosition \\}' app/src/layout/tabUtil.ts app/src/window/setHeader.ts app/src/layout/topBar.ts` 确认 `onlyClear`、默认拖拽边距、`topBar.ts` 调用和 re-export 均存在，旧 `removeProperty("--b3-toolbar-drag*")` 无命中。
- `git diff --check -- app/src/layout/tabUtil.ts app/src/window/setHeader.ts` 通过。

### app/src/layout/topBar.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，新增顶栏隐藏布局同步入口、交通灯位置发送 helper、外观模式图标刷新 helper，并将 VIP 点击入口改到新设置页。
2. `a2d6b3ec7`：顶栏隐藏状态切换后调用 `setTabPosition(false, true)`，配合 `setTabPosition` 的 `onlyClear` 参数立即清理/重算 tab header。

处置结果：

- 保留本地顶栏运行时架构：`isElectron`、`ipcSend`、`setZoomFactor`、`isBrowser/isWindow/setToolbarLeftMac`、`fetchPost`、`needSubscribe`、`getWorkspaceName`、`siyuanI18n` 等继续使用本地封装路径，未恢复远程 `from "electron"`、`ipcRenderer`、`webFrame` 或 `/// #if` 条件编译。
- 移植上游 `sendTrafficLightPosition(zoom)` 语义，并改成本地运行时判断实现：非 Electron 直接返回，找不到 zoom position 时安全返回，发送交通灯位置统一走 `ipcSend(Constants.SIYUAN_CMD, {...})`。
- 移植上游 `syncHideToolbarLayout()`：同步 `body--toolbar-hide`、调用 `resizeTopBar()`，非独立窗口更新交通灯位置后执行 `setTabPosition(false, true)`；独立窗口保持上游早退行为。
- 移植上游 `updateBarModeIcon()`，为新设置 UI 的外观模式切换提供顶栏图标刷新入口。
- `setZoom()` 不再保留一份内联交通灯位置发送逻辑，统一调用 `sendTrafficLightPosition(zoom)`，避免缩放和隐藏工具栏两条路径行为分叉。
- 上游 VIP 点击进入新设置页的语义已由本地现有 `openSetting(app, "sync")` 覆盖；本地 Bazaar Hub 顶栏按钮 `barBazaar` 与 `openBazaarHubTab({ app })` 保留。

验证：

- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/layout/topBar.ts` 无冲突标记。
- `rg -n "///\s*#if|///\s*#else|///\s*#endif" app/src/layout/topBar.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\.|webFrame\.' app/src/layout/topBar.ts` 无 Electron 直连。
- `rg -n 'sendTrafficLightPosition|syncHideToolbarLayout|setTabPosition\(false, true\)|setZoomFactor|setToolbarLeftMac|ipcSend|openSetting\(app, "sync"\)|openBazaarHubTab|siyuanI18n|isElectron' app/src/layout/topBar.ts` 确认上游新增入口、本地运行时封装、新设置入口和 Bazaar Hub 均存在。
- `git diff --check -- app/src/layout/topBar.ts` 通过。

### app/src/layout/util.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，`exportLayout()` 保存滚动位置时从 `getAllModels().editor` 切换为 `getAllEditor()`，覆盖搜索、反链、自定义模型等编辑器来源。
2. `9286db9fc`：`exportLayout()` 在主窗口模式找不到 `#barDock use` 时也调用 `options.cb()`，避免退出/导出流程卡住。
3. `07be79c11`：将 URL 打开解析从旧 `getIdZoomInByPath()` 切到 `parseUriInfo()`，统一承接 `siyuan://`、`web+siyuan://`、Android 协议和查询参数里的 `focus/fullscreen` 语义。

处置结果：

- `app/src/layout/util.ts` 属于本地大规模拆分入口，按规程恢复本地骨架，只保留 `getInstanceById`、`resetLayout`、`pdfIsLoading`、`newModelByInitData` 以及对 `dock-utils`、`layout-serialization`、`layout-deserialization`、`window-utils`、`ui-utils` 的 re-export，未把远程单文件实现复制回来。
- `1fa30d480` 已移植到 `app/src/layout/layout-serialization.ts::exportLayout`：导入并调用 `getAllEditor()`，循环中直接 `saveScroll(editor)`，不再只保存 `getAllModels().editor`。
- `9286db9fc` 已移植到 `app/src/layout/layout-serialization.ts::exportLayout`：`buildMainWindowLayoutJSON()` 返回空时先执行 `options.cb()` 再返回。
- `07be79c11` 已移植到 `app/src/layout/layout-deserialization.layout.ts::handleUrlFileOpen`：导入 `parseUriInfo()`，使用 `info.id`、`info.focus` 构造 `openFileById` 参数。
- 远程最终版中 `JSONToLayout()` 对右/左/底 dock 全隐藏时尺寸归零的逻辑已由本地 `app/src/layout/layout-deserialization.ts::collapseEmptyDockLayouts()` 承接，并在 `saveLayout()` 后、`setTabPosition()` 前调用。
- 为避免规程中的 `[=]{7}` 冲突标记搜索误报，将 `layout-deserialization.layout.ts` 中原有等号分隔注释改为普通中文注释；不改变运行逻辑。

验证：

- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/layout/util.ts app/src/layout/layout-serialization.ts app/src/layout/layout-deserialization.ts app/src/layout/layout-deserialization.layout.ts` 无冲突标记。
- `rg -n "///\s*#if|///\s*#else|///\s*#endif" app/src/layout/util.ts app/src/layout/layout-serialization.ts app/src/layout/layout-deserialization.ts app/src/layout/layout-deserialization.layout.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\.|webFrame\.' app/src/layout/util.ts app/src/layout/layout-serialization.ts app/src/layout/layout-deserialization.ts app/src/layout/layout-deserialization.layout.ts` 无 Electron 直连。
- `rg -n 'getAllEditor|getAllModels\(\)\.editor|saveScroll\(|options\.cb\(\)|parseUriInfo|getIdZoomInByPath|info\.focus|collapseEmptyDockLayouts|rightDock\?\.layout|leftDock\?\.layout|bottomDock\?\.layout' app/src/layout/util.ts app/src/layout/layout-serialization.ts app/src/layout/layout-deserialization.ts app/src/layout/layout-deserialization.layout.ts` 确认上游三项实质改动及 dock 折叠逻辑均在本地拆分模块中承接，旧 `getAllModels().editor` 与 `getIdZoomInByPath` 在处理范围内无命中。
- `git diff --check -- app/src/layout/util.ts app/src/layout/layout-serialization.ts app/src/layout/layout-deserialization.ts app/src/layout/layout-deserialization.layout.ts` 通过。

### app/src/menus/onGetnotebookconf.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，调整笔记本配置弹窗表单结构和类名：移除 content 背景内联样式，使用 `config-item` / `config-name` / `config-wrap` / `fn__size200`。

处置结果：

- 移植远程新设置 UI 的 DOM 结构和样式类名，两个保存路径配置块使用 `config-item config-item--save-path`，标题文本包入 `config-name`，select 宽度改为 `fn__size200`，行容器增加 `config-wrap`。
- 保留本地封装路径：`fetchPost` 继续走 `../util/network/fetch`，`isMobile` 继续走 `../util/platform/functions`，文案继续走 `siyuanI18n`，未退回 `window.siyuan.languages` 直连。
- 保留移动端 `openModel` 和桌面 `Dialog` 的运行时判断，不引入任何条件编译。

验证：

- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/menus/onGetnotebookconf.ts` 无冲突标记。
- `rg -n "///\s*#if|///\s*#else|///\s*#endif" app/src/menus/onGetnotebookconf.ts` 无条件编译。
- `rg -n 'window\.siyuan\.languages|siyuanI18n|config-item|config-name|config-wrap|fn__size200|config__item|style="background-color|style="min-width' app/src/menus/onGetnotebookconf.ts` 确认新 UI 类名和本地 i18n 封装存在，旧类名、旧内联样式和 `window.siyuan.languages` 直连无命中。
- `git diff --check -- app/src/menus/onGetnotebookconf.ts` 通过。

### app/src/menus/protyle.ts

状态：已处理，等待全局验证。

上游 commit：

1. `a20f27a74`：为退出聚焦场景添加 `scrollAttr.scrollTop` 与 `ResizeObserver + scrollCenter` 强制定位，尝试解决 #17886。
2. `1fa30d480`：New settings UI，将 `openBacklink` / `openGraph` 等桌面菜单依赖移动到 `/// #if !MOBILE` 条件编译块。
3. `c49b51b4e`：为 #17902 临时保存 `_zoomOutSavedScrollTop`，并在主请求和补偿请求中传递 `scrollTop`。
4. `95018fa5d`：最终调整 #17886 / #17902 方案，移除 `_zoomOutSavedScrollTop`、`scrollTopBeforeBlur`、`ResizeObserver` 与 `scrollCenter` 强制定位，改为主 `onGet` 传 `scrollAttr + scrollPosition`，动态补偿 `onGet` 传 `scrollAttr`。

处置结果：

- `app/src/menus/protyle.ts` 属于本地拆分入口，按大规模重构规程恢复本地骨架，只保留菜单 re-export、`tableMenu` 和 `setFoldById`，未恢复远程单文件实现。
- `a20f27a74` 与 `c49b51b4e` 的临时 `scrollTop` / `_zoomOutSavedScrollTop` / `ResizeObserver` 方案被上游后续 `95018fa5d` 明确替代，本地不保留这些中间实现。
- `95018fa5d` 已移植到 `app/src/menus/protyleMenus/editorMenu/protyle.zoomOut.ts`：主 `onGet` 传入 `scrollAttr: { rootId, focusId }` 与 `scrollPosition: "start"`，并继续使用 `afterCB: options.callback`。
- `95018fa5d` 已移植到 `app/src/menus/protyleMenus/editorMenu/protyle.zoomOut.focus.ts`：命中现有焦点元素时只执行公共 `focusBlock` 聚焦，滚动交给 `onGet`；动态补偿请求的 `onGet` 按远程最终版在 `options.focusId` 存在时传入 `scrollAttr`，回根文档补偿不传滚动参数。
- `app/src/menus/protyleMenus/editorMenu/imports.ts` 已移除 `scrollCenter` 转发，避免本地子模块保留被上游最终版删除的滚动强制定位依赖。
- `1fa30d480` 的条件编译语义不引入 `/// #if`；本地拆分后的 `refMenu`、`tagMenu`、`linkMenu` 等子模块继续用现有运行时平台封装承接桌面/移动菜单分支，入口文件不复制远程条件编译导入块。

验证：

- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/menus/protyle.ts app/src/menus/protyleMenus/editorMenu/protyle.zoomOut.ts app/src/menus/protyleMenus/editorMenu/protyle.zoomOut.focus.ts app/src/menus/protyleMenus/editorMenu/imports.ts` 无冲突标记。
- `rg -n "///\s*#if|///\s*#else|///\s*#endif" app/src/menus/protyle.ts app/src/menus/protyleMenus/editorMenu/protyle.zoomOut.ts app/src/menus/protyleMenus/editorMenu/protyle.zoomOut.focus.ts app/src/menus/protyleMenus/editorMenu/imports.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\.|webFrame\.' app/src/menus/protyle.ts app/src/menus/protyleMenus/editorMenu/protyle.zoomOut.ts app/src/menus/protyleMenus/editorMenu/protyle.zoomOut.focus.ts app/src/menus/protyleMenus/editorMenu/imports.ts` 无 Electron 直连。
- `rg -n "scrollAttr|scrollPosition|afterCB: options\.callback|ResizeObserver|scrollCenter|_zoomOutSavedScrollTop|scrollTopBeforeBlur|openBacklink|openGraph|openGlobalSearch|聚焦到目标" app/src/menus/protyle.ts app/src/menus/protyleMenus/editorMenu/protyle.zoomOut.ts app/src/menus/protyleMenus/editorMenu/protyle.zoomOut.focus.ts app/src/menus/protyleMenus/editorMenu/imports.ts` 确认最终 `scrollAttr/scrollPosition/afterCB` 行为存在，旧 `ResizeObserver`、`scrollCenter`、`_zoomOutSavedScrollTop`、`scrollTopBeforeBlur` 和远程入口条件编译相关桌面导入在处理范围内无命中。
- `git diff --check -- app/src/menus/protyle.ts app/src/menus/protyleMenus/editorMenu/protyle.zoomOut.ts app/src/menus/protyleMenus/editorMenu/protyle.zoomOut.focus.ts app/src/menus/protyleMenus/editorMenu/imports.ts` 通过。

### app/src/mobile/dock/MobileFiles.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，移动端文件树排序保存改为提交完整 `fileTree` 配置并用服务端响应回写 `window.siyuan.config.fileTree`。

处置结果：

- `app/src/mobile/dock/MobileFiles.ts` 属于本地拆分入口，按大规模重构规程恢复本地骨架，继续只负责模型连接、DOM 初始化、WebSocket 分发、选择/展开和发布权限刷新。
- 上游 `genSort()` 的实质改动已移植到本地拆分后的 `app/src/mobile/dock/MobileFiles.event.ts::genSort`：移除本地先写 `window.siyuan.config.fileTree.sort = sort`，请求体改为 `{ ...window.siyuan.config.fileTree, sort }`，回调中用 `response.data` 回写完整 `window.siyuan.config.fileTree` 后再 `setNoteBook(() => files.init(false))`。
- 未恢复远程单文件中的 click/touch/渲染/ws 方法，避免与本地 `MobileFiles.event.ts`、`MobileFiles.render.ts`、`MobileFiles.ws.ts` 形成双实现。
- 上游本文件没有需要迁移的 `/// #if` 条件编译语义；本地也未引入任何条件编译。

验证：

- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/mobile/dock/MobileFiles.ts app/src/mobile/dock/MobileFiles.event.ts` 无冲突标记。
- `rg -n "///\s*#if|///\s*#else|///\s*#endif" app/src/mobile/dock/MobileFiles.ts app/src/mobile/dock/MobileFiles.event.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\.|webFrame\.' app/src/mobile/dock/MobileFiles.ts app/src/mobile/dock/MobileFiles.event.ts` 无 Electron 直连。
- `rg -n "genSort|setFiletree|\\.\\.\\.window\\.siyuan\\.config\\.fileTree|window\\.siyuan\\.config\\.fileTree = response\\.data|window\\.siyuan\\.config\\.fileTree\\.sort = sort|alwaysSelectOpenedFile|openFilesUseCurrentTab|maxListCount|sortMenu" app/src/mobile/dock/MobileFiles.ts app/src/mobile/dock/MobileFiles.event.ts` 确认新排序保存语义存在，旧手写字段列表与本地预写 `sort` 无命中。
- `git diff --check -- app/src/mobile/dock/MobileFiles.ts app/src/mobile/dock/MobileFiles.event.ts` 通过。

### app/src/mobile/index.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，将移动端启动时的外观应用从 `loadAssets(confResponse.data.conf.appearance)` 切换为 `appearanceConfigApi.apply(window.siyuan.config.appearance)`，并移除启动入口对 `loadAssets` 的直接依赖。
2. `07be79c11`：增强 SiYuan URI 处理，将 `openFileByURL` 从 `isSYProtocol + getIdFromSYProtocol + getSearch("focus")` 切换为 `parseSiYuanUriInfo(openURL)`，统一支持 `siyuan://` 与 `web+siyuan://` 的 `focus` 解析。

处置结果：

- 保留本地移动端入口架构：`fetchGet/fetchPost` 继续走 `../util/network/fetch`，`addBaseURL/setNoteBook` 继续走 `../util/file/pathName`，保留 `setProcessMessageUIDependencies`、`createProcessMessage`、`setSForgeState`、Forge i18n / `initSForge({ isMobile: true })`、移动端键盘工具栏高度桥接和 iOS purchase 封装路径。
- `1fa30d480` 已移植：新增 `appearanceConfigApi` 导入，启动加载语言后调用 `appearanceConfigApi.apply(window.siyuan.config.appearance)`，并从 `../util/assets/assets` 导入中移除 `loadAssets`。
- `07be79c11` 已移植：新增 `parseSiYuanUriInfo` 导入，`window.openFileByURL` 使用解析结果的 `id` 与 `focus` 决定 `openMobileFileById` 的 action；旧 `getIdFromSYProtocol`、`isSYProtocol` 和 `getSearch` 在本文件中移除。
- 未采用远程整文件的旧导入路径，避免覆盖本地 S-Forge 与平台封装改动。

验证：

- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/mobile/index.ts` 无冲突标记。
- `rg -n "///\s*#if|///\s*#else|///\s*#endif" app/src/mobile/index.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\.|webFrame\.' app/src/mobile/index.ts` 无 Electron 直连。
- `rg -n "appearanceConfigApi|loadAssets|parseSiYuanUriInfo|getIdFromSYProtocol|isSYProtocol|getSearch|setProcessMessageUIDependencies|createProcessMessage|SForgeSymbols|initSForge|callMobileAppShowKeyboard|setWebViewFocusable|processIOSPurchaseResponse|exportLayout|hideMessage|confirmDialog|kernelError|reloadSync" app/src/mobile/index.ts` 确认上游两项改进与本地 S-Forge / 移动端桥接功能同时存在，旧 `loadAssets`、`getIdFromSYProtocol`、`isSYProtocol`、`getSearch` 无命中。
- `git diff --check -- app/src/mobile/index.ts` 通过。

### app/src/mobile/menu/index.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，移动端右侧菜单的设置项改为由 `getSettingTabDefs()` 生成，通过 `settingTabToMenuId()` 定位点击目标，使用 `bindSettingSaveDelegation()` 和 `getSettingTab(id).mount()` 挂载新设置页；同时 `popMenu()` 在编辑器多选模式下不展开菜单。

处置结果：

- 保留本地移动端菜单骨架和封装路径：`mountHelp/newDailyNote/newNotebook` 继续走 `../../util/file/mount`，`newFile` 继续走 `../../util/file/newFile`，`lockScreen` 继续走本地拆分文件，菜单文案继续使用 `siyuanI18n`，未回退到远程旧路径或 `window.siyuan.languages` 直连。
- 移植远程新设置 Tab 菜单机制：新增 `getSettingTab/getSettingTabDefs/settingTabToMenuId`、`bindSettingSaveDelegation`、`getSettingTabFromMenuTarget()` 和统一 `openSettingTabModel()`，设置区域由 `${settingTabsMenuHTML}` 渲染，点击后挂载对应 `SettingTab`。
- 保留本地账号入口的顶部呈现：未删除 `accountHTML` 头像/登录入口；点击 `menuAccount` 时打开统一 `sync` Tab，并用账号图标和登录/管理标题承接原入口语义，避免继续维护旧账号弹窗与新设置页两套行为。
- 移除旧移动端设置入口的双轨点击路径：不再调用 `initAppearance/initConfigAssets/initAI/initRiffCard/initEditor/initFileTree/initExport/initAbout`，也不再在菜单中直接调用旧 `repos.genHTML()` / `publish.genHTML()`；同步、本地仓库、账号由新 `sync` Tab 承接，发布服务由新 `access` Tab 承接。
- 保留本地 AI 可见性运行时判断：`ai` 与 `AIProfiles` 菜单项继续按 `isHuawei()` / `isDisabledFeature("ai")` 隐藏，没有引入任何 `/// #if` 条件编译。
- 移植远程多选保护：`popMenu()` 在 `getCurrentEditor()?.protyle.toolbar.isMultiSelectMode()` 为真时直接返回。

验证：

- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/mobile/menu/index.ts` 无冲突标记。
- `rg -n "///\s*#if|///\s*#else|///\s*#endif" app/src/mobile/menu/index.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\.|webFrame\.' app/src/mobile/menu/index.ts` 无 Electron 直连。
- `rg -n "settingTabsMenuHTML|getSettingTabFromMenuTarget|bindSettingSaveDelegation|getCurrentEditor|isMultiSelectMode|siyuanI18n|accountHTML|isSettingTabHidden|openSettingTabModel|menuAccount|initAppearance|initConfigAssets|initAI|initRiffCard|initEditor|initFileTree|initExport|initAbout|repos|publish\\.genHTML|showAccountInfo|login\\(" app/src/mobile/menu/index.ts` 确认新设置 Tab 机制、账号入口、本地 i18n 和 AI 隐藏逻辑存在，旧设置入口和旧账号弹窗调用无命中。
- `git diff --check -- app/src/mobile/menu/index.ts` 通过。

### app/src/mobile/util/initFramework.ts

状态：已处理，等待全局验证。

上游 commit：

1. `07be79c11`：将移动端启动时从 URL 打开块的解析从 `getIdZoomInByPath()` 切换为 `parseUriInfo()`，统一承接 `siyuan://`、`web+siyuan://`、Android 协议以及查询参数中的 `focus/fullscreen` 语义。

处置结果：

- 保留本地封装路径：`fetchPost` 继续走 `../../util/network/fetch`，`setInlineStyle` 继续走 `../../util/assets/assets`，`getOpenNotebookCount` 继续走 `../../util/file/pathName`，`checkFold` 继续走 `../../util/platform/noRelyPCFunction`。
- 移植上游 URI 解析改进：新增 `parseUriInfo` 从 `../../util/pathName` 导入，启动打开块逻辑改为 `const info = parseUriInfo()`，用 `info.id` 和 `info.focus` 决定 `openMobileFileById()` 的 action；旧 `getIdZoomInByPath()` 在本文件移除。
- 远程最终文件中的大纲预览态动态判断不是 `07be79c11` 本轮上游变更；该处保留本地当前行为 `preview: false` / `isPreview: false`，不在本次冲突处理中扩大行为面。
- 未引入任何 `/// #if` 条件编译。

验证：

- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/mobile/util/initFramework.ts` 无冲突标记。
- `rg -n "///\s*#if|///\s*#else|///\s*#endif" app/src/mobile/util/initFramework.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\.|webFrame\.' app/src/mobile/util/initFramework.ts` 无 Electron 直连。
- `rg -n 'parseUriInfo|getIdZoomInByPath|getOpenNotebookCount|util/network/fetch|util/fetch|util/assets/assets|util/assets"|util/platform/noRelyPCFunction|util/noRelyPCFunction|preview: false|preview\.element\.classList' app/src/mobile/util/initFramework.ts` 确认新 URI 解析、本地封装路径和本地大纲行为存在，旧 `getIdZoomInByPath`、远程旧封装路径和大纲动态预览态无命中。
- `git diff --check -- app/src/mobile/util/initFramework.ts` 通过。

### app/src/mobile/util/keyboardToolbar.ts

状态：已处理，等待全局验证。

上游 commit：

1. `eb2f8fb91`：针对 `https://github.com/siyuan-note/siyuan/issues/17877`，点击移动端斜杆菜单的 `((` / `{{` 候选项后调用 `callMobileAppShowKeyboard()`，避免候选列表无输入框时键盘收起导致无法继续输入筛选。
2. `8d2ff8187`：调整同一修复的顺序，`((` / `{{` 命中时优先保持键盘，并在 Android/Harmony 上延迟 `focusByRange(protyle.toolbar.range)`；普通 `data-focus="true"` 项继续直接恢复 range。

处置结果：

- 保留本地拆分架构：`keyboardToolbar.ts` 继续只负责初始化、状态计算和把点击事件委托给 `handleToolbarClick()`；未把远程旧内联点击处理整段回填到入口文件。
- 移植上游 `#17877` 修复到本地子模块 `keyboardToolbar.action.ts`：斜杆项 `dataValue === "((" || dataValue === "{{"` 时调用 `callMobileAppShowKeyboard()`，并在 Android/Harmony 上按 `Constants.TIMEOUT_TRANSITION` 延迟 `focusByRange(protyle.toolbar.range)`。
- 保持普通斜杆项行为：除 `((` / `{{` 外，仍按 `data-focus="true"` 直接 `focusByRange(protyle.toolbar.range)`。
- 修正拆分后的行为漂移：`goback` 从行内工具条返回时恢复显示主工具条 `dynamicElements[0]`，与原始/远程语义一致，避免后续维护出现入口委托与旧行为不一致。
- `keyboardToolbar.ts` 移除不再直接使用的 `callMobileAppShowKeyboard` 导入，避免入口文件重新承担 action 细节。

验证：

- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/mobile/util/keyboardToolbar.ts app/src/mobile/util/keyboardToolbar.action.ts` 无冲突标记。
- `rg -n "///\s*#if|///\s*#else|///\s*#endif" app/src/mobile/util/keyboardToolbar.ts app/src/mobile/util/keyboardToolbar.action.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\.|webFrame\.' app/src/mobile/util/keyboardToolbar.ts app/src/mobile/util/keyboardToolbar.action.ts` 无 Electron 直连。
- `rg -n 'handleToolbarClick|setPreventRender|dataValue ===|callMobileAppShowKeyboard\(|dynamicElements\[0\]\.classList' app/src/mobile/util/keyboardToolbar.ts app/src/mobile/util/keyboardToolbar.action.ts` 确认入口委托、`((` / `{{` 键盘保持逻辑和 `goback` 主工具条恢复逻辑存在。
- `git diff --check -- app/src/mobile/util/keyboardToolbar.ts app/src/mobile/util/keyboardToolbar.action.ts` 通过。

### app/src/plugin/API.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI 附带改进条件编译范围，将桌面专用的 `getActiveTab/getDockByType/getAllModels/getAllTabs/exportLayout` 放入 `/// #if !MOBILE`；同时 `expandDocTree` 中的文件树模型类型从 `Files` 扩展为 `MobileFiles | Files`。

处置结果：

- 保留本地插件 API 架构：`API.ts` 继续使用 `../util/network/fetch`、`../util/platform/functions`、S-Forge `openMobileFileById` 注册表代理、lazy getter 聚合，以及本地拆分的 `openTab/openWindow/getModelByDockType/expandDocTree` 子模块。
- 未照搬远程 `/// #if !MOBILE` 条件编译；本地通过 `isMobile()` 和拆分后的运行时封装维持移动端/桌面端差异。
- 移植上游 `MobileFiles | Files` 意图到 `app/src/plugin/api/expandDocTree.ts`：新增 `FileTreeModel` 结构类型和 `isFileTreeModel()` 运行时能力判断，按 `element/setCurrent/getLeaf/selectItem` 能力接纳桌面 `Files` 与移动端 `MobileFiles`。
- 移除本地子模块中 `instanceof Files` 运行时限制，避免移动端文件树模型被错误排除。
- `API.ts` 第二处错位冲突保留本地 `findEditorByActiveTime()` 逻辑，未把远程旧 `expandDocTree` 内联片段塞回本地函数。

验证：

- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/plugin/API.ts app/src/plugin/api/expandDocTree.ts` 无冲突标记。
- `rg -n "///\s*#if|///\s*#else|///\s*#endif" app/src/plugin/API.ts app/src/plugin/api/expandDocTree.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\.|webFrame\.' app/src/plugin/API.ts app/src/plugin/api/expandDocTree.ts` 无 Electron 直连。
- `rg -n 'isFileTreeModel|FileTreeModel|getModelByDockType\("file"\)|instanceof Files|MobileFiles|openTab|openWindow|getActiveTab|getAllModels|getAllTabs|exportLayout|ProtyleMethod|OPEN_MOBILE_FILE_BY_ID' app/src/plugin/API.ts app/src/plugin/api/expandDocTree.ts` 确认本地 API 拆分、S-Forge 代理、远程文件树模型兼容意图存在，旧 `instanceof Files` 无命中。
- `git diff --check -- app/src/plugin/API.ts app/src/plugin/api/expandDocTree.ts` 通过。

### app/src/plugin/index.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，将移动端插件顶栏图标插入点从硬编码 `#menuAbout` 改为 `"#" + settingTabToMenuId("about")`，以适配新设置菜单的 ID 生成方式；同一提交还移动了远程旧条件编译导入位置。

处置结果：

- 保留本地无条件编译和运行时封装：继续使用 `../util/network/fetch`、`../util/platform/functions`、`../platform/electron/ipcRenderer` 的 `ipcSend` 与运行时 `isElectron`，未引入远程 `from "electron"` 或任何 `/// #if`。
- 保留本地拆分路径：`BlockPanel` 继续走 `../block/panel/Panel`，`setPanelFocus` 继续走 `../layout/utils/setPanelFocus`，`normalizeStoragePath` 继续走 `../util/file/pathName`，`tabRegistry` 和 dock action 注册保持本地实现。
- 移植上游新设置菜单 ID 改进：新增 `settingTabToMenuId` 导入，`addTopBar()` 在移动端未固定插件图标时插入到 `"#" + settingTabToMenuId("about")` 后面，不再依赖旧 `#menuAbout`。
- 远程把 `clearOBG` 放入 `/// #if !MOBILE` 的变动不照搬；本地没有条件编译，且该导入由既有运行时调用路径维护。

验证：

- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/plugin/index.ts` 无冲突标记。
- `rg -n "///\s*#if|///\s*#else|///\s*#endif" app/src/plugin/index.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\.|webFrame\.' app/src/plugin/index.ts` 无 Electron 直连。
- `rg -n 'settingTabToMenuId|menuAbout|ipcSend|isElectron|util/network/fetch|util/fetch|util/platform/functions|util/functions|block/panel/Panel|block/Panel|normalizeStoragePath|util/file/pathName|util/pathName' app/src/plugin/index.ts` 确认新设置菜单插入点和本地封装路径存在，旧 `menuAbout`、远程旧路径和 Electron 直连无命中。
- `git diff --check -- app/src/plugin/index.ts` 通过。

### app/src/plugin/loader.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，将插件加载后重新挂载移动端顶栏图标的位置从 `#menuAbout` 改为 `"#" + settingTabToMenuId("about")`，以适配新设置菜单 ID；远程同文件仍是旧内联 `afterLoadPlugin` 结构。

处置结果：

- 保留本地 loader 架构：`loader.ts` 继续通过 `./imports` 网关导入 `fetchSyncPost/getFrontend/isMobile/saveLayout/getAllEditor`，插件代码执行继续走 `API.environment` 的 `getPluginRuntimeRequire/evaluatePluginCode`，`afterLoadPlugin()` 继续委托 `runAfterLoadPlugin(plugin)`。
- 未把远程旧内联顶栏挂载块回填到 `loader.ts`，避免与本地 `loader.afterLoad.ts` 双轨维护。
- 移植上游设置菜单插入点到 `loader.afterLoad.ts`：新增 `settingTabToMenuId`，`appendMobileTopBarIcon()` 改为查找 `"#" + settingTabToMenuId("about")` 后插入插件图标，不再依赖旧 `#menuAbout`。
- 保持导入网关风格：在 `app/src/plugin/imports.ts` 增加 `settingTabToMenuId` 转发，`loader.afterLoad.ts` 从 `./imports` 读取，未新增跨层旧路径。
- 保留本地 `uninstallPluginsByNames()`、插件卸载/重载/数据变更处理流程和 S-Forge 注释记录。

验证：

- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/plugin/loader.ts app/src/plugin/loader.afterLoad.ts app/src/plugin/imports.ts` 无冲突标记。
- `rg -n "///\s*#if|///\s*#else|///\s*#endif" app/src/plugin/loader.ts app/src/plugin/loader.afterLoad.ts app/src/plugin/imports.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\.|webFrame\.' app/src/plugin/loader.ts app/src/plugin/loader.afterLoad.ts app/src/plugin/imports.ts` 无 Electron 直连。
- `rg -n 'settingTabToMenuId|menuAbout|runAfterLoadPlugin|appendMobileTopBarIcon|LOCAL_PLUGINTOPUNPIN|getFrontend|isMobile|isWindow|util/network/fetch|util/fetch|util/platform/functions|util/functions|loader\.afterLoad|uninstallPluginsByNames' app/src/plugin/loader.ts app/src/plugin/loader.afterLoad.ts app/src/plugin/imports.ts` 确认新设置菜单插入点、本地 after-load 委托和导入网关存在，旧 `menuAbout` 与远程旧路径无命中。
- `git diff --check -- app/src/plugin/loader.ts app/src/plugin/loader.afterLoad.ts app/src/plugin/imports.ts` 通过。

### app/src/plugin/openTopBarMenu.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：New settings UI，将插件顶栏菜单的“管理”入口从 `openSetting(app)` 后手动点击 `.config__side [data-name="bazaar"]` 改为直接调用 `openSetting(app, "bazaar")`。

处置结果：

- 保留本地拆分结构：`openTopBarMenu.ts` 继续只负责组装菜单流程，配置/语言/存储继续通过 `getSiyuanConfig/getSiyuanLanguages/getSiyuanStorage` 获取，管理入口继续委托 `addManageMenuItem()`。
- 未回填远程旧内联菜单块，也未引入 `/// #if !MOBILE`。
- 移植上游设置页打开改进到 `openTopBarMenu.helpers.ts`：`addManageMenuItem()` 的点击回调改为 `openSetting(app, "bazaar")`，不再依赖旧 DOM 侧栏选择器和手动 `CustomEvent("click")`。
- 保留本地插件图标处理、空状态处理和菜单定位 helper。

验证：

- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/plugin/openTopBarMenu.ts app/src/plugin/openTopBarMenu.helpers.ts` 无冲突标记。
- `rg -n "///\s*#if|///\s*#else|///\s*#endif" app/src/plugin/openTopBarMenu.ts app/src/plugin/openTopBarMenu.helpers.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\.|webFrame\.' app/src/plugin/openTopBarMenu.ts app/src/plugin/openTopBarMenu.helpers.ts` 无 Electron 直连。
- `rg -n 'addManageMenuItem|openSetting\(app, "bazaar"\)|config__side|data-name="bazaar"|CustomEvent\("click"\)|getSiyuanConfig|getSiyuanLanguages|getSiyuanStorage|processPluginTopBarIcons' app/src/plugin/openTopBarMenu.ts app/src/plugin/openTopBarMenu.helpers.ts` 确认新 `openSetting(app, "bazaar")` 存在，旧设置侧栏选择器无命中；`CustomEvent("click")` 仅存在于插件图标触发逻辑。
- `git diff --check -- app/src/plugin/openTopBarMenu.ts app/src/plugin/openTopBarMenu.helpers.ts` 通过。

### app/src/plugin/platformUtils.ts

状态：已处理，等待全局验证。

上游 commit：

1. `129a9c2ac`：Enhance SYLink processing，将插件 API 暴露的 `openByMobile` 从 `compatibility.openByMobile` 改为从 `../editor/openLink` 转发，使插件侧也使用新的 SiYuan URI 处理入口。

处置结果：

- 保留本地运行时平台判断实现：继续使用 `isElectron` 与 `ipcSend`，通知发送/取消逻辑仍按运行时环境区分 Electron 和移动容器，未恢复远程 `from "electron"`、`ipcRenderer` 或 `/// #if`。
- 移植上游 `openByMobile` 来源调整：`platformUtils.ts` 改为 `export {openByMobile} from "../editor/openLink";`，其余剪贴板、快捷键和平台工具继续从 `../protyle/util/compatibility` 批量转发。
- 保留本地注释和通知兼容逻辑，避免把远程条件编译版本覆盖回本地运行时封装。

验证：

- `git diff --no-ext-diff :1:app/src/plugin/platformUtils.ts :3:app/src/plugin/platformUtils.ts` 确认上游对本文件的唯一实质改动是 `openByMobile` 来源调整。
- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/plugin/platformUtils.ts` 无冲突标记。
- `rg -n '///\s*#if|///\s*#else|///\s*#endif' app/src/plugin/platformUtils.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\.' app/src/plugin/platformUtils.ts` 无 Electron 直连。
- `rg -n "openByMobile|isElectron|ipcSend|sendNotification|cancelNotification" app/src/plugin/platformUtils.ts` 确认上游 `openByMobile` 转发与本地运行时通知实现同时存在。
- `git diff --check -- app/src/plugin/platformUtils.ts` 通过。

### app/src/protyle/gutter/index.ts

状态：已处理，等待全局验证。

上游 commit：

1. `419277392`：针对 `#14034`，块标拖拽时隐藏标题块原生 ghost，使用透明图像让自定义双区拖拽提示接管，并在拖拽结束清理 `window.siyuan.dragTitle`。
2. `25ceee725`：将 `#14034` 的拖拽 ghost 处理范围从标题块扩展到普通块，AV 行继续保留原生 ghost。
3. `ab1a79c7e`：将透明图像常量抽为 `transparentImgSrc`，避免在 gutter 中内联 base64。
4. `10e556a16`：拖拽数据库块且块文本为空时，`dragTitle` 优先使用当前数据库视图名，最后兜底为 `database` 语言项。
5. `189d5ae85`：针对 `#9521`，超级块内的子块不再生成宽度调整菜单，避免对子块宽度做不适合的样式修改。

处置结果：

- 按大规模重构规程，`index.ts` 保留本地入口骨架：继续负责 `gutterTip` 初始化、`bindEvent()` 事件委托、`buildGutterMenu()`/`buildGutterMultipleMenu()` 菜单委托和 `renderGutter()` 渲染委托，未把远程旧内联事件与菜单实现回填到入口文件。
- 移植 `#14034` 拖拽修复到本地承接模块 `bindEvent.ts`：新增 `transparentImgSrc` 导入；普通块拖拽在非触摸拖拽时使用透明图像隐藏原生 ghost，触摸拖拽仍保存 `touchDragGhost`，AV 行仍使用原生 ghost。
- 同步移植 `dragTitle` 行为：普通块拖拽设置 `window.siyuan.dragTitle`；数据库块无文本时使用当前视图名或 `window.siyuan.languages.database`；`dragend` 清空 `dragTitle`。
- 移植 `#9521` 到本地样式菜单模块：`buildGutterWidthsMenu()` 在选中元素父级为 `.sb` 时返回 `null`；`buildGutterCommonMenu.ts` 和 `buildMultipleAppearanceMenu.ts` 两个调用点改为有宽度菜单时才追加。
- 保留本地 S-Forge 菜单拆分、环境封装和现有中文模块结构，未新增 `/// #if`。

验证：

- `git diff --no-ext-diff :1:app/src/protyle/gutter/index.ts :3:app/src/protyle/gutter/index.ts` 确认上游实质改动为拖拽 ghost/dragTitle、`transparentImgSrc` 导入和超级块宽度菜单保护。
- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/protyle/gutter/index.ts app/src/protyle/gutter/bindEvent.ts app/src/protyle/gutter/buildGutterStyleMenu.ts app/src/protyle/gutter/buildGutterCommonMenu.ts app/src/protyle/gutter/buildMultipleAppearanceMenu.ts` 无冲突标记。
- `rg -n '///\s*#if|///\s*#else|///\s*#endif' app/src/protyle/gutter/index.ts app/src/protyle/gutter/bindEvent.ts app/src/protyle/gutter/buildGutterStyleMenu.ts app/src/protyle/gutter/buildGutterCommonMenu.ts app/src/protyle/gutter/buildMultipleAppearanceMenu.ts` 无条件编译。
- `rg -n 'from "electron"|ipcRenderer\.|webFrame\.' app/src/protyle/gutter/index.ts app/src/protyle/gutter/bindEvent.ts app/src/protyle/gutter/buildGutterStyleMenu.ts app/src/protyle/gutter/buildGutterCommonMenu.ts app/src/protyle/gutter/buildMultipleAppearanceMenu.ts` 无 Electron 直连。
- `rg -n 'transparentImgSrc|touchDragActive|touchDragGhost|dragTitle|isBlockDrag|parentElement\?\.classList\.contains\("sb"\)|buildGutterWidthsMenu' app/src/protyle/gutter/index.ts app/src/protyle/gutter/bindEvent.ts app/src/protyle/gutter/buildGutterStyleMenu.ts app/src/protyle/gutter/buildGutterCommonMenu.ts app/src/protyle/gutter/buildMultipleAppearanceMenu.ts` 确认上游拖拽修复和超级块宽度菜单保护已在拆分模块中落地。
- `rg -n 'new MenuItem\(buildGutterWidthsMenu|menuItems\.push\(buildGutterWidthsMenu' app/src/protyle/gutter` 无旧的直接追加宽度菜单调用。
- `rg -n 'touchDragActive|touchDragGhost|dragTitle' app/src/types app/src -g '!app/src/protyle/gutter/index.ts'` 确认全局字段已有类型定义和既有使用。
- `git diff --check -- app/src/protyle/gutter/index.ts app/src/protyle/gutter/bindEvent.ts app/src/protyle/gutter/buildGutterStyleMenu.ts app/src/protyle/gutter/buildGutterCommonMenu.ts app/src/protyle/gutter/buildMultipleAppearanceMenu.ts` 通过。

### app/src/protyle/render/av/col.ts

状态：已处理，等待全局验证。

上游 commit：

1. `cd8ca7e9f`：Support database filter composition，新增筛选条件时用完整 `oldFilters` 作为 undo 数据，避免撤销时清空所有筛选。
2. `0432e3d62`：回滚上一版筛选组合尝试。
3. `000e38f95`：重新引入完整 `oldFilters` undo，并补充说明注释。
4. `92af77092`：列菜单点击“筛选”时不再递归查找并复用同列已有条件，而是始终新增一个占位条件，以支持同列多条件组合。

处置结果：

- 保留本地 `col.ts` 其他结构和路径封装，只处理筛选菜单冲突块。
- 移植上游最终语义：删除本地 `findFilter()` 递归复用旧条件逻辑，点击列筛选时始终创建新的 `IAVFilter`，允许同列多条件组合。
- 保留上游完整 undo 改进：在 push 新条件前深拷贝 `avData.view.filters` 到 `oldFilters`，撤销时恢复旧筛选树，不再使用 `data: []`。
- 未新增条件编译。

验证：

- `git diff --no-ext-diff :1:app/src/protyle/render/av/col.ts :3:app/src/protyle/render/av/col.ts` 确认上游实质改动集中在列筛选新增条件与 undo 数据。
- `rg -n "[<]{7}|[=]{7}|[>]{7}" app/src/protyle/render/av/col.ts` 无冲突标记。
- `rg -n '///\s*#if|///\s*#else|///\s*#endif' app/src/protyle/render/av/col.ts` 无条件编译。
- `rg -n 'findFilter|始终新建|oldFilters|getEditableFilters\(avData\)\.push\(filter\)|data: oldFilters|data: \[\], // undo' app/src/protyle/render/av/col.ts` 确认 `findFilter` 和旧 `data: []` 无命中，新建条件与 `oldFilters` 存在。
- `git diff --check -- app/src/protyle/render/av/col.ts` 通过。

### app/src/protyle/render/av/filter.ts

状态：已处理，等待全局验证。

上游 commit：

1. `40b8a36f4` 等 `#10550` 系列：Support database filter composition，重构数据库筛选组合 UI，新增 AND/OR 左侧控制、分组层级样式、添加条件下拉、更多菜单入口，以及复制筛选、条件转分组、单条件分组转条件等操作。
2. `92af77092`/`cd8ca7e9f`/`000e38f95` 等：支持同列多条件；新增/提交筛选时用完整 `oldFilters` 作为 undo，并对 transaction do 数据做深拷贝。
3. `6b416ae1b` 等：checkbox 筛选从 `Is true/Is false` 操作符切换为 `=`/`!=` 操作符 + true/false 值控件。
4. `24cfd1c8f` 等：内联筛选控件样式收敛到 `av__filter-*` class，select 下拉增加防重复绑定、`stopImmediatePropagation()`、递增 `zIndex` 和最小宽度。
5. `895aa3c02`/`7d952d6d1` 等：识别仅有 `combination` 的根组、移除空父分组、删除旧折叠状态实现。

处置结果：

- 保留本地文件骨架、导入路径和 i18n 封装：继续使用 `../../../util/network/fetch`、`../../../util/DOM/*`、`../../../util/platform/functions`、`siyuanI18n`、`filter.operator.ts`、`filter.menu.ts`，未回退到远程旧路径或 `window.siyuan.languages`。
- 移植上游最终筛选组合 UI：`getFiltersHTML()` 使用 AND/OR 控件宽度测量、`av__filter-group-item`、`av__filter-group-children--depth*`、`av__filter-rowinner`、`moreFilter` 和顶层 `addFilterCondition`。
- 保留本地“拖入空分组”能力：在上游新分组结构内加入 `av__filter-empty` 占位拖放目标；同时在 `openMenuPanel.drag.ts` 将筛选拖拽识别从旧 `removeFilter` 扩展到新 `moreFilter`，避免新 UI 下拖拽半失效。
- 移植上游新增操作函数：导出 `duplicateFilterByPath()`、`convertFilterToGroup()`、`convertGroupToFilter()`，供 `openMenuPanel.ts` 的更多菜单使用。
- 移植上游 checkbox 语义：`getDefaultOperatorByType("checkbox")` 保持 `=`；内联 checkbox 操作符为 `=`/`!=`，值控件读取 true/false，不再依赖旧 `Is true/Is false`。
- 确认上游事务与事件修复已包含：`addFilter()`/`commitFilter()` 使用完整旧筛选和深拷贝数据；`bindInlineFilterEvents()` 使用 `dataset.filterEventsBound` 防重复绑定；select 下拉使用递增 `zIndex`、最小宽度 120 和 `stopImmediatePropagation()`。
- 删除旧折叠状态依赖：不恢复 `foldedFilterPaths`、`resetFoldedFilterPaths()`、`toggleFoldedFilterPath()`，避免与上游新的分组 UI 和后续 `openMenuPanel.ts` 导入冲突继续双轨维护。
- 未新增任何 `/// #if/#else/#endif` 条件编译。

验证：

- `git diff --no-ext-diff :1:app/src/protyle/render/av/filter.ts :3:app/src/protyle/render/av/filter.ts` 确认上游实质改动为筛选组合 UI、同列多条件、深拷贝事务、checkbox 语义、更多菜单函数和内联控件样式/事件修复。
- `rg -n "[<]{7}|[>]{7}" app/src/protyle/render/av/filter.ts app/src/protyle/render/av/openMenuPanel.drag.ts` 无冲突标记。
- `rg -n '///\s*#if|///\s*#else|///\s*#endif' app/src/protyle/render/av/filter.ts app/src/protyle/render/av/openMenuPanel.drag.ts` 无条件编译。
- `rg -n 'window\.siyuan\.languages|foldedFilterPaths|toggleFold' app/src/protyle/render/av/filter.ts app/src/protyle/render/av/openMenuPanel.drag.ts` 无旧折叠状态和绕过本地 i18n 的文案访问。
- `rg -n 'duplicateFilterByPath|convertFilterToGroup|convertGroupToFilter|filterEventsBound|stopImmediatePropagation|Math\.max\(rect\.width, 120\)|getDefaultOperatorByType|removeFilterByPath|addFilterCondition|data-empty-group|moreFilter' app/src/protyle/render/av/filter.ts app/src/protyle/render/av/openMenuPanel.drag.ts` 确认上游新增动作、事件修复、本地空分组拖放承接和新更多菜单入口存在。
- `git diff --check -- app/src/protyle/render/av/filter.ts app/src/protyle/render/av/openMenuPanel.drag.ts` 通过；仅提示 `openMenuPanel.drag.ts` 工作区 CRLF 将在 Git 触碰时按仓库规则处理。

### app/src/protyle/render/av/gallery/render.ts

状态：已处理，等待全局验证。

上游 commit：

1. `5625bea23`：针对数据库搜索框空白内容折叠行为做中间调整，但该提交随后被上游最终提交回滚，不作为最终远程语义移植。
2. `4ff3482c1`：新增 `app/src/protyle/render/av/search.ts::bindAvSearch()`，将表格/图库 AV 搜索框绑定抽成公共函数，并补充 `cut` 事件后延迟触发搜索更新，修复剪切后搜索框不响应的问题。

处置结果：

- 保留本地图库渲染骨架：`getGalleryHTML()` 继续使用异步 `renderCell()`、`cellValueIsEmpty()`、`contentRendererRegistry.renderBatch()`、压缩图片 URL、字段图标/描述、`siyuanI18n` 和本地 `fetchSyncPost` 路径，未回退到远程 `getRowHTML()` / `processRender()` / `window.siyuan.languages`。
- 移植上游最终搜索绑定语义：在 `afterRenderGallery()` 的 `renderAll` 分支调用 `bindAvSearch({ blockElement, query, isSearching, onChange })`，删除本文件内联 `composition/input/blur/clear` 绑定，避免表格和图库搜索行为分叉。
- 承接远程新增文件 `app/src/protyle/render/av/search.ts`：保留 `cut` 事件触发搜索更新的上游 bugfix，并把导入改为本地 `util/DOM/addClearButton`、`siyuanI18n.clear` 和 `platform.isMobile` 运行时判断。
- 上游新增文件中的 `/// #if MOBILE` / `/// #endif` 未引入；移动端清键盘行为改为 `if (isMobile) { activeBlur(); }`。

验证：

- `git diff --no-ext-diff :1:app/src/protyle/render/av/gallery/render.ts :3:app/src/protyle/render/av/gallery/render.ts` 与 `git show 4ff3482c1` 确认上游最终实质改动为抽取 `bindAvSearch()` 和补充 `cut` 搜索更新。
- `rg -n "[<]{7}|[=]{7}|[>]{7}|///\s*#if|///\s*#else|///\s*#endif" app/src/protyle/render/av/gallery/render.ts app/src/protyle/render/av/search.ts` 无冲突标记和条件编译。
- `rg -n "electronUndo|addClearButton|activeBlur|isMobile|window\.siyuan\.languages|bindAvSearch|updateSearch|contentRendererRegistry|renderCell|getCompressURL|siyuanI18n" app/src/protyle/render/av/gallery/render.ts app/src/protyle/render/av/search.ts` 确认图库本地渲染能力保留，搜索事件集中到 `bindAvSearch()`，且公共搜索绑定使用本地 DOM/i18n/platform 封装。
- `git diff --check -- app/src/protyle/render/av/gallery/render.ts app/src/protyle/render/av/search.ts` 通过。

### app/src/protyle/render/av/openMenuPanel.ts

状态：已处理，等待全局验证。

上游 commit：

1. `83c125000`/`a3f2060ce`/`f07fc29b7`/`6c718594f`/`cb0c72665`/`d70204b7d`/`2675c5036`/`792901326`/`24cfd1c8f`/`22ecabe50`/`cd8ca7e9f`/`0432e3d62`/`000e38f95`/`8c102501d`/`7174bdea7`/`686406e15`/`804df9d57`：数据库筛选组合系列，最终远程语义为树状筛选面板、AND/OR 组合切换、添加条件/分组、更多菜单复制/转换/删除、同列多条件、深拷贝事务数据、lineNumber 列清理关联筛选，以及移除旧折叠状态。

处置结果：

- 按大规模重构规程保留本地 `openMenuPanel.ts` 入口骨架：继续使用本地拆分后的 `openMenuPanel.click.*`、`openMenuPanel.drag.ts`、`openMenuPanel.properties.ts` 和本地路径封装，未把远程旧大文件整体回填。
- 移植上游筛选面板入口语义：`b3-menu` 在 `options.type === "filters"` 时追加 `av__filter-panel`；保留本地 `isMobile` 运行时布尔判断，未恢复远程 `isMobile()` 路径，也未引入任何条件编译。
- 删除旧折叠状态入口：`openMenuPanel.ts` 不再导入/调用 `resetFoldedFilterPaths()`；`openMenuPanel.click.sortsFilters.ts` 不再导入/调用 `toggleFoldedFilterPath()`，与上游最终分组 UI 保持单一路径。
- 将上游 `toggleCombination` change 行为迁移到本地 `bindFilterCombinationChange()`：支持仅有 `combination` 的根组，事务 do/undo 数据均使用深拷贝，切换后重渲染 `getFiltersHTML()` 并重新定位。
- 将上游 `goFilters`/`goSorts`/`go-config`/`go-properties`/`go-layout` 的筛选面板 class 切换迁移到本地 `openMenuPanel.click.sortsFilters.ts` 和 `openMenuPanel.click.view.ts`，避免筛选面板样式泄漏到其它面板。
- 将上游 `removeFilters` 语义迁移到本地筛选模块：提交给后端的 do 数据仍为 `[]`，本地内存状态保持 `[{ combination: "and", filters: [] }]` 根组不变量，避免后续新增分组误判根结构。
- 将上游 `addFilterCondition` 和 `moreFilter` 迁移到本地筛选模块：添加条件、添加分组并填入默认条件、复制筛选、条件转分组、单条件分组转条件、删除非空分组确认，均复用本地 `filter.ts` 导出的树状筛选工具函数。
- 将上游 lineNumber 列清理筛选的递归语义迁移到 `openMenuPanel.click.colEdit.ts`：列类型改为 `lineNumber` 时使用 `hasFilterForColumn()` / `removeFiltersByColumn()` 递归清理树状筛选，并同步本地 `ctx.data.view.filters`。
- 保留本地内联筛选事件防重复机制：由 `filter.ts::bindInlineFilterEvents()` 的 `dataset.filterEventsBound` 控制，不再保留旧的 `dataset.inlineFilterEvents` 双轨状态。

验证：

- `git diff --no-ext-diff :1:app/src/protyle/render/av/openMenuPanel.ts :3:app/src/protyle/render/av/openMenuPanel.ts | rg -n "addFilterCondition|moreFilter|toggleCombination|av__filter-panel|hasFilterForColumn|removeFiltersByColumn|lineNumber|resetFolded|duplicateFilterByPath|convertFilter"` 确认上游最终实质改动集中在筛选组合、面板 class、lineNumber 清理和移除旧折叠状态。
- `rg -n "[<]{7}|[=]{7}|[>]{7}|///\s*#if|///\s*#else|///\s*#endif|resetFolded|toggleFolded|toggleFold" app/src/protyle/render/av/openMenuPanel.ts app/src/protyle/render/av/openMenuPanel.click.sortsFilters.ts app/src/protyle/render/av/openMenuPanel.click.colEdit.ts app/src/protyle/render/av/openMenuPanel.click.view.ts app/src/protyle/render/av/filter.ts` 无冲突标记、条件编译和旧折叠状态残留。
- `rg -n "addFilterCondition|moreFilter|duplicateFilterByPath|convertFilterToGroup|convertGroupToFilter|av__filter-panel|filterEventsBound|setAttrViewFilters|removeFiltersByColumn|hasFilterForColumn" app/src/protyle/render/av/openMenuPanel.ts app/src/protyle/render/av/openMenuPanel.click.sortsFilters.ts app/src/protyle/render/av/openMenuPanel.click.colEdit.ts app/src/protyle/render/av/openMenuPanel.click.view.ts app/src/protyle/render/av/filter.ts` 确认上游新增入口、更多菜单、转换/复制、深拷贝事务、防重复事件和 lineNumber 递归清理均已落地。
- `git diff --check -- app/src/protyle/render/av/openMenuPanel.ts app/src/protyle/render/av/openMenuPanel.click.sortsFilters.ts app/src/protyle/render/av/openMenuPanel.click.colEdit.ts app/src/protyle/render/av/openMenuPanel.click.view.ts` 通过；仅提示 `openMenuPanel.click.colEdit.ts` 和 `openMenuPanel.click.view.ts` 工作区 CRLF 将在 Git 触碰时按仓库规则处理。

### app/src/protyle/render/av/render.ts

状态：已处理，等待全局验证。

上游 commit：

1. `4ff3482c1`：抽取 AV 搜索绑定到 `app/src/protyle/render/av/search.ts::bindAvSearch()`，表格和图库共用，并补充 `cut` 事件后延迟触发搜索更新。

处置结果：

- 按本地拆分架构保留 `render.ts` 入口骨架：继续从 `render.table.ts` 引入 `getTableHTMLs`、`renderGroupTable`、`afterRenderTable`，未把远程旧单文件表格渲染实现回填到入口文件。
- 将上游表格搜索抽取迁移到本地承接文件 `render.table.ts`：`afterRenderTable()` 在 `renderAll` 时调用 `bindAvSearch({ blockElement, query, isSearching, onChange })`，`onChange` 继续调用本地 `updateSearch()`。
- 删除本地表格里的旧内联搜索绑定和清除按钮逻辑：不再直接导入 `electronUndo`、`activeBlur`、`addClearButton`，避免表格/图库两套搜索行为分叉。
- 保留并复用上一个冲突项承接的 `search.ts`：公共搜索绑定已包含上游 `cut` bugfix、`siyuanI18n.clear` 清除按钮文案和 `if (isMobile) { activeBlur(); }` 运行时判断；未引入任何 `/// #if/#else/#endif` 条件编译。

验证：

- `git diff --no-ext-diff :1:app/src/protyle/render/av/render.ts :3:app/src/protyle/render/av/render.ts` 确认上游最终实质改动为删除旧内联搜索绑定并调用 `bindAvSearch()`。
- `rg -n "[<]{7}|[=]{7}|[>]{7}|///\s*#if|///\s*#else|///\s*#endif" app/src/protyle/render/av/render.ts app/src/protyle/render/av/render.table.ts app/src/protyle/render/av/search.ts app/src/protyle/render/av/gallery/render.ts` 无冲突标记和条件编译。
- `rg -n "addClearButton|electronUndo|activeBlur|bindAvSearch|updateSearch|cut|clearAriaLabel|isMobile|isInMobileApp" app/src/protyle/render/av/render.ts app/src/protyle/render/av/render.table.ts app/src/protyle/render/av/search.ts app/src/protyle/render/av/gallery/render.ts` 确认表格/图库均已走 `bindAvSearch()`，旧底层搜索事件只保留在公共 `search.ts` 中。
- `git diff --check -- app/src/protyle/render/av/render.ts app/src/protyle/render/av/render.table.ts` 通过；仅提示 `render.table.ts` 工作区 CRLF 将在 Git 触碰时按仓库规则处理。

### app/src/protyle/ui/initUI.ts

状态：已处理，等待全局验证。

上游 commit：

1. `1fa30d480`：设置界面重构期间同步调整编辑器字体滚轮缩放保存逻辑，`/api/setting/setEditor` 返回后将 `response.data` 回写到 `window.siyuan.config.editor`；重置为 16px 的保存路径也做同样回写。

处置结果：

- 按大规模重构规程保留本地 `initUI.ts` 入口骨架：继续由 `初始化DOM结构()`、`绑定滚轮缩放事件()`、`绑定底部点击事件()`、`绑定悬停事件()` 组织 UI 初始化，未把远程旧单文件实现回填。
- 将上游保存后回写语义迁移到本地承接文件 `app/src/protyle/ui/event.ts`：新增 `保存编辑器配置()`，统一调用 `fetchPost("/api/setting/setEditor", window.siyuan.config.editor, ...)` 并回写 `window.siyuan.config.editor = response.data`。
- 滚轮调整后的延时保存和消息里的“重置 16px”保存都改为调用 `保存编辑器配置()`，覆盖上游两处实质改动。
- 重置按钮不再修改事件闭包里的旧 `config` 引用，而是直接修改 `window.siyuan.config.editor.fontSize = 16`，避免上游回写全局配置对象后后续保存仍使用旧对象。
- 未引入任何 `/// #if/#else/#endif` 条件编译，继续使用本地运行时平台判断。

验证：

- `git log --oneline $(git merge-base HEAD MERGE_HEAD)..MERGE_HEAD -- app/src/protyle/ui/initUI.ts` 确认上游相关提交为 `1fa30d480`。
- `git diff --no-ext-diff :1:app/src/protyle/ui/initUI.ts :3:app/src/protyle/ui/initUI.ts | rg -n "setEditor|response\.data|fontSize|fetchPost|wheelTimeout"` 确认上游最终实质改动为两处 `setEditor` 保存后回写 `response.data`。
- `rg -n "[<]{7}|[=]{7}|[>]{7}|///\s*#if|///\s*#else|///\s*#endif" app/src/protyle/ui/initUI.ts app/src/protyle/ui/event.ts` 无冲突标记和条件编译。
- `rg -n "setEditor|window\.siyuan\.config\.editor = response\.data|保存编辑器配置|fontSizeScrollZoom|绑定滚轮缩放事件" app/src/protyle/ui/initUI.ts app/src/protyle/ui/event.ts` 确认上游回写语义已落到本地滚轮缩放模块。
- `git diff --check -- app/src/protyle/ui/initUI.ts app/src/protyle/ui/event.ts` 通过；仅提示 `event.ts` 工作区 CRLF 将在 Git 触碰时按仓库规则处理。

### app/src/protyle/undo/globalUndo.ts

状态：已处理，等待后续 `undo/index.ts` 冲突项联动验证。

上游 commit：

1. `664758b18`：支持跨文档撤销，建立前端全局撤销入口和本地乐观渲染路径。
2. `682a65397`：围绕跨文档撤销体验做行为调整，避免撤销/重做后无目标地滚动到文档首块，且仅在目标块不在视口内时滚动。

处置结果：

- 保留本地 `globalUndo.ts` 重构骨架：继续通过 `./imports` 转发常量、请求、对话框、平台和 DOM 守卫，移动端使用 `if (isMobile())` 运行时判断与 `getSafeSiyuanMobile()`，未恢复远程 `/// #if MOBILE` / `/// #if !MOBILE` 条件编译。
- 将上游 `focusRootIDs()` 的滚动行为迁移到本地实现：必须存在 `focusBlockId` 才定位目标块，删除本地“未指定时滚到文档首块”的兜底，避免撤销/重做后打断当前滚动位置。
- 承接上游视口判断：目标块只有在 `rect.bottom < 0 || rect.top > window.innerHeight` 时才 `scrollIntoView({ behavior: "smooth", block: "center" })`。
- 承接上游 `renderLocal()` 调用语义：撤销和重做都调用 `protyle.undo?.renderLocal(protyle, data.doOperations)`，不再传递已无实际分支作用的 `false/true`。
- 承接上游焦点块选择语义：撤销/重做后使用 `data.doOperations?.find((op: IOperation) => op.id)?.id`，不再只寻找 `insert` 操作，覆盖 move/update 等有目标 ID 的场景。

验证：

- `git log --oneline $(git merge-base HEAD MERGE_HEAD)..MERGE_HEAD -- app/src/protyle/undo/globalUndo.ts` 确认上游相关提交为 `664758b18` 和 `682a65397`。
- `git diff --no-ext-diff :1:app/src/protyle/undo/globalUndo.ts :3:app/src/protyle/undo/globalUndo.ts | rg -n "focusRootIDs|scrollIntoView|renderLocal|focusBlockId|op\.id|window\.innerHeight"` 确认上游最终实质改动集中在聚焦滚动、`renderLocal` 调用和焦点块选择。
- `rg -n "[<]{7}|[=]{7}|[>]{7}|///\s*#if|///\s*#else|///\s*#endif" app/src/protyle/undo/globalUndo.ts` 无冲突标记和条件编译。
- `rg -n "focusRootIDs|focusBlockId|scrollIntoView|window\.innerHeight|renderLocal\(protyle, data\.doOperations|op\.id|isMobile\(\)|getSafeSiyuanMobile" app/src/protyle/undo/globalUndo.ts` 确认上游行为已落在本地运行时平台架构中。
- `rg -n 'op\.action === "insert"|renderLocal\(protyle, data\.doOperations, (false|true)|\[data-node-id\]\)' app/src/protyle/undo/globalUndo.ts` 无旧焦点块选择、旧三参调用和滚动到首块兜底残留。
- `git diff --check -- app/src/protyle/undo/globalUndo.ts` 通过。

### app/src/protyle/undo/index.ts

状态：已处理，等待后续全局验证。

上游 commit：

1. `664758b18`：支持跨文档撤销，`Undo.renderLocal()` 仅保留本地乐观应用职责。
2. `7fffcd257`：撤销模块整理。
3. `f1ebddd54`：修复撤销/重做替换 DOM 后 `toolbar.range` detached，导致后续异步操作读取无效 range 的问题（issue #17896）。

处置结果：

- 保留本地 `undo/index.ts` 重构骨架：继续通过 `./imports` 使用 `onTransaction`、`preventScroll`、`Constants`、`hideElements`、`matchHotKey`、`isElectron`、`ipcSend` 和快捷键环境封装，未恢复远程直接导入 `electron` 或 `/// #if !BROWSER` 条件编译。
- 承接上游 `renderLocal()` 两参语义：签名改为 `public renderLocal(protyle: IProtyle, operations: IOperation[])`，与 `globalUndo.ts` 的撤销/重做调用一致。
- 承接上游移除 `scrollCenter()` 的语义：本文件不再导入或调用 `scrollCenter`，避免撤销/重做后额外滚动。
- 承接上游 `toolbar.range` 同步修复：本地应用事务、移除 AV 面板并 `preventScroll(protyle)` 后，如当前 selection 存在则写回 `protyle.toolbar.range = getSelection().getRangeAt(0)`。
- 保留并修正本地 `markLastInsertRange()` 拆分函数：继续只标记最后一个 `insert` 的 `context.setRange`，但 `onTransaction()` 按真实签名一次性接收 `operations` 数组，避免把单个 operation 误传给数组 API。
- `electronUndo()` 保持本地运行时判断：通过 `if (!isElectron) { return false; }` 屏蔽非 Electron 环境，不引入条件编译。

验证：

- `git log --oneline $(git merge-base HEAD MERGE_HEAD)..MERGE_HEAD -- app/src/protyle/undo/index.ts` 确认上游相关提交包含 `664758b18`、`7fffcd257` 和 `f1ebddd54`。
- `git diff --no-ext-diff :1:app/src/protyle/undo/index.ts :3:app/src/protyle/undo/index.ts | rg -n "scrollCenter|renderLocal|toolbar\.range|getSelection|17896|onTransaction"` 确认上游最终实质改动为删除 `scrollCenter`、`renderLocal` 两参化和同步 `toolbar.range`。
- `rg -n "[<]{7}|[=]{7}|[>]{7}|///\s*#if|///\s*#else|///\s*#endif" app/src/protyle/undo/index.ts` 无冲突标记和条件编译。
- `rg -n "scrollCenter|renderLocal\(|onTransaction\(protyle, operations, true\)|toolbar\.range|getSelection\(\)|ipcSend|isElectron|ipcRenderer" app/src/protyle/undo/index.ts app/src/protyle/undo/globalUndo.ts` 确认两参调用、数组事务、本地 Electron 运行时封装和 range 同步已生效，且本文件不再引用 `scrollCenter` / `ipcRenderer`。
- `git diff --check -- app/src/protyle/undo/index.ts app/src/protyle/undo/globalUndo.ts` 通过。

### app/src/protyle/util/editorCommonEvent.ts

状态：已处理，等待后续全局验证。

上游 commit：

1. 完整清单：`849ab4aff`、`55194541f`、`ea227ac73`、`f679dcec0`、`feafeb449`、`1a77fbd27`、`907f230a6`、`0ed7184f6`、`9eef8b525`、`aa1a40474`、`68b7e1ef2`、`6d160253a`、`4942958dc`、`6b9914926`、`699c72eef`、`6bf7f7f10`、`56af14837`、`99d4e983f`、`d244ef5e4`、`94d6cc084`、`3aeb771dd`、`c4186911b`、`462ff70e5`、`95d8f9836`、`2aa42af59`、`e9c5f8683`、`a82bd8ea0`、`9fb256fc3`、`dfc6e69e4`、`d516d9d20`、`f4c50943f`、`7a7bb74af`、`ed676a6c8`、`8e82f5112`、`1da897001`：`#17893` 列表和超级块拖拽体验改进系列。
2. `9bea5eda1`、`1c8983e1`、`189d5ae85`、`d396fda66`：`#9521` 超级块相关清理、子块计数和列宽持久化语义。
3. `911513212`、`688ce5e6b`：`#4866` / `#4866#issuecomment-4747899654` 拖拽移动时源块位置、父块/前序块和撤销数据修正。
4. `419277392`、`25ceee725`、`3291817f1`、`481f02e36`、`38cfd2f6e`、`ab1a79c7e`：`#14034` 拖拽体验与 URI/跨窗口相关中间调整，最终以远程文件中的拖拽入口语义为准。

处置结果：

- 按一对多映射规程保留本地 `editorCommonEvent.ts` 入口拆分架构，入口只负责绑定 `dragstart` / `drop` / `dragover` / `dragleave` / `dragenter` / `dragend` 并维护共享 `IDndState`，未回填上游单文件大实现。
- 将上游块移动定位修复迁移到 `dnd/moveTo.ts` 与 `moveTo.helper.*`：`captureSourcePositions()` 跨窗口/移动端找不到源编辑器时通过 `/api/block/getBlockInfo` 获取真实 `rootID`，`previousID` 改用 `getPreviousBlockSibling()`，超级块清理改用 `getSbChildBlockCount()` 和 `getParentBlock()`。
- 将上游超级块宽度和列布局合并事务迁移到 `dnd/drag.ts`：移动前记录源超级块集合，折叠标题 undo 前置，列布局合并使用 `turnsIntoOneTransaction({ getOperations: true, unfocus: true })` 并入同一事务，调用 `refreshSbAndPersistWidth()` 持久化宽度变化。
- 将上游拖拽 ghost 与标题迁移到 `dnd/onDragStart.ts`：桌面端使用 `transparentImgSrc` 隐藏原生 ghost，触屏端保留 `touchDragGhost`，并用 `getContenteditableElement()` 写入 `window.siyuan.dragTitle` 供拖拽提示复用。
- 将上游拖拽提示、列表层级高亮和清理逻辑迁移到 `dnd/onDragOver.ts`、`dnd/onDragLeave.ts`、`dnd/onDrop.ts`、`dnd/util.ts`：新增 `showDragTip()` / `hideDragTip()` 调用、`cleanupDragIndicators()`、`highlightColColumn()`、`getListDepth()`、`parseHexColor()`、`highlightByLevel()`，并清理新旧 `dragover__*` class 与 CSS 变量。
- 将上游列表目标交互完整迁移到 `dnd/onDragOver.ts`：列表项源拖拽支持 sibling/child 指示、无操作保护、列表左右边缘处理、非列表源拖入列表内容区时显示列表插入提示、边缘保留超级块处理；命中空白时加入向上逐步探测和左右水平探测，避免深层列表项/超级块空隙命中失准。
- 将上游 drop 路由迁移到 `dnd/onDrop.helper.gutter.ts` 与 `dnd/onDrop.helper.routing.ts`：`handleBlockDrag()` 接收 `gutterTypes`，识别 `--child` / `--sibling` / 左右方向，列表源拖到自身、子孙、原位、相邻 list/li 时跳过；拖整个 `NodeList` 到 `NodeListItem` 时展开子 `.li`，子项插入时定位嵌套列表或最后内容块。
- 将上游 `dataTransfer.items` 改为 `dataTransfer.types` 的语义迁移到 `dnd/onDragOver.ts` 与 `dnd/onDrop.ts`，并同步注释，避免 Firefox/浏览器兼容路径继续依赖旧遍历。
- 未引入任何 `/// #if/#else/#endif` 条件编译；所有平台差异继续走现有运行时状态、拖拽状态和 DOM 判断。

验证：

- `git show :3:app/src/protyle/util/editorCommonEvent.ts | rg -n "applyLiTarget|cleanupDragIndicators|dragover__bottom--child|isChild|isNoOpDrop|nestedTarget|refreshSbAndPersistWidth|transparentImgSrc|dragTitle|getOperations: true|getBlockInfo|hProbed" -C 4` 用于逐项对照远程最终语义，确认关键行为已映射到 `dnd/*` 子模块。
- `rg -n '[<]{7}|[=]{7}|[>]{7}|///\s*#if|///\s*#else|///\s*#endif' app/src/protyle/util/editorCommonEvent.ts app/src/protyle/util/dnd app/src/protyle/util/dragTip.ts` 无冲突标记和条件编译。
- `rg -n 'dataTransfer\.items|getSbChildCount' app/src/protyle/util/editorCommonEvent.ts app/src/protyle/util/dnd` 无旧遍历和旧超级块子节点计数残留。
- `rg -n 'getPreviousBlockSibling|getSbChildBlockCount|refreshSbAndPersistWidth|cleanupDragIndicators|dragover__top--sibling|dragover__bottom--child|showDragTip|hideDragTip|transparentImgSrc|dragTitle|getBlockInfo|getOperations: true|hProbed|dragTipListItemChild|dragTipMoveTargetFront' app/src/protyle/util/editorCommonEvent.ts app/src/protyle/util/dnd app/src/protyle/util/dragTip.ts` 确认上游关键改进均存在于当前拆分实现。
- `git diff --check -- app/src/protyle/util/editorCommonEvent.ts app/src/protyle/util/dnd app/src/protyle/util/dragTip.ts` 通过；仅提示相关工作区文件 CRLF 将在 Git 触碰时按仓库规则处理。
- `node` + TypeScript `transpileModule` 对 `editorCommonEvent.ts`、`dnd/*.ts` 和 `dragTip.ts` 共 16 个文件做语法转译检查，结果 `syntax ok: 16 files`。
- `pnpm exec tsc --noEmit ...` 不能作为当前项通过依据，因为仍被后续未处理冲突文件 `selection.ts`、`wysiwyg/index.ts`、`wysiwyg/remove.ts`、`wysiwyg/transaction.ts`、`syncGuide.ts`、`newFile.ts`、`iOSPurchase.ts` 的冲突标记截断。
- `pnpm exec eslint src/protyle/util/editorCommonEvent.ts src/protyle/util/dnd/*.ts src/protyle/util/dragTip.ts` 已执行但不能作为当前项通过依据：项目自定义规则对既有拆分目录报目录数量、imports.ts 转发、导入注释和函数拆分等架构问题，共 828 个问题，超出本次单文件冲突处理边界，未据此做批量重构。

### app/src/protyle/util/selection.ts

状态：已处理，等待后续全局验证。

上游 commit：

1. `b22d2d204`：修复 `setInsertWbrHTML()` 在表格单元格内插入 `wbr` 时清空整段 `class` 的问题，改为只移除临时 `range` class，避免合并单元格占位 class 丢失。

处置结果：

- 按一对多映射规程保留本地 `selection.ts` 入口拆分架构，未回填远程单文件中的 `focus/range/position` 实现。
- 将上游唯一实质改动迁移到本地承接模块 `app/src/protyle/util/selection.range.ts::setInsertWbrHTML()`：真实单元格与克隆单元格都改为 `classList.remove("range")`，不再 `removeAttribute("class")`。
- 本地 `selection.focus.ts` 中 `NodeAttributeView` 焦点分支已使用 `isMobile` 运行时判断承接远程条件编译语义，未引入 `/// #if/#else/#endif`。

验证：

- `git log --oneline 2fcc6eeed5f3d583b2665080e69279dbfddb2f80..MERGE_HEAD -- app/src/protyle/util/selection.ts` 确认上游只有 `b22d2d204`。
- `git show b22d2d204 -- app/src/protyle/util/selection.ts` 确认上游最终实质改动为 `cellElement.removeAttribute("class")` / `cloneCellElement.removeAttribute("class")` 改为移除 `range` class。
- `rg -n '[<]{7}|[=]{7}|[>]{7}|///\s*#if|///\s*#else|///\s*#endif' app/src/protyle/util/selection.ts app/src/protyle/util/selection.range.ts app/src/protyle/util/selection.focus.ts app/src/protyle/util/selection.position.ts` 无冲突标记和条件编译。
- `rg -n 'removeAttribute\("class"\)|classList\.remove\("range"\)|setInsertWbrHTML|isMobile|NodeAttributeView' app/src/protyle/util/selection.ts app/src/protyle/util/selection.range.ts app/src/protyle/util/selection.focus.ts` 确认旧清空 class 逻辑无残留，上游修复和运行时移动端判断存在。
- `git diff --check -- app/src/protyle/util/selection.ts app/src/protyle/util/selection.range.ts app/src/protyle/util/selection.focus.ts app/src/protyle/util/selection.position.ts` 通过；仅提示 `selection.range.ts` 工作区 CRLF 将在 Git 触碰时按仓库规则处理。
- `node` + TypeScript `transpileModule` 对 `selection.ts`、`selection.range.ts`、`selection.focus.ts`、`selection.position.ts` 共 4 个文件做语法转译检查，结果 `syntax ok: 4 files`。

### app/src/protyle/wysiwyg/index.ts

状态：已处理，等待后续全局验证。

上游 commit：

1. `9bea5eda1`：多选和框选时跳过超级块 `sb__resize` 手柄，避免装饰节点被选为块。
2. `189d5ae85`、`f0eb468ec`、`85570e25d`：`#9521` 超级块横向布局列宽拖拽持续修正，包含右侧真实块查找、左右块联动、浮点宽度、手柄间距补偿、tips、点击 no-op 和单事务撤销。
3. `7d04032ac`：双击超级块 resize 手柄重置列宽，并修复 diagram 双击预览使用稳定 target 的问题。
4. `a20f27a74` 新增的 `scrollTopBeforeBlur` 在后续 `c49b51b4e` 中被上游删除，最终远程版本不再包含该语义，本次不迁移。
5. `f6b49de9d` 为上游合并提交，对当前文件无额外最终语义。

处置结果：

- 按大重构规程先恢复本地 `index.ts` 拆分骨架，未把远程超级块 resize 内联实现回填到入口文件。
- 将上游 `#9521` 列宽拖拽修复迁移到本地承接模块 `index.mousedown.resize.ts::handleSuperBlockResize()`：右侧目标块跳过装饰元素、同时记录左右块 oldHTML、使用 `getBoundingClientRect()` 浮点宽度、按手柄实际宽度计算 `calc()` 补偿、左右相邻块等量交换宽度、最小宽度保护、百分比提示和份额池、点击未移动不产生事务、最终用单个 `transaction()` 同步提交左右块更新。
- 为保持本地可维护性，将远程内联 resize 大段逻辑拆成 `findNextSuperBlockChild()`、`createSuperBlockResizeContext()`、`updateSuperBlockResizeWidth()`、`finishSuperBlockResize()` 等小函数；拖拽 tips 清理时恢复子块原始 inline `position`，不额外丢失本地样式。
- 将上游跳过 `sb__resize` 的选择修复同时迁移到本地 `index.mousedown.select.ts::handleShiftSelect()` 和 `index.ts` 仍保留的框选/旧选择路径，避免拆分路径与入口残留路径行为不一致。
- 将上游双击 `sb__resize` 重置列宽逻辑保留在 `index.ts` 的 `dblclick` 入口：清空子块 `width` / `flex`，生成 do/undo operations，并用单个 `transaction()` 提交；落地时使用运行时 DOM guard，不引入条件编译。
- 将上游 `#12691` diagram 双击修复迁移到 `index.ts`：复用已校验的 `target` 查找最近块，再调用 `getDiagramBlock()`，避免直接把 `event.target` 强转为块元素。
- 未引入任何 `/// #if/#else/#endif` 条件编译。

验证：

- `git log --oneline --left-right HEAD...MERGE_HEAD -- app/src/protyle/wysiwyg/index.ts` 确认上游相关提交包含 `9bea5eda1`、`a20f27a74`、`189d5ae85`、`7d04032ac`、`c49b51b4e`、`f0eb468ec`、`f6b49de9d`、`85570e25d`。
- `git show :3:app/src/protyle/wysiwyg/index.ts | rg -n -C 8 "sb__resize|issue/12691|previewDocImage|getDiagramBlock|selectElements.push|transaction\(protyle"` 用于对照远程最终语义，确认关键改动均已映射。
- `rg -n '[<]{7}|[=]{7}|[>]{7}|///\s*#(if|else|endif)' app/src/protyle/wysiwyg/index.ts app/src/protyle/wysiwyg/index.mousedown.resize.ts app/src/protyle/wysiwyg/index.mousedown.select.ts` 无冲突标记和条件编译。
- `rg -n 'handleSuperBlockResize|findNextSuperBlockChild|createSuperBlockResizeContext|finishSuperBlockResize|sb__resize-tip|transaction\(protyle|issue/12691|sb__resize' app/src/protyle/wysiwyg/index.ts app/src/protyle/wysiwyg/index.mousedown.resize.ts app/src/protyle/wysiwyg/index.mousedown.select.ts` 确认 resize、选择排除、双击重置和 diagram 修复均在当前实现中。
- `git diff --check -- app/src/protyle/wysiwyg/index.ts app/src/protyle/wysiwyg/index.mousedown.resize.ts app/src/protyle/wysiwyg/index.mousedown.select.ts` 通过；仅提示两个拆分模块工作区 CRLF 将在 Git 触碰时按仓库规则处理。
- `node` + TypeScript `transpileModule` 对 `index.ts`、`index.mousedown.resize.ts`、`index.mousedown.select.ts` 共 3 个文件做语法转译检查，结果 `syntax ok: 3 files`。
- `pnpm exec eslint src/protyle/wysiwyg/index.ts src/protyle/wysiwyg/index.mousedown.resize.ts src/protyle/wysiwyg/index.mousedown.select.ts` 已执行但不能作为当前项通过依据：项目自定义规则仍对既有 `wysiwyg` 目录数量、导入注释、旧入口长回调和未完成的架构拆分报大量问题；本次已将新增 resize 逻辑从长函数拆成小函数，但未按单文件冲突处理去批量重构整个 `wysiwyg` 目录。

### app/src/protyle/wysiwyg/remove.ts

状态：已处理，等待后续全局验证。

上游 commit：

1. `9bea5eda1`、`189d5ae85`、`d396fda66`：`#9521` 超级块 resize 后，删除/合并路径需要跳过 `sb__resize` 装饰节点、使用真实子块计数，并在删除子块后刷新手柄和重平衡宽度。
2. `7a2e16dac`、`1b45d3864`、`24564c673`：`#17892` 删除列表项内容块后，如果列表项只剩子列表，需要补一个空段落以避免非法列表结构。
3. `1fa30d480`：settings UI 合并噪音，对当前文件无最终业务语义需要迁移。

处置结果：

- 按大重构规程保留本地 `remove.ts` 拆分骨架，未把远程内联 `removeLi()` 回填到入口文件；上游 `removeLi()` 改动迁移到本地承接模块 `remove.removeLi.ts`。
- 承接上游超级块前序块修复：删除多选块、折叠标题相邻块、块引用/标注移动、移动端删除前一选择节点、代码块前空块删除和普通合并删除的 undo `previousID` 均改用 `getPreviousBlockSibling()`，避免把 `sb__resize` 当作业务块。
- 承接上游超级块子块计数修复：入口删除分支统一使用 `getSbChildBlockCount()` 判断是否取消超级块，不再使用会把装饰节点计入的旧 `getSbChildCount()`。
- 承接上游超级块宽度修复：多选删除和普通删除在保留超级块时调用 `refreshSbResize()` 与 `rebalanceSbWidth()`，并把剩余子块宽度更新写入 do/undo operations，确保撤销能还原宽度。
- 承接上游 `#17892`：删除列表项内容块后，如果该 `.li` 的首个真实子块变成子列表，则通过 `genEmptyElement()` 插入空段落，并用 `nextID` / `parentID` 写入事务。
- 承接上游 `removeLi()` 同事务修复：`removeLi()`、`topListFirstLineToBlock()` 与 `mergeSuperBlock()` 改为异步；顶级列表首行脱出后使用 `turnsIntoOneTransaction({ getOperations: true })` 获取超级块合并 operations，并入同一个 `transaction()`，避免新超级块 id 在第二个事务中找不到。
- 本地平台逻辑继续使用运行时 `isMobile()` 判断；未引入远程 `/// #if/#else/#endif` 条件编译。

验证：

- `git log --oneline $(git merge-base HEAD MERGE_HEAD)..MERGE_HEAD -- app/src/protyle/wysiwyg/remove.ts` 确认上游相关提交包含 `9bea5eda1`、`189d5ae85`、`d396fda66`、`7a2e16dac`、`1b45d3864`、`24564c673` 和无业务迁移项的 `1fa30d480`。
- `git diff --no-ext-diff :1:app/src/protyle/wysiwyg/remove.ts :3:app/src/protyle/wysiwyg/remove.ts` 用于逐项对照远程最终语义，确认关键改动为 `getPreviousBlockSibling()`、`getSbChildBlockCount()`、`refreshSbResize()` / `rebalanceSbWidth()`、`#17892` 空段落补齐和 `removeLi()` 同事务异步化。
- `rg -n '[<]{7}|[=]{7}|[>]{7}|///\s*#(if|else|endif)|getSbChildCount' app/src/protyle/wysiwyg/remove.ts app/src/protyle/wysiwyg/remove.removeLi.ts` 无冲突标记、条件编译和旧超级块计数残留。
- `rg -n 'previousElementSibling\?\.getAttribute\("data-node-id"\)' app/src/protyle/wysiwyg/remove.ts app/src/protyle/wysiwyg/remove.removeLi.ts` 无上游明确修复的旧撤销定位写法残留。
- `git diff --check -- app/src/protyle/wysiwyg/remove.ts app/src/protyle/wysiwyg/remove.removeLi.ts` 通过；仅提示 `remove.removeLi.ts` 工作区 CRLF 将在 Git 触碰时按仓库规则处理。
- `node` + TypeScript `transpileModule` 对 `remove.ts` 与 `remove.removeLi.ts` 做语法转译检查，结果两个文件均 `ok`。
- `pnpm exec eslint src/protyle/wysiwyg/remove.ts src/protyle/wysiwyg/remove.removeLi.ts` 已执行但不能作为当前项通过依据：项目自定义规则仍报 `wysiwyg` 目录条目超限、import 必须经 `imports.ts` 转发/补合规注释、旧导出函数同步豁免/函数注释和既有嵌套判断等 219 个问题；本次已将新增超级块宽度循环提取为 helper，并修掉新增下标取属性 lint 点，未按单文件冲突处理去批量重构整个 `wysiwyg` 目录。

### app/src/protyle/wysiwyg/transaction.ts

状态：已处理，等待后续全局验证。

上游 commit：

1. `664758b18`：支持跨文档撤销，`unfoldHeading` 的 undo 可携带 `retData` 并应按内核返回 HTML 恢复子块。
2. `9bea5eda1`、`1d9399853`、`1c8983e1f`、`189d5ae85`、`cf64cd26c`：`#9521` 超级块相关修复，涉及 `sb__resize` 手柄刷新、真实子块计数、横向超级块宽度迁移和折叠/删除/插入后的手柄重建。
3. `77be02ead`：`#17893` 列表和超级块拖拽体验修复，移动后刷新源/目标超级块并避免本地已插入块被重复插入。
4. `edae3e9d3`：上游合并提交，对当前文件无额外最终语义。

处置结果：

- 按一对多映射规程保留本地 `transaction.ts` 拆分骨架，先恢复本地入口文件，未把远程大文件回填到入口。
- 新增 `app/src/protyle/wysiwyg/transaction.refreshSbs.ts` 作为事务共享 helper，集中去重刷新一组元素所在超级块的 `sb__resize` 手柄；因 `wysiwyg` 当前没有同层 `imports.ts`，该 helper 仍直接依赖现有 `refreshSbResize()`，后续目录级重构时可一并收敛。
- 将上游延迟嵌入块渲染迁移到 `transaction.promise.ts`：delete/append/move 命中的 `NodeBlockQueryEmbed` 先进入 `pendingEmbedElements`，事务回调末尾再移除 `data-render` 并 `blockRender()`，避免渲染请求早于事务 DOM 批处理。
- 将上游移动路径修复迁移到 `transaction.promise.ts` 与 `transaction.onTransaction.move.ts`：移动前记录源超级块，移动后刷新源超级块和当前 `id/parentID/previousID` 所在超级块；撤销移动也同步更新嵌入块，不再只处理非 undo。
- 将上游重复插入保护迁移到 `transaction.promise.ts`：如果本地 DOM 已有 `operation.id`，跳过再次插入但仍刷新所在超级块，避免 issue `#17890`。
- 将上游跨文档撤销修复迁移到 `transaction.onTransaction.ts`：`unfoldHeading` undo 若带 `retData`，先 `removeUnfoldRepeatBlock()` 再插入 `retData`，不再假定 undo 没有返回内容。
- 将上游超级块刷新迁移到 `transaction.onTransaction.ts`、`transaction.onTransaction.insert.ts` 和 `transaction.fold.ts`：delete/update/insert/fold/unfold 后刷新相关超级块手柄，避免子块数量变化后手柄残留或缺失。
- 将上游 `BlocksMergeSuperBlock` 宽度迁移和旧计数替换迁移到 `transaction.turns.ts`：新超级块继承第一个子块的 `width/flex` 并清空子块宽度，取消超级块判断改用 `getSbChildBlockCount()`，同时在块转换后刷新父/自身超级块。
- 未引入远程 `/// #if/#else/#endif` 条件编译；移动端同步按钮继续使用本地 `isMobile` 运行时判断。

验证：

- `git log --oneline $(git merge-base HEAD MERGE_HEAD)..MERGE_HEAD -- app/src/protyle/wysiwyg/transaction.ts` 确认上游相关提交包含 `664758b18`、`9bea5eda1`、`1d9399853`、`1c8983e1f`、`189d5ae85`、`77be02ead`、`cf64cd26c` 和 `edae3e9d3`。
- `rg -n -g 'transaction*.ts' '[<]{7}|[=]{7}|[>]{7}|///\s*#(if|else|endif)|getSbChildCount' app/src/protyle/wysiwyg` 无冲突标记、条件编译和旧超级块计数残留。
- `rg -n -g 'transaction*.ts' 'refreshSbs|pendingEmbedElements|pushPendingEmbedElement|originSbs|getSbChildBlockCount|BlocksMergeSuperBlock' app/src/protyle/wysiwyg` 确认上游关键改进已落在本地拆分模块。
- `git diff --check -- app/src/protyle/wysiwyg/transaction.ts app/src/protyle/wysiwyg/transaction.fold.ts app/src/protyle/wysiwyg/transaction.onTransaction.ts app/src/protyle/wysiwyg/transaction.onTransaction.move.ts app/src/protyle/wysiwyg/transaction.onTransaction.insert.ts app/src/protyle/wysiwyg/transaction.promise.ts app/src/protyle/wysiwyg/transaction.turns.ts app/src/protyle/wysiwyg/transaction.refreshSbs.ts` 通过；仅提示相关工作区文件 CRLF 将在 Git 触碰时按仓库规则处理。
- `node` + TypeScript `transpileModule` 对 `transaction.ts`、`transaction.promise.ts`、`transaction.onTransaction.ts`、`transaction.onTransaction.move.ts`、`transaction.onTransaction.insert.ts`、`transaction.fold.ts`、`transaction.turns.ts` 和 `transaction.refreshSbs.ts` 共 8 个文件做语法转译检查，结果 `transaction files transpile ok`。
- `pnpm exec eslint src/protyle/wysiwyg/transaction.ts src/protyle/wysiwyg/transaction.promise.ts src/protyle/wysiwyg/transaction.onTransaction.ts src/protyle/wysiwyg/transaction.onTransaction.move.ts src/protyle/wysiwyg/transaction.onTransaction.insert.ts src/protyle/wysiwyg/transaction.fold.ts src/protyle/wysiwyg/transaction.turns.ts src/protyle/wysiwyg/transaction.refreshSbs.ts` 已执行但不能作为当前项通过依据：项目自定义规则仍对既有 `wysiwyg` 目录条目超限、父级导入必须经同层 `imports.ts`、导入/导出注释、旧长函数、旧 forEach 和旧 if 注释等报 729 个问题；新 helper 已补导入/导出/同步 DOM 豁免/if 注释，单独 lint 后仅剩目录超限和缺少同层 `imports.ts` 转发两项目录级问题，未按单文件冲突处理去批量重构整个 `wysiwyg` 目录。

### app/src/sync/syncGuide.ts

状态：已处理，等待后续全局验证。

上游 commit：

1. `1fa30d480`：引入新 settings UI，同步引导从手动点击旧设置页切换到 `openSetting(app, "sync")`。
2. `b7d08329a`：改进同步云目录列表渲染，`getSyncCloudList` 改为 `renderSyncCloudList`，列表渲染前显示 loading，并用 `syncListParts` 组装 HTML。
3. `4f1c9506e`：继续改进设置 UI 与同步引导文案、按钮 disabled 逻辑和确认密码勾选控件。

处置结果：

- 保留本地封装导入：`isPaidUser/needSubscribe` 继续来自 `../util/platform/needSubscribe`，`fetchPost` 继续来自 `../util/network/fetch`，`isMobile` 继续来自 `../util/platform/functions`，国际化继续使用 `siyuanI18n`，未退回远程 `window.siyuan.languages`。
- 将上游 `getSyncCloudList` 重命名与语义迁移为 `renderSyncCloudList(cloudListElement, reload, cb)`，新增列表渲染前 loading，创建、删除、选择云目录后都回调新函数，修复冲突中本地误用的 `cloudPanelElement` 未定义问题。
- 将上游 `syncListParts` 渲染方式迁入本地实现，错误分支保留 `siyuanI18n.cloudConfigTip`，非错误分支最终 `join("")`，回调用 `cb?.()`，避免旧字符串累加与新数组拼接混用。
- 将远程 `/// #if MOBILE/#else/#endif` 全部改为运行时 `platform === "browser-mobile"` / `platform !== "browser-mobile"` 判断，保留移动端 meta 间距改进和桌面窄行列表布局，未引入任何条件编译。
- 将上游新增云目录按钮语义迁入：仅在 provider 非 2/3 时追加按钮，按钮位于左侧，并使用 `siyuanI18n.addAttr`。
- 将上游新设置入口迁入 `syncGuide(app?)`：订阅不足或非付费时若存在 `app` 则打开 `openSetting(app, "sync")`，订阅不足提示用 `siyuanI18n._kernel[29]`，非付费提示用 `siyuanI18n._kernel[214]`；本地 `needSubscribe("")` 仅做判断，避免封装函数和显式提示重复弹消息。
- 将上游 `setSync()` 按钮逻辑迁入：HTML 使用 boolean `disabled`，新增 `updateOpenSyncBtn` 通过 `btnElement.disabled = !contentElement.querySelector("input[checked]")` 切换状态，并调用 `renderSyncCloudList(...)`。
- 保留本地 `setKey()` 最终形态：确认密码勾选框继续使用 `id="confirmPassword"`，没有回退到旧 `b3-switch` 选择器。

验证：

- `git log --oneline $(git merge-base HEAD MERGE_HEAD)..MERGE_HEAD -- app/src/sync/syncGuide.ts` 确认上游相关提交为 `1fa30d480`、`b7d08329a`、`4f1c9506e`。
- `rg -n '[<]{7}|[=]{7}|[>]{7}|///\s*#(if|else|endif)|window\.siyuan\.languages|getSyncCloudList|cloudPanelElement|syncListHTML \+=' app/src/sync/syncGuide.ts` 无冲突标记、条件编译、旧 i18n、旧函数名、旧变量名和旧字符串累加残留。
- `rg -n 'renderSyncCloudList|syncListParts|platform === "browser-mobile"|platform !== "browser-mobile"|openSetting\(app, "sync"\)|needSubscribe\(""\)|btnElement\.disabled|confirmPassword' app/src/sync/syncGuide.ts` 确认上游关键改进均已落到本地实现。
- `git diff --check -- app/src/sync/syncGuide.ts` 通过。
- `node` + TypeScript `transpileModule` 对 `syncGuide.ts` 做语法转译检查，结果 `syncGuide.ts transpile ok`。
- `pnpm exec eslint src/sync/syncGuide.ts` 已执行但不能作为当前项通过依据：项目自定义规则对该既有文件报 127 个问题，主要是缺同层 `imports.ts` 转发、导入注释、导出函数异步豁免/函数注释、文件超过 300 行、旧内联回调和旧直接访问 `window` 等目录级/历史问题；本次未按单文件冲突处理去批量重构整个 `sync` 模块。

### app/src/util/file/newFile.ts

状态：已处理，等待后续全局验证。

上游 commit：

1. `d840b44d7`：`#17895` 空标题文档边界修复，创建文档时使用 `_kernel[16]` 作为路径占位名，并通过 `titleEmpty` 告诉内核真实标题为空。

处置结果：

- 保留本地文件移动与封装路径：当前承接文件为 `app/src/util/file/newFile.ts`，没有恢复远程旧路径 `app/src/util/newFile.ts`；本地已拆出的 `app/src/util/file/getSavePath.ts` 已覆盖远程同名函数，未重复塞回 `newFile.ts`。
- 保留本地运行时移动端判断：继续使用 `isMobile` 分支打开桌面/移动文档，未引入远程 `/// #if !MOBILE/#else/#endif` 条件编译。
- 将上游 `docName` 与 `titleEmpty` 语义迁入本地：`docName` 使用本地 `siyuanI18n._kernel[16]`，`titleEmpty = !optios.name`，三处 `createDocWithMd` 均传入 `titleEmpty`。
- 按上游空标题语义移除本地强制 `siyuanI18n.untitled` 兜底：`newFileByName()` 传入 `replaceFileName(value.trim())`，允许空标题通过 `titleEmpty` 标记进入内核。
- 将 `newFileBySelect()` 迁移为“路径占位 + 空标题标记”：`newFileName` 不再强制兜底，`hPath` 使用 `newFileName || siyuanI18n._kernel[16]`，创建时传 `titleEmpty: newFileName === ""`。
- 国际化继续走本地 `siyuanI18n`，未退回远程 `window.siyuan.languages`。

验证：

- `git log --oneline $(git merge-base HEAD MERGE_HEAD)..MERGE_HEAD -- app/src/util/newFile.ts app/src/util/file/newFile.ts` 确认上游只有 `d840b44d7`。
- `rg -n '[<]{7}|[=]{7}|[>]{7}|///\s*#(if|else|endif)|window\.siyuan\.languages|siyuanI18n\.untitled|app/src/util/newFile.ts' app/src/util/file/newFile.ts` 无冲突标记、条件编译、远程旧 i18n、强制 untitled 兜底和旧路径标记残留。
- `rg -n 'docName|titleEmpty|newFileName \|\||siyuanI18n\._kernel\[16\]|name: replaceFileName\(value\.trim\(\)\)' app/src/util/file/newFile.ts` 确认上游空标题改进均已包含。
- `git diff --check -- app/src/util/file/newFile.ts` 通过。
- `node` + TypeScript `transpileModule` 对 `newFile.ts` 做语法转译检查，结果 `newFile.ts transpile ok`。
- `pnpm exec eslint src/util/file/newFile.ts` 已执行但不能作为当前项通过依据：项目自定义规则对该既有文件报 95 个问题，主要是 `util/file` 目录条目超限、父级导入需经同层 `imports.ts` 转发、导入/导出/函数注释、旧内联回调、旧嵌套 if 和旧直接访问 `window` 等目录级/历史问题；本次未按单文件冲突处理去批量重构整个 `util/file` 模块。

### app/src/util/platform/iOSPurchase.ts

状态：已处理，等待后续全局验证。

上游 commit：

1. `1fa30d480`：新 settings UI 后，iOS 购买成功回调的桌面刷新按钮选择器从旧账号 tab 容器更新为 `#configAccountMain #refresh`。

处置结果：

- 保留本地文件移动与封装导入：当前承接文件为 `app/src/util/platform/iOSPurchase.ts`，没有恢复远程旧路径 `app/src/util/iOSPurchase.ts`。
- 保留本地运行时 `isMobile` 分支：移动端继续触发 `#modelMain` 刷新，桌面端改为上游新设置 UI 的 `document.querySelector("#configAccountMain #refresh")?.dispatchEvent(new Event("click"))`。
- 未引入远程 `/// #if MOBILE/#else/#endif` 条件编译。

验证：

- `git log --oneline $(git merge-base HEAD MERGE_HEAD)..MERGE_HEAD -- app/src/util/iOSPurchase.ts app/src/util/platform/iOSPurchase.ts` 确认上游只有 `1fa30d480`。
- `rg -n '[<]{7}|[=]{7}|[>]{7}|///\s*#(if|else|endif)|config__tab-container\[data-name="account"\]' app/src/util/platform/iOSPurchase.ts` 无冲突标记、条件编译和旧 settings 账号 tab selector 残留。
- `rg -n 'isMobile|configAccountMain|processIOSPurchaseResponse' app/src/util/platform/iOSPurchase.ts` 确认本地运行时判断和上游新 selector 均存在。
- `git diff --check -- app/src/util/platform/iOSPurchase.ts` 通过。
- `node` + TypeScript `transpileModule` 对 `iOSPurchase.ts` 做语法转译检查，结果 `iOSPurchase.ts transpile ok`。
- `pnpm exec eslint src/util/platform/iOSPurchase.ts` 已执行但不能作为当前项通过依据：项目自定义规则对该既有文件报 45 个问题，主要是父级导入需经同层 `imports.ts` 转发、导入/导出/函数注释、旧 switch/else/嵌套 if、旧直接访问 `window` 和旧 DOM 链式调用等历史问题；本次未按单文件冲突处理去批量重构整个 `util/platform` 模块。

### app/src/window/index.ts

状态：已处理，等待后续全局验证。

上游 commit：

1. `1fa30d480`：新 settings UI 将窗口入口的外观配置刷新从旧 `updateAppearance(data.data)` 迁移为 `appearanceConfigApi.apply(data.data)`。

处置结果：

- 保留本地窗口入口骨架：`fetchGet/fetchPost`、`genUUID`、`pathName`、`openFileById`、`setBodyHighlight`、`reloadSync` 和 `setRefDynamicText` 继续走本地重构后的封装路径，未回退到远程旧路径。
- 保留本地 S-Forge 初始化链路：`setProcessMessageUIDependencies`、`createProcessMessage`、`setSForgeState(SForgeSymbols.MODEL_HANDLERS, ...)`、Forge i18n、`initSForge`、智能工具箱和 MAGI 状态栏按钮初始化均保留。
- 将上游新 settings UI 改进迁入本地：导入 `appearanceConfigApi`，`case "setAppearance"` 使用 `appearanceConfigApi.apply(data.data)`，并移除对已删除 `../config/util/updateAppearance` 的依赖。
- 未引入远程 `/// #if/#else/#endif` 条件编译。

验证：

- `git log --oneline $(git merge-base HEAD MERGE_HEAD)..MERGE_HEAD -- app/src/window/index.ts` 确认上游只有 `1fa30d480`，该文件最终补丁为 `updateAppearance` 到 `appearanceConfigApi` 的 2 处替换。
- `rg -n '[<]{7}|[=]{7}|[>]{7}|///\s*#(if|else|endif)|updateAppearance' app/src/window/index.ts` 无冲突标记、条件编译和旧外观刷新 API 残留。
- `rg -n 'appearanceConfigApi|setProcessMessageUIDependencies|setSForgeState|SForgeSymbols|setRefDynamicText|reloadSync|setBodyHighlight' app/src/window/index.ts app/src/index.ts` 确认窗口入口与主入口同样使用上游新外观 API，同时保留本地 S-Forge/processMessage 架构。
- `git diff --check -- app/src/window/index.ts` 通过。
- `node` + TypeScript `transpileModule` 对 `window/index.ts` 做语法转译检查，结果 `window/index.ts transpile ok`。
- `pnpm exec eslint src/window/index.ts` 已执行但不能作为当前项通过依据：项目自定义规则对该既有文件报 114 个问题，主要是 import 合规注释、父级导入需经同层 `imports.ts` 转发、旧长内联回调、旧嵌套 if、旧直接访问 `window` 和旧类型断言等目录级/历史问题；本次未按单文件冲突处理去批量重构整个 `window` 入口。

### app/src/window/init.ts

状态：已处理，等待后续全局验证。

上游 commit：

1. `1fa30d480`：新 settings UI 将窗口初始化时的外观配置应用从旧 `appearance.onSetAppearance(...)` 迁移为 `appearanceConfigApi.apply(...)`。

处置结果：

- 保留本地窗口初始化重构骨架：Electron 调用继续使用 `ipcSend` / `setZoomFactor` 封装，配置和计时器继续使用 `getSiyuanConfig` / `getSiyuanStorage` / `windowTimer.environment` 封装，未回退到远程直接 `electron` 和直接 `window.siyuan` 访问。
- 保留本地类型守卫和布局拆分：`isEmojiArray`、`isTab`、`handleEmojiConfResponse`、`handleWindowResize` 和 `afterLayout` 均保持本地结构。
- 将上游新 settings UI 改进迁入本地：导入 `appearanceConfigApi`，初始化时调用 `appearanceConfigApi.apply(getSiyuanConfig().appearance)`，并移除旧 `appearance.onSetAppearance(getSiyuanConfig().appearance)`。
- 将远程 `/// #if !BROWSER` 保持为本地运行时判断：仅 `isElectron` 为真时调用 `initNativeDialogOverride()`，未引入任何条件编译。

验证：

- `git log --oneline $(git merge-base HEAD MERGE_HEAD)..MERGE_HEAD -- app/src/window/init.ts` 确认上游只有 `1fa30d480`，该文件最终补丁为 `appearance` 到 `appearanceConfigApi` 的 2 处替换。
- `rg -n '[<]{7}|[=]{7}|[>]{7}|///\s*#(if|else|endif)|appearance\.onSetAppearance|from "electron"|window\.siyuan\.config\.appearance' app/src/window/init.ts` 无冲突标记、条件编译、旧外观初始化 API、远程直接 Electron 导入和远程直接配置读取残留。
- `rg -n 'appearanceConfigApi|isElectron|initNativeDialogOverride|getSiyuanConfig\(\)\.appearance|ipcSend|setZoomFactor|setSiyuanLayoutCenterLayout' app/src/window/init.ts` 确认上游新外观 API 与本地封装路径均已保留。
- `git diff --check -- app/src/window/init.ts` 通过。
- `node` + TypeScript `transpileModule` 对 `window/init.ts` 做语法转译检查，结果 `window/init.ts transpile ok`。
- `pnpm exec eslint src/window/init.ts` 已执行但不能作为当前项通过依据：项目自定义规则对该既有文件报 52 个问题，主要是 import 合规注释、父级导入需经同层 `imports.ts` 转发、旧直接访问 `window`、旧 `.forEach()`、旧 timeout 注释和既有 if 注释等历史问题；本次未按单文件冲突处理去批量重构整个 `window` 初始化入口。

### kernel/conf/ai.go

状态：已处理，等待后续全局 Go 验证。

上游 commit：

1. `43b191af7`：改进 AI 配置归一化，新增 `defaultAgent()` / `defaultEditing()`，Provider/Model 归一化会裁剪空白、填默认 BaseURL/RequestTimeout/Model name、过滤 nil，并对 Editing 参数做边界限制。

处置结果：

- 保留本地 OpenAI 兼容层：`AI.OpenAI`、`OpenAI` 结构、`defaultOpenAI()`、`normalizeOpenAI()`、`migrateOpenAI()`、OpenAI API key 加解密以及 MAGI 睡眠时间字段均未丢失。
- 将上游新增默认值函数迁入本地：`defaultAgent()` 和 `defaultEditing()` 与 `defaultOpenAI()` 并列存在，`NewAI()` 使用这两个函数初始化 Agent/Editing，避免默认值散落在结构字面量里。
- 保留上游 Normalize 改进：Agent/Editing nil 时补默认值，Editing 的 `MaxCompletionTokens`、`Temperature`、`MaxHistoryMessages` 进入合法范围，Provider/Model 过滤 nil 并裁剪 `BaseURL`、`DisplayName`、`APIKey`、`Name`，补默认 BaseURL、RequestTimeout、Model name 和节点 ID。
- 保留本地迁移严格触发条件：`NeedsAIMigration()` 仍要求旧 `openAI` 存在且 `providers/agent/editing/embedding` 不存在，避免对已经迁移过的新配置重复迁移。

验证：

- `git log --oneline $(git merge-base HEAD MERGE_HEAD)..MERGE_HEAD -- kernel/conf/ai.go` 确认上游只有 `43b191af7`。
- `rg -n '[<]{7}|[=]{7}|[>]{7}' kernel/conf/ai.go` 无冲突标记残留。
- `rg -n 'func defaultOpenAI|func defaultAgent|func defaultEditing|normalizeOpenAI|strings\.TrimSpace|MaxCompletionTokens|MaxHistoryMessages|RequestTimeout|magiSleep|OpenAI' kernel/conf/ai.go` 确认本地兼容层与上游 Normalize 改进均存在。
- `git diff --check -- kernel/conf/ai.go` 通过。
- `go test ./conf` 已在 `kernel/go.sum` 解决后回跑，但暂不能作为通过依据：当前 `kernel/go.mod` 保留本地 `replace github.com/88250/lute => github.com/leolee9086/lute v0.0.0-20260429173809-0837d6611351`，该替换后的 Lute 缺少 `SetEnsureListItemParagraph`，导致 `kernel/util/lute.go` 编译失败；未擅自删除本地 replace。

### kernel/go.sum

状态：已处理，等待后续全局 Go 验证。

上游 commit：

1. `910e99452` / `156f9e856`：更新 `github.com/88250/lute` 到 `v1.7.7-0.20260621064642-fd13242ab8be`，对应 go.sum 已在当前状态中包含。
2. `d98767f7a`：AI Agent 引入 `github.com/pkoukk/tiktoken-go-loader v0.0.2`，go.sum 新增该模块两条校验和。

处置结果：

- 保留本地已合入的 `github.com/pkoukk/tiktoken-go v0.1.8` 校验和。
- 迁入上游 `github.com/pkoukk/tiktoken-go-loader v0.0.2` 和 `/go.mod` 两条校验和；该依赖已在当前 `kernel/go.mod` 中存在，不能丢失。
- 未运行 `go mod tidy` 重写整个锁文件，避免在未完成后端冲突前引入大范围锁文件扰动。

验证：

- `rg -n '[<]{7}|[=]{7}|[>]{7}' kernel/go.sum` 无冲突标记残留。
- `rg -n 'github.com/pkoukk/tiktoken-go-loader v0\.0\.2' kernel/go.mod kernel/go.sum` 确认 go.mod 和 go.sum 均包含 loader 依赖。
- `git diff --check -- kernel/go.sum` 通过；仅提示工作区 LF 后续会按 Git 设置转 CRLF。
- `go list -m github.com/pkoukk/tiktoken-go-loader` 和 `go mod verify` 已执行但不能作为通过依据：当前访问 `proxy.golang.org` 拉取 `github.com/pkoukk/tiktoken-go-loader@v0.0.2` 超时。
- `go test ./conf` 已回跑，当前失败原因变为本地 Lute replace 的接口差异：`util/lute.go:88:6: ret.SetEnsureListItemParagraph undefined`，与 go.sum 冲突文本无关。

### kernel/model/transaction.go

状态：已处理，等待后续全局 Go 验证。

上游 commit：

1. `8dc2619d1`：改进列表和超级块拖拽体验，删除操作中 `doDelete0` 找不到节点时提前返回，避免后续继续清理/写树导致状态异常。

处置结果：

- 保留本地全局撤销与事务错误能力：`PerformTxSync`、`TxErr.Error/Code`、`fromAPI/isReplay`、`GlobalUndoLog.Record(tx)`、`GetMutatedRootIDs()` 等本地功能未被回退。
- 保留本地容器块索引清理改进：删除节点后继续使用 `deletedBlockIDs(deletedNode)`，只收集真实块节点 ID，避免 `BlockIDs()` 把非块 IAL 等节点纳入清理范围。
- 迁入上游拖拽/删除稳定性改进：`doDelete0` 返回 `nil` 时立即 `return`，不再调用 `RemoveBlockTreesByIDs` 或 `writeTree`。
- `gofmt` 同步规范了同文件中 `duplicateAttrViewView` / `duplicateAttrViewRow` 两个 `case` 的缩进层级；只调整格式，不改变分支归属。
- 未引入任何 `/// #if/#else/#endif` 条件编译。

验证：

- `git log --oneline $(git merge-base HEAD MERGE_HEAD)..MERGE_HEAD -- kernel/model/transaction.go` 确认上游只有 `8dc2619d1`。
- `git show 8dc2619d1 -- kernel/model/transaction.go` 确认上游实质改进为 `doDelete0` 空节点提前返回。
- `rg -n '[<]{7}|[=]{7}|[>]{7}' kernel/model/transaction.go` 无冲突标记残留。
- `git diff --check -- kernel/model/transaction.go` 通过。
- `go test ./model` 已执行但暂不能作为通过依据：当前 `kernel/go.mod` 保留本地 `replace github.com/88250/lute => github.com/leolee9086/lute v0.0.0-20260429173809-0837d6611351`，该替换后的 Lute 缺少 `SetEnsureListItemParagraph`，导致 `kernel/util/lute.go` 编译失败；未擅自删除本地 replace。

### 冲突标记收口

状态：已处理，等待最终提交前复核。

处置结果：

- `git diff --name-only --diff-filter=U` 和 `git ls-files -u` 均无输出，确认当前索引中没有未解决冲突文件。
- 精确扫描真实冲突标记时发现 `app/src/block/popover.ts.merge-conflict-backup` 是已跟踪的旧合并备份文件，内容仍包含 `HEAD` / 分隔 / 远程提交标记；该文件无运行时引用，且 `app/src/block/popover.ts` 已是当前源码承接文件。
- 按规程清理该遗留备份文件，避免后续冲突标记验收被旧备份误伤；未改动 `app/src/block/popover.ts` 的已解决功能代码。

验证：

- `rg -n '^([<]{7} .+|[=]{7}$|[>]{7} .+)' app/src kernel docs` 复扫用于确认真实冲突标记已清理。

### 前端构建错误收口

状态：已处理，等待开发者回跑实际 dev 构建。

处置结果：

- 修复 `app/src/protyle/render/av/calc.ts` 的旧 `../../../util/escape` 导入，并逐个同步清理当前仓库中仍指向 `util/escape` 的导入：`app/src/boot/globalEvent/keydown.ts`、`app/src/config/render/render.ts`、`app/src/config/tabs/accountUi.ts`、`app/src/config/tabs/appearanceTab.ts`、`app/src/protyle/render/av/calc.ts` 均改为真实实现 `util/DOM/escape`，避免构建走到其它入口时再次触发同类 `Can't resolve`。
- 修复 `app/src/protyle/wysiwyg/keydown.ts` 中 `attrMiddleware` 后缺失的中止返回结构，删除合并残留的旧“新建命名文件”内联块，避免文件尾部 `});` 被 esbuild 误报 `Unexpected ")"`。
- 删除 `keydown.ts` 中已由 `arrowUpDownMiddleware`、`expandSelectMiddleware`、`superBlockSelectMiddleware` 承接的旧内联选择逻辑，并同步移除对应未使用导入；保留尚未迁出的 `foldRecursive` 逻辑，避免功能丢失。
- 将代码块创建入口接回 `handleCodeBlockCreation` 中间件，并让该中间件继续使用原 `highlightRender` 路径，避免主流程和中间件行为不一致。
- 将上游 `protyle.toolbar.range = range` 修复迁入 `keydown.createNewFile.ts` 的 `createNamedNewFileMiddleware`，避免删除旧内联块时丢失 `https://github.com/siyuan-note/siyuan/issues/17896` 的修复。
- 未引入任何 `/// #if/#else/#endif` 条件编译。

验证：

- `rg -n 'util/escape' app/src -g '*.ts'` 无输出，确认当前源码不再引用旧 `util/escape` 路径。
- `rg -n '^([<]{7} .+|[=]{7}$|[>]{7} .+)' app/src/boot/globalEvent/keydown.ts app/src/config/render/render.ts app/src/config/tabs/accountUi.ts app/src/config/tabs/appearanceTab.ts app/src/protyle/render/av/calc.ts app/src/protyle/wysiwyg/keydown.ts app/src/protyle/wysiwyg/keydown.codeBlock.ts app/src/protyle/wysiwyg/keydown.createNewFile.ts` 无输出。
- `node -e "const fs=require('fs'); const esbuild=require('./node_modules/.pnpm/esbuild@0.19.12/node_modules/esbuild'); for (const file of ['src/protyle/wysiwyg/keydown.ts','src/protyle/wysiwyg/keydown.codeBlock.ts','src/protyle/wysiwyg/keydown.createNewFile.ts','src/protyle/render/av/calc.ts','src/boot/globalEvent/keydown.ts','src/config/render/render.ts','src/config/tabs/accountUi.ts','src/config/tabs/appearanceTab.ts']) { const code=fs.readFileSync(file,'utf8'); esbuild.transformSync(code,{loader:'ts',format:'esm'}); console.log(file+' ok'); }"` 在 `app` 目录通过。
- `git diff --check -- app/src/boot/globalEvent/keydown.ts app/src/config/render/render.ts app/src/config/tabs/accountUi.ts app/src/config/tabs/appearanceTab.ts app/src/protyle/render/av/calc.ts app/src/protyle/wysiwyg/keydown.ts app/src/protyle/wysiwyg/keydown.codeBlock.ts app/src/protyle/wysiwyg/keydown.createNewFile.ts` 通过；仅提示 `keydown.codeBlock.ts` / `keydown.createNewFile.ts` 后续 Git 触碰时会按设置处理 CRLF/LF。
- `pnpm run lint` 已执行但不能作为通过依据：当前仓库存在大量既有 lint 问题，首先命中 `benchmark_vector_api.js`、`electron/main.js`、`src/ai/*` 等文件的全局/目录/导入注释规则；未运行 `pnpm build` 或 webpack，避免干扰开发者正在运行的 dev 构建。

### 前端 import 导出与模块路径继续收口

状态：已处理，等待开发者回跑实际 dev 构建。

处置结果：

- 修复 `app/src/boot/globalEvent/keydown.ts` 中 `openFileById` 和 `bindMenuKeydown` 的旧聚合模块导入：分别改为真实导出 `editor/utils.openFileById` 与 `menus/Menu.bindMenuKeydown`，消除 webpack `export ... was not found` warning。
- 同步处理同类 `openFileById` 旧导入残留：`app/src/block/Panel.ts`、`app/src/layout/dock/Outline.ts` 均改为真实导出 `editor/utils.openFileById`，避免后续入口触发同样 warning。
- 修复迁移后仍指向旧 util 路径的导入：`Panel.ts` 的 `genID` / `noRelyPCFunction` 指向 `util/platform`，`Outline.ts` 的 `Tree` 指向 `util/file/Tree`，`workspace.remote.ts` 的 `mount` / `upDownHint` 指向真实位置。
- 修复 `app/src/config/tabs/syncUi.ts` 的 `needSubscribe` 路径、`app/src/protyle/util/insertHTML.ts` 的 `updateListOrder` 导入来源，直接依赖真实实现文件，未通过新增兼容转发掩盖问题。
- 修复网络类型旧文件名残留：`Cronjob.ts`、`cronjob.util.ts`、`mockWise.ts`、`request.types.ts`、`assets.ts` 等改为从 `util/network/types.ts` 进行 type-only 导入；`protyle.asset.guard.ts` 的 `assetItem` 改为从真实 `protyle.types.ts` 导入。
- 删除 `buildGutterTableMenu.ts` 对不存在的 `../protyle` 的 `IProtyle` 导入，继续使用全局 `IProtyle` 类型声明，不引入运行时循环。
- 未引入任何 `/// #if/#else/#endif` 条件编译。

验证：

- 过滤备份目录和 `.backup.ts` 后的相对 import 解析扫描无输出，未发现新的明显 `Can't resolve` 候选。
- `node -e "const fs=require('fs'); const esbuild=require('./node_modules/.pnpm/esbuild@0.19.12/node_modules/esbuild'); const files=['src/boot/globalEvent/keydown.ts','src/block/Panel.ts','src/layout/dock/Outline.ts','src/layout/dock/Cronjob.ts','src/layout/dock/cronjob.util.ts','src/magi/core/wise/mockWise.ts','src/magi/types/request.types.ts','src/menus/protyleMenus/assetMenu/protyle.asset.guard.ts','src/util/assets/assets.ts','src/protyle/gutter/buildGutterTableMenu.ts','src/config/tabs/syncUi.ts','src/protyle/util/insertHTML.ts','src/menus/workspace.remote.ts']; for (const file of files) { const code=fs.readFileSync(file,'utf8'); esbuild.transformSync(code,{loader:'ts',format:'esm'}); console.log(file+' ok'); }"` 在 `app` 目录通过。
- `git diff --check -- app/src/boot/globalEvent/keydown.ts app/src/block/Panel.ts app/src/layout/dock/Outline.ts app/src/layout/dock/Cronjob.ts app/src/layout/dock/cronjob.util.ts app/src/magi/core/wise/mockWise.ts app/src/magi/types/request.types.ts app/src/menus/protyleMenus/assetMenu/protyle.asset.guard.ts app/src/util/assets/assets.ts app/src/protyle/gutter/buildGutterTableMenu.ts app/src/config/tabs/syncUi.ts app/src/protyle/util/insertHTML.ts app/src/menus/workspace.remote.ts` 通过；仅提示部分已触碰文件后续 Git 会按设置处理 CRLF/LF。
- `pnpm run lint:file -- src/boot/globalEvent/keydown.ts --json`、`pnpm run lint:file -- src/protyle/util/insertHTML.ts --json`、`pnpm run lint:file -- src/layout/dock/Cronjob.ts --json` 已执行但不能作为通过依据：分别命中 737 / 252 / 39 个既有架构 lint 问题，主要是导入注释、父级导入、目录数量、直接访问 window、旧 if/forEach 规则等；本次未运行会全仓 `--fix` 的 `pnpm run lint`，避免改动无关文件。
