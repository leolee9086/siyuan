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
export class Dialog {
    private destroyCallback: (options?: IObject) => void;
    public element: HTMLElement;
    private id: string;
    private disableClose: boolean;
    public editors: { [key: string]: Protyle };
    public data: any;
    private titleVueApp: App | null; // 存储标题Vue应用实例

    constructor(options: {
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
        containerClassName?: string
    }) {
        this.disableClose = options.disableClose;
        this.id = genUUID();
        window.siyuan.dialogs.push(this);
        this.destroyCallback = options.destroyCallback;
        this.element = document.createElement("div") as HTMLElement;
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
        
        this.element.innerHTML = `<div class="b3-dialog" style="z-index: ${++window.siyuan.zIndex};${typeof left === "string" ? "display:block" : ""}">
<div class="b3-dialog__scrim"${options.transparent ? 'style="background-color:transparent"' : ""}></div>
<div class="b3-dialog__container ${options.containerClassName || ""}" style="width:${options.width || "auto"};height:${options.height || "auto"};
left:${left || "auto"};top:${top || "auto"}">
  <svg ${(isMobile() && hasTitle) ? 'style="top:0;right:0;"' : ""} class="b3-dialog__close${(this.disableClose || options.hideCloseIcon) ? " fn__none" : ""}"><use xlink:href="#iconCloseRound"></use></svg>
  <div class="resize__move b3-dialog__header${hasTitle ? "" : " fn__none"}" onselectstart="return false;">${options.title || ""}</div>
  <div class="b3-dialog__body">${options.content}</div>
  <div class="resize__rd"></div><div class="resize__ld"></div><div class="resize__lt"></div><div class="resize__rt"></div><div class="resize__r"></div><div class="resize__d"></div><div class="resize__t"></div><div class="resize__l"></div>
</div></div>`;

        this.element.querySelector(".b3-dialog__scrim").addEventListener("click", (event) => {
            if (!this.disableClose) {
                this.destroy();
            }
            event.preventDefault();
            event.stopPropagation();
        });
        if (!this.disableClose) {
            this.element.querySelector(".b3-dialog__close").addEventListener("click", (event) => {
                this.destroy();
                event.preventDefault();
                event.stopPropagation();
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

    public bindInput(inputElement: HTMLInputElement | HTMLTextAreaElement, enterEvent?: () => void, bindEnter = true) {
        inputElement.focus();
        let timeStamp: number;
        inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.isComposing || event.repeat) {
                event.preventDefault();
                return;
            }
            if (event.key === "Escape") {
                this.destroy();
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
