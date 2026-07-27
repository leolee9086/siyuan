import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    openSettings: vi.fn(),
}));

vi.mock("../../../../../src/layout/dock/agent/runtime/host/imports", () => ({
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

vi.mock("../../../../../src/layout/dock/agent/runtime/host/agentPanel.menu.app.factory", () => ({
    createAppPanelMenuPort: vi.fn(() => ({popup: vi.fn(), close: vi.fn()})),
}));

vi.mock("../../../../../src/layout/dock/agent/runtime/host/agentPanel.reload.browser.factory", () => ({
    createBrowserHostReload: vi.fn(() => vi.fn()),
}));

import {createAppAgentPanelCapabilities} from "../../../../../src/layout/dock/agent/runtime/host/agentPanel.capabilities.app";

describe("App Agent Panel capabilities", () => {
    beforeEach(() => {
        mocks.openSettings.mockReset();
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {dialogs: []},
        });
    });

    it("opens the AI settings through the complete App facade", async () => {
        const capabilities = createAppAgentPanelCapabilities({
            openSettings: mocks.openSettings,
        } as never, {} as never);

        await capabilities.settingsNavigation.openAISettings();

        expect(mocks.openSettings).toHaveBeenCalledWith("ai");
    });

    it("does not replace an already open settings dialog", async () => {
        window.siyuan.dialogs = [{
            element: {querySelector: vi.fn(() => document.createElement("div"))},
        }] as never;
        const capabilities = createAppAgentPanelCapabilities({
            openSettings: mocks.openSettings,
        } as never, {} as never);

        await capabilities.settingsNavigation.openAISettings();

        expect(mocks.openSettings).not.toHaveBeenCalled();
    });
});
