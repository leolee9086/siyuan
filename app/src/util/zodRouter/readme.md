# ZodRouter

## 功能概述

ZodRouter是一个基于Zod schema模式匹配的路由库，专注于解决动态方法注册的问题。它允许开发者通过Zod schema定义方法签名，并在运行时动态注册这些方法，同时提供完整的TypeScript类型支持和运行时验证。

### 核心特性

1. **基于Zod Schema的模式匹配** - 利用Zod强大的类型验证能力，实现方法参数的精确匹配
2. **类型安全的动态方法注册** - 提供完整的TypeScript类型支持，确保方法注册的类型安全
3. **运行时类型验证** - 自动验证方法调用参数是否符合预定义的schema
4. **智能方法路由** - 根据参数结构和内容自动路由到正确的方法实现

## 设计理念

### 类型安全的动态方法注册

ZodRouter的核心功能是允许开发者通过Zod schema定义方法，然后动态注册这些方法。这种方式提供了编译时和运行时的双重类型安全保障：

```typescript
import { z } from 'zod';
import ZodRouter from './zodRouter';

// 定义方法schema列表
const methodSchemas = [z.string()]

```
