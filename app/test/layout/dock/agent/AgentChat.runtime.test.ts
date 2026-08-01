import {describe, expect, it, vi} from "vitest";

import type {AgentChatRuntime} from "../../../../src/layout/dock/agent/chat/AgentChat.runtime.types";
import {applyAgentChatSessionSave} from "../../../../src/layout/dock/agent/chat/session/persistence/AgentChat.bootstrap.helpers";
import {createAgentChatSessionSnapshot} from "../../../../src/layout/dock/agent/chat/session/persistence/AgentChat.bootstrap.helpers";
import {dispatchSSEEvent} from "../../../../src/layout/dock/agent/chat/stream/protocol/AgentChat.sse.helpers";

describe("AgentChat explicit runtime state", () => {
    it("applies a turn event directly to observable state", async () => {
        const runtime = {currentTurnID: ""} as AgentChatRuntime;

        await dispatchSSEEvent(runtime, {type: "turn", turnID: "turn-1"});

        expect(runtime.currentTurnID).toBe("turn-1");
    });
});

describe("AgentChat session persistence helpers", () => {
    it("builds an isolated session snapshot with the active turn metadata", () => {
        const originalEntry = {type: "user" as const, content: "hello"};
        const runtime = {
            entries: [originalEntry],
            pendingConfirms: [{type: "confirm", name: "write_file", args: {}, confirmID: "confirm-1"}],
            sessionTitle: "Session title",
            conversationKind: "native-agent",
            hasTitled: true,
            contextTokens: 12,
            contextTokenBreakdown: {system: 4, user: 8},
            contextCachedTokens: 3,
            contextLimit: 4096,
            sessionCreatedAt: 100,
            composer: {getHistory: vi.fn(() => ["previous prompt"])},
            sessionPorts: {
                presentation: {getSelectedModel: vi.fn(() => "model-1")},
            },
        } as unknown as AgentChatRuntime;

        const snapshot = createAgentChatSessionSnapshot(runtime, {sessionID: "session-1", turnID: "turn-1"});

        expect(snapshot).toMatchObject({
            id: "session-1",
            title: "Session title",
            targetKind: "native-agent",
            commitTurnID: "turn-1",
            messageHistory: ["previous prompt"],
            model: "model-1",
        });
        expect(snapshot.entries).toHaveLength(2);
        expect(snapshot.entries).not.toBe(runtime.entries);
        originalEntry.content = "changed after snapshot";
        expect(snapshot.entries?.[0]).toMatchObject({content: "hello"});
    });

    it("clears only the saved turn state and refreshes prompt-source metadata", async () => {
        const refresh = vi.fn(async () => undefined);
        const runtime = {
            sessionId: "session-1",
            pendingSessionTitle: "Generated title",
            currentTurnID: "turn-1",
            isStreaming: false,
            recoveryCommitTurnIDs: new Map([["session-1", "turn-1"]]),
            pendingRecoverySessionIDs: new Set(["session-1"]),
            promptSourceController: {refresh},
        } as unknown as AgentChatRuntime;
        const session = {id: "session-1", title: "Generated title", createdAt: 1, updatedAt: 2};

        await applyAgentChatSessionSave(runtime, {
            sessionID: "session-1",
            turnID: "turn-1",
            pendingTitle: "Generated title",
            session,
            savedSession: session,
        });

        expect(runtime.recoveryCommitTurnIDs.has("session-1")).toBe(false);
        expect(runtime.pendingRecoverySessionIDs.has("session-1")).toBe(false);
        expect(runtime.pendingSessionTitle).toBeNull();
        expect(runtime.currentTurnID).toBe("");
        expect(refresh).toHaveBeenCalledOnce();
    });
});
