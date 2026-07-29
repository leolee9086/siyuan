import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createTestAppFacade} from "../../../app/AppFacade.fixture";
import {createProtyleDomainFixture} from "../../../support/protyleDomain.fixture";

vi.mock("../../../../src/constants", () => ({
    Constants: {ZWSP: "\u200b"},
}));

vi.mock("../../../../src/util/DOM/escape", () => ({
    escapeHtml: (value: string) => value,
}));

vi.mock("../../../../src/util/network/fetch", () => ({
    fetchPost: vi.fn(),
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

describe("Agent Protyle composer overlays", () => {
    beforeEach(() => {
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {languages: {agentInputPlaceholder: "Input message"}},
        });
    });

    afterEach(() => {
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    it("mounts the fixed hint at the viewport root and removes it on destroy", () => {
        const host = document.createElement("div");
        const editorElement = document.createElement("div");
        const hintElement = document.createElement("div");
        const destroyProtyle = vi.fn();
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
});
