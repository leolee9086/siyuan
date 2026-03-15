/**
 * MagiMainPanel 组件类型守卫
 *
 * 提供消息元数据的类型守卫，避免使用 'as' 断言。
 */

// [TASK] T3.2 迁移主面板组件 - MagiMainPanel守卫

import type { MagiMainPanelMessageView } from "../../entry/magiView.types";

/**
 * 投票详情项类型守卫
 */
export function isVoteDetail(
    obj: unknown
): obj is { name: string; decision: string } {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const o = obj as Record<string, unknown>;
    return (
        typeof o.name === "string" &&
        typeof o.decision === "string"
    );
}

/**
 * 投票状态元数据类型守卫
 */
export function isVoteStatusMeta(
    meta: unknown
): meta is {
    type: "vote-status";
    progress?: number;
    details?: Array<{ name: string; decision: string }>;
    deliberationInitiator?: string;
    deliberationReason?: string;
} {
    if (typeof meta !== "object" || meta === null) {
        return false;
    }
    const m = meta as Record<string, unknown>;
    if (m.type !== "vote-status") {
        return false;
    }
    if (m.progress !== undefined && typeof m.progress !== "number") {
        return false;
    }
    if (m.details !== undefined && Array.isArray(m.details)) {
        for (const item of m.details) {
            if (!isVoteDetail(item)) {
                return false;
            }
        }
    }
    if (m.deliberationInitiator !== undefined && typeof m.deliberationInitiator !== "string") {
        return false;
    }
    if (m.deliberationReason !== undefined && typeof m.deliberationReason !== "string") {
        return false;
    }
    return true;
}

/**
 * SSE 流消息元数据类型守卫
 */
export function isSseStreamMeta(
    meta: unknown
): meta is { progress?: number } {
    if (typeof meta !== "object" || meta === null) {
        return false;
    }
    const m = meta as Record<string, unknown>;
    // progress 字段可选，若存在必须为数字
    if (m.progress !== undefined && typeof m.progress !== "number") {
        return false;
    }
    return true;
}

/**
 * 检查元数据是否包含数值型进度字段
 */
export function hasNumericProgressMeta(
    meta: unknown
): meta is { progress: number } {
    if (typeof meta !== "object" || meta === null) {
        return false;
    }
    const candidate = meta as Record<string, unknown>;
    return typeof candidate.progress === "number";
}

/**
 * 从元数据中读取进度百分比
 */
export function getNumericProgressMeta(
    meta: unknown
): number | undefined {
    if (!hasNumericProgressMeta(meta)) {
        return undefined;
    }
    return meta.progress;
}

/**
 * 消息是否为流式消息
 */
export function isSseStreamMessage(
    msg: MagiMainPanelMessageView
): msg is MagiMainPanelMessageView & { type: "sse_stream"; meta?: { progress?: number } } {
    return msg.type === "sse_stream";
}

/**
 * 获取安全的投票状态元数据
 */
export function getVoteStatusMeta(
    msg: MagiMainPanelMessageView
): {
    type: "vote-status";
    progress?: number;
    details?: Array<{ name: string; decision: string }>;
} | null {
    const meta = msg.meta;
    if (isVoteStatusMeta(meta)) {
        return meta;
    }
    return null;
}

/**
 * 获取安全的 SSE 流消息进度
 */
export function getSseStreamProgress(
    msg: MagiMainPanelMessageView
): number | undefined {
    if (isSseStreamMessage(msg) && isSseStreamMeta(msg.meta)) {
        return msg.meta.progress;
    }
    return undefined;
}
