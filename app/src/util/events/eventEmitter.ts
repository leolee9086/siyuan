import { z } from "zod";
import { EventEmitterOptions, IEventDefines, EventData, EventListener } from "./eventEmitter.types";
import { compileEventSchemas, processEventDataImpl, executeListenerSync, executeListenerAsync } from "./eventEmitter.utils";

/**
 * 创建验证错误处理函数
 */
function createValidationErrorHandler(validationFailure: "throw" | "warn" | "silent") {
  return (event: string, error: z.ZodError) => {
    const message = `Event data validation failed for "${event}": ${error.message}`;
    if (validationFailure === "throw") {
      throw new Error(message);
    }
    // 检查是否需要输出警告信息
    if (validationFailure === "warn") {
      console.warn(message, error.issues);
    }
  };
}

export class SafeEventEmitter<T extends IEventDefines> {
  private events: {
    [K in keyof T]?: Array<{
      listener: EventListener<T, K>;
      isOnce: boolean;
    }>;
  } = {};

  // 简化 schema 存储类型
  private schemas: Map<keyof T, z.ZodObject<z.ZodRawShape>> = new Map();

  private options: Required<EventEmitterOptions>;

  constructor(
    private eventDefines: T,
    options: EventEmitterOptions = {}
  ) {
    // 先创建默认选项
    const defaultOptions = {
      runtimeCheck: false,
      validationFailure: "throw" as const,
      revalidateAfterEach: false,
      /** 默认验证错误处理函数 */
      onValidationError: (event: string, error: z.ZodError) => {
        const message = `Event data validation failed for "${event}": ${error.message}`;
        if (this.options.validationFailure === "throw") {
          throw new Error(message);
        }
        // 检查是否需要输出警告
        if (this.options.validationFailure === "warn") {
          console.warn(message, error.issues);
        }
      }
    };

    // 合并用户提供的选项
    this.options = {
      ...defaultOptions,
      ...options
    };

    // 检查用户是否提供了验证失败策略但没有提供错误处理函数
    if (options.validationFailure && !options.onValidationError) {
      this.options.onValidationError = (event: string, error: z.ZodError) => {
        const message = `Event data validation failed for "${event}": ${error.message}`;
        // 检查验证失败策略是否为抛出异常
        if (this.options.validationFailure === "throw") {
          throw new Error(message);
        }
        // 检查验证失败策略是否为警告输出
        if (this.options.validationFailure === "warn") {
          console.warn(message, error.issues);
        }
      };
    }

    this.schemas = compileEventSchemas(this.eventDefines);
  }

  /**
   * 注册事件监听器
   *
   * 作用：为指定事件添加持久性监听器，每次事件触发时都会执行
   * 意图：提供标准的事件订阅机制，支持多个监听器同时监听同一事件
   * 调用时机：需要监听某个事件的所有触发时调用，监听器会一直保持活跃直到手动移除
   *
   * @param event - 要监听的事件名称
   * @param listener - 事件监听器函数
   * @returns 返回当前实例以支持链式调用
   */
  on<K extends keyof T>(
    event: K,
    listener: EventListener<T, K>
  ): this {
    // 检查该事件是否已有监听器数组，如果没有则初始化
    if (!this.events[event]) {
      this.events[event] = [];
    }

    const eventListeners = this.events[event];
    if (eventListeners) {
      eventListeners.push({
        listener,
        isOnce: false
      });
    }
    return this;
  }

  /**
   * 注册一次性事件监听器
   *
   * 作用：为指定事件添加一次性监听器，执行一次后自动移除
   * 意图：提供便捷的一次性事件监听机制，避免手动管理监听器生命周期
   * 调用时机：只需要监听事件的首次触发时调用，适用于初始化、确认等场景
   *
   * @param event - 要监听的事件名称
   * @param listener - 事件监听器函数
   * @returns 返回当前实例以支持链式调用
   */
  once<K extends keyof T>(
    event: K,
    listener: EventListener<T, K>
  ): this {
    // 检查该事件是否已有监听器数组，如果没有则初始化
    if (!this.events[event]) {
      this.events[event] = [];
    }

    const eventListeners = this.events[event];
    if (eventListeners) {
      eventListeners.push({
        listener,
        isOnce: true
      });
    }
    return this;
  }

  /**
   * 同步触发事件
   *
   * 作用：触发指定事件并同步执行所有监听器
   * 意图：提供标准的事件发布机制，支持数据验证和监听器管理
   * 调用时机：需要通知所有监听器某个事件发生时调用，适用于同步处理场景
   *
   * @param event - 要触发的事件名称
   * @param data - 事件数据
   * @returns 如果有监听器被执行返回 true，否则返回 false
   */
  emit<K extends keyof T>(event: K, data: EventData<T, K>): boolean {
    const listeners = this.events[event];
    // 检查是否存在监听器
    if (!listeners || listeners.length === 0) {
      return false;
    }

    // 验证数据并获取处理后的数据（可能包含默认值）
    const processedResult = processEventDataImpl(event, data, this.schemas, this.options);
    // 检查验证是否要求抛出异常
    if (processedResult.shouldThrow) {
      throw new Error(`Event data validation failed for "${String(event)}"`);
    }
    // 检查处理后的数据是否为空
    if (processedResult.data === null) {
      return false;
    }

    // 创建监听器数组的副本，避免在迭代过程中修改数组
    const listenersCopy = [...listeners];

    for (const { listener, isOnce } of listenersCopy) {
      executeListenerSync(event, listener, processedResult.data, this.schemas, this.options);

      // 检查是否为一次性监听器，如果是则执行后移除
      if (isOnce) {
        this.off(event, listener);
      }
    }

    return true;
  }

  /**
   * 异步触发事件
   *
   * 作用：触发指定事件并异步执行所有监听器
   * 意图：提供异步事件发布机制，支持异步监听器的顺序执行
   * 调用时机：需要异步处理事件监听器时调用，适用于涉及异步操作的场景
   *
   * @param event - 要触发的事件名称
   * @param data - 事件数据
   * @returns Promise，如果有监听器被执行返回 true，否则返回 false
   */
  async emitAsync<K extends keyof T>(event: K, data: EventData<T, K>): Promise<boolean> {
    const listeners = this.events[event];
    // 检查是否存在监听器
    if (!listeners || listeners.length === 0) {
      return false;
    }

    // 验证数据并获取处理后的数据（可能包含默认值）
    const processedResult = processEventDataImpl(event, data, this.schemas, this.options);
    // 检查验证是否要求抛出异常
    if (processedResult.shouldThrow) {
      throw new Error(`Event data validation failed for "${String(event)}"`);
    }
    // 检查处理后的数据是否为空
    if (processedResult.data === null) {
      return false;
    }

    // 创建监听器数组的副本，避免在迭代过程中修改数组
    const listenersCopy = [...listeners];

    for await (const { listener, isOnce } of listenersCopy) {
      // 直接等待监听器执行完成
      await executeListenerAsync(event, listener, processedResult.data, this.schemas, this.options);

      // 检查是否为一次性监听器，如果是则执行后移除
      if (isOnce) {
        this.off(event, listener);
      }
    }

    return true;
  }

  /**
   * 移除事件监听器
   *
   * 作用：从指定事件中移除特定的监听器
   * 意图：提供精确的监听器管理机制，支持选择性移除监听器
   * 调用时机：不再需要某个特定监听器时调用，或在组件销毁时清理监听器
   *
   * @param event - 要移除监听器的事件名称
   * @param listener - 要移除的监听器函数
   * @returns 返回当前实例以支持链式调用
   */
  off<K extends keyof T>(
    event: K,
    listener: EventListener<T, K>
  ): this {
    const listeners = this.events[event];
    if (!listeners) {
      return this;
    }

    const index = listeners.findIndex(item => item.listener === listener);
    // 检查是否找到了要移除的监听器（findIndex 返回 -1 表示未找到）
    if (index > -1) {
      listeners.splice(index, 1);
    }
    return this;
  }

  /**
   * 更新事件发射器选项
   *
   * 作用：动态更新事件发射器的配置选项
   * 意图：提供运行时配置修改能力，支持灵活的选项管理
   * 调用时机：需要修改验证策略、错误处理方式等配置时调用
   *
   * @param newOptions - 要更新的选项（部分更新）
   * @returns 返回当前实例以支持链式调用
   */
  setOptions(newOptions: Partial<EventEmitterOptions>): this {
    // 保存当前的验证失败模式，用于后续比较
    const currentValidationFailure = this.options.validationFailure;

    // 合并选项
    this.options = {
      ...this.options,
      ...newOptions
    };

    // 检查是否提供了新的错误处理函数
    if (newOptions.onValidationError) {
      this.options.onValidationError = newOptions.onValidationError;
      return this;
    }

    // 检查验证失败模式是否发生了变化且没有提供新的错误处理函数
    if (newOptions.validationFailure && newOptions.validationFailure !== currentValidationFailure) {
      this.options.onValidationError = createValidationErrorHandler(this.options.validationFailure);
      return this;
    }

    // 检查是否需要确保有默认的错误处理函数
    if (!newOptions.onValidationError && (this.options.validationFailure === "warn" || this.options.validationFailure === "throw")) {
      this.options.onValidationError = createValidationErrorHandler(this.options.validationFailure);
    }

    return this;
  }

  /** 启用运行时检查 */
  enableRuntimeCheck(): this {
    this.options.runtimeCheck = true;
    return this;
  }

  /** 禁用运行时检查 */
  disableRuntimeCheck(): this {
    this.options.runtimeCheck = false;
    return this;
  }

  /**
   * 移除所有监听器
   *
   * 作用：移除指定事件或所有事件的监听器
   * 意图：提供批量清理监听器的便捷方法，避免内存泄漏
   * 调用时机：组件销毁、重置状态或需要清理所有监听器时调用
   *
   * @param event - 可选，指定要清理的事件名称，不传则清理所有事件
   * @returns 返回当前实例以支持链式调用
   */
  removeAllListeners<K extends keyof T>(event?: K): this {
    // 检查是否指定了特定事件
    if (event) {
      delete this.events[event];
      return this;
    }
    
    // 清理所有事件的监听器
    this.events = {};
    return this;
  }

  /**
   * 获取事件监听器数量
   *
   * 作用：返回指定事件的监听器数量
   * 意图：提供监听器统计功能，便于监控和调试
   * 调用时机：需要了解某个事件的监听器数量时调用，用于性能监控或调试
   *
   * @param event - 要查询的事件名称
   * @returns 监听器数量，如果事件不存在则返回 0
   */
  listenerCount<K extends keyof T>(event: K): number {
    const listeners = this.events[event];
    return listeners ? listeners.length : 0;
  }

  /**
   * 获取所有事件名称
   *
   * 作用：返回当前已注册监听器的所有事件名称列表
   * 意图：提供事件发射器状态查询功能，便于调试和监控
   * 调用时机：需要了解当前活跃事件列表时调用，用于调试或状态检查
   *
   * @returns 事件名称数组
   */
  eventNames(): (keyof T)[] {
    const result: (keyof T)[] = [];
    for (const key in this.events) {
      const listeners = this.events[key];
      // 检查监听器数组是否存在且包含监听器
      if (listeners && listeners.length > 0) {
        result.push(key);
      }
    }
    return result;
  }

  /**
   * 获取指定事件的 Zod 验证模式
   * @param event - 事件名称
   * @returns 验证模式对象或 undefined
   */
  getEventSchema<K extends keyof T>(event: K): z.ZodObject<z.ZodRawShape> | undefined {
    return this.schemas.get(event);
  }
}
