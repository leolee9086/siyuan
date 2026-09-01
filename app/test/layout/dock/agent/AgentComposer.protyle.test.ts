import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createTestAppFacade} from "../../../app/AppFacade.fixture";
import {createProtyleDomainFixture} from "../../../support/protyleDomain.fixture";

const mocks = vi.hoisted(() => ({fetchPost: vi.fn()}));

vi.mock("../../../../src/constants", () => ({
    Constants: {ZWSP: "\u200b"},
}));

vi.mock("../../../../src/util/DOM/escape", () => ({
    escapeHtml: (value: string) => value,
}));

vi.mock("../../../../src/util/network/fetch", () => ({
    fetchPost: mocks.fetchPost,
}));

vi.mock("../../../../src/protyle/hint/extend.hintRef", () => ({
    hintRef: vi.fn(() => []),
}));

vi.mock("../../../../src/block/element.factory", () => ({
    genEmptyElement: () => {
        const paragraph = document.createElement("div");
        paragraph.append(document.createElement("div"));
        return paragraph;
    },
}));

vi.mock("../../../../src/protyle/render/blockRender", () => ({
    blockRender: vi.fn(),
}));

import {mountProtyleComposer} from "../../../../src/layout/dock/agent/AgentComposer.protyle";

describe("Agent Protyle composer hint lifecycle", () => {
    beforeEach(() => {
        mocks.fetchPost.mockReset();
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {languages: {agentInputPlaceholder: "Input message"}},
        });
    });

    afterEach(() => {
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    it("moves the hint to the floating overlay and delegates cleanup to Protyle", () => {
        const host = document.createElement("div");
        const editorElement = document.createElement("div");
        const hintElement = document.createElement("div");
        const destroyProtyle = vi.fn(() => hintElement.remove());
        document.body.append(host);

        const protyleDomain = createProtyleDomainFixture();
        Object.assign(protyleDomain.protyle, {
            hint: {element: hintElement},
            lute: {},
            undo: {clear: vi.fn()},
            wysiwyg: {element: editorElement},
        });
        protyleDomain.destroy = destroyProtyle;

        const app = createTestAppFacade();
        app.createProtyle = vi.fn((target: HTMLElement) => {
            target.append(hintElement);
            return protyleDomain;
        });

        const composer = mountProtyleComposer(app, host, vi.fn());

        expect(hintElement.parentElement).toBe(document.body);
        expect(document.body.contains(hintElement)).toBe(true);
        expect(host.contains(hintElement)).toBe(false);

        composer.destroy();

        expect(destroyProtyle).toHaveBeenCalledOnce();
        expect(hintElement.isConnected).toBe(false);
    });

    it("destroys a Protyle runtime that does not provide the required hint", () => {
        const host = document.createElement("div");
        const destroyProtyle = vi.fn();
        const protyleDomain = createProtyleDomainFixture();
        Object.assign(protyleDomain.protyle, {
            wysiwyg: {element: document.createElement("div")},
        });
        protyleDomain.destroy = destroyProtyle;

        const app = createTestAppFacade();
        app.createProtyle = vi.fn(() => protyleDomain);

        expect(() => mountProtyleComposer(app, host, vi.fn())).toThrowError(
            "Agent Protyle Composer requires a Hint runtime",
        );
        expect(destroyProtyle).toHaveBeenCalledOnce();
    });

    it("ignores a skill response that arrives after the Protyle composer is destroyed", () => {
        let respond: ((response: IWebSocketData) => void) | undefined;
        mocks.fetchPost.mockImplementation((
            _url: string,
            _data: unknown,
            callback: (response: IWebSocketData) => void,
        ) => {
            respond = callback;
            return Promise.resolve();
        });
        const host = document.createElement("div");
        const editorElement = document.createElement("div");
        const hintElement = document.createElement("div");
        const genHTML = vi.fn();
        let skillHint: ((key: string, protyle: IProtyle) => IHintData[]) | undefined;
        const protyleDomain = createProtyleDomainFixture();
        Object.assign(protyleDomain.protyle, {
            hint: {element: hintElement, genLoading: vi.fn(), genHTML},
            lute: {},
            undo: {clear: vi.fn()},
            wysiwyg: {element: editorElement},
        });
        const app = createTestAppFacade();
        app.createProtyle = vi.fn((_target: HTMLElement, options: IProtyleOptions) => {
            Object.assign(protyleDomain.protyle, {options});
            const extensions = options.hint?.extend ?? [];
            for (const extension of extensions) {
                if (extension.key === "/") {
                    skillHint = extension.hint;
                }
            }
            return protyleDomain;
        });
        const composer = mountProtyleComposer(app, host, vi.fn());

        skillHint?.("", protyleDomain.protyle);
        composer.destroy();
        respond?.({data: [{name: "late"}], msg: "", code: 0});

        expect(genHTML).not.toHaveBeenCalled();
    });
});
