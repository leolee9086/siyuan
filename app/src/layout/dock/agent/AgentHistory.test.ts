/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：架构重构将 agent 历史模块从 layout/dock/agent/ 迁入
 *   layout/dock/agent/chat/message/history/（原 AgentHistory.ts 与本测试一并删除），
 *   因此合并时对上游 v3.8.0 的修改采取「不恢复、留墓碑」策略。
 * 本地替代/迁移到：
 *   - app/src/layout/dock/agent/chat/message/history/AgentHistory.ts（迁移后的实现）
 *   - app/src/layout/dock/agent/chat/message/history/AgentHistory.test.ts（迁移后的测试）
 *   - app/src/layout/dock/agent/chat/message/history/AgentHistory.types.ts（类型定义）
 * 上游 v3.8.0 对该文件的增量（经评审）：约 +681/-7 行，全部为测试用例：
 *   1. 新增 4 个纯函数的单测：isAgentAssistantContentFinalInTurn（每轮仅末条助手消息显示"重新生成"）、
 *      getAgentThinkingDisplaySeconds（思考时长正数至少显示 1 秒）、hasAgentThinkingStepDetails（仅识别有可见细节的思考步骤）、
 *      hasAgentModelSpecificContext（检测会话中的模型特定上下文）。
 *   2. 删除旧断言 filterAgentReferencesForContent（"drops block references..."），改由 applyAgentUserEdit
 *      的"富文本用户消息整体更新"（text/blockHTML/references 同步写入）测试取代。
 *   3. 新增大量 buildAgentPresentationEntries 展示管线测试：思考卡合成与恢复、roundID 权威内容回填、
 *      question 卡内容前移到卡片之前、legacy 无 roundID 匹配回退。
 *   4. 同一展示管线补充：todo 结果卡片跟随对应思考卡、confirm 分割同一轮时按 toolCallID 归组工具名、
 *      snapshot 移动到触发它的思考卡之后。
 * 增量去向：已移植到 `chat/message/history/AgentHistory.ts`、`AgentHistory.presentation.ts` 及同目录测试；roundID 匹配、question/todo/snapshot 重排、富文本编辑和模型上下文辅助函数均由拆分模块实现。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
