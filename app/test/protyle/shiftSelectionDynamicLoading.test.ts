import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const state = vi.hoisted(() => ({
    showMessage: vi.fn(),
    countBlockWord: vi.fn(),
    focusBlock: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/imports", () => ({
    hasClosestBlock: (node: Node) => {
        const element = node instanceof Element ? node : node.parentElement;
        return element?.closest("[data-node-id]") || false;
    },
    hasClosestByClassName: (element: Element, className: string) => element.closest(`.${className}`),
    focusBlock: state.focusBlock,
    countBlockWord: state.countBlockWord,
    showMessage: state.showMessage,
    siyuanI18n: {crossKeepLazyLoad: "Cross-document selection requires loaded content"},
    updateHeader: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/index.mousedown.select.gallery", () => ({
    setGalleryItemSelected: vi.fn(),
}));

const {handleShiftSelect} = await import("../../src/protyle/wysiwyg/index.mousedown.select.shift");

const setRect = (element: HTMLElement, top: number) => {
    element.getBoundingClientRect = () => ({
        top,
        bottom: top + 20,
        left: 0,
        right: 100,
        width: 100,
        height: 20,
        x: 0,
        y: top,
        toJSON: () => ({}),
    }) as DOMRect;
};

const selectBlock = (element: HTMLElement) => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
};

const makeProtyle = (keepLoadedContent: boolean) => {
    const wysiwyg = document.createElement("div");
    const contentElement = document.createElement("div");
    Object.defineProperty(contentElement, "clientHeight", {configurable: true, value: 100});
    const scrollElement = document.createElement("div");
    const first = document.createElement("div");
    first.dataset.nodeId = "first";
    const second = document.createElement("div");
    second.dataset.nodeId = "second";
    setRect(first, -250);
    setRect(second, 0);
    wysiwyg.append(first, second);
    document.body.append(wysiwyg);

    return {
        protyle: {
            block: {rootID: "document"},
            contentElement,
            options: {status: {}},
            scroll: {element: scrollElement, keepLoadedContent},
            wysiwyg: {element: wysiwyg},
        } as unknown as IProtyle,
        first,
        second,
        wysiwyg,
    };
};

describe("shift selection with dynamically loaded content", () => {
    beforeEach(() => {
        state.showMessage.mockReset();
        state.countBlockWord.mockReset();
        state.focusBlock.mockReset();
    });

    afterEach(() => {
        document.body.replaceChildren();
        window.getSelection()?.removeAllRanges();
    });

    it("does not warn when the editor keeps loaded content", () => {
        const {protyle, first, second} = makeProtyle(true);
        selectBlock(first);

        const handled = handleShiftSelect(protyle, {
            event: new MouseEvent("mousedown", {shiftKey: true}),
            nodeElement: second,
            hasSelectClassElement: null,
            galleryItemElement: false,
        });

        expect(handled).toBe(true);
        expect(state.showMessage).not.toHaveBeenCalled();
        expect(second.classList.contains("protyle-wysiwyg--select")).toBe(true);
    });

    it("warns when the editor does not keep loaded content", () => {
        const {protyle, first, second} = makeProtyle(false);
        selectBlock(first);

        handleShiftSelect(protyle, {
            event: new MouseEvent("mousedown", {shiftKey: true}),
            nodeElement: second,
            hasSelectClassElement: null,
            galleryItemElement: false,
        });

        expect(state.showMessage).toHaveBeenCalledWith("Cross-document selection requires loaded content");
    });
});
