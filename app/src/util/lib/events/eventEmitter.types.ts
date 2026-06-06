/** 用途：Zod 校验库的 ZodRawShape/ZodObject/ZodError 等类型。使用范围：事件定义、数据类型推断和运行时校验配置。解耦评估：通过目录 imports.ts 转发，可替换为其他校验库。 */
import { z } from "./imports";

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
 * 允许同步监听器和返回 Promise 的异步监听器共存。
 */
export type EventListener<T extends IEventDefines, K extends keyof T> =
    (data: EventData<T, K>) => void | Promise<void>;

/**
 * 取消订阅函数类型
 *
 * 用于表示一次订阅对应的释放函数，调用后应移除已注册监听器。
 */
export type EventUnsubscribe = () => void;

/**
 * 事件元字段
 *
 * 用于约束跨进程/跨端事件链路的统一标识字段。
 * 其中 `eventId` 用于幂等与追踪，`seq` 用于顺序判断。
 */
export interface EventMeta {
    /** 事件唯一标识 */
    eventId: string;
    /** 事件序号（单调递增） */
    seq: number;
}

/**
 * 带元字段的事件载荷类型
 *
 * 在原始事件数据上叠加 `eventId/seq` 约束。
 */
export type EventDataWithMeta<T extends IEventDefines, K extends keyof T> =
    EventData<T, K> & EventMeta;

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
