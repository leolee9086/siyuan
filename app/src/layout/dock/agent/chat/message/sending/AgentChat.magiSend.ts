/** 用途：创建 MAGI 标准模型适配器；使用范围：MAGI 消息发送；解耦评估：适配器工厂经目录网关集中导入。 */
import {createMagiStandardLLMAdapter} from "./imports";
/** 用途：构建主界面身份；使用范围：MAGI 消息发送；解耦评估：身份构建经目录网关集中导入。 */
import {buildRuntimeMainInterfaceIdentity} from "./imports";
/** 用途：约束 MAGI 界面身份；使用范围：适配器创建；解耦评估：类型导入编译后消失。 */
import type {MagiInterfaceIdentity} from "./imports";
/** 用途：约束标准流式 chunk 结构；使用范围：流事件映射；解耦评估：类型导入编译后消失。 */
import type {StandardLLMStreamChunk} from "./imports";
/** 用途：约束流式会话状态；使用范围：消息收集与事件分派；解耦评估：类型导入编译后消失。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：上报流错误；使用范围：MAGI 流错误处理；解耦评估：错误处理经目录网关集中导入。 */
import {handleError} from "./imports";
/** 用途：把 MAGI 流事件转入统一 SSE 分派；使用范围：chunk 与 done 事件；解耦评估：协议分派经目录网关集中导入。 */
import {handleSSEEvent} from "./imports";

/** 把当前持久化消息转换成 MAGI 标准流接口需要的消息。 */
function collectMagiMessages(runtime: AgentChatRuntime) {
    const messages: Array<{role: "user" | "assistant"; content: string}> = [];
    for (const entry of runtime.entries) {
        // 仅用户消息进入上下文，且需要原文内容。
        if (entry.type === "user") {
            messages.push({role: "user", content: entry.content});
        }
        // 仅保留有正文的助手消息，思考与工具卡片不进入模型上下文。
        if (entry.type === "assistant" && entry.content) {
            messages.push({role: "assistant", content: entry.content});
        }
    }
    return messages;
}

/** 判断 MAGI 流事件仍属于当前活动请求。 */
function isActiveMagiRequest(runtime: AgentChatRuntime, sessionID: string, signal: AbortSignal) {
    return !signal.aborted && runtime.sessionId === sessionID && runtime.conversationKind === "magi";
}

/** 通过 MAGI 标准流接口发送当前会话历史。 */
export async function sendMagiMessage(runtime: AgentChatRuntime, requestSessionID: string, signal: AbortSignal) {
    const identity = {
        ...buildRuntimeMainInterfaceIdentity(),
        interfaceKind: "magi-main-ui",
        interfaceId: `agent-panel-${requestSessionID}`,
        conversationId: requestSessionID,
    } satisfies MagiInterfaceIdentity;
    const adapter = await createMagiStandardLLMAdapter({
        model: "magi-trinity",
        connectionStatus: {value: "connected" as const},
        mainInterfaceIdentity: identity,
    });
    await adapter.streamChatCompletion({
        model: "magi-trinity",
        messages: collectMagiMessages(runtime),
        stream: true,
    }, {
        /** 逐块映射 MAGI 流式输出：推理增量与正文增量分别进入思考卡片与助手消息，保证 LLM 全部输出可见。 */
        onChunk: async (chunk: StandardLLMStreamChunk) => {
            // 会话已切换或请求中止时丢弃迟到帧。
            if (!isActiveMagiRequest(runtime, requestSessionID, signal)) {
                return;
            }
            const firstChoice = chunk.choices?.[0];
            const delta = firstChoice?.delta;
            // 推理增量映射为 reasoning 事件，进入思考卡片推理文本区。
            const reasoningToken = delta?.reasoning_content;
            // 仅非空字符串推理增量才提交，避免空 chunk 触发无效事件。
            if (typeof reasoningToken === "string" && reasoningToken) {
                await handleSSEEvent(runtime, {type: "reasoning", token: reasoningToken});
            }
            // 正文增量映射为 content 事件，进入助手消息。
            const token = delta?.content;
            // 仅非空字符串正文增量才提交，避免空 chunk 触发无效事件。
            if (typeof token === "string" && token) {
                await handleSSEEvent(runtime, {type: "content", token});
            }
        },
        /** 流结束后提交 done 事件，触发响应收尾与持久化。 */
        onDone: async () => {
            // 会话仍属于当前请求时才提交完成事件。
            if (isActiveMagiRequest(runtime, requestSessionID, signal)) {
                await handleSSEEvent(runtime, {type: "done", turnID: runtime.currentTurnID});
            }
        },
        /** 流错误时把错误结算到当前会话。 */
        onError: async (error: Error) => {
            // 会话仍属于当前请求时才上报错误。
            if (isActiveMagiRequest(runtime, requestSessionID, signal)) {
                await handleError(runtime, error);
            }
        },
    }, signal);
}
