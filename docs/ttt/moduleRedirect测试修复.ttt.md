# moduleRedirect测试修复

## 任务目标
修复 `app/src/util/code/executor.ts` 中的安全检查逻辑，使其在检测到未授权包时完全替换代码为错误抛出语句。

## 问题描述
测试 `应该先进行安全检查再重定向` 失败，原因是当前实现在检测到未授权包时，将错误代码与原始代码拼接，而非完全替换。

## 修复方案
将第133行附近的：
```typescript
return errorCode + magicString.toString();
```
修改为：
```typescript
return `(() => { throw new Error('${errorMessage}') })();`;
```

## 状态
- [x] 代码修改
- [x] 测试验证

## 完成时间
2026-02-01T21:07 (UTC+8)
