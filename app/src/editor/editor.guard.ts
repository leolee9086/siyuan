import { ITabInitData } from "./types";

/**
 * 判断是否为 ITabInitData 类型
 *
 * 作用：类型守卫，确保解析后的 JSON 对象符合 ITabInitData 结构。
 *
 * @param obj - 需要检查的对象
 */
export const isTabInitData = (obj: unknown): obj is ITabInitData => {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const data = obj as Record<string, unknown>;
    return typeof data.instance === "string";
};
