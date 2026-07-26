import {afterEach, describe, it} from "node:test";
import {strict as assert} from "node:assert";
import {getDockByType} from "../../../src/layout/query/dockByType";

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

afterEach(() => {
    if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, "window", originalWindowDescriptor);
        return;
    }
    Reflect.deleteProperty(globalThis, "window");
});

describe("dock query", () => {
    it("preserves left, right, then bottom lookup priority", () => {
        const leftDock = {data: {file: {source: "left"}}};
        const rightDock = {data: {file: {source: "right"}, tag: {source: "right"}}};
        const bottomDock = {data: {agentChat: {source: "bottom"}}};
        Object.defineProperty(globalThis, "window", {
            configurable: true,
            value: {siyuan: {layout: {leftDock, rightDock, bottomDock}}},
        });

        assert.equal(getDockByType("file"), leftDock);
        assert.equal(getDockByType("tag"), rightDock);
        assert.equal(getDockByType("agentChat"), bottomDock);
    });

    it("returns undefined when the layout or model type is absent", () => {
        Object.defineProperty(globalThis, "window", {
            configurable: true,
            value: {siyuan: {}},
        });

        assert.equal(getDockByType("file"), undefined);
    });
});
