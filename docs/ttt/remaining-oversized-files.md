# 剩余超长文件调查报告

扫描时间: 2026-02-24T22:55Z
阈值: 300 行实际代码（排除空行和注释，与 code-size/max-lines lint 规则一致）
扫描范围: app/src/ 下 1143 个代码文件（已排除 .old/.bak/.icns/.md/.scss/.d.ts 等非目标文件）
超标文件总数: 95 个

## 一、P0-P3 拆分产物仍超标（14个）

这些文件是之前 P0-P3 拆分任务的产物，拆分后仍然超过 300 行，需要二次拆分：

| 文件 | 代码行数 | 超标倍数 | 来源拆分 |
|------|---------|---------|---------|
| protyle/wysiwyg/index.mousedown.dragSelect.ts | 495 | 1.6x | P0 wysiwyg/index.ts |
| protyle/wysiwyg/index.click.ts | 486 | 1.6x | P0 wysiwyg/index.ts |
| mobile/menu/search.event.ts | 422 | 1.4x | P3 search.ts |
| config/repos.provider.ts | 399 | 1.3x | P3 repos.ts |
| protyle/wysiwyg/transaction.turns.ts | 399 | 1.3x | P0 transaction.ts |
| protyle/render/av/gallery/render.ts | 381 | 1.3x | P2 render.ts |
| mobile/dock/MobileOutline.contextMenu.ts | 369 | 1.2x | P3 MobileOutline.ts |
| protyle/render/av/openMenuPanel.drag.ts | 368 | 1.2x | P0 openMenuPanel.ts |
| protyle/render/av/cell.value.ts | 362 | 1.2x | P1 cell.ts |
| protyle/render/av/render.table.ts | 354 | 1.2x | P2 render.ts |
| protyle/hint/index.fill.slash.ts | 336 | 1.1x | P1 hint/index.ts |
| history/history.render.ts | 333 | 1.1x | P3 history.ts |
| protyle/render/av/filter.menu.ts | 312 | 1.0x | P2 filter.ts |
| mobile/util/keyboardToolbar.menu.ts | 306 | 1.0x | P2 keyboardToolbar.ts |

## 二、新发现的超长文件（81个）

以下文件从未出现在 P0-P3 拆分计划中，按代码行数降序排列。

### 严重超标（>600行，2x+）— 12个

| # | 文件 | 代码行数 | 超标倍数 |
|---|------|---------|---------|
| 1 | protyle/render/av/col.ts | 1764 | 5.9x |
| 2 | card/openCard.ts | 893 | 3.0x |
| 3 | protyle/render/av/action.ts | 883 | 2.9x |
| 4 | menus/navigation.ts | 838 | 2.8x |
| 5 | constants.ts | 822 | 2.7x |
| 6 | protyle/export/index.ts | 814 | 2.7x |
| 7 | protyle/wysiwyg/list.ts | 794 | 2.6x |
| 8 | protyle/wysiwyg/remove.ts | 790 | 2.6x |
| 9 | layout/dock/Graph.ts | 771 | 2.6x |
| 10 | protyle/util/table.ts | 733 | 2.4x |
| 11 | protyle/render/av/select.ts | 703 | 2.3x |
| 12 | menus/protyle.ts | 698 | 2.3x |

### 中度超标（400-600行，1.3x-2x）— 37个

| # | 文件 | 代码行数 | 超标倍数 |
|---|------|---------|---------|
| 13 | search/menu.ts | 678 | 2.3x |
| 14 | layout/dock/Backlink.ts | 655 | 2.2x |
| 15 | menus/workspace.ts | 653 | 2.2x |
| 16 | menus/commonMenuItem.ts | 637 | 2.1x |
| 17 | protyle/wysiwyg/enter.ts | 629 | 2.1x |
| 18 | protyle/hint/extend.ts | 627 | 2.1x |
| 19 | boot/globalEvent/keydown.ts | 612 | 2.0x |
| 20 | dialog/processSystem.ts | 587 | 2.0x |
| 21 | mobile/settings/about.ts | 577 | 1.9x |
| 22 | config/editor.ts | 572 | 1.9x |
| 23 | protyle/render/av/blockAttr.ts | 572 | 1.9x |
| 24 | components/PDFviewer.vue | 571 | 1.9x |
| 25 | protyle/render/av/relation.ts | 571 | 1.9x |
| 26 | protyle/util/compatibility.ts | 569 | 1.9x |
| 27 | protyle/util/paste.ts | 565 | 1.9x |
| 28 | layout/dock/embeddingDock/EmbeddingDock.ts | 553 | 1.8x |
| 29 | protyle/util/insertHTML.ts | 553 | 1.8x |
| 30 | config/about.ts | 550 | 1.8x |
| 31 | protyle/render/av/calc.ts | 546 | 1.8x |
| 32 | config/keymap.ts | 544 | 1.8x |
| 33 | protyle/util/dnd/onDrop.ts | 528 | 1.8x |
| 34 | protyle/wysiwyg/keydown.ts | 520 | 1.7x |
| 35 | config/account.ts | 498 | 1.7x |
| 36 | protyle/util/onGet.ts | 492 | 1.6x |
| 37 | protyle/render/av/asset.ts | 480 | 1.6x |
| 38 | boot/globalEvent/command/panel.ts | 472 | 1.6x |
| 39 | config/image.ts | 469 | 1.6x |
| 40 | protyle/index.ts | 460 | 1.5x |
| 41 | protyle/upload/index.ts | 450 | 1.5x |
| 42 | plugin/index.ts | 448 | 1.5x |
| 43 | boot/globalEvent/command/global.ts | 447 | 1.5x |
| 44 | protyle/render/av/view.ts | 444 | 1.5x |
| 45 | protyle/render/av/row.ts | 441 | 1.5x |
| 46 | protyle/toolbar/Font.ts | 437 | 1.5x |
| 47 | protyle/gutter/bindEvent.ts | 436 | 1.5x |
| 48 | boot/onGetConfig.ts | 412 | 1.4x |
| 49 | boot/globalEvent/keydown/fileTreeKeydown.ts | 410 | 1.4x |

### 轻度超标（300-400行，1.0x-1.3x）— 32个

| # | 文件 | 代码行数 | 超标倍数 |
|---|------|---------|---------|
| 50 | layout/tabUtil.ts | 410 | 1.4x |
| 51 | menus/protyleMenus/protyle.asset.ts | 409 | 1.4x |
| 52 | search/util.ts | 409 | 1.4x |
| 53 | boot/globalEvent/keydown/editKeydown.ts | 401 | 1.3x |
| 54 | layout/dock/Inbox.ts | 400 | 1.3x |
| 55 | menus/protyle.refMenu.ts | 392 | 1.3x |
| 56 | protyle/header/Title.ts | 392 | 1.3x |
| 57 | protyle/render/av/groups.ts | 387 | 1.3x |
| 58 | mobile/settings/editor.ts | 386 | 1.3x |
| 59 | config/bazzar/bazaarRender.ts | 385 | 1.3x |
| 60 | config/ai/ModelScopeConfig.vue | 376 | 1.3x |
| 61 | components/masonry/components/VirtualMasonryGrid.vue | 367 | 1.2x |
| 62 | mobile/settings/account.ts | 364 | 1.2x |
| 63 | config/query.ts | 363 | 1.2x |
| 64 | config/exportConfig.ts | 360 | 1.2x |
| 65 | protyle/util/dnd/onDragOver.ts | 359 | 1.2x |
| 66 | sync/syncGuide.ts | 359 | 1.2x |
| 67 | layout/dock/customBlockLists/CustomLists.ts | 339 | 1.1x |
| 68 | protyle/wysiwyg/keydown.delete.ts | 327 | 1.1x |
| 69 | mobile/util/touch.ts | 319 | 1.1x |
| 70 | protyle/wysiwyg/input.ts | 319 | 1.1x |
| 71 | card/viewCards.ts | 313 | 1.0x |
| 72 | boot/globalEvent/searchKeydown.ts | 312 | 1.0x |
| 73 | layout/dock/Tag.ts | 310 | 1.0x |
| 74 | layout/topBar.ts | 310 | 1.0x |
| 75 | search/assets.ts | 310 | 1.0x |
| 76 | util/Tree.ts | 309 | 1.0x |
| 77 | protyle/gutter/buildGutterStyleMenu.ts | 306 | 1.0x |
| 78 | protyle/ui/event.ts | 304 | 1.0x |
| 79 | util/embedding/transformer.ts | 304 | 1.0x |
| 80 | mobile/menu/index.ts | 303 | 1.0x |
| 81 | util/focusStack.ts | 302 | 1.0x |

## 三、按模块分布统计

| 模块 | 超标文件数 | 最严重文件 |
|------|-----------|-----------|
| protyle/render/av/ | 15 | col.ts (1764行) |
| protyle/wysiwyg/ | 10 | list.ts (794行) |
| protyle/util/ | 7 | table.ts (733行) |
| config/ | 8 | editor.ts (572行) |
| menus/ | 5 | navigation.ts (838行) |
| layout/dock/ | 6 | Graph.ts (771行) |
| boot/globalEvent/ | 5 | keydown.ts (612行) |
| mobile/ | 7 | settings/about.ts (577行) |
| search/ | 3 | menu.ts (678行) |
| 其他 | 29 | card/openCard.ts (893行) |

## 四、与 P0-P3 对比总结

| 类别 | 数量 | 说明 |
|------|------|------|
| P0-P3 原始文件 | 16 | 全部已完成拆分 |
| 拆分产物仍超标 | 14 | 需要二次拆分 |
| 新发现超长文件 | 81 | 从未在拆分计划中 |
| **需处理总计** | **95** | 拆分产物 + 新发现 |
