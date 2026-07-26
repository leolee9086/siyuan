import {describe, expect, it} from "vitest";

import {mergeAddOption} from "../../../src/protyle/render/av/select/options";

describe("AV select option merge", () => {
    it("reuses the configured color without emitting column operations", () => {
        const column = {
            id: "column-id",
            options: [{name: "Existing", color: "8"}],
        } as IAVColumn;
        const cellValue = {
            mSelect: [{content: "Existing", color: "1"}],
        } as IAVCellValue;

        expect(mergeAddOption(column, cellValue, "av-id")).toEqual({doOperations: [], undoOperations: []});
        expect(cellValue.mSelect[0].color).toBe("8");
        expect(column.options).toEqual([{name: "Existing", color: "8"}]);
    });

    it("appends missing values in source order and builds reversible operations", () => {
        const column = {id: "column-id", options: [{name: "Existing", color: "8"}]} as IAVColumn;
        const cellValue = {
            mSelect: [
                {content: "First", color: ""},
                {content: "Second", color: ""},
            ],
        } as IAVCellValue;

        const operations = mergeAddOption(column, cellValue, "av-id");

        expect(column.options).toEqual([
            {name: "Existing", color: "8"},
            {name: "First", color: "2"},
            {name: "Second", color: "3"},
        ]);
        expect(cellValue.mSelect.map(item => item.color)).toEqual(["2", "3"]);
        expect(operations.undoOperations).toEqual([
            {action: "removeAttrViewColOption", id: "column-id", avID: "av-id", data: "First"},
            {action: "removeAttrViewColOption", id: "column-id", avID: "av-id", data: "Second"},
        ]);
        expect(operations.doOperations).toHaveLength(2);
        expect(operations.doOperations[1]).toMatchObject({
            action: "updateAttrViewColOptions",
            id: "column-id",
            avID: "av-id",
            data: column.options,
        });
    });
});
