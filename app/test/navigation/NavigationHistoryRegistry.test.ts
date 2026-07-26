import {strict as assert} from "node:assert";
import {afterEach, describe, it} from "node:test";
import {
    getNavigationHistoryState,
    resetNavigationHistoryRegistry,
} from "../../src/navigation/history/NavigationHistoryRegistry";

describe("navigation history registry", () => {
    afterEach(() => resetNavigationHistoryRegistry());

    it("shares state for the same navigation scope", () => {
        const first = getNavigationHistoryState("desktop");
        first.previousIsBack = true;

        const second = getNavigationHistoryState("desktop");
        assert.equal(second, first);
        assert.equal(second.previousIsBack, true);
    });

    it("isolates desktop and mobile navigation history", () => {
        const desktop = getNavigationHistoryState("desktop");
        const mobile = getNavigationHistoryState("mobile");

        assert.notEqual(desktop, mobile);
        assert.notEqual(desktop.forwardStack, mobile.forwardStack);
    });

    it("resets all registered navigation state", () => {
        const previous = getNavigationHistoryState("mobile");
        previous.previousIsBack = true;

        resetNavigationHistoryRegistry();

        const current = getNavigationHistoryState("mobile");
        assert.notEqual(current, previous);
        assert.equal(current.previousIsBack, false);
        assert.deepEqual(current.forwardStack, []);
    });
});
