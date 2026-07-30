# Agent Panel 文档系统提示词绑定（TikTocTak）

> **最终目标**：在统一 Agent Panel 中，让尚未开始对话的原生 Agent 会话可以绑定一篇 SiYuan 文档作为可追溯的系统提示词来源；文档变化时由用户显式选择刷新快照或保持当前版本，并能将当前有效提示词重新创建为文档。
>
> **当前目标**：冻结会话前置条件、文档快照、变更检测和宿主扩展边界；在现有 `AgentPanelExtension` / target policy 架构内完成可测试的端到端实现。
>
> **下一步任务**：在当前上游 `D002` 运行门禁与后续 Codex MCP 配置闭合后，调查原生 Agent SessionStore、首轮请求消息构建、文档选择/创建 API 及现有 Agent Panel 扩展点，建立不依赖具体宿主的领域契约和回归基线。

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

- [ ] **Phase 1：基线与契约**
  - 追踪 SessionStore、会话持久化、首轮消息构建、文档 API 和文档选择/创建 UI 的真实领域所有者。
  - 为“无对话”“首条消息原子锁定”“失败不锁定”“文档变更”和“版本冲突”建立服务端契约测试。
  - 定义 `AgentPromptSource`、policy 与错误码，不新增临时碎片接口或宿主特化字段。

- [ ] **Phase 2：后端来源快照与执行门禁**
  - 扩展原生 Agent session schema 与迁移，旧会话默认 `default` 来源且视为既有会话锁定。
  - 实现文档内容受权限和大小限制的读取、规范化、哈希与快照持久化。
  - 在绑定、刷新、保持、创建文档和首轮发送入口实施同一原子资格校验。
  - 让 `buildSystemPrompt()` 接收受控来源解析结果，保留固定工具与运行时能力说明的单一系统消息语义。

- [ ] **Phase 3：Agent Panel 扩展与宿主动作**
  - 在 session capability / target policy 注册绑定、刷新、保持和创建文档动作。
  - 在无消息空会话展示紧凑的提示词来源控件；有历史、流式中、只读、身份缺失或目标不支持时按 capability 隐藏或禁用。
  - 使用现有文档选择器和创建文档工作流；独立页缺失能力时隐藏需要宿主导航的动作，但保留可用的 API 驱动操作。

- [ ] **Phase 4：变更 UX 与恢复**
  - 打开会话、发送前和显式刷新时检测来源版本；变更提示提供刷新、保持和查看来源三个明确动作。
  - 重新创建文档后展示可打开的来源，保留当前有效提示词不自动重绑。
  - 处理网络错误、文档删除、加密/权限变化、超限和并发修改的完整状态。

- [ ] **Phase 5：多宿主回归与验收**
  - 覆盖 Dock、Tab、浮窗、独立页和 MAGI 宿主中的原生 Agent 目标；确认 MAGI 目标不出现错误的绑定入口。
  - 运行 Kernel 定向测试、Agent Panel 单元/浏览器契约、类型检查的新增诊断审计和多视口截图。
  - 将实现、测试、运行证据和遗留阻塞滚动写回本文及主 Agent Panel TTT。

## 验收标准

- [ ] 新建原生 Agent 会话可选择一篇可访问文档并显示来源标题、快照时间和状态。
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
