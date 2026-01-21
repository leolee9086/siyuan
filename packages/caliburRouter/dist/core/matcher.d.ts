/**
 * CalibURRouter 核心实现
 *
 * 基于集合论的类型安全模式匹配引擎
 */
import { Type } from "arktype";
import type { 匹配器构建器 } from "./types.js";
/**
 * calibur 命名空间
 * 提供创建模式匹配器的入口API
 */
export declare const calibur: {
    /**
     * 定义状态空间全集，创建匹配器构建器
     *
     * @param 全集模式 - arktype模式，定义所有可能的输入
     * @returns 匹配器构建器，可链式调用split和remain
     *
     * @example
     * ```ts
     * const matcher = calibur.universe(type({
     *   按键: "string",
     *   修饰符: { ctrl: "boolean", shift: "boolean" }
     * }));
     *
     * matcher
     *   .split(type({ 按键: "'Enter'" }), () => ({ 命令: "回车" }))
     *   .split(type({ 按键: "'Tab'" }), () => ({ 命令: "制表符" }))
     *   .remain(() => ({ 命令: "其他" }))
     *   .build();
     * ```
     */
    universe<全集>(全集模式: Type<全集>): 匹配器构建器<全集, 全集, never>;
};
export type { 匹配器构建器, 可构建匹配器, 分发器, 处理器, 已注册模式 } from "./types.js";
//# sourceMappingURL=matcher.d.ts.map