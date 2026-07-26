import assert from "node:assert/strict";
import {after, before, describe, it} from "node:test";
import {Window} from "happy-dom";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalElement = Object.getOwnPropertyDescriptor(globalThis, "Element");
const originalHTMLElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
const testWindow = new Window();
let getColId;

const restoreGlobal = (name, descriptor) => {
    if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
        return;
    }
    Reflect.deleteProperty(globalThis, name);
};

before(async () => {
    Object.defineProperty(globalThis, "window", {configurable: true, value: testWindow});
    Object.defineProperty(globalThis, "Element", {configurable: true, value: testWindow.Element});
    Object.defineProperty(globalThis, "HTMLElement", {configurable: true, value: testWindow.HTMLElement});
    ({getColId} = await import("../../src/protyle/render/av/col/identity/resolve"));
});

after(() => {
    restoreGlobal("window", originalWindow);
    restoreGlobal("Element", originalElement);
    restoreGlobal("HTMLElement", originalHTMLElement);
});

describe("AV column identity", () => {
    it("reads table and custom attribute column IDs from data-col-id", () => {
        const tableCell = testWindow.document.createElement("div");
        tableCell.dataset.colId = "table-column";
        assert.equal(getColId(tableCell, "table"), "table-column");

        const customAttr = testWindow.document.createElement("div");
        customAttr.className = "custom-attr";
        const customField = testWindow.document.createElement("span");
        customField.dataset.colId = "custom-column";
        customAttr.append(customField);
        assert.equal(getColId(customField, "gallery"), "custom-column");
    });

    it("reads card field IDs and leaves unsupported views unresolved", () => {
        const field = testWindow.document.createElement("div");
        field.dataset.fieldId = "card-field";

        assert.equal(getColId(field, "gallery"), "card-field");
        assert.equal(getColId(field, "kanban"), "card-field");
        assert.equal(getColId(field, "unsupported-view"), undefined);
    });
});
