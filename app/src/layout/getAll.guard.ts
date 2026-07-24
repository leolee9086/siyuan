/**
 * 布局停靠栏接口定义
 * 对应 Config.IUILayoutDock，但包含 layout 属性用于运行时布局对象
 */
interface ILayoutDock<TLayout extends object> {
    layout?: TLayout;
}

/**
 * 带有停靠栏的布局接口
 */
export interface ILayoutWithDocks<TLayout extends object> {
    layout?: TLayout;
    centerLayout?: TLayout;
    left?: ILayoutDock<TLayout>;
    right?: ILayoutDock<TLayout>;
    bottom?: ILayoutDock<TLayout>;
}

/**
 * 类型守卫：检查 dock 对象是否具有 layout 属性
 * 
 * 校验逻辑：
 * 1. 检查对象是否为非空对象
 * 2. 检查是否具有 layout 属性
 * 3. 如果有 layout 属性，检查它是否为 Layout 实例或 undefined
 */
function isLayoutDock<TLayout extends object>(obj: unknown): obj is ILayoutDock<TLayout> {
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
export function hasLayoutDocks<TLayout extends object>(obj: unknown): obj is ILayoutWithDocks<TLayout> {
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
