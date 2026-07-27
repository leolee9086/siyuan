import {beforeEach, describe, expect, it, vi} from "vitest";

const {fetchPost} = vi.hoisted(() => ({
    fetchPost: vi.fn(),
}));

vi.mock("../../../src/block/fold/imports", () => ({
    Constants: {
        CB_GET_ALL: "all",
        CB_GET_CONTEXT: "context",
        CB_GET_FOCUS: "focus",
        CB_GET_ROOTSCROLL: "root-scroll",
    },
    fetchPost,
}));

import {checkFold} from "../../../src/block/fold/checkFold";

describe("block fold navigation query", () => {
    beforeEach(() => {
        fetchPost.mockReset();
    });

    it("does not query without a block ID", () => {
        checkFold("", vi.fn());

        expect(fetchPost).not.toHaveBeenCalled();
    });

    it("maps a folded block to focus and full-content actions", () => {
        const callback = vi.fn();
        fetchPost.mockImplementation((_url, _data, onResponse) => {
            onResponse({data: {isFolded: true, isRoot: true}});
        });

        checkFold("BLOCK_ID", callback);

        expect(callback).toHaveBeenCalledWith(true, ["focus", "all"], true);
    });

    it("maps an expanded block to contextual root-scroll actions", () => {
        const callback = vi.fn();
        fetchPost.mockImplementation((_url, _data, onResponse) => {
            onResponse({data: {isFolded: false, isRoot: false}});
        });

        checkFold("BLOCK_ID", callback);

        expect(callback).toHaveBeenCalledWith(false, ["focus", "context", "root-scroll"], false);
    });
});
