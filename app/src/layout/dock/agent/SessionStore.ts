/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：commit 7588f6a72d「拆分agent.ts」架构重构 —— 原 386 行会话存储网关（SessionStore 对象 + SessionStore.types）按领域拆分为 session/ 子模块。
 * 本地替代/迁移到：app/src/layout/dock/agent/session/AgentSession.repository.ts（list/get/save/remove 等 /api/ai/agent/* 请求网关）；app/src/layout/dock/agent/session/AgentSession.types.ts（AgentSession/SessionListResult 类型）；app/src/layout/dock/agent/session/AgentSession.revisions.ts（修订 Map 与 waitForAgentSessionSave 保存队列）；app/src/layout/dock/agent/session/imports.ts；会话持久化流程见 app/src/layout/dock/agent/chat/session/persistence/。
 * 上游 v3.8.0 对该文件的增量（经评审）：1) 新增导出类型 AgentPermissionMode = "confirm" | "allowSession"；2) AgentSession 增加可选字段 permissionMode；3) entries.steps 增加 roundID/toolCallIDs，entries 顶层增加 responseOutput/responseOutputTokens/roundID，toolCalls 元素扩展 id/argumentsJSON/providerData.google.thoughtSignature；4) SessionIndexItem 增加 agentRunning 可选字段；5) SessionStore 新增 setPermission(id, permissionMode) 方法（POST /api/ai/agent/setPermission）。
 * 增量去向：上述字段与 setPermission 已移植到 `session/AgentSession.types.ts`、`session/AgentSession.repository.ts` 和聊天运行时；roundID/responseOutput/tool provider data 由 `chat/message/history/AgentHistory.presentation.ts` 与 projection 模块完整投影。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
