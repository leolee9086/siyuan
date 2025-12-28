import { Tab } from "../layout/Tab";

/**
 * 类型守卫函数，用于判断响应数据是否为 IEmoji 数组
 * @param data 待检测数据
 * @returns 是否为 IEmoji 数组
 */
export const isEmojiArray = (data: unknown): data is IEmoji[] => {
    return Array.isArray(data);
};

/**
 * 类型守卫函数，用于判断实例是否为 Tab 类
 * @param instance 待检测实例
 * @returns 是否为 Tab 实例
 */
export const isTab = (instance: unknown): instance is Tab => {
    return instance instanceof Tab;
};
