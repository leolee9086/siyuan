# 修复 setHeader.ts 中的 forEach 问题

## 任务描述
修复 app/src/window/setHeader.ts 文件第86-102行的 ESLint 错误：
1. 禁止使用 .forEach() - 需要替换为 for...of 循环
2. 禁止超过 5 行的内联回调函数 - 需要提取为命名函数

## 任务列表
- [ ] 分析现有代码逻辑和问题
- [ ] 创建处理单个 tab 的命名函数
- [ ] 将 forEach 替换为 for...of 循环
- [ ] 验证修改后的代码逻辑正确性
- [ ] 运行 ESLint 检查确认问题已解决