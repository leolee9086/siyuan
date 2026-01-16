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
    /** Trigger 触发器注册表 (智能工具箱) */
    TRIGGER_REGISTRY: Symbol.for("sforge.trigger.registry"),
    /** Brush 刷子会话状态 */
    BRUSH_SESSION: Symbol.for("sforge.trigger.brushSession"),
    /** SForge 全局对象的 Symbol 键 */
    GLOBAL_KEY: Symbol.for("sforge.global"),
    /** 样式刷子全局事件处理器 (用于解决模块级变量问题) */
    STYLE_BRUSH_HANDLERS: Symbol.for("sforge.styleBrush.handlers"),
} as const;

// 中文别名
export const SForge符号 = SForgeSymbols;

