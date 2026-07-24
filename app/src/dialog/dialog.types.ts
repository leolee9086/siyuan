/** 用途：Vue 组件挂载配置类型。使用范围：Dialog 公共选项；解耦评估：经类型专用网关依赖纯契约，不加载 Vue 挂载实现。 */
import type {VueComponentMountConfig} from "./types/imports";
/** 用途：Vue 组件加载上下文类型。使用范围：Dialog 公共选项；解耦评估：与挂载配置共用纯类型网关，不依赖 Vue 加载器实现。 */
import type {VueComponentLoaderContext} from "./types/imports";

/**
 * 对话框选项接口
 */
export interface IDialogOptions {
    positionId?: string,
    title?: string,
    titleVueConfig?: VueComponentMountConfig, // 新增：标题Vue组件配置
    titleVueContext?: VueComponentLoaderContext, // 新增：标题Vue组件上下文
    transparent?: boolean,
    content: string,
    width?: string,
    height?: string,
    destroyCallback?: (options?: IObject) => void,
    disableClose?: boolean,
    hideCloseIcon?: boolean,
    disableAnimation?: boolean,
    resizeCallback?: (type: string) => void,
    containerClassName?: string,
    disableScrimClose?: boolean, // 是否禁用点击遮罩关闭
    disableEscapeClose?: boolean,  // 是否禁用 Escape 键关闭
    scrimPointerEvents?: boolean, // 是否允许遮罩层鼠标事件穿透
    /** 是否渲染遮罩；默认为 true。非模态浮层可关闭遮罩但保留统一 Dialog 生命周期。 */
    showScrim?: boolean,
    /** 是否把实例加入 window.siyuan.dialogs；默认为 true。非模态宿主可关闭全局 Dialog 栈参与。 */
    registerInDialogStack?: boolean,
    /** Dialog 根节点附加 class，供非模态浮层选择自己的定位/交互样式。 */
    rootClassName?: string,
    closeButtonPosition?: "outside" | "inside" | "inside-body", // 关闭按钮位置：外部(默认)、内部标题栏、内部内容区域
    data?: IObject // 自定义数据
}

/** 对话框接口，用于辅助函数引用 */
export interface IDialog {
    id: string;
    /** Dialog 生命周期内稳定存在的根元素。 */
    element: HTMLElement;
    destroy: (options?: IObject) => void;
    fullscreen: () => void;
}

/** 对话框HTML生成参数 */
export interface I对话框HTML参数 {
    zIndex: number;
    left?: string | undefined;
    top?: string | undefined;
    scrimPointerEvents: boolean;
    showScrim: boolean;
    rootClassName?: string | undefined;
    transparent?: boolean | undefined;
    containerClassName?: string | undefined;
    width?: string | undefined;
    height?: string | undefined;
    closeButtonPosition: string;
    closeButtonHtml: string;
    fullscreenButtonHtml: string;
    headerPaddingRight: string;
    hasTitle: boolean;
    title?: string | undefined;
    content: string;
}

/** 表示单个方向定位策略共享的 Tooltip 尺寸、目标矩形、方向和间距。 */
export interface ITooltipPositionContext {
    messageElement: HTMLElement;
    targetRect: DOMRect;
    position: string | null;
    space: number;
}

/** 表示 Tooltip 垂直溢出调整所需的目标、间距、元素和视口高度。 */
export interface ITooltipOverflowContext {
    targetRect: DOMRect;
    positionDiff: number;
    messageElement: HTMLElement;
    windowHeight: number;
}

/** 表示总定位分派器使用的方向上下文，并补充实际目标元素。 */
export interface ITooltipCalculationContext extends ITooltipPositionContext {
    target: Element;
}

/** 保持公共 showTooltip 位置参数调用方式的元组类型，同时让实现使用单个 rest 参数。 */
export type TShowTooltipArguments = [
    message: string,
    target: Element,
    tooltipClass?: string,
    event?: MouseEvent,
    space?: number,
];
