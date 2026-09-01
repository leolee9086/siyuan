import {beforeEach, describe, expect, it, vi} from "vitest";

const state = vi.hoisted(() => ({
    menuItems: [] as IMenu[],
    append: vi.fn(),
    boundariesUnloaded: true,
}));

vi.mock("../../src/protyle/breadcrumb/menu/imports", () => ({
    MenuItem: class {
        public element: HTMLElement;

        constructor(options: IMenu) {
            state.menuItems.push(options);
            this.element = document.createElement("button");
            this.element.dataset.id = options.id || "";
        }
    },
    siyuanI18n: {
        loadAllContent: "Load all content",
        keepLazyLoad: "Keep loaded content",
    },
    hasUnloadedDocumentBlocks: () => state.boundariesUnloaded,
    isMobile: false,
    reloadProtyle: vi.fn(),
    hideElements: vi.fn(),
    fetchPost: vi.fn(),
    resize: vi.fn(),
    getSiyuanConfig: () => ({keymap: {editor: {general: {}}}}),
    isInAndroid: () => false,
    isInHarmony: () => false,
}));

const {添加懒加载菜单项} = await import("../../src/protyle/breadcrumb/menu/menuItems.misc");

const makeProtyle = () => {
    const scrollElement = document.createElement("div");
    const loadAll = vi.fn(async () => true);
    return {
        protyle: {
            wysiwyg: {element: document.createElement("div")},
            scroll: {
                element: scrollElement,
                keepLoadedContent: false,
                loadAll,
            },
        } as unknown as IProtyle,
        loadAll,
    };
};

describe("breadcrumb dynamic loading actions", () => {
    beforeEach(() => {
        state.menuItems.length = 0;
        state.append.mockReset();
        state.boundariesUnloaded = true;
    });

    it("offers load-all before the keep-loaded toggle for incomplete ranges", () => {
        const {protyle, loadAll} = makeProtyle();
        const menu = {append: state.append} as never;

        添加懒加载菜单项(protyle, menu);

        expect(state.menuItems.map(item => item.id)).toEqual(["loadAllContent", "keepLazyLoad"]);
        expect(state.menuItems[0]?.icon).toBe("iconSelectAll");
        expect(state.menuItems[1]?.current).toBe(false);

        const loadAllItem = state.menuItems[0];
        const keepLoadedItem = state.menuItems[1];
        if (!loadAllItem || !keepLoadedItem) {
            throw new Error("Expected dynamic loading menu items");
        }
        loadAllItem.click?.(document.createElement("button"), new MouseEvent("click"));
        keepLoadedItem.click?.(document.createElement("button"), new MouseEvent("click"));

        expect(loadAll).toHaveBeenCalledWith(protyle);
        expect(protyle.scroll.keepLoadedContent).toBe(true);
    });

    it("hides load-all when both document boundaries are already loaded", () => {
        state.boundariesUnloaded = false;
        const {protyle} = makeProtyle();
        const menu = {append: state.append} as never;

        添加懒加载菜单项(protyle, menu);

        expect(state.menuItems.map(item => item.id)).toEqual(["keepLazyLoad"]);
    });
});
