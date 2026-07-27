import {beforeEach, describe, expect, it, vi} from "vitest";

vi.stubGlobal("Lute", {NewNodeID: () => "generated-id"});

import {
    genSBElement,
    getSbChildCount,
    refreshSbAndPersistWidth,
    refreshSbResize,
} from "../../src/block/superBlock";

describe("super block DOM domain", () => {
    beforeEach(() => document.body.replaceChildren());

    it("creates a complete super block and counts only real child blocks", () => {
        const superBlock = genSBElement("col", "super-id", '<div class="protyle-attr"></div>');
        superBlock.insertAdjacentHTML("afterbegin", '<div data-node-id="a"></div><span class="sb__resize"></span>');

        expect(superBlock.dataset.nodeId).toBe("super-id");
        expect(superBlock.dataset.type).toBe("NodeSuperBlock");
        expect(getSbChildCount(superBlock)).toBe(1);
    });

    it("keeps one resize handle between each pair of column children", () => {
        const superBlock = genSBElement("col", "super-id", "");
        superBlock.innerHTML = '<div data-node-id="a"></div><div data-node-id="b"></div><div data-node-id="c"></div>';

        refreshSbResize(superBlock);
        refreshSbResize(superBlock);

        expect(superBlock.querySelectorAll(":scope > .sb__resize")).toHaveLength(2);
        expect(Array.from(superBlock.children).map(item => item.className || item.getAttribute("data-node-id")))
            .toEqual(["a", "sb__resize", "b", "sb__resize", "c"]);
    });

    it("records width updates and prepends undo operations in mutation order", () => {
        const superBlock = genSBElement("col", "super-id", "");
        superBlock.innerHTML = '<div data-node-id="a" style="width: calc(60% - 10px)"></div><div data-node-id="b" style="width: calc(40% - 10px)"></div>';
        document.body.append(superBlock);
        const doOperations: IOperation[] = [];
        const undoOperations: IOperation[] = [{action: "update", id: "existing", data: "existing"}];

        refreshSbAndPersistWidth(superBlock, doOperations, undoOperations);

        expect(doOperations.map(item => item.id)).toEqual(["a", "b"]);
        expect(undoOperations.map(item => item.id)).toEqual(["b", "a", "existing"]);
        expect(doOperations.every(item => item.data.includes("style="))).toBe(true);
    });
});
