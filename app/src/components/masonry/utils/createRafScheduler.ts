/**
 * @file
 * This file provides a scheduler function that uses requestAnimationFrame (rAF)
 * to batch multiple function calls into a single execution per frame.
 * This is highly optimized for performance-critical tasks like layout updates,
 * ensuring that the UI remains smooth and responsive. It prevents layout thrashing
 * by synchronizing updates with the browser's rendering cycle.
 * The implementation includes a `cancel` method to abort scheduled updates.
 */

/**
 * The wrapped function that can be called with any arguments and returns the frame ID.
 */
type WrapperFn = (...args: any[]) => number;

/**
 * A type defining the `cancel` method.
 */
type CancelFn = {
  cancel: () => void;
};

/**
 * The resulting scheduled function, which is a combination of the wrapper and the canceller.
 */
export type ScheduledFn = WrapperFn & CancelFn;

/**
 * Creates a scheduler that batches calls to the given function into a single
 * `requestAnimationFrame` call.
 *
 * @param fn The function to schedule.
 * @returns A new function that, when called, will schedule the original function to run on the
 * next animation frame. It also includes a `.cancel()` method to abort the scheduled execution.
 */
export function createRafScheduler(fn: (...args: any[]) => void): ScheduledFn {
  let lastArgs: any[] = [];
  let frameId: number | null = null;

  const wrapperFn: WrapperFn = (...args: any[]): number => {
    // Always capture the latest arguments for the function call.
    lastArgs = args;

    // If a frame is already scheduled, do nothing and let it proceed.
    // The scheduled function will run with the latest `lastArgs`.
    if (frameId !== null) {
      return frameId;
    }

    // Schedule a new frame.
    frameId = requestAnimationFrame(() => {
      frameId = null; // Clear the frame ID before execution.
      fn(...lastArgs);
    });

    return frameId;
  };

  /**
   * Cancels the currently scheduled animation frame, if one exists.
   */
  const cancelFn = () => {
    if (frameId === null) {
      return;
    }

    cancelAnimationFrame(frameId);
    frameId = null;
  };

  // Attach the cancel method to the wrapper function.
  (wrapperFn as ScheduledFn).cancel = cancelFn;

  return wrapperFn as ScheduledFn;
} 