/**
 * sforge.types.ts - SForge 类型定义
 */

import { SForgeSymbols } from "./sforge.symbols";
import type { TabRegistration } from "../registry/TabRegistry.types";
import type { ITriggerRegistration, IBrushSession, IStyleBrushHandlers } from "../registry/TriggerRegistry.types";

/**
 * SForge 全局状态类型定义
 * 
 * 用途：定义 SForge 全局状态的结构
 * 使用场景：在 sforge.global.ts 中用于类型安全的全局状态存取
 * 关联类型：各注册表类型（TabRegistration, ITriggerRegistration 等）
 */
export interface ISForgeGlobalState {
    [SForgeSymbols.DOCK_TYPE_REGISTRY]?: Map<string, TDockPosition>;
    [SForgeSymbols.TAB_TYPE_REGISTRY]?: Map<string, TabRegistration>;
    [SForgeSymbols.TRIGGER_REGISTRY]?: Map<string, ITriggerRegistration>;
    [SForgeSymbols.BRUSH_SESSION]?: IBrushSession | null;
    [SForgeSymbols.STYLE_BRUSH_HANDLERS]?: IStyleBrushHandlers;
    [SForgeSymbols.POPOVER_TARGET_ELEMENT]?: HTMLElement;
}

/**
 * 包含 SForge 的全局对象接口（内部使用）
 * 
 * 用途：定义挂载 SForge 全局状态的 globalThis 接口
 * 使用场景：在 sforge.global.ts 中用于类型安全的 globalThis 访问
 */
export interface IGlobalWithSForge {
    [key: symbol]: ISForgeGlobalState;
}

