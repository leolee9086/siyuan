import {beforeEach, describe, expect, it, vi} from "vitest";

const runtime = vi.hoisted(() => ({
    list: vi.fn(),
    getTaskDirectoryCapabilities: vi.fn(),
}));

vi.mock("../../../../src/layout/dock/agent/session-panel/imports", () => ({
    SessionStore: {
        list: runtime.list,
        getTaskDirectoryCapabilities: runtime.getTaskDirectoryCapabilities,
    },
}));

vi.mock("../../../../src/layout/dock/agent/session-panel/view", () => ({}));
vi.mock("../../../../src/layout/dock/agent/session-panel/menu.actions", () => ({
    buildTaskDirectoryMenuActions: vi.fn(() => []),
}));
vi.mock("../../../../src/layout/dock/agent/session-panel/directory-path-dialog.factory", () => ({
    requestAgentTaskDirectoryPath: vi.fn(),
}));

describe("Agent session panel controller", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        Object.defineProperty(window, "siyuan", {value: {}, configurable: true});
    });

    it("reports an initialization request failure through the host error callback", async () => {
        const failure = new Error("capability response was empty");
        runtime.list.mockResolvedValue({sessions: [], total: 0, page: 1, pageSize: 30});
        runtime.getTaskDirectoryCapabilities.mockRejectedValue(failure);
        const onError = vi.fn();
        const {createAgentSessionPanelController} = await import(
            "../../../../src/layout/dock/agent/session-panel/controller"
        );
        const controller = createAgentSessionPanelController({
            triggerBtn: document.createElement("button"),
            host: document.createElement("div"),
            getCurrentSessionId: () => "session-1",
            getDefaultTitle: () => "Agent",
            getTargetKind: () => "native-agent",
            callbacks: {
                onSwitch: vi.fn(),
                onDelete: vi.fn(),
                onRename: vi.fn(),
                onError,
            },
        });

        controller.toggle();

        await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(failure));
        expect(console.error).toHaveBeenCalledWith("[AgentSessionPanel] operation failed", failure);
    });
});
