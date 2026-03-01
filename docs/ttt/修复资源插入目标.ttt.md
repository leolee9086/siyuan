# 修复资源插入目标错误

> **状态**: 已完成
> **创建**: 2026-02-27
> **完成**: 2026-02-27
> **规程**: docs/规程/测试与修复/前端测试执行与错误修复.procedure.md

## 问题

斜杠菜单唤出资源选择器后，选中asset条目插入位置错误——插入到第一个protyle而非唤出面板的编辑器。

## 根因

`assetMenu()` 桌面端调用 `openAssetDialog(callback)` 时丢弃了 `protyle` 参数。`openAssetDialog` 在用户选中资源后通过 `获取活跃编辑器()` 重新查找编辑器，但此时Dialog已抢走焦点，fallback到第一个protyle。

## 修复方案

- `assetMenu` 桌面端传入callback，在callback中用正确的protyle调用 `hintRenderAssets`
- `openAssetDialog` 退化为纯资源选择器，移除内部的编辑器查找和插入逻辑

## 任务清单

- [x] 定位bug根因
- [x] 修改 `assetMenu` 桌面端逻辑
- [x] 修改 `openAssetDialog` 退化为纯选择器
- [x] lint检查（assetDialog.ts 通过，protyle.asset.ts 预存错误不涉及本次修改）
