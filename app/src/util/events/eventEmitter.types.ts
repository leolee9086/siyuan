import { z } from "zod";

/**
 * 事件定义的基础类型
 * 
 * 用于约束事件名称到其数据结构的映射，每个事件对应一个 Zod 原始形状定义。
 */
export type IEventDefines = {
    readonly [key: string]: z.ZodRawShape;
};

/**
 * 从事件定义中推断指定事件的数据类型
 * 
 * 简化类型定义，避免复杂的泛型嵌套，将 ZodRawShape 转换为实际的数据类型。
 */
export type EventData<T extends IEventDefines, K extends keyof T> =
    z.infer<z.ZodObject<T[K]>>;

/**
 * 事件监听器函数类型
 * 
 * 定义监听特定事件时的回调函数签名，接收该事件对应的数据类型。
 */
export type EventListener<T extends IEventDefines, K extends keyof T> =
    (data: EventData<T, K>) => void;

/**
 * SafeEventEmitter 的配置选项接口
 * 
 * 用于控制事件发射器的运行时验证行为，包括是否启用验证、验证失败时的处理策略等。
 * 在需要强类型安全的事件系统中使用，可以在开发环境启用严格验证，生产环境关闭以提升性能。
 */
export interface EventEmitterOptions {
    /** 是否启用运行时数据验证，默认为 false */
    runtimeCheck?: boolean;
    /** 验证失败时的处理策略：抛出异常、警告或静默忽略 */
    validationFailure?: "throw" | "warn" | "silent";
    /** 是否在每个监听器执行后重新验证数据 */
    revalidateAfterEach?: boolean;
    /** 自定义验证错误处理函数 */
    onValidationError?: (event: string, error: z.ZodError, data: unknown) => void;
}
