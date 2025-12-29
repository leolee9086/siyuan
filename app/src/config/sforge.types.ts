/**
 * sforge.types.ts - SForge 类型定义
 */

import { SForgeSymbols } from "./sforge.symbols";

/**
 * SForge 全局状态类型定义
 */
export interface ISForgeGlobalState {
    [SForgeSymbols.DOCK_TYPE_REGISTRY]?: Map<string, TDockPosition>;
}

/**
 * 包含 SForge 的全局对象接口（内部使用）
 */
export interface IGlobalWithSForge {
    [key: symbol]: ISForgeGlobalState;
}
