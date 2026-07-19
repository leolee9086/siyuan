/** 用途：错误占位数据契约；使用范围：恢复数据结构守卫；解耦评估：同目录纯类型依赖。 */
import type {IErrorPlaceholderData} from "./ErrorPlaceholder.types";

/** 检查数据是否满足错误占位恢复契约。 @同步豁免: 类型守卫 */
export function isErrorPlaceholderData(data: unknown): data is IErrorPlaceholderData {
    if (typeof data !== "object" || data === null) {
        return false;
    }
    const value = data as Record<string, unknown>;
    return typeof value.原始类型 === "string" && typeof value.错误信息 === "string";
}
