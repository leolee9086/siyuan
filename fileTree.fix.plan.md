# fileTree.ts 修复计划

## 任务描述
修复 app/src/mobile/settings/fileTree.ts 文件中的所有TypeScript和ESLint错误

## 问题列表
1. TypeScript错误：window.siyuan.config 可能为未定义（18个实例）
2. ESLint错误：箭头函数过长（97行，超过50行限制）
3. ESLint错误：直接访问window对象（多个实例）
4. ESLint错误：使用forEach（应使用for...of或其他替代方案）
5. ESLint错误：隐式上下文切换（DOM获取接口直接链式调用）
6. ESLint错误：内联回调函数过长（forEach和addEventListener）

## 修复步骤
1. 检查项目中是否有environment.ts或global.ts文件用于封装window访问
2. 将过长的箭头函数拆分为多个具名函数
3. 替换forEach为for...of循环
4. 提取内联回调函数为具名函数
5. 修复DOM查询的隐式上下文切换问题
6. 确保所有window.siyuan.config访问都有适当的类型检查

## 预期结果
- 所有TypeScript错误解决
- 所有ESLint错误解决
- 代码符合项目规范
- 功能保持不变