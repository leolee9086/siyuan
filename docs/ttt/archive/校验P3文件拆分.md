# P3 文件拆分校验报告

## 校验时间
2026-02-24T21:24 UTC

## 校验范围
P3 共 6 个文件拆分，逐一对比 `.backup` 原始文件与拆分后文件，确认函数/方法覆盖完整性。

---

## 1. history.ts (4 文件)

| 文件 | 行数 | 职责 |
|------|------|------|
| history.ts.backup | 971 | 原始文件 |
| history.ts | 216 | `openHistory`, `bindEvent`, `historyEditor` 变量 |
| history.render.ts | 344 | `renderDoc`, `renderRepoItem`, `renderRepo`, `renderRmNotebook` |
| history.docEvent.ts | 274 | `handleDocClick` (item tabs, rollback, toggle, rmtoggle, assets/doc/av click, jumpHistoryPage, docprevious/docnext, rebuildIndex) |
| history.repoEvent.ts | 208 | `handleRepoClick` (repoitem select, genRepo, removeRepoTagSnapshot, uploadSnapshot, downloadSnapshot, downloadRollback, genTag, previous/next, jumpRepoPage, compare) |

**结论**: ✅ 函数覆盖完整

**问题**: ⚠️ backup 第955-957行 `rebuildIndex` 的 closeModel 分支中设置 `historyEditor = undefined`，但拆分后 docEvent.ts 第266行省略了此赋值（因 `historyEditor` 是 history.ts 的模块作用域变量，docEvent.ts 无法直接访问）。需确认是否需要通过回调或导出解决。

**条件编译迁移**: `/// #if MOBILE` / `/// #else` / `/// #endif` 已替换为运行时 `platform === "browser-mobile"` 检查 ✅

---

## 2. MobileOutline.ts (3 文件)

| 文件 | 行数 | 职责 |
|------|------|------|
| MobileOutline.ts.backup | 974 | 原始文件 |
| MobileOutline.ts | 300 | 类定义, constructor, setCurrent, setCurrentByPreview, setCurrentById, update, saveExpendIds, onTransaction |
| MobileOutline.contextMenu.ts | 420 | `showContextMenu`, `getProtyleAndBlockElement`, `genHeadingTransform` |
| MobileOutline.expand.ts | 285 | `setFilter`, `expandToLevel`, `showExpandLevelMenu`, `collapseSameLevel`, `collapseChildren`, `handleOutlineTransaction`, `bindKeepCurrentExpandEvent` |

**结论**: ✅ 函数覆盖完整

**可见性变更**: `preFilterExpandIds` 和 `setCurrentById` 从 `private` 改为 `public`（拆分所需，可接受）

**i18n 迁移**: `window.siyuan.languages` → `siyuanI18n` ✅

---

## 3. search.ts (3 文件)

| 文件 | 行数 | 职责 |
|------|------|------|
| search.ts.backup | 916 | 原始文件 |
| search.ts | 297 | `updateSearchResult`, `popSearch`, `goAsset`, `goUnRef`, `getUnRefListMobile` |
| search.render.ts | 239 | `replace`, `updateConfig`, `onRecentBlocks`, `UpdateSearchResultFn` 类型 |
| search.event.ts | 428 | `initSearchEvent` (全部 click 事件处理) |

**结论**: ✅ 函数覆盖完整

**依赖注入**: `initSearchEvent` 签名变更为接受 `updateSearchResult`, `goAsset`, `getUnRefListMobile` 作为参数；`replace` 和 `updateConfig` 也接受 `updateSearchResult` 参数 ✅

**i18n 迁移**: `window.siyuan.languages` → `siyuanI18n` ✅

---

## 4. emoji/index.ts (5 文件)

| 文件 | 行数 | 职责 |
|------|------|------|
| index.ts.backup | 771 | 原始文件 |
| index.ts | 226 | `getRandomEmoji`, `unicode2Emoji`, `lazyLoadEmoji`, `lazyLoadEmojiImg`, `addEmoji`, `openEmojiPanel`, `updateOutlineEmoji`, `updateFileTreeEmoji`, `getEmojiDesc`, `getEmojiTitle`, re-export `filterEmoji` |
| emoji.filter.ts | 102 | `filterEmoji` |
| emoji.dynamic.ts | 175 | `parseDynamicState`, `genWeekdayOptions`, `buildDynamicTabHTML`, `bindDynamicEvents` |
| emoji.panel.ts | 231 | `buildDialogHTML`, `bindEmojiPanelEvents`, `renderEmojiContent` |
| emoji.panel.keyboard.ts | 128 | `handleEmojiKeydown` |

**结论**: ✅ 函数覆盖完整

**条件编译迁移**: `/// #if !MOBILE` / `/// #endif` 已替换为运行时 `platform !== "browser-mobile"` 检查 ✅

---

## 5. MobileFiles.ts (4 文件)

| 文件 | 行数 | 职责 |
|------|------|------|
| MobileFiles.ts.backup | 765 | 原始文件 |
| MobileFiles.ts | 277 | 类定义, constructor, init, selectItem, getLeaf, setCurrent, getOpenPaths |
| MobileFiles.ws.ts | 272 | `genNotebook`, `updateItemArrow`, `onMove`, `onRemove`, `onRename`, `onMount` |
| MobileFiles.event.ts | 190 | `bindClickEvent`, `genSort` |
| MobileFiles.render.ts | 134 | `genFileHTML`, `onLsHTML`, `onLsSelect` |

**结论**: ✅ 函数覆盖完整

**可见性变更**: `closeElement` 从 `private` 改为 `public`（拆分所需，可接受）

---

## 6. repos.ts (2 文件)

| 文件 | 行数 | 职责 |
|------|------|------|
| repos.ts.backup | 632 | 原始文件 |
| repos.ts | 231 | `repos` 对象 (`genHTML`, `bindEvent`) |
| repos.provider.ts | 405 | `renderProvider`, `bindProviderEvent` |

**结论**: ✅ 函数覆盖完整

---

## 总结

| 文件 | 状态 | 问题 |
|------|------|------|
| history.ts | ✅ | ⚠️ historyEditor 作用域问题 |
| MobileOutline.ts | ✅ | 无 |
| search.ts | ✅ | 无 |
| emoji/index.ts | ✅ | 无 |
| MobileFiles.ts | ✅ | 无 |
| repos.ts | ✅ | 无 |

6/6 文件拆分函数覆盖完整。1 个潜在问题需关注（history.ts 的 historyEditor 作用域）。
