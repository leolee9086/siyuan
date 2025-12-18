# 修复 utils.scrollToCurrent.ts 中的问题

## 任务描述
修复 app/src/search/utils.scrollToCurrent.ts 文件中的 TypeScript 和 ESLint 错误。

## 问题列表
- [ ] 修复 "tableElement.firstElementChild" 可能为 "null" 的 TypeScript 错误
- [ ] 修复对象可能为 "null" 的 TypeScript 错误
- [ ] 修复嵌套 If 的 ESLint 错误（两处）
- [ ] 修复隐式上下文切换的 ESLint 错误

## 修复计划
1. 分析代码中的潜在问题
2. 添加适当的空值检查
3. 重构嵌套的 if 语句
4. 避免在 DOM 获取接口返回的对象上直接链式调用
5. 确保修复后的代码保持原有功能