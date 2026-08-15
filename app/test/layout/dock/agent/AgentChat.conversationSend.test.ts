import {beforeEach, describe, expect, it, vi} from "vitest";

const getSelectedModel = vi.hoisted(() => vi.fn(() => "provider:model"));
const requireSiyuanConfig = vi.hoisted(() => vi.fn(() => ({appearance: {lang: "English"}})));
const saveSession = vi.hoisted(() => vi.fn(async () => undefined));
const handleSSEEvent = vi.hoisted(() => vi.fn());
const handleConfigError = vi.hoisted(() => vi.fn());
const setStreaming = vi.hoisted(() => vi.fn());
const isActiveAgentPanelRequest = vi.hoisted(() => vi.fn(() => true));
const startOutgoingAgentTurn = vi.hoisted(() => vi.fn(async () => "legacy-entry"));
const createAgentChatRequestContext = vi.hoisted(() => vi.fn(() => ({
    conversation: {kind: "native-agent", sessionId: "session-1"},
    signal: new AbortController().signal,
})));
const isAgentConversationControlError = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/layout/dock/agent/chat/message/sending/imports", () => ({
    getSelectedModel,
    requireSiyuanConfig,
    saveSession,
    handleSSEEvent,
    handleConfigError,
    setStreaming,
    isActiveAgentPanelRequest,
    isAgentConversationControlError,
}));
vi.mock("../../../../src/layout/dock/agent/chat/message/sending/AgentChat.send.helpers", () => ({
    startOutgoingAgentTurn,
    createAgentChatRequestContext,
}));

import type {AgentChatRuntime} from "../../../../src/layout/dock/agent/chat/AgentChat.runtime.types";
import type {AgentConversationState} from "../../../../src/layout/dock/agent/runtime/conversation/agentConversation.types";
import {submitAgentChatConversation} from "../../../../src/layout/dock/agent/chat/message/sending/AgentChat.conversationSend";

function createRequest() {
    return {
        text: "new input",
        blockHTML: "<p>new input</p>",
        references: [],
        editorContext: undefined,
        pluginActions: [],
    };
}

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
        sessionID: "session-1", activation: 1, eventSeq: 0, queueVersion: 7, queueItems: [],
        turnID: "", phase: "idle", steerable: false, selectedDelivery: "queue",
        subscriptionController: null, reconnectTimer: 0, submittingInputIDs: new Set(),
        connected: true, disposed: false,
        ...overrides,
    };
}

function createRuntime(state: AgentConversationState, ids: string[] = ["input-1", "entry-1"], revision = 7) {
    const controller = {
        state,
        activate: vi.fn(async () => undefined),
        connect: vi.fn(async () => undefined),
        refresh: vi.fn(async () => undefined),
        dispose: vi.fn(),
        submit: vi.fn(async (input) => ({inputID: input.inputID, queueVersion: 8})),
        updateQueue: vi.fn(async (mutation) => ({inputID: mutation.input.inputID, queueVersion: 8})),
        cancelQueue: vi.fn(), promoteQueue: vi.fn(), interrupt: vi.fn(), setDelivery: vi.fn(),
    };
    const runtime = {
        sessionId: "session-1",
        conversationKind: "native-agent",
        entries: [{id: "existing", type: "user", content: "already saved"}],
        selectedReasoningEffort: "high",
        editingQueueInputID: "",
        abortController: null,
        conversationController: controller,
        sessionPorts: {
            requestHeaders: vi.fn(() => ({Authorization: "Bearer test"})),
            repository: {
				getRevision: vi.fn(() => revision),
                newSessionId: vi.fn(() => ids.shift() || "generated-id"),
                load: vi.fn(async () => ({id: "session-1", revision: 9})),
            },
        },
        composer: {clear: vi.fn()},
        promptSourceController: {closeActions: vi.fn()},
        capabilities: {showMessage: vi.fn()},
    } as unknown as AgentChatRuntime;
    return {runtime, controller};
}

describe("AgentChat conversation sending", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

	it("admits an idle input as a direct turn without rewriting an existing session", async () => {
        const {runtime, controller} = createRuntime(createState());
        const originalEntries = runtime.entries;

        await submitAgentChatConversation(runtime, createRequest());

        expect(controller.submit).toHaveBeenCalledOnce();
        expect(controller.submit.mock.calls[0]![0]).toMatchObject({
			inputID: "input-1", userEntryID: "entry-1", delivery: "turn", sessionID: "session-1",
            message: "new input",
        });
        expect(controller.submit.mock.calls[0]![0]).not.toHaveProperty("expectedTurnID");
        expect(controller.updateQueue).not.toHaveBeenCalled();
        expect(runtime.entries).toBe(originalEntries);
        expect(runtime.entries).toHaveLength(1);
        expect(runtime.composer!.clear).toHaveBeenCalledOnce();
        expect(runtime.promptSourceController.closeActions).toHaveBeenCalledOnce();
		expect(saveSession).not.toHaveBeenCalled();
	});

	it("persists a new session once before its first direct turn admission", async () => {
		const {runtime, controller} = createRuntime(createState(), ["input-1", "entry-1"], 0);

		await submitAgentChatConversation(runtime, createRequest());

		expect(saveSession).toHaveBeenCalledOnce();
		expect(controller.submit.mock.calls[0]![0]).toMatchObject({delivery: "turn"});
	});

    it("selects steer for a steerable running turn and queue when explicitly selected", async () => {
        const state = createState({turnID: "turn-1", phase: "provider_stream", steerable: true, selectedDelivery: "steer"});
        const {runtime, controller} = createRuntime(state, ["steer-id", "steer-entry", "queue-id", "queue-entry"]);

        await submitAgentChatConversation(runtime, createRequest());
        state.selectedDelivery = "queue";
        await submitAgentChatConversation(runtime, createRequest());

        expect(controller.submit).toHaveBeenCalledTimes(2);
        expect(controller.submit.mock.calls[0]![0]).toMatchObject({
            inputID: "steer-id", delivery: "steer", expectedTurnID: "turn-1",
        });
        expect(controller.submit.mock.calls[1]![0]).toMatchObject({
            inputID: "queue-id", delivery: "queue",
        });
		expect(controller.submit.mock.calls[1]![0]).not.toHaveProperty("expectedTurnID");
		expect(saveSession).not.toHaveBeenCalled();
    });

    it("edits a pending queue item through update while retaining its inputID", async () => {
        const state = createState({turnID: "turn-1", phase: "provider_stream", steerable: true});
        const {runtime, controller} = createRuntime(state, ["new-entry"]);
        runtime.editingQueueInputID = "existing-queue-input";

        await submitAgentChatConversation(runtime, createRequest());

        expect(controller.updateQueue).toHaveBeenCalledOnce();
        expect(controller.updateQueue.mock.calls[0]![0]).toMatchObject({
            queueVersion: 7,
            input: {inputID: "existing-queue-input", delivery: "queue", message: "new input"},
        });
        expect(controller.submit).not.toHaveBeenCalled();
        expect(runtime.editingQueueInputID).toBe("");
    });

    it("refreshes the authoritative revision and retries once on a session revision conflict", async () => {
        const {runtime, controller} = createRuntime(createState());
        const conflict = Object.assign(new Error("agent session revision conflict"), {
            reason: "session_revision_conflict", queueVersion: 8, status: 409,
        });
        isAgentConversationControlError.mockImplementation((value: unknown) =>
            value instanceof Error && typeof (value as {reason?: unknown}).reason === "string" &&
            typeof (value as {queueVersion?: unknown}).queueVersion === "number" &&
            typeof (value as {status?: unknown}).status === "number");
        controller.submit
            .mockRejectedValueOnce(conflict)
            .mockResolvedValueOnce({inputID: "input-1", queueVersion: 9});

        const result = await submitAgentChatConversation(runtime, createRequest());

        // 冲突后重新加载权威会话刷新本地修订，并以同一 inputID 幂等重试。
        expect(runtime.sessionPorts.repository.load).toHaveBeenCalledWith("session-1");
        expect(controller.submit).toHaveBeenCalledTimes(2);
        expect(controller.submit.mock.calls[1]![0]).toMatchObject({inputID: "input-1", message: "new input"});
        expect(result).toBeUndefined();
        expect(runtime.capabilities.showMessage).not.toHaveBeenCalled();
    });

    it("does not retry non-conflict submission failures", async () => {
        const {runtime, controller} = createRuntime(createState());
        isAgentConversationControlError.mockReturnValue(false);
        controller.submit.mockRejectedValueOnce(new Error("model unavailable"));

        await submitAgentChatConversation(runtime, createRequest());

        expect(controller.submit).toHaveBeenCalledTimes(1);
        expect(runtime.sessionPorts.repository.load).not.toHaveBeenCalled();
        expect(runtime.capabilities.showMessage).toHaveBeenCalledWith("model unavailable", 4000);
    });
});
