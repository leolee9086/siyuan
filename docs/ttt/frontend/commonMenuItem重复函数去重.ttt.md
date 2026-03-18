# commonMenuItem 重复函数去重

## 任务背景
调研发现 `app/src/menus/commonMenuItem/index.ts` 中存在3个重复函数定义，总计约253行重复代码。这是一个未完成的重构工作。

## 调研结果
详见：`docs/调研/commonMenuItem重复函数调研.md`

## 重复函数清单
1. openWechatNotify - 64行重复
2. openFileWechatNotify - 55行重复
3. openMenu - 134行重复

## 任务目标
删除 index.ts 中的重复实现，改为从独立文件重新导出

## 任务计划
- [x] 备份 index.ts 原始文件
- [x] 验证独立文件中的实现完整性
- [x] 删除 index.ts 中的3个重复函数实现
- [x] 添加从独立文件的重新导出
- [x] 验证导出正确性（检查是否有其他文件引用）
- [x] 运行 lint 检查
- [x] index.ts 行数优化（清理未使用导入，简化注释）
- [ ] 运行相关测试（如果存在）

## 预期成果
- 减少253行重复代码
- 消除维护风险
- 保持API兼容性

## 执行结果
- ✅ 已删除3个重复函数实现，共计253行代码
- ✅ 已添加重新导出语句，保持API兼容性
- ✅ 备份文件已创建：index.ts.backup
- ✅ 独立文件验证通过：
  - commonMenuItem.openWechatNotify.ts (重构版本，包含辅助函数)
  - openFileWechatNotify.ts (完整实现)
  - openMenu.ts (重构版本，模块化实现)
- ✅ index.ts 行数优化完成：
  - 清理未使用的导入：从 238 行导入注释减少到 144 行
  - 简化冗长注释
  - 文件从 402 行减少到 308 行（物理行数）
  - 实际代码行数 <300 行（lint 检查通过）
- ✅ Lint检查通过：只有目录文件数超限错误（按要求暂时忽略）
