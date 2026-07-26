import {describe, expect, it} from "vitest";
import {isCustomAttributeCell} from "../../../src/protyle/render/av/customAttr/identity";

describe("AV custom attribute cell identity", () => {
    it("requires a non-empty data-av-id attribute", () => {
        const cell = document.createElement("div");
        expect(isCustomAttributeCell(cell)).toBe(false);

        cell.setAttribute("data-av-id", "");
        expect(isCustomAttributeCell(cell)).toBe(false);

        cell.setAttribute("data-av-id", "av-id");
        expect(isCustomAttributeCell(cell)).toBe(true);
    });
});
