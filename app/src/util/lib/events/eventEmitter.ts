/** 用途：Zod 运行时校验库。使用范围：eventEmitter 事件数据校验。解耦评估：通过 imports.ts 转发。 */
import { z } from "./imports";
/** 用途：事件发射器选项类型。使用范围：eventEmitter 类型约束。解耦评估：同目录类型文件。 */
import type { EventEmitterOptions } from "./eventEmitter.types";
/** 用途：事件定义映射类型。使用范围：eventEmitter 泛型约束。解耦评估：同目录类型文件。 */
import type { IEventDefines } from "./eventEmitter.types";
/** 用途：事件数据类型。使用范围：eventEmitter 方法签名。解耦评估：同目录类型文件。 */
import type { EventData } from "./eventEmitter.types";
/** 用途：带元数据的事件数据类型。使用范围：eventEmitter 方法签名。解耦评估：同目录类型文件。 */
import type { EventDataWithMeta } from "./eventEmitter.types";
/** 用途：事件监听器类型。使用范围：eventEmitter 方法签名。解耦评估：同目录类型文件。 */
import type { EventListener } from "./eventEmitter.types";
/** 用途：事件退订函数类型。使用范围：eventEmitter 方法签名。解耦评估：同目录类型文件。 */
import type { EventUnsubscribe } from "./eventEmitter.types";
/** 用途：事件模式编译工具。使用范围：eventEmitter 初始化。解耦评估：同目录工具模块。 */
import { compileEventSchemas } from "./eventEmitter.utils";
/** 用途：事件数据处理工具。使用范围：eventEmitter 数据校验。解耦评估：同目录工具模块。 */
import { processEventDataImpl } from "./eventEmitter.utils";
/** 用途：同步监听器执行工具。使用范围：eventEmitter 事件触发。解耦评估：同目录工具模块。 */
import { executeListenerSync } from "./eventEmitter.utils";
/** 用途：异步监听器执行工具。使用范围：eventEmitter 事件触发。解耦评估：同目录工具模块。 */
import { executeListenerAsync } from "./eventEmitter.utils";

const eventMetaSchema = z.object({
    eventId: z.string().min(1),
    seq: z.number().int().nonnegative(),
});

/** 创建验证失败处理器。 */
function createValidationErrorHandler(validationFailure: "throw" | "warn" | "silent") {
    return (event: string, error: z.ZodError) => {
        const message = `Event data validation failed for "${event}": ${error.message}`;
        if (validationFailure === "throw") {
            throw new Error(message);
        }
        // 当策略为 warn 时保留错误可见性，但不中断主流程。
        if (validationFailure === "warn") {
            console.warn(message, error.issues);
        }
    };
}

/** 校验事件元字段。 */
function assertEventMeta(event: string, data: unknown) {
    const result = eventMetaSchema.safeParse(data);
    if (!result.success) {
        throw new Error(`Event meta validation failed for "${event}": ${result.error.message}`);
    }
}

/** 注册监听器的内部共用逻辑。 */
function registerListener<T extends IEventDefines, K extends keyof T>(
    events: {
        [P in keyof T]?: Array<{
            listener: EventListener<T, P>;
            isOnce: boolean;
        }>;
    },
    event: K,
    listener: EventListener<T, K>,
    isOnce: boolean,
) {
    // 首次监听某事件时初始化该事件的监听器列表。
    if (!events[event]) {
        events[event] = [];
    }
    const eventListeners = events[event];
    if (eventListeners) {
        eventListeners.push({ listener, isOnce });
    }
}

/** 安全事件发射器（含可选运行时校验）。 */
export class SafeEventEmitter<T extends IEventDefines> {
    private events: {
        [K in keyof T]?: Array<{
            listener: EventListener<T, K>;
            isOnce: boolean;
        }>;
    } = {};

    private schemas: Map<keyof T, z.ZodObject<z.ZodRawShape>> = new Map();
    private options: Required<EventEmitterOptions>;

    constructor(
        private eventDefines: T,
        options: EventEmitterOptions = {},
    ) {
        this.options = {
            runtimeCheck: false,
            validationFailure: "throw" as const,
            revalidateAfterEach: false,
            onValidationError: createValidationErrorHandler("throw"),
            ...options,
        };
        // 用户未自定义处理器但显式切换了策略时，绑定对应默认处理器。
        if (!options.onValidationError && options.validationFailure) {
            this.options.onValidationError = createValidationErrorHandler(this.options.validationFailure);
        }
        this.schemas = compileEventSchemas(this.eventDefines);
    }

    /** 注册监听器（持久）。 */
    on<K extends keyof T>(event: K, listener: EventListener<T, K>) {
        registerListener(this.events, event, listener, false);
        return this;
    }

    /** 订阅并返回取消订阅函数。 */
    subscribe<K extends keyof T>(event: K, listener: EventListener<T, K>) {
        this.on(event, listener);
        return () => {
            this.off(event, listener);
        };
    }

    /** 注册监听器（一次性）。 */
    once<K extends keyof T>(event: K, listener: EventListener<T, K>) {
        registerListener(this.events, event, listener, true);
        return this;
    }

    /** 一次性订阅并返回取消订阅函数。 */
    subscribeOnce<K extends keyof T>(event: K, listener: EventListener<T, K>) {
        this.once(event, listener);
        return () => {
            this.off(event, listener);
        };
    }

    /** 同步触发事件。 */
    emit<K extends keyof T>(event: K, data: EventData<T, K>) {
        const listeners = this.events[event];
        if (!listeners || listeners.length === 0) {
            return false;
        }

        const processedResult = processEventDataImpl(event, data, this.schemas, this.options);
        if (processedResult.shouldThrow) {
            throw new Error(`Event data validation failed for "${String(event)}"`);
        }
        if (processedResult.data === null) {
            return false;
        }

        const listenersCopy = [...listeners];
        for (const { listener, isOnce } of listenersCopy) {
            executeListenerSync(event, listener, processedResult.data, this.schemas, this.options);
            if (isOnce) {
                this.off(event, listener);
            }
        }
        return true;
    }

    /** 同步触发带 eventId/seq 元字段约束事件。 */
    emitWithMeta<K extends keyof T>(event: K, data: EventDataWithMeta<T, K>) {
        assertEventMeta(String(event), data);
        return this.emit(event, data);
    }

    /** 异步触发事件。 */
    async emitAsync<K extends keyof T>(event: K, data: EventData<T, K>) {
        const listeners = this.events[event];
        if (!listeners || listeners.length === 0) {
            return false;
        }

        const processedResult = processEventDataImpl(event, data, this.schemas, this.options);
        if (processedResult.shouldThrow) {
            throw new Error(`Event data validation failed for "${String(event)}"`);
        }
        if (processedResult.data === null) {
            return false;
        }

        const listenersCopy = [...listeners];
        for await (const { listener, isOnce } of listenersCopy) {
            await executeListenerAsync(event, listener, processedResult.data, this.schemas, this.options);
            if (isOnce) {
                this.off(event, listener);
            }
        }
        return true;
    }

    /** 异步触发带 eventId/seq 元字段约束事件。 */
    async emitAsyncWithMeta<K extends keyof T>(event: K, data: EventDataWithMeta<T, K>) {
        assertEventMeta(String(event), data);
        return this.emitAsync(event, data);
    }

    /** 移除监听器。 */
    off<K extends keyof T>(event: K, listener: EventListener<T, K>) {
        const listeners = this.events[event];
        if (!listeners) {
            return this;
        }

        const index = listeners.findIndex((item) => item.listener === listener);
        // 仅当目标监听器存在时才执行删除，避免误删其它订阅。
        if (index > -1) {
            listeners.splice(index, 1);
        }
        return this;
    }

    /** 更新运行时选项。 */
    setOptions(newOptions: Partial<EventEmitterOptions>) {
        const currentValidationFailure = this.options.validationFailure;
        this.options = {
            ...this.options,
            ...newOptions,
        };

        if (newOptions.onValidationError) {
            this.options.onValidationError = newOptions.onValidationError;
            return this;
        }

        // 仅在策略值变化时重建默认处理器，避免覆盖调用方显式注入。
        if (newOptions.validationFailure && newOptions.validationFailure !== currentValidationFailure) {
            this.options.onValidationError = createValidationErrorHandler(this.options.validationFailure);
            return this;
        }

        // 当调用方未传自定义处理器时，确保 warn/throw 策略始终有默认处理器。
        if (!newOptions.onValidationError && (this.options.validationFailure === "warn" || this.options.validationFailure === "throw")) {
            this.options.onValidationError = createValidationErrorHandler(this.options.validationFailure);
        }
        return this;
    }

    /** 启用运行时校验。 */
    enableRuntimeCheck() {
        this.options.runtimeCheck = true;
        return this;
    }

    /** 禁用运行时校验。 */
    disableRuntimeCheck() {
        this.options.runtimeCheck = false;
        return this;
    }

    /** 移除指定事件或全部监听器。 */
    removeAllListeners<K extends keyof T>(event?: K) {
        if (event) {
            delete this.events[event];
            return this;
        }
        this.events = {};
        return this;
    }

    /** 获取事件监听器数量。 */
    listenerCount<K extends keyof T>(event: K) {
        const listeners = this.events[event];
        return listeners ? listeners.length : 0;
    }

    /** 返回当前有监听器的事件名列表。 */
    eventNames() {
        const result: (keyof T)[] = [];
        for (const key in this.events) {
            const listeners = this.events[key];
            // 仅返回当前存在活动监听器的事件名。
            if (listeners && listeners.length > 0) {
                result.push(key);
            }
        }
        return result;
    }

    /** 获取事件对应 schema。 */
    getEventSchema<K extends keyof T>(event: K) {
        return this.schemas.get(event);
    }
}
