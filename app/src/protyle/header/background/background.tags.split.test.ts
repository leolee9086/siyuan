import {describe, it, expect} from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("14745 split wiring - tag menu", () => {
    it("tags.ts exports required symbols and guards", () => {
        const content = fs.readFileSync(path.resolve("src/protyle/header/background/tags.ts"), "utf8");
        expect(content).toContain("export const bindDocTagContextMenu");
        expect(content).toContain("export const updateTag");
        expect(content).toContain("export const removeTagByName");
        expect(content).toContain("export const bindTagSortEvent");
        expect(content).toContain("event.button !== 0");
        expect(content).toContain("openDocTagMenu");
        expect(content).toContain("Array.from(new Set(tags))");
        expect(content).toContain('addEventListener("contextmenu"');
    });
    it("tags.ts contains button guard", () => {
        const content = fs.readFileSync(path.resolve("src/protyle/header/background/tags.ts"), "utf8");
        expect(content).toContain("event.button !== 0");
        expect(content).toContain("bindDocTagContextMenu");
        expect(content).toContain("openDocTagMenu");
    });
    it("Background.ts wires bindDocTagContextMenu", () => {
        const content = fs.readFileSync(path.resolve("src/protyle/header/Background.ts"), "utf8");
        expect(content).toContain("bindDocTagContextMenu");
        expect(content).toContain("bindTagSortEvent");
        expect(content).toContain("bindDocTagContextMenu(this, protyle)");
    });
    it("updateTag deduplication logic via Set present", () => {
        const content = fs.readFileSync(path.resolve("src/protyle/header/background/tags.ts"), "utf8");
        expect(content).toContain("Array.from(new Set(tags))");
        expect(content).toContain("if (oldTag === newTag)");
        expect(content).toContain("if (tagsString === (background.ial.tags || \"\"))");
    });
});
