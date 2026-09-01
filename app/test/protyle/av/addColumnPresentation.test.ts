import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    bindEditEvent: vi.fn(),
    getEditHTML: vi.fn(() => "<div data-edit-panel></div>"),
    openMenuPanel: vi.fn(),
    removeSiyuanMenu: vi.fn(),
    setPosition: vi.fn(),
}));

vi.mock("../../../src/protyle/render/av/col/add/imports", () => ({
    bindEditEvent: mocks.bindEditEvent,
    escapeAttr: (value: string) => value,
    escapeHtml: (value: string) => value,
    genColDataByType: (type: string, id: string, name: string) => ({type, id, name}),
    getColIconByType: (type: string) => `icon-${type}`,
    getColNameByType: (type: string) => `name-${type}`,
    getEditHTML: mocks.getEditHTML,
    getFieldsByData: (data: IAV) => "columns" in data.view ? data.view.columns : data.view.fields,
    getSiyuanMenus: () => ({menu: {}}),
    removeSiyuanMenu: mocks.removeSiyuanMenu,
    setPosition: mocks.setPosition,
    unicode2Emoji: (unicode: string, className: string) => `<span class="${className}">${unicode}</span>`,
}));

import {addAttrViewColAnimation} from "../../../src/protyle/render/av/col/add/presentation";
import {avMenuPanelDomainBrand} from "../../../src/protyle/render/av/openMenuPanel.types";
import type {AVMenuPanelDomain} from "../../../src/protyle/render/av/openMenuPanel.types";

const createPanel = (): AVMenuPanelDomain => ({
    [avMenuPanelDomainBrand]: "AVMenuPanelDomain",
    open: mocks.openMenuPanel,
    openViewMenu: vi.fn(),
});

const createTableBlock = () => {
    const blockElement = document.createElement("div");
    blockElement.className = "av";
    blockElement.dataset.nodeId = "block-id";
    blockElement.innerHTML = `
        <div class="av__views"></div>
        <div class="av__row av__row--header">
            <div class="av__row-prefix"></div>
            <div class="av__cell av__cell--header" data-col-id="previous-id"></div>
        </div>
        <div class="av__row">
            <div class="av__row-prefix"></div>
            <div class="av__cell" data-col-id="previous-id"></div>
        </div>`;
    document.body.append(blockElement);
    return blockElement;
};

beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
});

describe("addAttrViewColAnimation", () => {
    it("inserts a typed header and placeholder cells after the requested table column", () => {
        const blockElement = createTableBlock();

        addAttrViewColAnimation({
            blockElement,
            protyle: {} as IProtyle,
            panel: createPanel(),
            type: "number",
            name: "Amount",
            id: "new-id",
            previousID: "previous-id",
        });

        const header = blockElement.querySelector('.av__row--header [data-col-id="new-id"]');
        expect(header?.getAttribute("data-dtype")).toBe("number");
        expect(header?.textContent).toContain("Amount");
        expect(header?.previousElementSibling?.getAttribute("data-col-id")).toBe("previous-id");
        const bodyCell = blockElement.querySelector('.av__row:not(.av__row--header) [data-col-id="new-id"]');
        expect(bodyCell).toBeNull();
        expect(blockElement.querySelector('.av__row:not(.av__row--header) [data-col-id="previous-id"] + .av__cell .av__pulse'))
            .not.toBeNull();
    });

    it("inserts a custom attribute row before the terminal separator", () => {
        const blockElement = document.createElement("div");
        blockElement.dataset.nodeId = "custom-block-id";
        blockElement.innerHTML = '<div class="fn__hr"></div>';
        document.body.append(blockElement);

        addAttrViewColAnimation({
            blockElement,
            protyle: {} as IProtyle,
            panel: createPanel(),
            type: "text",
            name: "Text",
            id: "custom-col-id",
            previousID: undefined,
        });

        const row = blockElement.querySelector('.av__row[data-col-id="custom-col-id"]');
        expect(row?.getAttribute("data-id")).toBe("custom-block-id");
        expect(row?.nextElementSibling?.classList.contains("fn__hr")).toBe(true);
        expect(row?.querySelector('[data-type="text"]')).not.toBeNull();
    });

    it("refreshes and rebinds an existing table edit panel without opening another panel", () => {
        const blockElement = createTableBlock();
        const panel = document.createElement("div");
        panel.className = "av__panel";
        panel.innerHTML = '<div class="b3-menu"></div>';
        document.body.append(panel);
        const data = {view: {columns: [{id: "new-id", type: "number", name: "Amount"}] as IAVColumn[]}} as IAV;
        const protyle = {} as IProtyle;

        addAttrViewColAnimation({
            blockElement,
            protyle,
            panel: createPanel(),
            type: "number",
            name: "Amount",
            id: "new-id",
            previousID: "previous-id",
            data,
        });

        const menuElement = panel.querySelector(".b3-menu");
        expect(menuElement?.innerHTML).toBe('<div data-edit-panel=""></div>');
        expect(mocks.getEditHTML).toHaveBeenCalledWith({protyle, data, colId: "new-id", isCustomAttr: false});
        expect(mocks.bindEditEvent).toHaveBeenCalledWith(expect.objectContaining({
            protyle,
            data,
            menuElement,
            blockID: "block-id",
        }));
        expect(mocks.setPosition).toHaveBeenCalledOnce();
        expect(mocks.openMenuPanel).not.toHaveBeenCalled();
    });

    it("opens the complete edit panel and clears the old menu when no panel can be refreshed", () => {
        const blockElement = createTableBlock();
        const protyle = {} as IProtyle;

        addAttrViewColAnimation({
            blockElement,
            protyle,
            panel: createPanel(),
            type: "number",
            name: "Amount",
            id: "new-id",
            previousID: "previous-id",
        });

        expect(mocks.openMenuPanel).toHaveBeenCalledWith({
            protyle,
            blockElement,
            type: "edit",
            colId: "new-id",
            editData: {
                previousID: "previous-id",
                colData: {type: "number", id: "new-id", name: "Amount"},
            },
        });
        expect(mocks.removeSiyuanMenu).toHaveBeenCalledOnce();
    });
});
