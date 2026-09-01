import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";

describe("AI provider feedback security", () => {
    it("keeps the mobile compatibility owner from inserting provider responses as HTML", () => {
        const source = readFileSync("src/config/tabs/aiUi.ts", "utf8");

        expect(source).toContain('import {escapeHtml} from "../../util/DOM/escape";');
        expect(source.match(/escapeHtml\(String\(data\.msg\)\)/g)).toHaveLength(5);
        expect(source).toContain('available.slice(0, 10).map((item) => escapeHtml(String(item))).join(", ")');
    });
});
