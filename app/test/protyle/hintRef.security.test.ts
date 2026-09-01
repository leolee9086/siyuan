import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";

describe("split hint reference security", () => {
    it("escapes highlighted names and custom AV reference text before HTML insertion", () => {
        const source = readFileSync("src/protyle/hint/extend.hintRef.ts", "utf8");

        expect(source).toContain('import {escapeHtml, escapeSearchHighlight, stripSearchMark} from "../../util/DOM/escape";');
        expect(source).toContain('item.name ? stripSearchMark(escapeSearchHighlight(item.name))');
        expect(source).toContain('escapeHtml(item.ial["custom-sy-av-s-text-" + nodeElement.getAttribute("data-av-id")] || "") || avRefText');
    });
});
