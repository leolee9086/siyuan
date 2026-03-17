/**
 * 用途：导入SafeSourceChannel类型用于类型守卫
 * 使用范围：isSafeSourceChannel函数的返回类型
 * 解耦评估：类型定义无法解耦
 */
import type { SafeSourceChannel } from "./magiStandardLLMAdapter.types";

/**
 * 检查值是否为安全源通道类型
 * 
 * 作用：类型守卫函数，验证值是否为有效的源通道类型
 * 意图：在运行时确保源通道类型的安全性
 * 调用时机：解析源模拟上下文时验证sourceChannel字段
 * 
 * @param value - 待检查的值
 * @returns 是否为安全源通道类型
 */
export function isSafeSourceChannel(value: unknown): value is SafeSourceChannel {
    return value === "guardian"
        || value === "external-agent"
        || value === "system-cron"
        || value === "unknown";
}
