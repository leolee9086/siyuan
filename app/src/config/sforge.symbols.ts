/**
 * sforge.symbols.ts - SForge Symbol 键定义
 * 
 * 使用 Symbol 作为属性键，避免命名冲突和意外覆盖
 */

/**
 * SForge 全局状态 Symbol 键
 */
export const SForgeSymbols = {
    /** Dock 类型注册表 */
    DOCK_TYPE_REGISTRY: Symbol.for("sforge.dock.typeRegistry"),
    /** Tab 类型注册表 */
    TAB_TYPE_REGISTRY: Symbol.for("sforge.tab.typeRegistry"),
    /** SForge 全局对象的 Symbol 键 */
    GLOBAL_KEY: Symbol.for("sforge.global"),
} as const;

// 中文别名
export const SForge符号 = SForgeSymbols;
