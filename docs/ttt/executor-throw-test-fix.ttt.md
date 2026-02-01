# executor.ts throw 策略测试修复

## 问题描述

测试文件 `app/test/util/code/executor.throw.test.ts` 中的 4 个测试用例全部失败。

## 根本原因

`app/src/util/code/executor.ts` 第 132-133 行存在代码逻辑错误：
- 第 132 行构建了正确的 `errorCode` 变量但未使用
- 第 133 行返回了完全不同的硬编码字符串

## 修复方案

修改第 133 行，使用已构建的 `errorCode` 变量：
```typescript
return errorCode + magicString.toString();
```

## 任务清单

- [ ] 修复 executor.ts 第 133 行
- [ ] 运行测试验证修复结果
- [ ] 完成后删除此文档
