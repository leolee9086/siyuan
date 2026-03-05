/**
 * 用途：提供 Tab 类型定义，用于 isTab 类型守卫函数的运行时类型检查
 * 使用范围：本文件的 isTab 函数，用于判断实例是否为 Tab 类
 * 解耦评估：依赖布局系统核心类型，当前无法解耦
 */
import { Tab } from "./imports";

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
 * 类型守卫函数，用于判断实例是否为 Tab 类
 * @param instance 待检测实例
 * @returns 是否为 Tab 实例
 */
export const isTab = (instance: unknown): instance is Tab => {
    return instance instanceof Tab;
};
