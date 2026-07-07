/**
 * Symbol序列化相关类型定义
 * 用于支持Symbol的JSON序列化和反序列化
 */

import type {
  JSONSerializableValueWithCombined,
  JSONSerializableObjectWithCombined,
  JSONSerializableArrayWithCombined
} from "./extensionable-serialization-types.types";

/**
 * Symbol包装器接口
 * 用于在JSON序列化中表示Symbol值
 */
export interface SymbolWrapper {
  readonly __symbol: true;
  readonly description: string | undefined;
  readonly key: string;
}

/**
 * 序列化前的类型：包含原始Symbol的JSON可序列化值类型
 */
export type JSONSerializableValueWithRawSymbol =
  | JSONSerializableValueWithCombined<symbol>;

/**
 * 序列化后的类型：包含Symbol包装器的JSON可序列化值类型
 */
export type JSONSerializableValueWithSymbolWrapper =
  | JSONSerializableValueWithCombined<SymbolWrapper>;

/**
 * 序列化前的对象类型：包含原始Symbol的JSON可序列化对象接口
 */
export interface JSONSerializableObjectWithRawSymbol extends JSONSerializableObjectWithCombined<symbol> {
   [key: symbol]: JSONSerializableValueWithCombined<symbol>;
}

/**
 * 序列化后的对象类型：包含Symbol包装器的JSON可序列化对象接口
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- 语义化Symbol序列化后对象类型
export interface JSONSerializableObjectWithSymbolWrapper extends JSONSerializableObjectWithCombined<SymbolWrapper> {}

/**
 * 序列化前的数组类型：包含原始Symbol的JSON可序列化数组接口
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- 语义化Symbol序列化前数组类型
export interface JSONSerializableArrayWithRawSymbol extends JSONSerializableArrayWithCombined<symbol> {}

/**
 * 序列化后的数组类型：包含Symbol包装器的JSON可序列化数组接口
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- 语义化Symbol序列化后数组类型
export interface JSONSerializableArrayWithSymbolWrapper extends JSONSerializableArrayWithCombined<SymbolWrapper> {}

/**
 * 类型守卫函数：检查是否为Symbol包装器
 */
export type IsSymbolWrapper = (obj: unknown) => obj is SymbolWrapper;

/**
 * 类型守卫函数：检查是否为包含原始Symbol的普通对象
 */
export type IsPlainObjectWithRawSymbol = (value: unknown) => value is JSONSerializableObjectWithRawSymbol;

/**
 * 类型守卫函数：检查是否为包含原始Symbol的数组
 */
export type IsArrayWithRawSymbol = (value: unknown) => value is JSONSerializableArrayWithRawSymbol;

/**
 * JSON替换器函数类型
 * 输入包含原始Symbol，输出包含Symbol包装器
 */
export type JSONReplacerWithSymbol =
  (key: string, value: JSONSerializableValueWithRawSymbol) => JSONSerializableValueWithSymbolWrapper;

/**
 * JSON恢复器函数类型
 * 输入包含Symbol包装器，输出包含原始Symbol
 */
export type JSONReviverWithSymbol =
  (key: string, value: JSONSerializableValueWithSymbolWrapper) => JSONSerializableValueWithRawSymbol;

/**
 * 序列化函数类型
 */
export type SerializeFunctionWithSymbol =
  (obj: JSONSerializableValueWithRawSymbol) => string;

/**
 * 反序列化函数类型
 */
export type DeserializeFunctionWithSymbol =
  (json: string) => JSONSerializableValueWithRawSymbol;

/**
 * 克隆函数类型
 */
export type CloneFunctionWithSymbol =
  (obj: JSONSerializableValueWithRawSymbol) => JSONSerializableValueWithRawSymbol;
