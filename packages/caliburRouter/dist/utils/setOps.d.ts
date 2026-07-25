/**
 * 集合运算工具函数
 *
 * 基于arktype的类型能力实现集合论运算
 */
import type { 状态空间模式 } from "../core/types.js";
/**
 * 判断输入是否匹配给定模式
 *
 * @param 模式 - arktype模式定义
 * @param 输入 - 待匹配的值
 * @returns 匹配成功返回验证后的值，失败返回null
 *
 * @example
 * ```ts
 * const 结果 = 匹配(type({ 名称: "string" }), { 名称: "测试" });
 * if (结果) {
 *   console.log(结果.名称); // 类型安全
 * }
 * ```
 */
export declare function 匹配<T>(模式: 状态空间模式<T>, 输入: unknown): T | null;
/**
 * 判断模式A是否是模式B的子集
 * 即：A的所有可能值都是B的可能值
 *
 * @param a - 模式A
 * @param b - 模式B
 * @returns A ⊆ B 返回true
 *
 * @example
 * ```ts
 * 是子集(type("'a'"), type("'a' | 'b'")); // true
 * 是子集(type("string"), type("'a'")); // false
 * ```
 */
export declare function 是子集(a: 状态空间模式, b: 状态空间模式): boolean;
/**
 * 证明全集是否被多个模式共同覆盖。
 *
 * ArkType 对对象属性联合与部分对象模式联合的子集判断不会自动做笛卡尔分发。
 * 在原生证明未通过时，这里只对模式实际约束的有限 unit 字段分区，并逐区继续证明。
 */
export declare function 全集被模式集合覆盖(universePattern: 状态空间模式, patterns: readonly 状态空间模式[]): boolean;
/**
 * 判断两个模式是否有交集
 * 即：存在某个值同时满足两个模式
 *
 * @param a - 模式A
 * @param b - 模式B
 * @returns A ∩ B ≠ ∅ 返回true
 *
 * @example
 * ```ts
 * 有交集(type("'a' | 'b'"), type("'b' | 'c'")); // true (交集为'b')
 * 有交集(type("'a'"), type("'b'")); // false
 * ```
 */
export declare function 有交集(a: 状态空间模式, b: 状态空间模式): boolean;
/**
 * 检查模式是否为空集（never）
 *
 * @param 模式 - 待检查的模式
 * @returns 是空集返回true
 */
export declare function 是空集(模式: 状态空间模式): boolean;
//# sourceMappingURL=setOps.d.ts.map