import { Tab } from "../../Tab";
import { Model } from "../../Model";
import { Tree } from "../../../util/Tree";
import { fetchPost } from "../../../util/fetch";
import { Constants } from "../../../constants";
import { escapeHtml } from "../../../util/escape";
import { unicode2Emoji } from "../../../emoji";
import { getPreviousBlock } from "../../../protyle/wysiwyg/getBlock";
import { App } from "../../../index";
import { Editor } from "../../../editor";

// 拆分模块导入
import { bindSort } from "./Outline.sort";
import { setFilter, getHeadingLevel, expandToLevel, showExpandLevelMenu, collapseSameLevel, collapseChildren } from "./Outline.filter";
import { showContextMenu, genHeadingTransform, getProtyleAndBlockElement } from "./Outline.contextMenu";
import { initInputEvents, initTree } from "./Outline.init";
import { initHeaderEvents } from "./Outline.header";
import { 生成面板HTML, 创建回调函数, 创建消息回调函数 } from "./Outline.helpers";

export class Outline extends Model {
    public tree: Tree;
    public element: HTMLElement;
    public headerElement: HTMLElement;
    public type: "pin" | "local";
    public blockId: string;
    public isPreview: boolean;
    public preFilterExpandIds: string[] | null = null;

    // 绑定拆分模块的方法
    bindSort = bindSort;
    setFilter = setFilter;
    getHeadingLevel = getHeadingLevel;
    expandToLevel = expandToLevel;
    showExpandLevelMenu = showExpandLevelMenu;
    collapseSameLevel = collapseSameLevel;
    collapseChildren = collapseChildren;
    showContextMenu = showContextMenu;
    genHeadingTransform = genHeadingTransform;
    getProtyleAndBlockElement = getProtyleAndBlockElement;
    initInputEvents = initInputEvents;
    initTree = initTree;
    initHeaderEvents = initHeaderEvents;

    constructor(options: { app: App, tab: Tab, blockId: string, type: "pin" | "local", isPreview: boolean }) {
        super({
            app: options.app,
            id: options.tab.id,
            callback: 创建回调函数(),
            msgCallback: 创建消息回调函数(),
        });
        this.isPreview = options.isPreview;
        this.blockId = options.blockId;
        this.type = options.type;
        options.tab.panelElement.classList.add("fn__flex-column", "file-tree", "sy__outline");
        options.tab.panelElement.innerHTML = 生成面板HTML(this.type);
        this.element = options.tab.panelElement.lastElementChild as HTMLElement;
        this.headerElement = options.tab.panelElement.firstElementChild as HTMLElement;

        this.initInputEvents();
        this.initTree(options);
        this.initHeaderEvents(options);
        this.bindSort();

        fetchPost("/api/outline/getDocOutline", { id: this.blockId, preview: this.isPreview }, response => {
            this.update(response);
            if (this.blockId) {
                this.updateDocTitle((options.tab.model as Editor)?.editor?.protyle?.background?.ial, response.data?.length || 0);
            }
        });
    }



    public updateDocTitle(ial?: IObject, count?: number) {
        const docTitleElement = this.headerElement.nextElementSibling as HTMLElement;
        if (this.type === "pin") {
            if (!ial && typeof count === "undefined") {
                docTitleElement.classList.add("fn__none");
                return;
            }
            if (ial) {
                let iconHTML = `${unicode2Emoji(ial.icon || window.siyuan.storage[Constants.LOCAL_IMAGES].file, "b3-list-item__graphic", true)}`;
                if (ial.icon === Constants.ZWSP && docTitleElement.firstElementChild) {
                    iconHTML = docTitleElement.firstElementChild.outerHTML;
                }
                docTitleElement.innerHTML = `${iconHTML}<span class="b3-list-item__text">${escapeHtml(ial.title)}</span>${docTitleElement.querySelector(".counter")?.outerHTML || ""}`;
                docTitleElement.setAttribute("title", ial.title);
                docTitleElement.classList.remove("fn__none");
            }
            if (typeof count === "number" && count !== -1) {
                const counterElement = docTitleElement.querySelector(".counter") as HTMLElement;
                if (count > 0) {
                    if (counterElement) {
                        counterElement.textContent = count.toString();
                    } else {
                        docTitleElement.insertAdjacentHTML("beforeend", `<span class="counter">${count.toString()}</span>`);
                    }
                } else {
                    counterElement?.remove();
                }
            }
        } else {
            docTitleElement.classList.add("fn__none");
        }
    }



    public setCurrent(nodeElement: HTMLElement) {
        if (!nodeElement) {
            return;
        }
        if (nodeElement.getAttribute("data-type") === "NodeHeading") {
            this.setCurrentById(nodeElement.getAttribute("data-node-id"));
        } else {
            let previousElement = getPreviousBlock(nodeElement);
            while (previousElement) {
                if (previousElement.getAttribute("data-type") === "NodeHeading") {
                    break;
                }
                previousElement = getPreviousBlock(previousElement);
            }
            if (previousElement) {
                this.setCurrentById(previousElement.getAttribute("data-node-id"));
            } else {
                fetchPost("/api/block/getBlockBreadcrumb", { id: nodeElement.getAttribute("data-node-id"), excludeTypes: [] }, (response) => {
                    response.data.reverse().find((item: IBreadcrumb) => {
                        if (item.type === "NodeHeading") {
                            this.setCurrentById(item.id);
                            return true;
                        }
                    });
                });
            }
        }
    }

    public setCurrentByPreview(nodeElement: Element) {
        if (!nodeElement) {
            return;
        }
        let previousElement = nodeElement;
        while (previousElement && !previousElement.classList.contains("b3-typography")) {
            if (["H1", "H2", "H3", "H4", "H5", "H6"].includes(previousElement.tagName)) {
                break;
            }
            previousElement = previousElement.previousElementSibling || previousElement.parentElement;
        }
        if (previousElement && previousElement.id) {
            this.setCurrentById(previousElement.id);
        }
    }

    public setCurrentById(id: string) {
        this.element.querySelectorAll(".b3-list-item.b3-list-item--focus").forEach(item => item.classList.remove("b3-list-item--focus"));
        let currentElement = this.element.querySelector(`.b3-list-item[data-node-id="${id}"]`) as HTMLElement;
        if (!currentElement) {
            return;
        }
        if (window.siyuan.storage[Constants.LOCAL_OUTLINE].keepCurrentExpand) {
            let ulElement = currentElement.parentElement;
            while (ulElement && !ulElement.classList.contains("b3-list") && ulElement.tagName === "UL") {
                ulElement.classList.remove("fn__none");
                ulElement.previousElementSibling.querySelector(".b3-list-item__arrow").classList.add("b3-list-item__arrow--open");
                ulElement = ulElement.parentElement;
            }
            this.saveExpendIds();
        } else {
            while (currentElement && currentElement.clientHeight === 0) {
                currentElement = currentElement.parentElement.previousElementSibling as HTMLElement;
            }
        }
        if (currentElement) {
            currentElement.classList.add("b3-list-item--focus");
            const elementRect = this.element.getBoundingClientRect();
            this.element.scrollTop = this.element.scrollTop + (currentElement.getBoundingClientRect().top - (elementRect.top + elementRect.height / 2));
        }
    }

    public update(data: IWebSocketData, callbackId?: string) {
        let currentElement = this.element.querySelector(".b3-list-item--focus");
        let currentId;
        if (currentElement) {
            currentId = currentElement.getAttribute("data-node-id");
        }
        const scrollTop = this.element.scrollTop;
        if (typeof callbackId !== "undefined") {
            this.blockId = callbackId;
        }
        this.tree.updateData(data.data);
        if (this.isPreview) {
            this.tree.element.querySelectorAll(".popover__block").forEach(item => item.classList.remove("popover__block"));
            this.element.scrollTop = scrollTop;
        } else if (this.blockId) {
            if ((this.headerElement.querySelector("input.b3-text-field.search__label") as HTMLInputElement).value) {
                this.setFilter();
            }
            this.element.scrollTop = scrollTop;
        }
        if (currentId) {
            currentElement = this.element.querySelector(`[data-node-id="${currentId}"]`);
            if (currentElement) {
                currentElement.classList.add("b3-list-item--focus");
            }
        }
        this.element.removeAttribute("data-loading");
    }

    public saveExpendIds() {
        if (window.siyuan.config.readonly || window.siyuan.isPublish) {
            return;
        }
        if (!this.isPreview && this.type === "pin") {
            fetchPost("/api/storage/setOutlineStorage", { docID: this.blockId, val: { expandIds: this.tree.getExpandIds() } });
        }
    }
}
