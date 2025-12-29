/**
 * 魔搭社区 (ModelScope) 工具函数类型守卫
 */

/**
 * 检查值是否为可迭代的键值对
 */
export function 是可迭代键值对(value: unknown): value is Iterable<[string, string]> {
    return (
        typeof value === "object" &&
        value !== null &&
        Symbol.iterator in value &&
        typeof (value as Record<symbol, unknown>)[Symbol.iterator] === "function"
    );
}
