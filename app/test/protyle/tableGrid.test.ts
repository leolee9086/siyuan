import {describe, expect, it} from "vitest";

import {buildTableGrid, getTableRangeBounds, getTableRangeCells} from "../../src/protyle/util/table/grid";
import {getTableRangeHTML} from "../../src/protyle/util/table/grid/html";

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

    it("rebuilds a merged tbody range as a valid independent table", () => {
        const table = createMergedTable();
        const cellC = getCellByText(table, "C");
        const cellE = getCellByText(table, "E");

        expect(getTableRangeHTML(table, cellC, cellE)).toBe(
            '<table><colgroup><col style=\'min-width: 60px;\'><col style=\'min-width: 60px;\'></colgroup><thead><tr><th class="" rowspan="2">C</th><th class="">D</th></tr><tr><th class="fn__none"></th><th class="">E</th></tr></thead></table>'
        );
    });

    it("preserves source colgroup styles when cloning selected columns", () => {
        const host = document.createElement("div");
        host.innerHTML = `<table><colgroup><col style="width: 120px; min-width: 60px;"><col style="width: 80px;"><col style="min-width: 100px;"></colgroup><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead><tbody><tr><td>A1</td><td>B1</td><td>C1</td></tr></tbody></table>`;
        const table = host.querySelector("table") as HTMLTableElement;
        const cellB = Array.from(table.querySelectorAll<HTMLTableCellElement>("th, td")).find(item => item.textContent === "B")!;
        const cellC = Array.from(table.querySelectorAll<HTMLTableCellElement>("th, td")).find(item => item.textContent === "C")!;
        const html = getTableRangeHTML(table, cellB, cellC);
        expect(html).toContain('<col style="width: 80px;">');
        expect(html).toContain('<col style="min-width: 100px;">');
        expect(html).not.toContain('width: 120px');
        expect(html).toContain("<colgroup>");
        expect(html.indexOf("<colgroup>")).toBeLessThan(html.indexOf("<thead>"));
    });

    it("falls back to default col when source colgroup is missing or partial", () => {
        const host = document.createElement("div");
        host.innerHTML = `<table><colgroup><col style="width: 200px;"></colgroup><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>A1</td><td>B1</td></tr></tbody></table>`;
        const table = host.querySelector("table") as HTMLTableElement;
        const cellA = Array.from(table.querySelectorAll<HTMLTableCellElement>("th, td")).find(item => item.textContent === "A")!;
        const cellB = Array.from(table.querySelectorAll<HTMLTableCellElement>("th, td")).find(item => item.textContent === "B")!;
        const html = getTableRangeHTML(table, cellA, cellB);
        expect(html).toContain('<col style="width: 200px;">');
        expect(html).toContain("<col style='min-width: 60px;'>");
    });

    it("returns empty HTML when a range endpoint is outside the source table", () => {
        const table = createMergedTable();
        const cellC = getCellByText(table, "C");
        const externalCell = document.createElement("td");

        expect(getTableRangeHTML(table, cellC, externalCell)).toBe("");
    });
});
