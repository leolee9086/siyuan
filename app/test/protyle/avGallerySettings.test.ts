import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    addItem: vi.fn(),
    addSeparator: vi.fn(),
    menuOpen: vi.fn(),
    submitAVGallerySettingTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/render/av/gallery/settings/imports", () => ({
    Constants: {CUSTOM_SY_AV_VIEW: "custom-sy-av-view"},
    Menu: class {
        addItem = mocks.addItem;
        addSeparator = mocks.addSeparator;
        open = mocks.menuOpen;
    },
    getColIconByType: vi.fn(() => "iconAsset"),
    siyuanI18n: {
        calcOperatorNone: "None",
        contentBlock: "Block",
        contentImage: "Image",
        large: "Large",
        medium: "Medium",
        small: "Small",
    },
    submitAVGallerySettingTransaction: mocks.submitAVGallerySettingTransaction,
    unicode2Emoji: vi.fn((value: string) => value),
}));

import {setGalleryCover} from "../../src/protyle/render/av/gallery/settings/cover";
import {setGalleryRatio} from "../../src/protyle/render/av/gallery/settings/ratio";
import {getCardAspectRatio} from "../../src/protyle/render/av/gallery/style";
import {setGallerySize} from "../../src/protyle/render/av/gallery/settings/size";

const createElements = () => {
    const nodeElement = document.createElement("div");
    nodeElement.setAttribute("data-av-id", "av-id");
    nodeElement.setAttribute("data-node-id", "block-id");
    nodeElement.setAttribute("custom-sy-av-view", "view-id");
    const target = document.createElement("button");
    target.innerHTML = '<span class="b3-menu__accelerator">Current</span>';
    target.getBoundingClientRect = vi.fn(() => ({bottom: 80, left: 30}) as DOMRect);
    return {nodeElement, target};
};

const createView = () => ({
    cardAspectRatio: 0,
    cardSize: 0,
    coverFrom: 3,
    coverFromAssetKeyID: "old-asset",
    fields: [
        {id: "title", name: "Title", type: "block"},
        {id: "asset", name: "Asset", type: "mAsset"},
    ],
}) as IAVGallery;

describe("AV gallery settings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("keeps built-in cover sources before asset fields and commits the click-time undo value", () => {
        const {nodeElement, target} = createElements();
        const view = createView();
        const protyle = {} as IProtyle;

        setGalleryCover({view, nodeElement, protyle, target});

        expect(mocks.addItem.mock.calls.map(call => call[0].label)).toEqual(["None", "Block", "Image", "Asset"]);
        expect(mocks.addSeparator).toHaveBeenCalledTimes(1);
        const assetItem = mocks.addItem.mock.calls[3][0] as {click: () => void};
        assetItem.click();

        expect(mocks.submitAVGallerySettingTransaction).toHaveBeenCalledWith(protyle, [{
            action: "setAttrViewCoverFrom",
            avID: "av-id",
            blockID: "block-id",
            data: 2,
        }, {
            action: "setAttrViewCoverFromAssetKeyID",
            avID: "av-id",
            blockID: "block-id",
            keyID: "asset",
        }], [{
            action: "setAttrViewCoverFrom",
            avID: "av-id",
            blockID: "block-id",
            data: 3,
        }, {
            action: "setAttrViewCoverFromAssetKeyID",
            avID: "av-id",
            blockID: "block-id",
            keyID: "old-asset",
        }]);
        expect(view.coverFrom).toBe(2);
        expect(view.coverFromAssetKeyID).toBe("asset");
        expect(target.querySelector(".b3-menu__accelerator")?.textContent).toBe("Asset");
        expect(mocks.menuOpen).toHaveBeenCalledWith({x: 30, y: 80});
    });

    it("updates card width after submitting the exact previous value", () => {
        const {nodeElement, target} = createElements();
        const view = createView();
        view.cardSize = 2;
        const protyle = {} as IProtyle;

        setGallerySize({view, nodeElement, protyle, target});
        const mediumItem = mocks.addItem.mock.calls[1][0] as {click: () => void};
        mediumItem.click();

        expect(mocks.submitAVGallerySettingTransaction).toHaveBeenCalledWith(protyle, [{
            action: "setAttrViewCardWidth",
            avID: "av-id",
            blockID: "block-id",
            data: 260,
            viewID: "view-id",
        }], [{
            action: "setAttrViewCardWidth",
            avID: "av-id",
            blockID: "block-id",
            data: 320,
            viewID: "view-id",
        }]);
        expect(view.cardWidth).toBe(260);
        expect(target.querySelector(".b3-menu__accelerator")?.textContent).toBe("260px");
    });

    it("preserves all ratio labels and updates the selected ratio", () => {
        const {nodeElement, target} = createElements();
        const view = createView();
        view.cardAspectRatio = 6;
        const protyle = {} as IProtyle;

        expect([-1, 0, 1, 2, 3, 4, 5, 6, 7].map(getCardAspectRatio))
            .toEqual(["16:9", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "1:1", "16:9"]);
        setGalleryRatio({view, nodeElement, protyle, target});
        const ratioItem = mocks.addItem.mock.calls[4][0] as {click: () => void};
        ratioItem.click();

        expect(mocks.submitAVGallerySettingTransaction).toHaveBeenCalledWith(protyle, [{
            action: "setAttrViewCardAspectRatioValue",
            avID: "av-id",
            blockID: "block-id",
            data: 1.5,
            viewID: "view-id",
        }], [{
            action: "setAttrViewCardAspectRatioValue",
            avID: "av-id",
            blockID: "block-id",
            data: 1,
            viewID: "view-id",
        }]);
        expect(view.cardAspectRatioValue).toBe(1.5);
        expect(target.querySelector(".b3-menu__accelerator")?.textContent).toBe("1.50");
    });

    it("fails before menu creation when a view-scoped setting has no view identity", () => {
        const {nodeElement, target} = createElements();
        nodeElement.removeAttribute("custom-sy-av-view");

        expect(() => setGallerySize({view: createView(), nodeElement, protyle: {} as IProtyle, target}))
            .toThrow("Gallery setting requires custom-sy-av-view");
        expect(mocks.addItem).not.toHaveBeenCalled();
        expect(mocks.submitAVGallerySettingTransaction).not.toHaveBeenCalled();
    });
});
