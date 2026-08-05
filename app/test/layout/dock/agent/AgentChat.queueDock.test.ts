import {beforeEach, describe, expect, it, vi} from "vitest";

const getAgentChatLanguages = vi.hoisted(() => vi.fn(() => ({
    edit: "Edit",
    cancel: "Cancel",
    agentSteer: "Steer",
    agentQueuePending: "Pending",
    agentQueueInjecting: "Sending",
    agentQueueBlocked: "Blocked",
    agentQueueFailed: "Failed",
})));

vi.mock("../../../../src/layout/dock/agent/chat/ui/queue/imports", () => ({
    getAgentChatLanguages,
    escapeHtml: (value: string) => value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;"),
}));

import type {AgentChatRuntime} from "../../../../src/layout/dock/agent/chat/AgentChat.runtime.types";
import type {AgentConversationState} from "../../../../src/layout/dock/agent/runtime/conversation/agentConversation.types";
import {
    bindAgentConversationControls,
    clearAgentConversationControls,
    renderAgentConversationControls,
} from "../../../../src/layout/dock/agent/chat/ui/queue/AgentChat.queueDock";

const requestHeaders = vi.fn(() => ({Authorization: "Bearer test"}));

function createState(overrides: Partial<AgentConversationState> = {}): AgentConversationState {
    return {
        adapter: {
            kind: "native-agent",
            capabilities: {
                supportsSteer: true, supportsQueue: true, supportsInterrupt: true,
                supportsQueueEdit: true, usesSessionEvents: true,
            },
            submit: vi.fn(),
        },
        sessionID: "session-1", activation: 1, eventSeq: 1, queueVersion: 9,
        queueItems: [{
            input: {id: "queue-1", sessionId: "session-1", semantics: "queue", content: "<b>queued</b>"},
            state: "pending", seq: 1, queuePos: 1,
        }],
        turnID: "turn-1", phase: "provider_stream", steerable: true, selectedDelivery: "queue",
        subscriptionController: null, reconnectTimer: 0, submittingInputIDs: new Set(),
        connected: true, disposed: false,
        ...overrides,
    };
}

function createHarness(state: AgentConversationState) {
    const controller = {
        state,
        setDelivery: vi.fn(),
        promoteQueue: vi.fn(async () => ({inputID: "queue-1"})),
        cancelQueue: vi.fn(async () => ({inputID: "queue-1"})),
        refresh: vi.fn(async () => undefined),
    };
    const deliveryControl = document.createElement("div");
    deliveryControl.className = "fn__none";
    const steerDeliveryBtn = document.createElement("button");
    const queueDeliveryBtn = document.createElement("button");
    const queueDock = document.createElement("div");
    queueDock.className = "fn__none";
    const runtime = {
        deliveryControl,
        steerDeliveryBtn,
        queueDeliveryBtn,
        queueDock,
        editingQueueInputID: "",
        conversationController: controller,
        composer: {setText: vi.fn(), focus: vi.fn()},
        sessionPorts: {requestHeaders},
        capabilities: {showMessage: vi.fn()},
    } as unknown as AgentChatRuntime;
    bindAgentConversationControls(runtime);
    return {runtime, controller};
}

async function flushQueueCommand() {
    await Promise.resolve();
    await Promise.resolve();
}

describe("AgentChat queue dock", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders safely and performs delivery, edit, promote and cancel commands", async () => {
        const state = createState();
        const {runtime, controller} = createHarness(state);

        renderAgentConversationControls(runtime, state);

        expect(runtime.deliveryControl.classList.contains("fn__none")).toBe(false);
        expect(runtime.queueDock.classList.contains("fn__none")).toBe(false);
        expect(runtime.queueDock.querySelector(".agent-chat__queue-content")?.textContent).toBe("<b>queued</b>");
        expect(runtime.queueDock.querySelector(".agent-chat__queue-content b")).toBeNull();
        runtime.steerDeliveryBtn.click();
        runtime.queueDeliveryBtn.click();
        expect(controller.setDelivery.mock.calls.map(([delivery]) => delivery)).toEqual(["steer", "queue"]);

        runtime.queueDock.querySelector<HTMLButtonElement>("[data-queue-action=edit]")?.click();
        expect(runtime.editingQueueInputID).toBe("queue-1");
        expect(runtime.composer?.setText).toHaveBeenCalledWith("<b>queued</b>");
        expect(runtime.composer?.focus).toHaveBeenCalledOnce();

        runtime.queueDock.querySelector<HTMLButtonElement>("[data-queue-action=promote]")?.click();
        await flushQueueCommand();
        expect(controller.promoteQueue).toHaveBeenCalledWith({
            inputID: "queue-1", queueVersion: 9, expectedTurnID: "turn-1", requestHeaders,
        });

        runtime.queueDock.querySelector<HTMLButtonElement>("[data-queue-action=cancel]")?.click();
        await flushQueueCommand();
        expect(controller.cancelQueue).toHaveBeenCalledWith({
            inputID: "queue-1", queueVersion: 9, requestHeaders,
        });
    });

    it("disables invalid actions and refreshes authoritative state after command failure", async () => {
        const state = createState({steerable: false});
        state.queueItems[0]!.state = "injecting";
        const {runtime, controller} = createHarness(state);
        renderAgentConversationControls(runtime, state);

        expect(runtime.steerDeliveryBtn.disabled).toBe(true);
        expect(runtime.queueDock.querySelector<HTMLButtonElement>("[data-queue-action=edit]")?.disabled).toBe(true);
        expect(runtime.queueDock.querySelector<HTMLButtonElement>("[data-queue-action=promote]")?.disabled).toBe(true);
        expect(runtime.queueDock.querySelector<HTMLButtonElement>("[data-queue-action=cancel]")?.disabled).toBe(true);

        state.steerable = true;
        state.queueItems[0]!.state = "pending";
        controller.promoteQueue.mockRejectedValueOnce(new Error("queue version conflict"));
        renderAgentConversationControls(runtime, state);
        runtime.queueDock.querySelector<HTMLButtonElement>("[data-queue-action=promote]")?.click();
        await flushQueueCommand();

        expect(controller.refresh).toHaveBeenCalledOnce();
        expect(runtime.capabilities.showMessage).toHaveBeenCalledWith("queue version conflict", 4000);
    });

	it("drops terminal items, clears missing edit identity and removes controls for an unregistered target", () => {
        const state = createState();
        state.queueItems[0]!.state = "injected";
        const {runtime} = createHarness(state);
        runtime.editingQueueInputID = "queue-1";

        renderAgentConversationControls(runtime, state);
        expect(runtime.queueDock.classList.contains("fn__none")).toBe(true);
        expect(runtime.queueDock.innerHTML).toBe("");
        expect(runtime.editingQueueInputID).toBe("");

        runtime.deliveryControl.classList.remove("fn__none");
        runtime.queueDock.classList.remove("fn__none");
        runtime.queueDock.innerHTML = "stale";
        clearAgentConversationControls(runtime);
        expect(runtime.deliveryControl.classList.contains("fn__none")).toBe(true);
        expect(runtime.queueDock.classList.contains("fn__none")).toBe(true);
        expect(runtime.queueDock.innerHTML).toBe("");
	});

	it("never exposes direct user turns in the queue dock", () => {
		const state = createState();
		state.queueItems[0]!.input.semantics = "user_message";
		const {runtime} = createHarness(state);

		renderAgentConversationControls(runtime, state);

		expect(runtime.queueDock.classList.contains("fn__none")).toBe(true);
		expect(runtime.queueDock.innerHTML).toBe("");
	});
});
