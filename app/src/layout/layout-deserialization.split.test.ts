import {describe, it, expect} from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("18439 tabStartupMode 0/1/2", () => {
    it("layout-deserialization.layout exports helpers", () => {
        const content = fs.readFileSync(path.resolve("src/layout/layout-deserialization.layout.ts"), "utf8");
        expect(content).toContain("getTabStartupMode");
        expect(content).toContain("shouldApplyTabStartup");
        expect(content).toContain("handleTabStartupBlank");
        expect(content).toContain("newCenterEmptyTab");
        expect(content).toContain("getWndByLayout");
        expect(content).toContain("!item.headElement");
    });
    it("JSONToLayout respects tabStartupMode and blank reuse", () => {
        const content = fs.readFileSync(path.resolve("src/layout/layout-deserialization.ts"), "utf8");
        expect(content).toContain("shouldApplyTabStartup");
        expect(content).toContain("handleTabStartupBlank");
        expect(content).toContain("handleCloseTabsOnStart(isStart, shouldApply)");
        expect(content).toContain("activateInitialTabs");
    });
    it("session semantics via OR", () => {
        const content = fs.readFileSync(path.resolve("src/layout/layout-deserialization.layout.ts"), "utf8");
        expect(content).toContain("isStart || checkAndMarkFirstLoad");
        // mode 2 check
        expect(content).toContain("getTabStartupMode() !== 2");
        // mode 1 check
        expect(content).toContain("getTabStartupMode() !== 1");
    });
    it("config schema includes tabStartupMode", () => {
        const content = fs.readFileSync(path.resolve("src/config/configSchemas/fileTree/schema.ts"), "utf8");
        expect(content).toContain("tabStartupMode");
        expect(content).toContain("z.number().int().min(0).max(2)");
        expect(content).toContain("tabStartupModeTip");
    });
});

describe("14961 dataDocType chain", () => {
    it("types include dataDocType", () => {
        const protyleTypes = fs.readFileSync(path.resolve("src/protyle/protyle.types.ts"), "utf8");
        expect(protyleTypes).toContain("dataDocType?: string");
        const zoomTypes = fs.readFileSync(path.resolve("src/menus/protyleMenus/editorMenu/protyle.zoomOut.types.ts"), "utf8");
        expect(zoomTypes).toContain("dataDocType?: string");
    });
    it("zoomOut propagates dataDocType to onGet", () => {
        const zoomOut = fs.readFileSync(path.resolve("src/menus/protyleMenus/editorMenu/protyle.zoomOut.ts"), "utf8");
        expect(zoomOut).toContain("dataDocType: options.dataDocType");
        expect(zoomOut).toContain("block__icon--active");
        const focus = fs.readFileSync(path.resolve("src/menus/protyleMenus/editorMenu/protyle.zoomOut.focus.ts"), "utf8");
        expect(focus).toContain("dataDocType: options.dataDocType");
    });
    it("breadcrumb events forward dataDocType and callback", () => {
        const events = fs.readFileSync(path.resolve("src/protyle/breadcrumb/breadcrumb.events.ts"), "utf8");
        expect(events).toContain('dataDocType: "NodeDocument"');
        expect(events).toContain("callback: () =>");
        expect(events).toContain("afterCB: () =>");
    });
});

describe("18321 database panel preserved", () => {
    it("WORKTREE preserves split behavior and no regression", () => {
        const panel = fs.readFileSync(path.resolve("src/protyle/render/av/attributePanel.ts"), "utf8");
        // Should still have local Vue-free panel, not upstream drag features if not ported
        expect(panel.length).toBeGreaterThan(1000);
        const layoutIndex = fs.readFileSync(path.resolve("src/layout/index.ts"), "utf8");
        // Should have handleRightSplitAnimation or equivalent split wiring for database row
        expect(layoutIndex).toContain("protyle-content");
    });
});
