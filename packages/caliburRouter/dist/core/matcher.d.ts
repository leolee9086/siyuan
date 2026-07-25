/**
 * CalibURRouter 核心实现
 *
 * 基于集合论的类型安全模式匹配引擎
 */
import type { CaliburRouter, StateSpaceBackend } from "./types.js";
/**
 * calibur 命名空间
 * 提供创建模式匹配器的入口API
 */
export declare function createCaliburRouter(backend: StateSpaceBackend): CaliburRouter;
export type { 匹配器构建器, 可构建匹配器, 分发器, 处理器, 已注册模式, 耗尽的匹配器构建器 } from "./types.js";
//# sourceMappingURL=matcher.d.ts.map