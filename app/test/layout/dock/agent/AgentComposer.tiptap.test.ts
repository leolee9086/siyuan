import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {mountTiptapComposer} from "../../../../src/layout/dock/agent/AgentComposer.tiptap";

describe("Agent Tiptap composer standard suggestions", () => {
    beforeEach(() => {
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {
                languages: {agentInputPlaceholder: "Input message", back: "Back"},
                zIndex: 10,
            },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.replaceChildren();
    });

    it("renders slash skills through the standard Menu and closes it after selection", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            json: async () => ({data: [{name: "summarize", description: "Summarize selection"}]}),
        }));
        const host = document.createElement("div");
        document.body.append(host);
        const composer = mountTiptapComposer(host, vi.fn());

        composer.insertText("/");

        await vi.waitFor(() => {
            expect(document.querySelector('[data-name="agent-composer-suggestions"] .b3-menu__item')).not.toBeNull();
        });
        const menu = document.querySelector<HTMLElement>('[data-name="agent-composer-suggestions"]');
        const item = menu?.querySelector<HTMLButtonElement>(".b3-menu__item");
        expect(menu?.classList.contains("fn__none")).toBe(false);
        expect(item?.textContent).toContain("summarize");

        item?.click();

        expect(composer.getSendData().text).toContain("summarize");
        expect(menu?.classList.contains("fn__none")).toBe(true);
        composer.destroy();
    });

    it("uses the same standard Menu for mentions and confirms the current item by keyboard", async () => {
        vi.stubGlobal("Lute", {UnEscapeHTMLStr: (value: string) => value});
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            json: async () => ({
                data: {
                    blocks: [{
                        id: "block-id",
                        content: "Block title",
                        type: "NodeParagraph",
                        hPath: "/Notebook/Document",
                    }],
                },
            }),
        }));
        const host = document.createElement("div");
        document.body.append(host);
        const composer = mountTiptapComposer(host, vi.fn());

        composer.insertText("@doc");

        await vi.waitFor(() => {
            expect(document.querySelector('[data-name="agent-composer-suggestions"] .b3-menu__item')).not.toBeNull();
        });
        const menu = document.querySelector<HTMLElement>('[data-name="agent-composer-suggestions"]');
        const editor = host.querySelector<HTMLElement>(".ProseMirror");
        editor?.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", bubbles: true, cancelable: true}));

        expect(composer.getSendData().references).toEqual([{id: "block-id", title: "Block title"}]);
        expect(menu?.classList.contains("fn__none")).toBe(true);
        composer.destroy();
    });

    it("does not reopen the menu when a skill response arrives after destroy", async () => {
        let resolveResponse: ((value: {json: () => Promise<{data: unknown[]}>}) => void) | undefined;
        const response = new Promise<{json: () => Promise<{data: unknown[]}>}>((resolve) => {
            resolveResponse = resolve;
        });
        vi.stubGlobal("fetch", vi.fn(() => response));
        const host = document.createElement("div");
        document.body.append(host);
        const composer = mountTiptapComposer(host, vi.fn());

        composer.insertText("/");
        composer.destroy();
        resolveResponse?.({json: async () => ({data: [{name: "late"}]})});
        await response;
        await Promise.resolve();

        const menu = document.querySelector<HTMLElement>('[data-name="agent-composer-suggestions"]');
        expect(menu?.classList.contains("fn__none")).not.toBe(false);
    });
});
