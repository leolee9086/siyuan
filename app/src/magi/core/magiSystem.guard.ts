/**
 * @fileoverview MAGI系统类型守卫
 * @description 提供MAGI系统模块所需的类型守卫函数
 */

/**
 * 过滤null值，仅保留有效字符串
 * @param value - 可能为null的字符串
 * @returns 是否为非null字符串
 */
export function isNonNullString(value: string | null): value is string {
    return value !== null;
}
