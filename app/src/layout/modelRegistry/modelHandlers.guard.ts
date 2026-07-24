/** 用途：Model handlers 契约；使用范围：读取全局注册值后的运行时校验；解耦评估：纯类型依赖。 */
import type { IModelHandlers } from "./types";

/** 在能力所有者边界校验注册值，避免错误注册导致 WebSocket 消息静默丢失。 */
export function isModelHandlers(value: unknown): value is IModelHandlers {
    if (!value || typeof value !== "object") {
        return false;
    }
    const handlers = value as Record<string, unknown>;
    return typeof handlers.processMessage === "function"
        && typeof handlers.kernelError === "function"
        && typeof handlers.reloadSync === "function";
}
