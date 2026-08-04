import {beforeEach, describe, expect, it, vi} from "vitest";

const prepareForNewTurn = vi.hoisted(() => vi.fn(async () => true));
const collectAgentChatSendData = vi.hoisted(() => vi.fn(() => ({
    text: "running input", references: [], pluginActions: [],
})));
const dispatchAgentChatSSE = vi.hoisted(() => vi.fn(async () => undefined));
const startOutgoingAgentTurn = vi.hoisted(() => vi.fn(async () => "entry-1"));
const createAgentChatRequestContext = vi.hoisted(() => vi.fn(() => ({
    conversation: {kind: "native-agent", sessionId: "session-1"},
    signal: new AbortController().signal,
})));
const submitAgentChatConversation = vi.hoisted(() => vi.fn(async () => undefined));
const sendMagiMessage = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../../../../src/layout/dock/agent/chat/message/sending/imports", () => ({
    prepareForNewTurn,
}));
vi.mock("../../../../src/layout/dock/agent/chat/message/sending/AgentChat.send.helpers", () => ({
    collectAgentChatSendData,
    dispatchAgentChatSSE,
    startOutgoingAgentTurn,
    createAgentChatRequestContext,
}));
vi.mock("../../../../src/layout/dock/agent/chat/message/sending/AgentChat.conversationSend", () => ({
    submitAgentChatConversation,
}));
vi.mock("../../../../src/layout/dock/agent/chat/message/sending/AgentChat.magiSend", () => ({
    sendMagiMessage,
}));

import type {AgentChatRuntime} from "../../../../src/layout/dock/agent/chat/AgentChat.runtime.types";
import {sendMessage} from "../../../../src/layout/dock/agent/chat/message/sending/AgentChat.send.methods";

function createRuntime(registered: boolean) {
    return {
        conversationKind: "native-agent",
        conversationController: registered ? {state: {adapter: {kind: "native-agent"}}} : null,
        promptSourceController: {
            ensureDecisionBeforeFirstTurn: vi.fn(async () => true),
            closeActions: vi.fn(),
        },
    } as unknown as AgentChatRuntime;
}

describe("AgentChat send facade", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("routes running input through the registered conversation controller", async () => {
        const runtime = createRuntime(true);

        await sendMessage(runtime);

        expect(submitAgentChatConversation).toHaveBeenCalledWith(runtime, expect.objectContaining({text: "running input"}));
        expect(startOutgoingAgentTurn).not.toHaveBeenCalled();
        expect(dispatchAgentChatSSE).not.toHaveBeenCalled();
        expect(sendMagiMessage).not.toHaveBeenCalled();
    });

    it("keeps the existing request stream for a target without a registered controller", async () => {
        const runtime = createRuntime(false);

        await sendMessage(runtime);

        expect(submitAgentChatConversation).not.toHaveBeenCalled();
        expect(startOutgoingAgentTurn).toHaveBeenCalledWith(runtime, expect.objectContaining({text: "running input"}));
        expect(dispatchAgentChatSSE).toHaveBeenCalledWith(runtime, expect.objectContaining({userEntryId: "entry-1"}));
    });
});
