/**
 * Wnd.drag.ts - 窗口拖拽事件处理
 * 从 Wnd.ts 提取的拖拽相关逻辑；通过布局领域根和组合根能力工作。
 */
import { Constants } from "../constants";
import { isElectron } from "../platform";
import { ipcSend } from "../platform/electron/ipcRenderer";
import { hasClosestByAttribute, hasClosestByClassName } from "../protyle/util/hasClosest";
import { setPanelFocus } from "./utils/setPanelFocus";
import { openFileById } from "../editor/utils.openFileById";
import { resizeTabs, setTabPosition } from "./tabUtil";
import { recordBeforeResizeTop } from "../protyle/util/resize";
import type { AppFacade } from "../app/AppFacade.types";
import { dragOverScroll } from "../boot/globalEvent/dragover";
import type { LayoutTab, LayoutWindow } from "./layout.types";
import {isLayoutTab, isLayoutWindow} from "./layout.types.guard";

function isPointWithinLines(
    x: number, y: number,
    line1: { k: number; b: number },
    line2: { k: number; b: number },
): boolean {
    const y1 = line1.k * x + line1.b;
    const y2 = line2.k * x + line2.b;
    return (y >= Math.min(y1, y2) && y <= Math.max(y1, y2));
}

function updateDragElement(
    wnd: LayoutWindow,
    event: DragEvent,
    rect: DOMRect,
    dragElement: HTMLElement,
) {
    const height = rect.height;
    const width = rect.width;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < width / 5 && isPointWithinLines(x, y, {
        k: 1.5 * height / width, b: -0.15 * height
    }, {
        k: -1.25 * height / width, b: 1.05 * height
    })) {
        dragElement.setAttribute("style", "height:100%;width:50%;right:50%;bottom:0;left:0;top:0");
    } else if (x > width * 0.8 && isPointWithinLines(x, y, {
        k: -1.5 * height / width, b: 1.35 * height
    }, {
        k: 1.25 * height / width, b: -0.2 * height
    })) {
        dragElement.setAttribute("style", "height:100%;width:50%;right:0;bottom:0;left:50%;top:0");
    } else if (y < height * .15) {
        dragElement.setAttribute("style", "height:50%;width:100%;right:0;bottom:50%;left:0;top:0");
    } else if (y > height * .8) {
        dragElement.setAttribute("style", "height:50%;width:100%;right:0;bottom:0;left:0;top:50%");
    } else {
        dragElement.setAttribute("style", "height:100%;width:100%;right:0;bottom:0;left:0;top:0");
    }
}

/**
 * 绑定 headers parent 上的 dragover 和 drop 事件
 */
export function bindHeaderDragEvents(
    wnd: LayoutWindow,
    app: AppFacade,
    lookup: (id: string) => object | undefined,
    restoreCenter: (data: Config.TUILayoutItem, target: LayoutWindow) => void,
    persistLayout: () => void,
): void {
    wnd.headersElement.parentElement.addEventListener("dragover", function (event: DragEvent & {
        target: HTMLElement
    }) {
        const it = this as HTMLElement;
        if (!window.siyuan.currentDragOverTabHeadersElement) {
            window.siyuan.currentDragOverTabHeadersElement = it;
        } else {
            if (window.siyuan.currentDragOverTabHeadersElement !== it) {
                window.siyuan.currentDragOverTabHeadersElement.classList.remove("layout-tab-bars--drag");
                window.siyuan.currentDragOverTabHeadersElement.querySelectorAll(".layout-tab-bar li[data-clone='true']").forEach(item => {
                    item.remove();
                });
                window.siyuan.currentDragOverTabHeadersElement = it;
            }
        }
        if (event.dataTransfer.types.includes(Constants.SIYUAN_DROP_FILE)) {
            event.preventDefault();
            it.classList.add("layout-tab-bars--drag");
            return;
        }
        // 不能使用 !window.siyuan.dragElement，因为移动页签到新窗口后，再把主窗口页签拖拽新窗口页签上时，该值为空
        if (!event.dataTransfer.types.includes(Constants.SIYUAN_DROP_TAB)) {
            return;
        }
        event.preventDefault();
        const tabBarElement = it.firstElementChild as HTMLElement;
        dragOverScroll(event, tabBarElement.getBoundingClientRect(), tabBarElement, "x");
        let oldTabHeaderElement = window.siyuan.dragElement;
        let exitDrag = false;
        Array.from(it.firstElementChild.childNodes).find((item: HTMLElement) => {
            if (item.style?.opacity === "0.38") {
                oldTabHeaderElement = item;
                exitDrag = true;
                return true;
            }
        });
        if (!exitDrag && oldTabHeaderElement) {
            if (oldTabHeaderElement.classList.contains("item--pin")) {
                return;
            }
            oldTabHeaderElement = oldTabHeaderElement.cloneNode(true) as HTMLElement;
            oldTabHeaderElement.setAttribute("data-clone", "true");
            it.firstElementChild.append(oldTabHeaderElement);
            return;
        } else if (!exitDrag && !oldTabHeaderElement) { // 拖拽到新窗口
            oldTabHeaderElement = document.createElement("li");
            oldTabHeaderElement.style.opacity = "0.38";
            oldTabHeaderElement.innerHTML = '<svg class="svg"><use xlink:href="#iconFile"></use></svg>';
            oldTabHeaderElement.setAttribute("data-clone", "true");
            it.firstElementChild.append(oldTabHeaderElement);
        }
        const newTabHeaderElement = hasClosestByAttribute(event.target, "data-type", "tab-header");
        if (!newTabHeaderElement) {
            if (!oldTabHeaderElement.classList.contains("item--pin")) {
                it.classList.add("layout-tab-bars--drag");
            }
            return;
        }
        it.classList.remove("layout-tab-bars--drag");
        if (newTabHeaderElement !== oldTabHeaderElement &&
            ((oldTabHeaderElement.classList.contains("item--pin") && newTabHeaderElement.classList.contains("item--pin")) ||
                (!oldTabHeaderElement.classList.contains("item--pin") && !newTabHeaderElement.classList.contains("item--pin")))) {
            const rect = newTabHeaderElement.getClientRects()[0];
            if (event.clientX > rect.left + rect.width / 2) {
                newTabHeaderElement.after(oldTabHeaderElement);
            } else {
                newTabHeaderElement.before(oldTabHeaderElement);
            }
        }
    });

    wnd.headersElement.parentElement.addEventListener("drop", function (event: DragEvent & {
        target: HTMLElement
    }) {
        document.querySelectorAll(".layout-tab-bars--drag").forEach(item => {
            item.classList.remove("layout-tab-bars--drag");
        });
        const it = this as HTMLElement;
        if (event.dataTransfer.types.includes(Constants.SIYUAN_DROP_FILE)) {
            // 文档树拖拽
            setPanelFocus(it.parentElement);
            event.dataTransfer.getData(Constants.SIYUAN_DROP_FILE).split(",").forEach(item => {
                if (item) {
                    openFileById({
                        app,
                        id: item,
                        action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]
                    });
                }
            });
            window.siyuan.dragElement = undefined;
            return;
        }
        const tabData = JSON.parse(event.dataTransfer.getData(Constants.SIYUAN_DROP_TAB));
        let oldTab = lookup(tabData.id);
        const targetWndValue = lookup(it.parentElement.getAttribute("data-id"));
        const targetWnd = isLayoutWindow(targetWndValue) ? targetWndValue : undefined;
        oldTab = isLayoutTab(oldTab) ? oldTab : undefined;
        if (isElectron && !oldTab) { // 从主窗口拖拽到页签新窗口
            if (targetWnd) {
                restoreCenter(tabData, targetWnd);
                oldTab = targetWnd.children[targetWnd.children.length - 1];
                ipcSend(Constants.SIYUAN_SEND_WINDOWS, { cmd: "closetab", data: tabData.id });
                it.querySelector("li[data-clone='true']").remove();
                targetWnd.switchTab(oldTab.headElement);
                ipcSend(Constants.SIYUAN_CMD, "focus");
            }
        }
        if (!oldTab || !targetWnd) {
            return;
        }

        let nextTabHeaderElement: HTMLElement;
        Array.from(it.firstElementChild.childNodes).find((item: HTMLElement) => {
            if (item.style?.opacity === "0.38") {
                nextTabHeaderElement = item.nextElementSibling as HTMLElement;
                return true;
            }
        });

        if (!it.contains(oldTab.headElement)) {
            // 从其他 Wnd 拖动过来
            const cloneTabElement = it.querySelector("[data-clone='true']");
            if (!cloneTabElement) {
                return;
            }
            cloneTabElement.before(oldTab.headElement);
            cloneTabElement.remove();
            // 对象顺序
            targetWnd.moveTab(oldTab, nextTabHeaderElement ? nextTabHeaderElement.getAttribute("data-id") : undefined);
            resizeTabs();
            return;
        }

        let tempTab: LayoutTab;
        oldTab.parent.children.find((item, index) => {
            if (item.id === oldTab.id) {
                tempTab = oldTab.parent.children.splice(index, 1)[0];
                return true;
            }
        });
        if (nextTabHeaderElement) {
            oldTab.parent.children.find((item, index) => {
                if (item.id === nextTabHeaderElement.getAttribute("data-id")) {
                    oldTab.parent.children.splice(index, 0, tempTab);
                    return true;
                }
            });
        } else {
            oldTab.parent.children.push(tempTab);
        }
        persistLayout();
    });
}

/**
 * 绑定面板拖拽事件（dragElement 及 element 上的 dragenter/dragleave）
 */
export function bindPanelDragEvents(
    wnd: LayoutWindow,
    dragElement: HTMLElement,
    lookup: (id: string) => object | undefined,
    restoreCenter: (data: Config.TUILayoutItem, target: LayoutWindow) => void,
): void {
    let elementDragCounter = 0;
    wnd.element.addEventListener("dragenter", (event: DragEvent & { target: HTMLElement }) => {
        elementDragCounter++;
        if (event.dataTransfer.types.includes(Constants.SIYUAN_DROP_TAB)) {
            const tabHeadersElement = hasClosestByClassName(event.target, "layout-tab-bar");
            if (tabHeadersElement) {
                return;
            }
            const tabPanelsElement = hasClosestByClassName(event.target, "layout-tab-container", true);
            if (tabPanelsElement) {
                dragElement.classList.remove("fn__none");
                updateDragElement(wnd, event, dragElement.parentElement.getBoundingClientRect(), dragElement);
            }
        }
    });
    //  dragElement dragleave 后还会触发 dragenter https://github.com/siyuan-note/siyuan/issues/13753
    wnd.element.addEventListener("dragleave", () => {
        elementDragCounter--;
        if (elementDragCounter === 0) {
            dragElement.classList.add("fn__none");
            dragElement.removeAttribute("style");
        }
    });
    dragElement.addEventListener("dragover", (event: DragEvent & { layerX: number, layerY: number }) => {
        document.querySelectorAll(".layout-tab-bars--drag").forEach(item => {
            item.classList.remove("layout-tab-bars--drag");
        });
        event.preventDefault();
        if (!dragElement.nextElementSibling) {
            return;
        }
        updateDragElement(wnd, event, dragElement.parentElement.getBoundingClientRect(), dragElement);
    });

    dragElement.addEventListener("dragleave", () => {
        dragElement.classList.add("fn__none");
        dragElement.removeAttribute("style");
    });

    dragElement.addEventListener("drop", (event: DragEvent & { target: HTMLElement }) => {
        dragElement.classList.add("fn__none");
        const targetWndElement = event.target.parentElement.parentElement;
        const targetWndValue = lookup(targetWndElement.getAttribute("data-id"));
        const targetWnd = isLayoutWindow(targetWndValue) ? targetWndValue : undefined;
        const tabData = JSON.parse(event.dataTransfer.getData(Constants.SIYUAN_DROP_TAB));
        const oldTabValue = lookup(tabData.id);
        let oldTab = isLayoutTab(oldTabValue) ? oldTabValue : undefined;
        if (isElectron && !oldTab) { // 从主窗口拖拽到页签新窗口
            restoreCenter(tabData, wnd);
            wnd.children.find(item => {
                if (item.headElement.getAttribute("data-activetime") === tabData.activeTime) {
                    oldTab = item;
                    return true;
                }
            });
            ipcSend(Constants.SIYUAN_SEND_WINDOWS, { cmd: "closetab", data: tabData.id });
            ipcSend(Constants.SIYUAN_CMD, "focus");
        }
        if (!oldTab || !targetWnd) {
            dragElement.removeAttribute("style");
            return;
        }

        if (dragElement.style.height === "50%" || dragElement.style.width === "50%") {
            // split
            if (dragElement.style.height === "50%") {
                // split to bottom
                const newWnd = targetWnd.split("tb", dragElement.style.bottom !== "50%");
                newWnd.headersElement.append(oldTab.headElement);
                newWnd.headersElement.parentElement.classList.remove("fn__none");
                newWnd.moveTab(oldTab);
            } else if (dragElement.style.width === "50%") {
                // split to right
                const newWnd = targetWnd.split("lr", dragElement.style.right !== "50%");
                newWnd.headersElement.append(oldTab.headElement);
                newWnd.headersElement.parentElement.classList.remove("fn__none");
                newWnd.moveTab(oldTab);
            }
            resizeTabs();
            setTabPosition();
            dragElement.removeAttribute("style");
            return;
        }
        dragElement.removeAttribute("style");
        if (targetWndElement.contains(document.querySelector(`[data-id="${tabData.id}"]`))) {
            return;
        }
        if (targetWnd) {
            recordBeforeResizeTop();
            targetWnd.headersElement.append(oldTab.headElement);
            targetWnd.headersElement.parentElement.classList.remove("fn__none");
            targetWnd.moveTab(oldTab);
            resizeTabs();
        }
    });
}
