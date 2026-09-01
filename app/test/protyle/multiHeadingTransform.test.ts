import {describe, expect, it, vi} from "vitest";
import {buildMultipleHeadingTransformMenu} from "../../src/protyle/gutter/multiHeadingTransform";

const makeHeading = (root: HTMLElement, id: string, level: number) => {
    const element = document.createElement("div");
    element.dataset.nodeId = id;
    element.dataset.type = "NodeHeading";
    element.dataset.subtype = `h${level}`;
    root.appendChild(element);
    return element;
};

const makeProtyle = (root: HTMLElement) => ({
    wysiwyg: {element: root},
} as unknown as IProtyle);

describe("multiple heading transform menu", () => {
    it("builds a same-level submenu and submits the selected IDs", () => {
        const root = document.createElement("div");
        const first = makeHeading(root, "heading-1", 2);
        const second = makeHeading(root, "heading-2", 2);
        const fetchPost = vi.fn((_url, _data, callback) => callback({
            code: 0,
            msg: "",
            data: {
                doOperations: [
                    {action: "update", id: "heading-1", data: '<div data-node-id="heading-1" data-subtype="h3"></div>'},
                    {action: "update", id: "heading-2", data: '<div data-node-id="heading-2" data-subtype="h3"></div>'},
                ],
                undoOperations: [{action: "update", id: "heading-1"}],
            },
        }));
        const focusBlock = vi.fn();
        const mathRender = vi.fn();
        const submitTransaction = vi.fn();
        const protyle = makeProtyle(root);
        const menu = buildMultipleHeadingTransformMenu(protyle, [first, second], {
            fetchPost,
            focusBlock,
            mathRender,
            transaction: submitTransaction,
            labelForLevel: level => `Heading ${level}`,
        });

        expect(menu.map(item => item.id)).toEqual(["heading1", "heading3", "heading4", "heading5", "heading6"]);
        const headingMenu = menu[1];
        if (!headingMenu) {
            throw new Error("Expected a heading transform menu item");
        }
        expect(headingMenu.label).toBe("Heading 3");

        headingMenu.click?.(document.createElement("button"), new MouseEvent("click"));

        expect(fetchPost).toHaveBeenCalledWith(
            "/api/block/getHeadingLevelTransaction",
            {ids: ["heading-1", "heading-2"], level: 3},
            expect.any(Function),
        );
        expect(root.querySelector('[data-node-id="heading-1"]')?.getAttribute("data-subtype")).toBe("h3");
        expect(root.querySelector('[data-node-id="heading-2"]')?.getAttribute("data-subtype")).toBe("h3");
        expect(mathRender).toHaveBeenCalledTimes(2);
        expect(focusBlock).toHaveBeenCalledWith(expect.any(Element), root, true);
        expect(submitTransaction).toHaveBeenCalledWith(
            protyle,
            expect.arrayContaining([
                expect.objectContaining({id: "heading-1"}),
                expect.objectContaining({id: "heading-2"}),
            ]),
            [{action: "update", id: "heading-1"}],
        );
    });

    it("does not expose the submenu for invalid heading selections", () => {
        const root = document.createElement("div");
        const first = makeHeading(root, "heading-1", 2);
        const mixedLevel = makeHeading(root, "heading-2", 3);
        const otherRoot = document.createElement("div");
        const otherContainer = makeHeading(otherRoot, "heading-3", 2);

        expect(buildMultipleHeadingTransformMenu(makeProtyle(root), [first], {
            fetchPost: vi.fn(),
            focusBlock: vi.fn(),
            mathRender: vi.fn(),
            transaction: vi.fn(),
            labelForLevel: level => `Heading ${level}`,
        })).toEqual([]);
        expect(buildMultipleHeadingTransformMenu(makeProtyle(root), [first, mixedLevel], {
            fetchPost: vi.fn(),
            focusBlock: vi.fn(),
            mathRender: vi.fn(),
            transaction: vi.fn(),
            labelForLevel: level => `Heading ${level}`,
        })).toEqual([]);
        expect(buildMultipleHeadingTransformMenu(makeProtyle(root), [first, otherContainer], {
            fetchPost: vi.fn(),
            focusBlock: vi.fn(),
            mathRender: vi.fn(),
            transaction: vi.fn(),
            labelForLevel: level => `Heading ${level}`,
        })).toEqual([]);
    });

    it("ignores an empty kernel transaction without changing the editor", () => {
        const root = document.createElement("div");
        const first = makeHeading(root, "heading-1", 1);
        const second = makeHeading(root, "heading-2", 1);
        const fetchPost = vi.fn((_url, _data, callback) => callback({
            code: 0,
            msg: "",
            data: {doOperations: [], undoOperations: []},
        }));
        const submitTransaction = vi.fn();
        const menu = buildMultipleHeadingTransformMenu(makeProtyle(root), [first, second], {
            fetchPost,
            focusBlock: vi.fn(),
            mathRender: vi.fn(),
            transaction: submitTransaction,
            labelForLevel: level => `Heading ${level}`,
        });

        const headingMenu = menu[0];
        if (!headingMenu) {
            throw new Error("Expected a heading transform menu item");
        }
        headingMenu.click?.(document.createElement("button"), new MouseEvent("click"));

        expect(root.querySelector('[data-node-id="heading-1"]')?.getAttribute("data-subtype")).toBe("h1");
        expect(submitTransaction).not.toHaveBeenCalled();
    });
});
