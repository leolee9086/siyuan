import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import {escapeAriaLabel} from "../DOM/escape";
import * as fs from "node:fs";
import * as path from "node:path";

describe("fileHtmlGenerator path-picker XSS (GHSA-jjq3-3942-x99r)", () => {
    it("escapeAriaLabel escapes quotes, apostrophes and tags for aria-label attribute", () => {
        const payload = "\"><img src=x onerror=alert(1)><svg/onload=alert(2)>";
        const escaped = escapeAriaLabel(payload);
        assert.equal(escaped.includes(payload), false);
        assert.ok(escaped.includes("&quot;"), "double quote must be escaped");
        const singlePayload = "'onmouseover='alert(1)";
        assert.ok(escapeAriaLabel(singlePayload).includes("&apos;"));
        assert.ok(escaped.includes("&amp;lt;img"), "< must be escaped to &amp;lt;");
        assert.ok(escapeAriaLabel("&lt;script>").includes("&amp;lt;script"));
    });

    it("fileHtmlGenerator.ts escapes bookmark/name1/alias/memo via escapeAriaLabel (upstream d1e0)", () => {
        const filePath = path.join(import.meta.dirname, "fileHtmlGenerator.ts");
        const content = fs.readFileSync(filePath, "utf-8");
        assert.ok(content.includes("import { escapeAriaLabel }") || content.includes("escapeAriaLabel"), "must import escapeAriaLabel");
        assert.ok(content.includes("escapeAriaLabel(item.bookmark)"), "bookmark must be escaped");
        assert.ok(content.includes("escapeAriaLabel(item.name1)"), "name1 must be escaped");
        assert.ok(content.includes("escapeAriaLabel(item.alias)"), "alias must be escaped");
        assert.ok(content.includes("escapeAriaLabel(item.memo)"), "memo must be escaped");
        assert.ok(content.includes("getDocDisplayName(item.name, item.titleEmpty, true)"), "must use getDocDisplayName with titleEmpty and escape=true");
        assert.equal(content.includes("getDisplayName(item.name, true, true)"), false, "old getDisplayName signature must not remain");
    });

    it("aria-label construction does not embed raw user payload (integration check)", () => {
        const mockI18n: Record<string, string> = {bookmark: "bookmark", name: "name", alias: "alias", memo: "memo", includeSubFile: "include x", modifiedAt: "modified", createdAt: "created"};
        const payload = "\"><img src=x onerror=alert(1)>";
        const item: {bookmark: string, name1: string, alias: string, memo: string, hSize: string, hMtime: string, hCtime: string, subFileCount: number, titleEmpty: boolean, name: string} = {name: "test.sy", titleEmpty: false, hSize: "1KB", bookmark: payload, name1: payload, alias: payload, memo: payload, hMtime: "2024-01-01", hCtime: "2024-01-01", subFileCount: 1};
        const displayName = "test";
        const parts = [
            `${displayName} <small>${item.hSize}</small>`,
            item.bookmark ? `<br>${mockI18n.bookmark} ${escapeAriaLabel(item.bookmark)}` : "",
            item.name1 ? `<br>${mockI18n.name} ${escapeAriaLabel(item.name1)}` : "",
            item.alias ? `<br>${mockI18n.alias} ${escapeAriaLabel(item.alias)}` : "",
            item.memo ? `<br>${mockI18n.memo} ${escapeAriaLabel(item.memo)}` : "",
        ];
        const ariaLabel = parts.join("");
        assert.equal(ariaLabel.includes(payload), false, "raw payload must not appear in aria-label");
        assert.ok(ariaLabel.includes("&quot;") && ariaLabel.includes("&amp;lt;img"));
    });
});
