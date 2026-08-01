/** 用途：约束待持久化工具记录；使用范围：响应和思考条目保存。 */
import type {AgentToolCall} from "./imports";

/** 移除 question 工具中已由独立条目保存的完整问题数组。 @同步豁免: 性能考虑 */
export function slimToolCallsForPersistence(toolCalls: AgentToolCall[]) {
    const persistedCalls: AgentToolCall[] = [];
    for (const toolCall of toolCalls) {
        // 非问题工具和已没有完整问题数组的记录可以直接进入持久化快照。
        if (toolCall.name !== "question" || !toolCall.arguments.questions) {
            persistedCalls.push(toolCall);
            continue;
        }
        const argumentsWithoutQuestions = {...toolCall.arguments};
        delete argumentsWithoutQuestions.questions;
        persistedCalls.push({...toolCall, arguments: argumentsWithoutQuestions});
    }
    return persistedCalls;
}
