import {beforeEach, describe, expect, it, vi} from "vitest";

const createController = vi.hoisted(() => vi.fn());
const handleSessionEvent = vi.hoisted(() => vi.fn());
const reloadFromDisk = vi.hoisted(() => vi.fn());
const setStreaming = vi.hoisted(() => vi.fn());
const renderControls = vi.hoisted(() => vi.fn());
const clearControls = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/layout/dock/agent/chat/runtime/imports", () => ({
    createAgentConversationController: createController,
    handleAgentConversationSessionEvent: handleSessionEvent,
    reloadFromDisk,
    setStreaming,
    renderAgentConversationControls: renderControls,
    clearAgentConversationControls: clearControls,
}));

import type {AgentChatRuntime} from "../../../../src/layout/dock/agent/chat/AgentChat.runtime.types";
import type {AgentPanelConversationKind} from "../../../../src/layout/dock/agent/runtime/agentPanel.ports.types";
import {
    createAgentChatConversationController,
    syncAgentChatConversationController,
} from "../../../../src/layout/dock/agent/chat/runtime/AgentChat.conversationController";

describe("AgentChat conversation controller composition", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not create or subscribe a controller for an unregistered execution target", () => {
        const runtime = {
            conversationKind: "external-agent" as AgentPanelConversationKind,
            conversationAdapters: {find: vi.fn(() => undefined)},
        } as unknown as AgentChatRuntime;

        expect(createAgentChatConversationController(runtime)).toBeNull();
        expect(createController).not.toHaveBeenCalled();
        expect(handleSessionEvent).not.toHaveBeenCalled();
    });

    it("disposes the previous controller and clears native controls when a target is unregistered", () => {
        const current = {dispose: vi.fn(), state: {adapter: {kind: "native-agent"}}};
        const runtime = {
            conversationKind: "external-agent" as AgentPanelConversationKind,
            conversationAdapters: {find: vi.fn(() => undefined)},
            conversationController: current,
        } as unknown as AgentChatRuntime;

        expect(syncAgentChatConversationController(runtime)).toBeNull();
        expect(current.dispose).toHaveBeenCalledOnce();
        expect(runtime.conversationController).toBeNull();
        expect(clearControls).toHaveBeenCalledWith(runtime);
        expect(createController).not.toHaveBeenCalled();
    });

    it("retains the existing controller when the registered adapter kind is unchanged", () => {
        const adapter = {kind: "native-agent"};
        const current = {dispose: vi.fn(), state: {adapter}};
        const runtime = {
            conversationKind: "native-agent",
            conversationAdapters: {find: vi.fn(() => adapter)},
            conversationController: current,
        } as unknown as AgentChatRuntime;

        expect(syncAgentChatConversationController(runtime)).toBe(current);
        expect(current.dispose).not.toHaveBeenCalled();
        expect(createController).not.toHaveBeenCalled();
    });
});
