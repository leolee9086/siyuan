/**
 * CalibURRouter 核心实现
 *
 * 基于集合论的类型安全模式匹配引擎
 */
import type { 匹配器构建器, 状态空间模式 } from "./types.js";
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
     */
    universe<全集>(全集模式: 状态空间模式<全集>): 匹配器构建器<全集, never>;
};
export type { 匹配器构建器, 可构建匹配器, 分发器, 处理器, 已注册模式, 耗尽的匹配器构建器 } from "./types.js";
//# sourceMappingURL=matcher.d.ts.map