/**
 * dock.guard.ts - Dock 模块类型守卫
 * 用于替代 as 类型断言，提供运行时类型检查
 */

import { Wnd } from "../Wnd";
import type { Layout } from "../index";

const DOCK_TYPES = ["file", "outline", "inbox", "bookmark", "tag", "graph", "globalGraph", "backlink", "embedding_dock"];

/**
 * 判断布局子元素是否为 Wnd
 */
export function isWnd(child: Layout | Wnd | unknown): child is Wnd {
    return child instanceof Wnd;
}

/**
 * 判断类型字符串是否为有效的 TDock 类型
 */
export function isTDock(type: string | null | undefined): type is TDock {
    return type !== null && type !== undefined && (DOCK_TYPES.includes(type) || type.startsWith("custom_list:"));
}

const checkString = (val: unknown) => val === undefined || typeof val === "string";
const checkBoolean = (val: unknown) => val === undefined || typeof val === "boolean";
const checkArrayString = (val: unknown) => val === undefined || (Array.isArray(val) && val.every(i => typeof i === "string"));

const isOperation = (item: unknown): item is IOperation => {
    if (typeof item !== "object" || item === null) {
        return false;
    }
    const op = item as Record<string, unknown>;
    // 核心属性校验
    if (typeof op.action !== "string") {
        return false;
    }
    // 详细属性校验（基于 IOperation 接口定义）
    return checkString(op.id) &&
        checkString(op.blockID) &&
        checkBoolean(op.isTwoWay) &&
        checkString(op.backRelationKeyID) &&
        checkString(op.avID) &&
        checkString(op.format) &&
        checkString(op.keyID) &&
        checkString(op.rowID) &&
        checkString(op.parentID) &&
        checkString(op.previousID) &&
        checkString(op.nextID) &&
        checkBoolean(op.isDetached) &&
        checkArrayString(op.srcIDs) &&
        checkBoolean(op.ignoreDefaultFill) &&
        checkString(op.viewID) &&
        checkString(op.name) &&
        checkString(op.type) &&
        checkString(op.deckID) &&
        checkArrayString(op.blockIDs) &&
        checkBoolean(op.removeDest) &&
        checkString(op.layout) &&
        checkString(op.groupID) &&
        checkString(op.targetGroupID);
};

/**
 * 判断是否为操作接口数组
 */
export function isOperations(data: unknown): data is IOperation[] {
    if (!Array.isArray(data)) {
        return false;
    }
    return data.every(isOperation);
}

/**
 * 判断是否为块树数据数组（用于Tag等面板的数据）
 * 这是一个宽松的类型守卫，只验证基本结构
 */
export function isBlockTreeArray(data: unknown): data is IBlockTree[] {
    if (!Array.isArray(data)) {
        return false;
    }
    // 空数组视为有效
    if (data.length === 0) {
        return true;
    }
    // 检查第一个元素是否具有IBlockTree的基本结构
    const first = data[0];
    if (typeof first !== "object" || first === null) {
        return false;
    }
    // IBlockTree至少应该有这些属性之一
    const item = first as Record<string, unknown>;
    return typeof item.id === "string" || typeof item.name === "string" || typeof item.label === "string";
}

/**
 * 判断是否为 HTMLElement
 */
export function isHTMLElement(element: unknown): element is HTMLElement {
    return element instanceof HTMLElement;
}
