import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    openSettings: vi.fn(),
    Dialog: vi.fn(),
}));

vi.mock("../../../../../src/layout/dock/agent/runtime/host/imports", () => ({
    Dialog: mocks.Dialog,
    confirmDialog: vi.fn(),
    showMessage: vi.fn(),
    sendNotification: vi.fn(),
    setPanelFocus: vi.fn(),
    getDockByType: vi.fn(() => ({toggleModel: vi.fn()})),
    requestOpenTabAsDialog: vi.fn(),
    requestOpenTabAsTab: vi.fn(),
    listActions: vi.fn(() => []),
    lookupAction: vi.fn(),
    openIdentityAccessTab: vi.fn(),
    requestMagiIdentityAccess: vi.fn(),
    postRender: vi.fn(),
}));

vi.mock("../../../../../src/layout/dock/agent/runtime/host/agentPanel.menu.app", () => ({
    showAppPanelMenu: vi.fn(),
    closeAppPanelMenu: vi.fn(),
}));

vi.mock("../../../../../src/layout/dock/agent/runtime/host/agentPanel.reload.browser.factory", () => ({
    createBrowserHostReload: vi.fn(() => vi.fn()),
}));

import {createAppAgentPanelCapabilities} from "../../../../../src/layout/dock/agent/runtime/host/agentPanel.capabilities.app.factory";

describe("App Agent Panel capabilities", () => {
    beforeEach(() => {
        mocks.openSettings.mockReset();
        mocks.Dialog.mockReset();
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {dialogs: []},
        });
    });

    it("creates dialogs through the App host capability", () => {
        const capabilities = createAppAgentPanelCapabilities({} as never, {} as never);
        const options = {content: "<div></div>"};

        capabilities.createDialog?.(options);

        expect(mocks.Dialog).toHaveBeenCalledWith(options);
    });

    it("opens the AI settings through the complete App facade", async () => {
        const capabilities = createAppAgentPanelCapabilities({
            openSettings: mocks.openSettings,
            globalCommand: vi.fn(() => false),
        } as never, {} as never);

        await capabilities.openAISettings?.();

        expect(mocks.openSettings).toHaveBeenCalledWith("ai");
    });

    it("does not replace an already open settings dialog", async () => {
        window.siyuan.dialogs = [{
            element: {querySelector: vi.fn(() => document.createElement("div"))},
        }] as never;
        const capabilities = createAppAgentPanelCapabilities({
            openSettings: mocks.openSettings,
        } as never, {} as never);

        await capabilities.openAISettings?.();

        expect(mocks.openSettings).not.toHaveBeenCalled();
    });
});
