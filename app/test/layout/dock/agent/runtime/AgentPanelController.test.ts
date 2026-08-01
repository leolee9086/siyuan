import {beforeEach, describe, expect, it, vi} from "vitest";

const runtimeSpies = vi.hoisted(() => ({
    addModel: vi.fn(),
    chatDestroy: vi.fn(),
    chatReady: vi.fn<() => Promise<void>>(),
    getConversation: vi.fn(() => ({kind: "native-agent" as const, sessionId: "session-1"})),
    openConversation: vi.fn<() => Promise<void>>(),
    panelAddClass: vi.fn(),
    panelRemove: vi.fn(),
    refreshSessions: vi.fn<() => Promise<void>>(),
    setDraft: vi.fn<() => Promise<void>>(),
}));

vi.mock("../../../../../src/layout/Tab", () => ({
    Tab: class {
        panelElement = {
            classList: {add: runtimeSpies.panelAddClass},
            remove: runtimeSpies.panelRemove,
        };
        headElement = {remove: vi.fn()};
        addModel = runtimeSpies.addModel;
    },
}));

vi.mock("../../../../../src/layout/dock/agent/AgentChat", () => ({
    AgentChat: class {
        destroy = runtimeSpies.chatDestroy;
        getConversation = runtimeSpies.getConversation;
        openConversation = runtimeSpies.openConversation;
        ready = runtimeSpies.chatReady;
        refreshSessions = runtimeSpies.refreshSessions;
        setDraft = runtimeSpies.setDraft;
    },
}));

function createMountOptions() {
    return {
        target: {replaceChildren: vi.fn()} as unknown as HTMLElement,
        initialConversation: {kind: "native-agent" as const},
    };
}

describe("AgentPanelController lifecycle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeSpies.chatReady.mockResolvedValue();
        runtimeSpies.openConversation.mockResolvedValue();
        runtimeSpies.refreshSessions.mockResolvedValue();
        runtimeSpies.setDraft.mockResolvedValue();
    });

    it("delegates public conversation and draft operations", async () => {
        const {mountAgentPanel} = await import(
            "../../../../../src/layout/dock/agent/runtime/AgentPanelController.factory"
        );
        const controller = await mountAgentPanel(createMountOptions());

        await controller.openConversation({kind: "magi", sessionId: "magi-session"});
        await controller.refreshSessions();
        await controller.setDraft("avatar prompt", false);

        expect(runtimeSpies.openConversation).toHaveBeenCalledWith({kind: "magi", sessionId: "magi-session"});
        expect(runtimeSpies.refreshSessions).toHaveBeenCalledOnce();
        expect(runtimeSpies.setDraft).toHaveBeenCalledWith("avatar prompt", false);
        expect(controller.getConversation()).toEqual({kind: "native-agent", sessionId: "session-1"});
    });

    it("destroys chat and DOM exactly once", async () => {
        const {mountAgentPanel} = await import(
            "../../../../../src/layout/dock/agent/runtime/AgentPanelController.factory"
        );
        const controller = await mountAgentPanel(createMountOptions());

        controller.destroy();
        controller.destroy();

        expect(runtimeSpies.chatDestroy).toHaveBeenCalledOnce();
        expect(runtimeSpies.panelRemove).toHaveBeenCalledOnce();
    });

    it("destroys a partial instance when ready rejects", async () => {
        runtimeSpies.chatReady.mockRejectedValueOnce(new Error("initialization failed"));
        const {mountAgentPanel} = await import(
            "../../../../../src/layout/dock/agent/runtime/AgentPanelController.factory"
        );

        await expect(mountAgentPanel(createMountOptions())).rejects.toThrow("initialization failed");
        expect(runtimeSpies.chatDestroy).toHaveBeenCalledOnce();
        expect(runtimeSpies.panelRemove).toHaveBeenCalledOnce();
    });
});
