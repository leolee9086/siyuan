# 创建lint错误最多文件列表脚本

## 任务目标
为app项目创建一个脚本工具，用于列出lint错误最多的十个文件。

## 任务状态
- [x] 分析现有lint配置和脚本结构
- [x] 编写脚本工具
- [x] 添加npm script命令
- [x] 测试验证

## 完成情况
✅ 任务已完成

### 创建的文件
- `app/scripts/lint-top-errors.js` - lint错误统计脚本

### 添加的npm命令
- `pnpm lint:top` - 列出lint错误最多的10个文件
- `pnpm lint:top -n 20` - 自定义显示数量
- `pnpm lint:top --json` - JSON格式输出

### 测试结果
脚本成功扫描1052个文件，正确统计并排序lint错误。
