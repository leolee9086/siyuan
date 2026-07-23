/** 用途：ITabInitData 页签初始化数据类型。使用范围：编辑器初始化类型守卫。解耦评估：类型导入，不涉及运行时耦合。 */
import type { ITabInitData } from "./types";

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

/** 判断值是否包含数据库行页签的稳定身份字段。 */
export const isDatabaseRowTabData = (value: unknown): value is {avID: string; itemID: string} => {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const data = value as Record<string, unknown>;
    return typeof data.avID === "string" && typeof data.itemID === "string";
};
