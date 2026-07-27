import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    focusBlock: vi.fn(),
    submitAVViewTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/av/view/avView", () => ({
    submitAVViewTransaction: mocks.submitAVViewTransaction,
}));

vi.mock("../../src/util/siyuanEnvironments/i18n.getI18n.environment", () => ({
    siyuanI18n: {addDesc: "Add description"},
}));

vi.mock("../../src/protyle/util/selection", () => ({
    focusBlock: mocks.focusBlock,
}));

import {bindSwitcherEvent, bindViewEvent} from "../../src/protyle/render/av/view";

describe("AV view bindings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("submits name and description edits with the exact previous dataset values", () => {
        const menuElement = document.createElement("div");
        menuElement.innerHTML = `
            <input class="b3-text-field" data-type="name" data-value="Old name">
            <svg class="info"></svg>
            <div class="fn__none"><textarea class="b3-text-field" data-type="desc" data-value="Old desc">Old desc</textarea></div>
        `;
        const data = {id: "av-id", viewID: "view-id"} as IAV;
        const protyle = {} as IProtyle;

        bindViewEvent({protyle, data, menuElement, blockElement: document.createElement("div")});
        const nameInput = menuElement.querySelector('[data-type="name"]') as HTMLInputElement;
        const descInput = menuElement.querySelector('[data-type="desc"]') as HTMLTextAreaElement;
        nameInput.value = "New name";
        nameInput.dispatchEvent(new Event("blur"));
        descInput.value = "New desc";
        descInput.dispatchEvent(new Event("input"));
        descInput.dispatchEvent(new Event("blur"));

        expect(mocks.submitAVViewTransaction.mock.calls).toEqual([
            [protyle, [{action: "setAttrViewViewName", avID: "av-id", id: "view-id", data: "New name"}], [{action: "setAttrViewViewName", avID: "av-id", id: "view-id", data: "Old name"}]],
            [protyle, [{action: "setAttrViewViewDesc", avID: "av-id", id: "view-id", data: "New desc"}], [{action: "setAttrViewViewDesc", avID: "av-id", id: "view-id", data: "Old desc"}]],
        ]);
        expect(nameInput.dataset.value).toBe("New name");
        expect(descInput.dataset.value).toBe("New desc");
        expect(nameInput.nextElementSibling?.getAttribute("aria-label")).toBe("New desc");
    });

    it("submits the selected switcher view before removing the menu and restoring focus", () => {
        const menuElement = document.createElement("div");
        menuElement.innerHTML = `
            <input class="b3-text-field">
            <div class="fn__flex-1"><button class="b3-menu__item b3-menu__item--current" data-id="next-view"></button></div>
        `;
        const blockElement = document.createElement("div");
        blockElement.setAttribute("data-av-id", "av-id");
        blockElement.setAttribute("data-node-id", "block-id");
        blockElement.innerHTML = '<div class="av__views"><span class="item--focus" data-id="current-view"></span></div>';
        document.body.append(menuElement);
        const protyle = {} as IProtyle;

        bindSwitcherEvent({protyle, menuElement, blockElement});
        const input = menuElement.querySelector("input") as HTMLInputElement;
        input.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter"}));

        expect(mocks.submitAVViewTransaction).toHaveBeenCalledWith(protyle, [{
            action: "setAttrViewBlockView", blockID: "block-id", id: "next-view", avID: "av-id",
        }], [{
            action: "setAttrViewBlockView", blockID: "block-id", id: "current-view", avID: "av-id",
        }]);
        expect(menuElement.isConnected).toBe(false);
        expect(mocks.focusBlock).toHaveBeenCalledWith(blockElement);
    });
});
