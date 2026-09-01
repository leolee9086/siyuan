import { Layout } from "./index";
import type {LayoutDomain, LayoutTab, LayoutWindow} from "./layout.types";
import { genUUID } from "../util/platform/genID";
import {
    fixWndFlex1,
    pdfIsLoading,
} from "./util";
import { setPanelFocus } from "./utils/setPanelFocus";
import { Constants } from "../constants";
import {isElectron} from "../platform";
import {ipcSend} from "../platform/electron/ipcRenderer";
import {getFrontend, isWindow} from "../util/platform/functions";
import type { AppFacade } from "../app/AppFacade.types";
import {newCenterEmptyTab} from "./tabUtil";
import {resizeTabs} from "./resize/resizeTabs";
import { recordBeforeResizeTop } from "../protyle/util/resize";
import {saveLayout} from "./persistence/saveLayout";
import { getInstanceById } from "./util";
import {getWndByLayout} from "./query/layoutInstance";
import {closeWindow} from "../window/closeWin";
import {setTitle} from "../util/processTitle";
import { bindHeaderDragEvents, bindPanelDragEvents } from "./Wnd.drag";
import {
    wndSwitchTab,
    wndAddTab,
    wndRenderTabList,
} from "./Wnd.tab";
import {
    wndRemoveTab,
    wndMoveTab,
} from "./Wnd.tabAction";
import {getWndDragRestore} from "./Wnd.drag.port";

export class Wnd {
    private app: AppFacade;
    public id: string;
    public parent?: LayoutDomain;
    public element: HTMLElement;
    public headersElement: HTMLElement;
    public children: LayoutTab[] = [];
    public resize?: Config.TUILayoutDirection;

    constructor(app: AppFacade, resize?: Config.TUILayoutDirection, parentType?: Config.TUILayoutType) {
        this.id = genUUID();
        this.app = app;
        this.resize = resize;
        this.element = document.createElement("div");
        this.element.classList.add("fn__flex-1", "fn__flex");
        let dragHTML = '<div class="layout-tab-container__drag fn__none"></div>';
        if (parentType === "left" || parentType === "right" || parentType === "bottom") {
            dragHTML = "";
        }
        this.element.innerHTML = `<div data-type="wnd" data-id="${this.id}" class="fn__flex-column fn__flex fn__flex-1">
    <div class="fn__flex fn__none">
        <ul class="fn__flex layout-tab-bar"></ul>
        <ul class="layout-tab-bar layout-tab-bar--readonly fn__flex-1">
            <li class="item item--readonly">
                <span data-type="new" class="block__icon block__icon--show ariaLabel${window.siyuan.config.readonly ? " fn__none" : ""}" aria-label="${window.siyuan.languages.newFile}"><svg><use xlink:href="#iconAdd"></use></svg></span>
                <span class="fn__flex-1"></span>
                <span data-type="more" data-menu="true" class="block__icon block__icon--show ariaLabel" aria-label="${window.siyuan.languages.switchTab}"><svg><use xlink:href="#iconDown"></use></svg></span>
            </li>
        </ul>
    </div>
    <div class="layout-tab-container fn__flex-1">${dragHTML}</div>
</div>`;
        this.headersElement = this.element.querySelector(".layout-tab-bar");
        const dragElement = this.element.querySelector(".layout-tab-container__drag") as HTMLElement;
        if (!dragElement) {
            return;
        }
        this.headersElement.addEventListener("mousedown", (event) => {
            // 点击鼠标滚轮关闭
            if (event.button !== 1) {
                return;
            }
            let target = event.target as HTMLElement;
            while (target && !target.isEqualNode(this.headersElement)) {
                if (target.tagName === "LI") {
                    this.removeTab(target.getAttribute("data-id"));
                    window.siyuan.menus.menu.remove();
                    event.stopPropagation();
                    event.preventDefault();
                    const frontend = getFrontend();
                    if ((["desktop", "desktop-window"].includes(frontend) && window.siyuan.config.system.os === "linux") ||
                        (frontend === "browser-desktop" && navigator.userAgent.indexOf("Linux") !== -1)) {
                        const activeElement = document.activeElement;
                        window.addEventListener("paste", this.#preventPast, {
                            capture: true,
                            once: true
                        });
                        // TODO 保持原有焦点？https://github.com/siyuan-note/siyuan/pull/13395/files#r1877004077
                        if (activeElement instanceof HTMLElement) {
                            activeElement.focus();
                        }
                        // 如果在短时间内没有 paste 事件发生,移除监听
                        setTimeout(() => {
                            window.removeEventListener("paste", this.#preventPast, {
                                capture: true
                            });
                        }, Constants.TIMEOUT_INPUT);
                    }
                    break;
                }
                target = target.parentElement;
            }
        });
        this.headersElement.addEventListener("mousewheel", (event: WheelEvent) => {
            this.headersElement.scrollLeft = this.headersElement.scrollLeft + event.deltaY;
        }, { passive: true });

        this.headersElement.parentElement.addEventListener("click", (event) => {
            let target = event.target as HTMLElement;
            while (target && !target.isEqualNode(this.headersElement)) {
                if (target.classList.contains("block__icon") && target.getAttribute("data-type") === "new") {
                    setPanelFocus(this.headersElement.parentElement.parentElement);
                    void app.createDocument();
                    break;
                } else if (target.classList.contains("block__icon") && target.getAttribute("data-type") === "more") {
                    this.renderTabList(target);
                    break;
                } else if (target.tagName === "LI" && target.getAttribute("data-id") && !pdfIsLoading(this.element)) {
                    if (target.classList.contains("item--focus")) {
                        this.switchTab(target, true, true, false, false);
                    } else {
                        this.switchTab(target, true);
                    }
                    this.showHeading();
                    break;
                }
                target = target.parentElement;
            }
        });
        this.headersElement.parentElement.addEventListener("dblclick", (event) => {
            const tabElement = (event.target as Element).closest<HTMLElement>('[data-type="tab-header"][data-id]');
            if (!tabElement || !this.headersElement.contains(tabElement)) {
                return;
            }
            if (window.siyuan.config.fileTree.closeTabOnDoubleClick) {
                this.removeTab(tabElement.getAttribute("data-id"));
            } else if (window.siyuan.config.fileTree.openFilesUseCurrentTab) {
                tabElement.classList.remove("item--unupdate");
            }
        });
        // 拖拽事件委托到 Wnd.drag.ts
        const restoreCenter = getWndDragRestore();
        bindHeaderDragEvents(this, app, getInstanceById, (data, target) => restoreCenter(app, data, target), saveLayout);
        bindPanelDragEvents(this, dragElement, getInstanceById, (data, target) => restoreCenter(app, data, target));
    }

    #preventPast(event: ClipboardEvent) {
        event.preventDefault();
        event.stopPropagation();
    }

    public showHeading() {
        const currentElement = this.headersElement.querySelector(".item--focus") as HTMLElement;
        if (!currentElement) {
            return;
        }
        if (currentElement.offsetLeft + currentElement.clientWidth > this.headersElement.scrollLeft + this.headersElement.clientWidth) {
            this.headersElement.scrollLeft = currentElement.offsetLeft + currentElement.clientWidth - this.headersElement.clientWidth;
        } else if (currentElement.offsetLeft < this.headersElement.scrollLeft) {
            this.headersElement.scrollLeft = currentElement.offsetLeft;
        }
    }

    public switchTab(target: HTMLElement, pushBack = false, update = true, resize = true, isSaveLayout = true) {
        wndSwitchTab(this, this.app, target, pushBack, update, resize, isSaveLayout);
    }

    public addTab(tab: LayoutTab, keepCursor = false, isSaveLayout = true, activeTime?: string) {
        wndAddTab(this, tab, keepCursor, isSaveLayout, activeTime);
    }

    private renderTabList(target: HTMLElement) {
        wndRenderTabList(this, target);
    }

    public removeTab(id: string, isBatchClose = false, animate = true, isSaveLayout = true) {
        wndRemoveTab(this, id, isBatchClose, animate, isSaveLayout);
    }

    public moveTab(tab: LayoutTab, nextId?: string) {
        wndMoveTab(this, tab, nextId);
    }

    public split(direction: Config.TUILayoutDirection, after = true): LayoutWindow {
        if (this.children.length === 1 && !this.children[0].headElement) {
            return this;
        }
        recordBeforeResizeTop();
        const wnd = new Wnd(this.app, direction);
        if (direction === this.parent.direction) {
            this.parent.addWnd(wnd, this.id, after);
        } else if (this.parent.children.length === 1) {
            this.parent.direction = direction;
            if (direction === "tb") {
                this.parent.element.classList.add("fn__flex-column");
                this.parent.element.style.minHeight = "8px";
                this.parent.element.classList.remove("fn__flex");
            } else {
                this.parent.element.classList.remove("fn__flex-column");
                this.parent.element.classList.add("fn__flex");
            }
            this.parent.addWnd(wnd, this.id, after);
        } else {
            this.parent.children.find((item, index) => {
                if (item.id === this.id) {
                    const layout = new Layout({
                        resize: item.resize,
                        direction,
                    });
                    this.parent.addLayout(layout, item.id, after);
                    const movedWnd = this.parent.children.splice(after ? index : index + 1, 1)[0];
                    if (movedWnd.resize) {
                        if (movedWnd.element.previousElementSibling && movedWnd.element.previousElementSibling.classList.contains("layout__resize")) {
                            movedWnd.element.previousElementSibling.remove();
                        } else if (movedWnd.element.nextElementSibling && movedWnd.element.nextElementSibling.classList.contains("layout__resize")) {
                            movedWnd.element.nextElementSibling.remove();
                        }
                        movedWnd.resize = undefined;
                    }
                    if (after) {
                        layout.addWnd.call(layout, movedWnd);
                        layout.addWnd.call(layout, wnd);
                    } else {
                        layout.addWnd.call(layout, wnd);
                        layout.addWnd.call(layout, movedWnd);
                    }

                    if (direction === "tb" && movedWnd.element.style.width) {
                        layout.element.style.width = movedWnd.element.style.width;
                        layout.element.classList.remove("fn__flex-1");
                        movedWnd.element.style.width = "";
                        movedWnd.element.classList.add("fn__flex-1");
                    } else if (direction === "lr" && movedWnd.element.style.height) {
                        layout.element.style.height = movedWnd.element.style.height;
                        layout.element.classList.remove("fn__flex-1");
                        movedWnd.element.style.height = "";
                        movedWnd.element.classList.add("fn__flex-1");
                    }
                    fixWndFlex1(layout);
                    return true;
                }
            });
        }
        return wnd;
    }

    public ensureCenterWindow() {
        const centerLayout = window.siyuan.layout.centerLayout;
        if (!centerLayout || getWndByLayout(centerLayout)) {
            return;
        }
        if (isElectron && isWindow()) {
            closeWindow(this.app, ipcSend);
            return;
        }
        const wnd = new Wnd(this.app);
        centerLayout.addWnd(wnd);
        wnd.addTab(newCenterEmptyTab(this.app), false, false);
        setTitle("", true);
    }

    public remove() {
        let layout = this.parent;
        let element = this.element;
        let id = this.id;
        while (layout && layout.children.length === 1 && "center" !== layout.type) {
            id = layout.id;
            element = layout.element;
            layout = layout.parent;
        }

        layout.children.find((item, index) => {
            if (item.id === id) {
                if (layout.children.length > 1) {
                    let previous = layout.children[index - 1];
                    if (index === 0) {
                        previous = layout.children[1];
                    }
                    if (layout.children.length === 2) {
                        if (layout.direction === "lr") {
                            previous.element.style.width = "";
                        } else {
                            previous.element.style.height = "";
                        }
                        previous.resize = undefined;
                        previous.element.classList.add("fn__flex-1");
                    }
                    // https://github.com/siyuan-note/siyuan/issues/5844
                    if (layout.children.length > 2 && index === 0) {
                        layout.children[1].resize = undefined;
                    }
                }
                layout.children.splice(index, 1);
                return true;
            }
        });
        if (element.previousElementSibling && element.previousElementSibling.classList.contains("layout__resize")) {
            element.previousElementSibling.remove();
        } else if (element.nextElementSibling && element.nextElementSibling.classList.contains("layout__resize")) {
            element.nextElementSibling.remove();
        }
        element.remove();
        fixWndFlex1(layout);
        resizeTabs();
    }
}
