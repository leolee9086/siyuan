/**
 * @fileoverview 配置加载器类型守卫
 * @description 提供JSON解析结果的类型安全转换
 */

/**
 * 判断未知值是否为Record对象
 * @param value - 待检查的值
 * @returns 是否为非数组的对象类型
 */
export function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

/**
 * 从未知值中安全提取字符串数组
 * @param value - 待检查的值
 * @returns 仅包含字符串元素的数组，非数组输入返回空数组
 */
export function extractStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item): item is string => typeof item === "string");
}
