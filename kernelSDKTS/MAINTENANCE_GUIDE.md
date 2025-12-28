# KernelSDK TypeScript 维护指南

本文档介绍如何维护 `kernelSDKTS` 项目，包括 API 定义的同步、核对和日常维护工作。

## 目录

- [项目结构](#项目结构)
- [常用命令](#常用命令)
- [工作流程](#工作流程)
- [添加新 API](#添加新-api)
- [API 核对机制](#api-核对机制)
- [常见问题](#常见问题)

---

## 项目结构

```
kernelSDKTS/
├── src/
│   ├── apiDefs/              # API 定义目录
│   │   ├── index.ts          # 统一导出入口 (包含 allApiDefs)
│   │   ├── types.ts          # 通用类型和 Schema
│   │   ├── account.ts        # 各模块 API 定义
│   │   ├── block/            # 拆分为目录的模块
│   │   │   ├── index.ts      # 模块入口
│   │   │   ├── schemas.ts    # 模块专用 Schema
│   │   │   ├── insert.ts     # 子分类
│   │   │   └── ...
│   │   └── ...
│   └── client/
│       ├── types.ts          # Api定义 接口定义
│       └── factory.ts        # 客户端工厂
├── scripts/
│   ├── updateFromGo.ts       # 从 Go 后端同步 API 列表
│   ├── validateSync.ts       # 校验定义与后端一致性
│   ├── listPendingVerification.ts  # 列出待核对 API
│   └── generateVerificationReport.ts  # 生成核对报告
├── docs/
│   └── ROLLING_VERIFICATION_DESIGN.md  # 核对机制设计文档
├── rawApiList.json           # 从 Go 后端提取的原始 API 列表
├── sync_check_result.md      # 同步检查结果
└── VERIFICATION_STATUS.md    # API 核对状态报告
```

---

## 常用命令

### 日常维护

```bash
# 类型检查
pnpm typecheck

# 从 GitHub 同步最新的 API 列表
pnpm sync:update

# 检查 API 定义与后端是否一致
pnpm sync:check

# 查看待核对的 API 列表
pnpm verify:list

# 生成详细的核对状态报告
pnpm verify:report
```

### 开发与构建

```bash
# 安装依赖
pnpm install

# 构建
pnpm build
```

---

## 工作流程

### 1. 同步后端 API 变更

当思源笔记后端 API 发生变化时：

```bash
# 1. 获取最新的 API 列表
pnpm sync:update

# 2. 检查差异
pnpm sync:check

# 3. 根据 sync_check_result.md 中的问题修复定义
```

### 2. 核对 API 定义

定期核对 TypeScript 定义与 Go 后端实现是否一致：

```bash
# 1. 查看需要核对的 API
pnpm verify:list

# 2. 核对完成后，在 API 定义中添加 lastVerified 字段
lastVerified: '2025-12-28',

# 3. 生成报告查看进度
pnpm verify:report
```

---

## 添加新 API

### 步骤 1: 确定所属模块

API 端点格式为 `/api/{module}/{action}`，如 `/api/block/insertBlock` 属于 `block` 模块。

### 步骤 2: 编写定义

在对应的模块文件中添加 API 定义：

```typescript
{
    method: 'POST',
    endpoint: '/api/block/newApi',
    en: 'newApi',                           // 英文名，必须与后端一致
    zh_cn: '新 API 中文名',                  // 中文名
    description: 'API 功能描述',             // 描述
    needAuth: true,                          // 是否需要认证
    needAdminRole: false,                    // 是否需要管理员权限
    unavailableIfReadonly: false,            // 只读模式是否不可用
    zodRequestSchema: z.object({             // 请求参数 Schema
        param1: z.string().describe('参数说明'),
    }),
    zodResponseSchema: 创建响应Schema(       // 响应 Schema
        z.object({...})
    ),
    lastVerified: '2025-12-28',              // 核对日期（可选）
},
```

### 步骤 3: 更新导出

如果是新模块，需要在 `src/apiDefs/index.ts` 中：

1. 添加 export 语句
2. 在 `allApiDefs` 对象中添加条目

### 步骤 4: 验证

```bash
pnpm typecheck    # 类型检查
pnpm sync:check   # 同步检查
```

---

## API 核对机制

### lastVerified 字段

每个 API 定义可以包含 `lastVerified` 字段，记录最后一次与 Go 后端核对的日期：

```typescript
{
    // ... 其他字段
    lastVerified: '2025-12-28',
}
```

- `undefined`: 从未核对（最高优先级）
- `> 30天`: 高优先级
- `> 14天`: 中优先级
- `其他`: 低优先级

### 核对流程

1. **运行 `pnpm verify:list`** 查看按优先级排序的待核对 API
2. **查看 Go 后端代码** (kernel/api/*.go)
3. **对比请求/响应参数**:
   - 参数名称是否一致
   - 必填/可选是否正确
   - 数据类型是否匹配
4. **修复不一致** 并更新 TypeScript 定义
5. **添加 `lastVerified`** 字段
6. **运行 `pnpm verify:report`** 生成报告

---

## 模块拆分

对于 API 数量较多的模块（如 `block`），可以拆分为目录结构：

```
block/
├── index.ts           # 汇总入口，导出 blockApiDefs
├── schemas.ts         # 共用 Schema
├── insert.ts          # 插入相关 API
├── update.ts          # 更新相关 API
├── query.ts           # 查询相关 API
└── ...
```

**注意事项**:
- `index.ts` 必须导出 `{moduleName}ApiDefs`
- 更新 `src/apiDefs/index.ts` 中的导入路径

---

## allApiDefs 说明

`allApiDefs` 是所有 API 定义的统一集合，定义在 `src/apiDefs/index.ts`：

```typescript
export const allApiDefs: Record<string, readonly Api定义[]> = {
    'account': accountApiDefs,
    'block': blockApiDefs,
    // ...
};
```

**用途**:
- `validateSync.ts` 使用它检查定义完整性
- `listPendingVerification.ts` 使用它统计核对状态
- `generateVerificationReport.ts` 使用它生成报告

**维护规则**:
- 新增模块时必须添加到 `allApiDefs`
- 键名应与 API 路径中的模块名一致（如 `/api/block/*` → `'block'`）

---

## 常见问题

### Q: sync:check 报告 "缺失API定义"

**原因**: 后端新增了 API，但 TypeScript 定义未更新

**解决**: 在对应模块中添加 API 定义

### Q: sync:check 报告 "应标记废弃"

**原因**: TypeScript 中有定义，但后端已删除该 API

**解决**: 在定义中添加 `deprecated: true`

### Q: sync:check 报告 "认证标志不匹配"

**原因**: `needAuth`、`needAdminRole`、`unavailableIfReadonly` 与后端不一致

**解决**: 根据 `rawApiList.json` 中的值修正

### Q: 如何查看某个 API 的后端实现？

1. 在 `kernel/api/router.go` 中搜索端点路径
2. 找到对应的处理函数
3. 查看该函数的实现

### Q: Schema 定义应该多详细？

**原则**:
- 必填字段必须正确标注
- 可选字段使用 `.optional()`
- 使用 `.describe()` 添加字段说明
- 复杂类型抽取为独立 Schema 复用

---

## 相关文档

- [滚动核对机制设计](./docs/ROLLING_VERIFICATION_DESIGN.md)
- [API 核对状态报告](./VERIFICATION_STATUS.md)
- [同步检查结果](./sync_check_result.md)
