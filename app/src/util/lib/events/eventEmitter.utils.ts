import { z } from "zod";
import { IEventDefines, EventListener, EventEmitterOptions } from "./eventEmitter.types";
import { isEventDataType } from "./eventEmitter.guard";

/**
 * 编译事件定义为 Zod 验证模式
 *
 * 将事件定义对象转换为可用于运行时验证的 Zod 模式映射。
 * 每个事件类型都会被编译为对应的 ZodObject 实例。
 *
 * @template T - 事件定义类型
 * @param eventDefines - 事件定义对象，包含各事件的数据结构定义
 * @returns 返回事件名到 ZodObject 的映射表
 *
 * @example
 * ```typescript
 * const eventDefines = {
 *   userLogin: { userId: z.string(), timestamp: z.number() },
 *   dataUpdate: { id: z.string(), data: z.any() }
 * };
 * const schemas = await compileEventSchemas(eventDefines);
 * // schemas.get('userLogin') 返回对应的 ZodObject
 * ```
 */
/** @同步豁免: 性能考虑 - Schema编译是CPU密集型操作，需要同步执行以避免异步开销影响事件系统性能 */
export function compileEventSchemas<T extends IEventDefines>(
  eventDefines: T
) {
  const schemas = new Map<keyof T, z.ZodObject<z.ZodRawShape>>();
  
  for (const key in eventDefines) {
    const shape = eventDefines[key];
    schemas.set(key, z.object(shape));
  }
  
  return schemas;
}


/**
 * 处理事件数据的实现函数
 *
 * 验证事件数据并返回处理结果，包括验证后的数据和是否需要抛出错误的标志。
 * 使用早返回模式简化控制流，避免复杂的条件嵌套。
 *
 * @template T - 事件定义类型
 * @template K - 事件键类型
 * @param event - 要处理的事件名称
 * @param data - 要处理的事件数据
 * @param schemas - 编译后的验证模式映射
 * @param options - 事件发射器配置选项
 * @returns 包含处理后数据和错误标志的对象
 *
 * @example
 * ```typescript
 * const result = await processEventDataImpl('userLogin', userData, schemas, options);
 * if (result.shouldThrow) {
 *   throw new Error('Validation failed');
 * }
 * if (result.data === null) {
 *   return false; // 验证失败但不抛出错误
 * }
 * // 使用 result.data 继续处理
 * ```
 */
/** @同步豁免: 性能考虑 - 事件数据验证是高频操作，需要同步执行以避免异步开销影响事件系统性能 */
export function processEventDataImpl<T extends IEventDefines, K extends keyof T>(
  event: K,
  data: unknown,
  schemas: Map<keyof T, z.ZodObject<z.ZodRawShape>>,
  options: Required<EventEmitterOptions>
) {
  if (!options.runtimeCheck) {
    return { data: data, shouldThrow: false };
  }

  const schema = schemas.get(event);
  if (!schema) {
    return { data: data, shouldThrow: false };
  }

  const result = schema.safeParse(data);
  if (!result.success && options.validationFailure === "throw") {
    return { data: null, shouldThrow: true };
  }
  
  if (!result.success) {
    options.onValidationError(String(event), result.error, data);
    return { data: null, shouldThrow: false };
  }

  return { data: result.data, shouldThrow: false };
}

/**
 * 同步执行监听器的实现函数
 *
 * 执行事件监听器并处理可能的验证和错误。
 * 使用数据副本确保监听器修改不会影响原始数据。
 *
 * @template T - 事件定义类型
 * @template K - 事件键类型
 * @param event - 事件名称
 * @param listener - 要执行的监听器函数
 * @param data - 事件数据
 * @param schemas - 编译后的验证模式映射
 * @param options - 事件发射器配置选项
 *
 * @example
 * ```typescript
 * executeListenerSync('userLogin', userLoginHandler, userData, schemas, options);
 * ```
 */
/** @同步豁免: 性能考虑 - 同步监听器执行是事件系统的核心性能路径，必须保持同步以避免异步开销 */
export function executeListenerSync<T extends IEventDefines, K extends keyof T>(
  event: K,
  listener: EventListener<T, K>,
  data: unknown,
  schemas: Map<keyof T, z.ZodObject<z.ZodRawShape>>,
  options: Required<EventEmitterOptions>
) {
  try {
    // 创建数据的副本，这样监听器的修改不会影响原始数据
    const dataCopy = structuredClone(data);
    // 使用类型守卫确保数据副本符合监听器期望的类型
    // 这个判断在数据为 null 或 undefined 时会阻止监听器执行，避免类型错误
    if (isEventDataType<T, K>(dataCopy)) {
      listener(dataCopy);
    }

    if (!options.runtimeCheck || !options.revalidateAfterEach) {
      return;
    }

    // 重新验证数据
    const schema = schemas.get(event);
    if (!schema) {
      return;
    }

    const result = schema.safeParse(dataCopy);
    if (!result.success && options.validationFailure === "throw") {
      throw new Error(`Event data validation failed after listener execution for "${String(event)}"`);
    }
  } catch (error) {
    // 重新抛出验证错误，不捕获
    if (error instanceof Error && error.message.includes("Event data validation failed")) {
      throw error;
    }
    console.error(`Error in event listener for ${String(event)}:`, error);
  }
}

/**
 * 异步执行监听器的实现函数
 *
 * 异步执行事件监听器并处理可能的验证和错误。
 * 使用数据副本确保监听器修改不会影响原始数据。
 *
 * @template T - 事件定义类型
 * @template K - 事件键类型
 * @param event - 事件名称
 * @param listener - 要执行的监听器函数
 * @param data - 事件数据
 * @param schemas - 编译后的验证模式映射
 * @param options - 事件发射器配置选项
 *
 * @example
 * ```typescript
 * await executeListenerAsync('userLogin', userLoginHandler, userData, schemas, options);
 * ```
 */
export async function executeListenerAsync<T extends IEventDefines, K extends keyof T>(
  event: K,
  listener: EventListener<T, K>,
  data: unknown,
  schemas: Map<keyof T, z.ZodObject<z.ZodRawShape>>,
  options: Required<EventEmitterOptions>
) {
  try {
    // 创建数据的副本，这样监听器的修改不会影响原始数据
    const dataCopy = structuredClone(data);
    // 使用类型守卫确保数据副本符合监听器期望的类型
    // 这个判断在数据为 null 或 undefined 时会阻止监听器执行，避免类型错误
    if (isEventDataType<T, K>(dataCopy)) {
      await listener(dataCopy);
    }

    if (!options.runtimeCheck || !options.revalidateAfterEach) {
      return;
    }

    // 重新验证数据
    const schema = schemas.get(event);
    if (!schema) {
      return;
    }

    const result = schema.safeParse(dataCopy);
    if (!result.success && options.validationFailure === "throw") {
      throw new Error(`Event data validation failed after listener execution for "${String(event)}"`);
    }
  } catch (error) {
    // 重新抛出验证错误，不捕获
    if (error instanceof Error && error.message.includes("Event data validation failed")) {
      throw error;
    }
    console.error(`Error in event listener for ${String(event)}:`, error);
  }
}
