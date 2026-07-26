import {describe, expect, it} from "vitest";

import {buildTableGrid, getTableRangeBounds, getTableRangeCells} from "../../src/protyle/util/table/grid";

const createMergedTable = () => {
    const host = document.createElement("div");
    host.innerHTML = `<table>
<thead><tr><th>A</th><th>B</th></tr></thead>
<tbody>
<tr><td rowspan="2">C</td><td>D</td></tr>
<tr><td class="fn__none"></td><td>E</td></tr>
</tbody>
</table>`;
    const table = host.querySelector("table");
    if (!(table instanceof HTMLTableElement)) {
        throw new Error("table grid fixture did not create an HTMLTableElement");
    }
    return table;
};

const getCellByText = (table: HTMLTableElement, text: string) => {
    const cell = Array.from(table.querySelectorAll<HTMLTableCellElement>("th, td"))
        .find(item => item.textContent === text);
    if (!cell) {
        throw new Error(`table grid fixture is missing cell ${text}`);
    }
    return cell;
};

describe("table grid", () => {
    it("maps physical cells while excluding merged placeholders", () => {
        const table = createMergedTable();
        const cells = Array.from(table.querySelectorAll<HTMLTableCellElement>("th, td:not(.fn__none)"));

        expect(getTableRangeCells(table).map(item => ({text: item.cell.textContent, row: item.row, col: item.col}))).toEqual([
            {text: "A", row: 0, col: 0},
            {text: "B", row: 0, col: 1},
            {text: "C", row: 1, col: 0},
            {text: "D", row: 1, col: 1},
            {text: "E", row: 2, col: 1},
        ]);
        expect(cells).toHaveLength(5);
    });

    it("projects reverse merged ranges relative to their top-left corner", () => {
        const table = createMergedTable();
        const cellC = getCellByText(table, "C");
        const cellE = getCellByText(table, "E");

        expect(getTableRangeCells(table, cellE, cellC).map(item => ({text: item.cell.textContent, row: item.row, col: item.col}))).toEqual([
            {text: "C", row: 0, col: 0},
            {text: "D", row: 0, col: 1},
            {text: "E", row: 1, col: 1},
        ]);
    });

    it("rejects endpoints outside the table and clamps historical row spans", () => {
        const table = createMergedTable();
        const cellC = getCellByText(table, "C");
        cellC.setAttribute("rowspan", "99");
        const externalCell = document.createElement("td");
        const tableGrid = buildTableGrid(table);

        expect(getTableRangeBounds(tableGrid, cellC, externalCell)).toBeUndefined();
        expect(getTableRangeCells(table, cellC, externalCell)).toEqual([]);
        expect(getTableRangeBounds(tableGrid, cellC, cellC)?.rowEnd).toBe(2);
    });
});
