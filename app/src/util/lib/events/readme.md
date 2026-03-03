# SafeEventEmitter

SafeEventEmitter是一个基于Zod的类型安全事件发射器，提供了运行时数据验证和灵活的错误处理机制。

## 特性

- **类型安全**: 使用Zod schema定义事件数据结构，确保类型安全
- **运行时验证**: 可选的运行时数据验证，防止无效数据传递
- **灵活的错误处理**: 支持抛出错误、输出警告或静默处理验证失败
- **监听器保护**: 自动捕获监听器中的错误，防止一个监听器的错误影响其他监听器
- **数据完整性**: 可选的监听器执行后数据重新验证，确保数据不被意外修改
- **生命周期友好**: 支持 `subscribe` 返回取消订阅函数，便于组件卸载清理

## 基本用法

### 定义事件类型

```typescript
import { z } from 'zod';
import { SafeEventEmitter } from './eventEmitter';

// 定义事件类型
const eventDefines = {
  userLogin: {
    userId: z.string(),
    username: z.string(),
    timestamp: z.number(),
  },
  messageReceived: {
    messageId: z.string(),
    content: z.string(),
    sender: z.string(),
  }
} as const;
```

### 创建事件发射器

```typescript
// 使用默认选项创建
const emitter = new SafeEventEmitter(eventDefines);

// 使用自定义选项创建
const emitter = new SafeEventEmitter(eventDefines, {
  runtimeCheck: true,           // 启用运行时验证
  validationFailure: 'warn',     // 验证失败时输出警告
  revalidateAfterEach: false,    // 不在监听器执行后重新验证
});
```

### 监听和触发事件

```typescript
// 添加监听器
emitter.on('userLogin', (data) => {
  console.log(`用户 ${data.username} 登录了`);
});

// 推荐：订阅并拿到取消订阅函数
const unsubscribe = emitter.subscribe('userLogin', (data) => {
  console.log('订阅式监听', data.userId);
});
// 后续不需要时可直接调用
unsubscribe();

// 一次性订阅并可主动清理
const unsubscribeOnce = emitter.subscribeOnce('userLogin', (data) => {
  console.log('只处理首次登录', data.userId);
});
unsubscribeOnce();

// 添加一次性监听器
emitter.once('userLogin', (data) => {
  console.log('这是第一次监听到用户登录');
});

// 触发事件
emitter.emit('userLogin', {
  userId: 'user123',
  username: '张三',
  timestamp: Date.now()
});

// 触发带元字段约束事件（用于幂等/顺序控制）
emitter.emitWithMeta('userLogin', {
  userId: 'user123',
  username: '张三',
  timestamp: Date.now(),
  eventId: 'evt-001',
  seq: 1
});
```

## 高级用法

### 动态更新选项

```typescript
// 初始时不启用验证
const emitter = new SafeEventEmitter(eventDefines);

// 稍后启用验证
emitter.setOptions({ 
  runtimeCheck: true, 
  validationFailure: 'warn' 
});

// 部分更新选项
emitter.setOptions({ validationFailure: 'throw' });
```

### 自定义错误处理

```typescript
const emitter = new SafeEventEmitter(eventDefines, {
  runtimeCheck: true,
  validationFailure: 'silent',
  onValidationError: (event, error, data) => {
    // 自定义错误处理逻辑
    console.error(`事件 ${event} 数据验证失败:`, error.issues);
    // 可以发送到错误监控服务
    errorReportingService.report(error, { event, data });
  }
});
```

### 异步事件处理

```typescript
// 添加异步监听器
emitter.on('dataProcessing', async (data) => {
  // 执行异步操作
  await processLargeDataset(data.payload);
});

// 异步触发事件
await emitter.emitAsync('dataProcessing', {
  dataId: 'data123',
  payload: largeDataset
});
```

## 配置选项

### EventEmitterOptions

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| runtimeCheck | boolean | false | 是否启用运行时数据验证 |
| validationFailure | 'throw' \| 'warn' \| 'silent' | 'throw' | 验证失败时的处理方式 |
| revalidateAfterEach | boolean | false | 是否在每个监听器执行后重新验证数据 |
| onValidationError | function | 默认处理函数 | 自定义验证错误处理函数 |

### 验证失败处理方式

- **throw**: 抛出错误，阻止事件继续传播
- **warn**: 输出警告到控制台，事件停止传播
- **silent**: 静默处理，事件停止传播

## 使用场景

### 1. 组件间通信

在复杂的应用中，SafeEventEmitter可以作为组件间的通信总线，确保传递的数据符合预期格式：

```typescript
// 定义组件间通信事件
const componentEvents = {
  userUpdated: {
    userId: z.string(),
    changes: z.record(z.any())
  },
  navigationChanged: {
    from: z.string(),
    to: z.string()
  }
};

const eventBus = new SafeEventEmitter(componentEvents, {
  runtimeCheck: true,
  validationFailure: 'warn'
});

// 组件A监听用户更新
eventBus.on('userUpdated', (data) => {
  updateUserInterface(data);
});

// 组件B触发用户更新
eventBus.emit('userUpdated', {
  userId: 'user123',
  changes: { name: '新名称' }
});
```

### 2. 插件系统

在插件系统中，SafeEventEmitter可以确保插件与主应用之间的数据交换符合约定：

```typescript
// 定义插件API事件
const pluginEvents = {
  pluginLoaded: {
    name: z.string(),
    version: z.string(),
    capabilities: z.array(z.string())
  },
  pluginError: {
    pluginName: z.string(),
    error: z.string(),
    stack: z.string().optional()
  }
};

const pluginManager = new SafeEventEmitter(pluginEvents, {
  runtimeCheck: true,
  validationFailure: 'throw',  // 严格模式，插件错误会导致异常
  onValidationError: (event, error) => {
    // 记录插件系统错误
    logger.error(`插件事件验证失败: ${event}`, error);
  }
});
```

### 3. 状态管理

作为轻量级状态管理解决方案，确保状态变更的数据完整性：

```typescript
// 定义状态变更事件
const stateEvents = {
  stateChanged: {
    module: z.string(),
    prevState: z.any(),
    nextState: z.any(),
    timestamp: z.number()
  }
};

const stateManager = new SafeEventEmitter(stateEvents, {
  runtimeCheck: true,
  validationFailure: 'warn',
  revalidateAfterEach: true,  // 确保监听器不会意外修改状态
});

// 状态变更监听器
stateManager.on('stateChanged', (data) => {
  // 记录状态变更历史
  history.record(data);
});
```

## API 参考

### 方法

- **on(event, listener)**: 添加事件监听器
- **subscribe(event, listener)**: 添加监听器并返回取消订阅函数
- **subscribeOnce(event, listener)**: 添加一次性监听器并返回取消订阅函数
- **once(event, listener)**: 添加一次性事件监听器
- **off(event, listener)**: 移除事件监听器
- **emit(event, data)**: 同步触发事件
- **emitWithMeta(event, data)**: 同步触发带 `eventId/seq` 约束的事件
- **emitAsync(event, data)**: 异步触发事件
- **emitAsyncWithMeta(event, data)**: 异步触发带 `eventId/seq` 约束的事件
- **setOptions(options)**: 更新配置选项
- **enableRuntimeCheck()**: 启用运行时验证
- **disableRuntimeCheck()**: 禁用运行时验证
- **removeAllListeners(event?)**: 移除所有监听器
- **listenerCount(event)**: 获取监听器数量
- **eventNames()**: 获取所有已注册的事件名
- **getEventSchema(event)**: 获取事件的Zod schema

## 注意事项

1. **性能考虑**: 运行时验证会增加性能开销，在生产环境中根据需要决定是否启用
2. **数据修改**: 监听器函数接收的是数据副本，修改不会影响原始数据
3. **错误隔离**: 监听器中的错误会被捕获并记录，不会影响其他监听器的执行
4. **类型推断**: TypeScript会根据事件定义自动推断数据类型，提供完整的类型支持

## 示例项目

查看 `test/util/events/` 目录中的测试文件，了解更多使用示例和边界情况处理。
