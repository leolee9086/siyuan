/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 创建一个节流函数，在 wait 秒内最多执行 fn 一次。
 * @param func 要节流的函数.
 * @param wait 节流的时间间隔，单位为毫秒.
 * @returns 返回一个新的节流化函数.
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T, 
    wait: number
): (...args: Parameters<T>) => ReturnType<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: Parameters<T> | null = null;
    let lastThis: any = null;
    let result: ReturnType<T>;
    let previous = 0;

    function later() {
        previous = Date.now();
        timeoutId = null;
        result = func.apply(lastThis, lastArgs as Parameters<T>);
        if (!timeoutId) {
            lastArgs = lastThis = null;
        }
    }

    return function(...args: Parameters<T>): ReturnType<T> {
        const now = Date.now();
        if (!previous) {
            previous = now;
        }

        const remaining = wait - (now - previous);
        lastArgs = args;
        lastThis = this;

        if (remaining <= 0 || remaining > wait) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            previous = now;
            result = func.apply(lastThis, lastArgs as Parameters<T>);
            if (!timeoutId) {
                lastArgs = lastThis = null;
            }
        } else if (!timeoutId) {
            timeoutId = setTimeout(later, remaining);
        }

        return result;
    };
} 