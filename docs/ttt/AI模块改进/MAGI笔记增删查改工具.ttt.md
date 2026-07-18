# TTT: MAGI 笔记增删查改工具

## 动机

MAGI 目前缺少文档创建和修改能力。Avatar 是所有非 MAGI 且向 MAGI 汇报的 Agent；内部 Avatar 复用普通 Agent，未来外部 Avatar 可通过 LLM 转发服务接入。Avatar 的身份、任务和报告文档由 MAGI 在 AI 主笔记本中创建和修改；Avatar 不直接取得 MAGI 主笔记的写权限，外部任务目录的修改通过自身 task-directory capability 完成。

## 设计约束

1. 修改前后不能减少叶子块（不可删除），但可以增加或修改
2. 修改后的叶子块标记 `custom-magi-pending="true"`
3. 标记 pending 的叶子块不可被 MAGI 再次修改，直到用户接受
4. 前端 protyle 中 pending 块显示接受按钮
5. pending 默认 7 天过期，过期后自动解除

## 错误码

| 错误码 | HTTP 场景 | 说明 |
|--------|-----------|------|
| `BLOCK_NOT_FOUND` | 后端 | 指定块 ID 不存在 |
| `BLOCK_NOT_LEAF` | 后端 | 目标不是叶子块，不可修改 |
| `BLOCK_ALREADY_PENDING` | 后端 | 块已有 pending 修改未接受 |
| `PARENT_NOT_FOUND` | 后端 | 父块/文档不存在 |
| `AFTER_ID_NOT_DESCENDANT` | 后端 | after_id 不是 parent_id 的后代 |
| `NOTEBOOK_NOT_FOUND` | 后端 | AI 主笔记本未配置 |

## 工具列表

### 1. `create_note_document`

在 AI 主笔记本中创建一篇新文档。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 文档标题 |
| `content` | string | 是 | Markdown 正文 |
| `path` | string | 否 | 存放路径，如 `/avatar/identity/`，默认根路径 |

返回：
```json
{ "document_id": "20240428123456-abc123" }
```

实现：调用 `model.CreateDocByMd(boxID, path, title, md, nil)`，boxID 来自 AI 主笔记本。

### 2. `append_note_blocks`

向已有文档追加叶子块。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `parent_id` | string | 是 | 文档 ID 或容器块 ID |
| `content` | string | 是 | Markdown 内容（多个块用换行分隔） |
| `after_id` | string | 否 | 在此块 ID 之后插入 |

校验：
- parent_id 必须存在且是文档或容器块
- after_id 存在时必须是 parent_id 的后代块
- 只追加新块，不修改已有块

返回：
```json
{ "block_ids": ["id1", "id2"] }
```

### 3. `modify_note_block`

修改一个叶子块的内容和属性。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `block_id` | string | 是 | 叶子块 ID |
| `content` | string | 是 | 新的 Markdown 内容 |
| `attrs` | object | 否 | 要设置的块属性 KV 对 |

安全约束：
- 仅允许修改叶子块（p、h1-h6、li、table、code 等类型）
- 检查块是否存在 `custom-magi-pending` 属性，存在则返回 `BLOCK_ALREADY_PENDING`
- 写入新内容后设置属性：
  - `custom-magi-pending="true"`
  - `custom-magi-pending-time=<Unix毫秒时间戳>`
  - `custom-magi-pending-original=<原内容摘要>`（可选，用于回滚）
  - `custom-magi-pending-expires=<7天后时间戳>`

返回：
```json
{ "block_id": "abc123", "pending": true, "expires_at": 1714912345678 }
```

### 4. `revert_note_block`

回滚 pending 修改，恢复原内容。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `block_id` | string | 是 | 叶子块 ID |

返回：
```json
{ "ok": true, "restored": true }
```

约束：仅当块有 `custom-magi-pending="true"` 时可回滚。回滚后清除所有 pending 属性。

### 5. `accept_note_block`（仅前端触发，不作为 MAGI 工具）

由前端 protyle 按钮调用，通过 `POST /api/block/setAttrs` 移除 pending 属性。

不注册为 MAGI 工具。MAGI 不自调用 accept。

## 属性机制

### 块属性

| 属性 | 值 | 说明 |
|------|-----|------|
| `custom-magi-pending` | `"true"` | 表示该块有未接受的 MAGI 修改 |
| `custom-magi-pending-time` | Unix 毫秒时间戳 | 修改时间 |
| `custom-magi-pending-original` | 原始内容（可选） | 用于回滚 |
| `custom-magi-pending-expires` | Unix 毫秒时间戳 | 过期时间，默认 7 天后 |

### 过期兜底

`modify_note_block` 写入 `custom-magi-pending-expires`，默认 7 天后。后端工具执行时检查：如果当前时间超过 expires，视为已过期，允许重新修改（自动清除旧 pending 属性）。

### 前端 protyle 集成

在 protyle 渲染时，检测块属性 `custom-magi-pending`。当存在时：
- 块右侧显示 `[ACCEPT]` 按钮
- 块边框或背景应用 pending 样式（如橙色边框）
- 点击 ACCEPT → 调用 `POST /api/block/setAttrs` 移除 `custom-magi-pending` 及关联属性

## 后端实现位置

- 工具常量：`kernel/nerv/magi/config/config.go`
- 工具处理：`kernel/nerv/magi/coordinator/note_edit_tool.go`
- 路由（前端 accept 按钮）：使用已有 `POST /api/block/setAttrs`

## 限制

- 所有操作仅限 AI 主笔记本
- 不可跨笔记本操作
- `modify_note_block` 不修改块类型
- pending 检查在工具执行时由后端强制校验，不可绕过
- `accept_note_block` 仅由前端触发，MAGI 不自调用
