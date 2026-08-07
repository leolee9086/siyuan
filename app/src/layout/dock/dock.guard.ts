/**
 * dock.guard.ts - Dock 模块类型守卫
 * 用于替代 as 类型断言，提供运行时类型检查
 */

/** 用途：布局窗口外观类型。使用范围：dock.guard 类型守卫。解耦评估：仅依赖稳定领域契约，不加载具体 Wnd 实现。 */
import type { LayoutWindow } from "./imports";
/** 用途：布局窗口外观守卫。使用范围：dock.guard 类型守卫。解耦评估：复用布局领域统一结构守卫。 */
import { isLayoutWindow } from "./imports";
/** 用途：Model 构造函数/工厂函数类型。使用范围：dock.guard 类型守卫。 */
import type { ModelConstructor } from "./dock.types";
/** 用途：Model 工厂函数类型。使用范围：dock.guard 类型守卫。 */
import type { ModelFactory } from "./dock.types";
/** 用途：布局模型结构守卫。使用范围：Dock 数据结构守卫。解耦评估：通过 imports.ts 转发最小契约守卫，不依赖具体 Model 类。 */
import { isLayoutModel } from "./imports";
/** 用途：自定义列表类型。使用范围：dock.guard 类型检查。 */
import type {ICustomList} from "./customBlockLists/customLists.types";
/** 用途：DOM 元素类型守卫。使用范围：dock.guard 类型检查。解耦评估：通过 imports.ts 转发。 */
import { isStylableElement } from "./imports";
/** 用途：HTMLElement 类型守卫。使用范围：dock.guard 类型检查。解耦评估：通过 imports.ts 转发。 */
import { isHTMLElement } from "./imports";
/** 用途：复用内建 Dock 类型注册；使用范围：持久化布局边界。 */
import {isBuiltinDockType} from "./dock.builtin";

/** 导出 DOM 类型守卫，供外部模块使用 */
export { isStylableElement, isHTMLElement };

/**
 * 判断是否为 Model 构造函数
 * 
 * 作用：检查给定的 factory 是否为类构造函数。
 * 意图：区分 MODEL_FACTORIES 中的函数式工厂和类式工厂。
 * 调用时机：在 createModel 中实例化 Model 时调用。
 */
export function isModelConstructor<TApplication, TTab, TEditor, TData>(
    factory: ModelFactory<TApplication, TTab, TEditor, TData> | ModelConstructor<TApplication, TTab, TEditor, TData>
): factory is ModelConstructor<TApplication, TTab, TEditor, TData> {
    return !!factory.prototype;
}

/** 导出统一布局模型结构守卫，供 Dock 模块使用。 */
export { isLayoutModel };


/**
 * 判断布局子元素是否具备窗口外观。
 *
 * 作用：通过布局领域的稳定公开能力识别窗口，不依赖具体实现类的原型身份。
 * 意图：在布局树遍历或操作时区分窗口节点和其他节点，并允许兼容实现提供同一窗口契约。
 * 调用时机：在处理 Dock 布局结构、查找特定窗口或进行布局调整时调用。
 */
export function isWnd(child: unknown): child is LayoutWindow {
    return typeof child === "object" && child !== null && isLayoutWindow(child);
}

/**
 * 判断类型字符串是否为有效的 TDock 类型。
 * 
 * 作用：验证给定的字符串是否属于预定义的核心 Dock 类型列表，或者是自定义列表类型（custom_list: 前缀）。
 * 意图：确保传入的 Dock 类型参数是系统支持的合法值，防止非法类型导致的渲染或逻辑错误。
 * 调用时机：在创建 Dock、解析配置或处理 Dock 相关事件时调用。
 */
export function isTDock(type: string | null | undefined): type is TDock {
    return type !== null && type !== undefined && (isBuiltinDockType(type) || type.startsWith("custom_list:"));
}

/** @简洁函数 这是一个简单的 undefined 或 string 类型检查辅助函数 */
const checkString = (val: unknown) => val === undefined || typeof val === "string";

/** @简洁函数 这是一个简单的 undefined 或 boolean 类型检查辅助函数 */
const checkBoolean = (val: unknown) => val === undefined || typeof val === "boolean";

/** @简洁函数 这是一个简单的 undefined 或 纯字符串数组 类型检查辅助函数 */
const checkArrayString = (val: unknown) => val === undefined || (Array.isArray(val) && val.every(i => typeof i === "string"));

/**
 * 校验对象是否符合 IOperation 接口结构。
 *
 * 作用：运行时检查对象是否具有 IOperation 接口要求的所有核心属性和正确的数据类型。
 * 意图：在处理操作数据时提供强类型保证，确保数据的完整性和类型安全。
 * 调用时机：通常由 `isOperations` 内部调用，用于验证单个操作对象。
 * 问题/改进：校验逻辑与 IOperation 接口定义紧密耦合，如果接口变更，此处需同步更新。
 */
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
 * 判断是否为操作接口数组。
 * 
 * 作用：验证输入数据是否为数组，且数组中的每个元素都符合 IOperation 接口定义。
 * 意图：用于批量验证操作数据，确保整个操作序列的数据结构正确。
 * 调用时机：在接收或处理批量操作指令（如事务处理、同步数据）时调用。
 */
export function isOperations(data: unknown): data is IOperation[] {
    if (!Array.isArray(data)) {
        return false;
    }
    return data.every(isOperation);
}

/**
 * 判断是否为块树数据数组（用于Tag等面板的数据）。
 * 
 * 作用：检查数据是否为数组，并验证其是否具备 IBlockTree 的基本特征。
 * 意图：为标签页等面板的数据提供宽松的类型检查，防止完全格式错误的数据导致渲染崩溃。
 * 调用时机：在加载或刷新 Tag、Backlink 等面板数据时调用。
 * 问题/改进：
 * 1. 这是一个宽松的类型守卫，只验证了数组结构和第一个元素的基本属性，不能保证所有元素都有效。
 * 2. 依赖于第一个非空元素的检查，如果数组为空则直接视为有效（根据业务逻辑可能是允许的）。
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
 * 判断值是否为有效的 TDockPosition。
 *
 * 作用：检查字符串是否属于预定义的 Dock 位置枚举值。
 * 调用时机：由 isDockTypeRegistryMap 内部调用，验证 Map 值的类型。
 */
function isTDockPosition(value: unknown): value is TDockPosition {
    return value === "Left" || value === "Right" || value === "Bottom";
}

/**
 * 判断是否为 Dock 类型注册表 Map。
 * @AIDONE 现在会正确验证 Map 中的每个值都是有效的 TDockPosition
 * 作用：安全地将 getSForgeState 返回的联合类型收窄为 Map<string, TDockPosition>。
 * 意图：通过运行时检查 Map 中的每个条目，确保 key 为 string，value 为有效的 TDockPosition。
 * 调用时机：在 dock.registry.ts 中获取类型注册表时调用。
 * 注意：对于空 Map 直接返回 true，因为空 Map 是有效的类型注册表初始状态。
 */
export function isDockTypeRegistryMap(target: unknown): target is Map<string, TDockPosition> {
    if (!(target instanceof Map)) {
        return false;
    }
    // 验证 Map 中的每个条目
    for (const [key, value] of target.entries()) {
        if (typeof key !== "string") {
            return false;
        }
        if (!isTDockPosition(value)) {
            return false;
        }
    }
    return true;
}


/**
 * 校验数据是否为 ICustomList
 * 
 * 作用：类型守卫
 * 意图：替代 as 断言，确保数据类型安全
 * 调用时机：initCustomList 中
 */
export const isICustomList = (data: unknown): data is ICustomList => {
    return typeof data === "object" && data !== null && "id" in data;
};
