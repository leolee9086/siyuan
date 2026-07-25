/**
 * CalibURRouter 入口
 *
 * 基于集合论的类型安全模式匹配引擎
 *
 * @example
 * ```ts
 * import { calibur } from "calibur-router";
 * import { type } from "arktype";
 *
 * const matcher = calibur.universe(type({
 *   按键: "string",
 *   修饰符: { ctrl: "boolean", shift: "boolean" }
 * }));
 *
 * const dispatch = matcher
 *   .split(type({ 按键: "'Enter'" }), () => ({ 命令: "回车" }))
 *   .otherwise(() => ({ 命令: "默认" }))
 *   .build();
 *
 * dispatch({ 按键: "Enter", 修饰符: { ctrl: false, shift: false } });
 * // => { 命令: "回车" }
 * ```
 */
import { createCaliburRouter } from "./core/matcher.js";
import { arktypeBackend } from "./adapters/arktype.js";
// 默认入口保持 ArkType 行为；其它后端通过独立子路径导出。
export const calibur = createCaliburRouter(arktypeBackend);
export { createCaliburRouter, arktypeBackend };
// 工具函数
export { 匹配, 是子集, 有交集, 是空集 } from "./utils/setOps.js";
//# sourceMappingURL=index.js.map