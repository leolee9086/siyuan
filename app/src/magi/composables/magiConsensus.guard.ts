/**
 * MAGI共识处理类型守卫
 *
 * 为 magiConsensus.ts 提供响应结果的类型安全过滤。
 */

// [TASK] T2.2 迁移composables和工具函数 - magiConsensus.guard

import type { SageResponse } from "../utils/messageFactory.types";

/** 过滤null值，返回有效的贤者响应 */
export const isSageResponse = (
    value: SageResponse | null,
): value is SageResponse => value !== null;
