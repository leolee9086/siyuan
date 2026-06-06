/** 用途：Layout 布局类型。使用范围：布局停靠栏类型守卫。解耦评估：类型导入，不涉及运行时耦合。 */
import type { Layout } from "./index";

/**
 * 布局停靠栏接口定义
 * 对应 Config.IUILayoutDock，但包含 layout 属性用于运行时布局对象
 */
interface ILayoutDock {
    layout?: Layout;
}

/**
 * 带有停靠栏的布局接口
 */
export interface ILayoutWithDocks {
    layout?: Layout;
    centerLayout?: Layout;
    left?: ILayoutDock;
    right?: ILayoutDock;
    bottom?: ILayoutDock;
}

/**
 * 类型守卫：检查 dock 对象是否具有 layout 属性
 * 
 * 校验逻辑：
 * 1. 检查对象是否为非空对象
 * 2. 检查是否具有 layout 属性
 * 3. 如果有 layout 属性，检查它是否为 Layout 实例或 undefined
 */
function isLayoutDock(obj: unknown): obj is ILayoutDock {
    if (!obj || typeof obj !== "object") {
        return false;
    }
    
    const candidate = obj as Record<string, unknown>;
    
    // 如果没有 layout 属性，也是合法的（可选属性）
    if (!("layout" in candidate)) {
        return true;
    }
    
    // 如果有 layout 属性，它应该是 undefined 或对象
    const layout = candidate.layout;
    return layout === undefined || layout === null || typeof layout === "object";
}

/**
 * 验证 dock 属性是否有效
 */
function validateDockProperty(value: unknown): boolean {
    return value === undefined || value === null || isLayoutDock(value);
}

/**
 * 类型守卫：检查对象是否具有停靠栏属性
 *
 * 校验逻辑：
 * 1. 检查对象是否为非空对象
 * 2. 检查 left、right、bottom 属性（如果存在）是否符合 ILayoutDock 接口
 */
export function hasLayoutDocks(obj: unknown): obj is ILayoutWithDocks {
    if (!obj || typeof obj !== "object") {
        return false;
    }
    
    const candidate = obj as Record<string, unknown>;
    
    // 检查 left 属性
    if ("left" in candidate && !validateDockProperty(candidate.left)) {
        return false;
    }
    
    // 检查 right 属性
    if ("right" in candidate && !validateDockProperty(candidate.right)) {
        return false;
    }
    
    // 检查 bottom 属性
    if ("bottom" in candidate && !validateDockProperty(candidate.bottom)) {
        return false;
    }
    
    return true;
}
