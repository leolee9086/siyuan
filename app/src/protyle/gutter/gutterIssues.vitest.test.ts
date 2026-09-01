import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("Issue 4785: table delete rows/columns", () => {
    it("index.mousedown.tableMenu exposes Delete Row/Delete Column via projection-aware helpers", () => {
        const content = read("src/protyle/wysiwyg/index.mousedown.tableMenu.ts");
        expect(content).toMatch(/deleteTableRows/);
        expect(content).toMatch(/deleteTableColumns/);
        expect(content).toMatch(/getTableFullRowSelection/);
        expect(content).toMatch(/getTableFullColumnSelection/);
        expect(content).toMatch(/deleteRows/);
        expect(content).toMatch(/deleteColumns/);
        // local superset: no disabled due to merged
        expect(content).not.toMatch(/cancelMerged/);
    });
    it("table selection owner provides full row/column helpers", () => {
        const selectionContent = read("src/protyle/util/table/selection/operations.ts");
        expect(selectionContent).toMatch(/getTableFullRowSelection/);
        expect(selectionContent).toMatch(/getTableFullColumnSelection/);
        const gridContent = read("src/protyle/util/table/grid/index.ts");
        expect(gridContent).toMatch(/buildTableGrid/);
    });
});

describe("Issue 7929: heading fold", () => {
    it("bindEvent wires Alt-click heading children/siblings via foldHeadingGroup", () => {
        const content = read("src/protyle/gutter/bindEvent.ts");
        expect(content).toMatch(/foldHeadingGroup/);
        expect(content).toMatch(/NodeHeading/);
        expect(content).toMatch(/children/);
        expect(content).toMatch(/siblings/);
    });
    it("common menu exposes foldChildHeadings/foldSiblingHeadings", () => {
        const content = read("src/protyle/gutter/buildGutterCommonMenu.ts");
        expect(content).toMatch(/foldChildHeadings/);
        expect(content).toMatch(/foldSiblingHeadings/);
        expect(content).toMatch(/foldHeadingGroup/);
    });
    it("blockFold preserves viewFold via getViewHeadingGroup", () => {
        const content = read("src/protyle/util/blockFold.ts");
        expect(content).toMatch(/getViewHeadingGroup/);
        expect(content).toMatch(/hasViewFoldContext/);
        expect(content).toMatch(/foldHeadingGroup/);
    });
});

describe("Issue 16942/17635/18349: list handling", () => {
    it("buildGutterListMenu adds includeSublists recursive submenu", () => {
        const content = read("src/protyle/gutter/buildGutterListMenu.ts");
        expect(content).toMatch(/includeSublists/);
        expect(content).toMatch(/turnListsRecursively/);
        expect(content).toMatch(/recursiveParagraph/);
        expect(content).toMatch(/recursiveList/);
    });
    it("buildGutterTypeSpecificMenu wires prepend/append list items", () => {
        const content = read("src/protyle/gutter/buildGutterTypeSpecificMenu.ts");
        expect(content).toMatch(/prependListItem/);
        expect(content).toMatch(/appendListItem/);
        expect(content).toMatch(/listBlock/);
        expect(content).toMatch(/orderedListStart/);
    });
    it("multiple menu uses turnsIntoGroupsTransaction for noncontiguous groups", () => {
        const content = read("src/protyle/gutter/buildMultipleTurnIntoMenu.ts");
        expect(content).toMatch(/genTurnsIntoGroups/);
        expect(content).toMatch(/computeGroups|getNextBlockSibling/);
        const items = read("src/protyle/gutter/turnInto/items.ts");
        expect(items).toMatch(/turnsIntoGroupsTransaction/);
    });
    it("turnInto items support groups", () => {
        const content = read("src/protyle/gutter/turnInto/items.ts");
        expect(content).toMatch(/genTurnsIntoGroups/);
        expect(content).toMatch(/turnsIntoGroupsTransaction/);
    });
    it("catalog preserves stable menu ids", () => {
        const content = read("src/config/entryVisibility/catalog.ts");
        expect(content).toMatch(/includeSublists/);
        expect(content).toMatch(/prependListItem/);
        expect(content).toMatch(/appendListItem/);
        expect(content).toMatch(/foldChildHeadings/);
        expect(content).toMatch(/foldSiblingHeadings/);
    });
});
