/** 用途：约束内核剪贴板准备结果；使用范围：运行时响应守卫；解耦评估：纯类型依赖，必须与业务结构共享以避免不安全断言。 */
import type {IRichClipboardPrepared} from "./types";

/** 判断未知值是否为可读取属性的对象，供后续结构守卫复用。 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object";

/** 判断单个资源映射是否包含可用索引和路径。 */
const isPreparedAsset = (value: unknown): value is {index: number; path: string} => {
    if (!isRecord(value)) {
        return false;
    }
    return typeof value.index === "number" && typeof value.path === "string";
};

/** 校验内核返回的富文本剪贴板准备结果，避免未经检查的数据进入替换流程。 */
export const isRichClipboardPrepared = (value: unknown): value is IRichClipboardPrepared => {
    if (!isRecord(value) || typeof value.batch !== "string" || value.batch.length === 0 || !Array.isArray(value.groups) ||
        !Array.isArray(value.assets)) {
        return false;
    }
    return value.groups.every(item => typeof item === "string") && value.assets.every(isPreparedAsset);
};

/** 判断内核 HTTP 响应是否为可继续解析的成功信封。 */
export const isRichClipboardResponse = (value: unknown): value is {code: number; data: unknown} => {
    if (!isRecord(value)) {
        return false;
    }
    return typeof value.code === "number" && "data" in value;
};
