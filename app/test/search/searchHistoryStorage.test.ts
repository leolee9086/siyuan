import {describe, it} from "node:test";
import {strict as assert} from "node:assert";
import {prependSearchHistory} from "../../src/search/history/normalize";

describe("search history storage", () => {
    it("moves the latest value to the front without duplicates", () => {
        const source = ["older", "latest", "oldest"];

        assert.deepEqual(prependSearchHistory(source, "latest", 10), ["latest", "older", "oldest"]);
        assert.deepEqual(source, ["latest", "older", "latest", "oldest"]);
    });

    it("truncates unique history entries to the configured limit", () => {
        assert.deepEqual(prependSearchHistory(["two", "three", "four"], "one", 3), ["one", "two", "three"]);
    });
});
