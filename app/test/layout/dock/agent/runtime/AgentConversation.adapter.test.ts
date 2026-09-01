import {beforeEach, describe, expect, it, vi} from "vitest";

const requestControl = vi.hoisted(() => vi.fn());
const subscribeEvents = vi.hoisted(() => vi.fn());

vi.mock("../../../../../src/layout/dock/agent/runtime/conversation/imports", () => ({
    requestAgentConversationControl: requestControl,
    subscribeAgentConversationEvents: subscribeEvents,
}));

import type {AgentConversationSubmitInput} from "../../../../../src/layout/dock/agent/runtime/conversation/agentConversation.types";
import {createNativeAgentConversationAdapter} from "../../../../../src/layout/dock/agent/runtime/conversation/nativeAgentConversation.adapter";

const requestHeaders = vi.fn(() => ({Authorization: "Bearer test"}));
const frontendCapabilities = [{
    id: "native/open_document",
    description: "Open a document",
    inputSchema: {type: "object"},
    source: "native" as const,
    generation: 1,
}];

function createInput(delivery: AgentConversationSubmitInput["delivery"] = "queue") {
    return {
        inputID: "input-1",
        userEntryID: "entry-1",
        sessionID: "session-1",
        delivery,
        ...(delivery === "steer" ? {expectedTurnID: "turn-1"} : {}),
        message: "guide the active turn",
        blockHTML: "<p>guide</p>",
        language: "English",
        references: [{id: "block-1", title: "Block"}],
        editorContext: {activeDocID: "doc-1"},
        pluginActions: [{name: "plugin-action", description: "Action"}],
        frontendCapabilities,
        model: "provider:model",
        reasoningEffort: "high",
        contentRevision: 7,
        history: [{role: "user" as const, content: "previous"}],
        requestHeaders,
    } satisfies AgentConversationSubmitInput;
}

describe("native Agent conversation adapter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requestControl.mockResolvedValue({inputID: "input-1", queueVersion: 2});
        subscribeEvents.mockResolvedValue(undefined);
    });

	it("uses distinct turn, steer and queue admissions without leaking chat history", async () => {
        const adapter = createNativeAgentConversationAdapter();
        const observer = {onEvent: vi.fn(), onError: vi.fn()};
        const controller = new AbortController();

        await adapter.submit(createInput("steer"), observer, controller.signal);
        expect(requestControl).toHaveBeenNthCalledWith(1, {
            path: "/api/ai/agent/steer",
            body: {
                inputID: "input-1",
                sessionID: "session-1",
                expectedTurnID: "turn-1",
                userEntryID: "entry-1",
                message: "guide the active turn",
                blockHTML: "<p>guide</p>",
                references: [{id: "block-1", title: "Block"}],
                editorContext: {activeDocID: "doc-1"},
            },
            requestHeaders,
            signal: controller.signal,
        });

        await adapter.submit(createInput(), observer, controller.signal);
        expect(requestControl).toHaveBeenNthCalledWith(2, {
            path: "/api/ai/agent/queue",
            body: {
                inputID: "input-1",
                sessionID: "session-1",
                userEntryID: "entry-1",
                message: "guide the active turn",
                blockHTML: "<p>guide</p>",
                language: "English",
                references: [{id: "block-1", title: "Block"}],
                editorContext: {activeDocID: "doc-1"},
                pluginActions: [{name: "plugin-action", description: "Action"}],
                frontendCapabilities,
                model: "provider:model",
                reasoningEffort: "high",
            },
            requestHeaders,
            signal: controller.signal,
        });
		expect(requestControl.mock.calls[1]![0].body).not.toHaveProperty("history");

		await adapter.submit(createInput("turn"), observer, controller.signal);
		expect(requestControl).toHaveBeenNthCalledWith(3, {
			path: "/api/ai/agent/turn",
			body: {
				inputID: "input-1",
				sessionID: "session-1",
				userEntryID: "entry-1",
				message: "guide the active turn",
				blockHTML: "<p>guide</p>",
				language: "English",
				references: [{id: "block-1", title: "Block"}],
				editorContext: {activeDocID: "doc-1"},
				pluginActions: [{name: "plugin-action", description: "Action"}],
                frontendCapabilities,
				model: "provider:model",
				reasoningEffort: "high",
			},
			requestHeaders,
			signal: controller.signal,
		});
    });

    it("forwards queue mutations, turn control and event subscription", async () => {
        const adapter = createNativeAgentConversationAdapter();
        const controller = new AbortController();
        const input = createInput();

        await adapter.loadQueue?.("session / 1", requestHeaders, controller.signal);
        await adapter.updateQueue?.({input, queueVersion: 3}, controller.signal);
        await adapter.cancelQueue?.({
            sessionID: "session-1", inputID: "input-1", queueVersion: 4, requestHeaders,
        }, controller.signal);
        await adapter.promoteQueue?.({
            sessionID: "session-1", inputID: "input-1", queueVersion: 5,
            expectedTurnID: "turn-1", requestHeaders,
        }, controller.signal);
        await adapter.interrupt?.({
            sessionID: "session-1", expectedTurnID: "turn-1", requestHeaders,
        }, controller.signal);

        expect(requestControl.mock.calls.map(([options]) => options.path)).toEqual([
            "/api/ai/agent/queue?sessionID=session%20%2F%201",
            "/api/ai/agent/queue/update",
            "/api/ai/agent/queue/cancel",
            "/api/ai/agent/queue/promote",
            "/api/ai/agent/interrupt",
        ]);
        expect(requestControl.mock.calls[0]![0]).toMatchObject({method: "GET", requestHeaders, signal: controller.signal});
        expect(requestControl.mock.calls[1]![0].body).toMatchObject({inputID: "input-1", queueVersion: 3});
        expect(requestControl.mock.calls[2]![0].body).toEqual({
            sessionID: "session-1", inputID: "input-1", queueVersion: 4,
        });
        expect(requestControl.mock.calls[3]![0].body).toEqual({
            sessionID: "session-1", inputID: "input-1", expectedTurnID: "turn-1", queueVersion: 5,
        });
        expect(requestControl.mock.calls[4]![0].body).toEqual({
            sessionID: "session-1", expectedTurnID: "turn-1", preserveQueue: true,
        });

        const subscription = {
            sessionID: "session-1", after: 9, signal: controller.signal,
            requestHeaders, onEvent: vi.fn(),
        };
        await adapter.subscribe?.(subscription);
        expect(subscribeEvents).toHaveBeenCalledWith(subscription);
    });
});
