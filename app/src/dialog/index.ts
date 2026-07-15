/** 用途：生成唯一 ID。使用范围：对话框实例标识。解耦评估：通过 ./imports 转发。 */
import { genUUID } from "./imports";
/** 用途：Protyle 编辑器类型。使用范围：Dialog 类属性类型。解耦评估：通过 ./imports 转发。 */
import type { Protyle } from "./imports";
/** 用途：移动端判断。使用范围：对话框尺寸适配。解耦评估：通过 ./imports 转发。 */
import { isMobile } from "./imports";
/** 用途：系统常量。使用范围：对话框配置。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：应用实例类型。使用范围：Dialog 上下文。解耦评估：通过 ./imports 转发。 */
import type { App } from "./imports";
/** 用途：推送对话框到全局列表。使用范围：构造函数注册。解耦评估：通过 ./imports 转发。 */
import { pushSiyuanDialog } from "./imports";
/** 用途：递增对话框层级。使用范围：非模态浮层点击提升。解耦评估：通过 ./imports 转发。 */
import { incrementSiyuanZIndex } from "./imports";
/** 用途：键盘组合键判断。使用范围：对话框键盘事件。解耦评估：通过 ./imports 转发。 */
/** 用途：键盘组合键判断。使用范围：对话框键盘事件。解耦评估：通过 ./imports 转发。 */
import { isNotCtrl } from "./imports";
/** 用途：对话框事件和渲染函数。使用范围：对话框初始化。解耦评估：同目录模块。 */
import { 绑定对话框事件 } from "./dialogHelpers.events";
/** 用途：挂载 Vue 标题组件。使用范围：对话框标题渲染。解耦评估：同目录模块。 */
import { 挂载标题Vue组件 } from "./dialogHelpers.lifecycle";
/** 用途：创建键盘事件处理器。使用范围：对话框输入框。解耦评估：同目录模块。 */
import { 创建输入框键盘事件处理器 } from "./dialogHelpers.events";
/** 用途：进入全屏模式。使用范围：对话框全屏。解耦评估：同目录模块。 */
import { 进入全屏模式 } from "./dialogHelpers";
/** 用途：退出全屏模式。使用范围：对话框全屏。解耦评估：同目录模块。 */
import { 退出全屏模式 } from "./dialogHelpers";
/** 用途：初始化对话框内容。使用范围：对话框创建。解耦评估：同目录模块。 */
import { 初始化对话框内容 } from "./dialogHelpers.lifecycle";
/** 用途：添加对话框到 DOM。使用范围：对话框显示。解耦评估：同目录模块。 */
import { 添加对话框到DOM } from "./dialogHelpers.lifecycle";
/** 用途：执行销毁清理。使用范围：对话框销毁。解耦评估：同目录模块。 */
import { 执行销毁清理 } from "./dialogHelpers.lifecycle";
/** 用途：HTMLElement 类型守卫。使用范围：对话框 DOM 操作。解耦评估：同目录守卫文件。 */
import { isHTMLElement } from "./dialog.guard";
/** 用途：对话框拖拽调整大小。使用范围：对话框初始化。解耦评估：同目录模块。 */
import { moveResize } from "./imports";

/** 用途：对话框选项类型。使用范围：Dialog 构造函数。解耦评估：同目录类型文件。 */
import { IDialogOptions } from "./dialog.types";
/** 导出 IDialogOptions 类型 */
export type { IDialogOptions };

/** 对话框组件类 */
export class Dialog {
    private destroyCallback: (options?: IObject) => void;
    public element: HTMLElement;
    /** 标准 Dialog 的实际定位根节点；`element` 保留外层包装兼容性。 */
    public readonly rootElement: HTMLElement;
    /** 标准 Dialog 内容容器；供需要自定义 body 结构的能力适配器使用。 */
    public readonly containerElement: HTMLElement;
    /** 标准 Dialog body；供内容编排器挂载自定义内容而无需依赖内部查询。 */
    public readonly bodyElement: HTMLElement;
    public id: string;
    private disableClose: boolean;
    private disableScrimClose: boolean;
    private disableEscapeClose: boolean;
    private scrimPointerEvents: boolean;
    public editors: { [key: string]: Protyle } = {};
    public data: IObject = {};
    private titleVueApp: App | null = null;
    private isFullscreen: boolean = false;
    private originalSize: { width: string; height: string; left: string; top: string } | null = null;
    private abortController: AbortController;
    private resizeCallback: (type: string) => void;
    private destroyed = false;

    constructor(options: IDialogOptions) {
        this.resizeCallback = options.resizeCallback;
        this.disableClose = options.disableClose ?? false;
        this.disableScrimClose = options.disableScrimClose ?? false;
        this.disableEscapeClose = options.disableEscapeClose ?? false;
        this.scrimPointerEvents = options.scrimPointerEvents ?? false;
        this.id = genUUID();
        this.abortController = new AbortController();
        // 非模态浮层不参与全局模态 Dialog 栈，避免影响全局快捷键和 ESC 路由。
        if (options.registerInDialogStack !== false) {
            pushSiyuanDialog(this);
        }
        this.destroyCallback = options.destroyCallback ?? (() => { });
        this.data = options.data || {};
        this.element = document.createElement("div");

        初始化对话框内容(this.element, options, {
            disableClose: this.disableClose,
            scrimPointerEvents: this.scrimPointerEvents
        });
        const containerElement = this.element.querySelector(".b3-dialog__container");
        const rootElement = this.element.querySelector(".b3-dialog");
        if (!isHTMLElement(rootElement)) {
            throw new Error("Dialog root was not created");
        }
        this.rootElement = rootElement;
        if (!isHTMLElement(containerElement)) {
            throw new Error("Dialog container was not created");
        }
        this.containerElement = containerElement;
        const bodyElement = containerElement.querySelector(".b3-dialog__body");
        if (!isHTMLElement(bodyElement)) {
            throw new Error("Dialog body was not created");
        }
        this.bodyElement = bodyElement;
        绑定对话框事件(this, this.element, this.disableClose, this.disableScrimClose, () => this.isFullscreen);
        添加对话框到DOM(this.element, options.disableAnimation);
        this.titleVueApp = 挂载标题Vue组件(this.element, options);

        // 桌面端启用对话框拖拽和缩放功能，querySelector 可能返回 null 需类型守卫
        if (!isMobile()) {
            moveResize(containerElement, options.resizeCallback);
        }
    }

    /**
     * @作用: 销毁对话框，移除 DOM 元素并清理所有相关资源。
     * @意图: 提供统一的对话框销毁机制，确保正确清理所有资源（包括事件监听器、Vue 组件等），防止内存泄漏。
     * @调用时机: 当对话框需要关闭时调用，可以是用户点击关闭按钮、按下 ESC 键，或程序逻辑需要关闭对话框时。
     * @问题/改进: 无已知问题。
     * 
     * @param options 可选的销毁参数，会传递给 destroyCallback
     */
    public destroy(options?: IObject) {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        // 中止所有通过 listen 方法添加的事件监听器
        this.abortController.abort();
        this.element.classList.remove("b3-dialog--open");
        // 等待关闭动画（CSS transition）完成后再执行 DOM 清理，无法使用 transitionend 因为动画目标元素可能不确定
        setTimeout(() => {
            this.titleVueApp = 执行销毁清理(this.element, this.id, this.titleVueApp, this.destroyCallback, options);
        }, Constants.TIMEOUT_DBLCLICK);
    }

    /**
     * @作用: 切换对话框的全屏状态（全屏/退出全屏）。
     * @意图: 为用户提供全屏查看对话框内容的能力，在全屏状态下可以获得更大的可视区域。
     * @调用时机: 用户点击对话框标题栏的全屏按钮时，或在全屏状态下按 ESC 键时调用。
     * @问题/改进: 无已知问题。
     */
    public fullscreen() {
        const container = this.element.querySelector(".b3-dialog__container");
        if (!isHTMLElement(container)) {
            return;
        }

        // 退出全屏模式
        if (this.isFullscreen && this.originalSize) {
            退出全屏模式(container, this.element, this.originalSize);
            this.isFullscreen = false;
            this.originalSize = null;
            return;
        }

        // 进入全屏模式
        if (!this.isFullscreen) {
            this.originalSize = {
                width: container.style.width,
                height: container.style.height,
                left: container.style.left,
                top: container.style.top
            };
            进入全屏模式(container, this.element);
            this.isFullscreen = true;
        }
    }

    /** 处理对话框尺寸变化 */
    public resize() {
        if (!this.resizeCallback) {
            return;
        }
        const containerElement = this.element.querySelector(".b3-dialog__container");
        // 非全屏模式下触发尺寸回调
        if (containerElement instanceof HTMLElement && containerElement.style.maxWidth !== "none") {
            this.resizeCallback("l");
        }
    }

    /** 将 Dialog 根节点和可见容器同步提升到最前，适用于非模态浮层。 */
    public bringToFront() {
        const zIndex = incrementSiyuanZIndex().toString();
        this.rootElement.style.zIndex = zIndex;
        this.containerElement.style.zIndex = zIndex;
    }

    /**
     * @作用: 为输入框绑定键盘事件处理，支持回车确认和 ESC 关闭对话框。
     * @意图: 提供统一的输入框键盘交互逻辑，简化对话框中输入操作的处理。
     * @调用时机: 在对话框创建后，需要为输入框添加键盘交互时调用。
     * @问题/改进: 无已知问题。
     * 
     * @param inputElement 要绑定事件的输入框元素
     * @param enterEvent 按下回车键时的回调函数
     * @param bindEnter 是否绑定回车键事件，默认为 true
     */
    public bindInput(inputElement: HTMLInputElement | HTMLTextAreaElement, enterEvent?: () => void, bindEnter = true) {
        inputElement.focus();
        let timeStamp: number;

        const 处理器 = 创建输入框键盘事件处理器({
            dialog: this,
            enterEvent,
            bindEnter,
            /** @简洁函数 获取时间戳用于防抖 */
            getTimeStamp: () => timeStamp,
            /** @简洁函数 设置时间戳用于防抖 */
            setTimeStamp: (value: number) => {
                timeStamp = value;
            },
            /** @简洁函数 获取全屏状态 */
            isFullscreen: () => this.isFullscreen,
            /** @简洁函数 获取 ESC 键关闭配置 */
            disableEscapeClose: () => this.disableEscapeClose
        });

        inputElement.addEventListener("keydown", 处理器);
    }

    /**
     * @作用: 为对话框添加事件监听器，并在对话框销毁时自动清理。
     * @意图: 提供统一的事件监听器管理机制，避免手动管理 removeEventListener，防止内存泄漏。
     * @调用时机: 在对话框创建后，需要为对话框内的元素或对话框本身添加事件监听器时调用。
     * @问题/改进: 无已知问题。
     * 
     * @param target 要监听的目标元素
     * @param type 事件类型，如 "click"、"keydown" 等
     * @param listener 事件处理函数
     * @param options 可选的事件监听器配置，会自动添加 signal
     * 
     * @example
     * ```typescript
     * const dialog = new Dialog({ ... });
     * const inputElement = dialog.element.querySelector(".b3-text-field");
     * dialog.listen(inputElement, "keydown", (event) => {
     *     if (event.key === "Enter") {
     *         // 处理回车
     *     }
     * });
     */
    public listen(
        target: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: AddEventListenerOptions | boolean
    ) {
        const listenerOptions = typeof options === "boolean"
            ? { capture: options, signal: this.abortController.signal }
            : { ...options, signal: this.abortController.signal };

        target.addEventListener(type, listener, listenerOptions);
    }
}
