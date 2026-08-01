import {afterEach, describe, expect, it, vi} from "vitest";
import {createAgentPromptSourceController} from "../../../../src/layout/dock/agent/prompt/AgentPromptSource.factory";
import type {AgentPromptSourceState} from "../../../../src/layout/dock/agent/prompt/AgentPromptSource.types";

const promptSourceRepository = vi.hoisted(() => ({
    getPromptSource: vi.fn(),
    searchPromptSourceDocuments: vi.fn(),
    resolvePromptSourceDocument: vi.fn(),
    bindPromptSourceDocument: vi.fn(),
    refreshPromptSourceDocument: vi.fn(),
    keepPromptSourceDocument: vi.fn(),
    createPromptSourceDocument: vi.fn(),
}));
const getSessionRevision = vi.hoisted(() => vi.fn());
const requestDocument = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/layout/dock/agent/prompt/dialog/AgentPromptSourceDialog", () => ({
    requestAgentPromptSourceDocument: requestDocument,
}));

const documentSource = (state: AgentPromptSourceState["state"] = "eligible"): AgentPromptSourceState => ({
    state,
    revision: 3,
    source: {
        kind: "document",
        documentId: "20260730000000-source",
        titleSnapshot: "系统宪章",
        contentHash: "hash",
        capturedAt: Date.UTC(2026, 6, 30),
        sourceVersion: "3",
    },
});

const defaultSource = (): AgentPromptSourceState => ({state: "eligible", revision: 2, source: {kind: "default"}});

function createController(options: {menu?: boolean; state?: AgentPromptSourceState; promptVisible?: boolean} = {}) {
    const root = document.createElement("div");
    root.innerHTML = `<div data-type="row"><span data-type="label"></span><button data-type="select"></button><button data-type="actions"></button></div>`;
    const popup = vi.fn();
    const close = vi.fn();
    const createDialog = vi.fn();
    const ensurePersisted = vi.fn().mockResolvedValue(undefined);
    const refreshSessionPanel = vi.fn().mockResolvedValue(undefined);
    const controller = createAgentPromptSourceController(options.menu === false ? {createDialog} : {
        createDialog,
        showMenu: popup,
        closeMenu: close,
    }, {
        getConversation: () => ({kind: "native-agent", sessionId: "session-1"}),
        ensurePersisted,
        refreshSessionPanel,
        isStreaming: () => false,
        isDestroyed: () => false,
        getTargetPolicy: () => ({
            title: "Agent",
            identityLabel: "",
            identityVisible: false,
            sessionActionsVisible: true,
            promptSourceVisible: options.promptVisible ?? true,
            regenerationVisible: true,
            sendingAvailable: true,
        }),
        getSessionRevision,
        sourceRepository: promptSourceRepository,
    });
    controller.attach({
        row: root.querySelector('[data-type="row"]')!,
        label: root.querySelector('[data-type="label"]')!,
        selectButton: root.querySelector('[data-type="select"]')!,
        actionsButton: root.querySelector('[data-type="actions"]')!,
    });
    return {root, popup, close, createDialog, ensurePersisted, refreshSessionPanel, controller};
}

describe("AgentPromptSourceController", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("opens document selection from the primary button and keeps it out of lifecycle actions", async () => {
        getSessionRevision.mockReturnValue(1);
        promptSourceRepository.getPromptSource
            .mockResolvedValueOnce(defaultSource())
            .mockResolvedValue(documentSource());
        const selectedDocument = {
            id: "20260730000000-source",
            notebookId: "20260730000000-notebook",
            title: "系统宪章",
            hPath: "/系统宪章",
        };
        requestDocument.mockResolvedValue(selectedDocument);
        promptSourceRepository.bindPromptSourceDocument.mockResolvedValue(documentSource());
        const {root, popup, createDialog} = createController();

        root.querySelector<HTMLButtonElement>('[data-type="select"]')!.click();
        await vi.waitFor(() => expect(promptSourceRepository.bindPromptSourceDocument).toHaveBeenCalledWith({
            id: "session-1",
            document: selectedDocument,
            expectedRevision: 2,
        }));
        expect(requestDocument).toHaveBeenCalledWith(promptSourceRepository, createDialog);

        root.querySelector<HTMLButtonElement>('[data-type="actions"]')!.click();
        await vi.waitFor(() => expect(popup).toHaveBeenCalled());
        const actions = popup.mock.calls.at(-1)![2] as Array<{label: string}>;
        expect(actions.map((item) => item.label)).toEqual(["将当前系统提示词创建为文档"]);
    });

    it("hides lifecycle actions without a menu capability while keeping document selection available", async () => {
        getSessionRevision.mockReturnValue(1);
        promptSourceRepository.getPromptSource.mockResolvedValue(documentSource());
        const {root, controller} = createController({menu: false});

        await controller.refresh();

        expect(controller.state.sourceState).toEqual(documentSource());
        expect(controller.state.operationPending).toBe(false);
        expect(controller.state.elements?.row).toBe(root.querySelector('[data-type="row"]'));
        expect(root.querySelector<HTMLButtonElement>('[data-type="select"]')!.disabled).toBe(false);
        expect(root.querySelector<HTMLButtonElement>('[data-type="actions"]')!.classList.contains("fn__none")).toBe(true);
    });

    it("locks replacement after a successful turn but keeps explicit snapshot lifecycle actions", async () => {
        getSessionRevision.mockReturnValue(1);
        promptSourceRepository.getPromptSource.mockResolvedValue(documentSource("locked"));
        const {root, popup, controller} = createController();

        await controller.refresh();
        expect(root.querySelector<HTMLButtonElement>('[data-type="select"]')!.disabled).toBe(true);
        expect(root.querySelector<HTMLButtonElement>('[data-type="actions"]')!.classList.contains("fn__none")).toBe(false);

        root.querySelector<HTMLButtonElement>('[data-type="actions"]')!.click();
        await vi.waitFor(() => expect(popup).toHaveBeenCalled());
        const actions = popup.mock.calls.at(-1)![2] as Array<{label: string}>;
        expect(actions.map((item) => item.label)).toEqual(["将当前系统提示词创建为文档"]);
    });
});
