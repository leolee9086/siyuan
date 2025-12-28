/**
 * Outline 构造函数初始化逻辑
 * 从 Outline.ts 拆分出来以保持单文件行数限制
 */
import { Tree } from "../../../util/Tree";
import { getInstanceById } from "../../util";
import { Tab } from "../../Tab";
import { hasClosestByClassName, hasTopClosestByClassName } from "../../../protyle/util/hasClosest";
import { openFileById } from "../../../editor/utils.openFileById";
import { Constants } from "../../../constants";
import { checkFold } from "../../../util/noRelyPCFunction";
import { escapeAttr } from "../../../util/escape";
import { App } from "../../../index";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import type { Outline } from "./Outline";

/**
 * 初始化搜索输入框事件
 */
export function initInputEvents(this: Outline) {
    const inputElement = this.headerElement.querySelector("input.b3-text-field.search__label") as HTMLInputElement;
    inputElement.addEventListener("blur", () => {
        inputElement.classList.add("fn__none");
        const filterIconElement = inputElement.nextElementSibling as HTMLElement;
        const value = inputElement.value;
        if (value) {
            filterIconElement.classList.add("block__icon--active");
            filterIconElement.setAttribute("aria-label", siyuanI18n.filter + " " + escapeAttr(value));
        } else {
            filterIconElement.classList.remove("block__icon--active");
            filterIconElement.setAttribute("aria-label", siyuanI18n.filter);
        }
        if (inputElement.dataset.value !== value) {
            this.setFilter();
        }
    });
    inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        if (!event.isComposing && event.key === "Enter") {
            inputElement.dataset.value = inputElement.value;
            this.setFilter();
        }
    });
}

/**
 * 初始化 Tree 组件
 */
export function initTree(this: Outline, options: { app: App, tab: Tab, blockId: string, type: "pin" | "local", isPreview: boolean }) {
    this.tree = new Tree({
        element: this.element,
        data: null,
        click: (element: HTMLElement) => {
            const id = element.getAttribute("data-node-id");
            if (this.isPreview) {
                const headElement = document.getElementById(id);
                if (headElement) {
                    const tabElement = hasTopClosestByClassName(headElement, "protyle");
                    if (tabElement) {
                        const tab = getInstanceById(tabElement.getAttribute("data-id")) as Tab;
                        tab.parent.switchTab(tab.headElement);
                    }
                    headElement.scrollIntoView();
                } else {
                    openFileById({ app: options.app, id: this.blockId, mode: "preview" });
                }
            } else {
                checkFold(id, (zoomIn) => {
                    openFileById({
                        app: options.app,
                        id,
                        scrollPosition: "start",
                        action: zoomIn
                            ? [Constants.CB_GET_FOCUS, Constants.CB_GET_ALL, Constants.CB_GET_HTML, Constants.CB_GET_OUTLINE]
                            : [Constants.CB_GET_FOCUS, Constants.CB_GET_OUTLINE, Constants.CB_GET_SETID, Constants.CB_GET_CONTEXT, Constants.CB_GET_HTML],
                    });
                });
            }
        },
        ctrlClick: (element: HTMLElement, event) => {
            const arrowElement = hasClosestByClassName(event.target as Element, "b3-list-item__toggle");
            if (arrowElement && !arrowElement.classList.contains("fn__hidden")) {
                this.collapseChildren(element);
                return;
            }
            const id = element.getAttribute("data-node-id");
            openFileById({ app: options.app, id, action: [Constants.CB_GET_FOCUS, Constants.CB_GET_ALL, Constants.CB_GET_HTML], zoomIn: true });
        },
        altClick: (element: HTMLElement, event: MouseEvent) => {
            const arrowElement = hasClosestByClassName(event.target as HTMLElement, "b3-list-item__toggle");
            if (arrowElement) {
                this.collapseSameLevel(element);
            }
        },
        rightClick: (element: HTMLElement, event: MouseEvent) => {
            this.showContextMenu(element, event);
        },
        toggleClick: (liElement) => {
            if (!liElement.nextElementSibling) {
                return;
            }
            const svgElement = liElement.firstElementChild.firstElementChild;
            if (svgElement.classList.contains("b3-list-item__arrow--open")) {
                svgElement.classList.remove("b3-list-item__arrow--open");
                liElement.nextElementSibling.classList.add("fn__none");
                if (liElement.nextElementSibling.nextElementSibling && liElement.nextElementSibling.nextElementSibling.tagName === "UL") {
                    liElement.nextElementSibling.nextElementSibling.classList.add("fn__none");
                }
            } else {
                svgElement.classList.add("b3-list-item__arrow--open");
                liElement.nextElementSibling.classList.remove("fn__none");
                if (liElement.nextElementSibling.nextElementSibling && liElement.nextElementSibling.nextElementSibling.tagName === "UL") {
                    liElement.nextElementSibling.nextElementSibling.classList.remove("fn__none");
                }
            }
            this.saveExpendIds();
        }
    });
}
