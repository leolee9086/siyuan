/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：架构重构拆分 agent.ts（commit 7588f6a72d「拆分agent.ts」），
 * 将本文件的纯函数与类型迁往 agent/chat/message/history/ 子模块，故本地删除属正常重构。
 * 本地替代/迁移到：
 *   - app/src/layout/dock/agent/chat/message/history/AgentHistory.ts
 *     （findAgentUserEntryIndex / hasAgentExecutedToolsAfter /
 *       isAgentRegenerateStateCurrent / filterAgentReferencesForContent）
 *   - app/src/layout/dock/agent/chat/message/history/AgentHistory.types.ts
 *     （AgentHistoryEntry / AgentHistoryReference 类型）
 * 上游 v3.8.0 对该文件的增量（经评审）：36 行 → ~493 行，新增：
 *   1. 新类型 AgentHistoryThinkingStep / AgentHistoryUserEntry / AgentHistoryEditData，
 *      并扩展 AgentHistoryEntry（toolCalls 等字段）。
 *   2. 思考步骤工具：getAgentThinkingToolGroups / hasAgentThinkingStepDetails /
 *      getAgentThinkingDisplaySeconds。
 *   3. applyAgentUserEdit（用户消息编辑回填）、isAgentAssistantContentFinalInTurn、
 *      hasAgentModelSpecificContext。
 *   4. 内部呈现管线：enrichThinkingStep(+Tools) / buildRecoveredThinkingStep /
 *      prepareAgentTurnPresentation，及导出 buildAgentPresentationEntries
 *      （持久化协议消息 → UI 条目投影，约 250 行）。
 *   5. 删除了基线中的 filterAgentReferencesForContent（本地仍在使用，保留不动）。
 * 增量去向：已按本地拆分架构移植到 `chat/message/history/AgentHistory.ts`、
 *   `AgentHistory.types.ts` 与 `AgentHistory.presentation.ts`；projection/render 模块调用
 *   `buildAgentPresentationEntries` 后再反序列化，roundID、question/todo/snapshot 和模型专用上下文语义均已接线。
 *   本地 `filterAgentReferencesForContent` 兼容辅助函数继续保留。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
