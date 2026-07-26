import {describe, it} from "node:test";
import {strict as assert} from "node:assert";
import {
    getDefaultSubType,
} from "../../src/search/defaults/searchDefaults";

describe("search defaults", () => {
    it("starts without heading or list subtype restrictions", () => {
        assert.deepEqual(getDefaultSubType(), {
            h1: false,
            h2: false,
            h3: false,
            h4: false,
            h5: false,
            h6: false,
            o: false,
            u: false,
            t: false,
        });
    });
});
