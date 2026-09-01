/**
 * @AIDONE 已完成拆分重构
 * 所有 private 方法已提取到辅助文件中
 */
import { setStorageVal } from "../../protyle/util/compatibility";
import type {LayoutDomain} from "../layout.types";
import type {ILayoutModel} from "./imports";
import {saveLayout} from "../persistence/saveLayout";
import {resizeTabs} from "../resize/resizeTabs";
import {setTabPosition} from "../../window/setHeader";
import {getDockByType} from "../query/dockByType";
import { adjustDockPadding, resetFloatDockSize } from "./util";
import type { AppFacade } from "../../app/AppFacade.types";
import {Custom} from "./custom/Custom";
import { recordBeforeResizeTop } from "../../protyle/util/resize";
import { Constants } from "../../constants";
import { initDockResize } from "./dock.resize";
import { initDockDnD } from "./dock.dnd";
import {initDockLayout} from "./layout/dockLayout";
import {handleGraphShow} from "./graph/runtime";
import { generateAllButtonsHTML, insertButtonsToContainer } from "./dock.button";
import { getSiyuanLanguages, getSiyuanConfig, setWindowTimeout } from "./dock.environment";
import { isWnd, isTDock } from "./dock.guard";
import { removeSourceTab, initDockFloatMode, initDockData } from "./dock.init";
import { setSizeForItem } from "./dock.size";
import { handleMouseLeave } from "./dock.events";
import { executeToggleHide, executeToggleShow, executeUpdatePanelRelations } from "./dock.model";
import {BUILTIN_DOCK_TYPES} from "./dock.builtin";
/** 用途：插件 Dock 显示状态与位置顺序的批量持久化；使用范围：对齐上游 v3.8.0 的面板状态写回。 */
import type {IPluginDockPlacementState} from "./pluginDockState";
import {updatePluginDockPlacements, updatePluginDockShowStates} from "./pluginDockState";

const TYPES = [...BUILTIN_DOCK_TYPES];
/**
 * @AIDONE 已修复：界面初始化时Tag类型的dock有时消失的bug
 * 原因：各 Dock 实例初始化顺序不确定，使用 DOM 查询去重不可靠
 * 解决：在 dock.init.ts 中使用全局注册表 (dock.registry.ts) 替代 DOM 查询进行跨 Dock 去重
 */
export class Dock {
    public elements: HTMLElement[];
    public layout!: LayoutDomain;
    public position: TDockPosition;
    public app: AppFacade;
    public resizeElement!: HTMLElement;
    public pin = true;
    public data: { [key in TDock | string]?: ILayoutModel | boolean } = {};
    public hideResizeTimeout = 0;
    /** 悬停延时显示的定时器（上游 v3.8.0） */
    private showDockTimeout = 0;
    /** 悬停延时隐藏的定时器（上游 v3.8.0） */
    private hideDockTimeout = 0;

    constructor(options: { app: AppFacade, data: { pin: boolean, data: Config.IUILayoutDockTab[][] }, position: TDockPosition }) {
        this.app = options.app;
        this.position = options.position;
        this.pin = options.data.pin;
        this.data = {};
        initDockLayout(this, options.position);
        if (options.position === "Bottom") {
            this.elements = [document.getElementById("dockLeft").lastElementChild as HTMLElement, document.getElementById("dockRight").lastElementChild as HTMLElement];
        } else {
            const dockElement = document.getElementById("dock" + options.position);
            if (!dockElement) {
                throw new Error(`Dock element not found: dock${options.position}`);
            }
            this.elements = Array.from(dockElement.querySelectorAll(".dock__items"));
        }
        initDockData(this, options.data.data, TYPES);
        this.layout.element.addEventListener("mouseenter", () => {
            this.showDockByHover();
        });
        this.layout.element.addEventListener("mouseleave", (e) => handleMouseLeave(this, e));
        initDockResize(this);
        initDockDnD(this);
        const config = getSiyuanConfig();
        if (config?.uiLayout?.hideDock) {
            this.elements[0].parentElement.classList.add("fn__none");
        }
        if (!this.pin) {
            setWindowTimeout(() => initDockFloatMode(this));
        }
    }

    /**
     * 切换 Dock 的钉住状态
     * 
     * 作用：切换 Dock 是否固定显示
     * 意图：允许用户在自动隐藏和固定显示之间切换
     * 调用时机：点击 Pin/Unpin 按钮时
     */
    public togglePin(): void {
        this.clearDockHoverTimeout();
        this.pin = !this.pin;
        const hasActive = this.elements[0].querySelector(".dock__item--active") ||
            this.elements[1].querySelector(".dock__item--active");
        this.resetDockPosition(Boolean(hasActive));
        this.layout.element.style.opacity = "";
        if (!this.pin) {
            this.resizeElement.classList.add("fn__none");
            this.hideDock(true);
        } else {
            this.layout.element.style.transform = "";
            this.layout.element.style.zIndex = "";
            if (hasActive) {
                this.resizeElement.classList.remove("fn__none");
            }
        }
        this.layout.element.classList.toggle("layout--float");
        resizeTabs();
        setTabPosition(true);
    }

    /**
     * 重置 Dock 位置和尺寸
     * 
     * 作用：根据显示状态设置 Dock 的尺寸和透明度
     * 意图：在显示/隐藏或模式切换时恢复 Dock 的正确视觉状态
     * 调用时机：Dock 显示/隐藏动画或状态变更时
     */
    public resetDockPosition(show: boolean): void {
        if (this.position === "Left") {
            this.layout.element.setAttribute("style", `${show ? "margin-right: var(--b3-layout-space);" : ""}width:${this.layout.element.clientWidth}px;opacity:${show ? 1 : 0};min-height:8px;`);
        } else if (this.position === "Right") {
            this.layout.element.setAttribute("style", `${show ? "margin-left: var(--b3-layout-space);" : ""}width:${this.layout.element.clientWidth}px;opacity:${show ? 1 : 0};min-height:8px;`);
        } else {
            this.layout.element.setAttribute("style", `${show ? "margin-top: var(--b3-layout-space);" : ""}height:${this.layout.element.clientHeight}px;opacity:${show ? 1 : 0};`);
        }
    }

    /**
     * 显示 Dock
     *
     * 作用：显示 Dock 面板
     * 意图：使用户可以看见和交互 Dock
     * 调用时机：鼠标悬停、激活 Tab 或收到显示指令时
     */
    public showDockByHover() {
        window.clearTimeout(this.hideDockTimeout);
        this.hideDockTimeout = 0;
        if (this.showDockTimeout || this.pin || this.layout.element.style.opacity === "1") {
            return;
        }
        this.showDockTimeout = window.setTimeout(() => {
            this.showDockTimeout = 0;
            this.showDock();
        }, Constants.TIMEOUT_DOCK_TOGGLE);
    }

    public hideDockByHover() {
        window.clearTimeout(this.showDockTimeout);
        this.showDockTimeout = 0;
        if (this.hideDockTimeout || this.pin || this.layout.element.style.opacity === "0") {
            return;
        }
        this.hideDockTimeout = window.setTimeout(() => {
            this.hideDockTimeout = 0;
            this.hideDock();
        }, Constants.TIMEOUT_DOCK_TOGGLE);
    }

    /** 用途：取消挂起的悬停显示/隐藏定时器；交互打断悬停流程时调用。 */
    public clearDockHoverTimeout() {
        window.clearTimeout(this.showDockTimeout);
        window.clearTimeout(this.hideDockTimeout);
        this.showDockTimeout = 0;
        this.hideDockTimeout = 0;
    }

    /**
     * 显示 Dock
     *
     * 作用：显示 Dock 面板
     * 意图：使用户可以看见和交互 Dock
     * 调用时机：鼠标悬停、激活 Tab 或收到显示指令时
     */
    public showDock(reset = false): void {
        this.clearDockHoverTimeout();
        if (!reset && (this.pin || this.layout.element.style.opacity === "1") ||
            (!this.elements[0].querySelector(".dock__item--active") && !this.elements[1].querySelector(".dock__item--active"))
        ) {
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
            this.layout.element.style.left = `${this.elements[0].clientWidth}px`;
        } else if (this.position === "Right") {
            this.layout.element.style.right = `${this.elements[0].clientWidth}px`;
        } else if (this.position === "Bottom") {
            this.layout.element.style.bottom = `${document.getElementById("status").offsetHeight}px`;
            this.layout.element.style.left = this.elements[0].clientWidth + "px";
            this.layout.element.style.right = this.elements[1].clientWidth + "px";
        }
    }

    /**
     * 隐藏 Dock
     * 
     * 作用：隐藏 Dock 面板
     * 意图：在不使用时腾出屏幕空间
     * 调用时机：鼠标离开、失去焦点或显式隐藏时
     */
    public hideDock(reset = false): void {
        this.clearDockHoverTimeout();
        if (!reset && (this.layout.element.style.opacity === "0" || this.pin)) {
            return;
        }
        const fullscreenElement = this.layout.element.querySelector(".fullscreen");
        if (fullscreenElement && fullscreenElement.clientHeight > 0) {
            return;
        }
        if (document.activeElement && this.layout.element.contains(document.activeElement) &&
            (document.activeElement.classList.contains("b3-text-field") ||
                (document.activeElement as HTMLElement).getAttribute("contenteditable") === "true")) {
            return;
        }
        const dialogElement = document.querySelector(".b3-dialog") as HTMLElement;
        const blockElement = document.querySelector(".block__popover") as HTMLElement;
        const menuElement = document.querySelector("#commonMenu:not(.fn__none)") as HTMLElement;
        if (!reset && ((dialogElement && dialogElement.style.zIndex > this.layout.element.style.zIndex) ||
            (blockElement && blockElement.style.zIndex > this.layout.element.style.zIndex) ||
            (menuElement && menuElement.style.zIndex > this.layout.element.style.zIndex))
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
        this.elements[0].querySelector(".dock__item--activefocus")?.classList.remove("dock__item--activefocus");
        this.elements[1].querySelector(".dock__item--activefocus")?.classList.remove("dock__item--activefocus");
        this.layout.element.querySelector(".layout__tab--active")?.classList.remove("layout__tab--active");
    }

    /**
     * 切换 Model 的显示/隐藏状态
     * 
     * 作用：打开、关闭或切换 Dock 中的具体功能面板
     * 意图：核心交互逻辑，响应用户点击 Dock Icon
     * 调用时机：点击 Dock 图标或其他组件请求打开面板时
     */
    public toggleModel(type: TDock | string, show = false, close = false, removeDock = false, isSaveLayout = true): void {
        if (!type) {
            return;
        }
        if (this.pin) {
            recordBeforeResizeTop();
        }
        const target = document.querySelector(`.dock__item[data-type="${type}"]`);
        if (!(target instanceof HTMLElement)) {
            return;
        }
        if (show && target.classList.contains("dock__item--active")) {
            target.classList.remove("dock__item--active", "dock__item--activefocus");
        }
        const index = parseInt(target.getAttribute("data-index") || "0", 10);
        const wndChild = this.layout?.children?.[index];
        if (!isWnd(wndChild)) {
            return;
        }
        const isHideAction = target.classList.contains("dock__item--active") || removeDock;
        if (isHideAction && executeToggleHide(this, wndChild, target, type, close, isSaveLayout)) {
            return;
        }
        if (!isHideAction) {
            executeToggleShow(this, wndChild, target, type, index, isSaveLayout);
            this.showDock();
        }
        executeUpdatePanelRelations(this, wndChild, index);
        // 上游 v3.8.0：在分支处理结束后按列批量同步插件 Dock 的显示状态，替代逐项写回
        if (isSaveLayout) {
            this.saveLocalPluginShow(index);
        }
        resizeTabs(isSaveLayout);
        if (target.classList.contains("dock__item--active") && !removeDock) {
            handleGraphShow(type, this);
        }
        if (this.pin) {
            let rafId: number;
            const updateTabPos = () => {
                setTabPosition(true);
                rafId = requestAnimationFrame(updateTabPos);
            };
            rafId = requestAnimationFrame(updateTabPos);

            const onTransitionEnd = (event: TransitionEvent) => {
                if (event.propertyName !== "width") {
                    return;
                }
                cancelAnimationFrame(rafId);
                this.layout.element.removeEventListener("transitionend", onTransitionEnd);
                setTabPosition();
            };
            this.layout.element.addEventListener("transitionend", onTransitionEnd);
            setWindowTimeout(() => {
                cancelAnimationFrame(rafId);
                this.layout.element.removeEventListener("transitionend", onTransitionEnd);
                setTabPosition();
            }, Constants.TIMEOUT_TRANSITION);
        }
    }

    /**
     * 添加 Dock Item
     *
     * 作用：将其他位置拖拽来的 Tab 添加到当前 Dock
     * 意图：支持 Dock 间的拖拽重组
     * 调用时机：拖拽 Tab 到 Dock 区域释放时
     */
    public add(index: number, sourceElement: Element, previousType?: string): void {
        const typeAttr = sourceElement.getAttribute("data-type");
        if (!isTDock(typeAttr)) {
            return;
        }
        const sourceDock = getDockByType(typeAttr);
        // 仅在左右轴与下轴之间跨轴移动时清除尺寸：左右侧之间或下侧内部移动，原有尺寸维度仍然有效
        const size: Partial<Config.IUILayoutDockPanelSize> = {};
        if ((sourceDock.position === "Left" || sourceDock.position === "Right") && this.position === "Bottom") {
            sourceElement.setAttribute("data-width", "");
            size.width = null;
        }
        if (sourceDock.position === "Bottom" && (this.position === "Left" || this.position === "Right")) {
            sourceElement.setAttribute("data-height", "");
            size.height = null;
        }
        if (sourceDock.elements[0].parentElement.querySelectorAll(".dock__item").length === 1) {
            sourceDock.elements[0].parentElement.classList.add("fn__none");
        }
        const sourceIndex = parseInt(sourceElement.getAttribute("data-index") || "0", 10);
        removeSourceTab(sourceDock, sourceIndex, sourceElement);
        const hasActive = sourceElement.classList.contains("dock__item--active");
        if (hasActive && sourceDock) {
            sourceDock.toggleModel(typeAttr, false, false, false, false);
        }
        if (sourceDock) {
            delete sourceDock.data[typeAttr];
        }
        sourceElement.setAttribute("data-index", index.toString());
        sourceElement.setAttribute("data-position", this.getTooltipPosition(index));
        if (previousType) {
            this.elements[index].parentElement.querySelector(`[data-type="${previousType}"]`)?.after(sourceElement);
        } else {
            this.elements[index].insertAdjacentElement("afterbegin", sourceElement);
        }
        this.elements[0].parentElement.classList.remove("fn__none");
        resetFloatDockSize();
        this.data[typeAttr] = true;
        if (hasActive) {
            this.toggleModel(typeAttr, true, false, false, false);
        }
        setWindowTimeout(() => saveLayout(), Constants.TIMEOUT_TRANSITION);
        this.saveLocalPlugin(typeAttr, { index: this._getSortIndex(sourceElement), position: this._getPluginPosition(sourceElement, index), size });
        // 上游 v3.8.0：跨 Dock 拖拽后按 DOM 实际顺序整体刷新插件 Dock 的位置与序号
        const placements = sourceDock.getPluginDockPlacements();
        if (sourceDock !== this) {
            placements.push(...this.getPluginDockPlacements());
        }
        const movedPlacement = placements.find((item) => item.type === typeAttr);
        if (movedPlacement && Object.keys(size).length > 0) {
            movedPlacement.size = size;
        }
        if (updatePluginDockPlacements(
            placements,
            this.app.plugins,
            window.siyuan.storage[Constants.LOCAL_PLUGIN_DOCKS],
        )) {
            setStorageVal(Constants.LOCAL_PLUGIN_DOCKS, window.siyuan.storage[Constants.LOCAL_PLUGIN_DOCKS]);
        }
        adjustDockPadding();
        this.adjustSplit();
        sourceDock.adjustSplit();
    }

    private _getSortIndex(sourceElement: Element): number {
        let sortIndex = 0;
        let previousElement = sourceElement;
        while (previousElement.previousElementSibling) {
            sortIndex++;
            previousElement = previousElement.previousElementSibling;
        }
        return sortIndex;
    }

    private _getPluginPosition(sourceElement: Element, index: number): TPluginDockPosition | undefined {
        const leftDockElement = document.getElementById("dockLeft");
        const rightDockElement = document.getElementById("dockRight");
        if (leftDockElement && leftDockElement.contains(sourceElement)) {
            if (leftDockElement.lastElementChild && leftDockElement.lastElementChild.contains(sourceElement)) {
                return "BottomLeft";
            }
            return ("Left" + (index === 0 ? "Top" : "Bottom")) as TPluginDockPosition;
        }
        if (rightDockElement && rightDockElement.contains(sourceElement)) {
            if (rightDockElement.lastElementChild && rightDockElement.lastElementChild.contains(sourceElement)) {
                return "BottomRight";
            }
            return ("Right" + (index === 0 ? "Top" : "Bottom")) as TPluginDockPosition;
        }
    }

    /**
     * 移除 Dock Item
     * 
     * 作用：从当前 Dock 移除指定的 Item
     * 意图：清理不再需要的或被拖走到其他位置的 Item
     * 调用时机：Item 被关闭或拖出时
     */
    public remove(key: TDock | string): void {
        if (isTDock(key)) {
            this.toggleModel(key, false, true, true);
        }
        const item = this.elements[0].parentElement.querySelector(`[data-type="${key}"]`);
        if (item) {
            item.remove();
        }
        const custom = this.data[key];
        if (custom instanceof Custom && custom.parent) {
            custom.parent.parent.removeTab(custom.parent.id);
        }
        if (!this.elements[0].parentElement.querySelector(".dock__item[data-type]")) {
            this.elements[0].parentElement.classList.add("fn__none");
            adjustDockPadding();
        }
        delete this.data[key];
        this.adjustSplit();
    }

    /**
     * 设置尺寸
     * 
     * 作用：更新 Dock 中各激活 Item 的尺寸信息
     * 意图：确保布局调整后 Item 记录正确的尺寸
     * 调用时机：Dock 尺寸改变后
     */
    public setSize(): void {
        const activesElement = [...this.elements[0].querySelectorAll(".dock__item--active"),
            ...this.elements[1].querySelectorAll(".dock__item--active")];
        for (const item of activesElement) {
            setSizeForItem(this, item, activesElement.length);
            this.saveLocalPlugin(item.getAttribute("data-type"), {
                size: {
                    width: parseInt(item.getAttribute("data-width")) || null,
                    height: parseInt(item.getAttribute("data-height")) || null
                }
            });
        }
    }

    /**
     * 生成并插入按钮
     * 
     * 作用：根据数据生成 Dock 按钮并插入到 DOM
     * 意图：初始化 Dock 的视觉内容
     * 调用时机：Dock 初始化时
     */
    public genButton(data: Config.IUILayoutDockTab[], index: number, tabIndex?: number): void {
        for (const item of data) {
            if (item.type === "outline") {
                item.icon = "iconOutline";
            } else if (item.type === "tags") {
                item.icon = "iconTag";
            }
        }
        const languages = getSiyuanLanguages();
        const html = generateAllButtonsHTML(data, index, languages?.dockTip || "", tabIndex);
        for (const item of data) {
            this.data[item.type] = true;
        }
        insertButtonsToContainer(this.elements[index], html, tabIndex);
        if (typeof tabIndex !== "number") {
            this.adjustSplit();
            return;
        }
        const config = getSiyuanConfig();
        if (config && !config.uiLayout.hideDock) {
            this.elements[0].parentElement.classList.remove("fn__none");
            adjustDockPadding();
        }
        const firstItem = data[0];
        if (firstItem?.show) {
            this.toggleModel(firstItem.type, true, false, false, false);
        }
        this.adjustSplit();
    }

    /**
     * 添加自定义 Item
     * 
     * 作用：动态添加自定义列表等类型的 Item
     * 意图：支持插件或特定功能动态扩展 Dock
     * 调用时机：用户创建自定义列表或插件注册 Dock 时
     */
    public addCustomItem(item: Config.IUILayoutDockTab): void {
        if (this.data[item.type]) {
            return;
        }
        if (item.type === "outline") {
            item.icon = "iconOutline";
        } else if (item.type === "tags") {
            item.icon = "iconTag";
        }
        const languages = getSiyuanLanguages();
        const html = generateAllButtonsHTML([item], 1, languages?.dockTip || "");
        const container = this.elements[1];
        if (container) {
            insertButtonsToContainer(container, html, undefined, true);
        }
        this.data[item.type] = true;
        if (item.show) {
            this.toggleModel(item.type, true);
        }
        this.adjustSplit();
        saveLayout();
    }

    private getTooltipPosition(index: number) {
        if (this.position === "Left" || (this.position === "Bottom" && index === 0)) {
            return "8east";
        }
        return "8west";
    }

    private getPluginDockPlacements() {
        const states: IPluginDockPlacementState[] = [];
        [0, 1].forEach((index) => {
            const position: TPluginDockPosition = this.position === "Bottom"
                ? (index === 0 ? "BottomLeft" : "BottomRight")
                : this.position + (index === 0 ? "Top" : "Bottom") as TPluginDockPosition;
            let itemIndex = 0;
            this.elements[index].querySelectorAll(".dock__item").forEach((item) => {
                const type = item.getAttribute("data-type");
                if (!type) {
                    return;
                }
                states.push({
                    type,
                    position,
                    index: itemIndex,
                });
                itemIndex++;
            });
        });
        return states;
    }

    private adjustSplit(): void {
        if (this.position !== "Bottom") {
            if (this.elements[0].innerHTML && this.elements[1].innerHTML) {
                this.elements[0].nextElementSibling?.classList.remove("fn__none");
            } else {
                this.elements[0].nextElementSibling?.classList.add("fn__none");
            }
        }
    }

    public saveLocalPlugin(dockType: TDock | string, options: {
        position?: TPluginDockPosition,
        size?: Partial<Config.IUILayoutDockPanelSize>,
        index?: number,
        show?: boolean
    }): void {
        this.app.plugins.find(pluginItem => {
            if (Object.keys(pluginItem.docks).includes(dockType)) {
                if (!window.siyuan.storage[Constants.LOCAL_PLUGIN_DOCKS][pluginItem.name][dockType]) {
                    window.siyuan.storage[Constants.LOCAL_PLUGIN_DOCKS][pluginItem.name][dockType] = pluginItem.docks[dockType].config;
                }
                const dockConfig = window.siyuan.storage[Constants.LOCAL_PLUGIN_DOCKS][pluginItem.name][dockType];
                Object.keys(options).forEach((item: "position" | "size" | "index" | "show") => {
                    // size 需按字段合并，否则会整体覆盖、丢失用户已拖动的尺寸
                    if (item === "size") {
                        Object.assign(dockConfig.size, options.size);
                    } else {
                        dockConfig[item] = options[item];
                    }
                });
                setStorageVal(Constants.LOCAL_PLUGIN_DOCKS, window.siyuan.storage[Constants.LOCAL_PLUGIN_DOCKS]);
                return true;
            }
        });
    }

    private saveLocalPluginShow(index: number) {
        const states: {type: string, show: boolean}[] = [];
        this.elements[index].querySelectorAll(".dock__item").forEach((item) => {
            const type = item.getAttribute("data-type");
            if (type) {
                states.push({
                    type,
                    show: item.classList.contains("dock__item--active"),
                });
            }
        });
        if (updatePluginDockShowStates(
            states,
            this.app.plugins,
            window.siyuan.storage[Constants.LOCAL_PLUGIN_DOCKS],
        )) {
            setStorageVal(Constants.LOCAL_PLUGIN_DOCKS, window.siyuan.storage[Constants.LOCAL_PLUGIN_DOCKS]);
        }
    }
}
