import {beforeEach, describe, expect, it, vi} from "vitest";

const repository = vi.hoisted(() => ({
    list: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    rename: vi.fn(),
    setPermission: vi.fn(),
    getRevision: vi.fn(),
    newSessionId: vi.fn(),
}));
const taskDirectories = vi.hoisted(() => ({
    canBindTaskDirectories: vi.fn(),
    listTaskDirectories: vi.fn(),
    bindTaskDirectory: vi.fn(),
    addTaskDirectory: vi.fn(),
    unbindTaskDirectory: vi.fn(),
}));

vi.mock("../../../../src/layout/dock/agent/session-panel/imports", () => ({}));

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
        repository.list.mockResolvedValue({sessions: [], total: 0, page: 1, pageSize: 30});
        taskDirectories.canBindTaskDirectories.mockRejectedValue(failure);
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
            sessionRepository: {
                ...repository,
                revisionState: {
                    revisions: new Map(),
                    runtimeRevisions: new Map(),
                    pendingSaves: new Map(),
                },
            },
            taskDirectoryRepository: taskDirectories,
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
