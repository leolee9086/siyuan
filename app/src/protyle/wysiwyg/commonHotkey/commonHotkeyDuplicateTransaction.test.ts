import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    clearBlockElement: vi.fn(),
    fetchSyncPost: vi.fn(),
}));

vi.mock("../../../util/network/fetch", () => ({
    fetchSyncPost: mocks.fetchSyncPost,
}));
vi.mock("../../../util/DOM/element.guard", () => ({
    isHTMLElement: (value: unknown) => value instanceof HTMLElement,
}));
vi.mock("../../util/clearSelect", () => ({
    clearBlockElement: mocks.clearBlockElement,
}));
vi.mock("../transaction/submit", () => ({
    transaction: vi.fn(),
}));
vi.mock("../../util/selection", () => ({
    focusBlock: vi.fn(),
}));
vi.mock("../../../util/DOM/highlightById", () => ({
    scrollCenter: vi.fn(),
}));

import {handleFoldedHeading} from "./commonHotkeyDuplicateTransaction";

describe("handleFoldedHeading", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const ids = ["nested-a", "child-a", "nested-b", "child-b"];
        vi.stubGlobal("Lute", {
            NewNodeID: vi.fn(() => ids.shift() || "unexpected-id"),
        });
        mocks.fetchSyncPost.mockResolvedValue({
            data: `<div data-node-id="source-heading"></div>
<div parent-heading="source-heading" data-node-id="source-child-a"><span data-node-id="source-nested-a"></span></div>
<div parent-heading="source-heading" data-node-id="source-child-b"><span data-node-id="source-nested-b"></span></div>`,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("keeps folded child insertion in document order through chained anchors", async () => {
        const heading = document.createElement("div");
        heading.setAttribute("data-type", "NodeHeading");
        heading.setAttribute("data-node-id", "source-heading");
        heading.setAttribute("fold", "1");

        const result = await handleFoldedHeading(heading, "duplicate-heading");

        expect(mocks.fetchSyncPost).toHaveBeenCalledWith("/api/block/getHeadingChildrenDOM", {
            id: "source-heading",
            removeFoldAttr: false,
        });
        expect(result.doOperations.map((operation) => operation.id)).toEqual(["child-a", "child-b"]);
        expect(result.doOperations.map((operation) => operation.previousID)).toEqual([
            "duplicate-heading",
            "child-a",
        ]);
        expect(result.doOperations.map((operation) => operation.data)).toEqual([
            expect.not.stringContaining("parent-heading"),
            expect.not.stringContaining("parent-heading"),
        ]);
        expect(result.undoOperations).toEqual([
            {action: "delete", id: "child-a"},
            {action: "delete", id: "child-b"},
        ]);
    });
});
