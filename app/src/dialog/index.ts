import { genUUID } from "../util/genID";
/// #if !MOBILE
import { moveResize } from "./moveResize";
/// #endif
import { Protyle } from "../protyle";
import { Constants } from "../constants";
import { App } from "vue";
import { getSiyuanGlobalMenus } from "../util/siyuanEnvironments/getMenu.environment";
import { getSiyuanDialogs } from "../util/siyuanEnvironments/getDialog.environment";
import { incrementSiyuanZIndex, pushSiyuanDialog } from "../util/siyuanEnvironments/siyuanDialogs.environment";
import {
    计算对话框位置,
    生成关闭按钮HTML,
    生成全屏按钮HTML,
    计算标题栏样式,
    生成对话框HTML,
    绑定对话框事件,
    挂载标题Vue组件,
    设置ResizeHandles显示状态,
    更新全屏按钮状态,
    创建输入框键盘事件处理器
} from "./dialogHelpers";
import { IDialogOptions } from "./dialog.types";
import { isHTMLElement } from "./dialog.guard";

// 重新导出接口，保持向后兼容
export type { IDialogOptions } from "./dialog.types";

export class Dialog {
    private destroyCallback: (options?: IObject) => void;
    public element: HTMLElement;
    private id: string;
    private disableClose: boolean;
    private disableScrimClose: boolean;
    private disableEscapeClose: boolean;
    private scrimPointerEvents: boolean;
    public editors: { [key: string]: Protyle } = {};
    public data: IObject = {};
    private titleVueApp: App | null = null;
    private isFullscreen: boolean = false;
    private originalSize: { width: string; height: string; left: string; top: string } | null = null;

    constructor(options: IDialogOptions) {
        this.disableClose = options.disableClose ?? false;
        this.disableScrimClose = options.disableScrimClose ?? false;
        this.disableEscapeClose = options.disableEscapeClose ?? false;
        this.scrimPointerEvents = options.scrimPointerEvents ?? false;
        this.id = genUUID();
        pushSiyuanDialog(this);
        this.destroyCallback = options.destroyCallback ?? (() => { });
        this.data = options.data || {};
        this.element = document.createElement("div");

        this.初始化对话框内容(options);
        this.绑定事件处理();
        this.添加到DOM(options.disableAnimation);
        this.titleVueApp = 挂载标题Vue组件(this.element, options);

        /// #if !MOBILE
        const containerElement = this.element.querySelector(".b3-dialog__container");
        if (isHTMLElement(containerElement)) {
            moveResize(containerElement, options.resizeCallback);
        }
        /// #endif
    }

    /** 初始化对话框内容 */
    private 初始化对话框内容(options: IDialogOptions): void {
        const closeButtonPosition = options.closeButtonPosition || "outside";
        const hasTitle = !!(options.title || options.titleVueConfig);

        const 位置信息 = 计算对话框位置(options);
        if (位置信息.width) options.width = 位置信息.width;
        if (位置信息.height) options.height = 位置信息.height;

        const closeButtonHtml = 生成关闭按钮HTML({
            disableClose: this.disableClose,
            hideCloseIcon: options.hideCloseIcon ?? false,
            closeButtonPosition,
            hasTitle
        });
        const fullscreenButtonHtml = 生成全屏按钮HTML(hasTitle, closeButtonPosition);
        const headerPaddingRight = 计算标题栏样式(hasTitle, closeButtonPosition);

        this.element.innerHTML = 生成对话框HTML({
            zIndex: incrementSiyuanZIndex(),
            left: 位置信息.left,
            top: 位置信息.top,
            scrimPointerEvents: this.scrimPointerEvents,
            transparent: options.transparent,
            containerClassName: options.containerClassName,
            width: options.width,
            height: options.height,
            closeButtonPosition,
            closeButtonHtml,
            fullscreenButtonHtml,
            headerPaddingRight,
            hasTitle,
            title: options.title,
            content: options.content
        });
    }

    /** 绑定对话框事件处理 */
    private 绑定事件处理(): void {
        绑定对话框事件(this, this.element, this.disableClose, this.disableScrimClose, () => this.isFullscreen);
    }

    /** 将对话框添加到DOM并处理动画 */
    private 添加到DOM(disableAnimation?: boolean): void {
        document.body.append(this.element);
        if (disableAnimation) {
            this.element.classList.add("b3-dialog--open");
            return;
        }
        setTimeout(() => this.element.classList.add("b3-dialog--open"), Constants.TIMEOUT_OPENDIALOG);
    }

    /** 执行销毁后的清理工作 */
    private 执行销毁清理(options?: IObject): void {
        const dialogElement = this.element.querySelector(".b3-dialog");
        if (!isHTMLElement(dialogElement)) {
            return;
        }
        const menuElement = getSiyuanGlobalMenus().menu.element;
        if (dialogElement.style.zIndex < menuElement.style.zIndex) {
            getSiyuanGlobalMenus().menu.remove();
        }

        if (this.titleVueApp) {
            this.titleVueApp.unmount();
            this.titleVueApp = null;
        }

        this.element.remove();
        if (this.destroyCallback) {
            this.destroyCallback(options);
        }
        const dialogs = getSiyuanDialogs();
        const index = dialogs.findIndex((item) => item.id === this.id);
        if (index !== -1) {
            dialogs.splice(index, 1);
        }
        const dragElement = document.getElementById("drag");
        dragElement?.classList.remove("fn__hidden");
    }

    public destroy(options?: IObject) {
        this.element.classList.remove("b3-dialog--open");
        setTimeout(() => this.执行销毁清理(options), Constants.TIMEOUT_DBLCLICK);
    }

    public fullscreen(): void {
        const container = this.element.querySelector(".b3-dialog__container");
        if (!isHTMLElement(container)) return;

        // 退出全屏模式
        if (this.isFullscreen) {
            this.退出全屏模式(container);
            return;
        }

        // 进入全屏模式
        this.进入全屏模式(container);
    }

    /** 退出全屏模式 */
    private 退出全屏模式(container: HTMLElement): void {
        if (this.originalSize) {
            Object.assign(container.style, {
                width: this.originalSize.width,
                height: this.originalSize.height,
                left: this.originalSize.left,
                top: this.originalSize.top
            });
        }

        container.style.maxWidth = "";
        container.style.maxHeight = "";
        container.style.borderRadius = "";

        this.element.classList.remove("b3-dialog--fullscreen");
        设置ResizeHandles显示状态(container, true);
        更新全屏按钮状态(this.element, false);
        this.isFullscreen = false;
        this.originalSize = null;
    }

    /** 进入全屏模式 */
    private 进入全屏模式(container: HTMLElement): void {
        this.originalSize = {
            width: container.style.width,
            height: container.style.height,
            left: container.style.left,
            top: container.style.top
        };

        Object.assign(container.style, {
            width: "100vw",
            height: "100vh",
            left: "0",
            top: "0",
            maxWidth: "100vw",
            maxHeight: "100vh",
            borderRadius: "0"
        });

        this.element.classList.add("b3-dialog--fullscreen");
        设置ResizeHandles显示状态(container, false);
        更新全屏按钮状态(this.element, true);
        this.isFullscreen = true;
    }

    public bindInput(inputElement: HTMLInputElement | HTMLTextAreaElement, enterEvent?: () => void, bindEnter = true) {
        inputElement.focus();
        let timeStamp: number;

        const 处理器 = 创建输入框键盘事件处理器({
            dialog: this,
            enterEvent,
            bindEnter,
            getTimeStamp: () => timeStamp,
            setTimeStamp: (value: number) => { timeStamp = value; },
            isFullscreen: () => this.isFullscreen,
            disableEscapeClose: () => this.disableEscapeClose
        });

        inputElement.addEventListener("keydown", 处理器);
    }
}
