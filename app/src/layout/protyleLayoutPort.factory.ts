import {fetchPost} from "../util/network/fetch";
import {getAllEditor, getAllModels} from "./getAll";
import {updatePanelByEditor} from "../editor/util.updatePanelByEditor";
import {updateOutline as updateOutlineForModels} from "../editor/util.updateOutline";
import {setPanelFocus} from "./utils/setPanelFocus";
import {isMobile} from "../platform";
import {setProtyleLayoutPort} from "../protyle/runtime/layout.port";
import type {IProtyleLayoutFocusResult, IProtyleLayoutPort, IProtyleLayoutUpdateOptions} from "../protyle/runtime/layout.types";
import {hasClosestBlock, hasClosestByClassName} from "../protyle/util/hasClosest";
import {getInstanceById} from "./util";
import {Tab} from "./Tab";
import {Backlink} from "./dock/Backlink";
import {withEncryptedNotebook} from "../util/file/notebook/store";
import {getDockByType} from "./query/dockByType";

/** 完整 App 的布局协同适配器；具体布局树和 DOM 查询只允许出现在此边界内。 */
const appLayoutPort: IProtyleLayoutPort = {
    refreshOutline(rootId: string, notebookId?: string) {
        if (isMobile) {
            return;
        }
        getAllModels().outline.forEach(item => {
            if (item.blockId !== rootId) {
                return;
            }
            fetchPost("/api/outline/getDocOutline", withEncryptedNotebook(notebookId || "", {
                id: item.blockId,
                preview: item.isPreview,
            }), response => item.update(response));
        });
    },
    refreshDatabaseRows(avID: string) {
        if (isMobile) {
            return;
        }
        getAllModels().custom.forEach((item) => {
            if (item.type === "siyuan-database-row" && (item.data.avID === avID ||
                item.element.querySelector(`[data-av-id="${avID}"]`))) {
                item.update?.();
            }
        });
    },
    updateOutline(protyle: IProtyle, reload: boolean) {
        if (isMobile) {
            return;
        }
        updateOutlineForModels(getAllModels(), protyle, reload);
    },
    setOutlineCurrent(protyle: IProtyle, element: Element, preview: boolean) {
        if (isMobile) {
            return;
        }
        getAllModels().outline.forEach(item => {
            if (item.blockId !== protyle.block.rootID) {
                return;
            }
            if (preview) {
                item.setCurrentByPreview(element);
            } else if (element instanceof HTMLElement) {
                item.setCurrent(element);
            }
        });
    },
    refreshBacklink(protyle: IProtyle) {
        if (isMobile) {
            return;
        }
        getAllModels().backlink.find(backlinkItem => {
            if (!backlinkItem.element.contains(protyle.element)) {
                return false;
            }
            backlinkItem.refresh();
            return true;
        });
    },
    updatePanel(protyle: IProtyle, options: IProtyleLayoutUpdateOptions) {
        return updatePanelByEditor({protyle, ...options}, getDockByType("file"));
    },
    focus(protyle: IProtyle): IProtyleLayoutFocusResult {
        if (isMobile || !protyle.model) {
            return {handled: false, needsUpdate: false};
        }
        const wndElement = protyle.model.element.parentElement?.parentElement;
        if (!wndElement) {
            return {handled: false, needsUpdate: false};
        }
        const isActive = wndElement.classList.contains("layout__wnd--active") &&
            protyle.model.headElement.classList.contains("item--focus");
        if (!isActive) {
            setPanelFocus(wndElement);
        }
        return {handled: true, needsUpdate: !isActive};
    },
    clearFocus() {
        document.querySelectorAll(".layout__tab--active").forEach(item => item.classList.remove("layout__tab--active"));
        document.querySelectorAll(".layout__wnd--active").forEach(item => item.classList.remove("layout__wnd--active"));
    },
    updateTitle(protyle: IProtyle, title: string, empty: boolean) {
        protyle.model?.parent?.updateTitle(title, empty);
    },
    removeTab(protyle: IProtyle) {
        const model = protyle.model;
        if (!model?.parent?.parent) {
            return;
        }
        model.parent.parent.removeTab(model.parent.id);
    },
    clearBeforeResizeTop() {
        if (isMobile) {
            return;
        }
        getAllModels().editor.forEach((item) => {
            if (item.editor && item.editor.protyle &&
                item.element.parentElement && !item.element.classList.contains("fn__none")) {
                item.editor.protyle.wysiwyg.element.querySelector("[data-resize-top]")?.removeAttribute("data-resize-top");
            }
        });
    },
    recordBeforeResizeTop() {
        if (isMobile) {
            return;
        }
        getAllModels().editor.forEach((item) => {
            if (item.editor && item.editor.protyle &&
                item.element.parentElement && !item.element.classList.contains("fn__none")) {
                item.editor.protyle.wysiwyg.element.querySelector("[data-resize-top]")?.removeAttribute("data-resize-top");
                const contentRect = item.editor.protyle.contentElement.getBoundingClientRect();
                let topElement = document.elementFromPoint(contentRect.left + (contentRect.width / 2), contentRect.top);
                if (hasClosestByClassName(topElement, "b3-menu")) {
                    window.siyuan.menus.menu.remove();
                    topElement = document.elementFromPoint(contentRect.left + (contentRect.width / 2), contentRect.top);
                }
                if (!topElement) {
                    topElement = document.elementFromPoint(contentRect.left + (contentRect.width / 2), contentRect.top + 17);
                }
                if (!topElement) {
                    return;
                }
                topElement = hasClosestBlock(topElement) as HTMLElement;
                if (!topElement) {
                    return;
                }
                topElement.setAttribute("data-resize-top", (contentRect.top - topElement.getBoundingClientRect().top).toString());
            }
        });
    },
    findBlockCopies(blockId: string) {
        if (isMobile) {
            return [];
        }
        const copies: Element[] = [];
        getAllModels().editor.forEach(editor => {
            const copy = editor.editor.protyle.wysiwyg.element.querySelector(`[data-node-id="${blockId}"]`);
            if (copy) {
                copies.push(copy);
            }
        });
        window.siyuan.blockPanels.forEach(item => {
            const copy = item.element.querySelector(`[data-node-id="${blockId}"]`);
            if (copy) {
                copies.push(copy);
            }
        });
        return copies;
    },
    removeBacklinkEditor(protyle: IProtyle, backlinkElement: Element) {
        if (isMobile) {
            return;
        }
        const backLinkTab = getInstanceById(backlinkElement.getAttribute("data-id"), window.siyuan.layout.layout);
        if (!(backLinkTab instanceof Tab) || !(backLinkTab.model instanceof Backlink)) {
            return;
        }
        const editors = backLinkTab.model.editors;
        editors.find((item, index) => {
            if (item.protyle.element !== protyle.element) {
                return false;
            }
            item.destroy();
            editors.splice(index, 1);
            item.protyle.element.previousElementSibling?.remove();
            item.protyle.element.remove();
            return true;
        });
    },
    findProtyleForElement(element: Element, match: "contains" | "wysiwyg") {
        if (isMobile) {
            return undefined;
        }
        return getAllEditor().find(item => match === "wysiwyg"
            ? item.protyle.wysiwyg.element === element
            : item.protyle.element.contains(element))?.protyle;
    },
};

/** 在完整 App 入口加载时注册布局适配器；独立入口不会加载此模块。 */
export const registerSiyuanProtyleLayoutPort = () => {
    setProtyleLayoutPort(appLayoutPort);
};

registerSiyuanProtyleLayoutPort();
