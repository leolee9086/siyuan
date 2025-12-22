/**
 * embedPinToSidebar 模块的类型守卫
 */

/**
 * 类型守卫：检查是否为可索引的对象
 */
export const isRecordObject = (value: unknown): value is Record<string, unknown> => {
    return value !== null && typeof value === "object" && !Array.isArray(value);
};
