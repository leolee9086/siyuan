import {beforeEach, describe, expect, it, vi} from "vitest";

const runtime = vi.hoisted(() => ({
    completeTemplate: true,
    destroy: vi.fn(),
    dialogElement: undefined as HTMLElement | undefined,
    fetchPost: vi.fn(),
    getDockByType: vi.fn(),
    platform: "browser-desktop" as "browser-desktop" | "browser-mobile",
    tagModel: {update: vi.fn()},
}));

vi.mock("../../src/dialog", () => ({
    Dialog: class {
        public readonly element: HTMLElement;

        constructor(options: {content: string}) {
            this.element = document.createElement("div");
            this.element.innerHTML = runtime.completeTemplate ? options.content : "<div></div>";
            runtime.dialogElement = this.element;
        }

        public destroy() {
            runtime.destroy();
        }
    },
}));

vi.mock("../../src/util/network/fetch", () => ({fetchPost: runtime.fetchPost}));
vi.mock("../../src/util/platform/functions", () => ({isMobile: () => false}));
vi.mock("../../src/constants", () => ({Constants: {DIALOG_RENAMETAG: "rename-tag"}}));
vi.mock("../../src/layout/query/dockByType", () => ({getDockByType: runtime.getDockByType}));
vi.mock("../../src/layout/dock/tag/tag.types", () => ({
    isTagDomain: (value: object | undefined) => value === runtime.tagModel,
}));
vi.mock("../../src/platform", () => ({
    get platform() {
        return runtime.platform;
    },
}));
vi.mock("../../src/util/DOM/upDownHint", () => ({upDownHint: vi.fn()}));
vi.mock("../../src/util/DOM/escape", () => ({
    escapeHtml: (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
}));
vi.mock("../../src/protyle/util/hasClosest", () => ({
    hasClosestByClassName: (node: Node, className: string) => node instanceof Element
        ? node.closest<HTMLElement>(`.${className}`) || false
        : false,
}));
vi.mock("../../src/protyle/util/compatibility", () => ({isNotCtrl: () => true}));
vi.mock("../../src/protyle/undo/keyboard/electronUndo", () => ({electronUndo: vi.fn()}));
vi.mock("../../src/util/siyuanEnvironments/i18n.getI18n.environment", () => ({
    siyuanI18n: {cancel: "Cancel", confirm: "Confirm", new: "New", rename: "Rename"},
}));

import {genTagList, renameTag} from "../../src/menus/tag.actions";

const response = (data: {tags?: string[]; k?: string}) => Object.assign({} as IWebSocketData, {data});

beforeEach(() => {
    runtime.completeTemplate = true;
    runtime.dialogElement = undefined;
    runtime.destroy.mockReset();
    runtime.fetchPost.mockReset();
    runtime.getDockByType.mockReset();
    runtime.platform = "browser-desktop";
    runtime.tagModel.update.mockReset();
    runtime.getDockByType.mockReturnValue({data: {tag: runtime.tagModel}});
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {},
    });
});

describe("tag action owner", () => {
    it("renders backend matches and escapes a new tag candidate", () => {
        runtime.fetchPost.mockImplementation((
            _url: string,
            _data: IObject,
            callback: (result: IWebSocketData) => void,
        ) => callback(response({tags: ["<mark>existing</mark>"], k: "new<tag>"})));
        const listElement = document.createElement("div");
        listElement.classList.add("fn__none");

        genTagList(listElement, "new<tag>");

        expect(runtime.fetchPost).toHaveBeenCalledWith(
            "/api/search/searchTag",
            {k: "new<tag>"},
            expect.any(Function),
        );
        expect(listElement.classList.contains("fn__none")).toBe(false);
        expect(listElement.querySelector('[data-type="new"] mark')?.innerHTML).toBe("new&lt;tag&gt;");
        expect(listElement.textContent).toContain("existing");
    });

    it("submits a rename and refreshes the mounted desktop tag model", () => {
        renameTag("old-tag");
        const inputElement = runtime.dialogElement?.querySelector<HTMLInputElement>("input");
        const confirmButton = runtime.dialogElement?.querySelector<HTMLButtonElement>(".b3-button--text");
        if (!inputElement || !confirmButton) {
            throw new Error("Expected complete rename dialog fixture");
        }
        inputElement.value = "new-tag";

        confirmButton.click();

        expect(runtime.fetchPost).toHaveBeenCalledWith(
            "/api/tag/renameTag",
            {oldLabel: "old-tag", newLabel: "new-tag"},
            expect.any(Function),
        );
        const callback = runtime.fetchPost.mock.calls[0]?.[2] as ((result: IWebSocketData) => void) | undefined;
        expect(callback).toBeTypeOf("function");
        callback?.(response({}));
        expect(runtime.destroy).toHaveBeenCalledOnce();
        expect(runtime.tagModel.update).toHaveBeenCalledOnce();
    });

    it("refreshes the mounted mobile tag model without querying desktop docks", () => {
        runtime.platform = "browser-mobile";
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {mobile: {docks: {tag: runtime.tagModel}}},
        });
        renameTag("old-tag");
        const confirmButton = runtime.dialogElement?.querySelector<HTMLButtonElement>(".b3-button--text");
        if (!confirmButton) {
            throw new Error("Expected complete rename dialog fixture");
        }

        confirmButton.click();
        const callback = runtime.fetchPost.mock.calls[0]?.[2] as ((result: IWebSocketData) => void) | undefined;
        expect(callback).toBeTypeOf("function");
        callback?.(response({}));

        expect(runtime.tagModel.update).toHaveBeenCalledOnce();
        expect(runtime.getDockByType).not.toHaveBeenCalled();
    });

    it("destroys a malformed dialog and reports the violated template invariant", () => {
        runtime.completeTemplate = false;

        expect(() => renameTag("old-tag")).toThrowError(
            "[tag.actions] Rename dialog template is missing required controls",
        );
        expect(runtime.destroy).toHaveBeenCalledOnce();
        expect(runtime.fetchPost).not.toHaveBeenCalled();
    });
});
