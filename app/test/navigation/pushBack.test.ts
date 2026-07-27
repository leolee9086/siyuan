import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    getContenteditableElement: vi.fn(),
    getSelectionOffset: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/getBlock", () => ({
    getContenteditableElement: mocks.getContenteditableElement,
}));
vi.mock("../../src/protyle/util/selection", () => ({
    getSelectionOffset: mocks.getSelectionOffset,
}));

import {getNavigationHistoryState, resetNavigationHistoryRegistry} from "../../src/navigation/history/NavigationHistoryRegistry";
import {pushBack} from "../../src/navigation/history/pushBack";

const createProtyle = (id = "root-id") => Object.assign({} as IProtyle, {
    block: {id, rootID: "root-id", showAll: false},
    model: {},
});

describe("pushBack navigation history", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetNavigationHistoryRegistry();
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {backStack: []},
            writable: true,
        });
        document.body.innerHTML = '<button id="barBack" class="toolbar__item--disabled"></button><button id="barForward"></button>';
        mocks.getContenteditableElement.mockImplementation((element: Element) => element);
        mocks.getSelectionOffset.mockReturnValue({start: 12, end: 12});
    });

    afterEach(() => resetNavigationHistoryRegistry());

    it("records a block position without loading forward navigation execution", () => {
        const protyle = createProtyle();
        const block = document.createElement("div");
        block.dataset.nodeId = "block-id";

        pushBack(protyle, undefined, block);

        expect(window.siyuan.backStack).toHaveLength(1);
        expect(window.siyuan.backStack?.[0]).toMatchObject({id: "block-id", position: {start: 12, end: 12}, protyle});
        expect(window.siyuan.backStack?.[0]?.zoomId).toBeUndefined();
    });

    it("updates the latest matching position instead of adding a duplicate", () => {
        const protyle = createProtyle();
        const block = document.createElement("div");
        block.dataset.nodeId = "block-id";
        pushBack(protyle, undefined, block);
        mocks.getSelectionOffset.mockReturnValue({start: 24, end: 24});

        pushBack(protyle, undefined, block);

        expect(window.siyuan.backStack).toHaveLength(1);
        expect(window.siyuan.backStack?.[0]?.position).toEqual({start: 24, end: 24});
    });

    it("consumes the current forward position after a back navigation", () => {
        const protyle = createProtyle();
        const history = getNavigationHistoryState("desktop");
        history.previousIsBack = true;
        history.forwardStack.push({id: "forward-id", position: {start: 3, end: 3}, protyle});
        const block = document.createElement("div");
        block.dataset.nodeId = "next-id";

        pushBack(protyle, undefined, block);

        expect(history.forwardStack).toEqual([]);
        expect(window.siyuan.backStack?.map(item => item.id)).toEqual(["forward-id", "next-id"]);
        expect(document.querySelector("#barForward")?.classList.contains("toolbar__item--disabled")).toBe(true);
        expect(document.querySelector("#barBack")?.classList.contains("toolbar__item--disabled")).toBe(false);
    });
});
