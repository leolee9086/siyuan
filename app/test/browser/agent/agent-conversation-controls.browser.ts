import {describe, expect, it, vi} from "vitest";

import type {AgentChatRuntime} from "../../../src/layout/dock/agent/chat/AgentChat.runtime.types";
import type {
    AgentConversationAdapter,
    AgentConversationState,
    AgentConversationSubscription,
} from "../../../src/layout/dock/agent/runtime/conversation/agentConversation.types";
import {createAgentConversationController} from "../../../src/layout/dock/agent/runtime/conversation/AgentConversationController.factory";
import {createAgentConversationAdapterRegistry} from "../../../src/layout/dock/agent/runtime/conversation/agentConversation.registry";
import {
    bindAgentConversationControls,
    renderAgentConversationControls,
} from "../../../src/layout/dock/agent/chat/ui/queue/AgentChat.queueDock";

const requestHeaders = () => ({Authorization: "Bearer browser-test"});

function createPanel(controller: ReturnType<typeof createAgentConversationController>) {
    const deliveryControl = document.createElement("div");
    const steerDeliveryBtn = document.createElement("button");
    const queueDeliveryBtn = document.createElement("button");
    const queueDock = document.createElement("div");
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
    return runtime;
}

async function flushCommand() {
    await Promise.resolve();
    await Promise.resolve();
}

describe("Agent Panel queue controls in Chromium", () => {
    it("keeps two panels synchronized and executes queue actions in the real DOM", async () => {
        window.siyuan = {
            ...window.siyuan,
            languages: {
                ...window.siyuan?.languages,
                edit: "Edit",
                cancel: "Cancel",
                agentSteer: "Steer",
                agentQueuePending: "Pending",
            },
        };
        const subscriptions: AgentConversationSubscription[] = [];
        const promoteQueue = vi.fn(async (input) => ({inputID: input.inputID, queueVersion: 4}));
        const cancelQueue = vi.fn(async (input) => ({inputID: input.inputID, queueVersion: 4}));
        const adapter: AgentConversationAdapter = {
            kind: "native-agent",
            capabilities: {
                supportsSteer: true, supportsQueue: true, supportsInterrupt: true,
                supportsQueueEdit: true, usesSessionEvents: true,
            },
            submit: vi.fn(async (input) => ({inputID: input.inputID})),
            loadQueue: vi.fn(async () => ({queueVersion: 0, items: []})),
            subscribe: vi.fn(async (subscription) => {
                subscriptions.push(subscription);
                await new Promise<void>((resolve) => {
                    subscription.signal.addEventListener("abort", () => resolve(), {once: true});
                });
            }),
            promoteQueue,
            cancelQueue,
        };
        const registry = createAgentConversationAdapterRegistry([adapter]);
        const createController = () => createAgentConversationController({
            adapters: registry,
            initialKind: "native-agent",
            hooks: {
                requestHeaders,
                onEvent: vi.fn(),
                onStateChange: vi.fn(),
                onResync: vi.fn(),
            },
        });
        const first = createController();
        const second = createController();
        await first.activate("native-agent", "session-1");
        await second.activate("native-agent", "session-1");
        const items = [1, 2, 3].map((index) => ({
            input: {
                id: `queue-${index}`,
                sessionId: "session-1",
                semantics: "queue",
                content: index === 1 ? "<strong>first</strong>" : `queued ${index}`,
            },
            state: "pending",
            seq: index,
            queuePos: index,
        }));
        const sharedEvent = {
            type: "session_state",
            sessionID: "session-1",
            eventSeq: 1,
            timestamp: 1,
            turnID: "turn-1",
            phase: "provider_stream",
            steerable: true,
            queue: {queueVersion: 3, items},
        };
        await Promise.all(subscriptions.map((subscription) => subscription.onEvent(sharedEvent)));
        const firstPanel = createPanel(first);
        const secondPanel = createPanel(second);
        renderAgentConversationControls(firstPanel, first.state as AgentConversationState);
        renderAgentConversationControls(secondPanel, second.state as AgentConversationState);

        expect(first.state.eventSeq).toBe(1);
        expect(second.state.eventSeq).toBe(1);
        expect(first.state.queueVersion).toBe(3);
        expect(second.state.queueVersion).toBe(3);
        expect(firstPanel.queueDock.querySelectorAll(".agent-chat__queue-item")).toHaveLength(3);
        expect(secondPanel.queueDock.textContent).toBe(firstPanel.queueDock.textContent);
        expect(firstPanel.queueDock.querySelector("strong")).toBeNull();
        expect(firstPanel.queueDock.textContent).toContain("<strong>first</strong>");

        firstPanel.queueDock.querySelector<HTMLButtonElement>("[data-queue-action=edit]")?.click();
        expect(firstPanel.editingQueueInputID).toBe("queue-1");
        expect(firstPanel.composer?.setText).toHaveBeenCalledWith("<strong>first</strong>");
        firstPanel.queueDock.querySelector<HTMLButtonElement>("[data-queue-action=promote]")?.click();
        secondPanel.queueDock.querySelector<HTMLButtonElement>("[data-queue-action=cancel]")?.click();
        await flushCommand();

        expect(promoteQueue).toHaveBeenCalledWith(expect.objectContaining({
            sessionID: "session-1", inputID: "queue-1", expectedTurnID: "turn-1", queueVersion: 3,
        }), undefined);
        expect(cancelQueue).toHaveBeenCalledWith(expect.objectContaining({
            sessionID: "session-1", inputID: "queue-1", queueVersion: 3,
        }), undefined);
        first.dispose();
        second.dispose();
    }, 10_000);
});
