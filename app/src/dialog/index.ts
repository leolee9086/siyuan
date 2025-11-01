import {genUUID} from "../util/genID";
/// #if !MOBILE
import {moveResize} from "./moveResize";
/// #endif
import {isMobile} from "../util/functions";
import {isNotCtrl} from "../protyle/util/compatibility";
import {Protyle} from "../protyle";
import {Constants} from "../constants";
import {createVueComponentLoader, VueComponentMountConfig, VueComponentLoaderContext} from "../util/vue/mount";
import {App} from "vue";
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
    closeButtonPosition?: "outside" | "inside" | "inside-body" // 关闭按钮位置：外部(默认)、内部标题栏、内部内容区域
}

export class Dialog {
    private destroyCallback: (options?: IObject) => void;
    public element: HTMLElement;
    private id: string;
    private disableClose: boolean;
    private disableScrimClose: boolean; // 是否禁用点击遮罩关闭
    private disableEscapeClose: boolean; // 是否禁用 Escape 键关闭
    private scrimPointerEvents: boolean; // 是否允许遮罩层鼠标事件穿透
    public editors: { [key: string]: Protyle };
    public data: any;
    private titleVueApp: App | null; // 存储标题Vue应用实例
    private isFullscreen: boolean = false; // 是否处于全屏状态
    private originalSize: { width: string; height: string; left: string; top: string } | null = null; // 原始尺寸和位置

    constructor(options: IDialogOptions) {
        this.disableClose = options.disableClose;
        this.disableScrimClose = options.disableScrimClose || false; // 默认允许点击遮罩关闭
        this.disableEscapeClose = options.disableEscapeClose || false; // 默认允许 Escape 键关闭
        this.scrimPointerEvents = options.scrimPointerEvents || false; // 默认不穿透鼠标事件
        this.id = genUUID();
        window.siyuan.dialogs.push(this);
        this.destroyCallback = options.destroyCallback;
        this.element = document.createElement("div") as HTMLElement;
        
        // 处理关闭按钮位置配置
        const closeButtonPosition = options.closeButtonPosition || "outside";
        let left;
        let top;
        if (!isMobile() && options.positionId) {
            const dialogPosition = window.siyuan.storage[Constants.LOCAL_DIALOGPOSITION][options.positionId];
            if (dialogPosition) {
                if (dialogPosition.left + dialogPosition.width + 34 <= window.innerWidth &&
                    dialogPosition.top + dialogPosition.height <= window.innerHeight) {
                    left = dialogPosition.left + "px";
                    top = dialogPosition.top + "px";
                    options.width = dialogPosition.width + "px";
                    options.height = dialogPosition.height + "px";
                }
            }
        }
        // 判断是否有标题（字符串或Vue组件）
        const hasTitle = !!(options.title || options.titleVueConfig);
        
        // 根据关闭按钮位置生成不同的HTML结构
        let closeButtonHtml = "";
        if (!(this.disableClose || options.hideCloseIcon)) {
            if (closeButtonPosition === "outside") {
                // 外部关闭按钮（默认行为）
                closeButtonHtml = `<svg ${(isMobile() && hasTitle) ? 'style="top:0;right:0;"' : ""} class="b3-dialog__close"><use xlink:href="#iconCloseRound"></use></svg>`;
            } else if (closeButtonPosition === "inside" && hasTitle) {
                // 内部标题栏关闭按钮
                closeButtonHtml = `<svg class="b3-dialog__close b3-dialog__close--inside" style="position: absolute; top: 50%; right: 0px; transform: translateY(-50%);"><use xlink:href="#iconCloseRound"></use></svg>`;
            } else if (closeButtonPosition === "inside-body") {
                // 内部内容区域关闭按钮
                closeButtonHtml = `<svg class="b3-dialog__close b3-dialog__close--inside-body" style="position: absolute; top: 10px; right: 10px; z-index: 1;"><use xlink:href="#iconCloseRound"></use></svg>`;
            }
        }
        
        this.element.innerHTML = `<div class="b3-dialog" style="z-index: ${++window.siyuan.zIndex};${typeof left === "string" ? "display:block" : ""};${this.scrimPointerEvents ? ' pointer-events:none' : ""}">
<div class="b3-dialog__scrim"${options.transparent ? 'style="background-color:transparent"' : ""}></div>
<div class="b3-dialog__container ${options.containerClassName || ""}" style="width:${options.width || "auto"};height:${options.height || "auto"};
left:${left || "auto"};top:${top || "auto"};${this.scrimPointerEvents ? ' pointer-events:auto' : ""}">
  ${closeButtonPosition === "outside" ? closeButtonHtml : ""}
  <div class="resize__move b3-dialog__header${hasTitle ? "" : " fn__none"}" onselectstart="return false;" style="${hasTitle && closeButtonPosition === "inside" ? "position: relative; padding-right: 40px;" : ""}">${options.title || ""}${closeButtonPosition === "inside" ? closeButtonHtml : ""}</div>
  <div class="b3-dialog__body" style="${closeButtonPosition === "inside-body" ? "position: relative;" : ""}">${options.content}${closeButtonPosition === "inside-body" ? closeButtonHtml : ""}</div>
  <div class="resize__rd"></div><div class="resize__ld"></div><div class="resize__lt"></div><div class="resize__rt"></div><div class="resize__r"></div><div class="resize__d"></div><div class="resize__t"></div><div class="resize__l"></div>
</div></div>`;

        this.element.querySelector(".b3-dialog__scrim").addEventListener("click", (event) => {
            if (!this.disableClose && !this.disableScrimClose) {
                this.destroy();
            }
            event.preventDefault();
            event.stopPropagation();
        });
        if (!this.disableClose) {
            // 为所有关闭按钮添加点击事件监听器
            const closeButtons = this.element.querySelectorAll(".b3-dialog__close");
            closeButtons.forEach(button => {
                button.addEventListener("click", (event) => {
                    this.destroy();
                    event.preventDefault();
                    event.stopPropagation();
                });
            });
        }
        document.body.append(this.element);
        if (options.disableAnimation) {
            this.element.classList.add("b3-dialog--open");
        } else {
            setTimeout(() => {
                this.element.classList.add("b3-dialog--open");
            }, Constants.TIMEOUT_OPENDIALOG);
        }
        // 如果提供了标题Vue组件配置，则挂载Vue组件到标题区域
        if (options.titleVueConfig) {
            const titleElement = this.element.querySelector(".b3-dialog__header");
            if (titleElement) {
                // 清空标题内容，为Vue组件腾出空间
                titleElement.innerHTML = "";
                // 挂载Vue组件
                this.titleVueApp = createVueComponentLoader(
                    titleElement as HTMLElement,
                    options.titleVueConfig,
                    options.titleVueContext
                );
            }
        }

        /// #if !MOBILE
        moveResize(this.element.querySelector(".b3-dialog__container"), options.resizeCallback);
        /// #endif
    }

    public destroy(options?: IObject) {
        this.element.classList.remove("b3-dialog--open");
        setTimeout(() => {
            // av 修改列头emoji后点击关闭emoji图标
            if ((this.element.querySelector(".b3-dialog") as HTMLElement).style.zIndex < window.siyuan.menus.menu.element.style.zIndex) {
                // https://github.com/siyuan-note/siyuan/issues/6783
                window.siyuan.menus.menu.remove();
            }
           
            // 销毁标题Vue应用实例
            if (this.titleVueApp) {
                this.titleVueApp.unmount();
                this.titleVueApp = null;
            }
           
            this.element.remove();
            if (this.destroyCallback) {
                this.destroyCallback(options);
            }
            window.siyuan.dialogs.find((item, index) => {
                if (item.id === this.id) {
                    window.siyuan.dialogs.splice(index, 1);
                    return true;
                }
            });
            // https://github.com/siyuan-note/siyuan/issues/10475
            document.getElementById("drag")?.classList.remove("fn__hidden");
        }, Constants.TIMEOUT_DBLCLICK);
    }

    public fullscreen(): void {
        const container = this.element.querySelector(".b3-dialog__container") as HTMLElement;
        if (!container) return;

        if (!this.isFullscreen) {
            // 进入全屏模式
            // 保存当前尺寸和位置
            this.originalSize = {
                width: container.style.width,
                height: container.style.height,
                left: container.style.left,
                top: container.style.top
            };

            // 设置全屏样式
            container.style.width = "100vw";
            container.style.height = "100vh";
            container.style.left = "0";
            container.style.top = "0";
            container.style.maxWidth = "100vw";
            container.style.maxHeight = "100vh";
            container.style.borderRadius = "0";
            
            // 添加全屏类
            this.element.classList.add("b3-dialog--fullscreen");
            
            // 隐藏调整大小的手柄
            const resizeHandles = container.querySelectorAll("[class^='resize__']");
            resizeHandles.forEach(handle => {
                (handle as HTMLElement).style.display = "none";
            });
            
            this.isFullscreen = true;
        } else {
            // 退出全屏模式
            if (this.originalSize) {
                container.style.width = this.originalSize.width;
                container.style.height = this.originalSize.height;
                container.style.left = this.originalSize.left;
                container.style.top = this.originalSize.top;
            }
            
            // 移除全屏样式
            container.style.maxWidth = "";
            container.style.maxHeight = "";
            container.style.borderRadius = "";
            
            // 移除全屏类
            this.element.classList.remove("b3-dialog--fullscreen");
            
            // 显示调整大小的手柄
            const resizeHandles = container.querySelectorAll("[class^='resize__']");
            resizeHandles.forEach(handle => {
                (handle as HTMLElement).style.display = "";
            });
            
            this.isFullscreen = false;
            this.originalSize = null;
        }
    }

    public bindInput(inputElement: HTMLInputElement | HTMLTextAreaElement, enterEvent?: () => void, bindEnter = true) {
        inputElement.focus();
        let timeStamp: number;
        inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.isComposing || event.repeat) {
                event.preventDefault();
                return;
            }
            if (event.key === "Escape") {
                if (this.isFullscreen) {
                    // 全屏模式下，ESC 键退出全屏
                    this.fullscreen();
                } else if (!this.disableEscapeClose) {
                    // 非全屏模式下，ESC 键关闭对话框
                    this.destroy();
                }
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            if (!event.shiftKey && isNotCtrl(event) && event.key === "Enter" && enterEvent && bindEnter) {
                if (timeStamp && event.timeStamp - timeStamp < 124) {
                    return;
                }
                timeStamp = event.timeStamp;
                enterEvent();
                event.preventDefault();
                event.stopPropagation();
            }
        });
    }
}
