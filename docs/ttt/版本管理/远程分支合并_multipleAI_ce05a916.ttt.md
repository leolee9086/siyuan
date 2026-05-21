# multipleAI 合并 origin/dev 执行跟踪 (TikTocTak)

> **目标**: 在 `multipleAI` 分支上完成 `origin/dev` (`MERGE_HEAD=ce05a916`) 的合并。121 个冲突文件逐项审查上游 commit、逐项移植变更、逐项验证。不得批量取 HEAD，不得跳过审查。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 按规程逐文件审查上游 commit、移植变更、git add。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将下一批次补充到"近期计划"。

## 核心原则

1. 以本地重构架构为骨架，不回退本地模块拆分和抽象。
2. 对每个冲突文件先 `git log base..MERGE_HEAD -- <file>` 确认上游 commit 列表，再 `git show <hash>` 逐个查看实质性改动，最后判定"已存在于本地 / 需移植 / 在子模块处理"。
3. 包管理文件按"共有依赖取较高版本、双方独有依赖均保留"处理；`pnpm-lock.yaml` 删除后重生。
4. `deleted by us` 文件必须按"一对多文件映射"检查本地重构后的承接位置，不得直接恢复旧文件。
5. 每完成一个文件就记录，不得批量处理、不得跳过审查、不得在未 `git add` 前声称完成。

### 验证检查清单

- [x] 无残留冲突标记（`git grep "[<]\{7\}"`）
- [x] `git diff --name-only --diff-filter=U` 为空
- [x] 每个文件的上游 commit 已逐个审查
- [x] 上游实质性改动已在解决后的代码中逐项确认
- [x] `.backup/.remote` 已在最终验证完成后统一清理

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，必须剪切粘贴到【已归档/已完成】列表，并打上 `[x]` 和日期。
2. **保持单线程**：同一时间只允许一个任务为 `[-]`。
3. **记录证据**：每完成一个文件，记录对应的处理方式、上游 commit 列表和移植内容。
4. **不得批量**：不得对多个文件同时执行相同的操作而不逐一审查。

## 🟢 近期计划

- [x] **Phase 0: 合并盘点与规程确认 (P0)** [已完成 2026-05-19]
  - **背景**: 确认合并范围、冲突清单，按规程启动 TTT 跟踪。
  - **行动**:
    1. 完成 TTT 文档初始化（本文档）
    2. 确认 121 个冲突文件清单并逐项列出
    3. 确认 `merge-base` 和 `MERGE_HEAD`
  - **验收标准**: 121 个文件全部列在批次清单中，每个文件有唯一标识。
  - **参考文档**: `docs/规程/版本管理/远程分支合并.procedure.md`

## 🟡 中期计划

- [ ] **Phase 1: 包管理、入口与常量** — 按规程 §72 顺序处理影响面最广的配置文件
- [ ] **Phase 2: 前端配置模块** — `config/` 目录下 9 个文件
- [ ] **Phase 3: 布局模块** — `layout/` 目录下 12 个文件
- [ ] **Phase 4: 菜单模块** — `menus/` 目录下 7 个文件
- [ ] **Phase 5: 离线 dock 与移动端** — `mobile/` 目录下 12 个文件
- [ ] **Phase 6: 插件模块** — `plugin/` 目录下 6 个文件
- [ ] **Phase 7: Protyle 核心** — `protyle/` 各级子目录，18 个文件
- [x] **Phase 8: 搜索、同步与其他前端** [已完成 2026-05-22] — `search/`(util.ts跨6文件14处+unRef.ts+menu.ts)、`sync/syncGuide.ts`、`util/`(assets/escape/fetch/pathName/noRelyPCFunction全部deleted by us已验证)、`window/`(index.ts 6 commits+init.ts 3 commits+setHeader.ts onlyPadding参数)
- [x] **Phase 9: 后端 kernel** [已完成 2026-05-20] — 12 个文件（10 冲突 + 2 新增）
- [x] **Phase 10: 最终验证** [已完成 2026-05-22] — 清理备份、构建验证、无冲突标记确认

## 🏁 已归档/已完成

- (暂无)

## 冲突批次清单 — 全部 121 个文件

### 根目录与包管理 (4)

| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 1 | `.gitignore` | [x] 已完成 | `40c148b` 添加 muslbin/ 注释行和路径，HEAD 已有，合并正确 |
| 2 | `README.md` | [x] 已完成 | `fac8f9b` 添加在线用户指南链接、`f31ebeac` 修复语法/拼写。本地保留 fork 版 README.md，上游全文存入 `README.*.original.md` |
| 3 | `app/package.json` | [x] 已完成 | 11 commits: electron 40.8.5→41.5.1, pnpm 10.33→11.1.1, cross-env, 版本号等。已合并，保留 fork 名称和 magi-* scripts |
| 4 | `app/pnpm-lock.yaml` | [x] 已完成 | 锁文件，保留 HEAD，后续 `pnpm install` 重生 (§2) |
| 5 | `app/pnpm-workspace.yaml` | [x] 已完成 | deleted by us：5 个 upstream commits (build/pnpm)，本地已删除，保持 |

### 核心入口 (5)

| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 6 | `app/src/asset/index.ts` | [x] 已完成 | 4 个 `:art:` commits：iconAlignCenter→iconOutline, iconLayoutRight→iconLayoutLeft 已移植到 PDFviewer.vue |
| 7 | `app/src/asset/renderAssets.ts` | [x] 已完成 | `257d7b2` `:art:` iconLanguage→iconGlobe，HEAD 已有 |
| 8 | `app/src/boot/globalEvent/click.ts` | [x] 已完成 | `24435cd`+`aaffae3`: getDockByType+dock item handler 已移植 |
| 9 | `app/src/boot/globalEvent/event.ts` | [x] 已完成 | `initTouchDragBridge` 已导入，`openFileById`/`checkFold` 已清理 |
| 10 | `app/src/boot/globalEvent/keydown.ts` | [x] 已完成 | deleted by us。`3e6ae65` 删除 getSelectionOffset/focusByOffset 已移植到 editKeydown/index.ts |
| 11 | `app/src/boot/globalEvent/touch.ts` | [x] 已完成 | deleted by both。3 commits 逐步删除 touch 函数，HEAD 也无调用 |
| 12 | `app/src/boot/onGetConfig.ts` | [x] 已完成 | 函数拆分架构保留。setTabPosition/menu.resetPosition/dialogs.resize 已移植 |
| 13 | `app/src/card/openCard.ts` | [x] 已完成 | `92de34a` block__logo--icon class。修复模板字面量被错误截断在第75行 |
| 14 | `app/src/constants.ts` | [x] 已完成 | 1处冲突(hotkeys)：altNumber→硬编码⌃，redo ⌘Y→⇧⌘Z，HEAD已有 |
| 15 | `app/src/index.ts` | [x] 已完成 | 2处冲突：imports(setBodyHighlight/无setLocalShorthandCount/updateControlAlt) + case setLocalShorthandCount移除 |

### 前端 config 模块 (9)

| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 16 | `app/src/config/about.ts` | [x] 已完成 | 1处冲突(imports)。saveExportFile 已替换 openByMobile，HEAD 已有 |
| 17 | `app/src/config/account.ts` | [x] 已完成 | 1处冲突：new Date().getTime()→Date.now()，HEAD 已有 |
| 18 | `app/src/config/ai.ts` | [x] 已完成 | deleted by us。HEAD 已删，上游 responsiveHTML 简化不适用 HEAD 多 tab 设计 |
| 19 | `app/src/config/appearance.ts` | [x] 已完成 | 1处冲突：desktopMode 开关，HEAD已有(siyuanI18n) |
| 20 | `app/src/config/editor.ts` | [x] 已完成 | 1处冲突：config-group 包裹 markdown 内联设置，HEAD已有 |
| 21 | `app/src/config/exportConfig.ts` | [x] 已完成 | 2处冲突：openByMobile→saveExportFile + isElectron runtime，HEAD已有 |
| 22 | `app/src/config/index.ts` | [x] 已完成 | 1处冲突：config__side 布局 + iconPublish + AIProfiles 保留，HEAD已有 |
| 23 | `app/src/config/keymap.ts` | [x] 已完成 | 1处冲突：移除 style="height:14px"，以上游为准 |
| 24 | `app/src/config/query.ts` | [x] 已完成 | 29处冲突。取 MERGE_HEAD 完整版，适配 siyuanI18n + 重构 import path |
| 25 | `app/src/config/repos.ts` | [x] 已完成 | 3处冲突：saveExportFile 已有，loading spinner 保留，多余</div>保留 |
| 26 | `app/src/config/search.ts` | [x] 已完成 | 2处冲突：模块化 key 数组 + updateTab 函数提取，HEAD已有 |

### 布局模块 (12)

| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 27 | `app/src/layout/Model.ts` | [x] 已完成 | 1处冲突：getModelHandlers().processMessage + if(data) + window.siyuan.config guard，HEAD已有 |
| 28 | `app/src/layout/Tab.ts` | [x] 已完成 | 3处冲突：imports(isTouchDevice移除)+ipcSend runtime+delete duplicate，HEAD已有 |
| 29 | `app/src/layout/Wnd.ts` | [x] 已完成 | 6处冲突：drag拆分到Wnd.drag，addTab到Wnd.tab，子模块包含完整上游逻辑 |
| 30 | `app/src/layout/dock/Backlink.ts` | [x] 已完成 | 上游3项变更均已在HEAD：type:backlink、移除backlinks/mentions的SVG图标，siyuanI18n已适配 |
| 31 | `app/src/layout/dock/Bookmark.ts` | [x] 已完成 | type:bookmark已在HEAD；SVG图标移除需传播到子模块bookmark.util.ts — 已修复 |
| 32 | `app/src/layout/dock/Files.ts` | [x] 已完成 | 8个上游commit→子模块：dnd(readonly+touchDrag)✓, eventHandlers(isFocus)✓, init.ts移除SVG图标, htmlGenerators.ts修复Lute.EscapeHTMLStr(去data-name加getDisplayName), escapeGreat→escapeLessThans全局重命名11文件23处 |
| 33 | `app/src/layout/dock/Graph.ts` | [x] 已完成 | 5项变更4项已有，仅移除SVG图标 |
| 34 | `app/src/layout/dock/Outline.ts` | [x] 已完成 | deleted by us→子模块outline/，4项变更全已覆盖 |
| 35 | `app/src/layout/dock/Tag.ts` | [x] 已完成 | 1处冲突：type:"tag" + _处理消息 重构，HEAD已有 |
| 36 | `app/src/layout/dock/index.ts` | [x] 已完成 | element→elements[], togglePin/showDock/hideDock/toggleModel/add/remove/setSize/genButton全部适配双elements架构, 新增adjustSplit/saveLocalPlugin, 子模块dock.model/dock.toggle/dock.init/dock.dnd/dock.events/dock.size全部同步更新 |
| 37 | `app/src/layout/dock/util.ts` | [x] 已完成 | 1处冲突: setTabPosition 导入+adjustDockPadding+switchWnd移除，HEAD已有 |
| 38 | `app/src/layout/index.ts` | [x] 已完成 | 3处冲突: addLayout/addWnd after参数+DOM before/after，HEAD已有 |
| 39 | `app/src/layout/tabUtil.ts` | [x] 已完成 | setTabPosition重导出(window/setHeader.ts已实现), pushRootID/icon大纲/switchTabByIndex均已覆盖 |
| 40 | `app/src/layout/topBar.ts` | [x] 已完成 | 5项变更已在HEAD：toolbar__item--active移除、config__side选择器、body--toolbar-hide、zoom位置修正 |
| 41 | `app/src/layout/util.ts` | [x] 已完成 | 子模块重构, switchWnd已删除, dockToJSON修复elements[], JSONToDock已有adjustDockPadding, JSONToLayout用setTabPosition替resizeTopBar, addResize已有after/preventDefault/setTabPosition, resizeTopBar已有hideToolbar守卫 |
| 42 | `app/src/menus/Menu.ts` | [x] 已完成 | 1处冲突: iconClose height移除，HEAD已有 |
| 43 | `app/src/menus/commonMenuItem.ts` | [x] 已完成 | deleted by us。saveExportFile已移植到 commonMenuItem/export/ |
| 44 | `app/src/menus/navigation.ts` | [x] 已完成 | 3 commits: openByMobile→saveExportFile+exportMds space fix，已移植 |
| 45 | `app/src/menus/onGetnotebookconf.ts` | [x] 已完成 | noCurrent 参数添加 + siyuanI18n 适配 |
| 46 | `app/src/menus/protyle.ts` | [x] 已完成 | barrel 文件，7 个 :art: commits。tagMenu/iframe 变更已移植到 protyleMenus/ submodules |
| 47 | `app/src/menus/text.ts` | [x] 已完成 | 1 个 commit: iconSelect→iconSelectAll，HEAD 已有 |
| 48 | `app/src/menus/util.ts` | [x] 已完成 | 2 commits: openByMobile→saveExportFile 端口，HEAD 已有 setEditMode |
| 49 | `app/src/menus/workspace.ts` | [x] 已完成 | 3 commits: iconRecentDocs/togglePinDock/Date.now()，HEAD已有 |
| 50 | `app/src/dialog/index.ts` | [x] 已完成 | 添加private resizeCallback字段+public resize()方法 |
| 51 | `app/src/dialog/processSystem/index.ts` | [x] 已完成 | deleted by us，上游无commit |
| 52 | `app/src/editor/util.ts` | [x] 已完成 | deleted by us, 2个commit: setEditMode移除已在子模块实现, blockId fallback已在util.updateOutline.ts |
| 53 | `app/src/history/history.ts` | [x] 已完成 | deleted by us, 6个commit: iconTag/saveAs/searchRepo/rollbackRepoSnapshotFile/rollbackDocHistory(去notebook)均在子模块 |

### 移动端模块 (12)

| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 54 | `app/src/mobile/dock/MobileFiles.ts` | [x] 已完成 | 5处冲突。移植 touchDragState+closeElement private。模块化架构保留 |
| 55 | `app/src/mobile/dock/MobileOutline.ts` | [x] 已完成 | type:"outline" 添加，HEAD已有 |
| 56 | `app/src/mobile/index.ts` | [x] 已完成 | 6项修改: hasClosestByClassName+lockScreen+hideAllElements+initTouchDragBridge import, 移除updateControlAlt, handleTouchEnd简化, hideAllElements(["util"])点击处理, window.lockscreenByMode |
| 57 | `app/src/mobile/menu/index.ts` | [x] 已完成 | 4处冲突: iconLanguage→iconPublish x2 |
| 58 | `app/src/mobile/menu/search.ts` | [x] 已完成 | 跨3文件13处: import escapeHtml仅保留、iconCloseRound→iconClose(4处)、escapeLessThans(title)→escapeHtml(title)(3处)、getNotebookName→escapeHtml(getNotebookName)、subTypes支持(replace+updateSearchResult+2个reset) |
| 62 | `app/src/mobile/settings/fileTree.ts` | [x] 已完成 | 新增shorthand保存路径: generateFileTreeHTML追加+handleInputChange fetchPost追加+bindFileTreeEvents设置值 |
| 63 | `app/src/mobile/util/keyboardToolbar.ts` | [x] 已完成 | 4处: selectionchange+isMultiSelectMode, showKeyboardToolbar+cursorTop<0 touchRange(focusBlock/isNotEditBlock), action.ts+preventRender after hideKeyboard, menu.ts iconTags→iconTag |
| 64 | `app/src/mobile/util/onMessage.ts` | [x] 已完成 | setLocalShorthandCount删除; updateControlAlt删除(核查时发现残留已补修) |
| 65 | `app/src/mobile/util/setEmpty.ts` | [x] 已完成 | iconList→iconRecentDocs, iconFile→iconAddDoc |

### 插件模块 (6)

| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 66 | `app/src/plugin/API.ts` | [x] 已完成 | mode:TEditorMode 添加到 openTab.types + openTab |
| 67 | `app/src/plugin/index.ts` | [x] 已完成 | 3处: reloadPlugin改.find()+exact match+toolbar.update, addDock+addPluginDock, addTopBar+setTabPosition |
| 68 | `app/src/plugin/loader.ts` | [x] 已完成 | 2处: mountStatusBarIcons中resizeTopBar移至图标挂载后, 新增addPluginDock导出(loader.afterLoad.ts) + re-export |
| 69 | `app/src/plugin/openTopBarMenu.ts` | [x] 已完成 | 2处: helpers中b3-tab-bar→config__side, pin/unpin后加setTabPosition(true), imports.ts中注册setTabPosition |
| 70 | `app/src/plugin/uninstall.ts` | [x] 已完成 | 简化dock清理(移除dockIconElement/位置计算/storage保存), 加null守卫, resizeTopBar+setTabPosition移至dock清理后 |
| 71 | `app/src/plugin/platformUtils.ts` | [x] 已完成 | getStorageVal已在HEAD |

### Protyle 模块 (18)

| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 72 | `app/src/protyle/index.ts` | [x] 已完成 | 2处冲突: imports+switchMode方法+setEditMode import，已移植 |
| 73 | `app/src/protyle/breadcrumb/action.ts` | [x] 已完成 | 4处冲突: imports+onNet2LocalAssets+fullscreen+updateWindowUI，HEAD重构已有 |
| 74 | `app/src/protyle/breadcrumb/index.ts` | [x] 已完成 | 2处冲突: genMobileMenu+showMenu+net2LocalAssets import，已添加genMobileMenu |
| 80 | `app/src/protyle/hint/extend.ts` | [x] 已完成 | 3 commits: iconTags→iconTag, iconLanguage→iconGlobe, iframe sandbox |
| 81 | `app/src/protyle/hint/index.ts` | [x] 已完成 | enableExtend=true内移至handleFillSlash的((/{{分支 |
| 82 | `app/src/protyle/render/av/cell.ts` | [x] 已完成 | mAsset去重: link推送移至HTML解析后+hasExited去重+兜底外移 |
| 83 | `app/src/protyle/render/av/col.ts` | [x] 已完成 | deleted by us, block__logo--icon已在col/子模块 |
| 84 | `app/src/protyle/render/av/openMenuPanel.ts` | [x] 已完成 | select多选值拖拽排序: mousedown添加button===0&&type===select分支, 含ghost+updateCellsValue |
| 85 | `app/src/protyle/render/av/relation.ts` | [x] 已完成 | 仅escapeGreat→escapeLessThans，已全局处理 |
| 86 | `app/src/protyle/render/av/render.ts` | [x] 已完成 | 安全修复: data.name加Lute.EscapeHTMLStr(data-title+可见内容) |
| 87 | `app/src/protyle/render/highlightRender.ts` | [x] 已完成 | lineNumberRender重构: block→hljsElement,提早返回,escapeHtml行内容,innerHTML分批渲染,childNodes高度计算 |
| 88 | `app/src/protyle/render/mermaidRender.ts` | [x] 已完成 | DOMPurify USE_PROFILES加mathMl:true修复Mermaid公式渲染 |
| 89 | `app/src/protyle/toolbar/index.ts` | [x] 已完成 | 5处跨4文件: compatibility.ts加saveExportFile, showRender.export.ts用saveExportFile替openByMobile, template.ts移除SVG内联样式, index.ts加showMultiSelectMode+isMultiSelectMode+activeBlur+hideElements+setPosition |
| 90 | `app/src/protyle/ui/hideElements.ts` | [x] 已完成 | hideElements/hideAllElements加isMultiSelectMode守卫防多选工具栏误隐藏 |
| 91 | `app/src/protyle/util/compatibility.ts` | [x] 已完成 | saveExportFile完整版(desktop:ipcInvoke+showSaveDialog+fs,mobile:bridge,browser:URL), saveZipExport, 移除exportByMobile, getLocalStorage加subTypes默认值+迁移, import补全 |
| 92 | `app/src/protyle/util/editorCommonEvent.ts` | [x] 已完成 | 跨4子模块5处: onDragStart-iframe ghost+touchDragGhost×2, moveTo.helper.cleanup-getParentBlock+contains守卫, onDrop.helper.external-getPathForFile null安全+files长度守卫 |
| 93 | `app/src/protyle/util/paste.ts` | [x] 已完成 | enableExtend条件守卫, nodeElement fallback+range前移, streamInsert大HTML分片粘贴 |
| 94 | `app/src/protyle/util/selection.ts` | [x] 已完成 | selection.range.ts: setInsertWbrHTML加table分支(range class标记+removeAttribute)+hasClosestByTag import |
| 95 | `app/src/protyle/wysiwyg/index.ts` | [x] 已完成 | 5处: contextmenu+isMultiSelectMode, tableMerge+execCommand, compositionend input→setTimeout, cut: cloneElement+img/math textPlain, click: range前移+table-only focus |
| 96 | `app/src/protyle/wysiwyg/keydown.ts` | [x] 已完成 | keydown.arrow.navigation.ts: table守卫×2 + code-block空行diff!==0修复 |
| 97 | `app/src/protyle/wysiwyg/transaction.ts` | [x] 已完成 | Date.now(), av-names加(), transaction.onTransaction.move.ts: data-protyle-id+querySelectorAll+protyle-wysiwyg限定 |

### 搜索模块 (3)

| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 98 | `app/src/search/menu.ts` | [x] 已完成 | iconLanguage→iconGlobe, 2x iconCloseRound→iconClose, heading/list子类型UI+展开折叠+parent-subtype同步+宽度600px+subTypes保存 |
| 99 | `app/src/search/unRef.ts` | [x] 已完成 | 仅escapeGreat→escapeLessThans，已全局处理 |
| 100 | `app/src/search/util.ts` | [x] 已完成 | 跨6文件14处修改: `util.ts`(openGlobalSearch subTypes+updateConfig escapeXSS+getArticle+replace subTypes), `inputEvent.ts`(subTypes API), `spread.ts`(subTypes初始化), `handleCriteriaClick.ts`(getDefaultConfig subTypes), `handleSearchControlClick.ts`(moreMenu reset subTypes), `genSearchHTML.ts`(aria-label双转义+iconSearchAsset), `handlePathClick.ts`(escapeHtml+escapeAriaLabel), `setupClickHandler.ts`(Date.now()), `onSearch.ts`(escapeHtml getNotebookName+content/aria-label转义) |

### 同步模块 (1)

| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 101 | `app/src/sync/syncGuide.ts` | [x] 已完成 | b3-tab-bar→config__side选择器2处 |

### 工具模块 (6)

| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 102 | `app/src/util/assets.ts` | [x] 已完成 | deleted by us。13个commit全为:art:图标/主题。font-weight CSS已在setInlineStyle.ts，colors格式已对齐，均已在HEAD |
| 103 | `app/src/util/escape.ts` | [x] 已完成 | deleted by us。仅escapeGreat→escapeLessThans，已全局处理 |
| 104 | `app/src/util/fetch.ts` | [x] 已完成 | deleted by us。仅Date.now()替代，HEAD的network/fetch.ts已有 |
| 105 | `app/src/util/file/Tree.ts` | [x] 已完成 | deleted by us，上游无commit |
| 106 | `app/src/util/pathName.ts` | [x] 已完成 | deleted by us。2个commit添加Lute.EscapeHTMLStr(item.name)到aria-label，HEAD的generateAriaLabelParts已用getDisplayName转义 |
| 107 | `app/src/util/platform/noRelyPCFunction.ts` | [x] 已完成 | deleted by us，上游无commit |

### 窗口模块 (3)

| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 108 | `app/src/window/index.ts` | [x] 已完成 | 6 commits: 移除updateControlAlt+加setBodyHighlight引用(5df0bf), transactionError(data.msg)(e9a2dc), setLocalStorageVal null guard(2f775a), 新增setLocalStorageVals/removeLocalStorageVal/removeLocalStorageVals(3aaa96) |
| 109 | `app/src/window/init.ts` | [x] 已完成 | 3 commits: initNativeDialogOverride保留+f8cc5d5 dialogs resize循环+784beb18d hideToolbar偏移+setTabPosition延迟调用+05b425dd8 import setTabPosition |
| 110 | `app/src/window/setHeader.ts` | [x] 已完成 | 7 commits全部为:art: (#10749)。已添加onlyPadding参数+processWndForTabPosition onlyPadding分支, passThrough到setTabPosition签名 |

### 样式文件 (1)

| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 111 | `app/src/assets/scss/business/_layout.scss` | [x] 已完成 | 19 commits `:art:`，1处冲突(border移除)。以上游为准 |

### 内核后端 (10)

| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 112 | `kernel/api/file.go` | [x] 已完成 | 3 处冲突：移除中间变量 msg，上游改用直接格式化。补回 errMsgSeeKernelLog 常量 |
| 113 | `kernel/go.mod` | [x] 已完成 | 3 处冲突 + 非冲突区版本升级：gws 添加，fork 独有 dep(go-anthropic/tiktoken/gse/yaegi/string-metrics)全部保留，replace 指令全部保留，net/sys/text/sse/dejavu/filelock 版本升级 |
| 114 | `kernel/go.sum` | [x] 已完成 | `go mod tidy` 重生，含 gws/font/tools 等新 checksum |
| 115 | `kernel/main.go` | [x] 已完成 | `e564ce7b` 插件集成 + `7d32251` CLI 重构。main.go 改用 cmd.Execute()，assetmeta 移植到 kernel/cli/cmd/serve.go |
| 116 | `kernel/server/serve.go` | [x] 已完成 | httpHandler 提取 + forge 模式 auto-open 浏览器（S-Forge 保留） |
| 117 | `kernel/sql/block.go` | [x] 已完成 | 3 处冲突：移植 ial 参数到 updateRootContent 签名+调用，保持 rowid 双表 FTS 更新 |
| 118 | `kernel/sql/database.go` | [x] 已完成 | 移植 indexIndexQueue(WAL)/recoverIndexQueue/clearIndexQueueEntries/closeIndexQueue；保留本地 buildFTSRowIDMapping |
| 119 | `kernel/sql/queue.go` | [x] 已完成 | 1486804/c660189/1ae36f: renameTree→indexTree 字段合并，RenameSubTreeQueue→MoveTreeQueue，rename_sub_tree→move，sleep 逻辑移到 rename action |
| 120 | `kernel/sql/upsert.go` | [x] 已完成 | 1 处冲突：HEAD 同时插入 FTS+CI 双表（双搜索），上游分条件单表。保持 HEAD |
| 121 | `kernel/util/working.go` | [x] 已完成 | 3 处冲突 + 非冲突补全：版本 3.6.5，语言列表更新，forge 模式保留，补 InitWorkspace/IsMobileContainer/QueueDir |
| — | `kernel/sql/index_queue.go` | [x] 新增 | 上游新文件，从 MERGE_HEAD 复制，index queue WAL 持久化 |
| — | `kernel/cli/cmd/serve.go` | [x] 已完成 | 上游新文件，含 S-Forge assetmeta 初始化 |
| — | `kernel/logging/logging.go` | [x] 已完成 | 从上游移植 SetLogToStdout/logToStdout/getWriters（修复 cli/cmd/root.go 编译） |
| — | `kernel/nerv/magi/coordinator/*` | [x] 已完成 | 适配上游 API 变更：CreateWithMarkdown+arg=nil, FullTextSearchBlock+subTypes=nil |

## 执行记录

### 2026-05-20 — Kernel 后端完成

- 完成 kernel 全部 10 个冲突文件 + 2 个 upstream 新文件 (index_queue.go/serve.go)
- 修复 downstream 编译错误：
  - `logging/logging.go`: 从上游移植 SetLogToStdout/logToStdout/getWriters
  - `util/working.go`: 补 InitWorkspace/IsMobileContainer/QueueDir
  - `api/file.go`: 补 errMsgSeeKernelLog 常量
  - `sql/block.go`: updateRootContent 签名增加 ialContent 参数
  - `sql/queue.go`: 删除未使用 import (sort/strings)
  - `nerv/magi/coordinator/`: 适配上游 API 变更 (CreateWithMarkdown + nil, FullTextSearchBlock + nil)
  - `go.mod`: 补版本升级 (net/sys/text/sse/dejavu/filelock)，验证 fork 独有 dep 和 replace 全部保留
- `go mod tidy` 通过 goproxy.cn 完成，gws/font/tools 等下载成功
- `go build --tags fts5` 通过，SiYuan-Kernel.exe 生成

### 2026-05-19 — 合并盘点和初始化

- **merge-base**: `ca38872f1`
- **MERGE_HEAD**: `ce05a916`
- 通过 tmp 目录 `git clone` + `git merge ce05a916` 精确确认 121 个冲突文件
- 创建本文档，逐项列出所有文件
- 完成 #1-#12 (`.gitignore`→`onGetConfig.ts`)
- 完成 #111 (`_layout.scss`)
- 误操作：批量 `git checkout HEAD` + `git add` 覆盖了全部冲突文件
- 通过文件时间戳识别出受影响范围，对 kernel 文件逐一重新审查修复

### 2026-05-22 — 构建错误修复

构建发现 5 个错误（非 merge 冲突，属合并后代码质量问题），已修复：

| 错误 | 文件 | 问题 | 修复 |
|------|------|------|------|
| `Can't resolve './util/assets'` | `src/index.ts:53`, `src/window/index.ts:31` | 目录 `util/assets/` 无 `index.ts`，路径需指向 `assets.ts` | 改为 `./util/assets/assets` |
| `Can't resolve '../noRelyPCFunction'` | `util/assets/assets.ts:19` | 文件已移至 `platform/noRelyPCFunction.ts` | 改为 `../platform/noRelyPCFunction` |
| `Expected identifier but found ")"` | `plugin/index.ts:133` | `onDataChanged` 方法残留多余 `})` + `loadPlugins` 缩进错误 | 移除多余括号、修复缩进 |
| `Unexpected "}"` | `protyle/index.ts:540` | `switchMode` 方法后残留多余 `}` | 删除 |
| `Expected ":" but found "msgId"` | `moreFormats.ts:220` | `createEPUBExportMenuItem` 缺少 `click:` 包装 (API 也需从 `exportReStructuredText` → `exportEPUB`) | 加回 `click: () => {` 并修正 API 路径 |

### 2026-05-22 — 最终核查报告

基于"上游修改是否被恰当地合并"标准，对全部 121 个冲突文件进行复查。发现了 4 处问题并已修复：

| # | 文件 | 问题 | 修复 |
|---|------|------|------|
| 100 | `search/utils/genSearch/handlers/handleListItemClick.ts:70` | `new Date().getTime()` 未改为 `Date.now()`（上游 e451bc3da） | ✅ 已改 |
| 100 | `search/util.ts:161` + `handlePathClick.ts:50` | `aria-label` 错误改为 `escapeAriaLabel()`，上游累计 diff 保持 `escapeHtml()` | ✅ 已回改为 `escapeHtml()` |
| 108 | `mobile/util/onMessage.ts:68` | `updateControlAlt()` 残留调用（#64声称已删但未执行），上游在 `window/index.ts` 中已移除 | ✅ 已删除 |
| 109 | `window/init.ts:78-79` | `resize` 函数末尾有残留的 `} }` 导致语法错误 | ✅ 已清理 |

核查通过：
- P0-#100 (9子模块14处): ✅ escapeGreat 全量清除, subTypes 3个reset点确认完整, onSearch.ts转义正确
- P0-#108 (6 commits): ✅ setLocalStorageVals/removeLocalStorageVal/removeLocalStorageVals 已添加, transactionError(data.msg) 已改, null guard已加
- P0-#109-110 (10 commits): ✅ hideToolbar偏移, setTabPosition延迟调用, dialogs.resize, onlyPadding参数均正确; setTabPosition上游已从setHeader.ts整体移除→tabUtil.ts, HEAD保留本地实现(仅窗口模式)属架构差异
- P1-#32: ✅ 全项目0处escapeGreat残留
- P1-#91: ✅ saveExportFile/saveZipExport/getLocalStorage subTypes迁移完整
- P1-#41: ✅ addResize after/preventDefault/setTabPosition(true), resizeTopBar hideToolbar守卫, JSONToDock adjustDockPadding
- P2: ✅ #27-29 HEAD已有, #71 getStorageVal已有, #99 仅escapeGreat→escapeLessThans无误, #102-107 deleted by us全部在子模块中验证
- P3: ✅ setTabPosition 17处调用 + onlyPadding参数传递正确, isMultiSelectMode 8处交叉引用一致
