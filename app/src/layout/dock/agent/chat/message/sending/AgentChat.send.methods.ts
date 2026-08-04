/** 用途：约束聊天运行时；使用范围：公开发送命令。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：提交或恢复上一轮；使用范围：发送 admission 前；解耦评估：恢复屏障由既有会话领域集中维护。 */
import {prepareForNewTurn} from "./imports";
/** 用途：读取 Composer 与宿主上下文；使用范围：发送入口；解耦评估：输入收集仍由既有唯一函数维护。 */
import {collectAgentChatSendData} from "./AgentChat.send.helpers";
/** 用途：分派未注册 adapter 的既有 Agent SSE；使用范围：发送入口旧链路；解耦评估：传输参数仍由 helper 集中装配，门面不直接依赖请求模块。 */
import {dispatchAgentChatSSE} from "./AgentChat.send.helpers";
/** 用途：按 adapter 能力提交消息；使用范围：发送入口；解耦评估：具体目标差异留在 adapter 与统一发送编排中。 */
import {submitAgentChatConversation} from "./AgentChat.conversationSend";
/** 用途：建立既有请求内流式用户轮次；使用范围：未被新控制器接管的目标；解耦评估：条目持久化和 DOM 投影继续复用既有唯一入口。 */
import {startOutgoingAgentTurn} from "./AgentChat.send.helpers";
/** 用途：建立既有请求取消上下文；使用范围：未被新控制器接管的目标；解耦评估：取消句柄和会话快照由 helper 原子建立。 */
import {createAgentChatRequestContext} from "./AgentChat.send.helpers";
/** 用途：保留既有目标发送链路；使用范围：当前目标未注册本轮执行 adapter 时；解耦评估：保持原传输入口，不在新 controller 中复制或包裹其协议。 */
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
    if (runtime.conversationController) {
        await submitAgentChatConversation(runtime, request);
        return;
    }
    runtime.promptSourceController.closeActions();
    const userEntryId = await startOutgoingAgentTurn(runtime, request);
    if (!userEntryId) {
        return;
    }
    const context = createAgentChatRequestContext(runtime);
    // 既有目标仍由原发送模块接管，避免本轮 controller 改变其协议。
    if (runtime.conversationKind === "magi") {
        await sendMagiMessage(runtime, context.conversation.sessionId || "", context.signal);
        return;
    }
    await dispatchAgentChatSSE(runtime, {request, userEntryId, context});
}
