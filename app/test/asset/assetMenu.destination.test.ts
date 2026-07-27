import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    focusToolbarRange: vi.fn(),
    menuRemove: vi.fn(),
    renderAssetsPreview: vi.fn((value: string) => `preview:${value}`),
    upDownHint: vi.fn(),
}));

vi.mock("../../src/menus/protyleMenus/assetMenu/imports", () => ({
    focusToolbarRange: mocks.focusToolbarRange,
    getSiyuanGlobalMenus: () => ({menu: {remove: mocks.menuRemove}}),
    hasClosestByClassName: (element: HTMLElement, className: string) => element.closest(`.${className}`),
    renderAssetsPreview: mocks.renderAssetsPreview,
    upDownHint: mocks.upDownHint,
}));

vi.mock("../../src/menus/protyleMenus/assetMenu/protyle.asset.view", () => ({
    更新素材元数据预览: vi.fn(),
}));

import {创建键盘事件处理器} from "../../src/menus/protyleMenus/assetMenu/protyle.asset.inputHandlers";
import {处理列表点击} from "../../src/menus/protyleMenus/assetMenu/protyle.asset.listEvents";
import type {AssetMenuDestination} from "../../src/menus/protyleMenus/protyle.types";

const createDestination = (kind: AssetMenuDestination["kind"]) => ({
    kind,
    select: vi.fn(),
}) as AssetMenuDestination;

const createKeyboardContext = (destination: AssetMenuDestination, empty = false) => {
    const element = document.createElement("div");
    const listElement = document.createElement("div");
    const previewElement = document.createElement("div");
    const item = document.createElement("button");
    item.className = empty ? "b3-list--empty" : "b3-list-item--focus";
    item.dataset.value = "assets/example.png";
    item.textContent = "example.png";
    element.append(item);
    return {
        element,
        listElement,
        previewElement,
        protyle: {} as IProtyle,
        destination,
    };
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.upDownHint.mockReturnValue(null);
});

describe("asset menu destination", () => {
    it("leaves callback destination lifecycle to its owner after a click", () => {
        const destination = createDestination("callback");
        const item = document.createElement("button");
        item.className = "b3-list-item";
        item.dataset.value = "assets/example.png";
        item.textContent = "example.png";

        item.addEventListener("click", 处理列表点击(destination));
        item.dispatchEvent(new MouseEvent("click", {bubbles: true}));

        expect(destination.select).toHaveBeenCalledWith("assets/example.png", "example.png");
        expect(mocks.menuRemove).not.toHaveBeenCalled();
    });

    it("closes the owned menu after editor destination selection", () => {
        const destination = createDestination("editor");
        const item = document.createElement("button");
        item.className = "b3-list-item";
        item.dataset.value = "assets/example.png";
        item.textContent = "example.png";

        item.addEventListener("click", 处理列表点击(destination));
        item.dispatchEvent(new MouseEvent("click", {bubbles: true}));

        expect(destination.select).toHaveBeenCalledWith("assets/example.png", "example.png");
        expect(mocks.menuRemove).toHaveBeenCalledOnce();
    });

    it("restores editor focus when Enter is pressed on an empty editor menu", () => {
        const destination = createDestination("editor");
        const handler = 创建键盘事件处理器(createKeyboardContext(destination, true));

        handler(new KeyboardEvent("keydown", {key: "Enter"}));

        expect(destination.select).not.toHaveBeenCalled();
        expect(mocks.menuRemove).toHaveBeenCalledOnce();
        expect(mocks.focusToolbarRange).toHaveBeenCalledOnce();
    });

    it("keeps callback mode open on empty Enter and restores focus only for editor Escape", () => {
        const callbackDestination = createDestination("callback");
        创建键盘事件处理器(createKeyboardContext(callbackDestination, true))(
            new KeyboardEvent("keydown", {key: "Enter"})
        );
        创建键盘事件处理器(createKeyboardContext(callbackDestination))(
            new KeyboardEvent("keydown", {key: "Escape"})
        );

        expect(mocks.menuRemove).not.toHaveBeenCalled();
        expect(mocks.focusToolbarRange).not.toHaveBeenCalled();

        const editorDestination = createDestination("editor");
        创建键盘事件处理器(createKeyboardContext(editorDestination))(
            new KeyboardEvent("keydown", {key: "Escape"})
        );
        expect(mocks.focusToolbarRange).toHaveBeenCalledOnce();
    });
});
