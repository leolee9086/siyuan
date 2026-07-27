import {beforeEach, describe, expect, it, vi} from "vitest";
import {createProtyleDomainFixture} from "../support/protyleDomain.fixture";

const mocks = vi.hoisted(() => ({
    fetchPost: vi.fn(),
    openFileAttr: vi.fn(),
}));

vi.mock("../../src/menus/commonMenuItem/fileAttr/imports", () => ({
    fetchPost: mocks.fetchPost,
}));

vi.mock("../../src/menus/commonMenuItem/fileAttr/openFileAttr", () => ({
    openFileAttr: mocks.openFileAttr,
}));

import {openAttr} from "../../src/menus/commonMenuItem/fileAttr/openAttr";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("openAttr", () => {
    it("does not request attributes for a thematic break", () => {
        const element = document.createElement("div");
        element.setAttribute("data-type", "NodeThematicBreak");

        openAttr(element, "bookmark", createProtyleDomainFixture().protyle);

        expect(mocks.fetchPost).not.toHaveBeenCalled();
        expect(mocks.openFileAttr).not.toHaveBeenCalled();
    });

    it("forwards the current element identity and response to the file attribute owner", () => {
        const element = document.createElement("div");
        element.setAttribute("data-node-id", "block-id");
        const protyle = createProtyleDomainFixture().protyle;

        openAttr(element, "custom", protyle);
        expect(mocks.fetchPost).toHaveBeenCalledWith(
            "/api/attr/getBlockAttrs",
            {id: "block-id"},
            expect.any(Function),
        );

        const callback = mocks.fetchPost.mock.calls[0]?.[2];
        if (!callback) {
            throw new Error("Expected block attribute response callback");
        }
        const attrs = {id: "block-id", bookmark: "label"};
        callback({data: attrs});
        expect(mocks.openFileAttr).toHaveBeenCalledWith(attrs, "custom", protyle);
    });

    it("preserves a missing data-node-id as a null request value", () => {
        openAttr(document.createElement("div"), "bookmark", createProtyleDomainFixture().protyle);

        expect(mocks.fetchPost).toHaveBeenCalledWith(
            "/api/attr/getBlockAttrs",
            {id: null},
            expect.any(Function),
        );
    });
});
