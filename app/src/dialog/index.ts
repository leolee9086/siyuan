import { genUUID } from "../util/platform/genID";
import { moveResize } from "./moveResize";
import { Protyle } from "../protyle";
import { isMobile } from "../util/platform/functions";
import { Constants } from "../constants";
import { App } from "vue";
import { pushSiyuanDialog } from "../util/siyuanEnvironments/siyuanDialogs.environment";
import {
    绑定对话框事件,
    挂载标题Vue组件,
    创建输入框键盘事件处理器,
    进入全屏模式,
    退出全屏模式,
    初始化对话框内容,
    添加对话框到DOM,
    执行销毁清理
} from "./dialogHelpers";
import { IDialogOptions } from "./dialog.types";
import { isHTMLElement } from "./dialog.guard";
import { isNotCtrl } from "../protyle/util/compatibility";

export type { IDialogOptions } from "./dialog.types";

export class Dialog {
    private destroyCallback: (options?: IObject) => void;
    public element: HTMLElement;
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

    constructor(options: IDialogOptions) {
        this.resizeCallback = options.resizeCallback;
        this.disableClose = options.disableClose ?? false;
        this.disableScrimClose = options.disableScrimClose ?? false;
        this.disableEscapeClose = options.disableEscapeClose ?? false;
        this.scrimPointerEvents = options.scrimPointerEvents ?? false;
        this.id = genUUID();
        this.abortController = new AbortController();
        pushSiyuanDialog(this);
        this.destroyCallback = options.destroyCallback ?? (() => { });
        this.data = options.data || {};
        this.element = document.createElement("div");

        初始化对话框内容(this.element, options, {
            disableClose: this.disableClose,
            scrimPointerEvents: this.scrimPointerEvents
        });
        绑定对话框事件(this, this.element, this.disableClose, this.disableScrimClose, () => this.isFullscreen);
        添加对话框到DOM(this.element, options.disableAnimation);
        this.titleVueApp = 挂载标题Vue组件(this.element, options);

        const containerElement = this.element.querySelector(".b3-dialog__container");
        // 桌面端启用对话框拖拽和缩放功能，querySelector 可能返回 null 需类型守卫
        if (!isMobile() && isHTMLElement(containerElement)) {
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
    public fullscreen(): void {
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

    public resize() {
        if (this.resizeCallback) {
            const containerElement = this.element.querySelector(".b3-dialog__container") as HTMLElement;
            if (containerElement && containerElement.style.maxWidth !== "none") {
                this.resizeCallback("l");
            }
        }
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
    ): void {
        const listenerOptions = typeof options === "boolean"
            ? { capture: options, signal: this.abortController.signal }
            : { ...options, signal: this.abortController.signal };

        target.addEventListener(type, listener, listenerOptions);
    }
}
