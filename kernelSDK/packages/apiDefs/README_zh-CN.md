# @leolee9086/siyuan-kernel-api-schemas (思源笔记内核 API Schemas)

本软件包为 [思源笔记](https://b3log.org/siyuan/) 内核 API 提供了 Zod schema 定义。这些定义对于以下场景至关重要：

-   生成类型安全的 API 客户端（例如 `my-siyuan-kernel-SDK` 项目中的客户端）。
-   构建用于测试的模拟服务器。
-   校验请求和响应的载荷。

本软件包是 `my-siyuan-kernel-SDK` monorepo 的一部分。

## 安装

```bash
npm install @leolee9086/siyuan-kernel-api-schemas zod
# 或者
yarn add @leolee9086/siyuan-kernel-api-schemas zod
# 或者
pnpm add @leolee9086/siyuan-kernel-api-schemas zod
```

注意：`zod` 是一个 peer dependency (对等依赖)，需要与本软件包一起安装。

## 软件包结构

本软件包导出的 API 定义按其各自的模块进行分组，反映了思源笔记后端 API 的结构。

每个 `*.js` 文件（例如 `system.js`、`block.js`）通常会导出一个名为 `[moduleName]ApiDefs` 的数组（例如 `systemApiDefs`、`blockApiDefs`）。此数组中的每个元素都是一个描述单个 API 端点的对象。

我们提供了一个 `index.js` 文件来重新导出所有定义，从而简化导入过程：

```javascript
// 从 system.js 导入所有定义
import { systemApiDefs } from '@leolee9086/siyuan-kernel-api-schemas/system';

// 或者，如果您希望从 index.js 导入特定命名导出（对于数组而言不太常见）
// 例如，如果 index.js 执行了：export const systemApiDefs = ... (来自 ./system.js)
// import { systemApiDefs, blockApiDefs } from '@leolee9086/siyuan-kernel-api-schemas';

// 推荐的从特定文件获取所有定义的方式：
import * as systemAllDefs from '@leolee9086/siyuan-kernel-api-schemas/system';
// 然后访问 systemAllDefs.systemApiDefs

// 如果 index.js 导出了所有模块的内容：
import { accountApiDefs, aiApiDefs /*, ... 其他模块的 ApiDefs */ } from '@leolee9086/siyuan-kernel-api-schemas';
```

## API 定义对象的结构

导出的数组中，每个 API 定义对象通常遵循以下结构：

```javascript
{
  en: 'getSomething', // 英文名称/标识符，常用于客户端的方法命名
  zh_cn: '获取某某',    // (可选) API 的中文名称
  endpoint: '/api/module/getSomething', // API 端点路径
  method: 'POST',      // HTTP 方法 (例如 'POST', 'GET')
  zodRequestSchema: () => ({ // (可选) 返回请求体 Zod 原始 shape 的函数
    id: z.string().describe('唯一标识符'),
    // ... 其他请求参数 (Zod 类型)
  }),
  zodResponseSchema: () => ({ // (可选) 返回响应体 Zod 原始 shape 的函数
    data: z.any().describe('响应数据'),
    // ... 其他响应字段 (Zod 类型)
  }),
  description: '关于此 API 功能的简短描述。', // (可选) 英文描述
  // zh_CN_desc: 'API 功能的中文简述', // (可选) 中文描述 (具体字段可能因定义文件而异)
  deprecated: 'true' 或 '已弃用，请使用 newApi', // (可选) 弃用状态/消息
  groupName: 'moduleName', // (可选) 逻辑分组名称，例如 'system', 'block'
}
```

**关键字段说明:**

-   `en` (字符串): 主要标识符，通常为驼峰式命名，用于生成客户端方法名。
-   `zh_cn` (字符串, 可选): API 的中文名称，可用于文档或 UI 元素。
-   `endpoint` (字符串): API 的服务器路径 (例如 `/api/system/version`)。
-   `method` (字符串): HTTP 方法 (例如 `POST`, `GET`, `PUT`, `DELETE`)。
-   `zodRequestSchema` (函数, 可选): 返回一个对象的函数。此对象是一个 "Zod 原始 shape"，其中键是参数名，值是 Zod 类型实例 (例如 `z.string()`, `z.number().optional()`)。这定义了请求体或查询参数的预期结构和类型。
-   `zodResponseSchema` (函数, 可选): 与 `zodRequestSchema` 类似，但定义了 API 响应体的预期结构和类型。
-   `description` (字符串, 可选): API 用途的人类可读描述。
-   `deprecated` (字符串 |布尔值, 可选): 如果存在，则表示该 API 已弃用。该值可以是布尔值或带有详细信息的字符串消息。
-   `groupName` (字符串, 可选): API 的逻辑分组类别 (例如 `system`, `filetree`)。主要由主 SDK 中的多文件客户端生成器使用。

## 如何使用

这些 schema 与 Zod 结合进行运行时校验，或与能够解析这些定义的工具结合进行代码生成时，功能非常强大。

**示例：使用 Zod 进行校验**

```javascript
import { z } from 'zod';
import { someApiDefs } from '@leolee9086/siyuan-kernel-api-schemas/someModule'; // 或从主 index.js 导入

// 假设 'someApi' 是 someApiDefs 数组中的一个定义
const someApi = someApiDefs.find(def => def.en === 'createItem');

if (someApi && someApi.zodRequestSchema) {
  const RequestBodySchema = z.object(someApi.zodRequestSchema());
  try {
    const validatedData = RequestBodySchema.parse({ /* 你的数据 */ });
    console.log('数据有效!', validatedData);
    // 继续 API 调用
  } catch (error) {
    console.error('校验失败:', error.errors);
  }
}
```

**示例：作为代码生成器的输入**

`my-siyuan-kernel-SDK` 项目中的 `generateApiClients.cjs` 和 `generateSingleFileClient.cjs` 脚本会使用这些定义来生成 JavaScript API 客户端。

## 许可证

本软件包采用 **AGPL-3.0-or-later** 许可证。您应该能在发布后的本软件包根目录中，或在 `my-siyuan-kernel-SDK` 主仓库中找到 `LICENSE` 文件。

---
*本 README 适用于 `@leolee9086/siyuan-kernel-api-schemas` 软件包。另请参阅 [English Version (英文版)](./README.md)。* 