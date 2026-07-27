import {strict as assert} from "node:assert";
import {afterEach, beforeEach, describe, it} from "node:test";
import {
    getOnboardingLifecycleState,
    resetOnboardingLifecycleState,
} from "../../src/onboarding/lifecycle/registry";

const originalWindow = globalThis.window;

describe("onboarding lifecycle registry", () => {
    beforeEach(() => {
        Object.defineProperty(globalThis, "window", {
            configurable: true,
            value: new EventTarget(),
        });
        resetOnboardingLifecycleState();
    });

    afterEach(() => {
        resetOnboardingLifecycleState();
        Object.defineProperty(globalThis, "window", {
            configurable: true,
            value: originalWindow,
        });
    });

    it("shares one complete login and sync lifecycle state", () => {
        const first = getOnboardingLifecycleState();
        first.pendingLoginHandler = () => undefined;
        first.pendingSyncHandler = () => undefined;
        first.mobileKeyboardHandler = () => undefined;

        const second = getOnboardingLifecycleState();
        assert.equal(second, first);
        assert.equal(second.pendingLoginHandler, first.pendingLoginHandler);
        assert.equal(second.pendingSyncHandler, first.pendingSyncHandler);
        assert.equal(second.mobileKeyboardHandler, first.mobileKeyboardHandler);
    });

    it("removes registered window listeners before releasing state", () => {
        let loginCount = 0;
        let syncCount = 0;
        let keyboardCount = 0;
        const state = getOnboardingLifecycleState();
        state.pendingLoginHandler = () => loginCount++;
        state.pendingSyncHandler = () => syncCount++;
        state.mobileKeyboardHandler = () => keyboardCount++;
        window.addEventListener("siyuan-login-success", state.pendingLoginHandler);
        window.addEventListener("siyuan-sync-success", state.pendingSyncHandler);
        window.addEventListener("siyuan-mobile-keyboard-change", state.mobileKeyboardHandler);

        resetOnboardingLifecycleState();
        window.dispatchEvent(new Event("siyuan-login-success"));
        window.dispatchEvent(new Event("siyuan-sync-success"));
        window.dispatchEvent(new Event("siyuan-mobile-keyboard-change"));

        assert.equal(loginCount, 0);
        assert.equal(syncCount, 0);
        assert.equal(keyboardCount, 0);
    });

    it("creates clean state after reset", () => {
        const previous = getOnboardingLifecycleState();
        previous.pendingLoginHandler = () => undefined;

        resetOnboardingLifecycleState();

        const current = getOnboardingLifecycleState();
        assert.notEqual(current, previous);
        assert.equal(current.pendingLoginHandler, undefined);
        assert.equal(current.pendingSyncHandler, undefined);
        assert.equal(current.mobileKeyboardHandler, undefined);
    });
});
