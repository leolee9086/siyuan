import type { Type } from "arktype";
import type { 状态空间模式 } from "../core/types.js";
/** ArkType 的跨实例适配边界。 */
export type ArkTypePattern = Type<unknown>;
/**
 * 校验 CaliburRouter 使用到的完整 ArkType 运行时表面。
 *
 * `Scope.internal.bindReference` 是跨 ArkType scope 归一化所需的公开
 * 适配能力。缺失时立即失败，不能退回到直接组合不同 scope 的节点。
 */
export declare function assertArkTypePattern(pattern: 状态空间模式): ArkTypePattern;
/** 将模式绑定到目标模式的 Scope，避免跨 ArkType 版本或 scope 直接组合节点。 */
export declare function bindArkTypePattern<目标状态 = unknown>(target: ArkTypePattern, source: 状态空间模式<目标状态>): ArkTypePattern;
//# sourceMappingURL=arktypePattern.d.ts.map