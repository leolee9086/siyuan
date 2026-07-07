/**
 * 组合序列化相关类型定义
 * 用于支持扩展类型的JSON序列化和反序列化
 * 此为基础泛型实现，供具体类型扩展使用
 */

import type {
  BaseJSONSerializableValue
} from "./JSONSerializable-types.types";

/**
 * 扩展的JSON可序列化值联合类型
 * 在基础JSON可序列化类型基础上增加了泛型扩展支持
 * TExtensions: 扩展类型联合，可以是具体类型或包装器类型的联合
 */
export type JSONSerializableValueWithCombined<TExtensions = never> =
  | BaseJSONSerializableValue
  | JSONSerializableObjectWithCombined<TExtensions>
  | JSONSerializableArrayWithCombined<TExtensions>
  | TExtensions;

/**
 * JSON可序列化数组接口（支持组合类型）
 * 使用泛型参数TExtensions来支持扩展类型
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- 语义化可序列化数组类型
export interface JSONSerializableArrayWithCombined<TExtensions = never>
  extends ReadonlyArray<JSONSerializableValueWithCombined<TExtensions>> {}

/**
 * JSON可序列化对象接口（支持组合类型）
 * 使用泛型参数TExtensions来支持扩展类型
 * 不包含索引签名以支持具体的属性定义扩展
 */
export interface JSONSerializableObjectWithCombined<TExtensions = never> {
  readonly [key: string]: JSONSerializableValueWithCombined<TExtensions>;
}

/**
 * 类型守卫函数：检查是否为普通对象（非数组）
 */
export type IsPlainObjectWithCombined<TExtensions = never> =
  (value: JSONSerializableValueWithCombined<TExtensions>) => value is JSONSerializableObjectWithCombined<TExtensions>;

/**
 * 类型守卫函数：检查是否为数组
 */
export type IsArrayWithCombined<TExtensions = never> =
  (value: JSONSerializableValueWithCombined<TExtensions>) => value is JSONSerializableArrayWithCombined<TExtensions>;

/**
 * JSON替换器函数类型
 * 用于JSON.stringify的替换函数，输入基础类型，输出组合类型
 */
export type JSONReplacerWithCombined<TExtensions = never> =
  (key: string, value: JSONSerializableValueWithCombined<TExtensions>) => JSONSerializableValueWithCombined<TExtensions>;

/**
 * JSON恢复器函数类型
 * 用于JSON.parse的恢复函数，输入基础类型，输出组合类型
 */
export type JSONReviverWithCombined<TExtensions = never> =
  (key: string, value: JSONSerializableValueWithCombined<TExtensions>) => JSONSerializableValueWithCombined<TExtensions>;

/**
 * 序列化函数类型
 */
export type SerializeFunctionWithCombined<TExtensions = never> =
  (obj: JSONSerializableValueWithCombined<TExtensions>) => string;

/**
 * 反序列化函数类型
 */
export type DeserializeFunctionWithCombined<TExtensions = never> =
  (json: string) => JSONSerializableValueWithCombined<TExtensions>;

/**
 * 克隆函数类型
 */
export type CloneFunctionWithCombined<TExtensions = never> =
  (obj: JSONSerializableValueWithCombined<TExtensions>) => JSONSerializableValueWithCombined<TExtensions>;
