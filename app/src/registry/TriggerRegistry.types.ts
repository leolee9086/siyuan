/**
 * TriggerRegistry.types.ts - 触发器注册表类型定义
 * 
 * 定义智能工具箱的触发器系统核心数据结构。
 * 该系统支持三种触发模式：
 * - immediate: 立即执行
 * - brush: 刷子模式（格式刷等）
 * - toggle: 切换模式
 * 
 * @module layout/registry/TriggerRegistry.types
 */

/**
 * 触发模式枚举
 * 
 * 用途：定义触发器的执行模式
 * 使用场景：在 ITriggerRegistration 中指定触发器的行为模式
 * 关联类型：ITriggerRegistration
 * 
 * - immediate: 点击后立即执行，无后续状态
 * - brush: 刷子模式，激活后可多次点击应用
 * - toggle: 切换模式，点击切换开/关状态
 */
export type 触发模式 = "immediate" | "brush" | "toggle";

/**
 * TriggerMode - 触发模式的英文别名
 * 
 * 用途：为国际化场景提供英文类型名
 * 使用场景：英文代码库或对外 API
 * 关联类型：触发模式
 */
export type TriggerMode = 触发模式;

/**
 * 全局上下文接口 - 驱动工具箱智能化的核心数据结构
 * 
 * 用途：封装当前编辑器环境的完整状态信息
 * 使用场景：
 *   - 触发器的 match 函数用于判断是否可用
 *   - 触发器的 onApply 函数用于获取操作目标
 * 关联类型：ITriggerRegistration, IProtyle
 * 
 * 问题/改进：
 *   - 目前 editor 和 asset 字段尚未实现，为未来扩展预留
 */
export interface IGlobalContext {
    /** 当前激活的编辑器实例 */
    protyle: IProtyle | null;

    /** 目标块元数据 */
    目标块: {
        id: string;
        type: string;
        element: HTMLElement;
    };

    /** 选区状态 */
    选区: {
        text: string;
        isCollapsed: boolean;
        range: Range | null;
    };

    /** 扩展数据 - 由各触发器自定义 */
    扩展数据?: Record<string, unknown>;

    // ============ 英文别名 ============
    /** 目标块元数据（英文别名） */
    targetBlock?: IGlobalContext["目标块"];
    /** 选区状态（英文别名） */
    selection?: IGlobalContext["选区"];
    /** 扩展数据（英文别名） */
    extendedData?: IGlobalContext["扩展数据"];
}

/**
 * 批量操作上下文接口 - 用于面板 Ctrl+Click 等批量场景
 * 
 * 用途：封装批量操作所需的最小上下文
 * 使用场景：
 *   - 工具箱面板上的 Ctrl+Click 批量应用
 *   - 快捷键触发的批量操作
 * 关联类型：ITriggerRegistration.onCtrlClick
 * 
 * 设计说明：
 *   - 与 IGlobalContext 不同，批量操作没有"目标块"概念
 *   - 触发器应自行从 protyles 中查找选中的块
 */
export interface IBatchContext {
    /** 包含选区的 Protyle 实例列表 */
    protyles: IProtyle[];
}

// ============ 触发器注册基础与泛型类型定义 ============

/**
 * 触发器基础属性 - 所有模式共享的必须属性
 * 
 * 用途：定义面板点击等场景必须的核心属性
 * 使用场景：作为所有触发器注册的基础
 * 关联类型：IGlobalContext, 触发模式
 */
interface ITriggerBase {
    /** 触发器唯一标识符 */
    type: string;

    /** 
     * 触发器分类 (必填)
     * 用于在 UI 中进行分组展示，如 "常用"、"格式"、"AI" 等
     */
    category: string;

    /** 图标（SVG id 或完整 SVG 标签） */
    icon?: string;

    /** 显示名称（UI展示用） */
    label?: string;

    /** 描述文本（UI展示或Tooltip用） */
    description?: string;

    /** 
     * 谓词匹配：决定工具是否在当前上下文可用
     * 可以返回 Promise 以支持异步判断
     */
    match?: (context: IGlobalContext) => Promise<boolean> | boolean;

    /**
     * 执行逻辑 (所有模式必须)
     * @param target 目标元素
     * @param context 全局上下文
     * @param options 交互选项（包含是否次要动作及原始事件）
     */
    onApply: (target: Element, context: IGlobalContext, options: { isSecondary: boolean, originalEvent?: MouseEvent | KeyboardEvent }) => void;

    /** 
     * Ctrl+点击时的回调 (替代交互，可选)
     * 用于处理工具箱面板上的 Ctrl+Click，通常用于批量应用或进入设置
     * 
     * @param context 批量操作上下文，包含所有有选区的 Protyle 列表
     */
    onCtrlClick?: (context: IBatchContext) => void;
}

/**
 * 刷子模式特有属性
 * 
 * 用途：定义 brush 模式需要的额外属性
 * 使用场景：格式刷等需要激活-点击-退出生命周期的工具
 */
interface IBrushModeProperties {
    mode: "brush";

    /** 刷子模式下的光标 HTML */
    cursorHTML?: string;

    /** 进入刷子模式时的回调 */
    onEnter?: (params: unknown, options?: { originalEvent?: MouseEvent | KeyboardEvent }) => void;

    /** 退出刷子模式时的回调 */
    onExit?: () => void;

    /** 鼠标移动时的回调（用于刷子模式预览） */
    onMove?: (target: Element, context: IGlobalContext) => void;
}

/**
 * 立即执行模式特有属性
 * 
 * 用途：定义 immediate 模式需要的属性（无额外属性）
 * 使用场景：点击即执行的工具
 */
interface IImmediateModeProperties {
    mode: "immediate";
}

/**
 * 切换模式特有属性
 * 
 * 用途：定义 toggle 模式需要的属性
 * 使用场景：开关类工具
 */
interface IToggleModeProperties {
    mode: "toggle";

    /** 进入切换状态时的回调 */
    onEnter?: (params: unknown, options?: { originalEvent?: MouseEvent | KeyboardEvent }) => void;

    /** 退出切换状态时的回调 */
    onExit?: () => void;
}

/**
 * 刷子模式触发器注册类型
 * @AIDONE 根据 mode 决定额外属性的泛型设计
 */
export type IBrushTriggerRegistration = ITriggerBase & IBrushModeProperties;

/**
 * 立即执行模式触发器注册类型
 * @AIDONE 根据 mode 决定额外属性的泛型设计
 */
export type IImmediateTriggerRegistration = ITriggerBase & IImmediateModeProperties;

/**
 * 切换模式触发器注册类型
 * @AIDONE 根据 mode 决定额外属性的泛型设计
 */
export type IToggleTriggerRegistration = ITriggerBase & IToggleModeProperties;

/**
 * 触发器注册信息 - 联合类型
 * @AIDONE 这是一个更加灵活的设计,根据 mode 来决定需要的额外属性
 * 
 * 用途：定义一个工具触发器的完整配置
 * 使用场景：通过 注册触发器() 函数注册到 TriggerRegistry
 * 关联类型：IGlobalContext, 触发模式
 * 
 * 设计说明：
 * - ITriggerBase: 所有模式共享的必须属性（type, category, onApply 等）
 * - IBrushModeProperties: brush 模式额外需要的属性（cursorHTML, onEnter, onExit, onMove）
 * - IImmediateModeProperties: immediate 模式无额外属性
 * - IToggleModeProperties: toggle 模式需要 onEnter/onExit
 */
export type ITriggerRegistration =
    | IBrushTriggerRegistration
    | IImmediateTriggerRegistration
    | IToggleTriggerRegistration;

/**
 * 刷子状态机状态
 * 
 * 用途：定义刷子模式的生命周期状态
 * 使用场景：在 IBrushSession 中跟踪当前刷子的状态
 * 关联类型：IBrushSession
 * 
 * - idle: 空闲，未激活
 * - active: 激活，等待用户点击
 * - applying: 正在应用操作
 */
export type 刷子状态 = "idle" | "active" | "applying";

/**
 * BrushState - 刷子状态的英文别名
 * 
 * 用途：为国际化场景提供英文类型名
 * 使用场景：英文代码库或对外 API
 * 关联类型：刷子状态
 */
export type BrushState = 刷子状态;

/**
 * 刷子会话 - 刷子模式激活时的运行时状态
 * 
 * 用途：存储刷子模式激活期间的所有运行时数据
 * 使用场景：在 TriggerRegistry 内部管理刷子生命周期
 * 关联类型：ITriggerRegistration, 刷子状态
 */
export interface IBrushSession {
    /** 当前激活的触发器类型 */
    triggerType: string;

    /** 刷子状态 */
    状态: 刷子状态;

    /** 传入的参数（如样式刷的源样式） */
    params: unknown;

    /** 光标跟随元素 */
    cursorElement?: HTMLElement;

    /** 清理函数列表 */
    cleanupFns: Array<() => void>;
}

/**
 * 样式刷子参数
 * 
 * 用途：定义样式刷子激活时传入的参数结构
 * 使用场景：在 styleBrush.ts 中作为 激活刷子 的参数
 * 关联类型：IBrushSession
 */
export interface IStyleBrushParameters {
    /** 源块的 style 属性值 */
    sourceStyle: string;
    /** 源块 ID (用于调试) */
    sourceBlockId?: string;
}

/** 样式刷子参数的中文别名 */
export type 样式刷子参数 = IStyleBrushParameters;

/** 样式刷子全局事件处理器集合 (用于避免模块与全局状态污染) */
export interface IStyleBrushHandlers {
    mousemove: ((e: MouseEvent) => void) | null;
    click: ((e: MouseEvent) => void) | null;
    keydown: ((e: KeyboardEvent) => void) | null;
    mousedown: ((e: MouseEvent) => void) | null;
}

/**
 * 光标管理会话 - 存储刷子模式下光标相关的运行时状态
 * 
 * 用途：管理刷子光标元素和清理函数
 * 使用场景：TriggerRegistry.cursor 模块内部使用
 * 关联类型：IBrushSession
 */
export interface 光标管理会话 {
    /** 光标 DOM 元素 */
    cursorElement: HTMLElement | null;
    /** 清理函数列表 */
    cleanupFns: Array<() => void>;
}
