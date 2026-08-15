import {beforeEach, describe, expect, it, vi} from "vitest";

const reloadFromDisk = vi.hoisted(() => vi.fn(async () => undefined));
const recoverInterruptedTurn = vi.hoisted(() => vi.fn(async () => undefined));
const handleCurrentSessionDeleted = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/layout/dock/agent/chat/session/switching/imports", () => ({
    reloadFromDisk,
    recoverInterruptedTurn,
}));
vi.mock("../../../../src/layout/dock/agent/chat/session/switching/AgentChat.switch", () => ({
    handleCurrentSessionDeleted,
}));

import type {AgentChatRuntime} from "../../../../src/layout/dock/agent/chat/AgentChat.runtime.types";
import {onWsMessage} from "../../../../src/layout/dock/agent/chat/session/switching/AgentChat.websocket";

function createRuntime(overrides: Partial<AgentChatRuntime> = {}) {
    const runtime = {
        sessionId: "session-1",
        isStreaming: false,
        mirrorLocked: false,
        sessionPanel: {refresh},
        sessionPorts: {
            presentation: {removeMirror: vi.fn()},
            turnLifecycle: {restorePendingEditDraft: vi.fn()},
        },
        pendingRecoverySessionIDs: new Set<string>(),
        currentTurnID: "",
        conversationController: null,
        ...overrides,
    } as unknown as AgentChatRuntime;
    return runtime;
}

function wsData(sessionID: string, action: string) {
    return {cmd: "agentSessionChanged", data: {sessionID, action}};
}

describe("AgentChat websocket session mirroring", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("mirror-locks and reloads from disk when the session event stream is not subscribed", () => {
        const runtime = createRuntime();
        onWsMessage(runtime, wsData("session-1", "streamStart"));
        expect(runtime.mirrorLocked).toBe(true);
        expect(reloadFromDisk).toHaveBeenCalledWith(runtime);
    });

    it("ignores streamStart when this instance already subscribes the session event stream", () => {
        const runtime = createRuntime({
            conversationController: {state: {sessionID: "session-1", connected: true}},
        } as unknown as Partial<AgentChatRuntime>);
        onWsMessage(runtime, wsData("session-1", "streamStart"));
        // 事件流是权威实时源，镜像锁与磁盘快照重载会清掉已投影的实时进度卡片。
        expect(runtime.mirrorLocked).toBe(false);
        expect(reloadFromDisk).not.toHaveBeenCalled();
    });

    it("ignores mirror events while this instance is streaming itself", () => {
        const runtime = createRuntime({isStreaming: true});
        onWsMessage(runtime, wsData("session-1", "streamStart"));
        expect(runtime.mirrorLocked).toBe(false);
        expect(reloadFromDisk).not.toHaveBeenCalled();
    });

    it("reloads on update and unlocks mirror with draft restore on streamEnd", () => {
        const runtime = createRuntime({mirrorLocked: true});
        onWsMessage(runtime, wsData("session-1", "update"));
        expect(reloadFromDisk).toHaveBeenCalledWith(runtime);

        reloadFromDisk.mockClear();
        onWsMessage(runtime, wsData("session-1", "streamEnd"));
        expect(runtime.mirrorLocked).toBe(false);
        expect(runtime.sessionPorts.presentation.removeMirror).toHaveBeenCalledWith(runtime);
        expect(runtime.sessionPorts.turnLifecycle.restorePendingEditDraft).toHaveBeenCalledWith(runtime);
        expect(reloadFromDisk).not.toHaveBeenCalled();
    });

    it("delegates deletion of the current session to the switch handler", () => {
        const runtime = createRuntime({mirrorLocked: true});
        onWsMessage(runtime, wsData("session-1", "delete"));
        expect(runtime.mirrorLocked).toBe(false);
        expect(handleCurrentSessionDeleted).toHaveBeenCalledWith(runtime);
    });
});
