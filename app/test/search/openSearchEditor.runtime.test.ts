import {beforeEach, describe, expect, it, vi} from "vitest";

const runtime = vi.hoisted(() => ({
    calls: [] as string[],
    checkFold: vi.fn(),
    getContenteditableElement: vi.fn(),
    getSelectionOffset: vi.fn(),
    getSiyuanStorage: vi.fn(),
    hasClosestBlock: vi.fn(),
}));

vi.mock("../../src/search/editor/imports", () => ({
    Constants: {
        CB_GET_ALL: "all",
        CB_GET_CONTEXT: "context",
        CB_GET_FOCUS: "focus",
        CB_GET_HL: "highlight",
        CB_GET_SCROLL: "scroll",
        CB_GET_SEARCH: "search",
        LOCAL_FILEPOSITION: "file-position",
    },
    checkFold: runtime.checkFold,
    getContenteditableElement: runtime.getContenteditableElement,
    getSelectionOffset: runtime.getSelectionOffset,
    getSiyuanStorage: runtime.getSiyuanStorage,
    hasClosestBlock: runtime.hasClosestBlock,
}));

import {openSearchEditor} from "../../src/search/editor/openSearchEditor";

/** Build the initialized Protyle fields consumed by search-result navigation. */
const createSearchProtyle = (openBlock: ReturnType<typeof vi.fn>, range?: Range) => Object.assign({} as IProtyle, {
    app: {openBlock},
    block: {id: "preview", rootID: "root", scroll: false, showAll: false},
    contentElement: Object.assign(document.createElement("div"), {scrollTop: 42}),
    highlight: {rangeIndex: 0, ranges: range ? [range] : []},
});

describe("open search editor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtime.calls.length = 0;
        runtime.checkFold.mockImplementation((_id: string, callback: (zoomIn: boolean) => void) => callback(false));
        runtime.getSiyuanStorage.mockReturnValue({"file-position": {}});
    });

    it("opens an unmatched result with highlight actions before invoking the callback", () => {
        const openBlock = vi.fn(() => runtime.calls.push("openBlock"));
        const options = {
            protyle: createSearchProtyle(openBlock),
            id: "target",
            rootId: "other-root",
            openPosition: "right" as const,
            cb: () => runtime.calls.push("callback"),
        };

        openSearchEditor(options);

        expect(runtime.checkFold).toHaveBeenCalledWith("target", expect.any(Function));
        expect(openBlock).toHaveBeenCalledWith({
            id: "target",
            action: ["focus", "context", "highlight"],
            zoomIn: false,
            position: "right",
            scrollPosition: "center",
        });
        expect(runtime.calls).toEqual(["openBlock", "callback"]);
    });

    it("preserves a matched range, rewrites the operation id, and restores search actions", () => {
        const text = document.createTextNode("matched text");
        const block = document.createElement("div");
        block.dataset.nodeId = "matched-block";
        block.append(text);
        const range = document.createRange();
        range.setStart(text, 1);
        range.setEnd(text, 4);
        const storage = {"file-position": {} as Record<string, IScrollAttr>};
        const openBlock = vi.fn();
        const options = {protyle: createSearchProtyle(openBlock, range), id: "preview", rootId: "root"};
        runtime.hasClosestBlock.mockReturnValue(block);
        runtime.getContenteditableElement.mockReturnValue(block);
        runtime.getSelectionOffset.mockReturnValue({start: 1, end: 4});
        runtime.getSiyuanStorage.mockReturnValue(storage);
        runtime.checkFold.mockImplementation((_id: string, callback: (zoomIn: boolean) => void) => callback(true));

        openSearchEditor(options);

        expect(options.id).toBe("matched-block");
        expect(storage["file-position"].root).toEqual({
            rootId: "root",
            focusId: "matched-block",
            focusStart: 1,
            focusEnd: 4,
            zoomInId: undefined,
            scrollTop: 42,
        });
        expect(openBlock).toHaveBeenCalledWith(expect.objectContaining({
            id: "matched-block",
            action: ["focus", "all", "scroll", "search"],
            zoomIn: true,
        }));
    });

    it("reports a malformed matched block instead of navigating with an invalid id", () => {
        const text = document.createTextNode("matched text");
        const range = document.createRange();
        range.selectNodeContents(text);
        const openBlock = vi.fn();
        const protyle = createSearchProtyle(openBlock, range);
        runtime.hasClosestBlock.mockReturnValue(document.createElement("div"));

        expect(() => openSearchEditor({protyle, id: "preview", rootId: "root"})).toThrow(
            "Search range block is missing data-node-id",
        );
        expect(openBlock).not.toHaveBeenCalled();
    });
});
