/**
 * 集合运算工具函数
 *
 * 基于arktype的类型能力实现集合论运算
 */
import { type } from "arktype";
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
export function 匹配(模式, 输入) {
    const 验证结果 = 模式(输入);
    // 使用鸭子类型检查错误，避免 npm link 导致的 instanceof 失效问题
    if (验证结果 instanceof type.errors || (Array.isArray(验证结果) && "summary" in 验证结果)) {
        return null;
    }
    // arktype验证成功后返回的是validated value，需要断言类型
    return 验证结果;
}
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
export function 是子集(a, b) {
    return a.extends(b) === true;
}
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
export function 有交集(a, b) {
    try {
        // 计算交集类型
        const 交集 = a.and(b);
        // 如果交集等价于never，则无交集
        return !是子集(交集, type("never"));
    }
    catch {
        // arktype对某些类型组合会抛出"unsatisfiable type"错误
        // 这通常意味着两个类型没有交集
        return false;
    }
}
/**
 * 检查模式是否为空集（never）
 *
 * @param 模式 - 待检查的模式
 * @returns 是空集返回true
 */
export function 是空集(模式) {
    return 是子集(模式, type("never"));
}
//# sourceMappingURL=setOps.js.map