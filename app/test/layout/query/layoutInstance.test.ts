import {describe, it} from "node:test";
import {strict as assert} from "node:assert";
import type {LayoutDomain} from "../../../src/layout/layout.types";
import type {LayoutTab} from "../../../src/layout/layout.types";
import type {LayoutWindow} from "../../../src/layout/layout.types";
import {getInstanceById, getWndByLayout} from "../../../src/layout/query/layoutInstance";

const createWindowElement = (activeTime: string) => Object.assign(Object.create(null), {
    querySelector: () => ({getAttribute: () => activeTime}),
}) as HTMLElement;

const createLayoutTree = () => {
    const tab = {id: "deep-tab"} as LayoutTab;
    const olderWindow = {
        id: "older-window",
        element: createWindowElement("100"),
        headersElement: {} as HTMLElement,
        children: [tab],
    } as LayoutWindow;
    const newerWindow = Object.assign(Object.create(null), {
        id: "newer-window",
        element: createWindowElement("200"),
        headersElement: {} as HTMLElement,
        children: [],
    }) as LayoutWindow;
    const nestedLayout = {id: "nested-layout", children: [olderWindow]} as LayoutDomain;
    const root = {id: "root-layout", children: [newerWindow, nestedLayout]} as LayoutDomain;
    return {root, tab, olderWindow, newerWindow, nestedLayout};
};

describe("layout instance queries", () => {
    it("finds layouts, windows, and tabs without concrete class checks", () => {
        const tree = createLayoutTree();
        assert.equal(getInstanceById("nested-layout", tree.root), tree.nestedLayout);
        assert.equal(getInstanceById("older-window", tree.root), tree.olderWindow);
        assert.equal(getInstanceById("deep-tab", tree.root), tree.tab);
    });

    it("returns undefined for an unknown ID", () => {
        assert.equal(getInstanceById("missing", createLayoutTree().root), undefined);
    });

    it("selects the window with the latest focused-tab activity", () => {
        const tree = createLayoutTree();
        assert.equal(getWndByLayout(tree.root), tree.newerWindow);
    });
});
