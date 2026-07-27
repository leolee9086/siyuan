import {beforeEach, describe, expect, it, vi} from "vitest";
import {createProtyleDomainFixture} from "../support/protyleDomain.fixture";

const runtime = vi.hoisted(() => ({
    highlightById: vi.fn(),
    isSupportCSSHL: vi.fn(),
    scrollToCurrent: vi.fn(),
}));

vi.mock("../../src/search/result/imports", () => ({
    highlightById: runtime.highlightById,
    isSupportCSSHL: runtime.isSupportCSSHL,
    scrollToCurrent: runtime.scrollToCurrent,
}));

import {renderNextSearchMark} from "../../src/search/result/renderNextSearchMark";

/** Minimal standards-compatible Highlight implementation for collection assertions. */
class TestHighlight extends Set<AbstractRange> implements Highlight {
    priority = 0;
    type: HighlightType = "highlight";

    override forEach(
        callbackfn: (value: AbstractRange, key: AbstractRange, parent: Highlight) => void,
        thisArg?: any,
    ) {
        super.forEach((value, key) => callbackfn.call(thisArg, value, key, this));
    }
}

/** Create a text range whose string value distinguishes it from a block-only match. */
const createTextRange = (text: string) => {
    const node = document.createTextNode(text);
    const range = document.createRange();
    range.selectNodeContents(node);
    return range;
};

describe("render next search mark", () => {
    beforeEach(() => vi.clearAllMocks());

    it("wraps CSS Highlight ranges and scrolls the new current text range", () => {
        runtime.isSupportCSSHL.mockReturnValue(true);
        const contentElement = document.createElement("div");
        const contentRect = {top: 10, height: 200} as DOMRect;
        vi.spyOn(contentElement, "getBoundingClientRect").mockReturnValue(contentRect);
        const first = createTextRange("first");
        const second = createTextRange("second");
        const mark = new TestHighlight();
        const markHL = new TestHighlight();
        mark.add(first);
        markHL.add(second);
        const edit = createProtyleDomainFixture({
            contentElement,
            highlight: {
                mark,
                markHL,
                rangeIndex: 1,
                ranges: [first, second],
                styleElement: document.createElement("style"),
            },
        });

        renderNextSearchMark({id: "block", edit, target: document.createElement("div")});

        expect(edit.protyle.highlight.rangeIndex).toBe(0);
        expect([...markHL]).toEqual([first]);
        expect([...mark]).toEqual([second]);
        expect(runtime.scrollToCurrent).toHaveBeenCalledWith(contentElement, first, contentRect);
        expect(runtime.highlightById).not.toHaveBeenCalled();
    });

    it("moves a legacy DOM focus to the next mark with the existing scroll formula", () => {
        runtime.isSupportCSSHL.mockReturnValue(false);
        const contentElement = document.createElement("div");
        contentElement.scrollTop = 20;
        vi.spyOn(contentElement, "getBoundingClientRect").mockReturnValue({top: 10, height: 100} as DOMRect);
        const wysiwygElement = document.createElement("div");
        wysiwygElement.innerHTML = '<span data-type="search-mark" class="search-mark--hl"></span><span data-type="search-mark"></span>';
        const [firstMark, secondMark] = Array.from(wysiwygElement.querySelectorAll<HTMLElement>("span"));
        if (!firstMark || !secondMark) {
            throw new Error("Legacy search mark fixture is incomplete");
        }
        vi.spyOn(secondMark, "getBoundingClientRect").mockReturnValue({top: 210} as DOMRect);
        const wysiwyg = {element: wysiwygElement} as NonNullable<IProtyle["wysiwyg"]>;
        const edit = createProtyleDomainFixture({contentElement, wysiwyg});

        renderNextSearchMark({id: "block", edit, target: firstMark});

        expect(firstMark.classList.contains("search-mark--hl")).toBe(false);
        expect(secondMark.classList.contains("search-mark--hl")).toBe(true);
        expect(contentElement.scrollTop).toBe(170);
    });
});
