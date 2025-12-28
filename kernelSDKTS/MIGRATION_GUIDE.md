# apiDefs 迁移指南

本文档说明如何将 `kernelSDK/packages/apiDefs/*.js` 迁移到 `kernelSDKTS/src/apiDefs/*.ts`。

## 一、迁移前准备

### 1.1 需要阅读的文件

| 文件 | 用途 |
|------|------|
| `kernelSDK/packages/apiDefs/<分组>.js` | 现有的 JS API 定义 (迁移源) |
| `kernel/api/<分组>.go` | 后端 Go 实现代码 (类型校验参考) |
| `kernelSDKTS/rawApiList.json` | 从 router.go 解析出的 API 元数据 |
| `kernelSDKTS/src/apiDefs/types.ts` | 通用类型和工具函数 |
| `kernelSDKTS/src/client/types.ts` | `Api定义` 接口定义 |

### 1.2 迁移文件模板

```typescript
/**
 * <分组名>相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

export const <分组名>ApiDefs = [
  {
    method: 'POST',           // HTTP 方法
    endpoint: '/api/xxx/yyy', // 端点路径
    en: 'methodName',         // 英文方法名 (对应 Go 处理函数名)
    zh_cn: '中文名称',
    description: '功能描述',
    needAuth: true,           // 是否需要认证
    needAdminRole: false,     // 是否需要管理员权限
    unavailableIfReadonly: false, // 只读模式下是否不可用
    zodRequestSchema: z.object({
      // 请求参数
    }),
    zodResponseSchema: 创建响应Schema(
      // 响应数据类型
    ),
  },
  // ... 更多 API
] as const satisfies readonly Api定义[];

export type <分组名>ApiDefs = typeof <分组名>ApiDefs;
```

---

## 二、类型正确性校验指南

JS 定义文件可能存在类型不准确的问题，**必须参照后端 Go 代码进行校验**。

### 2.1 找到对应的 Go 文件

API 分组与 Go 文件的对应关系：

```
/api/account/*  → kernel/api/account.go
/api/block/*    → kernel/api/block.go
/api/filetree/* → kernel/api/filetree.go
...以此类推
```

### 2.2 理解 Go 处理函数结构

以 `/api/account/login` 为例，在 `kernel/api/account.go` 中找到处理函数：

```go
func login(c *gin.Context) {
    // 1. 解析请求参数
    arg, ok := util.JsonArg(c, ret)
    if !ok {
        return
    }

    // 2. 提取各个字段 - 这是请求参数定义
    userName := arg["userName"].(string)
    userPassword := arg["userPassword"].(string)
    captcha := arg["captcha"].(string)
    cloudRegion := int(arg["cloudRegion"].(float64))

    // 3. 调用业务逻辑
    result, err := model.Login(userName, userPassword, captcha, cloudRegion)
    
    // 4. 返回响应 - ret["data"] 的赋值就是响应数据类型
    ret.Data = result
}
```

**从 Go 代码提取类型信息的关键点：**

1. **请求参数**: 看 `arg["fieldName"].(type)` 的类型断言
   - `.(string)` → `z.string()`
   - `.(float64)` → `z.number()` (Go JSON 解析数字为 float64)
   - `.(bool)` → `z.boolean()`
   - `.([]interface{})` → `z.array()`
   - 没有类型断言的通常 → `z.any()`

2. **可选参数**: 看是否有默认值处理
   ```go
   id := arg["id"].(string)              // 必需
   page := int(util.OptVal(arg, "page", 1))  // 可选，有默认值
   ```

3. **响应数据**: 看 `ret.Data = xxx` 的赋值
   - 如果是 `nil` → `z.null()`
   - 如果是结构体 → 去看该结构体定义
   - 如果是 map → `z.record()`

### 2.3 查看结构体定义

响应中的复杂对象通常在 `kernel/model/` 目录下定义：

```go
// kernel/model/xxx.go
type Block struct {
    ID       string `json:"id"`
    Type     string `json:"type"`
    Content  string `json:"content"`
    Children []*Block `json:"children,omitempty"`
}
```

转换为 Zod Schema：

```typescript
const 块Schema = z.object({
  id: z.string(),
  type: z.string(),
  content: z.string(),
  children: z.array(z.lazy(() => 块Schema)).optional(), // 递归结构用 z.lazy()
});
```

### 2.4 JSON tag 对应规则

| Go JSON tag | Zod 处理 |
|-------------|----------|
| `json:"name"` | 字段名为 `name` |
| `json:"name,omitempty"` | 字段可能不存在 → `.optional()` |
| `json:"-"` | 不会出现在 JSON 中，忽略 |

### 2.5 常见类型映射

| Go 类型 | Zod Schema |
|---------|------------|
| `string` | `z.string()` |
| `int`, `int64`, `float64` | `z.number()` |
| `bool` | `z.boolean()` |
| `[]string` | `z.array(z.string())` |
| `map[string]interface{}` | `z.record(z.any())` |
| `interface{}` | `z.any()` |
| `*Type` (指针) | 通常表示可选，用 `.nullable()` 或 `.optional()` |
| `time.Time` | `z.string()` (JSON 序列化为字符串) |

---

## 三、迁移步骤

### 3.1 单个文件迁移流程

1. **创建 TS 文件**: `src/apiDefs/<分组>.ts`

2. **复制 JS 内容并转换语法**:
   - `(z) => ({...})` → `z.object({...})`
   - 添加 `as const satisfies readonly Api定义[]`

3. **校验类型定义**:
   - 打开对应的 Go 文件
   - 逐个 API 检查请求参数和响应结构
   - 修正与 Go 代码不一致的地方

4. **运行类型检查**: `pnpm typecheck`

5. **更新 index.ts 导出**

### 3.2 批量迁移建议

已迁移的简单分组：
1. ✅ `account.ts` (5 个 API)
2. ✅ `ai.ts` (2 个 API)
3. ✅ `archive.ts` (2 个 API)
4. ✅ `bookmark.ts` (3 个 API)
5. ✅ `clipboard.ts` (1 个 API)
6. ✅ `cloud.ts` (1 个 API)
7. ✅ `convert.ts` (1 个 API)
8. ✅ `icon.ts` (1 个 API)
9. ✅ `lute.ts` (3 个 API)
10. ✅ `outline.ts` (1 个 API)
11. ✅ `query.ts` (1 个 API)
12. ✅ `sqlite.ts` (1 个 API)

已迁移的中型分组：
13. ✅ `vector.ts` (8 个 API)
14. ✅ `embedding.ts` (16 个 API)
15. ✅ `riff.ts` (17 个 API)
16. ✅ `repo.ts` (22 个 API)
17. ✅ `asset.ts` (19 个 API)
18. ✅ `bazaar.ts` (24 个 API)
19. ✅ `system.ts` (41 个 API)

待迁移的复杂分组：
- ⏳ `setting.ts` (21 个 API)
- ⏳ `export.ts` (29 个 API)
- ⏳ `filetree.ts` (31 个 API)
- ⏳ `av.ts` (32 个 API, 属性视图, 类型复杂)
- ⏳ `block.ts` (53 个 API, 结构复杂)

---

## 四、校验清单

每个 API 迁移后，检查以下项目：

- [ ] `method` 与 rawApiList.json 一致
- [ ] `endpoint` 与 rawApiList.json 一致  
- [ ] `en` 与 rawApiList.json 一致
- [ ] `needAuth` / `needAdminRole` / `unavailableIfReadonly` 与 rawApiList.json 一致
- [ ] `zodRequestSchema` 中的字段与 Go 代码一致
- [ ] `zodResponseSchema` 中的 data 类型与 Go 代码一致
- [ ] 可选字段正确标记为 `.optional()`
- [ ] 复杂结构体提取为独立的 Schema 常量

---

## 五、有用的命令

```bash
# 类型检查
pnpm typecheck

# 从 Go 代码更新 rawApiList.json
pnpm sync:update

# 校验 apiDefs 与 rawApiList 一致性
pnpm sync:check
```

### 5.1 查看完整性检查结果

运行 `pnpm sync:check` 后，检查结果会自动写入 `sync_check_result.md` 文件。

该文件包含：
- 检查时间
- 问题总数
- 按类型分组的问题列表：
  - **缺失定义文件**: 尚未迁移的 API 分组
  - **缺失API定义**: 具体需要添加的 API 端点
  - **应标记废弃**: 定义中存在但已从后端移除的 API
  - **认证标志不匹配**: `needAuth`/`needAdminRole`/`unavailableIfReadonly` 与后端不一致
  - **en不匹配**: 方法名与后端不一致
  - **缺失zh_cn**: 缺少中文名称
  - **缺失description**: 缺少描述

建议在每次迁移后运行此检查，确保定义与后端一致。
