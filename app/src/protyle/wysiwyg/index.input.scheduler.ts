import {
    clearTimeout as clearWindowTimeout,
    setTimeout as scheduleWindowTimeout,
} from "../../util/siyuanEnvironments/windowTimer.environment";
import type {InputTimerPort} from "./index.input.scheduler.types";
/** Re-export the timer contract for deterministic scheduler tests and host adapters. */
export type {InputTimerPort} from "./index.input.scheduler.types";

const browserInputTimer: InputTimerPort = {clear: clearWindowTimeout, schedule: scheduleWindowTimeout};

/** Tracks deferred editor input so Undo can commit it before reading history. */
export class PendingInputScheduler {
    private currentHandle?: number;
    private readonly pending = new Map<number, () => void>();

    /** Creates a scheduler; tests inject a deterministic timer port. */
    constructor(private readonly timer: InputTimerPort = browserInputTimer) {
    }

    /** Registers delayed input, replacing the current coalesced input by default. */
    public schedule(callback: () => void, delay = 0, replace = true) {
        // Coalesced typing must commit only its newest callback.
        if (replace && this.currentHandle !== undefined) {
            this.timer.clear(this.currentHandle);
            this.pending.delete(this.currentHandle);
        }
        const handle = this.timer.schedule(() => {
            this.pending.delete(handle);
            this.currentHandle = this.currentHandle === handle ? undefined : this.currentHandle;
            callback();
        }, delay);
        this.pending.set(handle, callback);
        if (replace) {
            this.currentHandle = handle;
        }
    }

    /** Cancels timers and synchronously commits every still-pending callback. */
    public flush() {
        const callbacks = Array.from(this.pending.values());
        for (const handle of this.pending.keys()) {
            this.timer.clear(handle);
        }
        this.pending.clear();
        this.currentHandle = undefined;
        for (const callback of callbacks) {
            callback();
        }
    }
}
