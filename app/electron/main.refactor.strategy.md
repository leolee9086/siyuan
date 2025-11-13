# main.js 类型安全重构策略

## 问题分析

当前 `main.js` 文件存在以下主要问题：

1. **文件过大**：1451行代码全部集中在一个文件中
2. **职责混乱**：同时处理应用程序生命周期、窗口管理、内核进程管理、IPC通信、系统托盘管理、全局热键注册等多种功能
3. **函数过长**：如 `initKernel()` 函数176行，`initMainWindow()` 函数217行
4. **全局变量过多**：大量全局变量增加代码耦合度
5. **错误处理分散**：错误处理逻辑散布在各个函数中
6. **缺乏类型安全**：JavaScript 代码缺乏类型约束，容易出现运行时错误

## 类型安全重构策略

### 1. 技术选型

采用 **JavaScript + JSDoc + Zod 运行时类型检查** 的方案：

1. **保持 JavaScript 扩展名**：Electron 不能直接运行 TypeScript，保持 `.js` 扩展名
2. **JSDoc 类型注解**：使用 JSDoc 提供类型提示和编译时检查
3. **Zod 运行时验证**：使用 Zod 进行运行时类型验证，确保数据安全
4. **渐进式迁移**：先重构结构，再逐步添加类型定义

### 2. 模块划分方案

按照单一职责原则，将 `main.js` 拆分为以下模块：

#### 2.1 核心模块
- `main.js` - 应用程序入口点，只负责初始化和模块协调
- `app.config.js` - 应用程序配置管理
- `app.constants.js` - 应用程序常量定义

#### 2.2 功能模块
- `window.manager.js` - 窗口创建和管理
- `kernel.manager.js` - 内核进程启动和监控
- `ipc.handlers.js` - IPC通信处理
- `tray.manager.js` - 系统托盘管理
- `hotkey.manager.js` - 全局热键管理
- `menu.manager.js` - 应用程序菜单管理
- `error.handler.js` - 统一错误处理
- `logger.js` - 日志记录功能

#### 2.3 工具模块
- `utils.js` - 通用工具函数
- `path.utils.js` - 路径处理工具
- `network.utils.js` - 网络相关工具

#### 2.4 类型定义模块
- `types/index.js` - 全局类型定义
- `types/window.types.js` - 窗口相关类型
- `types/kernel.types.js` - 内核相关类型
- `types/ipc.types.js` - IPC通信类型

### 3. 类型安全设计

#### 3.1 Zod 类型定义示例

```javascript
// types/window.types.js
const { z } = require('zod');

/**
 * @typedef {Object} WindowState
 * @property {boolean} isMaximized - 窗口是否最大化
 * @property {boolean} fullscreen - 窗口是否全屏
 * @property {boolean} isDevToolsOpened - 开发者工具是否打开
 * @property {number} x - 窗口X坐标
 * @property {number} y - 窗口Y坐标
 * @property {number} width - 窗口宽度
 * @property {number} height - 窗口高度
 */

const WindowStateSchema = z.object({
  isMaximized: z.boolean(),
  fullscreen: z.boolean(),
  isDevToolsOpened: z.boolean(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

/**
 * @typedef {Object} CreateWindowOptions
 * @property {number} [width] - 窗口宽度
 * @property {number} [height] - 窗口高度
 * @property {number} [minWidth] - 最小宽度
 * @property {number} [minHeight] - 最小高度
 * @property {boolean} [show] - 是否显示窗口
 * @property {boolean} [frame] - 是否显示边框
 */

const CreateWindowOptionsSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  minWidth: z.number().optional(),
  minHeight: z.number().optional(),
  show: z.boolean().optional(),
  frame: z.boolean().optional(),
});

module.exports = {
  WindowStateSchema,
  CreateWindowOptionsSchema,
};
```

#### 3.2 标准函数形式示例

```javascript
// window.manager.js
const { BrowserWindow } = require('electron');
const { z } = require('zod');
const { WindowStateSchema, CreateWindowOptionsSchema } = require('../types/window.types');

/**
 * @typedef {Object} WindowContext
 * @property {Function} getWindowState - 获取窗口状态
 * @property {Function} setWindowState - 设置窗口状态
 * @property {Function} getMainWindow - 获取主窗口
 */

const createMainWindowDefinition = {
  inputs: {
    options: (zInstance, ctx) => {
      return {
        count: 1,
        scheme: CreateWindowOptionsSchema,
      };
    },
  },
  outputs: {
    window: (zInstance, ctx) => {
      return {
        count: 1,
        scheme: zInstance.instanceof(BrowserWindow),
      };
    },
  },
};

/**
 * 创建主窗口
 * @param {Object} request - 请求参数
 * @param {CreateWindowOptions} request.options - 窗口创建选项
 * @param {undefined} outputs - 输出参数
 * @param {WindowContext} ctx - 上下文
 * @returns {Promise<BrowserWindow>} 主窗口实例
 */
async function createMainWindow(request, outputs, ctx) {
  const windowState = ctx.getWindowState();
  const mainWindow = new BrowserWindow({
    width: request.options.width || windowState?.width || 800,
    height: request.options.height || windowState?.height || 600,
    show: request.options.show ?? false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  
  const newState = {
    isMaximized: false,
    fullscreen: false,
    isDevToolsOpened: false,
    x: mainWindow.getBounds().x,
    y: mainWindow.getBounds().y,
    width: mainWindow.getBounds().width,
    height: mainWindow.getBounds().height,
  };
  
  // 验证状态对象
  const validatedState = WindowStateSchema.parse(newState);
  ctx.setWindowState(validatedState);
  
  return mainWindow;
}

module.exports = {
  createMainWindow,
  createMainWindowDefinition,
};
```

### 4. 模块间通信机制

#### 4.1 类型安全的事件总线

```javascript
// eventBus.js
const { EventEmitter } = require('events');
const { z } = require('zod');

/**
 * @typedef {Object} EventBusEvents
 * @property {Object} app-ready - 应用程序就绪事件
 * @property {Object} window-created - 窗口创建事件
 * @property {string} window-created.windowId - 窗口ID
 * @property {BrowserWindow} window-created.window - 窗口实例
 * @property {Object} kernel-started - 内核启动事件
 * @property {number} kernel-started.port - 端口号
 * @property {number} kernel-started.pid - 进程ID
 * @property {Object} kernel-error - 内核错误事件
 * @property {Error} kernel-error.error - 错误对象
 * @property {number} [kernel-error.code] - 错误代码
 */

const AppReadyEventSchema = z.object({});
const WindowCreatedEventSchema = z.object({
  windowId: z.string(),
  window: z.instanceof(BrowserWindow),
});
const KernelStartedEventSchema = z.object({
  port: z.number(),
  pid: z.number(),
});
const KernelErrorEventSchema = z.object({
  error: z.instanceof(Error),
  code: z.number().optional(),
});

class TypedEventEmitter extends EventEmitter {
  /**
   * 发射事件
   * @param {keyof EventBusEvents} event - 事件名称
   * @param {...any} args - 事件参数
   * @returns {boolean}
   */
  emit(event, ...args) {
    // 运行时类型验证
    switch (event) {
      case 'app-ready':
        AppReadyEventSchema.parse(args[0] || {});
        break;
      case 'window-created':
        WindowCreatedEventSchema.parse(args[0]);
        break;
      case 'kernel-started':
        KernelStartedEventSchema.parse(args[0]);
        break;
      case 'kernel-error':
        KernelErrorEventSchema.parse(args[0]);
        break;
    }
    
    return super.emit(event, ...args);
  }

  /**
   * 监听事件
   * @param {keyof EventBusEvents} event - 事件名称
   * @param {Function} listener - 监听器函数
   * @returns {TypedEventEmitter}
   */
  on(event, listener) {
    return super.on(event, listener);
  }
}

module.exports = new TypedEventEmitter();
```

#### 4.2 类型安全的依赖注入

```javascript
// container.js
const { z } = require('zod');

/**
 * @typedef {Object} ServiceFactory
 * @property {Function} create - 创建服务实例的函数
 * @property {z.ZodType} [schema] - 服务类型验证模式
 */

class TypeSafeContainer {
  constructor() {
    this.services = new Map();
  }

  /**
   * 注册服务
   * @param {string} name - 服务名称
   * @param {ServiceFactory} factory - 服务工厂
   */
  register(name, factory) {
    this.services.set(name, factory);
  }

  /**
   * 获取服务
   * @param {string} name - 服务名称
   * @returns {any} 服务实例
   */
  get(name) {
    const factory = this.services.get(name);
    if (!factory) {
      throw new Error(`Service ${name} not found`);
    }

    const instance = factory.create();
    
    if (factory.schema) {
      const result = factory.schema.safeParse(instance);
      if (!result.success) {
        throw new Error(`Service ${name} type validation failed: ${result.error.message}`);
      }
    }

    return instance;
  }
}

module.exports = new TypeSafeContainer();
```

### 5. 重构实施步骤

#### 阶段1：准备工作
1. 创建模块目录结构
2. 设置事件总线和依赖注入容器
3. 备份原始 `main.js` 文件

#### 阶段2：工具模块提取
1. 提取通用工具函数到 `utils.js`
2. 提取路径处理逻辑到 `path.utils.js`
3. 提取网络相关逻辑到 `network.utils.js`

#### 阶段3：类型定义模块创建
1. 创建 `types/index.js` - 全局类型定义
2. 创建 `types/window.types.js` - 窗口相关类型
3. 创建 `types/kernel.types.js` - 内核相关类型
4. 创建 `types/ipc.types.js` - IPC通信类型

#### 阶段4：功能模块提取
1. 提取日志功能到 `logger.js`
2. 提取错误处理到 `error.handler.js`
3. 提取窗口管理逻辑到 `window.manager.js`
4. 提取内核管理逻辑到 `kernel.manager.js`
5. 提取IPC处理逻辑到 `ipc.handlers.js`
6. 提取托盘管理逻辑到 `tray.manager.js`
7. 提取热键管理逻辑到 `hotkey.manager.js`
8. 提取菜单管理逻辑到 `menu.manager.js`

#### 阶段5：配置和常量提取
1. 提取应用程序配置到 `app.config.js`
2. 提取常量定义到 `app.constants.js`

#### 阶段6：主文件重构
1. 重写 `main.js`，只保留应用程序初始化和模块协调逻辑
2. 使用依赖注入容器管理模块依赖
3. 使用事件总线实现模块间通信

#### 阶段7：类型安全增强
1. 为所有模块添加 JSDoc 类型注解
2. 为关键数据结构添加 Zod 验证
3. 为通用函数实现标准形式

#### 阶段8：测试和优化
1. 测试重构后的代码功能完整性
2. 优化模块间通信性能
3. 完善错误处理和日志记录

### 6. 重构收益

1. **可维护性提升**：每个模块职责单一，代码结构清晰
2. **可测试性增强**：模块独立，便于单元测试
3. **可扩展性改善**：新功能可以独立模块形式添加
4. **代码复用**：通用功能可在多个模块间共享
5. **错误处理统一**：集中式错误处理机制
6. **性能优化**：模块按需加载，减少内存占用
7. **类型安全**：JSDoc + Zod 提供编译时和运行时类型检查

### 7. 风险控制

1. **备份原始文件**：重构前完整备份 `main.js`
2. **分阶段实施**：按阶段逐步重构，每阶段完成后进行测试
3. **功能验证**：确保重构后功能与原始代码一致
4. **性能监控**：监控重构后应用程序性能变化
5. **回滚机制**：如遇重大问题，可快速回滚到原始版本

这个重构策略遵循了哥哥的编码规则，特别是关于模块化、单一职责和代码可维护性的要求。通过 JavaScript + JSDoc + Zod 的方案，既保持了与 Electron 的兼容性，又提供了类型安全保障，可以将一个1451行的庞大文件重构为多个职责明确的小模块，大大提高代码的可读性和可维护性。