/**
 * fetch 模块类型守卫
 */

/**
 * 检查一个值是否符合 IWebSocketData 结构
 * @param value 待检查的值
 * @returns 是否为 IWebSocketData 类型
 */
export const isWebSocketData = (value: unknown): value is IWebSocketData => {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const obj = value as Record<string, unknown>;
    return typeof obj.msg === "string" && typeof obj.code === "number";
};
