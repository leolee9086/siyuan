import {beforeEach, describe, expect, it, vi} from "vitest";

const runtime = vi.hoisted(() => ({
    updateTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/update", () => ({
    updateTransaction: runtime.updateTransaction,
}));
vi.mock("../../src/protyle/util/selection", () => ({
    focusByRange: vi.fn(),
    focusByWbr: vi.fn(),
}));
vi.mock("../../src/protyle/wysiwyg/remove", () => ({removeBlock: vi.fn()}));
vi.mock("../../src/protyle/util/table/table.helpers", () => ({scrollToView: vi.fn()}));
vi.mock("../../src/util/DOM/highlightById", () => ({scrollCenter: vi.fn()}));

import {insertColumn} from "../../src/protyle/util/table/column";
import {insertRow} from "../../src/protyle/util/table/table.row";
import {setTableAlign} from "../../src/protyle/util/table/table";

const createTableFixture = () => {
    const block = document.createElement("div");
    block.dataset.nodeId = "table-block";
    block.innerHTML = "<div><table><colgroup><col></colgroup><tbody><tr><td>A</td></tr></tbody></table></div>";
    const cell = block.querySelector("td");
    if (!(cell instanceof HTMLTableCellElement)) {
        throw new Error("table fixture did not create a cell");
    }
    const range = document.createRange();
    range.selectNodeContents(cell);
    return {block, cell, range};
};

const snapshotWithLeadingWbr = (block: HTMLElement) => {
    const snapshot = block.cloneNode(true);
    if (!(snapshot instanceof HTMLElement)) {
        throw new Error("table fixture clone did not preserve HTMLElement identity");
    }
    const cell = snapshot.querySelector("td");
    if (!(cell instanceof HTMLTableCellElement)) {
        throw new Error("table fixture clone did not preserve its cell");
    }
    cell.prepend(document.createElement("wbr"));
    return snapshot.outerHTML;
};

describe("table transaction contract", () => {
    const protyle = Object.assign({} as IProtyle, {});

    beforeEach(() => {
        runtime.updateTransaction.mockReset();
    });

    it("submits alignment through the block element and its previous snapshot", () => {
        const {block, cell, range} = createTableFixture();
        const previousSnapshot = snapshotWithLeadingWbr(block);

        setTableAlign(protyle, [cell], block, "center", range);

        expect(runtime.updateTransaction).toHaveBeenCalledWith(
            protyle,
            block,
            previousSnapshot,
        );
    });

    it("delegates missing block identity validation instead of silently skipping the transaction", () => {
        const {block, cell, range} = createTableFixture();
        block.removeAttribute("data-node-id");
        const previousSnapshot = snapshotWithLeadingWbr(block);

        setTableAlign(protyle, [cell], block, "center", range);

        expect(runtime.updateTransaction).toHaveBeenCalledWith(
            protyle,
            block,
            previousSnapshot,
        );
    });

    it("submits column insertion through the same element-based contract", () => {
        const {block, cell, range} = createTableFixture();

        insertColumn(protyle, block, cell, "afterend", range);

        expect(runtime.updateTransaction).toHaveBeenCalledWith(
            protyle,
            block,
            expect.stringContaining("<table>"),
        );
    });

    it("submits row insertion through the same element-based contract", () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "table-block";
        block.innerHTML = "<div><table><thead><tr><th>A</th></tr></thead><tbody></tbody></table></div>";
        const cell = block.querySelector("th");
        if (!(cell instanceof HTMLTableCellElement)) {
            throw new Error("table fixture did not create a heading cell");
        }
        const tbody = block.querySelector("tbody");
        if (!(tbody instanceof HTMLTableSectionElement)) {
            throw new Error("table fixture did not create a body");
        }
        vi.spyOn(tbody, "insertAdjacentHTML").mockImplementation(() => {
            const row = document.createElement("tr");
            row.append(document.createElement("td"));
            tbody.prepend(row);
        });
        const range = document.createRange();
        range.selectNodeContents(cell);

        insertRow(protyle, range, cell, block);

        expect(runtime.updateTransaction).toHaveBeenCalledWith(
            protyle,
            block,
            expect.stringContaining("<table>"),
        );
    });
});
