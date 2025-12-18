# 修复 filterTypesHTML.ts 中的 forEach 错误

## 任务描述
修复 app/src/search/filterTypesHTML.ts 文件中的 ESLint 错误：
1. 禁止使用 .forEach() 
2. 禁止超过 5 行的内联回调函数

## 任务列表
- [x] 分析现有代码问题
- [x] 创建具名函数替换内联回调
- [x] 使用 for...of 替换 forEach
- [x] 修复类型错误
- [ ] 测试修改后的代码
- [ ] 提交修改