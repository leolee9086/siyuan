import {describe, expect, it, vi} from "vitest";
import {applyAgentPanelInteractionLock} from "../../../../../src/layout/dock/agent/runtime/agentPanel.interactionLock";

describe("Agent Panel interaction lock", () => {
    it("locks conversation controls and closes an open session panel", () => {
        const targetSelect = {disabled: false};
        const newSession = {setAttribute: vi.fn()};
        const sessionMenu = {setAttribute: vi.fn()};
        const closeSessionPanel = vi.fn();

        applyAgentPanelInteractionLock({
            targetSelect: targetSelect as HTMLSelectElement,
            conversationButtons: [newSession as unknown as HTMLElement, sessionMenu as unknown as HTMLElement],
            closeSessionPanel,
        }, true);

        expect(targetSelect.disabled).toBe(true);
        expect(newSession.setAttribute).toHaveBeenCalledWith("aria-disabled", "true");
        expect(sessionMenu.setAttribute).toHaveBeenCalledWith("aria-disabled", "true");
        expect(closeSessionPanel).toHaveBeenCalledOnce();
    });

    it("unlocks controls without closing the session panel", () => {
        const targetSelect = {disabled: true};
        const sessionMenu = {setAttribute: vi.fn()};
        const closeSessionPanel = vi.fn();

        applyAgentPanelInteractionLock({
            targetSelect: targetSelect as HTMLSelectElement,
            conversationButtons: [sessionMenu as unknown as HTMLElement],
            closeSessionPanel,
        }, false);

        expect(targetSelect.disabled).toBe(false);
        expect(sessionMenu.setAttribute).toHaveBeenCalledWith("aria-disabled", "false");
        expect(closeSessionPanel).not.toHaveBeenCalled();
    });
});
