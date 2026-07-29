/** 检查内核本地存储响应是否为可迁移的键值对象。 */
export const isLocalStoragePayload = (value: unknown): value is NonNullable<ISiyuan["storage"]> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
