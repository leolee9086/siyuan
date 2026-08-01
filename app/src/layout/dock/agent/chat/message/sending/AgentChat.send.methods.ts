import type {AgentChatRuntime} from "./imports";
import {prepareForNewTurn} from "./imports";
import {collectAgentChatSendData} from "./AgentChat.send.helpers";
import {createAgentChatRequestContext} from "./AgentChat.send.helpers";
import {dispatchAgentChatSSE} from "./AgentChat.send.helpers";
import {startOutgoingAgentTurn} from "./AgentChat.send.helpers";
import {sendMagiMessage} from "./AgentChat.magiSend";

/** 发送编辑器内容并按会话目标分派流式请求。 */
export async function sendMessage(runtime: AgentChatRuntime) {
    const request = collectAgentChatSendData(runtime);
    if (!request) {
        return;
    }
    if (!await runtime.promptSourceController.ensureDecisionBeforeFirstTurn()) {
        return;
    }
    if (!await prepareForNewTurn(runtime)) {
        return;
    }
    runtime.promptSourceController.closeActions();
    const userEntryId = await startOutgoingAgentTurn(runtime, request);
    if (!userEntryId) {
        return;
    }
    const context = createAgentChatRequestContext(runtime);
    if (runtime.conversationKind === "magi") {
        await sendMagiMessage(runtime, context.conversation.sessionId || "", context.signal);
        return;
    }
    await dispatchAgentChatSSE(runtime, {request, userEntryId, context});
}
