# 思源笔记内核 API 客户端 SDK

## 概览

本 SDK 提供了一个脚本 (`generateApiClients.cjs`)，用于根据 `apiDefs` 目录中的 API 定义自动生成与思源笔记内核交互的 JavaScript/TypeScript 客户端。

生成的客户端代码位于 `client/` 目录下，包含了与各个 API 端点交互的方法，并提供了相应的 TypeScript 类型定义。

## 前置要求

-   Node.js (建议使用最新 LTS 版本)
-   `zod` 包 (用于 API 定义中的 schema 校验)。如果你的项目中尚未使用，脚本会在最后提示你安装。

## API 定义 (`apiDefs/`)

`apiDefs/` 目录用于存放 API 的定义文件。每个 `.js` 文件通常代表一个 API 分组 (例如 `file.js` 对应文件相关的 API)。

在每个定义文件中，你需要导出一个名为 `[groupName]ApiDefs` 的数组 (例如 `fileApiDefs`)。数组中的每个对象定义了一个具体的 API 端点，其结构如下：

```javascript
// 例如: apiDefs/system.js
const systemApiDefs = [
  {
    en: 'getVersion', // API 的英文名，用于生成方法名
    zh_CN: '获取内核版本', // API 的中文描述
    endpoint: '/api/system/version', // API 的实际路径
    method: 'GET', // HTTP 方法
    // 以下可选
    needAuth: false, // 是否需要认证 (API Token)
    needAdminRole: false, // 是否需要管理员权限
    unavailableIfReadonly: false, // 只读模式下是否可用
    deprecated: false, // 是否已废弃
    // 使用 zod 定义请求和响应的 schema
    // 如果 API 不需要请求体，可以设置为 () => z.void() 或直接省略
    zodRequestSchema: (z) => ({ // 返回一个原始的 zod shape 对象
      // param1: z.string().describe('参数1的描述'),
      // param2: z.number().optional().describe('可选参数2'),
    }),
    // 或者如果请求体是简单类型，例如：
    // zodRequestSchema: (z) => z.string().describe("ID of the asset"),
    // ----------------------------------------------------------------
    // 如果 API 不需要响应体，可以设置为 () => z.void() 或直接省略
    zodResponseSchema: (z) => ({ // 返回一个原始的 zod shape 对象
      // code: z.number(),
      // msg: z.string(),
      // data: z.object({
      //   version: z.string().describe('内核版本号'),
      // }),
    }),
    // 或者如果响应体是简单类型，例如：
    // zodResponseSchema: (z) => z.array(z.object({ id: z.string(), name: z.string() })),
    // 或者，如果响应体是空对象，但你想明确表示：
    // zodResponseSchema: (z) => z.object({}),
    // 如果 API 明确返回 void (例如 HTTP 204 No Content):
    // zodResponseSchema: (z) => z.void(),
  },
  // ...更多 API 定义
];

module.exports = { systemApiDefs };
```

**关键点**:
-   `zodRequestSchema` 和 `zodResponseSchema` 应该是一个接收 `zod` 实例作为参数并返回 **原始 Zod shape 对象** (例如 `{ key: z.string() }`) 的函数，或者直接返回一个 Zod 类型实例 (如 `z.string()`, `z.array(...)`, `z.void()`)。
-   **不要** 在 `zodRequestSchema` 或 `zodResponseSchema` 中直接返回 `z.object(...)` 的实例，脚本会自动用 `z.object()` 包裹 shape 对象。
-   脚本会根据这些定义生成 TypeScript 接口和 JSDoc。

## 生成 API 客户端

1.  确保你已经根据自己的需求修改或添加了 `apiDefs/` 目录下的 API 定义文件。
2.  在 `my-siyuan-kernel-SDK` 目录下运行以下命令：

    ```bash
    node generateApiClients.cjs
    ```
3.  脚本执行完毕后，你会在 `client/` 目录下找到生成的代码：
    *   `index.js`: `SiyuanClient` 主类和 API 分组实例的导出。
    *   `index.d.ts`: 所有相关的 TypeScript 类型定义，包括请求参数、响应数据和 API 分组接口。
    *   `[groupName].js` (例如 `system.js`, `file.js`): 每个 API 分组对应的类实现。

## 使用生成的客户端

以下是如何在你的项目中使用生成的 `SiyuanClient`：

```javascript
// 假设你在项目的根目录下，并且 client 文件夹在 my-siyuan-kernel-SDK/client/
// 根据你的项目结构调整路径
import { SiyuanClient } from './my-siyuan-kernel-SDK/client/index.js';

// 初始化客户端
const client = new SiyuanClient({
  baseUrl: 'http://127.0.0.1:6806', // 你的思源笔记内核地址
  apiToken: 'YOUR_API_TOKEN_IF_NEEDED', // 如果 API 需要认证，请提供 Token
});

// 调用 API 示例 (假设有一个 getVersion() API)
async function fetchVersion() {
  try {
    const response = await client.version(); // 注意：方法名可能是 'version'，直接在 client 实例上，没有分组
    console.log('Siyuan Kernel Version:', response); 
  } catch (error) {
    console.error('Failed to fetch version:', error.message);
    if (error.data) {
      console.error('Error details:', error.data); // 后端返回的错误信息
    }
  }
}

fetchVersion();

// 调用带参数的 API 示例 (假设有一个 file.getFile() API)
async function fetchFileContent(docPath) {
  try {
    // 假设 getFile 的 zodRequestSchema 是 (z) => ({ path: z.string() })
    // 并且 zodResponseSchema 是 (z) => ({ content: z.string() })
    const params = { path: docPath };
    const response = await client.file.getFile(params);
    console.log(`Content of ${docPath}:`, response.content);
  } catch (error) {
    console.error(`Failed to fetch file ${docPath}:`, error.message);
  }
}

// fetchFileContent('/sy/思源笔记.sy');
```

## 生成单文件 ESM 客户端 (kernelApiClient.js)

除了上述生成多个独立客户端文件的方式外，项目还提供了一个名为 `generateSingleFileClient.cjs` 的脚本，用于生成一个单一的、ESM (ECMAScript Module) 格式的 API 客户端文件。

这个脚本会：
- 读取 `apiDefs/` 目录下的所有 `.js` API 定义文件 (这些文件本身也应为 ESM 格式，使用 `export const ...ApiDefs = [...]` 语法)。
- 生成一个名为 `kernelApiClient.js` 的单文件客户端，该文件包含一个 `KernelApiClient` 类，集成了所有 API 方法。
- 生成的 `kernelApiClient.js` 文件是 ESM 格式，可以直接在现代 JavaScript 项目中使用 `import` 语句导入。

**生成步骤**:

1.  确保 `apiDefs/` 目录下的 API 定义文件是 ESM 格式。
2.  在 `my-siyuan-kernel-SDK` 目录下运行以下命令：

    ```bash
    node generateSingleFileClient.cjs
    ```
3.  脚本执行完毕后，你会在 `my-siyuan-kernel-SDK` 目录下找到生成的 `kernelApiClient.js` 文件。

**使用生成的单文件客户端**:

```javascript
// 假设 kernelApiClient.js 与你的代码在同一目录或可访问路径
import KernelApiClient from './kernelApiClient.js'; 

// 初始化客户端
const client = new KernelApiClient({
  baseUrl: 'http://127.0.0.1:6806', // 你的思源笔记内核地址
  apiToken: 'YOUR_API_TOKEN_IF_NEEDED', // 如果 API 需要认证，请提供 Token
});

// 调用 API 示例 (假设有一个 getVersion() API)
async function fetchVersion() {
  try {
    const response = await client.getVersion(); // 注意：方法直接在 client 实例上，没有分组
    console.log('Siyuan Kernel Version:', response); 
  } catch (error) {
    console.error('Failed to fetch version:', error.message);
    if (error.data) {
      console.error('Error details:', error.data);
    }
  }
}

fetchVersion();
```

生成的 `kernelApiClient.js` 文件内部也包含了详细的 JSDoc 注释，描述了每个方法的参数和返回值。

## TypeScript 类型定义

生成的 `client/index.d.ts` 文件包含了所有必要的 TypeScript 类型定义。当你在 TypeScript 项目中使用客户端时，可以获得完整的类型提示和检查。

```typescript
import { SiyuanClient, SiyuanClientConfig } from './my-siyuan-kernel-SDK/client';
// 假设 API 定义了 GetVersionResponse 接口
import type { GetVersionResponse } from './my-siyuan-kernel-SDK/client';

const config: SiyuanClientConfig = {
  baseUrl: 'http://127.0.0.1:6806',
};

const client = new SiyuanClient(config);

async function main() {
  const versionInfo: GetVersionResponse = await client.system.getVersion();
  // console.log(versionInfo.data.version); // 假设类型如此
}
```
JSDoc 注释也会尽可能引用这些类型，以便在 JavaScript 中也能获得一定的类型提示。

## 自定义配置

在实例化 `SiyuanClient` 时，你可以传入一个配置对象：

-   `baseUrl` (string, 可选): 思源笔记内核的基础 URL。默认为 `http://127.0.0.1:6806`。
-   `apiToken` (string, 可选): 用于 API 认证的 Token。默认为空字符串。
-   `customFetch` (function, 可选): 自定义的 `fetch` 函数实现。默认为环境自带的 `fetch` (浏览器中为 `window.fetch`，Node.js 中为 `global.fetch`)。

## 注意事项

-   本 SDK 的目的是简化与思源笔记内核的 HTTP API 交互，并提供类型安全。
-   请确保 `apiDefs/` 中的定义与实际的内核 API 行为一致。
-   如果内核 API 发生变更，你需要相应地更新 `apiDefs/` 中的定义并重新生成客户端。 

## 更多相关

https://leolee9086.github.io/my-siyuan-dev-guide/kernel-api/ 中包含了后端API端点的更详细介绍