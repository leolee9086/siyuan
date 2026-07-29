import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe, expect, it} from "vitest";

const panelSource = readFileSync(
    resolve(process.cwd(), "src/history/history.panel.ts"),
    "utf8",
);

describe("history panel composition root", () => {
    it("delegates each click through one document and one repository handler", () => {
        expect(panelSource.match(/handleDocClick\(/g)).toHaveLength(1);
        expect(panelSource.match(/handleRepoClick\(/g)).toHaveLength(1);
        expect(panelSource).not.toContain('/api/history/rollbackDocHistory');
        expect(panelSource).not.toContain('/api/repo/checkoutRepo');
    });

    it("renders one document query input and one repository query input", () => {
        expect(panelSource.match(/placeholder="\$\{siyuanI18n\.search\}"/g)).toHaveLength(1);
        expect(panelSource.match(/placeholder="\$\{siyuanI18n\.searchFileName\}"/g)).toHaveLength(1);
    });
});
