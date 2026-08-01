import type {ISSEResult} from "./imports";
import type {AgentChatRuntime} from "./imports";
import {dispatchSSEEvent} from "./AgentChat.sse.helpers";
import {recoverSSEHandlerFailure} from "./AgentChat.sse.helpers";

/** 分派单个 SSE 事件，并在处理器异常时恢复会话。 */
export async function handleSSEEvent(runtime: AgentChatRuntime, event: ISSEResult) {
    try {
        await dispatchSSEEvent(runtime, event);
    } catch (error) {
        await recoverSSEHandlerFailure(runtime, error, event);
    }
}
