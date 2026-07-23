import assert from "node:assert/strict";
import test from "node:test";
import {filterBookmarkData, getBookmarkFilterKeywords} from "../../../src/layout/dock/bookmarkFilter";

const bookmark = (name: string): IBlockTree => ({
    box: "",
    nodeType: "",
    hPath: "",
    subType: "",
    name,
    type: "bookmark",
    depth: 0,
    count: 0,
});

test("normalizes bookmark filter keywords", () => {
    assert.deepEqual(getBookmarkFilterKeywords("  Project   ALPHA  "), ["project", "alpha"]);
});

test("requires every bookmark keyword without case sensitivity", () => {
    const data = [bookmark("Project Alpha"), bookmark("Project Beta"), bookmark("Alpha Notes")];
    assert.deepEqual(filterBookmarkData(data, ["project", "alpha"]), [data[0]]);
});

test("keeps all bookmarks when the keyword list is empty", () => {
    const data = [bookmark("One"), bookmark("Two")];
    assert.deepEqual(filterBookmarkData(data, []), data);
});
