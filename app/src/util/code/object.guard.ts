/**
 * 通用的对象类型守卫
 */

/**
 * 判断是否为普通对象
 */
export const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};

/**
 * 判断是否为 ECharts 系列数据项
 */
export const isSeriesItem = (value: unknown): value is { type?: string } => {
    if (!isRecord(value)) {
        return false;
    }
    return typeof value.type === "string" || value.type === undefined;
};

/**
 * 判断是否为 ECharts 系列数据数组
 */
export const isSeriesArray = (value: unknown): value is Array<{ type?: string }> => {
    if (!Array.isArray(value)) {
        return false;
    }
    return value.every(isSeriesItem);
};
