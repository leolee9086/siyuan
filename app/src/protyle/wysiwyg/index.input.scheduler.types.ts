/** Timer capability used by the pending-input state machine. */
export interface InputTimerPort {
    clear: (handle: number) => void;
    schedule: (callback: () => void, delay: number) => number;
}
