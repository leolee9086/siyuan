import { z } from "zod";

type IEventDefines = {
  readonly [key: string]: z.ZodRawShape;
};

// 简化类型定义，避免复杂的泛型嵌套
type EventData<T extends IEventDefines, K extends keyof T> = 
  z.infer<z.ZodObject<T[K]>>;

type EventListener<T extends IEventDefines, K extends keyof T> = 
  (data: EventData<T, K>) => void;

interface EventEmitterOptions {
  runtimeCheck?: boolean;
  validationFailure?: "throw" | "warn" | "silent";
  revalidateAfterEach?: boolean;
  onValidationError?: (event: string, error: z.ZodError, data: unknown) => void;
}

export class SafeEventEmitter<T extends IEventDefines> {
  private events: {
    [K in keyof T]?: Array<{
      listener: EventListener<T, K>;
      isOnce: boolean;
    }>;
  } = {};

  // 简化 schema 存储类型
  private schemas: Map<keyof T, z.ZodObject<any>> = new Map();

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
      onValidationError: (event: string, error: z.ZodError, data: unknown) => {
        const message = `Event data validation failed for "${event}": ${error.message}`;
        if (this.options.validationFailure === "throw") {
          throw new Error(message);
        } else if (this.options.validationFailure === "warn") {
          console.warn(message, error.issues);
        }
      }
    };
    
    // 合并用户提供的选项
    this.options = {
      ...defaultOptions,
      ...options
    };
    
    // 如果用户提供了 validationFailure 但没有提供 onValidationError，需要更新错误处理函数
    if (options.validationFailure && !options.onValidationError) {
      this.options.onValidationError = (event: string, error: z.ZodError, data: unknown) => {
        const message = `Event data validation failed for "${event}": ${error.message}`;
        if (this.options.validationFailure === "throw") {
          throw new Error(message);
        } else if (this.options.validationFailure === "warn") {
          console.warn(message, error.issues);
        }
      };
    }

    this.compileSchemas();
  }

  private compileSchemas(): void {
    for (const key in this.eventDefines) {
      const shape = this.eventDefines[key];
      this.schemas.set(key, z.object(shape) );
    }
  }

  private validateEventData<K extends keyof T>(
    event: K, 
    data: unknown
  ): data is EventData<T, K> {
    if (!this.options.runtimeCheck) {
      return true;
    }

    const schema = this.schemas.get(event);
    if (!schema) {
      return true;
    }

    const result = schema.safeParse(data);
    if (!result.success) {
      this.options.onValidationError(String(event) , result.error, data);
      return false;
    }

    return true;
  }

  private processEventData<K extends keyof T>(
    event: K,
    data: unknown
  ): { data: EventData<T, K> | null; shouldThrow: boolean } {
    if (!this.options.runtimeCheck) {
      return { data: data as EventData<T, K>, shouldThrow: false };
    }

    const schema = this.schemas.get(event);
    if (!schema) {
      return { data: data as EventData<T, K>, shouldThrow: false };
    }

    const result = schema.safeParse(data);
    if (!result.success) {
      // 在throw模式下，我们需要抛出错误而不是返回null
      if (this.options.validationFailure === "throw") {
        // 直接抛出错误，不通过onValidationError
        const message = `Event data validation failed for "${String(event)}": ${result.error.message}`;
        return { data: null, shouldThrow: true };
      } else {
        this.options.onValidationError(String(event), result.error, data);
        return { data: null, shouldThrow: false };
      }
    }

    return { data: result.data as EventData<T, K>, shouldThrow: false };
  }

  private createValidationCopy<K extends keyof T>(data: EventData<T, K>): EventData<T, K> {
    return structuredClone(data);
  }

  private executeListenerWithValidation<K extends keyof T>(
    event: K,
    listener: EventListener<T, K>,
    data: EventData<T, K>,
  ): void {
    try {
      // 创建数据的副本，这样监听器的修改不会影响原始数据
      const dataCopy = this.createValidationCopy(data);
      listener(dataCopy);
      
      if (this.options.runtimeCheck && this.options.revalidateAfterEach) {
        // 重新验证数据，如果验证失败会抛出错误
        if (!this.validateEventData(event, dataCopy)) {
          // 如果验证失败且是throw模式，需要重新抛出错误
          if (this.options.validationFailure === "throw") {
            throw new Error(`Event data validation failed after listener execution for "${String(event)}"`);
          }
        }
      }
    } catch (error) {
      // 重新抛出验证错误，不捕获
      if (error instanceof Error && error.message.includes("Event data validation failed")) {
        throw error;
      }
      console.error(`Error in event listener for ${String(event)}:`, error);
    }
  }

  private async executeListenerWithValidationAsync<K extends keyof T>(
    event: K,
    listener: EventListener<T, K>,
    data: EventData<T, K>,
  ): Promise<void> {
    try {
      // 创建数据的副本，这样监听器的修改不会影响原始数据
      const dataCopy = this.createValidationCopy(data);
      await listener(dataCopy);
      
      if (this.options.runtimeCheck && this.options.revalidateAfterEach) {
        // 重新验证数据，如果验证失败会抛出错误
        if (!this.validateEventData(event, dataCopy)) {
          // 如果验证失败且是throw模式，需要重新抛出错误
          if (this.options.validationFailure === "throw") {
            throw new Error(`Event data validation failed after listener execution for "${String(event)}"`);
          }
        }
      }
    } catch (error) {
      // 重新抛出验证错误，不捕获
      if (error instanceof Error && error.message.includes("Event data validation failed")) {
        throw error;
      }
      console.error(`Error in event listener for ${String(event)}:`, error);
    }
  }

  on<K extends keyof T>(
    event: K, 
    listener: EventListener<T, K>
  ): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event]!.push({
      listener,
      isOnce: false
    });
    return this;
  }

  once<K extends keyof T>(
    event: K, 
    listener: EventListener<T, K>
  ): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event]!.push({
      listener,
      isOnce: true
    });
    return this;
  }

  emit<K extends keyof T>(event: K, data: EventData<T, K>): boolean {
    const listeners = this.events[event];
    if (!listeners || listeners.length === 0) {
      // 如果没有监听器，返回false
      return false;
    }

    // 验证数据并获取处理后的数据（可能包含默认值）
    const processedResult = this.processEventData(event, data);
    if (processedResult.shouldThrow) {
      throw new Error(`Event data validation failed for "${String(event)}"`);
    }
    if (processedResult.data === null) {
      return false;
    }

    // 创建监听器数组的副本，避免在迭代过程中修改数组
    const listenersCopy = [...listeners];
    
    listenersCopy.forEach(({ listener, isOnce }) => {
      this.executeListenerWithValidation(event, listener, processedResult.data!);
      
      // 如果是一次性监听器，执行后移除
      if (isOnce) {
        this.off(event, listener);
      }
    });

    return true;
  }

  async emitAsync<K extends keyof T>(event: K, data: EventData<T, K>): Promise<boolean> {
    const listeners = this.events[event];
    if (!listeners || listeners.length === 0) {
      return false;
    }

    // 验证数据并获取处理后的数据（可能包含默认值）
    const processedResult = this.processEventData(event, data);
    if (processedResult.shouldThrow) {
      throw new Error(`Event data validation failed for "${String(event)}"`);
    }
    if (processedResult.data === null) {
      return false;
    }
    
    // 创建监听器数组的副本，避免在迭代过程中修改数组
    const listenersCopy = [...listeners];
    
    for await (const { listener, isOnce } of listenersCopy) {
      // 直接等待监听器执行完成
      await this.executeListenerWithValidationAsync(event, listener, processedResult.data!);
      
      // 如果是一次性监听器，执行后移除
      if (isOnce) {
        this.off(event, listener);
      }
    }

    return true;
  }

  off<K extends keyof T>(
    event: K, 
    listener: EventListener<T, K>
  ): this {
    const listeners = this.events[event];
    if (listeners) {
      const index = listeners.findIndex(item => item.listener === listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  setOptions(newOptions: Partial<EventEmitterOptions>): this {
    // 保存当前的验证失败模式，用于后续比较
    const currentValidationFailure = this.options.validationFailure;
    
    // 合并选项
    this.options = {
      ...this.options,
      ...newOptions
    };
    
    // 如果提供了新的错误处理函数，直接使用它
    if (newOptions.onValidationError) {
      this.options.onValidationError = newOptions.onValidationError;
    }
    // 如果验证失败模式发生了变化但没有提供新的错误处理函数，需要更新默认错误处理函数
    else if (newOptions.validationFailure && newOptions.validationFailure !== currentValidationFailure) {
      this.options.onValidationError = (event: string, error: z.ZodError, data: unknown) => {
        const message = `Event data validation failed for "${event}": ${error.message}`;
        if (this.options.validationFailure === "throw") {
          throw new Error(message);
        } else if (this.options.validationFailure === "warn") {
          console.warn(message, error.issues);
        }
      };
    }
    // 如果没有提供新的错误处理函数，但验证失败模式是warn或throw，确保有默认的错误处理函数
    else if (!newOptions.onValidationError && (this.options.validationFailure === "warn" || this.options.validationFailure === "throw")) {
      this.options.onValidationError = (event: string, error: z.ZodError, data: unknown) => {
        const message = `Event data validation failed for "${event}": ${error.message}`;
        if (this.options.validationFailure === "throw") {
          throw new Error(message);
        } else if (this.options.validationFailure === "warn") {
          console.warn(message, error.issues);
        }
      };
    }
    
    return this;
  }

  enableRuntimeCheck(): this {
    this.options.runtimeCheck = true;
    return this;
  }

  disableRuntimeCheck(): this {
    this.options.runtimeCheck = false;
    return this;
  }

  removeAllListeners<K extends keyof T>(event?: K): this {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }

  listenerCount<K extends keyof T>(event: K): number {
    const listeners = this.events[event];
    return listeners ? listeners.length : 0;
  }

  eventNames(): (keyof T)[] {
    return Object.keys(this.events) as (keyof T)[];
  }

  // 添加一个方法来获取事件的 schema（用于调试或其他用途）
  getEventSchema<K extends keyof T>(event: K): z.ZodObject<any> | undefined {
    return this.schemas.get(event);
  }
}
