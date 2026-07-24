import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import {collectLayoutTabs, collectLayoutWindows} from "../../../src/layout/traversal/collectLayout";

function createTab(id: string) {
    const headElement = Object.create(null);
    headElement.id = id;
    return {headElement, model: {id}};
}

function createWindow(id: string, tabs: ReturnType<typeof createTab>[]) {
    const element = Object.create(null);
    element.id = id;
    const headersElement = Object.create(null);
    headersElement.id = `${id}-headers`;
    return {
        element,
        headersElement,
        children: tabs,
    };
}

function createLayoutTree() {
    const firstWindow = createWindow("first", [createTab("a"), createTab("b")]);
    const secondWindow = createWindow("second", [createTab("c")]);
    return {layout: {children: [firstWindow, {children: [secondWindow]}]}, firstWindow, secondWindow};
}

describe("layout traversal", () => {
    it("collects nested windows in layout order", () => {
        const tree = createLayoutTree();
        const windows: typeof tree.firstWindow[] = [];
        collectLayoutWindows(tree.layout, windows);
        assert.deepEqual(windows, [tree.firstWindow, tree.secondWindow]);
    });

    it("collects tabs in window order", () => {
        const tree = createLayoutTree();
        const tabs: ReturnType<typeof createTab>[] = [];
        collectLayoutTabs(tree.layout, tabs);
        assert.deepEqual(tabs.map((tab) => tab.headElement.id), ["a", "b", "c"]);
    });
});
