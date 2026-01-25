/**
 * 集合运算工具函数
 * 
 * 基于arktype的类型能力实现集合论运算
 */

import { type, Type } from "arktype";

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
export function 匹配<T>(模式: Type<T>, 输入: unknown): T | null {
    const 验证结果 = 模式(输入);
    // ArkType 2.x 错误检测：检查 ' arkKind' 属性
    // 验证失败时返回 ArkErrors 对象，它是一个数组且有 ' arkKind': 'errors' 属性
    if (typeof 验证结果 === "object" && 验证结果 !== null && " arkKind" in 验证结果) {
        return null;
    }
    // arktype验证成功后返回的是validated value，需要断言类型
    return 验证结果 as T;
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
export function 是子集(a: Type, b: Type): boolean {
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
export function 有交集(a: Type, b: Type): boolean {
    try {
        // 计算交集类型
        const 交集 = a.and(b);
        // 如果交集等价于never，则无交集
        return !是子集(交集, type("never"));
    } catch (error) {
        // 仅捕获预期的 ArkType "unsatisfiable" 错误
        if (error instanceof Error &&
            error.message.includes('unsatisfiable')) {
            // arktype对某些类型组合会抛出"unsatisfiable type"错误
            // 这通常意味着两个类型没有交集
            return false;
        }
        // 未知错误必须抛出，附带完整上下文信息
        const 错误消息 = `有交集() 遇到未预期的错误: ${error}\n` +
            `类型A: ${a}\n` +
            `类型B: ${b}`;
        const 新错误 = new Error(错误消息);
        // 保留原始错误作为 cause（如果运行时支持）
        if ('cause' in 新错误) {
            (新错误 as any).cause = error;
        }
        throw 新错误;
    }
}

/**
 * 检查模式是否为空集（never）
 * 
 * @param 模式 - 待检查的模式
 * @returns 是空集返回true
 */
export function 是空集(模式: Type): boolean {
    return 是子集(模式, type("never"));
}
