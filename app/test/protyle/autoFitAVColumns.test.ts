import {beforeEach, describe, expect, it, vi} from "vitest";
import {Constants} from "../../src/constants";

const mocks = vi.hoisted(() => ({
    getAVData: vi.fn(),
    getAVColumnTextMeasurer: vi.fn(),
    getAVTableFitWidths: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock("../../src/protyle/render/av/virtualScroll", () => ({
    getAVData: mocks.getAVData,
}));
vi.mock("../../src/protyle/render/av/cell", () => ({
    getCellValueText: vi.fn(),
}));
vi.mock("../../src/protyle/render/av/columnWidth", () => ({
    getAVColumnTextMeasurer: mocks.getAVColumnTextMeasurer,
    getAVTableFitWidths: mocks.getAVTableFitWidths,
}));
vi.mock("../../src/protyle/wysiwyg/transaction/submit", () => ({
    transaction: mocks.transaction,
}));

import {autoFitAVColumns} from "../../src/protyle/render/av/col/width";

const createBlockElement = () => {
    const blockElement = document.createElement("div");
    blockElement.dataset.avId = "av-id";
    blockElement.dataset.nodeId = "block-id";
    blockElement.setAttribute(Constants.CUSTOM_SY_AV_VIEW, "view-id");
    const headerElement = document.createElement("div");
    headerElement.className = "av__row--header";
    const firstColumnElement = document.createElement("div");
    firstColumnElement.className = "av__cell";
    firstColumnElement.dataset.colId = "first";
    firstColumnElement.style.width = "120px";
    const unchangedColumnElement = document.createElement("div");
    unchangedColumnElement.className = "av__cell";
    unchangedColumnElement.dataset.colId = "unchanged";
    unchangedColumnElement.style.width = "200px";
    headerElement.append(firstColumnElement, unchangedColumnElement);
    blockElement.append(headerElement);
    return blockElement;
};

describe("autoFitAVColumns split owner", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getAVColumnTextMeasurer.mockReturnValue(() => 0);
        mocks.getAVTableFitWidths.mockReturnValue({first: "180px", unchanged: "200px", missing: "240px"});
    });

    it("submits only changed rendered headers with undo widths", () => {
        const blockElement = createBlockElement();
        const protyle = {} as IProtyle;
        mocks.getAVData.mockReturnValue({
            viewType: "table",
            view: {columns: [], rows: []},
        });

        autoFitAVColumns(protyle, blockElement, ["first"]);

        expect(mocks.getAVTableFitWidths).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(Function),
            expect.any(Function),
            ["first"],
        );
        expect(mocks.transaction).toHaveBeenCalledWith(protyle, [{
            action: "setAttrViewColsWidth",
            avID: "av-id",
            blockID: "block-id",
            viewID: "view-id",
            data: {first: "180px"},
        }], [{
            action: "setAttrViewColsWidth",
            avID: "av-id",
            blockID: "block-id",
            viewID: "view-id",
            data: {first: "120px"},
        }]);
    });

    it("does not submit a transaction for non-table data", () => {
        mocks.getAVData.mockReturnValue({viewType: "gallery"});

        autoFitAVColumns({} as IProtyle, createBlockElement());

        expect(mocks.getAVTableFitWidths).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
});
