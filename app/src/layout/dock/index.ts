import { updateHotkeyTip } from "../../protyle/util/compatibility";
import { Layout } from "../index";
import { Wnd } from "../Wnd";
import { getAllModels } from "../getAll";
import { Model } from "../Model";
import { adjustLayout, saveLayout } from "../util";
import { setPanelFocus } from "../utils/setPanelFocus";
import { getDockByType, resizeTabs } from "../tabUtil";
import { Protyle } from "../../protyle";
import { resetFloatDockSize } from "./util";
// hasClosestByClassName 已移至 dock.dnd.ts
import { App } from "../../index";
import { Custom } from "./Custom";
// Graph 已移至 dock.toggle.ts 和 dock.factory.ts
import { recordBeforeResizeTop } from "../../protyle/util/resize";
// clearBeforeResizeTop 已移至 dock.toggle.ts
import { Constants } from "../../constants";
import { createDockTab } from "./dock.factory";
import { initDockResize } from "./dock.resize";
import { initDockDnD } from "./dock.dnd";
import { initDockLayout } from "./dock.layout";
import {
    handlePanelFocusSwitch,
    handleGraphDestroy,
    handlePostCloseFocus,
    handleTabSwitch,
    updateDockPanelRelation,
    updatePanelVisibility,
    handleGraphShow,
    handleDockHideSize,
    setDockLayoutSize,
    handleGraphFullscreenDrag,
    blurActiveElement
} from "./dock.toggle";
import {
    generateAllButtonsHTML,
    insertButtonsToContainer
} from "./dock.button";

const TYPES = ["file", "outline", "inbox", "bookmark", "tag", "graph", "globalGraph", "backlink"];
/**
 * @AITODO
 * 拆分重构这个文件,直到清理所有lint错误和类型问题,注意文件备份
 * 拆分实现不应该使类
 * 应该在拆分过程中执行类型检查,保证拆分出的文件本身没有lint错误
 * 对于已经拆分的部分,应该核对其功能是否正确实现,再尝试应用
 */
export class Dock {
    public element!: HTMLElement;
    public layout!: Layout;
    public position: TDockPosition;
    private app: App;
    public resizeElement!: HTMLElement;
    public pin = true;
    public data: { [key in TDock | string]?: Model | boolean } = {};
    private hideResizeTimeout = 0;

    constructor(options: {
        app: App,
        data: {
            pin: boolean,
            data: Config.IUILayoutDockTab[][]
        },
        position: TDockPosition
    }) {
        this.app = options.app;
        this.position = options.position;
        this.pin = options.data.pin;
        this.data = {};
        this.initLayout(options.position);

        this.element = document.getElementById("dock" + options.position);
        const dockClass = options.position === "Bottom" ? ' class="fn__flex dock__items"' : ' class="dock__items"';
        this.element.innerHTML = `<div${dockClass}></div><div class="fn__flex-1 dock__item--space"></div><div${dockClass}></div>`;

        this.initDockData(options.data.data);
        this.initEvents();

        initDockResize(this);
        initDockDnD(this);

        if (window.siyuan.config.uiLayout.hideDock) {
            this.element.classList.add("fn__none");
        }
        if (!this.pin) {
            setTimeout(() => {
                this.resetDockPosition(false);
                this.hideDock(true);
                this.layout.element.classList.add("layout--float");
                this.resizeElement.classList.add("fn__none");
            });   // 需等待所有 Dock 初始化完成后才有稳定布局，才可进行定位
        }
    }

    private initLayout(position: TDockPosition) {
        initDockLayout(this, position);
    }

    private initDockData(data: Config.IUILayoutDockTab[][]) {
        let showDock = false;
        const hasType = (item: Config.IUILayoutDockTab) => TYPES.includes(item.type);
        if (data[0]?.find(hasType)) {
            showDock = true;
        } else if (data[1]?.find(hasType)) {
            showDock = true;
        }

        if (showDock) {
            if (data[0]) this.genButton(data[0], 0);
            if (data[1]) this.genButton(data[1], 1);
            this.element.classList.remove("fn__none");
        } else {
            this.renderPin();
            this.element.classList.add("fn__none");
        }

        this.initDockFiles();
        this.initDockActive();
    }

    private renderPin() {
        if (!window.siyuan.languages) return;
        const unpin = window.siyuan.languages.unpin;
        const pin = window.siyuan.languages.pin;
        this.element.firstElementChild.innerHTML = `<span class="dock__item dock__item--pin ariaLabel" aria-label="${this.pin ? unpin : pin}">
    <svg><use xlink:href="#icon${this.pin ? "Unpin" : "Pin"}"></use></svg>
</span>`;
    }

    private initDockFiles() {
        const dockItems = this.element.querySelectorAll(".dock__item");
        for (const item of Array.from(dockItems)) {
            if (item.getAttribute("data-type") === "file" && !item.classList.contains("dock__item--active")) {
                this.toggleModel("file", true, false, false, false);
                this.toggleModel("file", false, false, false, false);
            }
        }
    }

    private initDockActive() {
        const activeElements = Array.from(this.element.querySelectorAll(".dock__item--active"));
        if (activeElements.length === 0) {
            this.resizeElement.classList.add("fn__none");
            // 如果没有打开的侧栏，隐藏 layout 的子元素
            const children = this.layout.children;
            if (children && children.length > 1) {
                for (const child of children) {
                    child.element.classList.add("fn__none");
                }
                const firstChild = children[0];
                if (firstChild && firstChild.element.nextElementSibling) {
                    firstChild.element.nextElementSibling.classList.add("fn__none");
                }
            }
        } else {
            for (const item of activeElements) {
                const type = item.getAttribute("data-type");
                if (type) {
                    this.toggleModel(type as TDock, true, false, false, false);
                }
            }
        }
    }

    private initEvents() {
        this.element.addEventListener("click", this.onClick.bind(this));

        this.layout.element.addEventListener("mouseleave", this.onMouseLeave.bind(this));
    }


    private onMouseLeave(event: MouseEvent) {
        const toElement = event.relatedTarget as HTMLElement;
        if (event.buttons !== 0 || this.pin || (toElement && (toElement.classList.contains("b3-menu") ||
            toElement.classList.contains("tooltip")))) {
            return;
        }
        if (this.position === "Left" && event.clientX < 43) {
            return;
        }
        if (this.position === "Right" && event.clientX > window.innerWidth - 43) {
            return;
        }
        if (this.position === "Bottom" && event.clientY > window.innerHeight - 73) {
            return;
        }
        this.hideDock();
    }

    private onClick(event: MouseEvent) {
        let target = event.target as HTMLElement;
        while (target && !target.isEqualNode(this.element)) {
            const type = target.getAttribute("data-type");
            if (type) {
                this.toggleModel(type as TDock, false, true);
                event.preventDefault();
                break;
            }
            if (target.classList.contains("dock__item")) {
                this.togglePin();
                const unpin = window.siyuan.languages?.unpin;
                const pin = window.siyuan.languages?.pin;
                if (unpin && pin) {
                    target.setAttribute("aria-label", this.pin ? unpin : pin);
                }
                const use = target.querySelector("use");
                if (use) {
                    use.setAttribute("xlink:href", this.pin ? "#iconUnpin" : "#iconPin");
                }
                event.preventDefault();
                break;
            }
            target = target.parentElement as HTMLElement;
        }
    }

    public togglePin() {
        this.pin = !this.pin;
        const hasActive = this.element.querySelector(".dock__item--active");
        if (!this.pin) {
            this.resetDockPosition(hasActive ? true : false);
            this.resizeElement.classList.add("fn__none");
            if (hasActive) {
                this.showDock(true);
            } else {
                this.hideDock(true);
            }
        } else {
            this.layout.element.style.opacity = "";
            this.layout.element.style.transform = "";
            this.layout.element.style.zIndex = "";
            if (hasActive) {
                this.resizeElement.classList.remove("fn__none");
            }
        }
        this.layout.element.classList.toggle("layout--float");
        resizeTabs();
    }

    public resetDockPosition(show: boolean) {
        if (this.position === "Left") {
            this.layout.element.setAttribute("style", `width:${this.layout.element.clientWidth}px;opacity:${show ? 1 : 0};`);
        } else if (this.position === "Right") {
            this.layout.element.setAttribute("style", `width:${this.layout.element.clientWidth}px;opacity:${show ? 1 : 0};`);
        } else {
            this.layout.element.setAttribute("style", `height:${this.layout.element.clientHeight}px;opacity:${show ? 1 : 0};`);
        }
    }

    public showDock(reset = false) {
        if (!reset && (this.pin || !this.element.querySelector(".dock__item--active") || this.layout.element.style.opacity === "1")) {
            return;
        }
        if (!reset && (this.position === "Left" || this.position === "Right") &&
            this.layout.element.clientWidth === 0 && this.layout.element.style.width.startsWith("0")) {
            return;
        }
        if (!reset && this.position === "Bottom" &&
            this.layout.element.clientHeight === 0 && this.layout.element.style.height.startsWith("0")) {
            return;
        }
        if ((
            document.querySelector(".b3-dialog") ||
            document.querySelector(".block__popover") ||
            document.querySelector("#commonMenu:not(.fn__none)")
        ) && (
                window.siyuan.layout.leftDock?.layout.element.style.opacity === "1" ||
                window.siyuan.layout.rightDock?.layout.element.style.opacity === "1" ||
                window.siyuan.layout.bottomDock?.layout.element.style.opacity === "1"
            )) {
            return;
        }

        if (!reset) {
            this.layout.element.style.opacity = "1";
        }
        this.layout.element.style.transform = "";
        this.layout.element.style.zIndex = (++window.siyuan.zIndex).toString();
        if (this.position === "Left") {
            this.layout.element.style.left = `${this.element.clientWidth}px`;
        } else if (this.position === "Right") {
            this.layout.element.style.right = `${this.element.clientWidth}px`;
        } else if (this.position === "Bottom") {
            this.layout.element.style.bottom = `${this.element.offsetHeight + document.getElementById("status").offsetHeight}px`;
        }
    }

    public hideDock(reset = false) {
        if (!reset && (this.layout.element.style.opacity === "0" || this.pin)) {
            return;
        }
        // 关系图全屏不应该退出 & https://github.com/siyuan-note/siyuan/issues/11775
        const fullscreenElement = this.layout.element.querySelector(".fullscreen");
        if (fullscreenElement && fullscreenElement.clientHeight > 0) {
            return;
        }
        // https://github.com/siyuan-note/siyuan/issues/7504
        if (document.activeElement && this.layout.element.contains(document.activeElement) && document.activeElement.classList.contains("b3-text-field")) {
            return;
        }
        const dialogElement = document.querySelector(".b3-dialog") as HTMLElement;
        const blockElement = document.querySelector(".block__popover") as HTMLElement;
        const menuElement = document.querySelector("#commonMenu:not(.fn__none)") as HTMLElement;
        if ((dialogElement && dialogElement.style.zIndex > this.layout.element.style.zIndex) ||  // 文档树上修改 emoji 时
            (blockElement && blockElement.style.zIndex > this.layout.element.style.zIndex) ||  // 文档树上弹出悬浮层
            (menuElement && menuElement.style.zIndex > this.layout.element.style.zIndex)  // 面板上弹出菜单时
        ) {
            return;
        }
        if (this.position === "Left") {
            this.layout.element.style.transform = `translateX(-${this.layout.element.clientWidth + 8}px)`;
            this.layout.element.style.left = "";
        } else if (this.position === "Right") {
            this.layout.element.style.transform = `translateX(${this.layout.element.clientWidth + 8}px)`;
            this.layout.element.style.right = "";
        } else if (this.position === "Bottom") {
            this.layout.element.style.transform = `translateY(${this.layout.element.clientHeight + 8}px)`;
            this.layout.element.style.bottom = "";
        }
        if (reset) {
            return;
        }
        this.layout.element.style.opacity = "0";
        this.element.querySelector(".dock__item--activefocus")?.classList.remove("dock__item--activefocus");
        this.layout.element.querySelector(".layout__tab--active")?.classList.remove("layout__tab--active");
    }

    public toggleModel(type: TDock | string, show = false, close = false, hide = false, isSaveLayout = true) {
        if (!type) {
            return;
        }
        if (this.pin) {
            recordBeforeResizeTop();
        }
        const target = this.element.querySelector(`[data-type="${type}"]`) as HTMLElement;
        if (show && target.classList.contains("dock__item--active")) {
            target.classList.remove("dock__item--active", "dock__item--activefocus");
        }
        const index = parseInt(target.getAttribute("data-index") || "0", 10);
        const wnd = this.layout.children[index] as Wnd;
        if (target.classList.contains("dock__item--active") || hide) {
            if (!close && handlePanelFocusSwitch(wnd, target, this)) {
                return;
            }

            target.classList.remove("dock__item--active", "dock__item--activefocus");
            // dock 隐藏
            const hasNoActiveItems = this.element.querySelectorAll(".dock__item--active").length === 0;
            if (handleDockHideSize(this, hasNoActiveItems)) {
                clearTimeout(this.hideResizeTimeout);
                this.hideDock();
            }
            handleGraphDestroy(type, this);
            // 关闭 dock 后设置光标
            handlePostCloseFocus(isSaveLayout);
        } else {
            this.element.querySelectorAll(`.dock__item--active[data-index="${index}"]`).forEach(item => {
                item.classList.remove("dock__item--active", "dock__item--activefocus");
            });
            target.classList.add("dock__item--active", "dock__item--activefocus");
            if (!target.getAttribute("data-id")) {
                let editor: Protyle;
                const models = getAllModels();
                models.editor.find((item) => {
                    if (item.parent.headElement.classList.contains("item--focus") && item.editor?.protyle?.path) {
                        editor = item.editor;
                        return true;
                    }
                });
                const tab = createDockTab({
                    app: this.app,
                    type,
                    editor
                });
                wnd.addTab(tab, false, false);
                target.setAttribute("data-id", tab.id);
                this.data[type] = tab.model;
                setPanelFocus(tab.panelElement);
            } else {
                // tab 切换
                handleTabSwitch(wnd, target.getAttribute("data-id"));
            }
            // dock 显示
            setDockLayoutSize(this, this.getMaxSize());
            handleGraphFullscreenDrag(type, this, true);
            if (this.pin) {
                this.layout.element.style.opacity = "";
                this.hideResizeTimeout = window.setTimeout(() => {
                    this.resizeElement.classList.remove("fn__none");
                    adjustLayout();
                }, Constants.TIMEOUT_TRANSITION);
            }
            blurActiveElement();
        }

        // dock 中两个面板的显示关系
        const anotherIndex = index === 0 ? 1 : 0;
        const anotherWnd = this.layout.children[anotherIndex] as Wnd;
        const anotherHasActive = this.element.querySelectorAll(`.dock__item--active[data-index="${anotherIndex}"]`).length > 0;
        const hasActive = this.element.querySelectorAll(`.dock__item--active[data-index="${index}"]`).length > 0;

        updateDockPanelRelation(this, wnd, anotherWnd, index, anotherIndex, hasActive, anotherHasActive);
        updatePanelVisibility(wnd, anotherWnd, hasActive, anotherHasActive);

        resizeTabs(isSaveLayout);
        this.showDock();

        if (target.classList.contains("dock__item--active") && !hide) {
            handleGraphShow(type, this);
        }
    }

    public add(index: number, sourceElement: Element, previousType?: string) {
        sourceElement.setAttribute("data-height", "");
        sourceElement.setAttribute("data-width", "");

        const typeAttr = sourceElement.getAttribute("data-type");
        if (!typeAttr || !TYPES.includes(typeAttr)) return;
        const type = typeAttr as TDock;

        const sourceDock = getDockByType(type);
        // ...

        const sourceIndex = parseInt(sourceElement.getAttribute("data-index") || "0", 10);
        if (sourceDock && sourceDock.layout && sourceDock.layout.children) {
            const sourceWnd = sourceDock.layout.children[sourceIndex];
            if (sourceWnd instanceof Wnd) {
                const sourceId = sourceElement.getAttribute("data-id");
                if (sourceId) {
                    sourceWnd.removeTab(sourceId, false, true, false);
                    sourceElement.removeAttribute("data-id");
                }
            }
        }

        const hasActive = sourceElement.classList.contains("dock__item--active");
        if (hasActive && sourceDock) {
            sourceDock.toggleModel(type, false, false, false, false);
        }
        if (sourceDock) {
            delete sourceDock.data[type];
        }

        // 目标处理
        sourceElement.setAttribute("data-index", index.toString());
        if (previousType) {
            const prev = this.element.querySelector(`[data-type="${previousType}"]`);
            if (prev) prev.after(sourceElement);
        } else {
            if (index === 0) {
                this.element.firstElementChild.insertAdjacentElement("afterbegin", sourceElement);
            } else {
                this.element.lastElementChild.insertAdjacentElement("afterbegin", sourceElement);
            }
        }
        this.element.classList.remove("fn__none");
        resetFloatDockSize();
        this.data[type] = true;
        if (hasActive) {
            this.toggleModel(type, true, false, false, false);
        }
        // 保存布局需等待动画完毕 https://github.com/siyuan-note/siyuan/issues/13507
        setTimeout(() => {
            saveLayout();
        }, Constants.TIMEOUT_TRANSITION);
    }

    public remove(key: TDock | string) {
        const type = key as TDock; // validation typically happens before call or within toggleModel
        this.toggleModel(type, false, true, true);
        const item = this.element.querySelector(`[data-type="${key}"]`);
        if (item) item.remove();

        const custom = this.data[key];
        if (custom instanceof Custom && custom.parent) {
            custom.parent.parent.removeTab(custom.parent.id);
        }
        delete this.data[key];
    }

    public setSize() {
        const activesElement = this.element.querySelectorAll(".dock__item--active");
        for (const item of Array.from(activesElement)) {
            const index = item.getAttribute("data-index");
            const type = item.getAttribute("data-type") as TDock; // Assuming known type

            if (this.position === "Left" || this.position === "Right") {
                if (index === "1" && activesElement.length > 1) {
                    const model = this.data[type];
                    if (model instanceof Model) {
                        const dockElement = model.parent.parent.element;
                        item.setAttribute("data-height", dockElement.style.height ? dockElement.clientHeight.toString() : "");
                    }
                }
                item.setAttribute("data-width", this.layout.element.clientWidth.toString());
            } else {
                if (index === "1" && activesElement.length > 1) {
                    const model = this.data[type];
                    if (model instanceof Model) {
                        const dockElement = model.parent.parent.element;
                        item.setAttribute("data-width", dockElement.style.width ? dockElement.clientWidth.toString() : "");
                    }
                }
                item.setAttribute("data-height", this.layout.element.clientHeight.toString());
            }
        }
    }

    private getMaxSize() {
        let max = 0;
        const activeItems = this.element.querySelectorAll(".dock__item--active");
        for (const item of Array.from(activeItems)) {
            let size = 0;
            const sizeAttr = (this.position === "Left" || this.position === "Right") ? "data-width" : "data-height";
            const attrVal = item.getAttribute(sizeAttr);
            if (attrVal) {
                size = parseInt(attrVal, 10);
            }

            if (!size) {
                const type = item.getAttribute("data-type");
                if (this.position === "Left" || this.position === "Right") {
                    size = (type && ["graph", "globalGraph", "backlink"].includes(type)) ? 320 : 232;
                } else {
                    size = 232;
                }
            }
            if (size > max) {
                max = size;
            }
        }
        return max;
    }

    public genButton(data: Config.IUILayoutDockTab[], index: number, tabIndex?: number) {
        let html = "";
        const languages = window.siyuan.languages;
        const dockTip = languages?.dockTip || "";
        const pinText = this.pin ? languages?.unpin : languages?.pin;

        for (const item of data) {
            if (typeof tabIndex === "undefined" && !TYPES.includes(item.type)) {
                continue;
            }
            const hotkey = item.hotkey ? updateHotkeyTip(item.hotkey) : "";
            const activeClass = item.show ? " dock__item--active" : "";
            html += `<span data-height="${item.size.height}" data-width="${item.size.width}" data-type="${item.type}" data-index="${index}" data-hotkey="${item.hotkey || ""}" data-hotkeyLangId="${item.hotkeyLangId || ""}" data-title="${item.title}" class="dock__item${activeClass} ariaLabel" aria-label="<span style='white-space:pre'>${item.title} ${hotkey}${dockTip}</span>">
    <svg><use xlink:href="#${item.icon}"></use></svg>
</span>`;
            this.data[item.type] = true;
        }

        if (index === 0) {
            if (typeof tabIndex === "number") {
                const target = this.element.firstElementChild.children[tabIndex];
                if (target) {
                    target.insertAdjacentHTML("beforebegin", html);
                } else {
                    this.element.firstElementChild.lastElementChild?.insertAdjacentHTML("beforebegin", html);
                }
            } else {
                this.element.firstElementChild.innerHTML = `${html}<span class="dock__item dock__item--pin ariaLabel" aria-label="${pinText}">
    <svg><use xlink:href="#icon${this.pin ? "Unpin" : "Pin"}"></use></svg>
</span>`;
            }
        } else {
            if (typeof tabIndex === "number") {
                const target = this.element.lastElementChild.children[tabIndex];
                if (target) {
                    target.insertAdjacentHTML("beforebegin", html);
                } else {
                    this.element.lastElementChild.insertAdjacentHTML("beforeend", html);
                }
            } else {
                this.element.lastElementChild.innerHTML = html;
            }
        }

        if (typeof tabIndex === "number") {
            const config = window.siyuan.config;
            // https://github.com/siyuan-note/siyuan/issues/8614
            if (config && !config.uiLayout.hideDock) {
                this.element.classList.remove("fn__none");
            }
            if (data[0] && data[0].show) {
                this.toggleModel(data[0].type, true, false, false, false);
            }
        }
    }
}
