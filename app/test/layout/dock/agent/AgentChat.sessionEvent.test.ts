import {beforeEach, describe, expect, it, vi} from "vitest";

const appendUserMessage = vi.hoisted(() => vi.fn());
const finishAssistantSegment = vi.hoisted(() => vi.fn());
const setStreaming = vi.hoisted(() => vi.fn());
const rebuildNavMarkers = vi.hoisted(() => vi.fn());
const handleSSEEvent = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../../../../src/layout/dock/agent/chat/stream/protocol/imports", () => ({
    appendUserMessage,
    finishAssistantSegment,
    setStreaming,
    rebuildNavMarkers,
}));
vi.mock("../../../../src/layout/dock/agent/chat/stream/protocol/AgentChat.sse.methods", () => ({
    handleSSEEvent,
}));

import type {AgentChatRuntime} from "../../../../src/layout/dock/agent/chat/AgentChat.runtime.types";
import type {AgentConversationSessionEvent} from "../../../../src/layout/dock/agent/runtime/conversation/agentConversation.types";
import {handleAgentConversationSessionEvent} from "../../../../src/layout/dock/agent/chat/stream/protocol/AgentChat.sessionEvent";

function createRuntime() {
    return {
        entries: [],
        messagesContainer: document.createElement("div"),
        composer: {pushHistory: vi.fn()},
    } as unknown as AgentChatRuntime;
}

function event(type: string, values: Record<string, unknown>): AgentConversationSessionEvent {
    return {type, sessionID: "session-1", eventSeq: 1, timestamp: 100, ...values};
}

describe("AgentChat session event projection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("moves an input into history only after input_promoted and deduplicates by EntryID", async () => {
        const runtime = createRuntime();
        runtime.messagesContainer.innerHTML = "<div class=\"agent-chat__welcome\">welcome</div>";
        const promoted = event("input_promoted", {
            userEntryID: "entry-1",
            content: "queued message",
            blockHTML: "<p>queued message</p>",
            references: [{id: "block-1", title: "Block"}],
            editorContext: {activeDocID: "doc-1", selectedBlockIDs: ["block-1"]},
        });

        expect(runtime.entries).toHaveLength(0);
        await handleAgentConversationSessionEvent(runtime, promoted);
        await handleAgentConversationSessionEvent(runtime, {...promoted, eventSeq: 2});

        expect(runtime.entries).toEqual([{
            id: "entry-1",
            type: "user",
            content: "queued message",
            blockHTML: "<p>queued message</p>",
            references: [{id: "block-1", title: "Block"}],
            editorContext: {activeDocID: "doc-1", selectedBlockIDs: ["block-1"]},
            timestamp: 100,
        }]);
        expect(appendUserMessage).toHaveBeenCalledOnce();
        expect(appendUserMessage).toHaveBeenCalledWith(runtime, "queued message", {
            entryId: "entry-1", timestamp: 100, blockHTML: "<p>queued message</p>",
        });
        expect(runtime.composer?.pushHistory).toHaveBeenCalledOnce();
        expect(finishAssistantSegment).not.toHaveBeenCalled();
        expect(setStreaming).toHaveBeenCalledWith(runtime, true);
    });

    it("finishes the current assistant segment before inserting a steer user entry", async () => {
        const runtime = createRuntime();
        const steer = event("steer_injected", {userEntryID: "steer-entry", content: "focus here"});

        await handleAgentConversationSessionEvent(runtime, steer);
        await handleAgentConversationSessionEvent(runtime, event("content", {token: "next segment"}));

        expect(finishAssistantSegment).toHaveBeenCalledWith(runtime);
        expect(appendUserMessage).toHaveBeenCalledWith(runtime, "focus here", {
            entryId: "steer-entry", timestamp: 100,
        });
        expect(finishAssistantSegment.mock.invocationCallOrder[0]!)
            .toBeLessThan(appendUserMessage.mock.invocationCallOrder[0]!);
        expect(handleSSEEvent).toHaveBeenCalledWith(runtime, {type: "content", token: "next segment"});
        expect(runtime.entries[0]).toMatchObject({id: "steer-entry", type: "user", content: "focus here"});
    });
});
