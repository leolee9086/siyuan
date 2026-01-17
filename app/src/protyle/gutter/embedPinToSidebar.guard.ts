/**
 * embedPinToSidebar 模块的类型守卫
 */

/**
 * 类型守卫：检查是否为可索引的对象
 */
export const isRecordObject = (value: unknown): value is Record<string, unknown> => {
    return value !== null && typeof value === "object" && !Array.isArray(value);
};

/**
 * 类型守卫：检查是否为 CustomListI18n 对象
 */
export const isCustomListI18n = (value: unknown): value is { pinEmbedResult?: string; pinEmbedQuery?: string } => {
    if (!isRecordObject(value)) {
        return false;
    }
    const { pinEmbedResult, pinEmbedQuery } = value;
    if (pinEmbedResult !== undefined && typeof pinEmbedResult !== "string") {
        return false;
    }
    if (pinEmbedQuery !== undefined && typeof pinEmbedQuery !== "string") {
        return false;
    }
    return true;
};

/**
 * 类型守卫：检查对象是否包含 customList 属性
 */
export const hasCustomList = (value: unknown): value is { customList: unknown } => {
    return isRecordObject(value) && "customList" in value;
};
