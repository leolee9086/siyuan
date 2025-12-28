# @siyuan/kernel-sdk

类型安全的思源笔记内核 API 客户端，利用 TypeScript 类型推断自动生成类型，无需代码生成。

## 核心特性

- **零代码生成**: 通过 TypeScript 类型推断，运行时创建方法，编译时获得完整类型
- **Zod 双重作用**: 编译时类型提取 + 运行时数据验证
- **简洁架构**: 工厂函数约 80 行，API 定义即类型定义

## 安装

```bash
pnpm install
```

## 使用

```typescript
import { 创建客户端 } from '@siyuan/kernel-sdk';
import { accountApiDefs } from '@siyuan/kernel-sdk/apiDefs';

const client = 创建客户端(accountApiDefs, {
  baseUrl: 'http://127.0.0.1:6806',
  apiToken: 'your-token',
});

// 有完整类型提示！
const result = await client.login({
  userName: 'test',
  userPassword: '123',
  captcha: 'xxxx',
  cloudRegion: 0,
});
```

## 目录结构

```
src/
├── index.ts              # 包入口
├── client/
│   ├── types.ts          # 类型工具 (Api定义, 推断类型等)
│   ├── factory.ts        # 客户端工厂 (核心实现)
│   └── index.ts          # 客户端模块入口
└── apiDefs/
    ├── types.ts          # 通用类型 (标准响应等)
    ├── index.ts          # API定义模块入口
    └── [待迁移]          # 各分组 API 定义
```

## 开发命令

```bash
# 构建
pnpm build

# 开发模式 (监听变化)
pnpm dev

# 类型检查
pnpm typecheck

# 同步检查 (与 router.go 对比)
pnpm sync:check
```

## 迁移进度

参见 `../kernelSDK/ts迁移计划.plan.md`
