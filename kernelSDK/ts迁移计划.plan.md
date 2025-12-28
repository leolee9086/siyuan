# kernelSDK TypeScript 迁移计划

## 核心思路

**放弃字符串代码生成**，利用 TypeScript 类型推断直接从 apiDefs 定义生成类型安全的客户端。

```
当前方式:
  apiDefs.js → generateXXX.cjs → kernelApiClient.ts (3966行生成代码)
  
目标方式:
  apiDefs.ts (带类型) + 客户端工厂 → 类型安全客户端 (无需生成代码)
```

## 一、目标架构

```
packages/
├── apiDefs/
│   ├── types.ts          # 通用类型定义
│   ├── account.ts        # API定义 (带完整类型)
│   ├── block.ts
│   └── ...
├── client/
│   ├── factory.ts        # 客户端工厂 (核心，约100行)
│   ├── index.ts          # 导出入口
│   └── types.ts          # 客户端类型工具
└── index.ts              # 包入口
```

## 二、核心实现

### 2.1 API定义结构 (apiDefs/account.ts)

```typescript
import { z } from 'zod';

// 使用 as const 保留字面量类型
export const accountApiDefs = [
  {
    method: "POST",
    endpoint: "/api/account/login",
    en: "login",
    zh_cn: "登录账号",
    needAuth: true,
    zodRequestSchema: z.object({
      userName: z.string(),
      userPassword: z.string(),
      captcha: z.string(),
      cloudRegion: z.number(),
    }),
    zodResponseSchema: z.object({
      code: z.number(),
      msg: z.string(),
      data: z.any().nullable(),
    }),
  },
  // ...
] as const;

export type AccountApiDefs = typeof accountApiDefs;
```

### 2.2 类型工具 (client/types.ts)

```typescript
import { z } from 'zod';

// 从API定义数组中提取单个定义的类型
type ApiDef = {
  method: string;
  endpoint: string;
  en: string;
  zodRequestSchema: z.ZodType<any>;
  zodResponseSchema: z.ZodType<any>;
  needAuth?: boolean;
};

// 从Zod schema推断TypeScript类型
type InferRequest<T extends ApiDef> = z.infer<T['zodRequestSchema']>;
type InferResponse<T extends ApiDef> = z.infer<T['zodResponseSchema']>;

// 从API定义数组生成方法类型映射
type ApiMethods<TDefs extends readonly ApiDef[]> = {
  [K in TDefs[number]['en']]: (
    data: InferRequest<Extract<TDefs[number], { en: K }>>
  ) => Promise<InferResponse<Extract<TDefs[number], { en: K }>>>;
};

// 最终客户端类型 = 所有API组的方法并集
export type KernelClient<TAllDefs extends readonly ApiDef[]> = ApiMethods<TAllDefs>;
```

### 2.3 客户端工厂 (client/factory.ts)

```typescript
import type { z } from 'zod';

interface ClientOptions {
  baseUrl?: string;
  apiToken?: string;
  customFetch?: typeof fetch;
}

type ApiDef = {
  method: string;
  endpoint: string;
  en: string;
  zodRequestSchema: z.ZodType<any>;
  zodResponseSchema: z.ZodType<any>;
  needAuth?: boolean;
};

// 创建客户端的工厂函数
export function createClient<TDefs extends readonly ApiDef[]>(
  apiDefs: TDefs,
  options: ClientOptions = {}
) {
  const {
    baseUrl = 'http://127.0.0.1:6806',
    apiToken = '',
    customFetch = fetch,
  } = options;

  const client = {} as Record<string, Function>;

  for (const def of apiDefs) {
    client[def.en] = async (data?: unknown) => {
      const url = `${baseUrl}${def.endpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (def.needAuth && apiToken) {
        headers['Authorization'] = `Token ${apiToken}`;
      }

      const response = await customFetch(url, {
        method: def.method,
        headers,
        body: data !== undefined ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        throw new Error(`${def.method} ${def.endpoint} failed: ${response.status}`);
      }

      return response.json();
    };
  }

  // 返回类型推断的客户端
  return client as {
    [K in TDefs[number]['en']]: (
      data: z.infer<Extract<TDefs[number], { en: K }>['zodRequestSchema']>
    ) => Promise<z.infer<Extract<TDefs[number], { en: K }>['zodResponseSchema']>>;
  };
}
```

### 2.4 使用方式

```typescript
import { createClient } from './client/factory';
import { accountApiDefs } from './apiDefs/account';
import { blockApiDefs } from './apiDefs/block';

// 合并所有API定义
const allApiDefs = [...accountApiDefs, ...blockApiDefs] as const;

// 创建类型安全的客户端
const client = createClient(allApiDefs, {
  baseUrl: 'http://127.0.0.1:6806',
  apiToken: 'your-token',
});

// 使用时有完整类型提示！
const result = await client.login({
  userName: 'test',      // ✓ 类型检查
  userPassword: '123',   // ✓ 类型检查
  captcha: 'xxxx',       // ✓ 类型检查
  cloudRegion: 0,        // ✓ 类型检查
});
// result 类型自动推断为 { code: number; msg: string; data: any | null }
```

## 三、迁移步骤

### 阶段一：创建基础设施

1. [ ] 创建 `client/types.ts` - 类型工具
2. [ ] 创建 `client/factory.ts` - 客户端工厂
3. [ ] 测试工厂函数的基本功能

### 阶段二：迁移 apiDefs

4. [ ] 创建 `apiDefs/types.ts` - 通用类型
5. [ ] 迁移试点: `account.js` → `account.ts`
6. [ ] 验证类型推断正确工作
7. [ ] 批量迁移其他 apiDefs 文件

### 阶段三：同步机制

8. [ ] 迁移 `updateApiListFromGo.js` → `.ts`
9. [ ] 创建 `scripts/validateSync.ts` - 直接导入 apiDefs 对比
10. [ ] 创建 `scripts/generateSkeleton.ts` - 新 API 骨架生成
11. [ ] 添加 `pnpm run sync:check` 命令

### 阶段四：整合与测试

12. [ ] 创建统一的导出入口
13. [ ] 测试完整的客户端功能
14. [ ] 对比生成代码与新方案的类型兼容性

### 阶段五：清理

15. [ ] 确认新方案稳定后，逐步移除旧的生成器脚本
16. [ ] 更新文档

## 四、技术要点

### 4.1 关键 TypeScript 特性

- `as const` 断言：保留数组元素的字面量类型
- `z.infer<T>`：从 Zod schema 推断 TS 类型
- 条件类型 `Extract`：从联合类型中提取匹配的成员
- 映射类型：动态生成方法签名

### 4.2 Zod schema 的双重作用

1. **编译时**: TypeScript 通过 `z.infer<>` 提取类型信息
2. **运行时**: 可选用于请求/响应数据验证

### 4.3 保持兼容性选项

如果需要保留旧客户端形式，可以：
- 导出预构建的默认客户端实例
- 或仍保留一个简化的类生成器用于特殊场景

## 五、与 Go 源码同步机制

### 5.1 现有流程

```
router.go (GitHub)
    │
    ▼ updateApiListFromGo.js
rawApiList.json
    │
    ▼ validateApiDefs.js
检查 apiDefs 与 rawApiList 一致性
```

### 5.2 待解决：ginServer.Group 格式不兼容

现有解析脚本只能识别 `ginServer.Handle(...)` 格式：

```go
// ✅ 可以解析
ginServer.Handle("POST", "/api/account/login", model.CheckAuth, login)

// ❌ 无法解析 (Group分组写法)
embeddingGroup := ginServer.Group("/api/embedding", model.CheckAuth)
embeddingGroup.POST("/status", embeddingStatus)
```

**解决方案**: 修改 Go 代码，将 Group 改为 Handle 形式

```go
// 将 embedding 系列 API 改写为：
ginServer.Handle("POST", "/api/embedding/status", model.CheckAuth, embeddingStatus)
ginServer.Handle("POST", "/api/embedding/datasets", model.CheckAuth, embeddingDatasets)
ginServer.Handle("POST", "/api/embedding/blocks/push", model.CheckAuth, model.CheckAdminRole, model.CheckReadonly, embeddingBlocksPush)
// ... 其他 embedding API
```

### 5.3 新方案：利用 TS 类型系统做校验

迁移后可以用更优雅的方式进行同步检查：

#### 方案A：生成类型声明文件用于对比

```typescript
// scripts/syncFromGo.ts
import { writeFile } from 'fs/promises';

// 1. 从 router.go 提取 API 列表 (保留现有逻辑)
const rawApis = await fetchAndParseRouterGo();

// 2. 生成一个 "期望的API" 类型声明
const expectedType = `
// 自动生成，勿手动编辑
// 来源: router.go @ ${new Date().toISOString()}

export type ExpectedApiEndpoints = {
${rawApis.map(api => `  "${api.en}": {
    method: "${api.method}";
    endpoint: "${api.endpoint}";
    needAuth: ${api.needAuth};
  };`).join('\n')}
};
`;

await writeFile('apiDefs/_expected.d.ts', expectedType);
```

#### 方案B：编译时类型检查

```typescript
// apiDefs/_sync.ts
import type { ExpectedApiEndpoints } from './_expected';
import { allApiDefs } from './index';

// 构建实际 API 的类型
type ActualApiEndpoints = {
  [K in typeof allApiDefs[number]['en']]: {
    method: Extract<typeof allApiDefs[number], { en: K }>['method'];
    endpoint: Extract<typeof allApiDefs[number], { en: K }>['endpoint'];
    needAuth: Extract<typeof allApiDefs[number], { en: K }>['needAuth'];
  };
};

// 编译时检查：如果类型不匹配会报错
type AssertEqual<T, U> = T extends U ? (U extends T ? true : never) : never;
type _Check = AssertEqual<ActualApiEndpoints, ExpectedApiEndpoints>;
//                        ^-- 如果有差异，这里会报 never 错误
```

#### 方案C：运行时验证脚本 (推荐)

```typescript
// scripts/validateSync.ts
import { allApiDefs } from '../apiDefs';

async function validateSync() {
  const rawApis = await fetchAndParseRouterGo();
  
  const rawMap = new Map(rawApis.map(a => [`${a.method}|${a.endpoint}`, a]));
  const defMap = new Map(allApiDefs.map(a => [`${a.method}|${a.endpoint}`, a]));
  
  const issues: string[] = [];
  
  // 检查 rawApis 中有但 apiDefs 中没有的 (新增API)
  for (const [key, raw] of rawMap) {
    if (!defMap.has(key)) {
      issues.push(`🆕 新增: ${raw.method} ${raw.endpoint} (${raw.en})`);
    }
  }
  
  // 检查 apiDefs 中有但 rawApis 中没有的 (需标记废弃)
  for (const [key, def] of defMap) {
    if (!rawMap.has(key) && !def.deprecated) {
      issues.push(`⚠️ 应标记废弃: ${def.method} ${def.endpoint}`);
    }
  }
  
  // 检查属性不一致
  for (const [key, def] of defMap) {
    const raw = rawMap.get(key);
    if (raw) {
      if (def.en !== raw.en) {
        issues.push(`❌ en不匹配: ${key} 期望"${raw.en}" 实际"${def.en}"`);
      }
      if (def.needAuth !== raw.needAuth) {
        issues.push(`❌ needAuth不匹配: ${key}`);
      }
    }
  }
  
  if (issues.length > 0) {
    console.log('同步检查发现问题:\n' + issues.join('\n'));
    process.exit(1);
  }
  
  console.log('✅ apiDefs 与 router.go 同步');
}

validateSync();
```

### 5.4 同步工作流

```
开发者更新 Go 代码
     │
     ▼
运行 pnpm run sync:check
     │
     ├── 无差异 → ✅ 通过
     │
     └── 有差异 → 输出报告
              │
              ▼
         手动更新 apiDefs/*.ts
              │
              ▼
         TypeScript 编译检查
              │
              ▼
         客户端类型自动更新
```

### 5.5 与现有脚本的关系

| 现有脚本 | 迁移后 |
|----------|--------|
| `updateApiListFromGo.js` | 保留，继续生成 rawApiList.json 供对比 |
| `validateApiDefs.js` | 可简化，直接导入 TS 模块进行对比 |
| `mergeRawApiWithDefs.js` | 可选保留，用于辅助生成新 API 的骨架代码 |

### 5.6 自动生成 API 骨架

当检测到新 API 时，可以自动生成骨架代码：

```typescript
// scripts/generateApiSkeleton.ts
function generateSkeleton(rawApi: RawApi): string {
  return `  {
    method: "${rawApi.method}" as const,
    endpoint: "${rawApi.endpoint}" as const,
    en: "${rawApi.en}" as const,
    zh_cn: "", // TODO: 填写中文名
    description: "", // TODO: 填写描述
    needAuth: ${rawApi.needAuth},
    needAdminRole: ${rawApi.needAdminRole},
    unavailableIfReadonly: ${rawApi.unavailableIfReadonly},
    zodRequestSchema: z.object({
      // TODO: 定义请求参数
    }),
    zodResponseSchema: z.object({
      code: z.number(),
      msg: z.string(),
      data: z.any().nullable(),
    }),
  },`;
}
```

输出的骨架可以直接粘贴到对应的 apiDefs 文件中。

## 六、对比

| 特性 | 当前方式 (代码生成) | 新方式 (类型推断) |
|------|---------------------|-------------------|
| 生成代码量 | ~4000行 TS | 0 (工厂约100行) |
| 维护成本 | 需同步生成器和定义 | 只需维护定义 |
| 类型更新 | 需重新运行生成器 | 自动推断 |
| IDE体验 | 生成后可用 | 即时可用 |
| 灵活性 | 固定脚本 | 可自定义工厂 |

## 七、参考

- [Zodios](https://www.zodios.org/) - Zod + Axios 的类型安全 API 客户端
- [tRPC](https://trpc.io/) - 端到端类型安全的 API 方案
- [TypeScript Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html)
