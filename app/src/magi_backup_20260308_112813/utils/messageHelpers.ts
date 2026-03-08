/**
 * 消息辅助工具函数
 *
 * 从 toread/MAGI/utils/messageUtils.js 引用的 toolBox 函数迁移。
 * 原 toolBox 路径不存在，此处直接实现。
 */

// [TASK] T3.1 迁移基础UI组件 - 补充MessageBubble依赖的工具函数

import type { ThinkParseResult } from "./messageHelpers.types";

const THINK_OPEN_TAG = "<think>";
const THINK_CLOSE_TAG = "</think>";

/**
 * 解析消息中的思考内容（<think>...</think> 标签）
 *
 * 将消息拆分为思考过程和普通回复两部分。
 */
export async function parseThinkContent(content: string): Promise<ThinkParseResult> {
    if (!content) {
        return { thinkContent: "", normalContent: "", hasThink: false };
    }

    const openIdx = content.indexOf(THINK_OPEN_TAG);
    if (openIdx === -1) {
        return { thinkContent: "", normalContent: content, hasThink: false };
    }

    const closeIdx = content.indexOf(THINK_CLOSE_TAG, openIdx);
    // think标签未闭合：流式响应中常见，标签后的全部内容视为正在思考中的内容
    if (closeIdx === -1) {
        const thinkContent = content.slice(openIdx + THINK_OPEN_TAG.length);
        const normalContent = content.slice(0, openIdx).trim();
        return { thinkContent, normalContent, hasThink: true };
    }

    const thinkContent = content.slice(openIdx + THINK_OPEN_TAG.length, closeIdx);
    const normalContent = (
        content.slice(0, openIdx) + content.slice(closeIdx + THINK_CLOSE_TAG.length)
    ).trim();

    return { thinkContent, normalContent, hasThink: true };
}

/**
 * 格式化时间戳为 HH:MM:SS 格式
 */
export async function formatTimestamp(
    timestamp: number | Date | undefined,
): Promise<string> {
    if (!timestamp) {
        return "";
    }
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

/**
 * 更新DOM元素的max-height以实现展开/折叠动画
 */
export async function updateElementHeight(
    element: HTMLElement,
    expanded: boolean,
): Promise<void> {
    if (!expanded) {
        element.style.maxHeight = "0";
        return;
    }
    element.style.maxHeight = `${element.scrollHeight}px`;
}
