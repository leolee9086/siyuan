import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    submitAVColumnStructureTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/prepared/av/avColumnStructure", () => ({
    submitAVColumnStructureTransaction: mocks.submitAVColumnStructureTransaction,
}));

vi.mock("../../src/protyle/render/av/row", () => ({insertAttrViewBlockAnimation: vi.fn()}));
vi.mock("../../src/protyle/render/av/gallery/item", () => ({insertGalleryItemAnimation: vi.fn()}));

import {handleAvCellDrop, resolveColId} from "../../src/protyle/util/dnd/onDrop.helper.avDrop";

describe("AV column ordering", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = "";
    });

    it("resolves the last pinned column as the previous column", () => {
        const sticky = document.createElement("div");
        sticky.className = "av__colsticky";
        sticky.innerHTML = '<div data-col-id="first"></div><div data-col-id="last"></div>';

        expect(resolveColId(sticky)).toBe("last");
        expect(resolveColId(null)).toBe("");
    });

    it("submits exact do and undo positions derived from the live row", async () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "block-id";
        block.dataset.avId = "av-id";
        block.dataset.type = "NodeAttributeView";
        block.innerHTML = `
            <div class="av__row">
                <div data-col-id="first"></div>
                <div data-col-id="dragged"></div>
                <div data-col-id="target"></div>
            </div>`;
        document.body.append(block);
        const target = block.querySelector('[data-col-id="target"]') as HTMLElement;
        const protyle = {} as IProtyle;

        await handleAvCellDrop(protyle, target, ["dragover__right"], "dragged");

        expect(mocks.submitAVColumnStructureTransaction).toHaveBeenCalledWith(protyle, [{
            action: "sortAttrViewCol", avID: "av-id", previousID: "target", id: "dragged", blockID: "block-id",
        }], [{
            action: "sortAttrViewCol", avID: "av-id", previousID: "first", id: "dragged", blockID: "block-id",
        }]);
    });

    it("does not submit when the requested position is unchanged", async () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "block-id";
        block.dataset.avId = "av-id";
        block.dataset.type = "NodeAttributeView";
        block.innerHTML = '<div class="av__row"><div data-col-id="first"></div><div data-col-id="dragged"></div></div>';
        document.body.append(block);
        const dragged = block.querySelector('[data-col-id="dragged"]') as HTMLElement;

        await handleAvCellDrop({} as IProtyle, dragged, ["dragover__left"], "dragged");

        expect(mocks.submitAVColumnStructureTransaction).not.toHaveBeenCalled();
    });
});
