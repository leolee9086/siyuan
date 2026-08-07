# MAGI 读写边界调整：读放开、写需引用（引用即授权）执行跟踪 (TikTocTak)

> **目标**: 调整 MAGI 与普通 agent 的笔记读写边界，鼓励把 AI 主笔记本当作管理目录。核心规则：**读取放开（无需引用即可读），写入需引用（只有被 AI 主笔记本直接引用/嵌入的文档才允许写）**；创建类操作仍锁定 AI 主笔记本。普通 agent 后续同规则对齐，且 MAGI 在身份模型上被视为普通 agent 的"用户"（本体/分身模型）。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

## 关联设计

- 上游调研结论见 [`docs/调研/MAGI读写边界对比调研`](../../调研/) 与本任务背景
- 相关既有 ttt：
  - [`AI_Agent任务目录绑定与授权保护.ttt.md`](../AI_Agent任务目录绑定与授权保护.ttt.md)
  - [`MAGI_工作空间管理AI主笔记本落地.ttt.md`](./MAGI_工作空间管理AI主笔记本落地.ttt.md)
  - [`MAGI_工具分类与治理规则.ttt.md`](../MAGI_工具分类与治理规则.ttt.md)

## 核心原则

1. **读放开**: MAGI 阅读工具（`read_note_by_id`、`search_notes_by_keywords`）不再受 AI 主笔记本范围过滤，可读全库。
2. **写需引用**: MAGI 写入工具（`append_note_blocks`、`modify_note_block`、`revert_note_block`、`write_diary_entry`）的目标块必须位于 **AI 主笔记本** 或 **被 AI 主笔记本直接引用（ref）的文档**（`ReferencedRootIDs`）。
3. **创建锁主笔记本**: `create_note_document` 仍强制在 AI 主笔记本中创建。
4. **普通 agent 同规则对齐**: 后续对普通 agent 的写工具注入相同引用约束；读取不受限。
5. **MAGI 视为普通 agent 的用户**: 普通 agent 的确认通道抽象为可注入授权源，MAGI 三贤人治理可作为授权方（本体/分身模型），但 MAGI 不能借此绕过"引用即授权"数据边界。
6. **自主路径**: 心跳/被动回忆等自主运行路径的读取随"读放开"放开（设计使然）。

## 当前同步状态

- **总体状态**: 调研与规则确认已完成；尚未开始实现。
- **工作区约束**: 工作区存在其他未提交改动，本任务只修改与本任务直接相关的文件，不回退、不覆盖无关改动。
- **验证基线**: 待实现后运行 `go test ./nerv/magi/...`、`go test ./mcp/tools`、`go test ./agent`。

## 🟢 近期计划

- [ ] **Phase 1: MAGI 读取放开 (P0)**
  - **背景**: 当前 `read_note_by_id` 与 `search_notes_by_keywords` 受 `AccessibleRootIDs` 范围过滤，范围外文档仅返回文档 ID。
  - **行动**: 修改 [`kernel/nerv/magi/coordinator/note_read_tool.go`](../../../kernel/nerv/magi/coordinator/note_read_tool.go) 与 [`note_query_tool.go`](../../../kernel/nerv/magi/coordinator/note_query_tool.go)，移除读取侧的范围过滤；保留 `purpose` 必填约束。
  - **验收标准**: 读取任意文档 ID 均返回完整内容；相关测试更新通过。

- [ ] **Phase 2: MAGI 写入需引用 (P0)**
  - **背景**: 当前 `ensureAIMainNotebookScope` 只允许 `block.Box == AI主笔记本`。
  - **行动**: 修改 [`note_edit_tool.go`](../../../kernel/nerv/magi/coordinator/note_edit_tool.go) 的 `ensureAIMainNotebookScope`，允许目标块属于 `ReferencedRootIDs`（被 AI 主笔记本引用的文档）；`create_note_document` 仍锁主笔记本。
  - **验收标准**: 对未引用的外部文档写入被拒；对已引用文档可写；测试更新通过。

- [ ] **Phase 3: 普通 agent 写入引用约束 (P1)**
  - **背景**: 普通 agent 走 MCP 注册表，写工具无引用约束。
  - **行动**: 在 MCP 写工具（`document`/`block`/`attr` 等）或 agent 会话层注入与 MAGI 相同的引用约束（可配置开关，默认开启？待定）。
  - **验收标准**: 普通 agent 对未引用外部文档的写操作被拒。

- [ ] **Phase 4: 确认通道抽象（MAGI 作为用户） (P2)**
  - **背景**: 普通 agent 确认通道 `ConfirmSession` 仅支持前端 UI。
  - **行动**: 抽象授权源接口，接入 MAGI 三贤人治理作为授权方；复用 owner 授权机制。
  - **验收标准**: MAGI 可以程序化批准普通 agent 的写操作，且不绕过引用约束。

## 🟡 中期计划

- [ ] 引用建立者规则明确（MAGI 自建引用是否算授权）
- [ ] 引用方向规则明确（双向引用是否都算）
- [ ] Avatar（分身）是否同规则
- [ ] 前端 UI 对 restricted 状态的展示调整

## 🔴 远期计划

- [ ] 完整本体/分身统一身份模型
- [ ] AI 主笔记本作为多 agent 体系共同治理中枢

## 🏁 已归档/已完成

- [x] **调研：MAGI 与普通 agent 读写限制对比** (2026-08-07)
  - 结论：MAGI 笔记读写比普通 agent 更多限制（AI 主笔记本范围 + 三贤人治理 + pending 锁）；任务文件夹读写 MAGI 完全没有该能力。
