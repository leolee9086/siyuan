import {beforeEach, describe, expect, it, vi} from "vitest";

const state = vi.hoisted(() => ({
    menuOptions: [] as IMenu[],
    appended: [] as HTMLElement[],
}));

vi.mock("../../src/menus/Menu.Item", () => ({
    MenuItem: class {
        public element: HTMLElement;

        constructor(options: IMenu) {
            state.menuOptions.push(options);
            this.element = document.createElement("button");
            this.element.dataset.id = options.id || "";
        }
    },
}));

vi.mock("../../src/util/siyuanEnvironments/getMenu.environment", () => ({
    getSiyuanGlobalMenus: () => ({
        menu: {append: (element: HTMLElement) => state.appended.push(element)},
    }),
}));

vi.mock("../../src/util/siyuanEnvironments/getSiyuanConfig.environment", () => ({
    getSiyuanConfig: () => ({
        keymap: {
            editor: {
                insert: {list: {}, "ordered-list": {}, check: {}, quote: {}},
                heading: {paragraph: {}, heading1: {}, heading2: {}, heading3: {}, heading4: {}, heading5: {}, heading6: {}},
                general: {hLayout: {}, vLayout: {}},
            },
        },
    }),
}));

vi.mock("../../src/util/siyuanEnvironments/i18n.getI18n.environment", () => ({
    siyuanI18n: new Proxy({}, {get: (_target, property) => String(property)}),
}));

vi.mock("../../src/protyle/gutter/turnInto/items", () => ({
    genTurnsInto: (options: {menuId: string}) => ({id: options.menuId}),
    genTurnsIntoGroups: (options: {menuId: string}) => ({id: options.menuId}),
    genTurnsIntoOne: (options: {menuId: string}) => ({id: options.menuId}),
}));

vi.mock("../../src/protyle/gutter/buildGutterTurnIntoMenu", () => ({
    buildEmptyParagraphTurnIntoMenu: () => [],
}));

vi.mock("../../src/protyle/wysiwyg/getBlock", () => ({
    getNextBlockSibling: (element: Element) => element.nextElementSibling,
}));

const {构建转换菜单} = await import("../../src/protyle/gutter/buildMultipleTurnIntoMenu");

const makeHeading = (parent: HTMLElement, id: string, level: number) => {
    const element = document.createElement("div");
    element.dataset.nodeId = id;
    element.dataset.type = "NodeHeading";
    element.dataset.subtype = `h${level}`;
    parent.appendChild(element);
    return element;
};

const makeProtyle = () => ({
    disabled: false,
    wysiwyg: {element: document.createElement("div")},
} as unknown as IProtyle);

describe("multiple heading transform menu integration", () => {
    beforeEach(() => {
        state.menuOptions.length = 0;
        state.appended.length = 0;
    });

    it("appends the multi-heading menu between regular transforms and super-block merging", () => {
        const parent = document.createElement("div");
        const first = makeHeading(parent, "heading-1", 2);
        const second = makeHeading(parent, "heading-2", 2);

        构建转换菜单(makeProtyle(), [first, second], false, true);

        expect(state.menuOptions.map(item => item.id)).toEqual(["turnInto", "tWithSubtitle", "mergeSuperBlock"]);
        expect(state.menuOptions[1]?.submenu?.map(item => item.id)).toEqual([
            "heading1", "heading3", "heading4", "heading5", "heading6",
        ]);
    });

    it("does not append the multi-heading menu for mixed heading levels", () => {
        const parent = document.createElement("div");
        const first = makeHeading(parent, "heading-1", 2);
        const second = makeHeading(parent, "heading-2", 3);

        构建转换菜单(makeProtyle(), [first, second], false, true);

        expect(state.menuOptions.map(item => item.id)).toEqual(["turnInto", "mergeSuperBlock"]);
    });
});
