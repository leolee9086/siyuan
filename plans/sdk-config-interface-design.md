# SDK 可配置项接口设计文档

## 1. 现有架构分析

### 1.1 kernelSDKTS 目录结构

```
kernelSDKTS/
├── src/
│   ├── index.ts              # 入口文件，导出客户端工厂和类型
│   ├── client/
│   │   ├── factory.ts        # 客户端工厂核心实现
│   │   ├── types.ts          # 客户端类型定义
│   │   └── index.ts          # 客户端模块导出
│   └── apiDefs/
│       ├── index.ts          # API定义统一导出
│       ├── types.ts          # 通用类型（标准响应Schema等）
│       ├── account.ts        # 账户相关API
│       ├── system.ts         # 系统相关API
│       ├── transactions.ts   # 事务API
│       ├── file.ts           # 文件API
│       ├── block/            # 块操作API（已拆分子模块）
│       └── ...               # 其他API模块
├── scripts/                  # 工具脚本
└── docs/                     # 文档
```

### 1.2 现有客户端配置（[`客户端配置`](kernelSDKTS/src/client/types.ts:9)）

```typescript
export interface 客户端配置 {
    /** 服务器基础 URL，默认 http://127.0.0.1:6806 */
    baseUrl?: string;
    /** API 认证令牌 */
    apiToken?: string;
    /** 自定义 fetch 实现，用于测试或特殊环境 */
    customFetch?: typeof fetch;
}
```

**现有配置的局限性：**
- 仅支持基础连接配置
- 无错误处理钩子
- 无响应拦截机制
- 无消息处理配置
- 无超时控制

### 1.3 fetchPost 特殊处理逻辑分析

从 [`app/src/util/fetch.ts`](app/src/util/fetch.ts:1) 中提取的关键处理逻辑：

#### 1.3.1 HTTP 状态码处理

| 状态码 | 处理方式 | 位置 |
|--------|----------|------|
| 401 | 3秒后自动刷新页面 | [`handleFetchResponse`](app/src/util/fetch.ts:149) |
| 403 | 返回错误响应对象 `{code: -403}` | [`handleFetchResponse`](app/src/util/fetch.ts:141) |
| 404 | 返回错误响应对象 `{code: -404}` | [`handleFetchResponse`](app/src/util/fetch.ts:141) |
| 202 | getFile API 特殊处理，调用 failCallback | [`fetchPost`](app/src/util/fetch.ts:255) |

#### 1.3.2 特殊 API 处理

| API | 特殊处理 | 位置 |
|-----|----------|------|
| `/api/transactions` | 网络失败触发 `kernelError()` | [`handleFetchError`](app/src/util/fetch.ts:111) |
| `/api/system/exit` | 通知 Electron 退出 | [`handleFetchError`](app/src/util/fetch.ts:117) |
| `/api/system/setWorkspaceDir` | 通知 Electron 退出 | [`handleFetchError`](app/src/util/fetch.ts:117) |
| `/api/file/getFile` | 失败时优先调用 failCallback | [`handleFetchError`](app/src/util/fetch.ts:101) |

#### 1.3.3 竞态控制 API

```typescript
const 需要竞态控制的API列表 = [
    "/api/search/searchRefBlock",
    "/api/graph/getGraph",
    "/api/graph/getLocalGraph",
    "/api/block/getRecentUpdatedBlocks",
    "/api/search/fullTextSearchBlock",
];
```

#### 1.3.4 消息处理逻辑

[`processMessage`](app/src/util/processMessage.ts:73) 函数处理：
- `cmd: "msg"` - 显示消息
- `cmd: "cmsg"` - 隐藏消息
- `cmd: "cprogress"` - 移除进度条
- `cmd: "reloadui"` - 触发 UI 重载
- `code < 0` - 显示提示/错误消息

---

## 2. ISDKConfig 接口设计

### 2.1 设计原则

1. **分层配置**：全局默认 → 实例配置 → 单次请求覆盖
2. **类型安全**：完整的 TypeScript 类型支持
3. **可选性**：所有配置项均为可选，有合理默认值
4. **可扩展性**：支持自定义钩子和处理器
5. **环境适配**：支持浏览器、Electron、Node.js 等环境

### 2.2 核心接口定义

```typescript
/**
 * SDK 配置接口
 * 支持全局配置和单次请求覆盖
 */
export interface ISDKConfig {
    // ========== 连接配置 ==========
    /** 服务器基础 URL */
    baseUrl?: string;
    /** API 认证令牌 */
    apiToken?: string;
    /** 自定义 fetch 实现 */
    customFetch?: typeof fetch;
    /** 请求超时时间（毫秒），默认 30000 */
    timeout?: number;
    /** 自定义请求头 */
    headers?: Record<string, string>;

    // ========== 响应处理钩子 ==========
    /** 401 未授权响应处理 */
    onUnauthorized?: IUnauthorizedHandler;
    /** 403 禁止访问响应处理 */
    onForbidden?: IForbiddenHandler;
    /** 404 资源不存在响应处理 */
    onNotFound?: INotFoundHandler;
    /** 202 响应处理（如 getFile 文件未就绪） */
    on202Response?: I202ResponseHandler;

    // ========== 错误处理钩子 ==========
    /** 事务 API 网络失败处理 */
    onTransactionError?: ITransactionErrorHandler;
    /** 退出相关 API 失败处理 */
    onExitApiError?: IExitApiErrorHandler;
    /** 通用网络错误处理 */
    onNetworkError?: INetworkErrorHandler;

    // ========== 消息处理配置 ==========
    /** 是否处理后端消息（cmd 字段），默认 true */
    processMessage?: boolean;
    /** 是否显示错误消息（code < 0），默认 true */
    showErrorMessage?: boolean;
    /** 是否显示提示消息（code === -2），默认 true */
    showInfoMessage?: boolean;
    /** 消息显示超时时间（毫秒），0 表示不自动关闭 */
    messageTimeout?: number;
    /** 自定义消息显示函数 */
    showMessage?: IShowMessageFn;
    /** 自定义消息隐藏函数 */
    hideMessage?: IHideMessageFn;

    // ========== 响应验证配置 ==========
    /** 是否验证响应格式符合 IWebSocketData，默认 true */
    validateResponse?: boolean;
    /** 自定义响应验证函数 */
    responseValidator?: IResponseValidator;

    // ========== 竞态控制配置 ==========
    /** 是否启用竞态控制，默认 true */
    enableRaceControl?: boolean;
    /** 需要竞态控制的 API 列表（追加到默认列表） */
    raceControlApis?: string[];
}
```

### 2.3 处理器类型定义

```typescript
/**
 * 标准响应数据结构
 */
export interface IWebSocketData {
    code: number;
    msg: string;
    data: unknown;
    cmd?: string;
}

/**
 * 请求上下文，传递给处理器
 */
export interface IRequestContext {
    /** 请求 URL */
    url: string;
    /** 请求方法 */
    method: string;
    /** 请求数据 */
    data?: unknown;
    /** 原始 Response 对象 */
    response?: Response;
}

/**
 * 401 未授权处理器
 * @returns 返回 true 表示已处理，SDK 不再执行默认行为
 */
export type IUnauthorizedHandler = (
    context: IRequestContext
) => boolean | void | Promise<boolean | void>;

/**
 * 403 禁止访问处理器
 */
export type IForbiddenHandler = (
    context: IRequestContext,
    response: IWebSocketData
) => boolean | void | Promise<boolean | void>;

/**
 * 404 资源不存在处理器
 */
export type INotFoundHandler = (
    context: IRequestContext,
    response: IWebSocketData
) => boolean | void | Promise<boolean | void>;

/**
 * 202 响应处理器
 */
export type I202ResponseHandler = (
    context: IRequestContext,
    response: IWebSocketData
) => boolean | void | Promise<boolean | void>;

/**
 * 事务 API 错误处理器
 */
export type ITransactionErrorHandler = (
    context: IRequestContext,
    error: Error
) => boolean | void | Promise<boolean | void>;

/**
 * 退出 API 错误处理器
 */
export type IExitApiErrorHandler = (
    context: IRequestContext,
    error: Error
) => boolean | void | Promise<boolean | void>;

/**
 * 通用网络错误处理器
 */
export type INetworkErrorHandler = (
    context: IRequestContext,
    error: Error
) => boolean | void | Promise<boolean | void>;

/**
 * 消息显示函数
 */
export type IShowMessageFn = (
    message: string,
    timeout?: number,
    type?: 'info' | 'error'
) => string | void;

/**
 * 消息隐藏函数
 */
export type IHideMessageFn = (messageId: string) => void;

/**
 * 响应验证函数
 */
export type IResponseValidator = (
    response: unknown
) => response is IWebSocketData;
```

### 2.4 单次请求配置覆盖

```typescript
/**
 * 单次请求配置
 * 继承 ISDKConfig 的部分字段，用于覆盖全局配置
 */
export interface IRequestConfig {
    /** 自定义请求头（与全局配置合并） */
    headers?: Record<string, string>;
    /** 请求超时时间 */
    timeout?: number;
    /** 是否处理后端消息 */
    processMessage?: boolean;
    /** 是否显示错误消息 */
    showErrorMessage?: boolean;
    /** 是否验证响应格式 */
    validateResponse?: boolean;
    /** 失败回调（用于特殊 API 如 getFile） */
    failCallback?: (response: IWebSocketData) => void;
}

/**
 * API 方法签名（支持配置覆盖）
 */
export type ApiMethodWithConfig<TReq, TRes> = (
    data: TReq,
    config?: IRequestConfig
) => Promise<TRes>;
```

---

## 3. 配置层级与合并策略

### 3.1 配置优先级

```
单次请求配置 > 客户端实例配置 > 全局默认配置
```

### 3.2 合并规则

| 配置项 | 合并策略 |
|--------|----------|
| `headers` | 深度合并，单次请求优先 |
| `timeout` | 覆盖 |
| `processMessage` | 覆盖 |
| `showErrorMessage` | 覆盖 |
| `validateResponse` | 覆盖 |
| `raceControlApis` | 追加到默认列表 |
| 处理器钩子 | 覆盖（不合并） |

### 3.3 配置合并伪代码

```typescript
function mergeConfig(
    globalConfig: ISDKConfig,
    instanceConfig: ISDKConfig,
    requestConfig?: IRequestConfig
): ISDKConfig {
    return {
        ...globalConfig,
        ...instanceConfig,
        ...requestConfig,
        headers: {
            ...globalConfig.headers,
            ...instanceConfig.headers,
            ...requestConfig?.headers,
        },
        raceControlApis: [
            ...(globalConfig.raceControlApis ?? []),
            ...(instanceConfig.raceControlApis ?? []),
        ],
    };
}
```

---

## 4. 默认配置值

```typescript
/**
 * SDK 全局默认配置
 */
export const DEFAULT_SDK_CONFIG: Required<ISDKConfig> = {
    // 连接配置
    baseUrl: 'http://127.0.0.1:6806',
    apiToken: '',
    customFetch: globalThis.fetch,
    timeout: 30000,
    headers: {},

    // 响应处理钩子（默认无操作，使用 SDK 内置行为）
    onUnauthorized: () => false,
    onForbidden: () => false,
    onNotFound: () => false,
    on202Response: () => false,

    // 错误处理钩子
    onTransactionError: () => false,
    onExitApiError: () => false,
    onNetworkError: () => false,

    // 消息处理配置
    processMessage: true,
    showErrorMessage: true,
    showInfoMessage: true,
    messageTimeout: 0,
    showMessage: () => {},
    hideMessage: () => {},

    // 响应验证配置
    validateResponse: true,
    responseValidator: isWebSocketData,

    // 竞态控制配置
    enableRaceControl: true,
    raceControlApis: [],
};

/**
 * 默认需要竞态控制的 API 列表
 */
export const DEFAULT_RACE_CONTROL_APIS: readonly string[] = [
    '/api/search/searchRefBlock',
    '/api/graph/getGraph',
    '/api/graph/getLocalGraph',
    '/api/block/getRecentUpdatedBlocks',
    '/api/search/fullTextSearchBlock',
];
```

---

## 5. 使用示例

### 5.1 基础用法

```typescript
import { createClient, ISDKConfig } from '@siyuan/kernel-sdk';
import { blockApiDefs } from '@siyuan/kernel-sdk/apiDefs';

// 创建客户端实例
const client = createClient(blockApiDefs, {
    baseUrl: 'http://127.0.0.1:6806',
    apiToken: 'your-token',
});

// 调用 API
const result = await client.getBlockInfo({ id: 'block-id' });
```

### 5.2 自定义错误处理

```typescript
const client = createClient(blockApiDefs, {
    baseUrl: 'http://127.0.0.1:6806',
    
    // 自定义 401 处理
    onUnauthorized: (context) => {
        console.log('认证失效，跳转登录页');
        window.location.href = '/login';
        return true; // 阻止默认行为
    },
    
    // 自定义事务错误处理
    onTransactionError: (context, error) => {
        showDialog('数据同步失败，请检查网络连接');
        return true;
    },
});
```

### 5.3 自定义消息处理

```typescript
const client = createClient(blockApiDefs, {
    // 使用自定义消息组件
    showMessage: (msg, timeout, type) => {
        toast[type](msg, { duration: timeout });
        return 'toast-id';
    },
    hideMessage: (id) => {
        toast.dismiss(id);
    },
    
    // 禁用自动消息显示
    showErrorMessage: false,
    showInfoMessage: false,
});
```

### 5.4 单次请求配置覆盖

```typescript
// 某次请求禁用消息显示
const result = await client.getBlockInfo(
    { id: 'block-id' },
    { showErrorMessage: false }
);

// 某次请求使用自定义超时
const result2 = await client.searchBlock(
    { query: 'keyword' },
    { timeout: 60000 }
);
```

### 5.5 Electron 环境配置

```typescript
import { ipcRenderer } from 'electron';

const client = createClient(blockApiDefs, {
    // Electron 环境下的退出 API 错误处理
    onExitApiError: (context, error) => {
        ipcRenderer.send('SIYUAN_QUIT', location.port);
        return true;
    },
});
```

---

## 6. 环境适配策略

### 6.1 环境检测

```typescript
export type RuntimeEnvironment = 'browser' | 'electron' | 'node';

export function detectEnvironment(): RuntimeEnvironment {
    if (typeof window === 'undefined') {
        return 'node';
    }
    if (typeof (window as any).require === 'function') {
        return 'electron';
    }
    return 'browser';
}
```

### 6.2 环境特定默认配置

| 配置项 | Browser | Electron | Node.js |
|--------|---------|----------|---------|
| `onUnauthorized` | 刷新页面 | 刷新页面 | 抛出异常 |
| `onExitApiError` | 无操作 | IPC 通知退出 | 无操作 |
| `showMessage` | DOM 消息 | DOM 消息 | console.log |

---

## 7. 实现建议

### 7.1 文件结构

```
kernelSDKTS/src/
├── client/
│   ├── config.ts          # ISDKConfig 接口定义
│   ├── defaults.ts        # 默认配置值
│   ├── factory.ts         # 客户端工厂（需修改）
│   ├── handlers.ts        # 内置处理器实现
│   └── types.ts           # 类型定义（需扩展）
```

### 7.2 向后兼容性

- 现有 `客户端配置` 接口保持不变
- `ISDKConfig` 作为扩展接口
- 新增配置项均为可选，默认行为与现有一致

### 7.3 实现优先级

1. **P0 - 核心配置**：`timeout`, `headers`, `validateResponse`
2. **P1 - 错误处理**：`onUnauthorized`, `onForbidden`, `onNotFound`
3. **P2 - 消息处理**：`processMessage`, `showMessage`, `hideMessage`
4. **P3 - 高级特性**：竞态控制、环境适配

---

## 8. 与现有代码的映射关系

| fetchPost 逻辑 | ISDKConfig 配置项 |
|----------------|-------------------|
| 401 刷新页面 | `onUnauthorized` |
| 403/404 返回错误对象 | `onForbidden` / `onNotFound` |
| 202 getFile 处理 | `on202Response` |
| transactions 网络失败 | `onTransactionError` |
| exit API 失败 | `onExitApiError` |
| processMessage 调用 | `processMessage` + `showMessage` |
| 响应格式验证 | `validateResponse` + `responseValidator` |
| reqId 竞态控制 | `enableRaceControl` + `raceControlApis` |

---

## 9. 总结

本设计文档定义了 `ISDKConfig` 接口，将 [`fetchPost`](app/src/util/fetch.ts:236) 中的硬编码逻辑抽象为可配置项，实现：

1. **解耦**：SDK 核心逻辑与 UI 层分离
2. **可测试**：通过配置注入 mock 处理器
3. **可扩展**：支持不同环境的定制化行为
4. **类型安全**：完整的 TypeScript 类型支持

后续实现应按照本文档的接口定义进行，确保与现有 `fetchPost` 行为的兼容性。
