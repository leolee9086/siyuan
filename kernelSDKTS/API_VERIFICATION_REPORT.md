# API 定义核对报告

> 生成时间: 2025-12-28 20:20
> 核对范围: 从 `MIGRATION_GUIDE.md` 中选取关键 API 与 Go 后端代码进行比对

---

## 核对方法

1. 查看 `kernel/api/*.go` 中的 Go 处理函数
2. 提取请求参数: `arg["fieldName"].(type)` 类型断言
3. 提取响应类型: `ret.Data = xxx` 赋值
4. 与 `kernelSDKTS/src/apiDefs/*.ts` 中的 Zod Schema 定义进行比对

---

## 核对结果

### ❌ 问题 1: `/api/block/insertBlock` 请求参数定义不匹配

| 位置 | Go 实现 (`kernel/api/block_op.go:572-633`) | TS 定义 (`kernelSDKTS/src/apiDefs/block.ts:127-143`) |
|------|-------------------------------------------|-----------------------------------------------------|
| 参数 | `data`, `dataType`, `parentID?`, `previousID?`, `nextID?` | ❌ `anchorID`, `data`, `dataType`, `isBefore` |

**问题描述**:
TS 定义使用了 `anchorID` 和 `isBefore` 参数，这与 Go 后端实现完全不同！

**Go 代码实际参数**:
```go
data := arg["data"].(string)
dataType := arg["dataType"].(string)
var parentID, previousID, nextID string
if nil != arg["parentID"] { parentID = arg["parentID"].(string) }
if nil != arg["previousID"] { previousID = arg["previousID"].(string) }
if nil != arg["nextID"] { nextID = arg["nextID"].(string) }
```

**正确的 TS Schema**:
```typescript
zodRequestSchema: z.object({
    data: z.string().describe('要插入的内容'),
    dataType: z.enum(['markdown', 'dom']).describe('指定 data 参数的类型'),
    parentID: z.string().optional().describe('父块的 ID，作为子块插入'),
    previousID: z.string().optional().describe('前一个同级块的 ID，插入在其后'),
    nextID: z.string().optional().describe('后一个同级块的 ID，插入在其前'),
}),
```

**严重程度**: 🔴 **高** - 使用当前 TS 定义调用 API 会导致参数错误

---

### ✅ 问题 2: `/api/block/getBlockInfo` 定义正确

| 组件 | 状态 |
|------|------|
| 请求参数 | ✅ `id: string` 正确 |
| 响应类型 | ✅ `{box, path, rootID, rootTitle, rootChildID, rootIcon}` 正确 |

Go 返回:
```go
ret.Data = map[string]string{
    "box":         block.Box,
    "path":        block.Path,
    "rootID":      block.RootID,
    "rootTitle":   rootTitle,
    "rootChildID": rootChildID,
    "rootIcon":    icon,
}
```

TS 定义:
```typescript
const 块信息Schema = z.object({
    box: z.string(),
    path: z.string(),
    rootID: z.string(),
    rootTitle: z.string(),
    rootChildID: z.string(),
    rootIcon: z.string(),
});
```

---

### ⚠️ 问题 3: `/api/filetree/createDocWithMd` 包含前端附加参数

| 参数 | Go 后端 | TS 定义 | 状态 |
|------|---------|---------|------|
| `notebook` | ✅ 必需 | ✅ 必需 | 一致 |
| `path` | ✅ 必需 | ✅ 必需 | 一致 |
| `markdown` | ✅ 必需 | ✅ 必需 | 一致 |
| `parentID` | ✅ 可选 | ✅ 可选 | 一致 |
| `id` | ✅ 可选 | ✅ 可选 | 一致 |
| `tags` | ✅ 可选 | ✅ 可选 | 一致 |
| `withMath` | ✅ 可选 | ✅ 可选 | 一致 |
| `clippingHref` | ✅ 可选 | ✅ 可选 | 一致 |
| `listDocTree` | ❌ 不处理 | ✅ 可选 | ⚠️ 前端附加 |
| `callback` | ❌ 不处理 | ✅ 可选 | ⚠️ 前端附加 |

**说明**: `listDocTree` 和 `callback` 参数是给前端事件处理用的，通过 `pushCreate()` 函数转发，Go API 本身不处理。这不影响 API 调用，但应该在文档中说明这些参数的特殊性。

---

## 总结

| API | 状态 | 需要修复 |
|-----|------|----------|
| `/api/block/insertBlock` | ❌ 参数错误 | 是，高优先级 |
| `/api/block/getBlockInfo` | ✅ 正确 | 否 |
| `/api/filetree/createDocWithMd` | ⚠️ 可用但有前端参数 | 否，可以考虑添加注释 |

---

## 修复建议

### 修复 `/api/block/insertBlock`

将 `block.ts` 中 insertBlock 的定义修改为:

```typescript
{
    method: 'POST',
    endpoint: '/api/block/insertBlock',
    en: 'insertBlock',
    zh_cn: '插入块',
    description: '在指定位置插入新的内容块。',
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: z.object({
        data: z.string().describe('要插入的内容'),
        dataType: 数据类型Schema.describe('指定 data 参数的类型'),
        parentID: z.string().optional().describe('父块的 ID，插入为其子块'),
        previousID: z.string().optional().describe('前一个同级块的 ID，插入在其后'),
        nextID: z.string().optional().describe('后一个同级块的 ID，插入在其前'),
    }),
    zodResponseSchema: 创建响应Schema(插入块结果Schema),
},
```
