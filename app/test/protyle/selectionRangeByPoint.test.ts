import {afterEach, describe, expect, it} from "vitest";

import {getRangeByPoint} from "../../src/protyle/util/selection";

let originalCaretRangeFromPoint = document.caretRangeFromPoint;

/** 构造含列表标记和可编辑正文的最小列表项。 */
const createListItem = () => {
    const listItem = document.createElement("div");
    listItem.setAttribute("data-node-id", "list-item");
    listItem.setAttribute("data-type", "NodeListItem");
    const actionElement = document.createElement("div");
    actionElement.className = "protyle-action protyle-action--order";
    actionElement.textContent = "1.";
    const paragraphElement = document.createElement("div");
    paragraphElement.setAttribute("data-node-id", "paragraph");
    paragraphElement.setAttribute("data-type", "NodeParagraph");
    const editableElement = document.createElement("div");
    editableElement.setAttribute("contenteditable", "true");
    editableElement.textContent = "content";
    paragraphElement.append(editableElement);
    listItem.append(actionElement, paragraphElement);
    return {actionElement, editableElement, listItem};
};

afterEach(() => {
    Object.defineProperty(document, "caretRangeFromPoint", {
        configurable: true,
        value: originalCaretRangeFromPoint,
    });
});

describe("getRangeByPoint", () => {
    it("moves a drop targeting a list marker into its editable content", () => {
        const {actionElement, editableElement} = createListItem();
        const markerRange = document.createRange();
        markerRange.selectNodeContents(actionElement);
        markerRange.collapse(true);
        Object.defineProperty(document, "caretRangeFromPoint", {
            configurable: true,
            value: () => markerRange,
        });

        const range = getRangeByPoint(10, 10);

        expect(range.startContainer).toBe(editableElement);
        expect(range.startOffset).toBe(0);
        expect(range.collapsed).toBe(true);
    });
});
