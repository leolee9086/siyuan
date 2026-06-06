/**
 * MIME 类型工具函数
 *
 * 提供 MIME 类型相关的判断和处理功能
 */

/** 文本类型的 application/* MIME 类型列表 */
const TEXT_APPLICATION_MIMES = new Set([
  "application/json",
  "application/x-javascript",
]);

/**
 * 判断给定的 MIME 类型是否为文本类型
 *
 * 作用：根据 MIME 类型判断内容是否应该以文本形式处理而非二进制
 * 意图：在文件读取时用于决定返回字符串还是二进制数据，
 *       确保文本文件（如代码、配置文件）能被正确处理为可读的字符串
 * 调用时机：在获取文件响应后，根据 Content-Type 头部判断返回格式
 *
 * 支持的文本类型：
 * - 所有以 "text/" 开头的 MIME 类型（如 text/plain, text/html, text/css 等）
 * - application/json（JSON 数据）
 * - application/x-javascript（JavaScript 代码）
 *
 * @param mime - MIME 类型字符串，可能为 null（当响应没有 Content-Type 头部时）
 * @returns 如果是文本类型返回 true，否则返回 false
 */
/** @同步豁免: 性能考虑 - 纯内存计算的类型判断函数，无 I/O 操作，异步化会引入不必要的开销 */
export function isTextMime(mime: string | null) {
  if (!mime) {
    return false;
  }
  if (mime.startsWith("text")) {
    return true;
  }
  return TEXT_APPLICATION_MIMES.has(mime);
}
