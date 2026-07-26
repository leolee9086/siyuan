import {describe, it} from "node:test";
import {strict as assert} from "node:assert";
import path from "node:path";
import {
    assertSourceGraphBoundary,
    isPathInsideSource,
} from "../../scripts/check-source-cycles.mjs";

describe("source cycle boundary", () => {
    it("accepts source files and rejects workspace packages outside app/src", () => {
        const sourceRoot = path.resolve("src");
        assert.equal(isPathInsideSource(sourceRoot, path.join(sourceRoot, "layout", "Tab.ts")), true);
        assert.equal(isPathInsideSource(sourceRoot, path.resolve("..", "packages", "caliburRouter", "dist", "index.d.ts")), false);
        assert.equal(isPathInsideSource(sourceRoot, sourceRoot), false);
    });

    it("rejects graph nodes and dependency targets outside app/src", () => {
        const sourceRoot = path.resolve("src");
        assert.doesNotThrow(() => assertSourceGraphBoundary(sourceRoot, {
            "layout/Tab.ts": ["layout/Wnd.ts", "util/pathName.ts"],
        }));
        assert.throws(() => assertSourceGraphBoundary(sourceRoot, {
            "layout/Tab.ts": ["../test/layout/Tab.test.ts", "../scripts/check-source-cycles.mjs"],
        }), /\.\.\/test\/layout\/Tab\.test\.ts.*\.\.\/scripts\/check-source-cycles\.mjs/);
    });
});
