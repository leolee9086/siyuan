# @leolee9086/siyuan-kernel-api-schemas

This package provides Zod schema definitions for the [SiYuan Note](https://b3log.org/siyuan/) Kernel API. These definitions are invaluable for:

-   Generating type-safe API clients (like those in the `my-siyuan-kernel-SDK` project).
-   Building mock servers for testing.
-   Validating request and response payloads.

This package is part of the `my-siyuan-kernel-SDK` monorepo.

## Installation

```bash
npm install @leolee9086/siyuan-kernel-api-schemas zod
# or
yarn add @leolee9086/siyuan-kernel-api-schemas zod
# or
pnpm add @leolee9086/siyuan-kernel-api-schemas zod
```

Note: `zod` is a peer dependency and needs to be installed alongside this package.

## Package Structure

This package exports API definitions grouped by their respective modules, mirroring the structure of SiYuan Note's backend API.

Each `*.js` file (e.g., `system.js`, `block.js`) typically exports an array named `[moduleName]ApiDefs` (e.g., `systemApiDefs`, `blockApiDefs`). Each element in this array is an object describing a single API endpoint.

An `index.js` file is provided to re-export all definitions, allowing for easier imports:

```javascript
// Import all definitions from system.js
import { systemApiDefs } from '@leolee9086/siyuan-kernel-api-schemas/system';

// Or, if you prefer to import specific named exports if index.js exports them individually (less common for arrays)
// For example, if index.js did: export const systemApiDefs = ... (from ./system.js)
// import { systemApiDefs, blockApiDefs } from '@leolee9086/siyuan-kernel-api-schemas';

// Recommended way to get all definitions from a specific file:
import * as systemAllDefs from '@leolee9086/siyuan-kernel-api-schemas/system';
// then access systemAllDefs.systemApiDefs

// If the index.js exports all modules' content:
import { accountApiDefs, aiApiDefs /*, ... otherApiDefs */ } from '@leolee9086/siyuan-kernel-api-schemas';
```

## Structure of an API Definition Object

Each API definition object within the exported arrays generally follows this structure:

```javascript
{
  en: 'getSomething', // English name/identifier, often used for method naming in clients
  zh_cn: '获取某某',    // (Optional) Chinese name for the API
  endpoint: '/api/module/getSomething', // The API endpoint path
  method: 'POST',      // HTTP method (e.g., 'POST', 'GET')
  zodRequestSchema: () => ({ // (Optional) Function returning a Zod raw shape for the request body
    id: z.string().describe('Unique identifier'),
    // ... other request parameters as Zod types
  }),
  zodResponseSchema: () => ({ // (Optional) Function returning a Zod raw shape for the response body
    data: z.any().describe('Response data'),
    // ... other response fields as Zod types
  }),
  description: 'A brief description of what the API does.', // (Optional) English description
  // zh_CN_desc: 'API 功能的中文简述', // (Optional) Chinese description (convention may vary)
  deprecated: 'true' or 'Deprecated since vX.X, use newApi instead', // (Optional) Deprecation status/message
  groupName: 'moduleName', // (Optional) Logical group name, e.g., 'system', 'block'
}
```

**Key Fields Explained:**

-   `en` (string): Primary identifier, often in camelCase, used for generating client method names.
-   `zh_cn` (string, optional): Chinese name for the API, useful for documentation or UI elements.
-   `endpoint` (string): The server path for the API (e.g., `/api/system/version`).
-   `method` (string): The HTTP method (e.g., `POST`, `GET`, `PUT`, `DELETE`).
-   `zodRequestSchema` (function, optional): A function that returns an object. This object is a "Zod raw shape", where keys are parameter names and values are Zod type instances (e.g., `z.string()`, `z.number().optional()`). This defines the expected structure and types for the request body or query parameters.
-   `zodResponseSchema` (function, optional): Similar to `zodRequestSchema`, but defines the expected structure and types for the API's response body.
-   `description` (string, optional): A human-readable description of the API's purpose.
-   `deprecated` (string | boolean, optional): If present, indicates that the API is deprecated. The value might be a boolean or a string message with details.
-   `groupName` (string, optional): A logical grouping category for the API (e.g., `system`, `filetree`). This was primarily used by the multi-file client generator in the main SDK.

## How to Use

These schemas are powerful when combined with Zod for runtime validation or with tools that can parse these definitions for code generation.

**Example: Validation with Zod**

```javascript
import { z } from 'zod';
import { someApiDefs } from '@leolee9086/siyuan-kernel-api-schemas/someModule'; // or from the main index.js

// Assuming 'someApi' is one of the definitions in the someApiDefs array
const someApi = someApiDefs.find(def => def.en === 'createItem');

if (someApi && someApi.zodRequestSchema) {
  const RequestBodySchema = z.object(someApi.zodRequestSchema());
  try {
    const validatedData = RequestBodySchema.parse({ /* your data here */ });
    console.log('Data is valid!', validatedData);
    // Proceed with API call
  } catch (error) {
    console.error('Validation failed:', error.errors);
  }
}
```

**Example: Input for Code Generators**

The `generateApiClients.cjs` and `generateSingleFileClient.cjs` scripts within the `my-siyuan-kernel-SDK` project consume these definitions to produce JavaScript API clients.

## License

This package is licensed under the **AGPL-3.0-or-later**. You should find a `LICENSE` file in the root of this package upon distribution or in the main `my-siyuan-kernel-SDK` repository.

---
*This README is for the `@leolee9086/siyuan-kernel-api-schemas` package. Also available in [Chinese (中文版)](./README_zh-CN.md).* 