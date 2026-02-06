# EventEmitter 重构方案

## 任务概述

对 `app/src/util/events/eventEmitter.ts` 进行重构，解决 65 个 lint 错误。

## 当前文件分析

### 文件结构
- **文件路径**: `app/src/util/events/eventEmitter.ts`
- **当前行数**: 379 行（超过 300 行限制）
- **类名**: `SafeEventEmitter<T extends IEventDefines>`
- **依赖文件**: `eventEmitter.types.ts`, `event.guard.ts`

### 类成员清单

| 成员类型 | 名称 | 行号 | 说明 |
|---------|------|------|------|
| 私有属性 | events | 5-10 | 事件监听器存储 |
| 私有属性 | schemas | 13 | Zod schema 缓存 |
| 私有属性 | options | 15 | 配置选项 |
| 构造函数 | constructor | 17-63 | 初始化配置和编译 schema |
| 私有方法 | compileSchemas | 65-70 | 编译事件定义为 Zod schema |
| 私有方法 | validateEventData | 72-92 | 验证事件数据（含类型谓词） |
| 私有方法 | processEventData | 94-121 | 处理并验证事件数据 |
| 私有方法 | createValidationCopy | 123-125 | 创建数据深拷贝 |
| 私有方法 | executeListenerWithValidation | 127-153 | 同步执行监听器 |
| 私有方法 | executeListenerWithValidationAsync | 155-181 | 异步执行监听器 |
| 公共方法 | on | 183-196 | 注册事件监听器 |
| 公共方法 | once | 198-211 | 注册一次性监听器 |
| 公共方法 | emit | 213-242 | 同步触发事件 |
| 公共方法 | emitAsync | 244-273 | 异步触发事件 |
| 公共方法 | off | 275-287 | 移除监听器 |
| 公共方法 | setOptions | 289-327 | 更新配置选项 |
| 公共方法 | enableRuntimeCheck | 329-332 | 启用运行时检查 |
| 公共方法 | disableRuntimeCheck | 334-337 | 禁用运行时检查 |
| 公共方法 | removeAllListeners | 339-346 | 移除所有监听器 |
| 公共方法 | listenerCount | 348-351 | 获取监听器数量 |
| 公共方法 | eventNames | 353-355 | 获取所有事件名 |
| 公共方法 | getEventSchema | 376-378 | 获取事件 schema |

---

## 问题分类与解决策略

### 1. 文件大小问题（1个）

**问题**: 文件超过 300 行限制

**解决策略**: 拆分为 3 个文件

```
app/src/util/events/
├── eventEmitter.ts          # 主类（约 180 行）
├── eventEmitter.types.ts    # 类型定义（已存在）
├── eventEmitter.utils.ts    # 模块级工具函数（新建，约 120 行）
├── eventEmitter.guard.ts    # 类型守卫（新建，约 30 行）
└── event.guard.ts           # DOM 事件守卫（已存在）
```

### 2. 私有方法限制（8个）

**问题**: lint 规则禁止类的私有方法

**解决策略**: 提取为模块级函数到 `eventEmitter.utils.ts`

| 原私有方法 | 新模块函数 | 参数变化 |
|-----------|-----------|---------|
| compileSchemas | compileEventSchemas | 添加 eventDefines, schemas 参数 |
| validateEventData | validateEventDataImpl | 添加 options, schemas 参数 |
| processEventData | processEventDataImpl | 添加 options, schemas 参数 |
| createValidationCopy | createDataCopy | 无变化 |
| executeListenerWithValidation | executeListenerSync | 添加 options, validateFn 参数 |
| executeListenerWithValidationAsync | executeListenerAsync | 添加 options, validateFn 参数 |

### 3. 类型断言问题（7个）

**问题**: 禁止 `as` 断言和 `is` 关键字

**解决策略**: 
- 创建 `eventEmitter.guard.ts` 存放类型守卫函数
- 使用 `@同步豁免` 注释标记必要的类型谓词
- 用类型守卫替代 `as` 断言

**需要创建的类型守卫**:

```typescript
// eventEmitter.guard.ts

/**
 * 验证数据是否符合事件数据类型
 * @同步豁免: 类型守卫 - TypeScript 类型守卫必须同步返回谓词结果
 */
export function isValidEventData<T extends IEventDefines, K extends keyof T>(
    data: unknown,
    schema: z.ZodObject<z.ZodRawShape> | undefined,
    options: Required<EventEmitterOptions>
): data is EventData<T, K>

/**
 * 检查处理结果是否包含有效数据
 * @同步豁免: 类型守卫 - TypeScript 类型守卫必须同步返回谓词结果
 */
export function hasValidData<T>(
    result: { data: T | null; shouldThrow: boolean }
): result is { data: T; shouldThrow: false }
```

### 4. 控制流问题（15个）

**问题**: 禁止 else、嵌套 if

**解决策略**: 使用早返回模式重构

**示例重构**:

```typescript
// 重构前
if (condition1) {
    // ...
} else if (condition2) {
    // ...
} else {
    // ...
}

// 重构后
if (condition1) {
    // ...
    return;
}
// 添加注释说明为何不需要 else
// 此处 condition1 为 false
if (condition2) {
    // ...
    return;
}
// 此处 condition1 和 condition2 均为 false
// ...
```

### 5. 函数注释缺失（22个）

**问题**: 所有方法缺少 JSDoc 注释

**解决策略**: 为每个函数添加标准 JSDoc 注释

**注释模板**:
```typescript
/**
 * [功能简述]
 *
 * 作用：[具体作用]
 * 意图：[设计意图]
 * 调用时机：[何时调用]
 *
 * @param paramName - 参数说明
 * @returns 返回值说明
 */
```

### 6. 未使用变量（5个）

**问题**: 参数定义但未使用

**解决策略**: 
- 使用下划线前缀标记有意未使用的参数：`_data`
- 或在注释中说明参数保留原因

---

## 重构执行计划

### 阶段 1: 创建新文件结构

- [ ] 创建 `eventEmitter.utils.ts`
- [ ] 创建 `eventEmitter.guard.ts`

### 阶段 2: 提取模块级函数

- [ ] 提取 `compileEventSchemas` 函数
- [ ] 提取 `createDataCopy` 函数
- [ ] 提取 `validateEventDataImpl` 函数
- [ ] 提取 `processEventDataImpl` 函数
- [ ] 提取 `executeListenerSync` 函数
- [ ] 提取 `executeListenerAsync` 函数

### 阶段 3: 创建类型守卫

- [ ] 创建 `isValidEventData` 类型守卫
- [ ] 创建 `hasValidData` 类型守卫
- [ ] 添加 `@同步豁免` 注释

### 阶段 4: 重构控制流

- [ ] 重构 `constructor` 中的条件逻辑
- [ ] 重构 `validateEventDataImpl` 中的条件逻辑
- [ ] 重构 `processEventDataImpl` 中的条件逻辑
- [ ] 重构 `executeListenerSync` 中的条件逻辑
- [ ] 重构 `executeListenerAsync` 中的条件逻辑
- [ ] 重构 `setOptions` 中的条件逻辑

### 阶段 5: 添加 JSDoc 注释

- [ ] 为所有模块级函数添加注释
- [ ] 为所有公共方法添加注释
- [ ] 为构造函数添加注释

### 阶段 6: 修复其他问题

- [ ] 处理未使用变量
- [ ] 移除非空断言（使用类型守卫替代）

### 阶段 7: 验证

- [ ] 运行 lint 检查
- [ ] 确保所有测试通过
- [ ] 验证文件行数符合限制

---

## 文件拆分详细设计

### eventEmitter.utils.ts（新建）

```typescript
// 预计约 120 行

import { z } from "zod";
import { EventEmitterOptions, IEventDefines, EventData, EventListener } from "./eventEmitter.types";

// 1. Schema 编译函数
export function compileEventSchemas<T extends IEventDefines>(
    eventDefines: T,
    schemas: Map<keyof T, z.ZodObject<z.ZodRawShape>>
): void

// 2. 数据拷贝函数
export function createDataCopy<T>(data: T): T

// 3. 默认验证错误处理器工厂
export function createDefaultValidationErrorHandler(
    getValidationFailure: () => EventEmitterOptions['validationFailure']
): (event: string, error: z.ZodError, data: unknown) => void

// 4. 数据处理函数
export function processEventDataImpl<T extends IEventDefines, K extends keyof T>(
    event: K,
    data: unknown,
    options: Required<EventEmitterOptions>,
    schemas: Map<keyof T, z.ZodObject<z.ZodRawShape>>
): { data: EventData<T, K> | null; shouldThrow: boolean }

// 5. 同步监听器执行函数
export function executeListenerSync<T extends IEventDefines, K extends keyof T>(
    event: K,
    listener: EventListener<T, K>,
    data: EventData<T, K>,
    options: Required<EventEmitterOptions>,
    validateFn: (event: K, data: unknown) => boolean
): void

// 6. 异步监听器执行函数
export async function executeListenerAsync<T extends IEventDefines, K extends keyof T>(
    event: K,
    listener: EventListener<T, K>,
    data: EventData<T, K>,
    options: Required<EventEmitterOptions>,
    validateFn: (event: K, data: unknown) => boolean
): Promise<void>
```

### eventEmitter.guard.ts（新建）

```typescript
// 预计约 30 行

import { z } from "zod";
import { IEventDefines, EventData, EventEmitterOptions } from "./eventEmitter.types";

/**
 * 验证数据是否符合事件数据类型
 * @同步豁免: 类型守卫 - TypeScript 类型守卫必须同步返回谓词结果
 */
export function isValidEventData<T extends IEventDefines, K extends keyof T>(
    data: unknown,
    schema: z.ZodObject<z.ZodRawShape> | undefined,
    options: Required<EventEmitterOptions>
): data is EventData<T, K>

/**
 * 检查处理结果是否包含有效数据
 * @同步豁免: 类型守卫 - TypeScript 类型守卫必须同步返回谓词结果
 */
export function hasValidData<T>(
    result: { data: T | null; shouldThrow: boolean }
): result is { data: T; shouldThrow: false }
```

### eventEmitter.ts（重构后）

```typescript
// 预计约 180 行

import { z } from "zod";
import { EventEmitterOptions, IEventDefines, EventData, EventListener } from "./eventEmitter.types";
import { 
    compileEventSchemas, 
    createDataCopy,
    createDefaultValidationErrorHandler,
    processEventDataImpl,
    executeListenerSync,
    executeListenerAsync
} from "./eventEmitter.utils";
import { isValidEventData, hasValidData } from "./eventEmitter.guard";

export class SafeEventEmitter<T extends IEventDefines> {
    // 属性定义（约 10 行）
    
    // 构造函数（约 30 行）
    
    // 公共方法（约 140 行）
    // - on, once, emit, emitAsync, off
    // - setOptions, enableRuntimeCheck, disableRuntimeCheck
    // - removeAllListeners, listenerCount, eventNames, getEventSchema
}
```

---

## 风险与注意事项

1. **类型安全**: 提取函数时需确保泛型参数正确传递
2. **this 引用**: 模块级函数无法访问 this，需通过参数传递所需状态
3. **循环依赖**: 注意文件间的导入关系，避免循环依赖
4. **测试覆盖**: 重构后需确保现有测试仍然通过

---

## 完成标准

- [ ] 所有 lint 错误已修复
- [ ] 主文件行数 ≤ 300 行
- [ ] 所有函数有 JSDoc 注释
- [ ] 无私有方法
- [ ] 无 else 语句
- [ ] 无嵌套 if
- [ ] 类型断言使用类型守卫替代
- [ ] 测试通过
