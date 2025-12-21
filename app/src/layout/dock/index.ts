/**
 * @AIDONE 已完成拆分重构
 * 所有 private 方法已提取到辅助文件中
 */
import { Layout } from "../index";
import { Model } from "../Model";
import { saveLayout } from "../util";
import { getDockByType, resizeTabs } from "../tabUtil";
import { resetFloatDockSize } from "./util";
import { App } from "../../index";
import { Custom } from "./Custom";
import { recordBeforeResizeTop } from "../../protyle/util/resize";
import { Constants } from "../../constants";
import { initDockResize } from "./dock.resize";
import { initDockDnD } from "./dock.dnd";
import { initDockLayout } from "./dock.layout";
import { handleGraphShow, handleFloatModeToggle, handlePinModeToggle } from "./dock.toggle";
import { generateAllButtonsHTML, insertButtonsToContainer } from "./dock.button";
import { getSiyuanLanguages, getSiyuanConfig, incrementSiyuanZIndex, setWindowTimeout } from "./dock.environment";
import { isWnd, isTDock } from "./dock.guard";
import { shouldSkipShowDock, isZeroSize, hasBlockingOverlay, setDockPosition, isFullscreenActive, isTextFieldFocused, hasHigherZIndexOverlay, applyHideTransform } from "./dock.visibility";
import { removeSourceTab, insertSourceElement, initDockFloatMode, initDockData } from "./dock.init";
import { setSizeForItem } from "./dock.size";
import { handleClick, handleMouseLeave } from "./dock.events";
import { executeToggleHide, executeToggleShow, executeUpdatePanelRelations } from "./dock.model";

const TYPES = ["file", "outline", "inbox", "bookmark", "tag", "graph", "globalGraph", "backlink"];

export class Dock {
    public element!: HTMLElement;
    public layout!: Layout;
    public position: TDockPosition;
    public app: App;
    public resizeElement!: HTMLElement;
    public pin = true;
    public data: { [key in TDock | string]?: Model | boolean } = {};
    public hideResizeTimeout = 0;

    constructor(options: { app: App, data: { pin: boolean, data: Config.IUILayoutDockTab[][] }, position: TDockPosition }) {
        this.app = options.app;
        this.position = options.position;
        this.pin = options.data.pin;
        this.data = {};
        initDockLayout(this, options.position);
        const dockElement = document.getElementById("dock" + options.position);
        if (!dockElement) {
            throw new Error(`Dock element not found: dock${options.position}`);
        }
        this.element = dockElement;
        const dockClass = options.position === "Bottom" ? ' class="fn__flex dock__items"' : ' class="dock__items"';
        this.element.innerHTML = `<div${dockClass}></div><div class="fn__flex-1 dock__item--space"></div><div${dockClass}></div>`;
        initDockData(this, options.data.data, TYPES, getSiyuanLanguages);
        this.element.addEventListener("click", (e) => handleClick(this, e));
        this.layout.element.addEventListener("mouseleave", (e) => handleMouseLeave(this, e));
        initDockResize(this);
        initDockDnD(this);
        const config = getSiyuanConfig();
        if (config?.uiLayout?.hideDock) {
            this.element.classList.add("fn__none");
        }
        if (!this.pin) {
            // @内联回调
            setWindowTimeout(() => initDockFloatMode(this));
        }
    }

    public togglePin(): void {
        this.pin = !this.pin;
        const hasActive = this.element.querySelector(".dock__item--active");
        if (!this.pin) {
            handleFloatModeToggle(this, Boolean(hasActive));
            return;
        }
        handlePinModeToggle(this, Boolean(hasActive));
    }

    public resetDockPosition(show: boolean): void {
        const opacity = show ? 1 : 0;
        const isHorizontal = this.position === "Left" || this.position === "Right";
        const prop = isHorizontal ? "width" : "height";
        const size = isHorizontal ? this.layout.element.clientWidth : this.layout.element.clientHeight;
        this.layout.element.setAttribute("style", `${prop}:${size}px;opacity:${opacity};`);
    }

    public showDock(reset = false): void {
        if (!reset && shouldSkipShowDock(this)) {
            return;
        }
        if (!reset && isZeroSize(this)) {
            return;
        }
        if (hasBlockingOverlay()) {
            return;
        }
        if (!reset) {
            this.layout.element.style.opacity = "1";
        }
        this.layout.element.style.transform = "";
        this.layout.element.style.zIndex = incrementSiyuanZIndex().toString();
        setDockPosition(this);
    }

    public hideDock(reset = false): void {
        if (!reset && (this.layout.element.style.opacity === "0" || this.pin)) {
            return;
        }
        if (isFullscreenActive(this)) {
            return;
        }
        if (isTextFieldFocused(this)) {
            return;
        }
        if (hasHigherZIndexOverlay(this)) {
            return;
        }
        applyHideTransform(this);
        if (reset) {
            return;
        }
        this.layout.element.style.opacity = "0";
        const af = this.element.querySelector(".dock__item--activefocus");
        if (af) {
            af.classList.remove("dock__item--activefocus");
        }
        const at = this.layout.element.querySelector(".layout__tab--active");
        if (at) {
            at.classList.remove("layout__tab--active");
        }
    }

    public toggleModel(type: TDock | string, show = false, close = false, hide = false, isSaveLayout = true): void {
        if (!type) {
            return;
        }
        if (this.pin) {
            recordBeforeResizeTop();
        }
        const target = this.element.querySelector(`[data-type="${type}"]`);
        if (!(target instanceof HTMLElement)) {
            return;
        }
        if (show && target.classList.contains("dock__item--active")) {
            target.classList.remove("dock__item--active", "dock__item--activefocus");
        }
        const index = parseInt(target.getAttribute("data-index") || "0", 10);
        const wndChild = this.layout.children[index];
        if (!isWnd(wndChild)) {
            return;
        }
        if (target.classList.contains("dock__item--active") || hide) {
            executeToggleHide(this, wndChild, target, type, close, isSaveLayout);
        }
        if (!target.classList.contains("dock__item--active") && !hide) {
            executeToggleShow(this, wndChild, target, type, index);
        }
        executeUpdatePanelRelations(this, wndChild, index);
        resizeTabs(isSaveLayout);
        this.showDock();
        if (target.classList.contains("dock__item--active") && !hide) {
            handleGraphShow(type, this);
        }
    }

    public add(index: number, sourceElement: Element, previousType?: string): void {
        sourceElement.setAttribute("data-height", "");
        sourceElement.setAttribute("data-width", "");
        const typeAttr = sourceElement.getAttribute("data-type");
        if (!isTDock(typeAttr)) {
            return;
        }
        const sourceDock = getDockByType(typeAttr);
        removeSourceTab(sourceDock, parseInt(sourceElement.getAttribute("data-index") || "0", 10), sourceElement);
        const hasActive = sourceElement.classList.contains("dock__item--active");
        if (hasActive && sourceDock) {
            sourceDock.toggleModel(typeAttr, false, false, false, false);
        }
        if (sourceDock) {
            delete sourceDock.data[typeAttr];
        }
        insertSourceElement(this, sourceElement, index, previousType);
        this.element.classList.remove("fn__none");
        resetFloatDockSize();
        this.data[typeAttr] = true;
        if (hasActive) {
            this.toggleModel(typeAttr, true, false, false, false);
        }
        // @内联回调
        setWindowTimeout(() => saveLayout(), Constants.TIMEOUT_TRANSITION);
    }

    public remove(key: TDock | string): void {
        if (isTDock(key)) {
            this.toggleModel(key, false, true, true);
        }
        const item = this.element.querySelector(`[data-type="${key}"]`);
        if (item) {
            item.remove();
        }
        const custom = this.data[key];
        if (custom instanceof Custom && custom.parent) {
            custom.parent.parent.removeTab(custom.parent.id);
        }
        delete this.data[key];
    }

    public setSize(): void {
        const activesElement = this.element.querySelectorAll(".dock__item--active");
        for (const item of Array.from(activesElement)) {
            setSizeForItem(this, item, activesElement.length);
        }
    }

    public genButton(data: Config.IUILayoutDockTab[], index: number, tabIndex?: number): void {
        const languages = getSiyuanLanguages();
        const html = generateAllButtonsHTML(data, index, languages?.dockTip || "", tabIndex);
        for (const item of data) {
            this.data[item.type] = true;
        }
        const container = index === 0 ? this.element.firstElementChild : this.element.lastElementChild;
        insertButtonsToContainer(container, html, tabIndex, (this.pin ? languages?.unpin : languages?.pin) || "", this.pin, index === 0);
        if (typeof tabIndex !== "number") {
            return;
        }
        const config = getSiyuanConfig();
        if (config && !config.uiLayout.hideDock) {
            this.element.classList.remove("fn__none");
        }
        const firstItem = data[0];
        if (firstItem?.show) {
            this.toggleModel(firstItem.type, true, false, false, false);
        }
    }
}
