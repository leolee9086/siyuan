import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));

const tombstones = [
    "boot/globalEvent/keydown.ts",
    "config/ai.ts",
    "config/search.ts",
    "dialog/processSystem/index.ts",
    "history/history.ts",
    "layout/dock/Outline.ts",
    "protyle/util/table.ts",
    "protyle/wysiwyg/commonHotkey.ts",
    "util/assets.ts",
    "util/fetch.ts",
    "util/file/Tree.ts",
    "util/pathName.ts",
    "util/platform/noRelyPCFunction.ts",
];

const tombstoneModulePattern = /^\/\*\*[\s\S]*?\*\/\r?\nexport \{\};\r?\n?$/;

describe("retired source tombstones", () => {
    for (const modulePath of tombstones) {
        it(`${modulePath} remains documentation-only`, () => {
            const source = readFileSync(new URL(modulePath, new URL("../../src/", import.meta.url)), "utf8");
            assert.match(source, tombstoneModulePattern);
        });
    }

    it("tracks every established tombstone exactly once", () => {
        assert.equal(new Set(tombstones).size, tombstones.length);
        assert.equal(sourceRoot.endsWith("src\\") || sourceRoot.endsWith("src/"), true);
    });
});
