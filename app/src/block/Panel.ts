import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { Protyle } from "../protyle";
import { genUUID } from "../util/genID";
import { hideElements } from "../protyle/ui/hideElements";

/// #if !MOBILE
import { moveResize } from "../dialog/moveResize";
/// #endif
import { App } from "../index";
import {
    getSiyuanBlockPanels,
    getSiyuanMenus,
    incrementSiyuanZIndex
} from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { 构建面板HTML, 设置面板位置 } from "./Panel.render";
import { 切换固定状态, 执行图标操作 } from "./Panel.actions";
import { 设置观察器, 绑定滚动事件 } from "./Panel.observer";
import { 初始化Protyle编辑器, EditorInitContext } from "./Panel.editor";

export class BlockPanel {
    public element: HTMLElement | undefined;
    public targetElement: HTMLElement | undefined;
    public refDefs: IRefDefs[];
    public id: string;
    private app: App;
    public x: number | undefined;
    public y: number | undefined;
    private isBacklink: boolean;
    public editors: Protyle[] = [];
    private observerResize: ResizeObserver | undefined;
    private observerLoad: IntersectionObserver | undefined;
    private originalRefBlockIDs: IObject | undefined;

    // x,y 和 targetElement 二选一必传
    constructor(options: {
        app: App,
        targetElement?: HTMLElement,
        refDefs: IRefDefs[]
        isBacklink: boolean,
        originalRefBlockIDs?: IObject,  // isBacklink 为 true 时有效
        x?: number,
        y?: number,
    }) {
        this.id = genUUID();
        this.targetElement = options.targetElement;
        this.refDefs = options.refDefs;
        this.app = options.app;
        this.x = options.x;
        this.y = options.y;
        this.isBacklink = options.isBacklink;
        this.originalRefBlockIDs = options.originalRefBlockIDs;

        this.element = document.createElement("div");
        this.element.classList.add("block__popover");
        this.初始化层级();
        document.body.insertAdjacentElement("beforeend", this.element);

        if (this.targetElement) {
            this.targetElement.style.cursor = "wait";
        }

        this.element.setAttribute("data-pin", "false");
        // 双击切换固定状态
        this.element.addEventListener("dblclick", (event) => this.处理双击事件(event));
        // 点击时更新层级并处理图标操作
        this.element.addEventListener("click", (event) => {
            // S-forge: 使用封装的全局状态访问函数替代直接访问 window.siyuan
            if (this.element && getSiyuanBlockPanels().length > 1) {
                this.element.style.zIndex = incrementSiyuanZIndex().toString();
            }
            this.处理图标点击(event, options);
        });
        /// #if !MOBILE
        if (this.element) {
            moveResize(this.element, () => {
                if (this.element) {
                    切换固定状态(this.element, true);
                }
            });
        }
        /// #endif
        this.render();
    }

    private 初始化层级(): void {
        if (!this.element) {
            return;
        }
        const parentElement = this.targetElement ? hasClosestByClassName(this.targetElement, "block__popover", true) : false;
        let level = 1;
        const firstRefDef = this.refDefs[0];
        if (!parentElement && firstRefDef) {
            this.element.setAttribute("data-oid", firstRefDef.refID);
        }
        const oid = parentElement ? parentElement.getAttribute("data-oid") : null;
        if (parentElement && oid) {
            this.element.setAttribute("data-oid", oid);
        }
        if (parentElement) {
            level = parseInt(parentElement.getAttribute("data-level") ?? "0") + 1;
        }
        // 移除同层级其他更高级的 block popover
        this.element.setAttribute("data-level", level.toString());
        this.清理同级浮窗(level);
    }

    private 清理同级浮窗(level: number): void {
        const blockPanels = getSiyuanBlockPanels();
        for (let i = 0; i < blockPanels.length; i++) {
            const item = blockPanels[i];
            if (!item || !item.element) {
                continue;
            }
            const itemLevel = parseInt(item.element.getAttribute("data-level") ?? "0");
            if (item.element.getAttribute("data-pin") === "false" &&
                item.targetElement && itemLevel >= level) {
                item.destroy();
                i--;
            }
        }
    }

    private 处理双击事件(event: MouseEvent): void {
        if (!this.element) {
            return;
        }
        const target = event.target as HTMLElement;
        const iconsElement = hasClosestByClassName(target, "block__icons");
        if (!iconsElement) {
            return;
        }
        const 当前固定 = this.element.getAttribute("data-pin") === "true";
        切换固定状态(this.element, !当前固定);
        event.preventDefault();
        event.stopPropagation();
    }

    private 处理图标点击(event: MouseEvent, options: { app: App }): void {
        if (!this.element) {
            return;
        }
        let target = event.target as HTMLElement;
        const panelElement = this.element;
        while (target && !target.isEqualNode(panelElement)) {
            const isIconOrLogo = target.classList.contains("block__icon") || target.classList.contains("block__logo");
            const parentElement = target.parentElement;
            if (!isIconOrLogo && parentElement) {
                target = parentElement;
                continue;
            }
            if (!isIconOrLogo) {
                break;
            }
            const type = target.getAttribute("data-type");
            执行图标操作({
                type,
                target,
                element: panelElement,
                refDefs: this.refDefs,
                app: options.app,
                onDestroy: () => this.destroy()
            });
            event.preventDefault();
            event.stopPropagation();
            break;
        }
    }

    private 获取编辑器上下文(): EditorInitContext {
        return {
            app: this.app,
            refDefs: this.refDefs,
            isBacklink: this.isBacklink,
            originalRefBlockIDs: this.originalRefBlockIDs,
            targetElement: this.targetElement,
            x: this.x,
            y: this.y,
            editors: this.editors,
        };
    }

    public destroy() {
        this.observerResize?.disconnect();
        this.observerLoad?.disconnect();
        const blockPanels = getSiyuanBlockPanels();
        const foundIndex = blockPanels.findIndex((item) => item.id === this.id);
        if (foundIndex !== -1) {
            blockPanels.splice(foundIndex, 1);
        }
        for (const item of this.editors) {
            hideElements(["util"], item.protyle);
            item.destroy();
        }
        this.editors = [];
        const level = parseInt(this.element?.dataset.level ?? "0");
        this.element?.remove();
        this.element = undefined;
        this.targetElement = undefined;
        // 移除弹出上使用右键菜单
        const menus = getSiyuanMenus();
        const menuLevel = parseInt(menus?.menu.element.dataset.from ?? "");
        if (menuLevel && menuLevel >= level && menus?.menu.element.dataset.from?.includes("popover")) {
            menus.menu.remove();
        }
    }

    private render() {
        if (!this.element || !document.body.contains(this.element)) {
            this.destroy();
            return;
        }
        const panelElement = this.element;
        panelElement.innerHTML = 构建面板HTML(this.refDefs);

        // 设置观察器
        const 上下文 = this.获取编辑器上下文();
        const observers = 设置观察器({
            element: panelElement,
            editors: this.editors,
            initProtyle: (el, cb) => 初始化Protyle编辑器(el, 上下文, cb),
        });
        this.observerResize = observers.observerResize;
        this.observerLoad = observers.observerLoad;

        // 初始化编辑器
        const editElements = panelElement.querySelectorAll(".block__edit");
        let index = 0;
        for (const item of editElements) {
            if (index >= 5) {
                this.observerLoad.observe(item);
                index++;
                continue;
            }
            const 首个编辑器回调 = index === 0 ? () => {
                设置面板位置({
                    element: panelElement,
                    targetElement: this.targetElement,
                    x: this.x,
                    y: this.y,
                });
            } : undefined;
            初始化Protyle编辑器(item as HTMLElement, 上下文, 首个编辑器回调);
            index++;
        }

        if (this.targetElement) {
            this.targetElement.style.cursor = "";
        }

        // 绑定滚动事件
        绑定滚动事件({
            element: panelElement,
            editors: this.editors,
        });
    }
}
