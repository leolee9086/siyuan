# API请求重构规程

> **版本**: 1.0.0  
> **最后更新**: 2026-02-01  
> **适用范围**: 将fetchPost/fetchPostSync调用迁移到kernelSDKTS类型安全客户端

## 目录

- [1. 适用范围](#1-适用范围)
- [2. 前置条件](#2-前置条件)
- [3. 执行导则](#3-执行导则)
- [4. 验证要求](#4-验证要求)
- [5. 注意事项](#5-注意事项)
- [6. 相关文档](#6-相关文档)

---

## 1. 适用范围

### 1.1 适用场景

本规程适用于以下API请求重构场景：

- **fetchPost迁移**: 将现有的`fetchPost`调用替换为`kernelSDKTS`客户端调用
- **fetchPostSync迁移**: 将现有的`fetchPostSync`调用替换为`kernelSDKTS`客户端调用
- **类型安全提升**: 为API调用添加完整的TypeScript类型支持
- **错误处理统一**: 统一API调用的错误处理模式
- **渐进式迁移**: 分批次迁移大量API调用点

### 1.2 不适用场景

以下场景不适用本规程：

- **新API开发**: 开发全新的API接口应使用API开发规程
- **Bug修复**: 修复API调用导致的运行时错误应使用bug修复规程
- **性能优化**: 纯粹的API性能优化工作应使用性能优化规程
- **SDK开发**: 修改kernelSDKTS本身的实现

### 1.3 核心目标

1. **类型安全**: 确保所有API调用具有完整的TypeScript类型支持
2. **代码统一**: 统一API调用方式，消除fetchPost/fetchPostSync的使用
3. **向后兼容**: 重构过程中保持现有功能的正常运行
4. **错误处理**: 提供一致的错误处理和异常管理机制

## 3. 执行导则

### 3.1 客户端导入规范

#### 3.1.1 导入方式要求

- **必须**使用统一的客户端导入方式
- **应该**从kernelSDKTS模块导入类型化客户端
- **不应**混用多种不同的导入方式
- **不得**直接导入内部实现模块

#### 3.1.2 推荐导入模式

```typescript
// 推荐的导入方式
import { 创建客户端, accountApiDefs } from '@leolee9086/siyuan-kernel-sdk';
import type { 客户端配置 } from '@leolee9086/siyuan-kernel-sdk';

// 不推荐的导入方式
import { fetchPost } from '@/util/fetch';  // 待迁移
import * as sdk from '@leolee9086/siyuan-kernel-sdk';      // 不宜使用通配符导入
```

### 3.2 API调用迁移模式

#### 3.2.1 基本迁移模式

- **必须**将fetchPost调用替换为对应的SDK方法调用
- **必须**保持原有的参数结构和返回值处理
- **应该**利用SDK提供的类型定义
- **不应**修改业务逻辑的核心行为

#### 3.2.2 迁移示例

```typescript
// 迁移前：fetchPost调用
const response = await fetchPost('/api/block/getBlockInfo', {
    id: blockId
});
if (response.code === 0) {
    const blockInfo = response.data;
    // 处理块信息
}

// 迁移后：使用kernelSDK客户端
const client = 创建客户端(blockApiDefs, {
    baseUrl: 'http://127.0.0.1:6806',
    apiToken: window.siyuan.config.api.token
});
const response = await client.getBlockInfo({
    id: blockId
});
if (response.code === 0) {
    const blockInfo = response.data; // 现在有完整类型支持
    // 处理块信息
}
```

#### 3.2.3 同步调用迁移

```typescript
// 迁移前：fetchPostSync调用
const response = fetchPostSync('/api/block/getBlockInfo', {
    id: blockId
});

// 迁移后：使用异步SDK方法
const client = 创建客户端(blockApiDefs, {
    baseUrl: 'http://127.0.0.1:6806',
    apiToken: window.siyuan.config.api.token
});
const response = await client.getBlockInfo({
    id: blockId
});
```

### 3.3 错误处理统一

#### 3.3.1 错误处理模式

- **必须**使用统一的错误处理模式
- **应该**利用SDK提供的错误类型定义
- **应该**保持与原有错误处理逻辑的兼容性
- **不得**忽略或简化现有的错误处理

#### 3.3.2 错误处理示例

```typescript
// 统一的错误处理模式
try {
    const client = 创建客户端(blockApiDefs, {
        baseUrl: 'http://127.0.0.1:6806',
        apiToken: window.siyuan.config.api.token
    });
    const response = await client.getBlockInfo({ id: blockId });
    if (response.code !== 0) {
        console.error('API调用失败:', response.msg);
        return;
    }
    // 处理成功响应
    const blockInfo = response.data;
} catch (error) {
    console.error('网络请求失败:', error);
    // 处理网络错误
}
```

### 3.4 类型安全要求

#### 3.4.1 类型使用规范

- **必须**使用SDK提供的类型定义
- **必须**为API响应数据添加类型注解
- **不得**使用`any`类型绕过类型检查
- **不应**使用不安全的类型断言

#### 3.4.2 类型安全示例

```typescript
// 正确的类型使用
import { 创建客户端, blockApiDefs } from '@leolee9086/siyuan-kernel-sdk';
import type { 客户端配置 } from '@leolee9086/siyuan-kernel-sdk';

const client = 创建客户端(blockApiDefs, {
    baseUrl: 'http://127.0.0.1:6806',
    apiToken: window.siyuan.config.api.token
});
const response = await client.getBlockInfo({
    id: blockId
}); // response 自动具有正确的类型

// 不推荐的类型使用
const response: any = await client.getBlockInfo({ id: blockId });
const blockInfo = response.data as any; // 不安全的断言
```

## 4. 验证要求

### 4.1 类型检查验证

#### 4.1.1 编译验证

- **必须**确保TypeScript编译无错误
- **必须**验证所有API调用的类型推断正确
- **应该**检查是否有新的类型错误产生
- **不得**使用`@ts-ignore`绕过类型检查

#### 4.1.2 类型覆盖验证

- **必须**验证API请求参数的类型完整性
- **必须**验证API响应数据的类型准确性
- **应该**确认错误响应的类型处理正确

### 4.2 功能测试验证

#### 4.2.1 单元测试要求

- **必须**运行所有相关的单元测试
- **必须**确保测试通过率保持100%
- **应该**为新的SDK调用添加测试用例
- **不应**跳过任何失败的测试

#### 4.2.2 集成测试要求

- **应该**验证API调用在实际业务场景中正常工作
- **应该**测试错误处理逻辑的正确性
- **应该**验证异步调用的时序正确性

### 4.3 回归验证

#### 4.3.1 行为一致性验证

- **必须**验证迁移前后的API调用行为完全一致
- **必须**确认响应数据的结构和内容不变
- **不得**改变现有功能的用户体验

#### 4.3.2 性能验证

- **应该**验证API调用性能没有显著下降
- **应该**监控内存使用情况
- **不宜**引入明显的性能回归

---

## 5. 注意事项

### 5.1 兼容性考虑

#### 5.1.1 向后兼容性

- **不得**破坏现有的API调用接口
- **应该**保持错误码和错误信息的一致性
- **应该**维持异步调用的时序特性

#### 5.1.2 渐进式迁移

- **应该**按模块或功能区域分批迁移
- **应该**优先迁移低风险的调用点
- **不宜**一次性迁移所有调用点

### 5.2 错误处理注意事项

#### 5.2.1 错误传播

- **必须**正确传播SDK客户端的错误信息
- **不得**丢失原有的错误上下文
- **应该**保持错误处理的粒度一致

#### 5.2.2 异常安全

- **必须**确保异常情况下的资源正确释放
- **应该**避免因API调用失败导致的内存泄漏
- **不应**在错误处理中引入新的异常

### 5.3 性能考虑

#### 5.3.1 调用开销

- **应该**评估SDK客户端的调用开销
- **不宜**在高频调用场景中引入显著延迟
- **应该**考虑批量调用的优化可能性

#### 5.3.2 内存管理

- **应该**注意SDK客户端的内存使用模式
- **不应**因迁移导致内存使用量显著增加
- **应该**及时释放不再使用的响应数据

---

## 6. 相关文档

### 6.1 规程文档

- [`.roo/rules/规程.md`](../../../.roo/rules/规程.md) - 规程编写规范
- [`docs/规程/代码质量/类型守卫重构.procedure.md`](./类型守卫重构.procedure.md) - 类型守卫重构规程

### 6.2 SDK文档

- [`kernelSDKTS/README.md`](../../../kernelSDKTS/README.md) - kernelSDKTS使用文档
- [`kernelSDKTS/types/index.d.ts`](../../../kernelSDKTS/types/index.d.ts) - SDK类型定义

### 6.3 配置文件

- [`app/tsconfig.json`](../../../app/tsconfig.json) - TypeScript配置文件

---

**文档版本**: 1.0.0
**创建时间**: 2026-02-01
**最后更新**: 2026-02-01
**维护者**: Roo (Code Mode)

## 2. 前置条件

### 2.1 代码分析要求

#### 2.1.1 调用点识别

- **必须**识别所有使用`fetchPost`和`fetchPostSync`的文件
- **必须**分析每个调用点的参数类型和返回值处理
- **应该**统计不同API端点的调用频率
- **应该**记录复杂的错误处理逻辑

#### 2.1.2 依赖关系分析

- **必须**分析API调用的上下文依赖
- **必须**确认kernelSDKTS客户端的可用性
- **应该**识别可能的循环依赖风险
- **不应**在SDK客户端不稳定时开始迁移

### 2.2 SDK准备要求

#### 2.2.1 客户端验证

- **必须**确认kernelSDKTS客户端已正确初始化
- **必须**验证目标API端点在SDK中已实现
- **应该**测试SDK客户端的基本功能正常
- **不宜**使用未经测试的SDK版本

#### 2.2.2 类型定义验证

- **必须**确认API请求和响应的类型定义完整
- **应该**验证类型定义与实际API行为一致
- **应该**检查是否存在类型定义缺失的端点

### 2.3 测试准备要求

- **必须**创建对应的ttt文档记录迁移计划
- **应该**准备回归测试用例覆盖关键功能
- **应该**建立迁移前后的行为对比基准

---