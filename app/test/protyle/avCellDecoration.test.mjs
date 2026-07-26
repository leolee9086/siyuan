import assert from "node:assert/strict";
import {after, before, describe, it} from "node:test";
import {Window} from "happy-dom";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalHTMLElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
const originalVersion = Object.getOwnPropertyDescriptor(globalThis, "SIYUAN_VERSION");
const originalNodeEnvironment = Object.getOwnPropertyDescriptor(globalThis, "NODE_ENV");
const testWindow = new Window();
let addDragFill;
let getColIconByType;
let getColNameByType;
let updateHeaderCell;
let toTAVCol;

const restoreGlobal = (name, descriptor) => {
    if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
        return;
    }
    Reflect.deleteProperty(globalThis, name);
};

before(async () => {
    Object.defineProperty(globalThis, "window", {configurable: true, value: testWindow});
    Object.defineProperty(globalThis, "HTMLElement", {configurable: true, value: testWindow.HTMLElement});
    Object.defineProperty(globalThis, "SIYUAN_VERSION", {configurable: true, value: "test"});
    Object.defineProperty(globalThis, "NODE_ENV", {configurable: true, value: "test"});
    testWindow.siyuan = {languages: {
        _attrView: {key: "Key"},
        assets: "Assets",
        block: "Block",
        checkbox: "Checkbox",
        createdTime: "Created time",
        date: "Date",
        dragFill: "Drag fill",
        email: "Email",
        lineNumber: "Line number",
        link: "Link",
        multiSelect: "Multi-select",
        number: "Number",
        phone: "Phone",
        relation: "Relation",
        rollup: "Rollup",
        select: "Select",
        template: "Template",
        text: "Text",
        updatedTime: "Updated time",
    }};
    ({addDragFill, updateHeaderCell} = await import("../../src/protyle/render/av/cell/decoration/index"));
    ({getColIconByType, getColNameByType, toTAVCol} = await import("../../src/protyle/render/av/col/col.typeUtils"));
});

after(() => {
    restoreGlobal("window", originalWindow);
    restoreGlobal("HTMLElement", originalHTMLElement);
    restoreGlobal("SIYUAN_VERSION", originalVersion);
    restoreGlobal("NODE_ENV", originalNodeEnvironment);
});

describe("AV cell decoration", () => {
    it("updates header icon, name, and pin without duplicating the marker", () => {
        const cell = testWindow.document.createElement("div");
        cell.dataset.dtype = "number";
        cell.innerHTML = '<svg class="av__cellheadericon"></svg><span class="av__celltext">Old</span>';

        updateHeaderCell(cell, {icon: "", name: "Amount", pin: true});
        updateHeaderCell(cell, {pin: true});

        assert.equal(cell.dataset.icon, "");
        assert.match(cell.querySelector(".av__cellheadericon")?.innerHTML ?? "", /#iconNumber/);
        assert.equal(cell.querySelector(".av__celltext")?.textContent, "Amount");
        assert.equal(cell.querySelectorAll(".av__cellheadericon--pin").length, 1);

        updateHeaderCell(cell, {pin: false});
        assert.equal(cell.querySelector(".av__cellheadericon--pin"), null);
    });

    it("adds one drag handle only for writable column types", () => {
        const writableCell = testWindow.document.createElement("div");
        writableCell.dataset.dtype = "text";
        addDragFill(writableCell);
        addDragFill(writableCell);

        assert.equal(writableCell.classList.contains("av__cell--active"), true);
        assert.equal(writableCell.querySelectorAll(".av__drag-fill").length, 1);
        assert.equal(writableCell.querySelector(".av__drag-fill")?.getAttribute("aria-label"), "Drag fill");

        const readonlyCell = testWindow.document.createElement("div");
        readonlyCell.dataset.dtype = "template";
        addDragFill(readonlyCell);
        assert.equal(readonlyCell.classList.contains("av__cell--active"), true);
        assert.equal(readonlyCell.querySelector(".av__drag-fill"), null);
    });

    it("validates every protocol column type and defaults unknown values to text", () => {
        assert.equal(toTAVCol("checkbox"), "checkbox");
        assert.equal(toTAVCol("lineNumber"), "lineNumber");
        assert.equal(toTAVCol("future-type"), "text");
        assert.equal(toTAVCol(null), "text");
    });

    it("preserves the complete column name and icon mappings", () => {
        const expected = {
            text: ["Text", "iconAlignLeft"],
            block: ["Key", "iconKey"],
            number: ["Number", "iconNumber"],
            select: ["Select", "iconListItem"],
            mSelect: ["Multi-select", "iconList"],
            relation: ["Relation", "iconOpen"],
            rollup: ["Rollup", "iconSearch"],
            date: ["Date", "iconCalendar"],
            updated: ["Updated time", "iconClock"],
            created: ["Created time", "iconClock"],
            url: ["Link", "iconLink"],
            mAsset: ["Assets", "iconImage"],
            email: ["Email", "iconEmail"],
            phone: ["Phone", "iconPhone"],
            template: ["Template", "iconMath"],
            checkbox: ["Checkbox", "iconCheck"],
            lineNumber: ["Line number", "iconOrderedList"],
        };

        for (const [type, [name, icon]] of Object.entries(expected)) {
            assert.equal(getColNameByType(type), name);
            assert.equal(getColIconByType(type), icon);
        }
    });
});
