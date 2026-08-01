import {createMagiStandardLLMAdapter} from "./imports";
import {buildRuntimeMainInterfaceIdentity} from "./imports";
import type {MagiInterfaceIdentity} from "./imports";
import type {StandardLLMStreamChunk} from "./imports";
import type {AgentChatRuntime} from "./imports";
import {handleError} from "./imports";
import {handleSSEEvent} from "./imports";

/** 把当前持久化消息转换成 MAGI 标准流接口需要的消息。 */
function collectMagiMessages(runtime: AgentChatRuntime) {
    const messages: Array<{role: "user" | "assistant"; content: string}> = [];
    for (const entry of runtime.entries) {
        if (entry.type === "user") {
            messages.push({role: "user", content: entry.content});
        }
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
        onChunk: async (chunk: StandardLLMStreamChunk) => {
            if (!isActiveMagiRequest(runtime, requestSessionID, signal)) {
                return;
            }
            const token = chunk.choices?.[0]?.delta?.content;
            if (typeof token === "string" && token) {
                await handleSSEEvent(runtime, {type: "content", token});
            }
        },
        onDone: async () => {
            if (isActiveMagiRequest(runtime, requestSessionID, signal)) {
                await handleSSEEvent(runtime, {type: "done", turnID: runtime.currentTurnID});
            }
        },
        onError: async (error: Error) => {
            if (isActiveMagiRequest(runtime, requestSessionID, signal)) {
                await handleError(runtime, error);
            }
        },
    }, signal);
}
