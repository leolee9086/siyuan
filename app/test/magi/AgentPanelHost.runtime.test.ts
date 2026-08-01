import {beforeEach, describe, expect, it, vi} from "vitest";

const hostSpies = vi.hoisted(() => ({
    bootstrap: vi.fn<() => Promise<void>>(),
    createCapabilities: vi.fn(() => ({kind: "browser-capabilities"})),
    mount: vi.fn(),
    panelDestroy: vi.fn(),
    setDraft: vi.fn<() => Promise<void>>(),
}));

vi.mock("../../src/agent-standalone/bootstrap", () => ({
    bootstrapAgentPanelRuntime: hostSpies.bootstrap,
}));

vi.mock("../../src/agent-standalone/capabilities.browser.factory", () => ({
    createBrowserAgentPanelCapabilities: hostSpies.createCapabilities,
}));

vi.mock("../../src/layout/dock/agent/runtime/AgentPanelController.factory", () => ({
    mountAgentPanel: hostSpies.mount,
}));

const listeners = new Map<string, EventListener>();

describe("MAGI Agent Panel host runtime", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        listeners.clear();
        hostSpies.bootstrap.mockResolvedValue();
        hostSpies.setDraft.mockResolvedValue();
        hostSpies.mount.mockResolvedValue({
            destroy: hostSpies.panelDestroy,
            setDraft: hostSpies.setDraft,
        });
        vi.stubGlobal("window", {
            addEventListener: vi.fn((type: string, listener: EventListener) => listeners.set(type, listener)),
            removeEventListener: vi.fn((type: string) => listeners.delete(type)),
        });
        vi.stubGlobal("CustomEvent", class extends Event {
            detail: unknown;

            constructor(type: string, options?: {detail?: unknown}) {
                super(type);
                this.detail = options?.detail;
            }
        });
    });

    it("destroys a panel that arrives after the host was disposed", async () => {
        let resolveMount: ((panel: unknown) => void) | undefined;
        hostSpies.mount.mockReturnValueOnce(new Promise((resolve) => {
            resolveMount = resolve;
        }));
        const {createMagiAgentPanelHostRuntime} = await import(
            "../../src/magi/components/agent-panel-host/AgentPanelHostRuntime.factory"
        );
        const runtime = createMagiAgentPanelHostRuntime({} as HTMLElement);

        await Promise.resolve();
        runtime.destroy();
        resolveMount?.({destroy: hostSpies.panelDestroy, setDraft: hostSpies.setDraft});
        await runtime.ready;

        expect(hostSpies.panelDestroy).toHaveBeenCalledOnce();
        expect(listeners.size).toBe(0);
    });

    it("queues avatar text during bootstrap and forwards later updates", async () => {
        let resolveBootstrap: (() => void) | undefined;
        hostSpies.bootstrap.mockReturnValueOnce(new Promise<void>((resolve) => {
            resolveBootstrap = resolve;
        }));
        const {createMagiAgentPanelHostRuntime} = await import(
            "../../src/magi/components/agent-panel-host/AgentPanelHostRuntime.factory"
        );
        const runtime = createMagiAgentPanelHostRuntime({} as HTMLElement);
        const listener = listeners.values().next().value;

        listener?.(new CustomEvent("avatar", {detail: "  first prompt  "}));
        resolveBootstrap?.();
        await runtime.ready;
        listener?.(new CustomEvent("avatar", {detail: "second prompt"}));

        expect(hostSpies.setDraft).toHaveBeenNthCalledWith(1, "first prompt");
        expect(hostSpies.setDraft).toHaveBeenNthCalledWith(2, "second prompt");
        runtime.destroy();
        runtime.destroy();
        expect(hostSpies.panelDestroy).toHaveBeenCalledOnce();
    });

    it("removes listeners when bootstrap fails", async () => {
        hostSpies.bootstrap.mockRejectedValueOnce(new Error("bootstrap failed"));
        const {createMagiAgentPanelHostRuntime} = await import(
            "../../src/magi/components/agent-panel-host/AgentPanelHostRuntime.factory"
        );
        const runtime = createMagiAgentPanelHostRuntime({} as HTMLElement);

        await expect(runtime.ready).rejects.toThrow("bootstrap failed");
        expect(listeners.size).toBe(0);
        expect(hostSpies.mount).not.toHaveBeenCalled();
    });
});
