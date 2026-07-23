import assert from "node:assert/strict";
import test from "node:test";
import {PendingInputScheduler, type InputTimerPort} from "./index.input.scheduler";

const createTimer = () => {
    let nextHandle = 1;
    const callbacks = new Map<number, () => void>();
    const cleared: number[] = [];
    const timer: InputTimerPort = {
        clear: (handle) => {
            callbacks.delete(handle);
            cleared.push(handle);
        },
        schedule: (callback) => {
            const handle = nextHandle++;
            callbacks.set(handle, callback);
            return handle;
        },
    };
    return {callbacks, cleared, timer};
};

test("replacing a pending input keeps only the latest callback", () => {
    const fixture = createTimer();
    const scheduler = new PendingInputScheduler(fixture.timer);
    const calls: string[] = [];
    scheduler.schedule(() => calls.push("first"));
    scheduler.schedule(() => calls.push("second"));

    assert.deepEqual(fixture.cleared, [1]);
    fixture.callbacks.get(2)?.();
    assert.deepEqual(calls, ["second"]);
});

test("flush commits replaceable and independent callbacks in schedule order", () => {
    const fixture = createTimer();
    const scheduler = new PendingInputScheduler(fixture.timer);
    const calls: string[] = [];
    scheduler.schedule(() => calls.push("replaceable"));
    scheduler.schedule(() => calls.push("independent"), 10, false);

    scheduler.flush();

    assert.deepEqual(calls, ["replaceable", "independent"]);
    assert.deepEqual(fixture.cleared, [1, 2]);
    assert.equal(fixture.callbacks.size, 0);
});
