/**
 * 主面板聊天记录前端缓存
 *
 * 用途：在 localStorage 中暂存主面板聊天记录，用于页面刷新后快速展示历史对话。
 * 约束：此缓存仅用于前端展示层，不保证与后端记忆完全同步，每个设备独立缓存。
 *
 * 设计说明：
 * - 与微信聊天记录类似，前端展示以本地缓存为准，后端记忆才是真正数据源
 * - 不需要与后端专门同步，各设备间记录不一致是预期行为
 * - 缓存上限 200 条，避免 localStorage 溢出
 */

export interface CachedMessage {
    id: string;
    type: string;
    content: string;
    status: string;
    timestamp: number;
    meta?: Record<string, unknown>;
}

const STORAGE_KEY = "magi_main_chat_history";
const MAX_CACHED_MESSAGES = 200;

/**
 * 保存聊天记录到 localStorage
 */
export function saveChatHistory(messages: CachedMessage[]): void {
    try {
        // 只缓存最近 N 条消息，避免 localStorage 容量溢出
        const subset = messages.slice(-MAX_CACHED_MESSAGES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(subset));
    } catch (e) {
        // localStorage 不可用或已满 — 静默失败，不影响主流程
    }
}

/**
 * 从 localStorage 加载缓存的聊天记录
 */
export function loadChatHistory(): CachedMessage[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

/**
 * 清除缓存的聊天记录
 */
export function clearChatHistory(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        // 静默失败
    }
}