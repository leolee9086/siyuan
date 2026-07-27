import {beforeEach, describe, expect, it} from "vitest";
import {removeAttrViewColPresentation} from "../../../src/protyle/render/av/col/structure/presentation";

beforeEach(() => {
    document.body.innerHTML = "";
});

describe("remove column presentation", () => {
    it("removes every matching column cell and preserves unrelated cells", () => {
        const blockElement = document.createElement("div");
        blockElement.innerHTML = `
            <div class="av__cell" data-col-id="keep"></div>
            <div class="av__cell" data-col-id="remove"></div>
            <div class="av__cell" data-col-id="remove"></div>`;

        removeAttrViewColPresentation(blockElement, "remove");

        expect(blockElement.querySelectorAll('[data-col-id="remove"]')).toHaveLength(0);
        expect(blockElement.querySelectorAll('[data-col-id="keep"]')).toHaveLength(1);
    });

    it("leaves the DOM unchanged when the column is absent", () => {
        const blockElement = document.createElement("div");
        blockElement.innerHTML = '<div class="av__cell" data-col-id="keep"></div>';

        removeAttrViewColPresentation(blockElement, "missing");

        expect(blockElement.innerHTML).toBe('<div class="av__cell" data-col-id="keep"></div>');
    });
});
