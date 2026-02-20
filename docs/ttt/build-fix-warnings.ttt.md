# 构建Warning修复

## 任务目标
修复构建中5个缺失导出warning。

## 近期任务
- [x] 定位 openAsset/openBy 实际位置，修复 commonMenuItem.ts 导入
- [x] 定位 getAllTabs/getAllModels/getAllWnds 实际位置，修复 layout 模块导入
- [x] 构建验证

## 进度
- 2026-02-20: 任务开始，已阅读错误调查报告
- 2026-02-20: 任务完成，所有5个warning已消除，构建验证通过

## 修改记录
- `app/src/menus/commonMenuItem.ts`: 将 `openAsset` 导入从 `../editor/util` 改为 `../editor/util.openAsset`，将 `openBy` 导入从 `../editor/util` 改为 `../editor/utils.openBy`，并加上 `/// #if !BROWSER` 守卫
- `app/src/layout/layout-deserialization.layout.ts`: 给 `getAllTabs` 导入和 `removeUnpinnedTabsOnStart` 函数加 `/// #if !MOBILE` 守卫
- `app/src/layout/layout-serialization.ts`: 给 `getAllModels` 导入和使用处加 `/// #if !MOBILE` 守卫
- `app/src/layout/window-utils.ts`: 给 `getAllWnds` 导入和调用处加 `/// #if !MOBILE` 守卫
