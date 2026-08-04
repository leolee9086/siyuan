import {beforeEach, describe, expect, it, vi} from "vitest";

const resolveTargetPolicy = vi.hoisted(() => vi.fn(() => ({sendingAvailable: true})));

vi.mock("../../../../../src/layout/dock/agent/chat/ui/feedback/imports", () => ({
    resolveTargetPolicy,
}));

import type {AgentChatRuntime} from "../../../../../src/layout/dock/agent/chat/AgentChat.runtime.types";
import {
    setStreaming,
    updateSendButtonState,
} from "../../../../../src/layout/dock/agent/chat/ui/feedback/AgentChat.streamingState";

function createRuntime(registered: boolean) {
    const composerText = {value: "queued while running"};
    const runtime = {
        isStreaming: false,
        sessionFileOperationPending: false,
        conversationKind: "native-agent",
        modelOptions: [{}],
        composer: {getSendData: vi.fn(() => ({text: composerText.value}))},
        composerHost: document.createElement("div"),
        sendBtn: document.createElement("button"),
        stopBtn: document.createElement("button"),
        targetSelect: document.createElement("select"),
        newSessionBtn: document.createElement("button"),
        sessionMenuBtn: document.createElement("button"),
        sessionFilesBtn: document.createElement("button"),
        sessionPanel: {close: vi.fn()},
        capabilities: {closeMenu: vi.fn()},
        conversationController: registered ? {
            state: {
                adapter: {
                    kind: "native-agent",
                    capabilities: {supportsQueue: true, supportsSteer: true},
                },
            },
        } : null,
    } as unknown as AgentChatRuntime;
    return {runtime, composerText};
}

describe("Agent Panel running input controls", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("keeps the Composer and send command available while a registered adapter is running", () => {
        const {runtime, composerText} = createRuntime(true);

        setStreaming(runtime, true);

        expect(runtime.sendBtn.classList.contains("fn__none")).toBe(false);
        expect(runtime.stopBtn.classList.contains("fn__none")).toBe(false);
        expect((runtime.sendBtn as HTMLButtonElement).disabled).toBe(false);
        expect(runtime.composerHost.classList.contains("agent-chat__composer-host--disabled")).toBe(false);
        expect(runtime.stopBtn.getAttribute("aria-disabled")).toBe("false");

        composerText.value = "";
        updateSendButtonState(runtime);
        expect((runtime.sendBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it("preserves the existing send and stop mutual exclusion for an unregistered target", () => {
        const {runtime} = createRuntime(false);

        setStreaming(runtime, true);

        expect(runtime.sendBtn.classList.contains("fn__none")).toBe(true);
        expect(runtime.stopBtn.classList.contains("fn__none")).toBe(false);
        expect((runtime.sendBtn as HTMLButtonElement).disabled).toBe(true);
    });
});
