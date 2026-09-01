import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    getFieldsByData: vi.fn(),
    submitAVLayoutSettingTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/av/view/avLayout", () => ({
    submitAVLayoutSettingTransaction: mocks.submitAVLayoutSettingTransaction,
}));

vi.mock("../../src/protyle/render/av/view/metadata", () => ({
    getFieldsByData: mocks.getFieldsByData,
}));

vi.mock("../../src/util/siyuanEnvironments/i18n.getI18n.environment", () => ({
    siyuanI18n: {},
}));

import {bindLayoutEvent} from "../../src/protyle/render/av/layout";

const createBlockElement = () => {
    const blockElement = document.createElement("div");
    blockElement.setAttribute("data-av-id", "av-id");
    blockElement.setAttribute("data-node-id", "block-id");
    blockElement.setAttribute("custom-sy-av-view", "view-id");
    blockElement.innerHTML = '<div class="av__views"></div>';
    return blockElement;
};

const createMenuElement = (includeCardToggles = false, includeKanbanToggle = false) => {
    const menuElement = document.createElement("div");
    menuElement.innerHTML = `
        <input class="b3-switch" data-type="toggle-view-title" type="checkbox" checked>
        <input class="b3-switch" data-type="toggle-entries-icons" type="checkbox">
        <input class="b3-switch" data-type="toggle-entries-wrap" type="checkbox">
        ${includeCardToggles ? '<input class="b3-switch" data-type="toggle-gallery-fit" type="checkbox"><input class="b3-switch" data-type="toggle-gallery-name" type="checkbox">' : ""}
        ${includeKanbanToggle ? '<input class="b3-switch" data-type="toggle-kanban-bg" type="checkbox">' : ""}
    `;
    return menuElement;
};

const changeChecked = (menuElement: HTMLElement, type: string, checked: boolean) => {
    const input = menuElement.querySelector(`[data-type="${type}"]`) as HTMLInputElement;
    input.checked = checked;
    input.dispatchEvent(new Event("change"));
};

describe("AV layout bindings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(window, {
            siyuan: {
                languages: new Proxy({}, {
                    get: (_target, key) => String(key),
                }),
            },
        });
    });

    it("commits common view toggles and updates the same view and field objects", () => {
        const fields = [{id: "field-a", wrap: false}, {id: "field-b", wrap: false}] as IAVColumn[];
        mocks.getFieldsByData.mockReturnValue(fields);
        const data = {
            viewType: "table",
            view: {hideAttrViewName: false, showIcon: false, wrapField: false},
        } as IAV;
        const protyle = {} as IProtyle;
        const menuElement = createMenuElement();

        bindLayoutEvent({protyle, data, menuElement, blockElement: createBlockElement()});
        changeChecked(menuElement, "toggle-view-title", false);
        changeChecked(menuElement, "toggle-entries-icons", true);
        changeChecked(menuElement, "toggle-entries-wrap", true);

        expect(mocks.submitAVLayoutSettingTransaction.mock.calls).toEqual([
            [protyle, [{action: "hideAttrViewName", avID: "av-id", blockID: "block-id", data: true, viewID: "view-id"}], [{action: "hideAttrViewName", avID: "av-id", blockID: "block-id", data: false, viewID: "view-id"}]],
            [protyle, [{action: "setAttrViewShowIcon", avID: "av-id", blockID: "block-id", data: true, viewID: "view-id"}], [{action: "setAttrViewShowIcon", avID: "av-id", blockID: "block-id", data: false, viewID: "view-id"}]],
            [protyle, [{action: "setAttrViewWrapField", avID: "av-id", blockID: "block-id", data: true, viewID: "view-id"}], [{action: "setAttrViewWrapField", avID: "av-id", blockID: "block-id", data: false, viewID: "view-id"}]],
        ]);
        expect(data.view.hideAttrViewName).toBe(true);
        expect(data.view.showIcon).toBe(true);
        expect(data.view.wrapField).toBe(true);
        expect(fields.map(field => field.wrap)).toEqual([true, true]);
    });

    it("commits gallery-only image and field-name toggles", () => {
        mocks.getFieldsByData.mockReturnValue([]);
        const data = {
            viewType: "gallery",
            view: {
                coverFrom: 0,
                displayFieldName: false,
                fields: [],
                fitImage: false,
            },
        } as IAV;
        const protyle = {} as IProtyle;
        const menuElement = createMenuElement(true);

        bindLayoutEvent({protyle, data, menuElement, blockElement: createBlockElement()});
        changeChecked(menuElement, "toggle-gallery-fit", true);
        changeChecked(menuElement, "toggle-gallery-name", true);

        expect(mocks.submitAVLayoutSettingTransaction.mock.calls.slice(-2)).toEqual([
            [protyle, [{action: "setAttrViewFitImage", avID: "av-id", blockID: "block-id", data: true, viewID: "view-id"}], [{action: "setAttrViewFitImage", avID: "av-id", blockID: "block-id", data: false, viewID: "view-id"}]],
            [protyle, [{action: "setAttrViewDisplayFieldName", avID: "av-id", blockID: "block-id", data: true, viewID: "view-id"}], [{action: "setAttrViewDisplayFieldName", avID: "av-id", blockID: "block-id", data: false, viewID: "view-id"}]],
        ]);
        expect((data.view as IAVGallery).fitImage).toBe(true);
        expect((data.view as IAVGallery).displayFieldName).toBe(true);
    });

    it("commits the kanban background toggle", () => {
        mocks.getFieldsByData.mockReturnValue([]);
        const data = {
            viewType: "kanban",
            view: {displayFieldName: false, fillColBackgroundColor: false, fitImage: false},
        } as IAV;
        const protyle = {} as IProtyle;
        const menuElement = createMenuElement(true, true);

        bindLayoutEvent({protyle, data, menuElement, blockElement: createBlockElement()});
        changeChecked(menuElement, "toggle-kanban-bg", true);

        expect(mocks.submitAVLayoutSettingTransaction).toHaveBeenLastCalledWith(protyle, [{
            action: "setAttrViewFillColBackgroundColor",
            avID: "av-id",
            blockID: "block-id",
            data: true,
            viewID: "view-id",
        }], [{
            action: "setAttrViewFillColBackgroundColor",
            avID: "av-id",
            blockID: "block-id",
            data: false,
            viewID: "view-id",
        }]);
        expect((data.view as IAVKanban).fillColBackgroundColor).toBe(true);
    });
});
