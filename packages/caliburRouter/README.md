# CalibURRouter

基于集合论的类型安全模式匹配引擎。

## 核心理念

将模式匹配问题转化为集合论问题：
- **全集 (Universe)** - 所有可能输入的状态空间
- **子集 (Split)** - 从全集中切割模式子集
- **剩余集 (Remain)** - 处理未被显式切割的部分

## 安装

```bash
pnpm add calibur-router
```

## 快速开始

```typescript
import { calibur } from "calibur-router";
import { type } from "arktype";

// 1. 定义状态空间全集
const dispatcher = calibur.universe(type({
    按键: "string",
    修饰符: { ctrl: "boolean", shift: "boolean" }
}))
    // 2. 切割子集并注册处理器
    .split(
        type({ 按键: "'Enter'", 修饰符: { ctrl: "true" } }),
        () => ({ 命令: "提交" })
    )
    .split(
        type({ 按键: "'Tab'" }),
        (state) => ({ 命令: "缩进", shift: state.修饰符.shift })
    )
    // 3. 处理剩余情况
    .remain((state) => ({ 命令: "输入", 按键: state.按键 }))
    // 4. 构建分发器
    .build();

// 使用
dispatcher({ 按键: "Enter", 修饰符: { ctrl: true, shift: false } });
// => { 命令: "提交" }
```

## 特性

### 部分属性模式匹配

模式只需指定用于匹配的属性，处理器仍可访问全集的所有属性：

```typescript
.split(
    type({ 按键: "'Enter'" }),  // 只指定按键
    (state) => {
        // state.按键 类型是 'Enter' (已收窄)
        // state.修饰符 类型保留全集定义 (可访问)
        return { 命令: "换行", shift: state.修饰符.shift };
    }
)
```

### 嵌套分发器

支持将分发器作为处理器，实现分层分发：

```typescript
// 子分发器
const 代码块处理器 = calibur.universe(type({ 按键: "'Tab' | 'Enter'" }))
    .split(type({ 按键: "'Tab'" }), () => "缩进")
    .remain(() => "换行")
    .build();

// 父分发器委托
calibur.universe(type({ 块类型: "'代码块' | '段落'", 按键: "string" }))
    .split(
        type({ 块类型: "'代码块'", 按键: "'Tab' | 'Enter'" }),
        代码块处理器,      // 子分发器
        () => "默认处理"   // fallback (必需)
    )
    .remain(() => "其他")
    .build();
```

### 运行时验证

- 子分发器全集必须是父模式的子集
- 使用分发器时必须提供 fallback 处理器

## API

### `calibur.universe(schema)`

创建匹配器构建器。

### `.split(模式, 处理器)`

切割子集并注册处理器。

### `.split(模式, 子分发器, fallback)`

委托给嵌套分发器，fallback 处理未覆盖情况。

### `.remain(处理器)`

处理所有未被 split 覆盖的情况。

### `.build()`

构建最终的分发器函数。

## 依赖

- [ArkType](https://arktype.io) - Schema 引擎

## 测试

```bash
pnpm test
```

## License

MIT
