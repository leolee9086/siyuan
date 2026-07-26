import {afterEach, describe, it} from "node:test";
import {strict as assert} from "node:assert";
import {
    getLayoutSaveRetryCount,
    incrementLayoutSaveRetryCount,
    resetLayoutPersistenceRegistry,
    resetLayoutSaveRetryCount,
} from "../../../src/layout/persistence/state/saveLayout.registry";

describe("layout persistence registry", () => {
    afterEach(() => resetLayoutPersistenceRegistry());

    it("shares retry state through the unified registry", () => {
        resetLayoutPersistenceRegistry();
        assert.equal(getLayoutSaveRetryCount(), 0);
        assert.equal(incrementLayoutSaveRetryCount(), 1);
        assert.equal(incrementLayoutSaveRetryCount(), 2);
        assert.equal(getLayoutSaveRetryCount(), 2);
    });

    it("resets save state without retaining a closure instance", () => {
        incrementLayoutSaveRetryCount();
        resetLayoutSaveRetryCount();
        assert.equal(getLayoutSaveRetryCount(), 0);
    });
});
