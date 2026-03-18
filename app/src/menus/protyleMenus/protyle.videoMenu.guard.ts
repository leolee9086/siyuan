/**
 * IMenu允许的type值
 */
const VALID_MENU_TYPES = ["separator", "submenu", "readonly", "empty"];

/**
 * 类型守卫：检查是否为HTMLTextAreaElement
 */
export function isHTMLTextAreaElement(element: EventTarget | null): element is HTMLTextAreaElement {
    return element instanceof HTMLTextAreaElement;
}

/**
 * 检查单个对象是否符合IMenu接口
 */
function isValidMenuItem(item: unknown): boolean {
    if (typeof item !== "object" || item === null) {
        return false;
    }
    const menu = item as Record<string, unknown>;
    if (menu.checked !== undefined && typeof menu.checked !== "boolean") {
        return false;
    }
    if (menu.iconClass !== undefined && typeof menu.iconClass !== "string") {
        return false;
    }
    if (menu.label !== undefined && typeof menu.label !== "string") {
        return false;
    }
    if (menu.type !== undefined && !VALID_MENU_TYPES.includes(menu.type as string)) {
        return false;
    }
    if (menu.accelerator !== undefined && typeof menu.accelerator !== "string") {
        return false;
    }
    if (menu.action !== undefined && typeof menu.action !== "string") {
        return false;
    }
    if (menu.id !== undefined && typeof menu.id !== "string") {
        return false;
    }
    if (menu.disabled !== undefined && typeof menu.disabled !== "boolean") {
        return false;
    }
    if (menu.icon !== undefined && typeof menu.icon !== "string") {
        return false;
    }
    if (menu.iconHTML !== undefined && typeof menu.iconHTML !== "string") {
        return false;
    }
    if (menu.current !== undefined && typeof menu.current !== "boolean") {
        return false;
    }
    if (menu.index !== undefined && typeof menu.index !== "number") {
        return false;
    }
    if (menu.ignore !== undefined && typeof menu.ignore !== "boolean") {
        return false;
    }
    if (menu.warning !== undefined && typeof menu.warning !== "boolean") {
        return false;
    }
    return true;
}

/**
 * 类型守卫：检查是否为IMenu数组
 * @作用 验证值是否为有效的IMenu数组
 */
export function isMenuArray(value: unknown): value is IMenu[] {
    if (!Array.isArray(value)) {
        return false;
    }
    if (value.length === 0) {
        return true;
    }
    // @内联回调
    return value.every((item) => isValidMenuItem(item));
}
