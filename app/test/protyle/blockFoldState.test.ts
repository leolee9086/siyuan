import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    clearSelect: vi.fn(),
    focusBlock: vi.fn(),
    lineNumberRender: vi.fn(),
    preventScroll: vi.fn(),
    removeFoldHeading: vi.fn(),
    scrollCenter: vi.fn(),
}));

vi.mock("../../src/protyle/util/blockFold/state/imports", () => ({
    ...mocks,
    hasClosestBlock: vi.fn(),
}));

import {setFoldAndCollectOperations} from "../../src/protyle/util/blockFold/state";

describe("block fold state", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = "";
    });

    it("folds a block and returns reversible attributes without submitting", () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "block-id";
        block.dataset.type = "NodeParagraph";

        const result = setFoldAndCollectOperations({
            protyle: {} as IProtyle,
            nodeElement: block,
            addLoading: true,
        });

        expect(block.getAttribute("fold")).toBe("1");
        expect(result).toEqual({
            fold: 1,
            doOperations: [{action: "setAttrs", id: "block-id", data: JSON.stringify({fold: "1"})}],
            undoOperations: [{action: "setAttrs", id: "block-id", data: JSON.stringify({fold: ""})}],
        });
        expect(mocks.clearSelect).toHaveBeenCalledWith(["img", "av"], block);
        expect(mocks.scrollCenter).toHaveBeenCalledWith({}, block);
        expect(mocks.preventScroll).toHaveBeenCalledWith({});
    });

    it("leaves already open targets unchanged when opening was requested", () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "block-id";
        block.dataset.type = "NodeParagraph";

        expect(setFoldAndCollectOperations({
            protyle: {} as IProtyle,
            nodeElement: block,
            isOpen: true,
            addLoading: true,
        })).toEqual({fold: -1});
        expect(mocks.preventScroll).not.toHaveBeenCalled();
    });
});
