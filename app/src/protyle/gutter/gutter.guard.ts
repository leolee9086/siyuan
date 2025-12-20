/**
 * Gutter 模块类型守卫
 */

import type { IProgressStatusUpdater } from "./gutter.types";

/**
 * 类型守卫：判断对象是否为 IProgressStatusUpdater
 */
export function isProgressStatusUpdater(obj: unknown): obj is IProgressStatusUpdater {
    if (obj === null || typeof obj !== "object") {
        return false;
    }
    const candidate = obj as Record<string, unknown>;
    return candidate.updateStatus === undefined || typeof candidate.updateStatus === "function";
}
