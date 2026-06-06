/** 用途：Zod 运行时校验库。使用范围：事件数据的运行时 schema 校验。解耦评估：通过目录 imports.ts 转发，可替换为其他校验库。 */
import { z } from "./imports";
/** 用途：IEventDefines 事件定义类型。使用范围：类型守卫的泛型约束。解耦评估：类型导入，不涉及运行时耦合。 */
import type { IEventDefines } from "./eventEmitter.types";
/** 用途：EventData 事件数据类型。使用范围：类型守卫的返回类型标注。解耦评估：类型导入，不涉及运行时耦合。 */
import type { EventData } from "./eventEmitter.types";
/** 用途：EventEmitterOptions 事件发射器配置。使用范围：校验函数的配置参数类型。解耦评估：类型导入，不涉及运行时耦合。 */
import type { EventEmitterOptions } from "./eventEmitter.types";

/**
 * 验证事件数据的类型守卫
 * 
 * 根据配置的运行时检查选项和事件模式验证传入的数据。
 * 使用早返回模式避免深层嵌套，提高代码可读性。
 * 
 * @template T - 事件定义类型
 * @template K - 事件键类型
 * @param event - 要验证的事件名称
 * @param data - 要验证的事件数据
 * @param schemas - 编译后的验证模式映射
 * @param options - 事件发射器配置选项
 * @returns 如果验证通过返回 true，否则返回 false
 * 
 * @example
 * ```typescript
 * if (isValidEventData('userLogin', userData, schemas, options)) {
 *   // userData 现在被类型守卫为 EventData<T, 'userLogin'>
 *   console.log(userData.userId);
 * }
 * ```
 */
/** @同步豁免: 类型守卫 - 类型守卫函数必须同步执行以提供正确的类型推断 */
export function isValidEventData<T extends IEventDefines, K extends keyof T>(
  event: K,
  data: unknown,
  schemas: Map<keyof T, z.ZodObject<z.ZodRawShape>>,
  options: Required<EventEmitterOptions>
): data is EventData<T, K> {
  if (!options.runtimeCheck) {
    return true;
  }

  const schema = schemas.get(event);
  if (!schema) {
    return true;
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    options.onValidationError(String(event), result.error, data);
    return false;
  }

  return true;
}

/**
 * 检查数据是否为有效的事件数据类型守卫
 * 
 * 简化版的类型守卫，仅进行类型检查而不触发错误处理。
 * 主要用于内部类型转换场景。
 * pnpm 
 * @template T - 事件定义类型
 * @template K - 事件键类型
 * @param data - 要检查的数据
 * @returns 如果数据有效返回 true，否则返回 false
 */
/** @同步豁免: 类型守卫 - 类型守卫函数必须同步执行以提供正确的类型推断 */
export function isEventDataType<T extends IEventDefines, K extends keyof T>(
  data: unknown
): data is EventData<T, K> {
  return data !== null && data !== undefined;
}