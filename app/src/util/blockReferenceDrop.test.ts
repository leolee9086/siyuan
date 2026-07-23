import assert from "node:assert/strict";
import test from "node:test";

import {parseBlockReferenceDropData} from "./blockReferenceDrop.guard";

test("normalizes valid same-workspace block reference IDs", () => {
    const payload = JSON.stringify({
        ids: ["20260723123456-abcdefg", "bad", "20260723123456-abcdefg"],
        workspaceDir: "D:/Workspace",
    });
    assert.deepEqual(parseBlockReferenceDropData(payload, "d:/workspace"), ["20260723123456-abcdefg"]);
});

test("rejects another workspace without mixing identities", () => {
    const payload = JSON.stringify({ids: ["20260723123456-abcdefg"], workspaceDir: "D:/Other"});
    assert.deepEqual(parseBlockReferenceDropData(payload, "D:/Workspace"), []);
});

test("throws for malformed JSON", () => {
    assert.throws(() => parseBlockReferenceDropData("{", "D:/Workspace"), SyntaxError);
});

test("throws for structurally invalid payloads", () => {
    assert.throws(
        () => parseBlockReferenceDropData(JSON.stringify({ids: "not-an-array", workspaceDir: "D:/Workspace"}), "D:/Workspace"),
        /Invalid block reference drop payload/,
    );
});
