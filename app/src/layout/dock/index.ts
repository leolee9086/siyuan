/**
 * @AIDONE
 * 已完成拆分重构，清理了所有 lint 错误和类型问题
 */
import { Layout } from "../index";
import { Wnd } from "../Wnd";
import { Model } from "../Model";
import { adjustLayout, saveLayout } from "../util";
import { setPanelFocus } from "../utils/setPanelFocus";
import { getDockByType, resizeTabs } from "../tabUtil";
import { resetFloatDockSize } from "./util";
import { App } from "../../index";
import { Custom } from "./Custom";
import { recordBeforeResizeTop } from "../../protyle/util/resize";
import { Constants } from "../../constants";
import { createDockTab } from "./dock.factory";
import { initDockResize } from "./dock.resize";
import { initDockDnD } from "./dock.dnd";
import { initDockLayout } from "./dock.layout";
import {
    handlePanelFocusSwitch, handleGraphDestroy, handlePostCloseFocus,
    handleTabSwitch, updateDockPanelRelation, updatePanelVisibility,
    handleGraphShow, handleDockHideSize, setDockLayoutSize,
    handleGraphFullscreenDrag, blurActiveElement
} from "./dock.toggle";
import { generateAllButtonsHTML, insertButtonsToContainer } from "./dock.button";
import {
    getSiyuanLanguages, getSiyuanConfig, incrementSiyuanZIndex,
    setWindowTimeout, clearWindowTimeout
} from "./dock.environment";
import { isWnd, isTDock } from "./dock.guard";
import {
    shouldSkipShowDock, isZeroSize, hasBlockingOverlay, setDockPosition,
    isFullscreenActive, isTextFieldFocused, hasHigherZIndexOverlay,
    applyHideTransform, shouldHideOnMouseLeave, hasValidDockType
} from "./dock.visibility";
import { initActiveElements, initNoActiveElements, findActiveEditor, removeSourceTab, insertSourceElement } from "./dock.init";
import { setSizeForItem, getMaxSize } from "./dock.size";

const TYPES = ["file", "outline", "inbox", "bookmark", "tag", "graph", "globalGraph", "backlink"];

export class Dock {
    public element!: HTMLElement;
    public layout!: Layout;
    public position: TDockPosition;
    private app: App;
    public resizeElement!: HTMLElement;
    public pin = true;
    public data: { [key in TDock | string]?: Model | boolean } = {};
    private hideResizeTimeout = 0;

    constructor(options: { app: App, data: { pin: boolean, data: Config.IUILayoutDockTab[][] }, position: TDockPosition }) {
        this.app = options.app;
        this.position = options.position;
        this.pin = options.data.pin;
        this.data = {};
        initDockLayout(this, options.position);
        const dockElement = document.getElementById("dock" + options.position);
        if (!dockElement) throw new Error(`Dock element not found: dock${options.position}`);
        this.element = dockElement;
        const dockClass = options.position === "Bottom" ? ' class="fn__flex dock__items"' : ' class="dock__items"';
        this.element.innerHTML = `<div${dockClass}></div><div class="fn__flex-1 dock__item--space"></div><div${dockClass}></div>`;
        this.initDockData(options.data.data);
        this.element.addEventListener("click", this.onClick.bind(this));
        this.layout.element.addEventListener("mouseleave", this.onMouseLeave.bind(this));
        initDockResize(this);
        initDockDnD(this);
        const config = getSiyuanConfig();
        if (config?.uiLayout?.hideDock) this.element.classList.add("fn__none");
        // @内联回调
        if (!this.pin) setWindowTimeout(() => { this.resetDockPosition(false); this.hideDock(true); this.layout.element.classList.add("layout--float"); this.resizeElement.classList.add("fn__none"); });
    }

    private initDockData(data: Config.IUILayoutDockTab[][]): void {
        if (!hasValidDockType(data, TYPES)) { this.renderPin(); this.element.classList.add("fn__none"); this.initDockFiles(); this.initDockActive(); return; }
        const first = data[0]; const second = data[1];
        if (first) this.genButton(first, 0);
        if (second) this.genButton(second, 1);
        this.element.classList.remove("fn__none"); this.initDockFiles(); this.initDockActive();
    }

    private renderPin(): void {
        const languages = getSiyuanLanguages(); if (!languages) return;
        const firstChild = this.element.firstElementChild; if (!firstChild) return;
        firstChild.innerHTML = `<span class="dock__item dock__item--pin ariaLabel" aria-label="${this.pin ? languages.unpin : languages.pin}"><svg><use xlink:href="#icon${this.pin ? "Unpin" : "Pin"}"></use></svg></span>`;
    }

    private initDockFiles(): void {
        for (const item of Array.from(this.element.querySelectorAll(".dock__item"))) {
            if (item.getAttribute("data-type") === "file" && !item.classList.contains("dock__item--active")) {
                this.toggleModel("file", true, false, false, false); this.toggleModel("file", false, false, false, false);
            }
        }
    }

    private initDockActive(): void {
        const activeElements = Array.from(this.element.querySelectorAll(".dock__item--active"));
        if (activeElements.length > 0) { initActiveElements(this, activeElements); return; }
        initNoActiveElements(this);
    }

    private onMouseLeave(event: MouseEvent): void {
        const toElement = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
        if (shouldHideOnMouseLeave(this, event, toElement)) this.hideDock();
    }

    private onClick(event: MouseEvent): void {
        let target = event.target; if (!(target instanceof HTMLElement)) return;
        while (target && !target.isEqualNode(this.element)) {
            const type = target.getAttribute("data-type");
            if (isTDock(type)) { this.toggleModel(type, false, true); event.preventDefault(); return; }
            if (target.classList.contains("dock__item")) { this.handlePinClick(target, event); return; }
            const parent = target.parentElement; if (!(parent instanceof HTMLElement)) return; target = parent;
        }
    }

    private handlePinClick(target: HTMLElement, event: MouseEvent): void {
        this.togglePin();
        const languages = getSiyuanLanguages();
        if (languages?.unpin && languages?.pin) target.setAttribute("aria-label", this.pin ? languages.unpin : languages.pin);
        const use = target.querySelector("use"); if (use) use.setAttribute("xlink:href", this.pin ? "#iconUnpin" : "#iconPin");
        event.preventDefault();
    }

    public togglePin(): void {
        this.pin = !this.pin;
        const hasActive = this.element.querySelector(".dock__item--active");
        if (!this.pin) {
            this.handleFloatModeToggle(Boolean(hasActive));
            return;
        }
        this.handlePinModeToggle(Boolean(hasActive));
    }

    private handleFloatModeToggle(hasActive: boolean): void {
        this.resetDockPosition(hasActive);
        this.resizeElement.classList.add("fn__none");
        if (hasActive) this.showDock(true);
        if (!hasActive) this.hideDock(true);
        this.layout.element.classList.toggle("layout--float");
        resizeTabs();
    }

    private handlePinModeToggle(hasActive: boolean): void {
        this.layout.element.style.opacity = "";
        this.layout.element.style.transform = "";
        this.layout.element.style.zIndex = "";
        if (hasActive) this.resizeElement.classList.remove("fn__none");
        this.layout.element.classList.toggle("layout--float");
        resizeTabs();
    }

    public resetDockPosition(show: boolean): void {
        const opacity = show ? 1 : 0;
        if (this.position === "Left" || this.position === "Right") { this.layout.element.setAttribute("style", `width:${this.layout.element.clientWidth}px;opacity:${opacity};`); return; }
        this.layout.element.setAttribute("style", `height:${this.layout.element.clientHeight}px;opacity:${opacity};`);
    }

    public showDock(reset = false): void {
        if (!reset && shouldSkipShowDock(this)) return;
        if (!reset && isZeroSize(this)) return;
        if (hasBlockingOverlay()) return;
        if (!reset) this.layout.element.style.opacity = "1";
        this.layout.element.style.transform = ""; this.layout.element.style.zIndex = incrementSiyuanZIndex().toString();
        setDockPosition(this);
    }

    public hideDock(reset = false): void {
        if (!reset && (this.layout.element.style.opacity === "0" || this.pin)) return;
        if (isFullscreenActive(this)) return; if (isTextFieldFocused(this)) return; if (hasHigherZIndexOverlay(this)) return;
        applyHideTransform(this); if (reset) return;
        this.layout.element.style.opacity = "0";
        const af = this.element.querySelector(".dock__item--activefocus"); if (af) af.classList.remove("dock__item--activefocus");
        const at = this.layout.element.querySelector(".layout__tab--active"); if (at) at.classList.remove("layout__tab--active");
    }

    public toggleModel(type: TDock | string, show = false, close = false, hide = false, isSaveLayout = true): void {
        if (!type) return; if (this.pin) recordBeforeResizeTop();
        const target = this.element.querySelector(`[data-type="${type}"]`); if (!(target instanceof HTMLElement)) return;
        if (show && target.classList.contains("dock__item--active")) target.classList.remove("dock__item--active", "dock__item--activefocus");
        const index = parseInt(target.getAttribute("data-index") || "0", 10);
        const wndChild = this.layout.children[index]; if (!isWnd(wndChild)) return; const wnd = wndChild;
        if (target.classList.contains("dock__item--active") || hide) { this.handleToggleHide(wnd, target, type, close, isSaveLayout); }
        if (!target.classList.contains("dock__item--active") && !hide) { this.handleToggleShow(wnd, target, type, index); }
        this.updatePanelRelations(wnd, index); resizeTabs(isSaveLayout); this.showDock();
        if (target.classList.contains("dock__item--active") && !hide) handleGraphShow(type, this);
    }

    private handleToggleHide(wnd: Wnd, target: HTMLElement, type: string, close: boolean, isSaveLayout: boolean): void {
        if (!close && handlePanelFocusSwitch(wnd, target, this)) return;
        target.classList.remove("dock__item--active", "dock__item--activefocus");
        const activeItems = this.element.querySelectorAll(".dock__item--active");
        const hasNoActiveItems = activeItems.length === 0;
        if (handleDockHideSize(this, hasNoActiveItems)) {
            clearWindowTimeout(this.hideResizeTimeout);
            this.hideDock();
        }
        handleGraphDestroy(type, this);
        handlePostCloseFocus(isSaveLayout);
    }

    private handleToggleShow(wnd: Wnd, target: HTMLElement, type: string, index: number): void {
        for (const item of Array.from(this.element.querySelectorAll(`.dock__item--active[data-index="${index}"]`))) item.classList.remove("dock__item--active", "dock__item--activefocus");
        target.classList.add("dock__item--active", "dock__item--activefocus");
        if (!target.getAttribute("data-id")) { this.createNewTab(wnd, target, type); return; }
        handleTabSwitch(wnd, target.getAttribute("data-id")); this.showDockWithResize(type);
    }

    private createNewTab(wnd: Wnd, target: HTMLElement, type: string): void {
        const editor = findActiveEditor();
        const tab = createDockTab({ app: this.app, type, editor });
        wnd.addTab(tab, false, false); target.setAttribute("data-id", tab.id); this.data[type] = tab.model;
        setPanelFocus(tab.panelElement); this.showDockWithResize(type);
    }

    private showDockWithResize(type: string): void {
        setDockLayoutSize(this, getMaxSize(this)); handleGraphFullscreenDrag(type, this, true);
        if (this.pin) {
            this.layout.element.style.opacity = "";
            // @内联回调
            this.hideResizeTimeout = setWindowTimeout(() => { this.resizeElement.classList.remove("fn__none"); adjustLayout(); }, Constants.TIMEOUT_TRANSITION);
        }
        blurActiveElement();
    }

    private updatePanelRelations(wnd: Wnd, index: number): void {
        const anotherIndex = index === 0 ? 1 : 0;
        const anotherChild = this.layout.children[anotherIndex];
        if (!isWnd(anotherChild)) return;
        const anotherWnd = anotherChild;
        const anotherActiveItems = this.element.querySelectorAll(`.dock__item--active[data-index="${anotherIndex}"]`);
        const currentActiveItems = this.element.querySelectorAll(`.dock__item--active[data-index="${index}"]`);
        const anotherHasActive = anotherActiveItems.length > 0;
        const hasActive = currentActiveItems.length > 0;
        updateDockPanelRelation(this, wnd, anotherWnd, index, anotherIndex, hasActive, anotherHasActive);
        updatePanelVisibility(wnd, anotherWnd, hasActive, anotherHasActive);
    }

    public add(index: number, sourceElement: Element, previousType?: string): void {
        sourceElement.setAttribute("data-height", ""); sourceElement.setAttribute("data-width", "");
        const typeAttr = sourceElement.getAttribute("data-type"); if (!isTDock(typeAttr)) return; const type = typeAttr;
        const sourceDock = getDockByType(type);
        removeSourceTab(sourceDock, parseInt(sourceElement.getAttribute("data-index") || "0", 10), sourceElement);
        const hasActive = sourceElement.classList.contains("dock__item--active");
        if (hasActive && sourceDock) sourceDock.toggleModel(type, false, false, false, false);
        if (sourceDock) delete sourceDock.data[type];
        insertSourceElement(this, sourceElement, index, previousType);
        this.element.classList.remove("fn__none"); resetFloatDockSize(); this.data[type] = true;
        if (hasActive) this.toggleModel(type, true, false, false, false);
        // @内联回调
        setWindowTimeout(() => { saveLayout(); }, Constants.TIMEOUT_TRANSITION);
    }

    public remove(key: TDock | string): void {
        if (isTDock(key)) this.toggleModel(key, false, true, true);
        const item = this.element.querySelector(`[data-type="${key}"]`); if (item) item.remove();
        const custom = this.data[key];
        if (custom instanceof Custom && custom.parent) custom.parent.parent.removeTab(custom.parent.id);
        delete this.data[key];
    }

    public setSize(): void {
        const activesElement = this.element.querySelectorAll(".dock__item--active");
        for (const item of Array.from(activesElement)) setSizeForItem(this, item, activesElement.length);
    }

    public genButton(data: Config.IUILayoutDockTab[], index: number, tabIndex?: number): void {
        const languages = getSiyuanLanguages();
        const html = generateAllButtonsHTML(data, index, languages?.dockTip || "", tabIndex);
        for (const item of data) this.data[item.type] = true;
        insertButtonsToContainer(index === 0 ? this.element.firstElementChild : this.element.lastElementChild, html, tabIndex, (this.pin ? languages?.unpin : languages?.pin) || "", this.pin, index === 0);
        if (typeof tabIndex !== "number") return;
        const config = getSiyuanConfig();
        if (config && !config.uiLayout.hideDock) this.element.classList.remove("fn__none");
        const firstItem = data[0]; if (firstItem?.show) this.toggleModel(firstItem.type, true, false, false, false);
    }
}
