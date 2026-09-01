import {beforeEach, describe, expect, it, vi} from "vitest";
import {Constants} from "../../src/constants";

const runtime = vi.hoisted(() => ({
    focusByWbr: vi.fn<(element: Element | null, range: Range) => void>(),
    genEmptyBlock: vi.fn(() => '<div data-node-id="empty-block"><wbr></div>'),
    isIncludesHotKey: vi.fn<(hotkey: string) => boolean>(),
    matchHotKey: vi.fn<(hotkey: string, event: KeyboardEvent) => boolean>(),
    newNodeId: vi.fn<() => string>(),
    scrollCenter: vi.fn(),
    setFold: vi.fn(),
    transaction: vi.fn<(protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => void>(),
    updateTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/util/selection", () => ({
    focusByWbr: runtime.focusByWbr,
}));
vi.mock("../../src/protyle/wysiwyg/transaction/submit", () => ({
    transaction: runtime.transaction,
}));
vi.mock("../../src/protyle/wysiwyg/transaction/update", () => ({
    updateTransaction: runtime.updateTransaction,
}));
vi.mock("../../src/block/element.factory", () => ({
    genEmptyBlock: runtime.genEmptyBlock,
}));
vi.mock("../../src/protyle/util/blockFold", () => ({
    setFold: runtime.setFold,
}));
vi.mock("../../src/util/DOM/highlightById", () => ({
    scrollCenter: runtime.scrollCenter,
}));
vi.mock("../../src/protyle/util/hotKey", () => ({
    isIncludesHotKey: runtime.isIncludesHotKey,
    matchHotKey: runtime.matchHotKey,
}));
vi.mock("../../src/protyle/wysiwyg/callout", () => ({
    updateCalloutType: vi.fn(),
}));

import {
    addSubList,
    breakList,
    genListItemElement,
    listIndent,
    listOutdent,
    toggleTaskListItem,
} from "../../src/protyle/wysiwyg/list";
import {altEnterMiddleware} from "../../src/protyle/wysiwyg/keydown.altEnter";

const createProtyle = (wysiwygElement = document.createElement("div")) => Object.assign(Object.create(null), {
    block: {
        id: "document-id",
        parentID: "parent-id",
        rootID: "root-id",
    },
    wysiwyg: {
        element: wysiwygElement,
    },
}) as IProtyle;

const createRangeAtEnd = (element: Element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    return range;
};

const emptyParagraphHTML = (id: string) => `<div data-node-id="${id}" data-type="NodeParagraph" class="p">
    <div contenteditable="true" spellcheck="false"></div>
    <div contenteditable="false" class="protyle-attr">${Constants.ZWSP}</div>
</div>`;

const requireElement = <T extends Element>(element: T | null, fixtureName: string): T => {
    if (!element) {
        throw new Error(`${fixtureName} was not created`);
    }
    return element;
};

const getTransactionOperations = (callIndex = 0) => {
    const call = runtime.transaction.mock.calls[callIndex];
    if (!call) {
        throw new Error(`transaction call ${callIndex} was not recorded`);
    }
    return {
        doOperations: call[1],
        undoOperations: call[2],
    };
};

const expectNonEmptyOperationIds = (operations: IOperation[]) => {
    for (const operation of operations) {
        expect(operation.id, `${operation.action} operation id`).toEqual(expect.any(String));
        expect(operation.id, `${operation.action} operation id`).not.toBe("");
        if (operation.previousID !== undefined && operation.previousID !== null) {
            expect(operation.previousID, `${operation.action} operation previousID`).not.toBe("");
        }
        if (operation.parentID !== undefined && operation.parentID !== null) {
            expect(operation.parentID, `${operation.action} operation parentID`).not.toBe("");
        }
    }
};

const operationOrder = (operations: IOperation[]) => operations.map(operation =>
    `${operation.action}:${operation.id}`
);

const expectSymmetricOperationIds = (doOperations: IOperation[], undoOperations: IOperation[]) => {
    expect(doOperations.map(operation => operation.id).sort()).toEqual(
        undoOperations.map(operation => operation.id).sort(),
    );
};

beforeEach(() => {
    vi.clearAllMocks();
    let sequence = 0;
    runtime.newNodeId.mockImplementation(() => `node-${++sequence}`);
    Object.defineProperty(globalThis, "Lute", {
        configurable: true,
        value: {NewNodeID: runtime.newNodeId},
    });
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {
            config: {
                editor: {
                    listLogicalOutdent: true,
                },
            },
        },
    });
});

describe("list item actions", () => {
    it("toggles task state and submits the original HTML as the undo snapshot", () => {
        const protyle = createProtyle();
        const item = document.createElement("div");
        item.dataset.task = " ";
        item.innerHTML = '<svg><use xlink:href="#iconUncheck"></use></svg>';
        const originalHTML = item.outerHTML;

        toggleTaskListItem(protyle, item);

        expect(item.dataset.task).toBe("X");
        expect(item.classList.contains("protyle-task--done")).toBe(true);
        expect(item.querySelector("use")?.getAttribute("xlink:href")).toBe("#iconCheck");
        expect(item.getAttribute(Constants.ATTRIBUTE_EDITING)).toBe("true");
        expect(runtime.updateTransaction).toHaveBeenCalledWith(protyle, item, originalHTML);

        toggleTaskListItem(protyle, item);
        expect(item.dataset.task).toBe(" ");
        expect(item.classList.contains("protyle-task--done")).toBe(false);
        expect(item.querySelector("use")?.getAttribute("xlink:href")).toBe("#iconUncheck");
    });

    it("generates ordered, task, and unordered items with stable subtype markers", () => {
        const orderedSource = document.createElement("div");
        orderedSource.dataset.subtype = "o";
        orderedSource.dataset.marker = "2.";
        const ordered = genListItemElement(orderedSource);

        const taskSource = document.createElement("div");
        taskSource.dataset.subtype = "t";
        const task = genListItemElement(taskSource, 0, true);

        const unorderedSource = document.createElement("div");
        unorderedSource.dataset.subtype = "u";
        const unordered = genListItemElement(unorderedSource, 0, false);

        expect(ordered.dataset.marker).toBe("3.");
        expect(ordered.dataset.subtype).toBe("o");
        expect(ordered.querySelector(".protyle-action")?.textContent).toBe("3.");
        expect(task.dataset.task).toBe(" ");
        expect(task.querySelector("use")?.getAttribute("xlink:href")).toBe("#iconUncheck");
        expect(unordered.dataset.marker).toBe("*");
        expect(unordered.querySelector("use")?.getAttribute("xlink:href")).toBe("#iconDot");
        expect(runtime.genEmptyBlock).toHaveBeenNthCalledWith(1, false, false);
        expect(runtime.genEmptyBlock).toHaveBeenNthCalledWith(2, false, true);
        expect(runtime.genEmptyBlock).toHaveBeenNthCalledWith(3, false, false);
    });

    it("creates a missing child list and records matching insert and delete operations", () => {
        const protyle = createProtyle();
        const range = document.createRange();
        const parentItem = document.createElement("div");
        parentItem.className = "li";
        parentItem.dataset.nodeId = "parent-item";
        parentItem.dataset.subtype = "u";
        parentItem.setAttribute("fold", "1");
        parentItem.innerHTML = `<div class="protyle-action"></div>
            <div data-node-id="paragraph-id" data-type="NodeParagraph"></div>
            <div class="protyle-attr"></div>`;
        const paragraph = parentItem.querySelector("[data-node-id='paragraph-id']");
        if (!paragraph) {
            throw new Error("paragraph fixture was not created");
        }

        expect(addSubList(protyle, paragraph, range)).toBe(true);

        const childList = parentItem.querySelector<HTMLElement>(".list");
        expect(childList?.dataset.nodeId).toBe("node-1");
        expect(childList?.dataset.subtype).toBe("u");
        expect(childList?.querySelector<HTMLElement>(".li")?.dataset.nodeId).toBe("node-2");
        expect(runtime.setFold).toHaveBeenCalledWith(protyle, parentItem, true, false, false, false, false);
        expect(runtime.transaction).toHaveBeenCalledWith(protyle, [{
            action: "insert",
            id: "node-1",
            data: childList?.outerHTML,
            previousID: "paragraph-id",
        }], [{
            action: "delete",
            id: "node-1",
        }]);
        expect(runtime.focusByWbr).toHaveBeenCalledWith(childList, range);
        expect(runtime.scrollCenter).toHaveBeenCalledWith(protyle, childList);
    });

    it("appends an item to an existing child list with matching insert and delete operations", () => {
        const protyle = createProtyle();
        const range = document.createRange();
        const parentItem = document.createElement("div");
        parentItem.className = "li";
        parentItem.dataset.nodeId = "parent-item";
        parentItem.dataset.subtype = "u";
        parentItem.setAttribute("fold", "1");
        parentItem.innerHTML = `<div class="protyle-action"></div>
            <div data-node-id="paragraph-id" data-type="NodeParagraph"></div>
            <div class="list" data-node-id="child-list" data-type="NodeList" data-subtype="u" fold="1">
                <div class="li" data-node-id="existing-child" data-type="NodeListItem" data-subtype="u">
                    <div class="protyle-action"></div>
                    <div data-node-id="child-paragraph" data-type="NodeParagraph"></div>
                    <div class="protyle-attr"></div>
                </div>
                <div class="protyle-attr"></div>
            </div>
            <div class="protyle-attr"></div>`;
        const paragraph = requireElement(
            parentItem.querySelector("[data-node-id='paragraph-id']"),
            "existing child-list paragraph fixture",
        );
        const childList = requireElement(
            parentItem.querySelector<HTMLElement>("[data-node-id='child-list']"),
            "existing child-list fixture",
        );

        expect(addSubList(protyle, paragraph, range)).toBe(true);

        const appendedItem = requireElement(
            childList.querySelector<HTMLElement>("[data-node-id='node-1']"),
            "appended child-list item",
        );
        expect(appendedItem.previousElementSibling?.getAttribute("data-node-id")).toBe("existing-child");
        expect(runtime.setFold).toHaveBeenNthCalledWith(1, protyle, childList, true, false, false, false, false);
        expect(runtime.setFold).toHaveBeenNthCalledWith(2, protyle, parentItem, true, false, false, false, false);
        expect(runtime.transaction).toHaveBeenCalledWith(protyle, [{
            action: "insert",
            id: "node-1",
            data: appendedItem.outerHTML,
            previousID: "existing-child",
        }], [{
            action: "delete",
            id: "node-1",
        }]);
        expect(runtime.focusByWbr).toHaveBeenCalledWith(appendedItem, range);
        expect(runtime.scrollCenter).toHaveBeenCalledWith(protyle, appendedItem);
    });

    it("does not create a child list outside a list item", () => {
        const protyle = createProtyle();
        const paragraph = document.createElement("div");
        paragraph.dataset.nodeId = "standalone-paragraph";

        expect(addSubList(protyle, paragraph, document.createRange())).toBe(false);
        expect(runtime.newNodeId).not.toHaveBeenCalled();
        expect(runtime.transaction).not.toHaveBeenCalled();
        expect(runtime.focusByWbr).not.toHaveBeenCalled();
        expect(runtime.scrollCenter).not.toHaveBeenCalled();
    });

    it("dispatches Alt+Enter through its production middleware into the active sub-list behavior", async () => {
        runtime.matchHotKey.mockReturnValue(true);
        runtime.isIncludesHotKey.mockReturnValue(false);
        const wysiwyg = document.createElement("div");
        wysiwyg.className = "protyle-wysiwyg";
        wysiwyg.innerHTML = `<div class="li" data-node-id="item-id" data-type="NodeListItem" data-subtype="u">
            <div class="protyle-action"></div>
            ${emptyParagraphHTML("paragraph-id")}
            <div class="protyle-attr"></div>
        </div>`;
        const paragraph = requireElement(
            wysiwyg.querySelector<HTMLElement>("[data-node-id='paragraph-id']"),
            "Alt+Enter paragraph fixture",
        );
        const editable = requireElement(
            paragraph.querySelector<HTMLElement>("[contenteditable='true']"),
            "Alt+Enter editable fixture",
        );
        const range = createRangeAtEnd(editable);
        const protyle = createProtyle(wysiwyg);
        const event = new KeyboardEvent("keydown", {
            altKey: true,
            cancelable: true,
            key: "Enter",
        });
        const controller = new AbortController();

        await altEnterMiddleware(event, protyle, paragraph, range, controller);

        expect(runtime.matchHotKey).toHaveBeenCalledWith("⌥↩", event);
        expect(runtime.isIncludesHotKey).toHaveBeenCalledWith("⌥↩");
        expect(event.defaultPrevented).toBe(true);
        expect(controller.signal.aborted).toBe(true);
        expect(controller.signal.reason).toBe("Alt+Enter 添加子列表");
        const childList = requireElement(
            wysiwyg.querySelector<HTMLElement>("[data-node-id='node-1']"),
            "Alt+Enter child-list fixture",
        );
        const childItem = requireElement(
            childList.querySelector<HTMLElement>("[data-node-id='node-2']"),
            "Alt+Enter child item fixture",
        );
        expect(runtime.transaction).toHaveBeenCalledOnce();
        const {doOperations, undoOperations} = getTransactionOperations();
        expect(doOperations).toEqual([expect.objectContaining({
            action: "insert",
            id: "node-1",
            previousID: "paragraph-id",
        })]);
        expect(undoOperations).toEqual([{
            action: "delete",
            id: "node-1",
        }]);
        expect(childItem.dataset.nodeId).toBe("node-2");
        expect(runtime.focusByWbr).toHaveBeenCalledWith(childList, range);
        expect(runtime.scrollCenter).toHaveBeenCalledWith(protyle, childList);
    });

    it("indents a following item into a newly created child list", () => {
        const rootList = document.createElement("div");
        rootList.className = "list";
        rootList.dataset.nodeId = "root-list";
        rootList.innerHTML = `<div class="li" data-node-id="previous-item" data-subtype="u">
                <div class="protyle-action"></div>
                <div data-node-id="previous-paragraph" data-type="NodeParagraph"></div>
                <div class="protyle-attr"></div>
            </div>
            <div class="li" data-node-id="current-item" data-subtype="u">
                <div class="protyle-action"></div>
                <div data-node-id="current-paragraph" data-type="NodeParagraph">current</div>
                <div class="protyle-attr"></div>
            </div>
            <div class="protyle-attr"></div>`;
        const currentItem = rootList.querySelector<HTMLElement>("[data-node-id='current-item']");
        const currentParagraph = rootList.querySelector("[data-node-id='current-paragraph']");
        if (!currentItem || !currentParagraph) {
            throw new Error("indent fixture was not created");
        }
        const protyle = createProtyle(rootList);
        document.body.append(rootList);

        listIndent(protyle, [currentItem], createRangeAtEnd(currentParagraph));

        const childList = rootList.querySelector<HTMLElement>("[data-node-id='node-1']");
        expect(childList?.classList.contains("list")).toBe(true);
        expect(childList?.parentElement?.dataset.nodeId).toBe("previous-item");
        expect(childList?.querySelector("[data-node-id='current-item']")).toBe(currentItem);
        expect(runtime.updateTransaction).toHaveBeenCalledWith(
            protyle,
            rootList,
            expect.stringContaining("current<wbr>"),
        );
        expect(runtime.focusByWbr).toHaveBeenCalledWith(
            rootList,
            expect.any(Range),
        );
    });

    it("indents into an existing child list with ordered, symmetric transaction operations", () => {
        const wysiwyg = document.createElement("div");
        wysiwyg.className = "protyle-wysiwyg";
        wysiwyg.innerHTML = `<div class="li" data-node-id="previous-item" data-type="NodeListItem" data-subtype="u">
                <div class="protyle-action"></div>
                <div data-node-id="previous-paragraph" data-type="NodeParagraph"></div>
                <div class="list" data-node-id="child-list" data-type="NodeList" data-subtype="u">
                    <div class="li" data-node-id="existing-child" data-type="NodeListItem" data-subtype="u">
                        <div class="protyle-action"></div>
                        <div data-node-id="child-paragraph" data-type="NodeParagraph"></div>
                        <div class="protyle-attr"></div>
                    </div>
                    <div class="protyle-attr"></div>
                </div>
                <div class="protyle-attr"></div>
            </div>
            <div class="li" data-node-id="current-item" data-type="NodeListItem" data-subtype="u">
                <div class="protyle-action"></div>
                ${emptyParagraphHTML("current-paragraph")}
                <div class="protyle-attr"></div>
            </div>
            <div class="protyle-attr"></div>`;
        const currentItem = requireElement(
            wysiwyg.querySelector<HTMLElement>("[data-node-id='current-item']"),
            "transaction indent item fixture",
        );
        const currentEditable = requireElement(
            wysiwyg.querySelector<HTMLElement>("[data-node-id='current-paragraph'] [contenteditable='true']"),
            "transaction indent editable fixture",
        );
        const protyle = createProtyle(wysiwyg);
        document.body.append(wysiwyg);

        listIndent(protyle, [currentItem], createRangeAtEnd(currentEditable));

        expect(runtime.transaction).toHaveBeenCalledOnce();
        const {doOperations, undoOperations} = getTransactionOperations();
        expectNonEmptyOperationIds(doOperations);
        expectNonEmptyOperationIds(undoOperations);
        expect(operationOrder(doOperations)).toEqual([
            "move:current-item",
            "update:child-list",
        ]);
        expect(operationOrder(undoOperations)).toEqual([
            "move:current-item",
            "update:child-list",
        ]);
        expectSymmetricOperationIds(doOperations, undoOperations);
        expect(doOperations[0]).toEqual(expect.objectContaining({
            action: "move",
            id: "current-item",
            previousID: "existing-child",
        }));
        expect(undoOperations[0]).toEqual(expect.objectContaining({
            action: "move",
            id: "current-item",
            previousID: "previous-item",
        }));
    });

    it("breaks a non-first item with a genuinely empty first content block and records symmetric operations", () => {
        const wysiwyg = document.createElement("div");
        wysiwyg.className = "protyle-wysiwyg";
        wysiwyg.innerHTML = `<div class="list" data-node-id="source-list" data-type="NodeList" data-subtype="u">
                <div class="li" data-node-id="first-item" data-type="NodeListItem" data-subtype="u">
                    <div class="protyle-action"></div>
                    ${emptyParagraphHTML("first-paragraph")}
                    <div class="protyle-attr"></div>
                </div>
                <div class="li" data-node-id="current-item" data-type="NodeListItem" data-subtype="u">
                    <div class="protyle-action"></div>
                    ${emptyParagraphHTML("current-paragraph")}
                    <div class="protyle-attr"></div>
                </div>
                <div class="li" data-node-id="following-item" data-type="NodeListItem" data-subtype="u">
                    <div class="protyle-action"></div>
                    ${emptyParagraphHTML("following-paragraph")}
                    <div class="protyle-attr"></div>
                </div>
                <div class="protyle-attr"></div>
            </div>`;
        const currentParagraph = requireElement(
            wysiwyg.querySelector<HTMLElement>("[data-node-id='current-paragraph']"),
            "break-list paragraph fixture",
        );
        const currentEditable = requireElement(
            currentParagraph.querySelector<HTMLElement>("[contenteditable='true']"),
            "break-list empty editable fixture",
        );
        expect(currentParagraph.previousElementSibling?.classList.contains("protyle-action")).toBe(true);
        expect(currentEditable.textContent).toBe("");
        const removeFirst = vi.fn();
        const protyle = createProtyle(wysiwyg);

        breakList({
            protyle,
            blockElement: currentParagraph,
            range: createRangeAtEnd(currentEditable),
            removeFirst,
        });

        const sourceList = wysiwyg.querySelector<HTMLElement>("[data-node-id='source-list']");
        const newList = wysiwyg.querySelector<HTMLElement>("[data-node-id='node-1']");
        expect(removeFirst).not.toHaveBeenCalled();
        expect(sourceList?.querySelector("[data-node-id='first-item']")).not.toBeNull();
        expect(sourceList?.querySelector("[data-node-id='current-item']")).toBeNull();
        expect(wysiwyg.querySelector("[data-node-id='current-paragraph']")?.parentElement).toBe(wysiwyg);
        expect(newList?.querySelector("[data-node-id='following-item']")).not.toBeNull();
        expect(runtime.transaction).toHaveBeenCalledOnce();
        const {doOperations, undoOperations} = getTransactionOperations();
        expectNonEmptyOperationIds(doOperations);
        expectNonEmptyOperationIds(undoOperations);
        expect(operationOrder(doOperations)).toEqual([
            "delete:following-item",
            "insert:node-1",
            "move:current-paragraph",
            "delete:current-item",
        ]);
        expect(operationOrder(undoOperations)).toEqual([
            "insert:current-item",
            "move:following-item",
            "delete:node-1",
            "move:current-paragraph",
        ]);
        expectSymmetricOperationIds(doOperations, undoOperations);
        expect(runtime.focusByWbr).toHaveBeenCalledWith(wysiwyg, expect.any(Range));
    });

    it("outdents a sole top-level item and deletes the emptied list", async () => {
        const host = document.createElement("div");
        const wysiwyg = document.createElement("div");
        wysiwyg.className = "protyle-wysiwyg";
        host.append(wysiwyg);
        document.body.append(host);
        wysiwyg.innerHTML = `<div class="list" data-node-id="source-list" data-type="NodeList" data-subtype="u">
                <div class="li" data-node-id="current-item" data-type="NodeListItem" data-subtype="u">
                    <div class="protyle-action"></div>
                    ${emptyParagraphHTML("current-paragraph")}
                    <div class="protyle-attr"></div>
                </div>
                <div class="protyle-attr"></div>
            </div>`;
        const currentItem = requireElement(
            wysiwyg.querySelector<HTMLElement>("[data-node-id='current-item']"),
            "sole outdent item fixture",
        );
        const currentEditable = requireElement(
            wysiwyg.querySelector<HTMLElement>("[data-node-id='current-paragraph'] [contenteditable='true']"),
            "sole outdent editable fixture",
        );
        const protyle = createProtyle(wysiwyg);

        await listOutdent(protyle, [currentItem], createRangeAtEnd(currentEditable));

        expect(wysiwyg.querySelector("[data-node-id='source-list']")).toBeNull();
        expect(wysiwyg.querySelector("[data-node-id='current-paragraph']")?.parentElement).toBe(wysiwyg);
        expect(runtime.transaction).toHaveBeenCalledOnce();
        const {doOperations, undoOperations} = getTransactionOperations();
        expectNonEmptyOperationIds(doOperations);
        expectNonEmptyOperationIds(undoOperations);
        expect(operationOrder(doOperations)).toEqual([
            "move:current-paragraph",
            "delete:source-list",
        ]);
        expect(operationOrder(undoOperations)).toEqual([
            "insert:source-list",
            "move:current-paragraph",
        ]);
        expectSymmetricOperationIds(doOperations, undoOperations);
        expect(runtime.focusByWbr).toHaveBeenCalledWith(wysiwyg, expect.any(Range));
    });

    it("never emits an empty operation ID when traditional top-level outdent moves following items", async () => {
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {
                config: {
                    editor: {
                        listLogicalOutdent: false,
                    },
                },
            },
        });
        const host = document.createElement("div");
        const wysiwyg = document.createElement("div");
        wysiwyg.className = "protyle-wysiwyg";
        host.append(wysiwyg);
        document.body.append(host);
        wysiwyg.innerHTML = `<div class="list" data-node-id="source-list" data-type="NodeList" data-subtype="u">
                <div class="li" data-node-id="current-item" data-type="NodeListItem" data-subtype="u">
                    <div class="protyle-action"></div>
                    ${emptyParagraphHTML("current-paragraph")}
                    <div class="protyle-attr"></div>
                </div>
                <div class="li" data-node-id="following-item" data-type="NodeListItem" data-subtype="u">
                    <div class="protyle-action"></div>
                    ${emptyParagraphHTML("following-paragraph")}
                    <div class="protyle-attr"></div>
                </div>
                <div class="protyle-attr"></div>
            </div>`;
        const currentItem = requireElement(
            wysiwyg.querySelector<HTMLElement>("[data-node-id='current-item']"),
            "traditional outdent item fixture",
        );
        const currentEditable = requireElement(
            wysiwyg.querySelector<HTMLElement>("[data-node-id='current-paragraph'] [contenteditable='true']"),
            "traditional outdent editable fixture",
        );
        const protyle = createProtyle(wysiwyg);

        await listOutdent(protyle, [currentItem], createRangeAtEnd(currentEditable));

        expect(runtime.transaction).toHaveBeenCalledOnce();
        const {doOperations, undoOperations} = getTransactionOperations();
        expectNonEmptyOperationIds(doOperations);
        expectNonEmptyOperationIds(undoOperations);
        expect(operationOrder(doOperations)).toEqual([
            "move:current-paragraph",
            "insert:node-1",
            "move:following-item",
            "delete:source-list",
        ]);
        expect(operationOrder(undoOperations)).toEqual([
            "insert:source-list",
            "move:current-paragraph",
            "move:following-item",
            "delete:node-1",
        ]);
        expectSymmetricOperationIds(doOperations, undoOperations);
    });
});
