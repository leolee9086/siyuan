/**
 * 用途：文件操作响应守卫。
 * 使用范围：复制、移动和删除仓储的 API 边界。
 * 解耦评估：响应解析依赖基础记录守卫和单项操作守卫；两者是同一领域契约，拆开会重复并造成边界漂移。
 */
import {isRecord} from "./FileBrowser.guards";
/**
 * 用途：复用单项操作响应校验。
 * 使用范围：批量响应的成功项解析。
 * 解耦评估：该函数是同一响应契约的基础解析，参数传递不能替代其结构校验而不产生重复实现。
 */
import {parseFileBrowserOperationResult} from "./FileBrowser.guards";
/**
 * 用途：批量删除结果领域类型。
 * 使用范围：删除仓储和批量交互状态。
 * 解耦评估：类型只描述 API 数据，不承载运行时依赖，保留独立类型导入以维持领域边界。
 */
import type {FileBrowserBatchDeleteResult} from "./FileBrowser.types";
/**
 * 用途：批量逐项结果领域类型。
 * 使用范围：复制和移动仓储响应。
 * 解耦评估：类型是操作仓储与 UI 状态之间的稳定契约，不能由调用方临时推导替代。
 */
import type {FileBrowserBatchOperationItemResult} from "./FileBrowser.types";
/**
 * 用途：批量复制/移动结果领域类型。
 * 使用范围：复制和移动仓储响应。
 * 解耦评估：类型保持批量部分成功语义，避免 UI 重新拼接服务端结果。
 */
import type {FileBrowserBatchOperationResult} from "./FileBrowser.types";

/** 批量响应支持的操作集合，与后端逐项 result.operation 保持一致。 */
type BatchOperation = "copy" | "move" | "delete";

/** 判断批量计数是否为非负整数，避免服务端计数污染成功/失败状态。 */
/** @显式返回类型原因: 类型谓词必须把已验证的计数收窄为 number，供结果包络返回。 */
function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** 解析批量响应中的失败项，保持错误码和用户可见消息的显式契约。 */
function parseBatchFailure(value: unknown, label: string) {
    if (value === undefined) {
        return undefined;
    }
    if (!isRecord(value) || typeof value.code !== "string" || typeof value.message !== "string") {
        throw new Error(`${label}响应格式错误：错误项格式错误`);
    }
    return {code: value.code, message: value.message};
}

/** 解析批量响应中的成功项，并验证其操作类型与当前端点一致。 */
function parseBatchSuccess(value: unknown, operation: BatchOperation, label: string) {
    if (value === undefined) {
        return undefined;
    }
    const result = parseFileBrowserOperationResult(value);
    if (result.operation !== operation) {
        throw new Error(`${label}响应格式错误：操作类型错误`);
    }
    return result;
}

/** 解析一个批量项，保证 request 与 result/error 的互斥关系。 */
function parseBatchItem(value: unknown, operation: BatchOperation, label: string): FileBrowserBatchOperationItemResult {
    if (!isRecord(value) || !isRecord(value.request) || typeof value.request.rootID !== "string" ||
        typeof value.request.path !== "string") {
        throw new Error(`${label}响应格式错误`);
    }
    const result = parseBatchSuccess(value.result, operation, label);
    const error = parseBatchFailure(value.error, label);
    if ((result === undefined) === (error === undefined)) {
        throw new Error(`${label}响应格式错误`);
    }
    return {
        request: {rootID: value.request.rootID, path: value.request.path},
        ...(result ? {result} : {}),
        ...(error ? {error} : {}),
    };
}

/** 解析批量响应总包络，保留服务端部分成功计数和逐项结果。 */
function parseBatchOperationResult(value: unknown, operation: BatchOperation, label: string) {
    if (!isRecord(value) || !Array.isArray(value.items) || !isNonNegativeInteger(value.successCount) ||
        !isNonNegativeInteger(value.failureCount) || value.successCount + value.failureCount !== value.items.length) {
        throw new Error(`${label}响应格式错误`);
    }
    const items = value.items.map(item => parseBatchItem(item, operation, label));
    return {items, successCount: value.successCount, failureCount: value.failureCount};
}

/** 校验批量删除的逐项结果，避免把服务端任意 JSON 交给选择状态。 */
// @柯里化: 公开稳定入口绑定删除操作和错误标签，供仓储按领域语义调用。
export const parseFileBrowserBatchDeleteResult = (value: unknown): FileBrowserBatchDeleteResult =>
    parseBatchOperationResult(value, "delete", "批量删除");

/** 校验批量复制的逐项结果，保留服务端部分成功语义。 */
// @柯里化: 公开稳定入口绑定复制操作和错误标签，供仓储按领域语义调用。
export const parseFileBrowserBatchCopyResult = (value: unknown): FileBrowserBatchOperationResult =>
    parseBatchOperationResult(value, "copy", "批量复制");

/** 校验批量移动的逐项结果，保留服务端部分成功语义。 */
// @柯里化: 公开稳定入口绑定移动操作和错误标签，供仓储按领域语义调用。
export const parseFileBrowserBatchMoveResult = (value: unknown): FileBrowserBatchOperationResult =>
    parseBatchOperationResult(value, "move", "批量移动");
