# Outline.ts "deleted by us" 冲突调查

## 冲突状态

`app/src/layout/dock/Outline.ts` 处于 "deleted by us" 状态——我方分支删除了该文件，对方分支（origin/dev）仍在修改它。

## 调查结论

### 我方分支（multipleAI）的情况

我方将原始的单体 `Outline.ts`（1320行）拆分为模块化结构，位于 `app/src/layout/dock/outline/` 子目录：

- `outline/Outline.ts` — 主类（350行），导入拆分模块
- `outline/Outline.sort.ts`、`Outline.filter.ts`、`Outline.expand.ts` 等十余个子模块

相关提交记录：`7f6044a5b`、`7b8e06b55` — "改进代码组织,清理lint错误"

项目中已无任何文件 import 旧路径 `layout/dock/Outline`，唯一引用指向新路径 `layout/dock/outline/Outline`（见 `app/src/editor/util.updateOutline.ts`）。

### 对方分支（origin/dev）的情况

对方仍在原始单体 `Outline.ts` 上做修改（1320行，包含完整的 Outline 类实现）。

## 建议处理方式

保持我方的删除决定（`git rm`），因为：
1. 功能已完整迁移到 `outline/` 子目录
2. 项目引用已全部指向新路径
3. 对方在原文件上的修改需要人工审查后合并到拆分后的对应子模块中
