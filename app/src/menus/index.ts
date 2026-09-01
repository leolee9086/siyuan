import { getInstanceById } from "../layout/util";
import { setPanelFocus } from "../layout/utils/setPanelFocus";
import { Tab } from "../layout/Tab";
import { initSearchMenu } from "./search";
import { initDockMenu } from "./dock";
import { initFileMenu, initNavigationMenu } from "./navigation";
import { initTabMenu } from "./tab";
import { ipcSend } from "../platform/electron/ipcRenderer";
import { isMobile, isElectron } from "../platform";
import { Menu } from "./Menu";
import { hasClosestByClassName, hasTopClosestByTag } from "../protyle/util/hasClosest";
import type { AppFacade } from "../app/AppFacade.types";
import { Constants } from "../constants";
import { textMenu } from "./text";
import { hideTooltip } from "../dialog/tooltip";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

export class Menus {
    public menu: Menu;

    constructor(app: AppFacade) {
        this.menu = new Menu();
        if (!isMobile) {
        window.addEventListener("contextmenu", (event) => {
            if (event.shiftKey) {
                return;
            }
            let target = event.target as HTMLElement;
            if (hasClosestByClassName(target, "av__panel") && !hasClosestByClassName(target, "b3-menu")) {
                document.querySelector(".av__panel")?.dispatchEvent(new CustomEvent("click", { detail: "close" }));
                event.stopPropagation();
                event.preventDefault();
                return;
            }
            if (target.classList.contains("b3-text-field") || (target.tagName === "INPUT" && (target as HTMLInputElement).type === "text")) {
                if (isElectron) {
                    ipcSend(Constants.SIYUAN_CONTEXT_MENU, {
                        x: event.clientX,
                        y: event.clientY,
                        requestedAt: Date.now(),
                        undo: siyuanI18n.undo,
                        redo: siyuanI18n.redo,
                        copy: siyuanI18n.copy,
                        cut: siyuanI18n.cut,
                        delete: siyuanI18n.delete,
                        paste: siyuanI18n.paste,
                        pasteAsPlainText: siyuanI18n.pasteAsPlainText,
                        selectAll: siyuanI18n.selectAll,
                        addToDictionary: window.siyuan.languages.addToDictionary,
                    });
                }
                event.stopPropagation();
            } else {
                event.preventDefault();
            }
            while (target && target.parentElement   // ⌃⇥ 后点击会为空
                && !target.parentElement.isEqualNode(document.querySelector("body"))) {
                const dataType = target.getAttribute("data-type");
                if (dataType === "tab-header") {
                    this.unselect();
                    initTabMenu(app, (getInstanceById(target.getAttribute("data-id")) as Tab)).popup({
                        x: event.clientX,
                        y: event.clientY
                    });
                    event.stopPropagation();
                    break;
                } else if (dataType === "navigation-root" && !window.siyuan.config.readonly) {
                    if (target.querySelector(".b3-list-item__text").classList.contains("ft__on-surface")) {
                        return;
                    }
                    this.unselect();
                    // navigation 根上：新建文档/文件夹/取消挂在/打开文件位置
                    initNavigationMenu(app, target).popup({ x: event.clientX, y: event.clientY });
                    setPanelFocus(hasClosestByClassName(target, "sy__file") as HTMLElement);
                    event.stopPropagation();
                    break;
                } else if (dataType === "navigation-file") {
                    this.unselect();
                    // navigation 文件上：删除/重命名/打开文件位置/导出
                    initFileMenu(app, this.getDir(target), target.getAttribute("data-path"), target).popup({
                        x: event.clientX,
                        y: event.clientY
                    });
                    setPanelFocus(hasClosestByClassName(target, "sy__file") as HTMLElement);
                    event.stopPropagation();
                    break;
                } else if (dataType === "search-item") {
                    const nodeId = target.getAttribute("data-node-id");
                    if (nodeId) {
                        initSearchMenu(nodeId).popup({ x: event.clientX, y: event.clientY });
                    }
                    event.stopPropagation();
                    break;
                } else if (dataType && target.classList.contains("dock__item")) {
                    hideTooltip();
                    initDockMenu(target).popup({ x: event.clientX, y: event.clientY });
                    event.stopPropagation();
                    break;
                } else if (dataType === "textMenu") {
                    if (isElectron) {
                        target && textMenu(target)?.open({ x: event.clientX, y: event.clientY });
                        event.stopPropagation();
                        event.preventDefault();
                        break;
                    }
                }

                target = target.parentElement;
            }
        }, false);
        }
    }

    private getDir(target: HTMLElement) {
        const rootElement = hasTopClosestByTag(target, "UL");
        if (rootElement) {
            return rootElement.getAttribute("data-url");
        }
    }

    private unselect() {
        const selection = getSelection();
        if (selection && selection.rangeCount > 0) {
            selection.getRangeAt(0).collapse(true);
        }
    }
}
