/**
 * dragTip.guard.ts - DragTip 模块类型守卫
 *
 * 用途：提供 DragTip 模块所需的运行时类型守卫，
 *       避免在业务文件中使用 `is` 关键字和 `as` 断言
 * 使用范围：仅在 dragTip.ts 内部使用
 * 解耦评估：独立守卫文件，不引入循环依赖
 */
import type { DragTipState, DragTipGhost } from "./dragTip.types";

/**
 * 判断未知值是否为 DragTipState 类型
 * @显式返回类型原因: 类型守卫必须返回 boolean 类型断言签名
 */
export const isDragTipState = (target: unknown): target is DragTipState => {
    if (typeof target !== "object" || target === null) {
        return false;
    }
    const obj = target as Record<string, unknown>;
    return typeof obj.rafId === "number"
        && typeof obj.title === "string"
        && typeof obj.action === "string"
        && typeof obj.position === "object" && obj.position !== null
        && (obj.element === null || obj.element instanceof HTMLElement)
        && (obj.titleElement === null || obj.titleElement instanceof HTMLElement)
        && (obj.actionElement === null || obj.actionElement instanceof HTMLElement)
        && typeof obj.lastTitle === "string"
        && typeof obj.lastAction === "string"
        && typeof obj.width === "number"
        && typeof obj.height === "number"
        && isDragTipGhostOrNull(obj.ghost);
};

/**
 * 判断未知值是否为 DragTipGhost 或 null
 * @显式返回类型原因: 类型守卫必须返回 boolean 类型断言签名
 */
export const isDragTipGhostOrNull = (target: unknown): target is DragTipGhost | null => {
    if (target === null) {
        return true;
    }
    if (typeof target !== "object") {
        return false;
    }
    const obj = target as Record<string, unknown>;
    return typeof obj.width === "number"
        && typeof obj.height === "number"
        && typeof obj.offsetX === "number"
        && typeof obj.offsetY === "number";
};

/**
 * 判断未知值是否为 HTMLElement 或 null
 * @显式返回类型原因: 类型守卫必须返回 boolean 类型断言签名
 */
export const isHTMLElementOrNull = (target: unknown): target is HTMLElement | null => {
    return target === null || target instanceof HTMLElement;
};
