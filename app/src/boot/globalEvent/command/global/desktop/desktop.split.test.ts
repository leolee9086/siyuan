import {describe, it, expect} from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("15416 unsplitWnd migration", () => {
    it("split.ts uses unsplitCurrentWnd and 2-arg unsplitWnd", () => {
        const content = fs.readFileSync(path.resolve("src/boot/globalEvent/command/global/desktop/split.ts"), "utf8");
        expect(content).toContain("unsplitCurrentWnd");
        expect(content).toContain("unsplitWnd(centerLayout, centerLayout)");
        expect(content).not.toContain("unsplitWnd(centerLayout, centerLayout, false)");
        expect(content).not.toContain("unsplitWnd(firstChild");
        expect(content).toContain("unsplitCurrentWnd(tab.parent)");
        expect(content).not.toContain("getNearestSplitLayout");
    });
    it("imports exports unsplitCurrentWnd", () => {
        const content = fs.readFileSync(path.resolve("src/boot/globalEvent/command/global/desktop/imports.ts"), "utf8");
        expect(content).toContain("unsplitCurrentWnd");
        expect(content).toContain("import { unsplitWnd, unsplitCurrentWnd }");
        expect(content).toContain("export { unsplitWnd, unsplitCurrentWnd }");
    });
    it("menus/tab.ts defines correct signatures", () => {
        const content = fs.readFileSync(path.resolve("src/menus/tab.ts"), "utf8");
        expect(content).toContain("export const unsplitCurrentWnd = (wnd: Wnd)");
        expect(content).toContain("export const unsplitWnd = (target: Wnd | Layout, layout: Layout)");
    });
});
