import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    addItem: vi.fn(),
}));

vi.mock("../../../src/protyle/render/av/col/add/imports", () => ({
    Constants: {MENU_AV_HEADER_ADD: "av-header-add"},
    Menu: class {
        addItem = mocks.addItem;
    },
    dayjs: () => ({format: () => "20260727000000"}),
    siyuanI18n: {},
    submitAVColumnStructureTransaction: vi.fn(),
}));

vi.mock("../../../src/protyle/render/av/col/add/presentation", () => ({
    addAttrViewColAnimation: vi.fn(),
}));

import {addCol} from "../../../src/protyle/render/av/col/add/menu.factory";
import {avMenuPanelDomainBrand} from "../../../src/protyle/render/av/openMenuPanel.types";
import type {AVMenuPanelDomain} from "../../../src/protyle/render/av/openMenuPanel.types";

const panel: AVMenuPanelDomain = {
    [avMenuPanelDomainBrand]: "AVMenuPanelDomain",
    open: vi.fn(),
    openViewMenu: vi.fn(),
};

const createBlock = () => document.createElement("div");

beforeEach(() => {
    vi.clearAllMocks();
});

describe("add column menu factory", () => {
    it("fails visibly before creating items when the AV identity is missing", () => {
        const blockElement = createBlock();
        blockElement.dataset.nodeId = "block-id";

        expect(() => addCol({protyle: {} as IProtyle, blockElement, panel}))
            .toThrow("Cannot add AV column without data-av-id");
        expect(mocks.addItem).not.toHaveBeenCalled();
    });

    it("fails visibly before creating items when the block identity is missing", () => {
        const blockElement = createBlock();
        blockElement.dataset.avId = "av-id";

        expect(() => addCol({protyle: {} as IProtyle, blockElement, panel}))
            .toThrow("Cannot add AV column without data-node-id");
        expect(mocks.addItem).not.toHaveBeenCalled();
    });

    it("builds the complete ordered column type menu for a valid block", () => {
        const blockElement = createBlock();
        blockElement.dataset.avId = "av-id";
        blockElement.dataset.nodeId = "block-id";

        addCol({protyle: {} as IProtyle, blockElement, panel});

        expect(mocks.addItem).toHaveBeenCalledTimes(16);
        expect(mocks.addItem.mock.calls.map(call => call[0].id)).toEqual([
            "text", "number", "select", "multiSelect", "date", "assets", "checkbox", "link",
            "email", "phone", "template", "relation", "rollup", "lineNumber", "createdTime", "updatedTime",
        ]);
    });
});
