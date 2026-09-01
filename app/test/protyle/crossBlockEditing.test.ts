import {afterEach, describe, expect, it, vi} from "vitest";

vi.mock("../../src/util/checkBlockRef", () => ({
    confirmBlockRef: vi.fn(),
    confirmBlockRefForBlocks: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/submit", () => ({
    transaction: vi.fn(),
}));

vi.mock("../../src/protyle/render/highlightRender", () => ({
    highlightRender: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/index.copy.helpers", async (importOriginal) => ({
    ...await importOriginal<typeof import("../../src/protyle/wysiwyg/index.copy.helpers")>(),
    writeClipboardData: vi.fn(),
}));

import {confirmBlockRef} from "../../src/util/checkBlockRef";
import {highlightRender} from "../../src/protyle/render/highlightRender";
import {transaction} from "../../src/protyle/wysiwyg/transaction/submit";

import {
    focusByOffset,
    getBlockRanges,
    getUndoFocusContext,
    restoreUndoFocus,
} from "../../src/protyle/util/selection";
import {
    getCrossBlockMergeRemoveElement,
    isEntireBlockContentSelected,
} from "../../src/protyle/wysiwyg/removeRange";
import {
    getImageBlockRefCheckTargets,
    getRangeBlockRefCheckTargets,
    removeCrossBlockRange,
} from "../../src/protyle/wysiwyg/remove";
import {
    getCrossBlockPlainText,
    handleCopy,
    normalizeCrossBlockCopy,
} from "../../src/protyle/wysiwyg/index.copy";
import {writeClipboardData} from "../../src/protyle/wysiwyg/index.copy.helpers";

afterEach(() => {
    vi.clearAllMocks();
});

const block = (id: string, type: string, text?: string) => {
    const element = document.createElement("div");
    element.dataset.nodeId = id;
    element.dataset.type = type;
    if (text !== undefined) {
        const editable = document.createElement("div");
        editable.textContent = text;
        element.append(editable);
    }
    return element;
};

const attr = () => {
    const element = document.createElement("div");
    element.className = "protyle-attr";
    return element;
};

describe("cross-block range projection", () => {
    it("projects one browser selection into ordered editable block ranges", () => {
        const editor = document.createElement("div");
        const first = block("first", "NodeParagraph", "alpha");
        const second = block("second", "NodeParagraph", "bravo");
        editor.append(first, second);

        const range = document.createRange();
        range.setStart(first.firstChild!.firstChild!, 2);
        range.setEnd(second.firstChild!.firstChild!, 3);

        const ranges = getBlockRanges(editor, range);

        expect(ranges).toHaveLength(2);
        expect(ranges.map((item) => item.blockElement)).toEqual([first, second]);
        expect(ranges.map((item) => [item.start, item.end])).toEqual([[2, 5], [0, 3]]);
        expect(ranges.map((item) => item.range.toString())).toEqual(["pha", "bra"]);
    });

    it("does not project editable mirrors inside query embeds", () => {
        const editor = document.createElement("div");
        const first = block("first", "NodeParagraph", "alpha");
        const embed = block("embed", "NodeBlockQueryEmbed");
        embed.classList.add("protyle-wysiwyg__embed");
        embed.append(block("mirror", "NodeParagraph", "mirror"));
        const second = block("second", "NodeParagraph", "bravo");
        editor.append(first, embed, second);

        const range = document.createRange();
        range.setStart(first.firstChild!.firstChild!, 1);
        range.setEnd(second.firstChild!.firstChild!, 2);

        expect(getBlockRanges(editor, range).map((item) => item.blockElement)).toEqual([first, second]);
    });
});

describe("cross-block selection restoration", () => {
    it("maps visible offsets without counting zero-width spaces", () => {
        const editable = document.createElement("div");
        editable.textContent = "a\u200bb";

        const range = focusByOffset(editable, 1, 2, false, true);

        expect(range).not.toBe(false);
        expect((range as Range).toString()).toBe("b");
        expect((range as Range).startOffset).toBe(2);
        expect((range as Range).endOffset).toBe(3);
    });

    it("captures and restores both endpoints of a cross-block selection", () => {
        const editor = document.createElement("div");
        const first = block("first", "NodeParagraph", "alpha");
        const second = block("second", "NodeParagraph", "bravo");
        editor.append(first, second);
        document.body.append(editor);

        const range = document.createRange();
        range.setStart(first.firstChild!.firstChild!, 2);
        range.setEnd(second.firstChild!.firstChild!, 3);
        const context = getUndoFocusContext(editor, range, true);

        expect(context).toMatchObject({
            undoFocusId: "first",
            undoFocusEndId: "second",
            undoFocusStart: "2",
            undoFocusEnd: "3",
            undoFocusIgnoreZWSP: "true",
        });
        expect(restoreUndoFocus({wysiwyg: {element: editor}} as IProtyle, [{
            action: "update",
            id: "first",
            data: first.outerHTML,
            context,
        }])).toBe(true);
        expect(getSelection().getRangeAt(0).toString()).toBe("phabra");

        editor.remove();
    });
});

describe("cross-block merge removal", () => {
    it("requires complete editable content before treating a block as removed", () => {
        const range = (startComparison: number, endComparison: number) => ({
            compareBoundaryPoints(type: number) {
                return type === 0 ? startComparison : endComparison;
            },
        }) as unknown as Range;
        const contentRange = {} as Range;

        expect(isEntireBlockContentSelected(range(0, 0), contentRange)).toBe(true);
        expect(isEntireBlockContentSelected(range(-1, 1), contentRange)).toBe(true);
        expect(isEntireBlockContentSelected(range(1, 0), contentRange)).toBe(false);
        expect(isEntireBlockContentSelected(range(0, -1), contentRange)).toBe(false);
    });

    it("removes the nested branch below the retained start block", () => {
        const start = block("start", "NodeParagraph", "start");
        const second = block("second", "NodeParagraph", "second");
        const third = block("third", "NodeParagraph", "third");
        const end = block("end", "NodeParagraph", "end");
        const fourthItem = block("fourthItem", "NodeListItem");
        fourthItem.append(end, attr());
        const fourthList = block("fourthList", "NodeList");
        fourthList.append(fourthItem, attr());
        const thirdItem = block("thirdItem", "NodeListItem");
        thirdItem.append(third, fourthList, attr());
        const thirdList = block("thirdList", "NodeList");
        thirdList.append(thirdItem, attr());
        const secondItem = block("secondItem", "NodeListItem");
        secondItem.append(second, thirdList, attr());
        const secondList = block("secondList", "NodeList");
        secondList.append(secondItem, attr());
        const firstItem = block("firstItem", "NodeListItem");
        firstItem.append(start, secondList, attr());
        const firstList = block("firstList", "NodeList");
        firstList.append(firstItem, attr());
        const editor = document.createElement("div");
        editor.append(firstList);

        expect(getCrossBlockMergeRemoveElement(editor, start, end)).toBe(secondList);
    });

    it("preserves an unselected child list after the end block", () => {
        const start = block("start", "NodeParagraph", "start");
        const end = block("end", "NodeParagraph", "end");
        const childItem = block("childItem", "NodeListItem");
        childItem.append(block("child", "NodeParagraph", "child"), attr());
        const childList = block("childList", "NodeList");
        childList.append(childItem, attr());
        const endItem = block("endItem", "NodeListItem");
        endItem.append(end, childList, attr());
        const list = block("list", "NodeList");
        list.append(endItem, attr());
        const editor = document.createElement("div");
        editor.append(start, list);

        expect(getCrossBlockMergeRemoveElement(editor, start, end)).toBeUndefined();
    });
});

describe("referenced-block deletion targets", () => {
    it("marks wholly selected editable blocks as exact definitions", () => {
        const editor = document.createElement("div");
        const first = block("first", "NodeParagraph", "alpha");
        const second = block("second", "NodeParagraph", "bravo");
        editor.append(first, second);
        document.body.append(editor);

        const range = document.createRange();
        range.setStart(first.firstChild!.firstChild!, 0);
        range.setEnd(second.firstChild!.firstChild!, 5);

        const targets = getRangeBlockRefCheckTargets(editor, range, first, second);

        expect(targets.elements.map((item) => item.dataset.nodeId)).toEqual(["first", "second"]);
        expect(targets.exactIDs).toEqual(["first", "second"]);
        editor.remove();
    });

    it("checks the owning block when deleting its final image", () => {
        const editor = document.createElement("div");
        const paragraph = block("paragraph", "NodeParagraph", "");
        const image = document.createElement("span");
        image.className = "img";
        paragraph.firstElementChild!.append(image);
        editor.append(paragraph);
        document.body.append(editor);

        const targets = getImageBlockRefCheckTargets(paragraph, image);

        expect(targets.elements.map((item) => item.dataset.nodeId)).toEqual(["paragraph"]);
        expect(targets.exactIDs).toEqual(["paragraph"]);
        editor.remove();
    });
});

describe("cross-block removal transaction", () => {
    it("leaves the editor unchanged when the reference confirmation is declined", async () => {
        const editor = document.createElement("div");
        const first = block("first", "NodeParagraph", "alpha");
        const second = block("second", "NodeParagraph", "bravo");
        editor.append(first, second);
        document.body.append(editor);

        const range = document.createRange();
        range.setStart(first.firstChild!.firstChild!, 0);
        range.setEnd(second.firstChild!.firstChild!, 5);
        vi.mocked(confirmBlockRef).mockResolvedValue(false);

        await removeCrossBlockRange({
            block: {parentID: "document"},
            wysiwyg: {element: editor},
        } as IProtyle, range, first, second);

        expect(confirmBlockRef).toHaveBeenCalledOnce();
        expect(editor.textContent).toBe("alphabravo");
        expect(editor.children).toHaveLength(2);
        editor.remove();
    });

    it("does not ask for the same reference confirmation after cut already approved it", async () => {
        const editor = document.createElement("div");
        const first = block("first", "NodeParagraph", "alpha");
        const second = block("second", "NodeParagraph", "bravo");
        editor.append(first, second);
        document.body.append(editor);

        const range = document.createRange();
        range.setStart(first.firstChild!.firstChild!, 0);
        range.setEnd(second.firstChild!.firstChild!, 5);

        await removeCrossBlockRange({
            block: {parentID: "document"},
            wysiwyg: {element: editor},
            lute: {SpinBlockDOM: (html: string) => html},
        } as IProtyle, range, first, second, true);

        expect(confirmBlockRef).not.toHaveBeenCalled();
        editor.remove();
    });

    it("commits one cross-block deletion, removes empty boundary spans, and restores the start focus", async () => {
        const editor = document.createElement("div");
        const first = block("first", "NodeParagraph");
        first.innerHTML = `<div contenteditable="true">al<span>pha</span></div>`;
        const second = block("second", "NodeParagraph");
        second.innerHTML = `<div contenteditable="true"><span>bra</span>vo</div>`;
        editor.append(first, second);
        document.body.append(editor);

        const range = document.createRange();
        range.setStart(first.querySelector("span")!.firstChild!, 0);
        range.setEnd(second.querySelector("span")!.firstChild!, 3);

        await removeCrossBlockRange({
            block: {parentID: "document"},
            wysiwyg: {element: editor},
            lute: {SpinBlockDOM: (html: string) => html},
        } as IProtyle, range, first, second, true);

        expect(first.textContent).toBe("alvo");
        expect(first.querySelector("span")).toBeNull();
        expect(second.isConnected).toBe(false);
        expect(vi.mocked(transaction)).toHaveBeenCalledOnce();
        expect(vi.mocked(transaction).mock.calls[0][1].map(operation => operation.action)).toEqual([
            "delete",
            "update",
        ]);
        expect(getSelection().getRangeAt(0).startOffset).toBe(2);
        editor.remove();
    });

    it("invalidates and rerenders every code block changed by a cross-block range", async () => {
        const editor = document.createElement("div");
        const first = block("first", "NodeCodeBlock");
        first.classList.add("code-block");
        first.innerHTML = `<div class="hljs" data-render="true"><span>alpha</span></div>`;
        const second = block("second", "NodeCodeBlock");
        second.classList.add("code-block");
        second.innerHTML = `<div class="hljs" data-render="true"><span>bravo</span></div>`;
        editor.append(first, second);
        document.body.append(editor);

        const range = document.createRange();
        range.setStart(first.querySelector(".hljs span")!.firstChild!, 2);
        range.setEnd(second.querySelector(".hljs span")!.firstChild!, 3);

        await removeCrossBlockRange({
            block: {parentID: "document"},
            wysiwyg: {element: editor},
            lute: {SpinBlockDOM: (html: string) => html},
        } as IProtyle, range, first, second, true);

        expect(first.querySelector(".hljs")?.hasAttribute("data-render")).toBe(false);
        expect(second.querySelector(".hljs")?.hasAttribute("data-render")).toBe(false);
        expect(vi.mocked(highlightRender)).toHaveBeenCalledTimes(2);
        expect(vi.mocked(highlightRender)).toHaveBeenCalledWith(first);
        expect(vi.mocked(highlightRender)).toHaveBeenCalledWith(second);
        editor.remove();
    });
});

describe("cross-block copy normalization", () => {
    it("removes virtual references and restores block chrome from the selected source", () => {
        const editor = document.createElement("div");
        const first = block("first", "NodeParagraph");
        first.innerHTML = `<div class="protyle-action">1.</div><div contenteditable="true" spellcheck="false"><span data-type="virtual-block-ref">alpha</span></div><div class="callout-info">note</div><div class="protyle-attr">attr</div>`;
        const second = block("second", "NodeParagraph", "bravo");
        editor.append(first, second);
        document.body.append(editor);

        const range = document.createRange();
        range.setStart(first.querySelector("[contenteditable]")!.firstChild!, 0);
        range.setEnd(second.firstChild!.firstChild!, 5);
        const copied = document.createElement("div");
        copied.innerHTML = `<div data-node-id="first" data-type="NodeParagraph"><div contenteditable="true"><span data-type="virtual-block-ref">alpha</span></div></div><div data-node-id="second" data-type="NodeParagraph"><div contenteditable="true">bravo</div></div>`;

        normalizeCrossBlockCopy(editor, copied, range);

        const firstCopy = copied.querySelector<HTMLElement>("[data-node-id='first']")!;
        expect(firstCopy.querySelector("[data-type~='virtual-block-ref']")).toBeNull();
        expect(firstCopy.querySelector(".protyle-action")?.textContent).toBe("1.");
        expect(firstCopy.querySelector(".callout-info")?.textContent).toBe("note");
        expect(firstCopy.querySelector(":scope > .protyle-attr")?.textContent).toBe("attr");
        editor.remove();
    });

    it("flattens copied nested list roots and standardizes their subtype", () => {
        const editor = document.createElement("div");
        const copied = document.createElement("div");
        copied.innerHTML = `<div data-node-id="outer" data-type="NodeListItem" data-subtype="u"><div data-node-id="nested" data-type="NodeList"><div data-node-id="first-item" data-type="NodeListItem" data-subtype="u"><div class="protyle-action"></div></div><div data-node-id="second-item" data-type="NodeListItem" data-subtype="o"><div class="protyle-action protyle-action--order">1.</div></div></div></div>`;
        const range = document.createRange();
        range.selectNodeContents(copied);

        normalizeCrossBlockCopy(editor, copied, range);

        const items = Array.from(copied.children) as HTMLElement[];
        expect(items.map((item) => item.dataset.nodeId)).toEqual(["first-item", "second-item"]);
        expect(items.map((item) => item.dataset.subtype)).toEqual(["u", "u"]);
        expect(items[1].querySelector(".protyle-action")?.className).toBe("protyle-action");
    });

    it("creates plain text one block per line after normalization", () => {
        const copied = document.createElement("div");
        copied.innerHTML = `<div data-node-id="first" data-type="NodeParagraph"><div spellcheck="false">alpha</div></div><div data-node-id="second" data-type="NodeParagraph"><div spellcheck="false">bravo</div></div>`;

        expect(getCrossBlockPlainText(copied)).toBe("alpha\nbravo");
    });

    it("writes normalized HTML and block-separated plain text through the copy event", async () => {
        const previousSiyuan = window.siyuan;
        window.siyuan = {
            ...previousSiyuan,
            ctrlIsPressed: false,
        };
        const editor = document.createElement("div");
        const first = block("first", "NodeParagraph");
        first.innerHTML = `<div class="protyle-action">1.</div><div contenteditable="true" spellcheck="false"><span data-type="virtual-block-ref">alpha</span></div><div class="protyle-attr">attr</div>`;
        const second = block("second", "NodeParagraph", "bravo");
        second.firstElementChild!.setAttribute("spellcheck", "false");
        editor.append(first, second);
        document.body.append(editor);
        const range = document.createRange();
        range.setStart(first.querySelector("[contenteditable]")!.firstChild!, 0);
        range.setEnd(second.firstChild!.firstChild!, 5);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        const event = {
            target: first.querySelector("[contenteditable]")!,
            clipboardData: {setData: vi.fn()},
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        };
        const protyle = {
            disabled: false,
            toolbar: {getCurrentType: () => []},
            wysiwyg: {element: editor},
        } as IProtyle;

        await handleCopy(protyle, event);

        const call = vi.mocked(writeClipboardData).mock.calls.at(-1)!;
        expect(call[2]).not.toContain("virtual-block-ref");
        expect(call[2]).toContain("protyle-action");
        expect(call[3]).toBe("alpha\nbravo");
        window.siyuan = previousSiyuan;
        editor.remove();
    });
});
