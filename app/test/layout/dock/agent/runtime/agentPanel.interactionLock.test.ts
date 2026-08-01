import {describe, expect, it, vi} from "vitest";
import type {AgentChatRuntime} from "../../../../../src/layout/dock/agent/chat/AgentChat.runtime.types";
import {applyAgentPanelInteractionLock} from "../../../../../src/layout/dock/agent/chat/ui/feedback/AgentChat.streamingState";

describe("Agent Panel interaction lock", () => {
    it("locks conversation controls and closes an open session panel", () => {
        const targetSelect = {disabled: false};
        const newSession = {setAttribute: vi.fn()};
        const sessionMenu = {setAttribute: vi.fn()};
        const closeSessionPanel = vi.fn();

        const sessionFiles = {setAttribute: vi.fn()};
        const runtime = {
            targetSelect: targetSelect as HTMLSelectElement,
            newSessionBtn: newSession,
            sessionMenuBtn: sessionMenu,
            sessionFilesBtn: sessionFiles,
            sessionPanel: {close: closeSessionPanel},
        } as unknown as AgentChatRuntime;

        applyAgentPanelInteractionLock(runtime, true);

        expect(targetSelect.disabled).toBe(true);
        expect(newSession.setAttribute).toHaveBeenCalledWith("aria-disabled", "true");
        expect(sessionMenu.setAttribute).toHaveBeenCalledWith("aria-disabled", "true");
        expect(sessionFiles.setAttribute).toHaveBeenCalledWith("aria-disabled", "true");
        expect(closeSessionPanel).toHaveBeenCalledOnce();
    });

    it("unlocks controls without closing the session panel", () => {
        const targetSelect = {disabled: true};
        const newSession = {setAttribute: vi.fn()};
        const sessionMenu = {setAttribute: vi.fn()};
        const sessionFiles = {setAttribute: vi.fn()};
        const closeSessionPanel = vi.fn();

        const runtime = {
            targetSelect: targetSelect as HTMLSelectElement,
            newSessionBtn: newSession,
            sessionMenuBtn: sessionMenu,
            sessionFilesBtn: sessionFiles,
            sessionPanel: {close: closeSessionPanel},
        } as unknown as AgentChatRuntime;

        applyAgentPanelInteractionLock(runtime, false);

        expect(targetSelect.disabled).toBe(false);
        expect(newSession.setAttribute).toHaveBeenCalledWith("aria-disabled", "false");
        expect(sessionMenu.setAttribute).toHaveBeenCalledWith("aria-disabled", "false");
        expect(sessionFiles.setAttribute).toHaveBeenCalledWith("aria-disabled", "false");
        expect(closeSessionPanel).not.toHaveBeenCalled();
    });
});
