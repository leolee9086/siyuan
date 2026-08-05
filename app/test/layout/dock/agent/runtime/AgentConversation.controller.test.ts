import {afterEach, describe, expect, it, vi} from "vitest";

import type {
    AgentConversationAdapter,
    AgentConversationAdmission,
    AgentConversationQueueSnapshot,
    AgentConversationSessionEvent,
    AgentConversationSubmitInput,
    AgentConversationSubscription,
} from "../../../../../src/layout/dock/agent/runtime/conversation/agentConversation.types";
import {createAgentConversationController} from "../../../../../src/layout/dock/agent/runtime/conversation/AgentConversationController.factory";
import {createAgentConversationAdapterRegistry} from "../../../../../src/layout/dock/agent/runtime/conversation/agentConversation.registry";

const requestHeaders = vi.fn(() => ({Authorization: "Bearer test"}));

function queueSnapshot(queueVersion: number, id = "queue-1"): AgentConversationQueueSnapshot {
    return {
        queueVersion,
        items: [{
            input: {id, sessionId: "session-1", semantics: "queue", content: `content-${queueVersion}`},
            state: "pending", seq: queueVersion, queuePos: 1,
        }],
    };
}

function sessionEvent(type: string, eventSeq: number, values: Record<string, unknown> = {}): AgentConversationSessionEvent {
    return {type, sessionID: "session-1", eventSeq, timestamp: eventSeq, ...values};
}

function submitInput(inputID = "queue-1"): AgentConversationSubmitInput {
    return {
        inputID,
        userEntryID: `entry-${inputID}`,
        sessionID: "session-1",
        delivery: "queue",
        message: "queued message",
        language: "English",
        references: [],
        contentRevision: 1,
        history: [],
        requestHeaders,
    };
}

function createHarness(adapterOverrides: Partial<AgentConversationAdapter> = {}) {
    const subscriptions: AgentConversationSubscription[] = [];
    const adapter: AgentConversationAdapter = {
        kind: "native-agent",
        capabilities: {
            supportsSteer: true,
            supportsQueue: true,
            supportsInterrupt: true,
            supportsQueueEdit: true,
            usesSessionEvents: true,
        },
        submit: vi.fn(async (input) => ({inputID: input.inputID, queueVersion: 1})),
        loadQueue: vi.fn(async () => ({queueVersion: 0, items: []})),
        subscribe: vi.fn(async (subscription) => {
            subscriptions.push(subscription);
            await new Promise<void>((resolve) => {
                subscription.signal.addEventListener("abort", () => resolve(), {once: true});
            });
        }),
        ...adapterOverrides,
    };
    const onEvent = vi.fn();
    const onStateChange = vi.fn();
    const onResync = vi.fn(async () => undefined);
    const controller = createAgentConversationController({
        adapters: createAgentConversationAdapterRegistry([adapter]),
        initialKind: "native-agent",
        reconnectDelayMs: 25,
        hooks: {requestHeaders, onEvent, onStateChange, onResync},
    });
    return {adapter, controller, subscriptions, onEvent, onStateChange, onResync};
}

describe("Agent conversation controller", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("keeps an authoritative SSE snapshot when an older HTTP admission arrives later", async () => {
        let resolveAdmission: ((value: AgentConversationAdmission) => void) | undefined;
        const admission = new Promise<AgentConversationAdmission>((resolve) => {
            resolveAdmission = resolve;
        });
        const harness = createHarness({submit: vi.fn(() => admission)});
        await harness.controller.activate("native-agent", "session-1");
        const pending = harness.controller.submit(
            submitInput(), {onEvent: vi.fn(), onError: vi.fn()}, new AbortController().signal,
        );
        expect(harness.controller.state.queueItems[0]!).toMatchObject({optimistic: true});

        await harness.subscriptions[0]!.onEvent(sessionEvent("queue_state", 1, {queue: queueSnapshot(2)}));
        resolveAdmission?.({inputID: "queue-1", admittedSeq: 1, queueVersion: 1});
        await pending;

        expect(harness.controller.state.queueVersion).toBe(2);
        expect(harness.controller.state.queueItems).toEqual(queueSnapshot(2).items);
        expect(harness.controller.state.queueItems[0]!.optimistic).toBeUndefined();
        harness.controller.dispose();
    });

    it("does not represent a direct idle turn as an optimistic queue item", async () => {
        let resolveAdmission: ((value: AgentConversationAdmission) => void) | undefined;
        const admission = new Promise<AgentConversationAdmission>((resolve) => {
            resolveAdmission = resolve;
        });
        const harness = createHarness({submit: vi.fn(() => admission)});
        await harness.controller.activate("native-agent", "session-1");
        const input = {...submitInput("turn-1"), delivery: "turn" as const};
        const pending = harness.controller.submit(
            input, {onEvent: vi.fn(), onError: vi.fn()}, new AbortController().signal,
        );

        expect(harness.controller.state.queueItems).toEqual([]);
        resolveAdmission?.({inputID: "turn-1", admittedSeq: 1, queueVersion: 1});
        await pending;
        harness.controller.dispose();
    });

    it("accepts newer snapshots and events while discarding lower versions and duplicate sequences", async () => {
        const harness = createHarness({
            submit: vi.fn(async (input) => ({inputID: input.inputID, admittedSeq: 3, queueVersion: 3})),
        });
        await harness.controller.activate("native-agent", "session-1");
        await harness.controller.submit(
            submitInput(), {onEvent: vi.fn(), onError: vi.fn()}, new AbortController().signal,
        );
        expect(harness.controller.state.queueVersion).toBe(3);
        expect(harness.controller.state.queueItems[0]!).toMatchObject({optimistic: false, seq: 3});

        const subscription = harness.subscriptions[0]!;
        await subscription.onEvent(sessionEvent("queue_state", 1, {queue: queueSnapshot(5)}));
        await subscription.onEvent(sessionEvent("queue_state", 2, {queue: queueSnapshot(4, "stale")}));
        await subscription.onEvent(sessionEvent("content", 3, {token: "new"}));
        await subscription.onEvent(sessionEvent("content", 3, {token: "duplicate"}));
        await subscription.onEvent(sessionEvent("content", 2, {token: "late"}));

        expect(harness.controller.state.queueVersion).toBe(5);
        expect(harness.controller.state.queueItems[0]!.input.id).toBe("queue-1");
        expect(harness.controller.state.eventSeq).toBe(3);
        expect(harness.onEvent).toHaveBeenCalledOnce();
        expect(harness.onEvent.mock.calls[0]![0]).toMatchObject({token: "new"});
        harness.controller.dispose();
    });

    it("resyncs authoritatively and isolates old subscriptions across switch and dispose", async () => {
        const loadQueue = vi.fn()
            .mockResolvedValueOnce(queueSnapshot(1))
            .mockResolvedValueOnce(queueSnapshot(5))
            .mockResolvedValueOnce({queueVersion: 2, items: []});
        const harness = createHarness({loadQueue});
        await harness.controller.activate("native-agent", "session-1");
        const oldSubscription = harness.subscriptions[0]!;

        await oldSubscription.onEvent(sessionEvent("resync_required", 8));
        expect(harness.controller.state.queueVersion).toBe(5);
        expect(harness.onResync).toHaveBeenCalledWith("session-1");

        await harness.controller.activate("native-agent", "session-2");
        const newSubscription = harness.subscriptions[1]!;
        expect(oldSubscription.signal.aborted).toBe(true);
        await oldSubscription.onEvent(sessionEvent("content", 9, {token: "old"}));
        await newSubscription.onEvent({
            ...sessionEvent("content", 1, {token: "new"}), sessionID: "session-2",
        });
        expect(harness.onEvent).toHaveBeenCalledOnce();
        expect(harness.onEvent.mock.calls[0]![0]).toMatchObject({token: "new", sessionID: "session-2"});

        harness.controller.dispose();
        expect(newSubscription.signal.aborted).toBe(true);
        await newSubscription.onEvent({
            ...sessionEvent("content", 2, {token: "disposed"}), sessionID: "session-2",
        });
        expect(harness.onEvent).toHaveBeenCalledOnce();
    });

    it("reconnects from the latest event cursor and cancels retries on dispose", async () => {
        vi.useFakeTimers();
        const subscriptions: AgentConversationSubscription[] = [];
        const subscribe = vi.fn(async (subscription: AgentConversationSubscription) => {
            subscriptions.push(subscription);
            if (subscriptions.length === 1) {
                await subscription.onEvent(sessionEvent("content", 4, {token: "before disconnect"}));
            }
        });
        const harness = createHarness({subscribe});
        await harness.controller.activate("native-agent", "session-1");
        await Promise.resolve();
        await Promise.resolve();
        expect(harness.controller.state.eventSeq).toBe(4);

        await vi.advanceTimersByTimeAsync(25);
        expect(subscribe).toHaveBeenCalledTimes(2);
        expect(subscriptions[1]!.after).toBe(4);
        harness.controller.dispose();
        await vi.advanceTimersByTimeAsync(50);
        expect(subscribe).toHaveBeenCalledTimes(2);
    });

    it("keeps two panel controllers on the same event and queue versions", async () => {
        const subscriptions: AgentConversationSubscription[] = [];
        const subscribe = vi.fn(async (subscription: AgentConversationSubscription) => {
            subscriptions.push(subscription);
            await new Promise<void>((resolve) => {
                subscription.signal.addEventListener("abort", () => resolve(), {once: true});
            });
        });
        const first = createHarness({subscribe});
        const second = createHarness({subscribe});
        await first.controller.activate("native-agent", "session-1");
        await second.controller.activate("native-agent", "session-1");
        const sharedEvent = sessionEvent("queue_state", 6, {queue: queueSnapshot(4)});

        await Promise.all(subscriptions.map((subscription) => subscription.onEvent(sharedEvent)));

        expect(first.controller.state.eventSeq).toBe(6);
        expect(second.controller.state.eventSeq).toBe(6);
        expect(first.controller.state.queueVersion).toBe(4);
        expect(second.controller.state.queueVersion).toBe(4);
        expect(first.controller.state.queueItems).toEqual(second.controller.state.queueItems);
        await subscriptions[0]!.onEvent(sharedEvent);
        expect(first.controller.state.eventSeq).toBe(6);
        first.controller.dispose();
        second.controller.dispose();
    });
});
