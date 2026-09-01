import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";

describe("split Bazaar uninstall security", () => {
    it("escapes the package name supplied to the uninstall confirmation dialog", () => {
        const source = readFileSync("src/config/bazzar/bazaarInstallHandlers.ts", "utf8");

        expect(source).toContain('import {escapeHtml} from "../../util/DOM/escape";');
        expect(source).toContain('siyuanI18n.confirmUninstall.replace("${name}", escapeHtml(packageName))');
    });
});
