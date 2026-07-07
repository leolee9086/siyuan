/**
 * JSON可序列化相关类型定义
 * 包含所有可以被JSON序列化的基本类型
 */

/**
 * 基础JSON可序列化值的联合类型
 * 包含所有可以被JSON序列化的基本类型（不包括bigint等扩展类型）
 */
export type BaseJSONSerializableValue =
  | string
  | number
  | boolean
  | null
  | BaseJSONSerializableObject
  | BaseJSONSerializableArray;

/**
 * 基础JSON可序列化对象接口
 */
export interface BaseJSONSerializableObject {
  readonly [key: string]: BaseJSONSerializableValue;
}

/**
 * 基础JSON可序列化数组接口
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- 语义化可序列化数组类型
export interface BaseJSONSerializableArray extends ReadonlyArray<BaseJSONSerializableValue> {}

/**
 * 类型守卫函数：检查是否为普通对象（非数组）
 */
export type IsBaseJSONSerializablePlainObject = (value: BaseJSONSerializableValue) => value is BaseJSONSerializableObject;

/**
 * 类型守卫函数：检查是否为数组
 */
export type IsBaseJSONSerializableArray = (value: BaseJSONSerializableValue) => value is BaseJSONSerializableArray;
