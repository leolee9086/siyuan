import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    removePresentation: vi.fn(),
    submit: vi.fn(),
}));

vi.mock("../../../src/protyle/render/av/col/structure/imports", () => ({
    dayjs: () => ({format: () => "20260727010101"}),
    submitAVColumnStructureTransaction: mocks.submit,
}));

vi.mock("../../../src/protyle/render/av/col/structure/presentation", () => ({
    removeAttrViewColPresentation: mocks.removePresentation,
}));

import {removeColByMenu} from "../../../src/protyle/render/av/col/structure/removeByMenu";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("remove column by menu", () => {
    it("preserves the complete transaction and local presentation order", () => {
        const blockElement = document.createElement("div");
        blockElement.setAttribute("updated", "old-updated");
        const previousCell = document.createElement("div");
        previousCell.dataset.colId = "previous-id";
        const cellElement = document.createElement("div");
        blockElement.append(previousCell, cellElement);
        const setAttribute = vi.spyOn(blockElement, "setAttribute");
        const protyle = {} as IProtyle;

        removeColByMenu({
            protyle,
            colId: "column-id",
            avID: "av-id",
            blockID: "block-id",
            oldValue: "Column",
            type: "number",
            cellElement,
            blockElement,
            removeDest: true,
        });

        expect(mocks.submit).toHaveBeenCalledWith(protyle, [{
            action: "removeAttrViewCol",
            id: "column-id",
            avID: "av-id",
            removeDest: true,
        }, {
            action: "doUpdateUpdated",
            id: "block-id",
            data: "20260727010101",
        }], [{
            action: "addAttrViewCol",
            name: "Column",
            avID: "av-id",
            type: "number",
            id: "column-id",
            previousID: "previous-id",
        }, {
            action: "doUpdateUpdated",
            id: "block-id",
            data: "old-updated",
        }]);
        expect(mocks.removePresentation).toHaveBeenCalledWith(blockElement, "column-id");
        expect(setAttribute).toHaveBeenCalledWith("updated", "20260727010101");
        const submitOrder = mocks.submit.mock.invocationCallOrder.reduce(first => first);
        const presentationOrder = mocks.removePresentation.mock.invocationCallOrder.reduce(first => first);
        const updatedOrder = setAttribute.mock.invocationCallOrder.reduce(first => first);
        expect(submitOrder).toBeLessThan(presentationOrder);
        expect(presentationOrder).toBeLessThan(updatedOrder);
    });
});
