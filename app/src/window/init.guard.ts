/**
 * 用途：提供完整布局页签类型与统一领域守卫
 * 使用范围：isTab 兼容入口的类型声明和运行时收窄
 * 解耦评估：复用 Layout 领域唯一守卫，窗口初始化无需加载具体 Tab class
 */
import {isLayoutTab} from "./imports";
/** 用途：声明 isTab 的完整页签返回类型。使用范围：窗口初始化与消息处理的静态收窄。解耦评估：纯类型依赖不加载具体实现。 */
import type {LayoutTab} from "./imports";

/**
 * 类型守卫函数，用于判断 CSSStyleDeclaration 是否支持 WebkitAppRegion 属性
 * 在 Electron 环境中，style 对象会扩展 CSSStyleDeclarationElectron 接口
 */
export const isElectronStyle = (style: CSSStyleDeclaration): style is CSSStyleDeclarationElectron => {
    return "WebkitAppRegion" in style;
};

/**
 * 类型守卫函数，用于判断单个对象是否为 IEmojiItem
 * @param item 待检测对象
 * @returns 是否为 IEmojiItem
 */
const isEmojiItem = (item: unknown): item is IEmojiItem => {
    if (typeof item !== "object" || item === null) {
        return false;
    }
    const obj = item as Record<string, unknown>;
    return (
        typeof obj.unicode === "string" &&
        typeof obj.description === "string" &&
        typeof obj.description_zh_cn === "string" &&
        typeof obj.description_ja_jp === "string" &&
        typeof obj.keywords === "string"
    );
};

/**
 * 类型守卫函数，用于判断单个对象是否为 IEmoji
 * @param item 待检测对象
 * @returns 是否为 IEmoji
 */
const isEmoji = (item: unknown): item is IEmoji => {
    if (typeof item !== "object" || item === null) {
        return false;
    }
    const obj = item as Record<string, unknown>;
    return (
        typeof obj.id === "string" &&
        typeof obj.title === "string" &&
        typeof obj.title_zh_cn === "string" &&
        typeof obj.title_ja_jp === "string" &&
        Array.isArray(obj.items) &&
        obj.items.every(isEmojiItem)
    );
};

/**
 * 类型守卫函数，用于判断响应数据是否为 IEmoji 数组
 * @param data 待检测数据
 * @returns 是否为 IEmoji 数组
 * @AIDONE 已补充完整的类型校验逻辑，递归验证 IEmoji 及其嵌套的 IEmojiItem 结构
 */
export const isEmojiArray = (data: unknown): data is IEmoji[] => {
    return Array.isArray(data) && data.every(isEmoji);
};

/**
 * 类型守卫函数，用于判断实例是否为完整布局页签
 * @param instance 待检测实例
 * @returns 是否为 Tab 实例
 */
export const isTab = (instance: unknown): instance is LayoutTab => {
    return typeof instance === "object" && instance !== null && isLayoutTab(instance);
};
