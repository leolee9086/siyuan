/**
 * 检查值是否为字符串数组
 * @param value 需要检查的值
 * @returns 是否为字符串数组
 */
export const isStringArray = (value: unknown): value is string[] => {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
};
