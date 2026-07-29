import {beforeEach, describe, expect, it, vi} from "vitest";

const runtime = vi.hoisted(() => ({
    isMobile: vi.fn(),
    mathRender: vi.fn(),
}));

vi.mock("../../../src/editor/getIcon", () => ({
    getIconByType: () => "iconNode",
}));
vi.mock("../../../src/util/platform/functions", () => ({
    isMobile: runtime.isMobile,
}));
vi.mock("../../../src/protyle/render/mathRender", () => ({
    mathRender: runtime.mathRender,
}));
vi.mock("../../../src/emoji/emoji.render", () => ({
    unicode2Emoji: (value: string) => value,
}));
vi.mock("../../../src/util/DOM/escape", () => ({
    escapeAriaLabel: (value: string) => value,
}));
vi.mock("../../../src/protyle/util/hasClosest", () => ({
    hasClosestByTag: (element: HTMLElement, tag: string) => element.closest(tag),
}));

import {Tree} from "../../../src/util/file/tree/Tree";
import type {TreeBlockData} from "../../../src/util/file/tree.types";
import type {TreeNodeData} from "../../../src/util/file/tree.types";

const treeItem = (properties: Partial<TreeNodeData> = {}): TreeNodeData => ({
    box: "notebook",
    nodeType: "NodeDocument",
    hPath: "/Document",
    subType: "",
    name: "Document",
    type: "outline",
    depth: 0,
    id: "document-id",
    count: 0,
    ...properties,
});

const treeBlock = (properties: Partial<TreeBlockData> = {}): TreeBlockData => ({
    id: "block-id",
    type: "NodeParagraph",
    subType: "",
    content: "Block",
    refText: "",
    defID: "",
    defPath: "",
    depth: 1,
    count: 0,
    folded: false,
    ial: {},
    ...properties,
});

beforeEach(() => {
    runtime.isMobile.mockReset();
    runtime.isMobile.mockReturnValue(false);
    runtime.mathRender.mockReset();
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {
            altIsPressed: false,
            ctrlIsPressed: false,
            shiftIsPressed: false,
            dragElement: undefined,
            languages: {emptyContent: "Empty"},
            storage: {localImages: {file: "document-icon"}},
        },
    });
    Object.defineProperty(globalThis, "Lute", {
        configurable: true,
        value: {BlockDOM2Content: (value: string) => value},
    });
});

describe("Tree runtime owner", () => {
    it("renders empty and populated data through the same instance", () => {
        const element = document.createElement("div");
        const tree = new Tree({element, data: []});

        expect(element.querySelector(".b3-list--empty")?.textContent).toBe("Empty");

        tree.updateData([treeItem({icon: "iconCustom"})]);

        expect(element.querySelector(".b3-list-item__graphic use")?.getAttribute("xlink:href")).toBe("#iconNode");
        expect(element.querySelector("[data-node-id='document-id']")).not.toBeNull();
        expect(runtime.mathRender).toHaveBeenCalledWith(element);
    });

    it("preserves nested tree and block markup, extension ordering, and mobile spacing", () => {
        runtime.isMobile.mockReturnValue(true);
        const element = document.createElement("div");
        new Tree({
            element,
            data: [treeItem({
                type: "bookmark",
                count: 2,
                children: [treeItem({id: "child-id", depth: 1, type: "tag"})],
                blocks: [treeBlock({
                    type: "NodeDocument",
                    refText: "A B",
                    defID: "definition-id",
                    defPath: "/definition.sy",
                    ial: {icon: "document-emoji"},
                })],
            })],
            topExtHTML: '<span class="top-extra">top</span>',
            blockExtHTML: '<span class="block-extra">block</span>',
        });

        const rootItem = element.querySelector<HTMLElement>("li[data-node-id='document-id']");
        const childToggle = element.querySelector<HTMLElement>("li[data-node-id='child-id'] .b3-list-item__toggle");
        const blockItem = element.querySelector<HTMLElement>("li[data-node-id='block-id']");
        expect(rootItem?.classList.contains("b3-list-item--hide-action")).toBe(false);
        expect(childToggle?.getAttribute("style")).toBe("padding-left: 24px");
        expect(rootItem?.querySelector(".top-extra")?.nextElementSibling?.classList.contains("counter")).toBe(true);
        expect(blockItem?.getAttribute("data-ref-text")).toBe("A%20B");
        expect(blockItem?.querySelector(".b3-list-item__graphic")?.textContent).toBe("document-emoji");
        expect(blockItem?.querySelector(".b3-list-item__text")?.nextElementSibling?.classList.contains("block-extra")).toBe(true);
    });

    it("routes ordinary and modifier clicks without changing the public TreeDomain surface", () => {
        const element = document.createElement("div");
        const click = vi.fn();
        const ctrlClick = vi.fn();
        const altClick = vi.fn();
        const shiftClick = vi.fn();
        const tree = new Tree({element, data: [treeItem({type: "tag"})], click, ctrlClick, altClick, shiftClick});
        const item = element.querySelector<HTMLElement>("li[data-node-id='document-id']");
        expect(item).not.toBeNull();

        tree.click(item!);
        expect(click).toHaveBeenLastCalledWith(item, undefined);

        item?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        expect(click).toHaveBeenCalledTimes(2);

        window.siyuan.ctrlIsPressed = true;
        window.siyuan.altIsPressed = true;
        window.siyuan.shiftIsPressed = true;
        item?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        expect(ctrlClick).toHaveBeenCalledOnce();

        window.siyuan.ctrlIsPressed = false;
        item?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        expect(altClick).toHaveBeenCalledOnce();

        window.siyuan.altIsPressed = false;
        item?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        expect(shiftClick).toHaveBeenCalledOnce();
    });

    it("toggles both sibling lists and delegates context and action events to their owning item", () => {
        const element = document.createElement("div");
        const click = vi.fn();
        const rightClick = vi.fn();
        const tree = new Tree({
            element,
            data: [treeItem({
                type: "bookmark",
                children: [treeItem({id: "child-id", depth: 1})],
                blocks: [treeBlock({ial: null})],
            })],
            topExtHTML: '<button class="b3-list-item__action"><svg></svg></button>',
            click,
            rightClick,
        });
        const item = element.querySelector<HTMLElement>("li[data-node-id='document-id']")!;
        const lists = [item.nextElementSibling, item.nextElementSibling?.nextElementSibling];

        item.querySelector<HTMLElement>(".b3-list-item__toggle")?.click();
        expect(lists.every((list) => list?.classList.contains("fn__none"))).toBe(true);
        expect(item.classList.contains("b3-list-item--focus")).toBe(true);

        item.querySelector<HTMLElement>(".b3-list-item__toggle")?.click();
        expect(lists.every((list) => !list?.classList.contains("fn__none"))).toBe(true);

        item.querySelector<SVGElement>(".b3-list-item__action svg")?.dispatchEvent(
            new MouseEvent("click", {bubbles: true, cancelable: true}),
        );
        expect(click).toHaveBeenLastCalledWith(item, expect.any(MouseEvent));

        item.querySelector<SVGElement>(".b3-list-item__graphic")?.dispatchEvent(
            new MouseEvent("contextmenu", {bubbles: true, cancelable: true}),
        );
        expect(rightClick).toHaveBeenLastCalledWith(item, expect.any(MouseEvent));

        const toggleClick = vi.fn();
        const delegatedTree = new Tree({element: document.createElement("div"), data: [], toggleClick});
        delegatedTree.toggleBlocks(item);
        expect(toggleClick).toHaveBeenCalledWith(item);
    });

    it("preserves drag hooks and default drag state", () => {
        const element = document.createElement("div");
        const dragStart = vi.fn(() => false);
        const dragEnd = vi.fn(() => false);
        new Tree({
            element,
            data: [treeItem({blocks: [treeBlock()]})],
            blockDraggable: true,
            dragStart,
            dragEnd,
        });
        expect(element.innerHTML).toContain("block-id");
        const item = element.querySelector<HTMLElement>("li[draggable='true']");
        expect(item?.getAttribute("draggable")).toBe("true");

        const dataTransfer = {setData: vi.fn()};
        const dragStartEvent = new Event("dragstart", {bubbles: true});
        Object.defineProperty(dragStartEvent, "dataTransfer", {value: dataTransfer});
        const draggedHTML = item?.outerHTML;
        item?.dispatchEvent(dragStartEvent);
        expect(dragStart).toHaveBeenCalledOnce();
        expect(dataTransfer.setData).toHaveBeenCalledWith("text/html", draggedHTML);
        expect(item?.style.opacity).toBe("0.38");
        expect(window.siyuan.dragElement).toBe(item);

        item?.dispatchEvent(new Event("dragend", {bubbles: true}));
        expect(dragEnd).toHaveBeenCalledOnce();
        expect(item?.style.opacity).toBe("1");
        expect(window.siyuan.dragElement).toBeUndefined();

        dragStart.mockReturnValueOnce(true);
        item?.dispatchEvent(new Event("dragstart", {bubbles: true}));
        expect(dragStart).toHaveBeenCalledTimes(2);
        expect(window.siyuan.dragElement).toBeUndefined();
    });

    it("round-trips expanded ids and bulk visibility", () => {
        const element = document.createElement("div");
        const tree = new Tree({
            element,
            data: [treeItem({children: [treeItem({id: "child-id", depth: 1})]})],
        });

        tree.collapseAll();
        expect(tree.getExpandIds()).toEqual([]);

        tree.setExpandIds(["document-id"]);
        expect(tree.getExpandIds()).toEqual(["document-id"]);

        tree.expandAll();
        expect(element.querySelectorAll("ul.fn__none")).toHaveLength(0);
    });
});
