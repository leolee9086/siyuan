import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const dockSpies = vi.hoisted(() => ({
    agentConstructor: vi.fn(),
    createCapabilities: vi.fn((app, tab) => ({app, tab})),
}));

vi.mock("../../../../src/layout/dock/agent/AgentChat", () => ({
    AgentChat: class {
        constructor(app, tab, options) {
            dockSpies.agentConstructor(app, tab, options);
        }
    },
}));

vi.mock("../../../../src/layout/dock/agent/runtime/host/agentPanel.capabilities.app.factory", () => ({
    createAppAgentPanelCapabilities: dockSpies.createCapabilities,
}));

describe("Agent Dock factory", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("document", {getElementById: vi.fn(() => null)});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("injects the complete App capability adapter and copy factory", async () => {
        const {createAgentDockModel} = await import("../../../../src/layout/dock/agent/runtime/host/dock/dockModel.factory");
        const app = {name: "app"};
        const tab = {name: "dock-tab"};

        createAgentDockModel(app as never, tab as never);

        expect(dockSpies.createCapabilities).toHaveBeenCalledWith(app, tab);
        const options = dockSpies.agentConstructor.mock.calls[0]?.[2];
        expect(options?.capabilities).toEqual({app, tab});

        const copyTab = {name: "copy-tab"};
        expect(options?.capabilitiesFactory(copyTab)).toEqual({app, tab: copyTab});
        expect(dockSpies.createCapabilities).toHaveBeenLastCalledWith(app, copyTab);
    });
});
