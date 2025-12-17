# 修复工具栏类型不匹配问题

## 问题描述
在 `app/src/components/panels/imageEditor.toolbarItem.ts` 文件中，`createToolbarItems` 函数返回的对象数组与 `ToolbarItem` 类型不匹配，导致 TypeScript 编译错误。

## 问题分析
1. `type` 属性被定义为字符串 `'button'`，但期望的是字面量类型 `'button'`
2. 可选属性的类型定义不符合 `exactOptionalPropertyTypes` 要求

## 修复计划
1. 修改 `imageEditor.toolbarItem.ts` 文件，确保所有对象符合 `ToolbarItem` 类型定义
2. 导入 `ToolbarItem` 类型，而不是重新定义
3. 确保所有可选属性正确处理

## 实施步骤
1. 修改 `imageEditor.toolbarItem.ts` 文件，导入 `ToolbarItem` 类型
2. 调整对象定义，确保类型匹配
3. 验证修复是否成功