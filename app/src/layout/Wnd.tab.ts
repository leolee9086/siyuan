/**
 * Wnd.tab.ts - Wnd 标签页切换/添加/列表
 * 从 Wnd.ts 提取的标签页管理逻辑
 */
import type {LayoutTab, LayoutWindow} from "./layout.types";
import type {AppFacade} from "../app/AppFacade.types";
import { Editor } from "../editor";
import { Graph } from "./dock/Graph";
import { Asset } from "../asset";
import { Constants } from "../constants";
import { isElectron } from "../platform";
import { isInEmbedBlock } from "../protyle/util/hasClosest";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { setPanelFocus } from "./utils/setPanelFocus";
import { openFileById } from "../editor/utils.openFileById";
import { updatePanelByEditor } from "../editor/util.updatePanelByEditor";
import { scrollCenter } from "../util/DOM/highlightById";
import { fetchPost } from "../util/network/fetch";
import {newModelByInitData} from "./util";
import {saveLayout} from "./persistence/saveLayout";
import {setTabPosition} from "../window/setHeader";
import {setModelsHash} from "../window/modelHash/setModelsHash";
import {getDockByType, resizeTabs} from "./tabUtil";
import { fullscreen } from "../protyle/breadcrumb/action";
import { setPadding } from "../protyle/ui/initUI";
import { clearOBG } from "./dock/util";
import { MenuItem } from "../menus/Menu.Item";
import { escapeHtml } from "../util/DOM/escape";
import { unicode2Emoji } from "../emoji";
import { setPosition } from "../util/DOM/positioning/setPosition";

/**
 * 切换标签页
 * @同步豁免: DOM操作需要同步执行以保证UI状态一致性
 */
export function wndSwitchTab(
    wnd: LayoutWindow,
    app: AppFacade,
    target: HTMLElement,
    pushBack = false,
    update = true,
    resize = true,
    isSaveLayout = true,
): void {
    let currentTab: LayoutTab;
    let isInitActive = false;
    wnd.children.forEach((item) => {
        if (target === item.headElement) {
            if (item.headElement && item.headElement.classList.contains("fn__none")) {
                // https://github.com/siyuan-note/siyuan/issues/267
            } else {
                if (item.headElement) {
                    item.headElement.classList.add("item--focus");
                    if (item.headElement.getAttribute("data-init-active") === "true") {
                        item.headElement.removeAttribute("data-init-active");
                        isInitActive = true;
                    } else {
                        item.headElement.setAttribute("data-activetime", (new Date()).getTime().toString());
                        // 更新文档浏览时间
                        if (item.model instanceof Editor) {
                            fetchPost("/api/storage/updateRecentDocViewTime", { rootID: item.model.editor.protyle.block.rootID });
                        }
                    }
                }
                item.panelElement.classList.remove("fn__none");
            }
            currentTab = item;
        } else {
            item.headElement?.classList.remove("item--focus");
            if (!item.panelElement.classList.contains("fn__none")) {
                // 必须现判断，否则会触发 observer.observe(this.element, {attributeFilter: ["class"]}); 导致 https://ld246.com/article/1641198819303
                item.panelElement.classList.add("fn__none");
            }
        }
    });
    // 在 JSONToLayout 中进行 focus
    if (!isInitActive) {
        setPanelFocus(wnd.headersElement.parentElement.parentElement, isSaveLayout);
    }
    if (currentTab && currentTab.headElement) {
        const initData = currentTab.headElement.getAttribute("data-initdata");
        if (initData) {
            currentTab.addModel(newModelByInitData(app, currentTab, JSON.parse(initData)));
            currentTab.headElement.removeAttribute("data-initdata");
            if (isSaveLayout) {
                saveLayout();
            }
            return;
        }
    }

    if (currentTab && target === currentTab.headElement) {
        if (currentTab.model instanceof Graph) {
            currentTab.model.onGraph(false);
        } else if (currentTab.model instanceof Asset && currentTab.model.pdfObject && currentTab.model.pdfObject.pdfViewer) {
            // https://github.com/siyuan-note/siyuan/issues/5655
            currentTab.model.pdfObject.pdfViewer.container.focus();
        }
    }

    if (currentTab && currentTab.model instanceof Editor) {
        const keepCursorId = currentTab.headElement.getAttribute("keep-cursor");
        if (keepCursorId) {
            // 在新页签中打开，但不跳转到新页签，但切换到新页签时需调整滚动
            let nodeElement: HTMLElement;
            Array.from(currentTab.model.editor.protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${keepCursorId}"]`)).find((item: HTMLElement) => {
                if (!isInEmbedBlock(item)) {
                    nodeElement = item;
                    return true;
                }
            });
            if (nodeElement) {
                if (!currentTab.model.editor.protyle.toolbar.range) {
                    const range = document.createRange();
                    range.selectNodeContents(nodeElement);
                    range.collapse();
                    currentTab.model.editor.protyle.toolbar.range = range;
                }
                scrollCenter(currentTab.model.editor.protyle, nodeElement, "start");
            } else {
                openFileById({
                    app,
                    id: keepCursorId,
                    action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]
                });
            }
            currentTab.headElement.removeAttribute("keep-cursor");
        }
        // focusin 触发前，layout__wnd--active 和 tab 已设置，需在调用里面更新
        if (update) {
            updatePanelByEditor({
                protyle: currentTab.model.editor.protyle,
                focus: true,
                pushBackStack: pushBack,
                reload: false,
                resize,
            }, getDockByType("file"));
        }
        if (window.siyuan.editorIsFullscreen && !currentTab.model.editor.protyle.element.className.includes("fullscreen")) {
            fullscreen(currentTab.model.editor.protyle.element);
            setPadding(currentTab.model.editor.protyle);
        }
    } else {
        clearOBG();
    }
    if (isSaveLayout) {
        saveLayout();
    }
}

/**
 * 添加标签页到 Wnd
 * @同步豁免: 遗留代码
 */
export function wndAddTab(
    wnd: LayoutWindow,
    tab: LayoutTab,
    keepCursor = false,
    isSaveLayout = true,
    activeTime?: string,
): void {
    if (keepCursor) {
        tab.headElement?.classList.remove("item--focus");
        tab.panelElement.classList.add("fn__none");
    }
    let oldFocusIndex = 0;
    wnd.children.forEach((item, index) => {
        if (item.headElement && item.headElement.classList.contains("item--focus")) {
            oldFocusIndex = index;
            let nextElement = item.headElement.nextElementSibling;
            while (nextElement && nextElement.classList.contains("item--pin")) {
                oldFocusIndex++;
                nextElement = nextElement.nextElementSibling;
            }
        }
        if (!keepCursor) {
            item.headElement?.classList.remove("item--focus");
            item.panelElement.classList.add("fn__none");
        }
    });

    wnd.children.splice(oldFocusIndex + 1, 0, tab);

    if (tab.headElement) {
        wnd.headersElement.parentElement.classList.remove("fn__none");
        if (wnd.headersElement.childElementCount === 0) {
            wnd.headersElement.append(tab.headElement);
        } else {
            wnd.headersElement.children[oldFocusIndex].after(tab.headElement);
        }
        tab.headElement.querySelector(".item__close").addEventListener("click", (event) => {
            if (tab.headElement.classList.contains("item--pin")) {
                tab.unpin();
            } else {
                tab.parent.removeTab(tab.id);
            }
            window.siyuan.menus.menu.remove();
            event.stopPropagation();
            event.preventDefault();
        });
        tab.headElement.setAttribute("data-activetime", activeTime || (new Date()).getTime().toString());
    }
    const containerElement = wnd.element.querySelector(".layout-tab-container");
    if (!containerElement.querySelector(".fn__flex-1")) {
        // empty center
        containerElement.append(tab.panelElement);
    } else if (!containerElement.querySelector(".layout-tab-container__drag")) {
        // Dock
        containerElement.children[oldFocusIndex].after(tab.panelElement);
    } else {
        containerElement.children[oldFocusIndex + 1].after(tab.panelElement);
    }

    tab.parent = wnd;
    if (tab.callback) {
        tab.callback(tab);
    }

    // 移除 centerLayout 中的 empty
    if (wnd.parent.type === "center" && wnd.children.length === 2 && !wnd.children[0].headElement) {
        wnd.removeTab(wnd.children[0].id);
    } else if (wnd.children.length > window.siyuan.config.fileTree.maxOpenTabCount) {
        removeOverCounter(wnd, isSaveLayout);
    }
    if (isElectron) {
        setTabPosition();
        setModelsHash();
    }
    if (isSaveLayout) {
        saveLayout();
    }
}

/**
 * 渲染标签列表菜单
 * @同步豁免: 遗留代码
 */
export function wndRenderTabList(wnd: LayoutWindow, target: HTMLElement): void {
    if (!window.siyuan.menus.menu.element.classList.contains("fn__none") &&
        window.siyuan.menus.menu.element.getAttribute("data-name") === Constants.MENU_TAB_LIST) {
        window.siyuan.menus.menu.remove();
        return;
    }
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.element.classList.add("b3-menu--list");
    Array.from(wnd.headersElement.children).forEach((item: HTMLElement) => {
        const iconElement = item.querySelector(".item__icon");
        const graphicElement = item.querySelector(".item__graphic");
        let iconHTML = undefined;
        if (iconElement) {
            if (iconElement.firstElementChild?.tagName === "IMG") {
                // 图标为图片的文档
                iconHTML = `<img src="${iconElement.firstElementChild.getAttribute("src")}"  class="b3-menu__icon">`;
            } else {
                // 有图标的文档
                iconHTML = `<span class="b3-menu__icon">${iconElement.innerHTML}</span>`;
            }
        } else if (!graphicElement) {
            // 没有图标的文档
            iconHTML = unicode2Emoji(window.siyuan.storage[Constants.LOCAL_IMAGES].file, "b3-menu__icon", true);
        }
        window.siyuan.menus.menu.append(new MenuItem({
            label: escapeHtml(item.querySelector(".item__text").textContent),
            action: "iconCloseRound",
            iconHTML,
            icon: graphicElement ? graphicElement.firstElementChild.getAttribute("xlink:href").substring(1) : "",
            bind: (element) => {
                element.addEventListener("click", (itemEvent) => {
                    if (hasClosestByClassName(itemEvent.target as Element, "b3-menu__action")) {
                        wnd.removeTab(item.getAttribute("data-id"));
                        if (element.previousElementSibling || element.nextElementSibling) {
                            element.remove();
                            setPosition(window.siyuan.menus.menu.element, rect.left + rect.width - window.siyuan.menus.menu.element.clientWidth, rect.top + rect.height);
                        } else {
                            window.siyuan.menus.menu.remove();
                        }
                    } else {
                        wnd.switchTab(item, true);
                        wnd.showHeading();
                        window.siyuan.menus.menu.remove();
                    }
                    itemEvent.preventDefault();
                    itemEvent.stopPropagation();
                });
            },
            current: item.classList.contains("item--focus")
        }).element);
    });
    window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_TAB_LIST);
    const rect = target.getBoundingClientRect();
    window.siyuan.menus.menu.popup({
        x: rect.left + rect.width,
        y: rect.top + rect.height,
        isLeft: true
    });
}

/**
 * 移除超出数量限制的标签页
 * @同步豁免: 遗留代码
 */
export function removeOverCounter(wnd: LayoutWindow, isSaveLayout = false): void {
    let removeId: string;
    let openTime: string;
    let removeCount = 0;
    wnd.children.forEach((item, index) => {
        if (!item.headElement) {
            return;
        }
        if (item.headElement.classList.contains("item--pin") || item.headElement.classList.contains("item--focus")) {
            return;
        }
        removeCount++;
        if (!openTime) {
            openTime = item.headElement.getAttribute("data-activetime");
            removeId = wnd.children[index].id;
        } else if (item.headElement.getAttribute("data-activetime") < openTime) {
            openTime = item.headElement.getAttribute("data-activetime");
            removeId = wnd.children[index].id;
        }
    });
    if (removeId) {
        wnd.removeTab(removeId, false, false, isSaveLayout);
        removeCount--;
    }
    if (removeCount > 0 && wnd.children.length > window.siyuan.config.fileTree.maxOpenTabCount) {
        removeOverCounter(wnd, isSaveLayout);
    }
}
