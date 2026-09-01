import {describe, expect, it} from "vitest";

import {handleMove} from "../../src/protyle/wysiwyg/transaction.onTransaction.move";

/** 构造带原始 HTML 属性值的移动源块，覆盖撤销/重做复用的克隆分支。 */
const createHTMLBlock = () => {
    const element = document.createElement("div");
    element.setAttribute("data-node-id", "html-source");
    element.setAttribute("data-type", "NodeHTMLBlock");
    const htmlElement = document.createElement("protyle-html");
    htmlElement.setAttribute("data-content", "<span data-value=\"&amp;\">html</span>");
    element.appendChild(htmlElement);
    return element;
};

describe("HTML block transaction clone", () => {
    it("keeps raw data-content when moving a cloned HTML block", () => {
        const editorElement = document.createElement("div");
        const anchorElement = document.createElement("div");
        anchorElement.setAttribute("data-node-id", "anchor");
        const sourceElement = createHTMLBlock();
        editorElement.append(anchorElement, sourceElement);
        const protyle = {
            block: {parentID: "document", showAll: false},
            options: {backlinkData: false},
            wysiwyg: {element: editorElement},
        } as IProtyle;
        const operation = {
            action: "move",
            id: "html-source",
            previousID: "anchor",
        } as IOperation;

        handleMove(operation, protyle, [sourceElement], false);

        const copiedHTML = editorElement.querySelector("protyle-html");
        expect(copiedHTML?.getAttribute("data-content")).toBe("<span data-value=\"&amp;\">html</span>");
    });
});
