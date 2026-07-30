# Agent Panel 文档系统提示词绑定（TikTocTak）

> **最终目标**：在统一 Agent Panel 中，让尚未开始对话的原生 Agent 会话可以绑定一篇 SiYuan 文档作为可追溯的系统提示词来源；文档变化时由用户显式选择刷新快照或保持当前版本，并能将当前有效提示词重新创建为文档。
>
> **当前目标**：完成原生 Agent 可发现的提示词来源菜单、文档变更决策与多宿主运行态验收；MAGI 连续渠道会话保持不暴露该能力。
>
> **下一步任务**：在多宿主验证前完成提示词控件的分工：符合资格时，来源名称/文件按钮主点击直接打开文档选择器；下拉箭头只承载刷新、保持、创建副本等生命周期动作。随后验证 Dock、Tab、浮窗和独立页的真实挂载，并补齐“创建副本后打开文档”的细粒度导航能力。

---

## 不变量

1. 绑定资格由服务端依据持久化会话状态判定：会话不得有已持久化的用户或助手消息、进行中的 turn、工具调用、确认、问答或恢复中的流；前端仅用于提前隐藏不可用动作。
2. 会话一旦成功发送首条消息，提示词来源和快照不可再替换；并发或过期请求不得绕过该条件。失败、取消或未持久化的草稿不消耗绑定资格。
3. 文档内容作为显式选择的用户来源，必须保存 `documentID`、稳定版本/内容哈希、标题快照、抓取时间和有效提示词快照；发送路径只使用已确认快照，绝不因文档变更静默改变正在使用的系统提示词。
4. 文档变更只提示，不自动刷新。用户可选择“刷新为当前文档”或“保持已绑定快照”；两项操作都写入可审计的版本状态。
5. “重新创建为文档”创建当前有效提示词的独立文档，并返回新文档标识；不会修改来源文档、不会覆盖已有内容，也不会隐式改变已锁定会话。
6. 提示词来源是 Agent Panel 的可组合能力：通过目标 policy、session capability、prompt-source resolver 和动作注册表接入。核心 Controller 不添加 `kind === ...` 的业务分支，也不向宿主索取全能 Port。
7. 首版仅向原生 `native-agent` 目标公开。MAGI 连续渠道会话不复用原生 Agent 的“无对话”语义；其支持必须由独立 `MagiPromptSourcePolicy` 明确声明后再开放。
8. 文档权限、加密状态、工作空间边界、最大正文大小、Lute/Markdown 规范化和 token 预算均在后端校验；读取失败、不可访问、过大或版本冲突必须有可见错误，不能生成空提示词继续发送。
9. 消息正文、系统提示词快照和文档内容不得写入普通 CLI 摘要日志；只保留无敏感正文的来源 ID、哈希、状态转换和错误分类。

## 目标领域模型

```ts
type AgentPromptSource =
    | {kind: "default"}
    | {
        kind: "document";
        documentId: string;
        titleSnapshot: string;
        contentHash: string;
        capturedAt: string;
        promptSnapshot: string;
        sourceVersion: string;
    };

type AgentPromptBindingState =
    | {kind: "eligible"; source: AgentPromptSource}
    | {kind: "locked"; source: AgentPromptSource; lockedAt: string}
    | {kind: "source-changed"; source: Extract<AgentPromptSource, {kind: "document"}>; currentVersion: string};

interface AgentPromptSourcePolicy {
    getBindingState(sessionId: string): Promise<AgentPromptBindingState>;
    bindDocument(sessionId: string, documentId: string): Promise<AgentPromptBindingState>;
    refreshDocumentSnapshot(sessionId: string): Promise<AgentPromptBindingState>;
    keepDocumentSnapshot(sessionId: string): Promise<AgentPromptBindingState>;
    createDocumentFromEffectivePrompt(sessionId: string): Promise<{documentId: string}>;
}
```

具体 API 字段与存储位置以 Phase 1 的现状调查为准；接口只表达领域根 `AgentPromptSource`，不泄漏 App、Protyle、Dialog 或具体选择器实现。

## 现状基线

- 原生 Agent 的固定系统提示词由 `kernel/agent/agent.go` 的 `buildSystemPrompt()` 构建，并随首轮请求进入消息序列；压缩逻辑保留该系统消息。
- Agent Panel 已有 target policy、消息动作注册表和细粒度 capability Port，见 `AgentPanel_能力扩展与MAGI持续会话.ttt.md`；本任务在该扩展层增加 prompt-source capability。
- Dock、Tab、浮窗、独立页和 MAGI 宿主共享面板 Controller，但只有 target policy 明确支持的目标显示提示词来源动作。
- 本任务不改变 MAGI 渠道历史的单一连续会话规则，也不改变普通 Agent 的工具、目录绑定、身份或重试策略。

## 阶段计划

- [x] **Phase 1：基线与契约**
  - 追踪 SessionStore、会话持久化、首轮消息构建、文档 API 和文档选择/创建 UI 的真实领域所有者。
  - 为“无对话”“首条消息原子锁定”“失败不锁定”“文档变更”和“版本冲突”建立服务端契约测试。
  - 定义 `AgentPromptSource`、policy 与错误码，不新增临时碎片接口或宿主特化字段。

- [x] **Phase 2：后端来源快照与执行门禁**
  - 扩展原生 Agent session schema 与迁移，旧会话默认 `default` 来源且视为既有会话锁定。
  - 实现文档内容受权限和大小限制的读取、规范化、哈希与快照持久化。
  - 在绑定、刷新、保持、创建文档和首轮发送入口实施同一原子资格校验。
  - 让 `buildSystemPrompt()` 接收受控来源解析结果，保留固定工具与运行时能力说明的单一系统消息语义。

- [x] **Phase 3：Agent Panel 扩展与宿主动作**
  - 在 session capability / target policy 注册绑定、刷新、保持和创建文档动作。
  - 在无消息空会话展示紧凑的提示词来源控件；有历史、流式中、只读、身份缺失或目标不支持时按 capability 隐藏或禁用。
  - 选择器复用既有 `/api/filetree/searchDocs`、`getHPathByPath` 和 `getIDsByHPath` 文档链路；只在用户选中候选后解析根块 ID，删除重复的 Agent 专用搜索接口。
  - 从 Protyle 块引用提示提取标准双行结果项和键盘选择交互，Agent 绑定只适配“选中后解析并绑定”语义；独立页缺失能力时隐藏需要宿主导航的动作，但保留可用的 API 驱动操作。

- [-] **Phase 4：变更 UX 与恢复**
  - [x] 对 eligible 原生会话，提示词来源名称/文件图标的主点击直接打开同一文档选择器；明确的下拉箭头仅显示刷新当前文档、保持当前快照和创建文档等生命周期动作。
  - [ ] 主点击与箭头在 Dock、Tab、浮窗和独立页具有同一可访问名称、焦点顺序、键盘触发和禁用语义；MAGI 与首次成功发送后的锁定会话不显示不适用入口。
  - 打开会话、发送前和显式刷新时检测来源版本；变更提示提供刷新、保持和查看来源三个明确动作。
  - 重新创建文档后展示可打开的来源，保留当前有效提示词不自动重绑。
  - 处理网络错误、文档删除、加密/权限变化、超限和并发修改的完整状态。

- [ ] **Phase 5：多宿主回归与验收**
  - 覆盖 Dock、Tab、浮窗、独立页和 MAGI 宿主中的原生 Agent 目标；确认 MAGI 目标不出现错误的绑定入口。
  - 运行 Kernel 定向测试、Agent Panel 单元/浏览器契约、类型检查的新增诊断审计和多视口截图。
  - 将实现、测试、运行证据和遗留阻塞滚动写回本文及主 Agent Panel TTT。

## 验收标准

- [ ] 新建原生 Agent 会话可选择一篇可访问文档并显示来源标题、快照时间和状态。
- [ ] eligible 原生会话中，来源名称/文件主按钮直接进入文档选择；下拉箭头不重复“选择文档”，只呈现来源生命周期动作。
- [ ] 首次成功发送后服务端拒绝任何绑定替换；并发请求、刷新和旧 UI 回调均不能绕过锁定。
- [ ] 来源文档变化后用户可显式刷新或保持；保持不会改变下一次模型请求的已确认快照。
- [ ] 当前有效提示词可创建为独立文档，且不影响原来源和当前会话行为。
- [ ] 所有失败路径有界面状态与结构化无正文审计；没有静默使用空提示词或未确认的新文档内容。
- [ ] Dock、Tab、浮窗、独立页可正常打开；MAGI 连续会话不显示不适用动作。
- [ ] 后端/前端定向测试、类型新增诊断审计与视觉检查均有证据记录。

## 风险

- “无对话”若只由前端消息数组判断，会被多窗口、恢复流和直接 API 绕过；必须让 session 聚合根成为唯一裁决者。
- 完整文档可能远超模型上下文，且包含嵌入、动态块或敏感内容；需要明确规范化、上限与失败语义，不能截断后伪装为完整提示词。
- 文档变更检测不能依赖标题或 UI 缓存；应基于后端权威内容版本/哈希。
- 将文档正文直接写入 session 列表、通知或 CLI 会扩大泄露面；展示层只使用元数据，正文只在受控请求路径读取。
- 与未来工具包覆盖、并行只读竞赛和更多消息动作共存时，prompt source 仍是独立 policy，不能成为新的全局配置中心。

## 关联

- [Agent Panel 能力扩展与 MAGI 持续会话](./AgentPanel_能力扩展与MAGI持续会话.ttt.md)
- [Agent Panel 多端统一、MAGI 聊天替换与独立入口](./AgentPanel_多端统一_MAGI聊天替换与独立入口.ttt.md)
- [Forge 模式后端热重启与版本回退](./Forge模式后端热重启与版本回退.ttt.md)

## 已归档 / 已完成

- `2026-07-30`：创建任务文档，冻结“服务端首轮锁定、文档快照显式刷新、target policy 扩展、MAGI 不默认复用原生语义”的边界。尚未修改产品代码；等待当前上游 `D002` 运行门禁和 Codex MCP 配置闭合后进入 Phase 1。
- `2026-07-30`：完成现状基线追踪。权威会话文件在 `kernel/agent/session.go`，运行态在 `kernel/agent/runtime.go`，首轮及历史系统消息均由 `kernel/agent/agent.go` 构建；前端请求边界是 `app/src/layout/dock/agent/SessionStore.ts`。实现采用 session 锁下的服务端持有 `promptSource` 字段，客户端普通保存明确保留该字段，避免前端正文或旧快照覆盖。
- `2026-07-30`：完成服务端来源快照与执行门禁。新增 `kernel/agent/prompt_source.go` 及 `prompt_source_test.go`；`get/bind/refresh/keep/createPromptSourceDocument` 全部经 session revision 与首次发送锁校验，正文不回传浏览器。定向 Kernel 证据：`go test -tags fts5 ./agent -run "Test(DocumentPromptSource|TurnContext|SystemPrompt|CheckpointMessages|SaveSessionRevision)" -count=1`、`go test -tags fts5 ./api -run "^$" -count=1` 通过。
- `2026-07-30`：接入原生 Agent 面板的可发现入口。`AgentChat.ts` 在输入区显示“文件图标 + 当前系统提示词 + 下拉箭头”的常驻按钮，使用已有细粒度 `PanelMenuPort` 展示“选择/更换文档”“刷新为当前文档”“保持当前快照”“将当前系统提示词创建为文档”；MAGI policy 明确隐藏该按钮。`AgentPromptSourceDialog.ts` 仅负责文档搜索选择，避免与菜单重复承载状态动作。
- `2026-07-30`：纠正选择器重复实现。删除 `/api/ai/agent/searchPromptSourceDocuments` 和其 Kernel 搜索/路径/ID 解析副本；`SessionStore` 改用既有文件树搜索与路径解析 API，选中单项后才解析根块 ID。`app/src/search/blockPicker/` 成为 Protyle Hint 与 Agent 选择器共享的结果项和键盘选择层，Protyle Range 引用插入与 Agent 会话绑定仍各自保留。定向证据：`pnpm exec vitest --run test/layout/dock/agent/SessionStore.headers.test.ts test/search/blockPicker/renderBlockSearchResultItem.test.ts`（20 tests）及 `go test -tags fts5 ./api -run "^$" -count=1` 通过；全量类型检查仍由既有诊断阻断，本次文件没有新增诊断。
- `2026-07-30`：加入来源变更的主动保护。切回窗口时刷新服务端来源状态；首次发送前再次读取权威版本，若已变化则打开同一菜单并中止发送，要求用户显式选择刷新或保持，避免一次发送将旧快照静默锁死。`SessionStore.headers.test.ts` 覆盖状态读取、revision 链接的刷新/保持和服务端失败传播；`pnpm exec vitest run test/layout/dock/agent/SessionStore.headers.test.ts test/layout/dock/agent/runtime/agentPanel.targetPolicy.test.ts` 通过（20 tests）。
- `2026-07-30`：完成提示词控件的职责分离。输入区现在有独立“文件图标 + 来源名称”主按钮和紧凑的下拉箭头：主按钮直接进入共享文档选择 Dialog；箭头只显示刷新当前文档、保持当前快照和创建文档。已锁定会话禁用文档选择但保留“创建当前有效提示词为文档”；没有 `PanelMenuPort` 的宿主仍能选择文档，并按 capability 隐藏箭头动作。`pnpm run test:agent-panel` 通过（29 files / 95 tests），`pnpm run dev:once` 的全部构建目标通过。
- `2026-07-30`：完整 Agent Panel 回归 `pnpm run test:agent-panel` 通过（29 files / 94 tests）；浏览器契约 `pnpm exec vitest --run --config vitest.browser.config.ts test/browser/agent/standaloneEntry.browser.ts` 通过（独立 ESM 导出可由浏览器模块加载）；Kernel 定向回归 `go test -tags fts5 ./agent -run "Test(DocumentPromptSource|TurnContext|SystemPrompt|CheckpointMessages|SaveSessionRevision)" -count=1` 与 `go test -tags fts5 ./api -run "^$" -count=1` 通过。
- `2026-07-30`：`pnpm run build:agent-app` 成功，产出独立 ESM 和网页入口。全量 `pnpm run typecheck` 仍由既有跨模块诊断阻断；对本任务的 `AgentPromptSourceDialog` 和新增 `AgentChat` 段落未发现新增诊断。自动浏览器会话访问 `/stage/build/agent-app/` 时只观测到空 `main#agent-panel`，尚未取得足以证明运行态挂载的 DOM 证据，保留为 Phase 5 阻塞项，不宣称独立页验收完成。
