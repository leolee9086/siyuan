import {strict as assert} from "node:assert";
import {afterEach, describe, it} from "node:test";
import {
    getMobileKeyboardLifecycleState,
    resetMobileKeyboardLifecycleState,
} from "../../src/mobile/keyboard/MobileKeyboardLifecycleRegistry";
import {armKeyboardLock} from "../../src/mobile/keyboard/mobileAppUtil";

describe("mobile keyboard lifecycle registry", () => {
    afterEach(() => resetMobileKeyboardLifecycleState());

    it("shares the complete lifecycle state through the registry", () => {
        const first = getMobileKeyboardLifecycleState();
        first.preventRender = true;
        first.gestureMoved = true;

        const second = getMobileKeyboardLifecycleState();
        assert.equal(second, first);
        assert.equal(second.preventRender, true);
        assert.equal(second.gestureMoved, true);
    });

    it("writes the native keyboard lock into registered state", () => {
        const before = Date.now();
        armKeyboardLock();

        const state = getMobileKeyboardLifecycleState();
        assert.ok(state.lockUntil >= before + 500);
    });

    it("recreates clean state after lifecycle reset", () => {
        const previous = getMobileKeyboardLifecycleState();
        previous.showUtil = true;
        previous.gestureStartX = 42;

        resetMobileKeyboardLifecycleState();

        const current = getMobileKeyboardLifecycleState();
        assert.notEqual(current, previous);
        assert.equal(current.showUtil, false);
        assert.equal(current.gestureStartX, 0);
    });
});
