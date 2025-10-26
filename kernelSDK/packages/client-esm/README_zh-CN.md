# 思源笔记内核 ESM 客户端 (`siyuan-kernel-client-esm`)

本软件包提供了一个单文件、ESM (ECMAScript Module) 格式的 API 客户端，用于与 [思源笔记](https://b3log.org/siyuan/) 内核进行交互。它提供了一个 `KernelApiClient` 类，集成了所有可用的 API 方法，方便在现代 JavaScript 和 TypeScript 项目中直接使用。

此客户端基于 API 定义生成，是 `my-siyuan-kernel-SDK` 项目的一部分。

## 特性

-   **单文件**: 易于导入和集成。
-   **ESM 格式**: 使用标准的 `import/export` 语法。
-   **全面性**: 包含了几乎所有思源笔记内核的 API 方法。
-   **JSDoc 注释**: 方法及其参数/返回类型均通过 JSDoc 进行了注释，可在 JavaScript 中提供良好的编辑器自动补全和类型提示。
-   **轻量级**: 客户端本身没有运行时依赖。

## 安装

```bash
npm install siyuan-kernel-client-esm
# 或者
yarn add siyuan-kernel-client-esm
# 或者
pnpm add siyuan-kernel-client-esm
```

## 使用方法

```javascript
import KernelApiClient from 'siyuan-kernel-client-esm';
// 或者，如果你的环境支持且 package.json 的 type 为 "module":
// import KernelApiClient from './node_modules/siyuan-kernel-client-esm/kernelApiClient.js';

// 初始化客户端
const client = new KernelApiClient({
  baseUrl: 'http://127.0.0.1:6806', // 你的思源笔记内核地址
  apiToken: 'YOUR_API_TOKEN_IF_NEEDED', // 如果 API 需要认证，请提供 Token
});

// 示例：获取内核版本
async function fetchKernelVersion() {
  try {
    const version = await client.version(); // 方法名可能因 API 定义而异
    console.log('思源内核版本:', version);
  } catch (error) {
    console.error('获取版本失败:', error.message);
    if (error.data) {
      console.error('错误详情:', error.data);
    }
  }
}

fetchKernelVersion();

// 示例：调用需要参数的 API
async function getDocumentInfo(docId) {
  try {
    // 假设存在一个名为 'getDoc' 的 API，它接受一个 'id' 参数
    // 实际的方法名和参数结构取决于生成客户端时使用的 API 定义
    const docData = await client.getDoc({ id: docId, anotherParam: 'value' });
    console.log('文档数据:', docData);
  } catch (error) {
    console.error(`获取文档 ${docId} 失败:`, error.message);
  }
}

// getDocumentInfo('你的文档ID');
```

## API 客户端生成

此客户端 (`kernelApiClient.js`) 是由 `generateSingleFileClient.cjs` 脚本自动生成的，该脚本是 `my-siyuan-kernel-SDK` 主代码库的一部分。该脚本读取 API 定义（通常来自 `apiDefs` 目录，其中应使用 Zod 定义 schema）并输出这个单文件客户端。

如果你将此软件包作为 monorepo 配置（例如，与 `my-siyuan-kernel-SDK` 一起）的一部分，通常可以通过运行此软件包 `package.json` 中定义的构建脚本（例如，在此软件包目录下运行 `npm run build` 或 `pnpm build`）来重新生成 `kernelApiClient.js`。此构建脚本会调用 `node generateSingleFileClient.cjs`。

## 配置

在实例化 `KernelApiClient` 时，你可以传入一个配置对象：

-   `baseUrl` (字符串, 可选): 思源笔记内核的基础 URL。默认为 `http://127.0.0.1:6806`。
-   `apiToken` (字符串, 可选): 用于 API 认证的 Token。默认为空字符串。
-   `customFetch` (函数, 可选): 自定义的 `fetch` 实现。默认为全局可用的 `fetch`。

## 已知限制

当前版本的生成客户端存在以下已知限制：

*   **FormData 支持**: 该客户端主要为使用 JSON 请求/响应体的 API 设计。它没有内置对需要 `multipart/form-data` 的 API（例如文件上传）的专门支持。对于此类 API，你可能需要手动构建和发送 `FormData` 请求，或扩展客户端的功能。
*   **WebSocket (WS) 支持**: 此客户端使用的底层 `fetch` API 不支持 WebSocket 连接。需要 WebSocket 的操作无法由此客户端处理。
*   **Server-Sent Events (SSE) 支持**: 虽然 `fetch` 可以发起返回 SSE 流的请求，但此客户端未包含解析和处理 SSE 事件流的内置逻辑。如果一个 API 返回 SSE 流，你将收到原始流，并需要自行实现 SSE 解析逻辑。
*   **错误处理**: `_fetchWrapper` 提供了基本的错误处理（在 HTTP 状态非 OK 时拒绝，并尝试解析 JSON 错误响应）。然而，特定的错误码或复杂的错误响应结构可能需要在你的应用程序代码中进行额外处理。

## 许可证

本软件包采用 **AGPL-3.0-or-later** 许可证。有关完整详情，请参阅 [LICENSE](https://www.gnu.org/licenses/agpl-3.0.html) 文件（注意：通常会在主 SDK 项目的根目录或此软件包发布时包含一个单独的 LICENSE 文件）。

---
*本 README 特定于 `siyuan-kernel-client-esm` 软件包。可查阅 [English Version (英文版)](./README.md)。* 