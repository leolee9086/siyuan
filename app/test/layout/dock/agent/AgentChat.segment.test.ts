import {beforeEach, describe, expect, it, vi} from "vitest";

const finishActiveThinking = vi.hoisted(() => vi.fn());
const flushThinkingStep = vi.hoisted(() => vi.fn());
const updateTokenDisplay = vi.hoisted(() => vi.fn());
const rebuildNavMarkers = vi.hoisted(() => vi.fn());
const appendCurrentAssistantEntry = vi.hoisted(() => vi.fn());
const finalizeResponseElement = vi.hoisted(() => vi.fn());
const flushPendingConfirmEntries = vi.hoisted(() => vi.fn());
const resetStreamingResponseState = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/layout/dock/agent/chat/stream/response/imports", () => ({
    finishActiveThinking,
    flushThinkingStep,
    updateTokenDisplay,
    rebuildNavMarkers,
}));
vi.mock("../../../../src/layout/dock/agent/chat/stream/response/AgentChat.response.helpers", () => ({
    appendCurrentAssistantEntry,
    finalizeResponseElement,
    flushPendingConfirmEntries,
    resetStreamingResponseState,
}));

import type {AgentChatRuntime} from "../../../../src/layout/dock/agent/chat/AgentChat.runtime.types";
import {finishAssistantSegment} from "../../../../src/layout/dock/agent/chat/stream/response/AgentChat.segment.methods";

describe("AgentChat assistant segmentation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("commits the current assistant entry and resets transient state for the next segment", () => {
        const thinkingCard = document.createElement("div");
        thinkingCard.className = "agent-chat__msg--thinking";
        const messagesContainer = document.createElement("div");
        messagesContainer.append(thinkingCard);
        const runtime = {
            messagesContainer,
            currentContent: "first segment",
            fullContent: "first segment",
            requestStartTime: 1,
        } as unknown as AgentChatRuntime;

        finishAssistantSegment(runtime);

        expect(finalizeResponseElement).toHaveBeenCalledWith(runtime, expect.objectContaining({
            content: "first segment", fullContent: "first segment", thinkingCard,
        }));
        expect(appendCurrentAssistantEntry).toHaveBeenCalledWith(runtime, expect.any(Number), true);
        expect(resetStreamingResponseState).toHaveBeenCalledWith(runtime);
        expect(resetStreamingResponseState.mock.invocationCallOrder[0]!)
            .toBeGreaterThan(appendCurrentAssistantEntry.mock.invocationCallOrder[0]!);
        expect(runtime.requestStartTime).toBeGreaterThan(1);
        expect(updateTokenDisplay).toHaveBeenCalledWith(runtime);
        expect(rebuildNavMarkers).toHaveBeenCalledWith(runtime);
    });
});
