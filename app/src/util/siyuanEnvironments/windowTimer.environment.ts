/**
 * 封装 window.setTimeout
 */
export const setTimeout = (callback: () => void, ms?: number): number => {
    return window.setTimeout(callback, ms);
};

/**
 * 封装 window.clearTimeout
 */
export const clearTimeout = (timeoutId?: number): void => {
    window.clearTimeout(timeoutId);
};

/**
 * 封装 window.addEventListener
 */
export const windowAddEventListener = <K extends keyof WindowEventMap>(
    type: K,
    listener: (this: Window, ev: WindowEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions
): void => {
    window.addEventListener(type, listener, options);
};
