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
export declare const calibur: import("./index.js").CaliburRouter;
export { createCaliburRouter, arktypeBackend };
export type { 匹配器构建器, 可构建匹配器, 分发器, 处理器, 已注册模式, 切割后剩余, 剩余集为空, 推断类型, PatternState, PatternShapeState, FormalUnit, StateSpaceBackend, CaliburRouter, 状态空间模式, } from "./core/types.js";
export { 匹配, 是子集, 有交集, 是空集 } from "./utils/setOps.js";
//# sourceMappingURL=index.d.ts.map