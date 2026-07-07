/**
 * BigInt序列化相关类型定义
 * 用于支持BigInt的JSON序列化和反序列化
 */

import type {
  JSONSerializableValueWithCombined,
  JSONSerializableObjectWithCombined,
  JSONSerializableArrayWithCombined,
  IsPlainObjectWithCombined,
  IsArrayWithCombined,
  JSONReplacerWithCombined,
  JSONReviverWithCombined,
  SerializeFunctionWithCombined,
  DeserializeFunctionWithCombined,
  CloneFunctionWithCombined
} from "./extensionable-serialization-types.types";

/**
 * BigInt包装器接口Base
 * 用于在JSON序列化中表示BigInt值
 */
export interface BigIntWrapper {
  readonly __bigint: true;
  readonly value: string;
}

/**
 * 扩展的JSON可序列化值联合类型
 * 在基础JSON可序列化类型基础上增加了bigint和BigIntWrapper支持
 */
export type JSONSerializableValueWithBigInt =
  | JSONSerializableValueWithCombined<bigint | BigIntWrapper>;

/**
 * JSON可序列化数组接口（支持bigint）
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- 语义化可序列化数组类型（bigint扩展）
export interface JSONSerializableArrayWithBigInt extends JSONSerializableArrayWithCombined<bigint | BigIntWrapper> {}

/**
 * JSON可序列化对象接口（支持bigint）
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- 语义化可序列化对象类型（bigint扩展）
export interface JSONSerializableObjectWithBigInt extends JSONSerializableObjectWithCombined<bigint | BigIntWrapper> {}

/**
 * 类型守卫函数：检查是否为BigInt包装器
 */
export type IsBigIntWrapper = (obj: JSONSerializableValueWithBigInt) => obj is BigIntWrapper;

/**
 * 类型守卫函数：检查是否为普通对象（非数组）
 */
export type IsPlainObjectWithBigInt = IsPlainObjectWithCombined<bigint | BigIntWrapper>;

/**
 * 类型守卫函数：检查是否为数组
 */
export type IsArrayWithBigInt = IsArrayWithCombined<bigint | BigIntWrapper>;

/**
 * JSON替换器函数类型
 * 用于JSON.stringify的替换函数
 */
export type JSONReplacerWithBigInt = JSONReplacerWithCombined<bigint | BigIntWrapper>;

/**
 * JSON恢复器函数类型
 * 用于JSON.parse的恢复函数
 */
export type JSONReviverWithBigInt = JSONReviverWithCombined<bigint | BigIntWrapper>;

/**
 * 包含Symbol属性的对象处理结果
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- 语义化Symbol处理结果对象（bigint扩展）
export interface SymbolProcessedObjectWithBigInt extends JSONSerializableObjectWithBigInt {}

/**
 * 序列化函数类型
 */
export type SerializeFunctionWithBigInt = SerializeFunctionWithCombined<bigint | BigIntWrapper>;

/**
 * 反序列化函数类型
 */
export type DeserializeFunctionWithBigInt = DeserializeFunctionWithCombined<bigint | BigIntWrapper>;

/**
 * 检查是否包含BigInt的函数类型
 */
export type ContainsBigIntFunctionWithBigInt = (obj: JSONSerializableValueWithBigInt) => boolean;

/**
 * 克隆函数类型
 */
export type CloneFunctionWithBigInt = CloneFunctionWithCombined<bigint | BigIntWrapper>;
