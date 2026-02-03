# protyleMenus types.ts 文件合并任务

> **状态**: 已完成 ✅
> **创建时间**: 2026-02-03
> **完成时间**: 2026-02-03
> **适用规程**: 代码质量/代码拆分与模块化.procedure.md

## 任务目标

将 `app/src/menus/protyleMenus` 目录下的多个 types.ts 文件合并为一个统一的类型定义文件。

## 涉及文件

### 待合并的类型文件

1. `protyle.asset.types.ts` - 资源项接口 (assetItem)
2. `protyle.contentMenu.types.ts` - 内容菜单上下文接口 (IContentMenuContext, IInlineMenuContext)
3. `protyle.linkMenu.types.ts` - 链接菜单上下文接口 (LinkMenuContext)

### 需要更新导入的文件

1. `protyle.asset.guard.ts` - 引用 assetItem
2. `protyle.asset.ts` - 引用 assetItem
3. `protyle.contentMenu.ts` - 引用 IContentMenuContext, IInlineMenuContext
4. `protyle.linkMenu.items.ts` - 引用 LinkMenuContext
5. `protyle.linkMenu.ts` - 引用 LinkMenuContext
6. `protyle.linkMenu.utils.ts` - 引用 LinkMenuContext

## 执行计划

### 步骤 1: 创建合并后的类型文件

- [x] 创建 `protyle.types.ts` 文件
- [x] 合并所有类型定义

### 步骤 2: 更新导入引用

- [x] 更新 `protyle.asset.guard.ts`
- [x] 更新 `protyle.asset.ts`
- [x] 更新 `protyle.contentMenu.ts`
- [x] 更新 `protyle.linkMenu.items.ts`
- [x] 更新 `protyle.linkMenu.ts`
- [x] 更新 `protyle.linkMenu.utils.ts`

### 步骤 3: 删除旧文件

- [x] 删除 `protyle.asset.types.ts`
- [x] 删除 `protyle.contentMenu.types.ts`
- [x] 删除 `protyle.linkMenu.types.ts`

### 步骤 4: 验证

- [x] 文件结构验证通过

## 执行记录

### 2026-02-03

- 创建 ttt 文档
- 创建合并后的类型文件 `protyle.types.ts`
- 更新所有导入引用（6个文件）
- 删除旧的类型文件（3个文件）
- 验证文件结构正确
- 任务完成
