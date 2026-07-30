import {afterEach, describe, expect, it, vi} from "vitest";
import {AgentPromptSourceController} from "../../../../src/layout/dock/agent/AgentPromptSourceController";
import type {AgentPromptSourceState} from "../../../../src/layout/dock/agent/SessionStore.types";

const sessionStore = vi.hoisted(() => ({
    getRevision: vi.fn(),
    getPromptSource: vi.fn(),
    bindPromptSourceDocument: vi.fn(),
    refreshPromptSourceDocument: vi.fn(),
    keepPromptSourceDocument: vi.fn(),
    createPromptSourceDocument: vi.fn(),
}));
const requestDocument = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/layout/dock/agent/SessionStore", () => ({SessionStore: sessionStore}));
vi.mock("../../../../src/layout/dock/agent/AgentPromptSourceDialog", () => ({
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
        capturedAt: "2026-07-30T00:00:00Z",
        sourceVersion: "3",
    },
});

const defaultSource = (): AgentPromptSourceState => ({state: "eligible", revision: 2, source: {kind: "default"}});

function createController(options: {menu?: boolean; state?: AgentPromptSourceState; promptVisible?: boolean} = {}) {
    const root = document.createElement("div");
    root.innerHTML = `<div data-type="row"><span data-type="label"></span><button data-type="select"></button><button data-type="actions"></button></div>`;
    const popup = vi.fn();
    const close = vi.fn();
    const ensurePersisted = vi.fn().mockResolvedValue(undefined);
    const refreshSessionPanel = vi.fn().mockResolvedValue(undefined);
    const controller = new AgentPromptSourceController(options.menu === false ? {} : {
        menu: {popup, close},
    }, {
        getConversation: () => ({kind: "native-agent", sessionId: "session-1"}),
        ensurePersisted,
        refreshSessionPanel,
        isStreaming: () => false,
        isDestroyed: () => false,
        getTargetPolicy: () => ({promptSourceVisible: options.promptVisible ?? true}),
    });
    controller.attach({
        row: root.querySelector('[data-type="row"]')!,
        label: root.querySelector('[data-type="label"]')!,
        selectButton: root.querySelector('[data-type="select"]')!,
        actionsButton: root.querySelector('[data-type="actions"]')!,
    });
    return {root, popup, close, ensurePersisted, refreshSessionPanel, controller};
}

describe("AgentPromptSourceController", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("opens document selection from the primary button and keeps it out of lifecycle actions", async () => {
        sessionStore.getRevision.mockReturnValue(1);
        sessionStore.getPromptSource
            .mockResolvedValueOnce(defaultSource())
            .mockResolvedValue(documentSource());
        requestDocument.mockResolvedValue({documentId: "20260730000000-source", title: "系统宪章"});
        sessionStore.bindPromptSourceDocument.mockResolvedValue(documentSource());
        const {root, popup} = createController();

        root.querySelector<HTMLButtonElement>('[data-type="select"]')!.click();
        await vi.waitFor(() => expect(sessionStore.bindPromptSourceDocument).toHaveBeenCalledWith(
            "session-1",
            {documentId: "20260730000000-source", title: "系统宪章"},
            2,
        ));

        root.querySelector<HTMLButtonElement>('[data-type="actions"]')!.click();
        await vi.waitFor(() => expect(popup).toHaveBeenCalled());
        const actions = popup.mock.calls.at(-1)![2] as Array<{label: string}>;
        expect(actions.map((item) => item.label)).toEqual(["将当前系统提示词创建为文档"]);
    });

    it("hides lifecycle actions without a menu capability while keeping document selection available", async () => {
        sessionStore.getRevision.mockReturnValue(1);
        sessionStore.getPromptSource.mockResolvedValue(documentSource());
        const {root, controller} = createController({menu: false});

        await controller.refresh();

        expect(root.querySelector<HTMLButtonElement>('[data-type="select"]')!.disabled).toBe(false);
        expect(root.querySelector<HTMLButtonElement>('[data-type="actions"]')!.classList.contains("fn__none")).toBe(true);
    });

    it("locks replacement after a successful turn but keeps explicit snapshot lifecycle actions", async () => {
        sessionStore.getRevision.mockReturnValue(1);
        sessionStore.getPromptSource.mockResolvedValue(documentSource("locked"));
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
