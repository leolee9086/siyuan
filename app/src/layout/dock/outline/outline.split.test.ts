import {describe, it, expect} from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("16124 outline expandLevel persistence", () => {
    it("desktop expandLevel persists and marks current", () => {
        const content = fs.readFileSync(path.resolve("src/layout/dock/outline/Outline.expand.ts"), "utf8");
        expect(content).toContain("window.siyuan.storage[Constants.LOCAL_OUTLINE].expandLevel = targetLevel");
        expect(content).toContain("setStorageVal(Constants.LOCAL_OUTLINE");
        expect(content).toContain("current: window.siyuan.storage[Constants.LOCAL_OUTLINE].expandLevel === i");
        // also early return case persists
        const matches = content.match(/expandLevel = targetLevel/g) || [];
        expect(matches.length).toBeGreaterThanOrEqual(2);
    });
    it("mobile expandLevel persists and marks current", () => {
        const content = fs.readFileSync(path.resolve("src/mobile/dock/MobileOutline.expand.ts"), "utf8");
        expect(content).toContain("window.siyuan.storage[Constants.LOCAL_OUTLINE].expandLevel = targetLevel");
        expect(content).toContain("current: window.siyuan.storage[Constants.LOCAL_OUTLINE].expandLevel === i");
    });
    it("storage default initializes expandLevel 6", () => {
        const content = fs.readFileSync(path.resolve("src/protyle/util/localStorage/initialize.ts"), "utf8");
        expect(content).toContain("expandLevel: 6");
        expect(content).toContain("keepCurrentExpand: false");
    });
});
