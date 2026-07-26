import assert from "node:assert/strict";
import {after, before, describe, it} from "node:test";
import {Window} from "happy-dom";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalHTMLElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
const originalElement = Object.getOwnPropertyDescriptor(globalThis, "Element");
const originalVersion = Object.getOwnPropertyDescriptor(globalThis, "SIYUAN_VERSION");
const originalNodeEnvironment = Object.getOwnPropertyDescriptor(globalThis, "NODE_ENV");
const testWindow = new Window();
let getAVSelectStat;
let getAVVirtualScrollRegistry;
let resetAVRowSelect;
let resetAVVirtualScrollRegistry;
let setAVVirtualBodyState;
let updateAVRowSelect;
let updateHeader;

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
    Object.defineProperty(globalThis, "Element", {configurable: true, value: testWindow.Element});
    Object.defineProperty(globalThis, "SIYUAN_VERSION", {configurable: true, value: "test"});
    Object.defineProperty(globalThis, "NODE_ENV", {configurable: true, value: "test"});
    testWindow.siyuan = {languages: {selected: "selected"}};
    ({
        getAVSelectStat,
        getAVVirtualScrollRegistry,
        resetAVRowSelect,
        resetAVVirtualScrollRegistry,
        setAVVirtualBodyState,
        updateAVRowSelect,
    } = await import("../../src/protyle/render/av/virtualScroll/state"));
    ({updateHeader} = await import("../../src/protyle/render/av/selection/header"));
});

after(() => {
    resetAVVirtualScrollRegistry?.();
    restoreGlobal("window", originalWindow);
    restoreGlobal("HTMLElement", originalHTMLElement);
    restoreGlobal("Element", originalElement);
    restoreGlobal("SIYUAN_VERSION", originalVersion);
    restoreGlobal("NODE_ENV", originalNodeEnvironment);
});

describe("AV virtual scroll state", () => {
    it("shares selection snapshots and resets the complete registry", () => {
        const body = testWindow.document.createElement("div");
        const firstRegistry = getAVVirtualScrollRegistry();
        setAVVirtualBodyState(body, {
            renderedStart: 0,
            renderedEnd: 1,
            dataOffset: 0,
            view: {rows: [{id: "row-1"}, {id: "row-2"}]},
            topSpacerHeight: 0,
            selectedRowIds: new Set(),
        });

        updateAVRowSelect(body, "row-1", true);
        assert.deepEqual(getAVSelectStat(body), {selectCount: 1, loadedCount: 2});
        resetAVRowSelect(body, ["row-2"]);
        assert.deepEqual(getAVSelectStat(body), {selectCount: 1, loadedCount: 2});

        resetAVVirtualScrollRegistry();
        assert.notEqual(getAVVirtualScrollRegistry(), firstRegistry);
        assert.equal(getAVSelectStat(body), null);
    });

    it("updates table header and counter for partial, full, and empty selection", () => {
        const block = testWindow.document.createElement("div");
        block.dataset.nodeId = "block-id";
        block.dataset.type = "NodeAttributeView";
        block.dataset.avType = "table";
        block.innerHTML = `<div class="av__counter fn__none"></div>
<div class="av__body">
  <div class="av__row av__row--header"><svg><use></use></svg></div>
  <div class="av__row av__row--select" data-id="row-1"></div>
  <div class="av__row" data-id="row-2"></div>
</div>`;
        const body = block.querySelector(".av__body");
        const header = body.firstElementChild;
        const rows = body.querySelectorAll(".av__row:not(.av__row--header)");
        const counter = block.querySelector(".av__counter");

        updateHeader(rows[0]);
        assert.equal(header.querySelector("use").getAttribute("xlink:href"), "#iconIndeterminateCheck");
        assert.equal(counter.textContent, "1 selected");

        rows[1].classList.add("av__row--select");
        updateHeader(rows[1]);
        assert.equal(header.querySelector("use").getAttribute("xlink:href"), "#iconCheck");
        assert.equal(counter.textContent, "2 selected");

        rows.forEach((row) => row.classList.remove("av__row--select"));
        updateHeader(rows[0]);
        assert.equal(header.querySelector("use").getAttribute("xlink:href"), "#iconUncheck");
        assert.equal(counter.classList.contains("fn__none"), true);
    });
});
