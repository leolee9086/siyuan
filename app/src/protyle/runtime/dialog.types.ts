/**
 * Protyle 对宿主 UI 弹窗能力的最小契约。
 *
 * Protyle 业务代码可以继续操作 `element`、绑定事件和销毁实例，但不再
 * 依赖完整思源的 Dialog 模块。宿主可以返回原版 Dialog，也可以返回一个
 * 结构兼容的实现。
 */
export interface IProtyleDialog {
    element: HTMLElement;
    id: string;
    editors: Record<string, IProtyle>;
    data: IObject;
    destroy: (options?: IObject) => void;
    fullscreen: () => void;
    resize: () => void;
    bindInput: (
        inputElement: HTMLInputElement | HTMLTextAreaElement,
        enterEvent?: () => void,
        bindEnter?: boolean
    ) => void;
    listen: (
        target: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: AddEventListenerOptions | boolean
    ) => void;
}

/** 与思源原版 Dialog 兼容的创建参数；仅保留 Protyle 当前实际使用的字段，避免 Port 依赖 Vue。 */
export interface IProtyleDialogOptions {
    positionId?: string;
    title?: string;
    transparent?: boolean;
    content: string;
    width?: string;
    height?: string;
    destroyCallback?: (options?: IObject) => void;
    disableClose?: boolean;
    hideCloseIcon?: boolean;
    disableAnimation?: boolean;
    resizeCallback?: (type: string) => void;
    containerClassName?: string;
    disableScrimClose?: boolean;
    disableEscapeClose?: boolean;
    scrimPointerEvents?: boolean;
    closeButtonPosition?: "outside" | "inside" | "inside-body";
    data?: IObject;
}

/**
 * 用途：兼容原版异步消息实现和独立同步回退实现返回的消息标识。
 * 使用场景：调用 `hideMessage` 关闭上传、导出等异步流程提示。
 * 关联类型：由 `IProtyleDialogPort.showMessage` 返回并交给 `hideMessage` 消费。
 */
export type TProtyleMessageId = string | undefined | Promise<string | undefined>;

/**
 * 用途：声明 Protyle 请求宿主弹窗、消息、Tooltip 和资源选择能力的接口。
 * 使用场景：完整 App 注册原版适配器，独立入口注入自定义宿主或使用回退实现。
 * 关联类型：`IProtyleDialog` 和 `IProtyleDialogOptions` 组成结构兼容的弹窗生命周期契约。
 */
export interface IProtyleDialogPort {
    create: (options: IProtyleDialogOptions) => IProtyleDialog;
    confirm: (
        title: string,
        text: string,
        confirm?: (dialog?: IProtyleDialog) => void,
        cancel?: (dialog?: IProtyleDialog) => void,
        isDelete?: boolean
    ) => void;
    showMessage: (message: string, timeout?: number, type?: string, messageId?: string) => TProtyleMessageId;
    hideMessage: (id?: TProtyleMessageId) => void | Promise<void>;
    showTooltip: (message: string, target: Element, tooltipClass?: string, event?: MouseEvent, space?: number) => void | Promise<void>;
    hideTooltip: () => void | Promise<void>;
    openAssetDialog?: (callback: (url: string, name: string) => void) => void;
    closeAssetDialog?: () => void;
    moveResize?: (element: HTMLElement, resizeCallback?: (type: string) => void) => void;
}
