/**
 * sforge.symbols.ts - SForge Symbol 键定义
 * 
 * 使用 Symbol 作为属性键，避免命名冲突和意外覆盖
 */

/** Layout 持久化状态注册表的唯一类型键。 */
export const LAYOUT_PERSISTENCE_REGISTRY = Symbol.for("sforge.layout.persistenceRegistry");

/** 导航历史状态注册表的唯一类型键。 */
export const NAVIGATION_HISTORY_REGISTRY = Symbol.for("sforge.navigation.historyRegistry");

/** 移动键盘生命周期状态的唯一类型键。 */
export const MOBILE_KEYBOARD_LIFECYCLE_REGISTRY = Symbol.for("sforge.mobile.keyboardLifecycleRegistry");

/** AV 虚拟滚动跨调用状态的唯一注册表键。 */
export const AV_VIRTUAL_SCROLL_REGISTRY = Symbol.for("sforge.av.virtualScrollRegistry");

/** AV 条目定位跨调用状态的唯一注册表键。 */
export const AV_LOCATE_REGISTRY = Symbol.for("sforge.av.locateRegistry");

/** 窗口键盘切换对话框生命周期状态的唯一注册表键。 */
export const WINDOW_KEYDOWN_SWITCH_DIALOG = Symbol.for("sforge.windowKeyDown.switchDialog");

/** 当前搜索文章预览标识的唯一状态键。 */
export const ARTICLE_PREVIEW_CURRENT_ID = Symbol.for("sforge.search.articlePreviewCurrentId");

/** 新用户引导跨登录与同步事件的唯一生命周期状态键。 */
export const ONBOARDING_LIFECYCLE_STATE = Symbol.for("sforge.onboarding.lifecycleState");

/** SForge 全局状态 Symbol 键。 */
export const SForgeSymbols = Object.freeze({
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
    /** Popover 目标元素 (用于解决模块级变量缓存不一致问题) */
    POPOVER_TARGET_ELEMENT: Symbol.for("sforge.popover.targetElement"),
    /** Model WebSocket 处理器 (用于打断 Model 循环依赖) */
    MODEL_HANDLERS: Symbol.for("sforge.model.handlers"),
    /** openMobileFileById 代理 (用于打断 mobile/editor ↔ plugin/API 循环依赖) */
    OPEN_MOBILE_FILE_BY_ID: Symbol.for("sforge.mobile.openFileById"),
    /** 内容块渲染器注册表 */
    CONTENT_RENDERER_REGISTRY: Symbol.for("sforge.contentRenderer.registry"),
    /** 拖拽提示框状态（用于解决模块级变量问题） */
    DRAG_TIP_STATE: Symbol.for("sforge.dragTip.state"),
    /** 拖拽引用行级竖线元素（用于解决模块级变量问题） */
    CARET_LINE_ELEMENT: Symbol.for("sforge.dragTip.caretLineElement"),
    /** 请求信号量 (用于限制 API 最大并发) */
    REQUEST_SEMAPHORE: Symbol.for("sforge.fetch.requestSemaphore"),
    /** Protyle Dialog/消息/Tooltip 宿主能力 */
    DIALOG_PORT: Symbol.for("sforge.protyle.dialogPort"),
    /** Protyle 状态统计宿主能力 */
    STATUS_PORT: Symbol.for("sforge.protyle.statusPort"),
    /** Protyle 布局协同宿主能力 */
    LAYOUT_PORT: Symbol.for("sforge.protyle.layoutPort"),
    /** Layout 页签 Dialog 浮窗宿主能力 */
    TAB_FLOAT_PORT: Symbol.for("sforge.layout.tabFloatPort"),
    /** Layout 页签浮窗副本工厂注册表 */
    TAB_FLOAT_FACTORY_REGISTRY: Symbol.for("sforge.layout.tabFloatFactoryRegistry"),
    /** Layout 普通 Tab 打开宿主能力 */
    TAB_OPEN_PORT: Symbol.for("sforge.layout.tabOpenPort"),
    /** Wnd 拖拽恢复宿主能力 */
    WND_DRAG_RESTORE: Symbol.for("sforge.layout.wndDragRestore"),
} as const);
