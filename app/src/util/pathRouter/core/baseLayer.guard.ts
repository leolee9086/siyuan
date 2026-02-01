import type { Key } from "path-to-regexp";

/**
 * 检查路径token是否为具名参数Key对象
 *
 * 作用：判断path-to-regexp解析出的token是否为具名参数（Key类型），
 *       而非普通字符串token
 *
 * 意图：path-to-regexp库解析路径时会返回Key[]数组，其中每个元素
 *       可能是Key对象（包含name属性的具名参数）或字符串。
 *       此守卫用于安全地访问Key对象的name属性
 *
 * 调用时机：在BaseLayer.params方法中遍历paramNames时调用，
 *           用于确保只处理具名参数而非字符串token
 *
 * @param token - path-to-regexp解析出的token，可能是Key对象或字符串
 * @returns 如果token是Key对象则返回true，否则返回false
 *
 * @example
 * ```typescript
 * const tokens: (Key | string)[] = [...];
 * for (const token of tokens) {
 *   if (isNamedKey(token)) {
 *     // token.name 可以安全访问
 *     console.log(token.name);
 *   }
 * }
 * ```
 */
export function isNamedKey(token: Key | string): token is Key {
  return typeof token === "object" && token !== null && "name" in token;
}

/**
 * 检查值是否为字符串类型
 *
 * 作用：类型安全地判断一个值是否为字符串
 *
 * 意图：用于从联合类型中安全地提取字符串值，
 *       避免使用 `as string` 类型断言
 *
 * 调用时机：在需要从 `string | number | boolean | null` 等联合类型
 *           中提取字符串值时使用
 *
 * @param value - 需要检查的值
 * @returns 如果值是字符串则返回true
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}
