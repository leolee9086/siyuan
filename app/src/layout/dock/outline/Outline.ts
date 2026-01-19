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
import { isHTMLElement, isHTMLInputElement } from "../../../util/DOM/element.guard";

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
    showContextMenu = (element: HTMLElement, event: MouseEvent) => {
        showContextMenu(this, element, event);
    };
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
        const lastElement = options.tab.panelElement.lastElementChild;
        /**
         * 作用：确保大纲面板的容器元素已被正确渲染且为 HTMLElement。
         * 意图：初始化 Outline 类实例的 element 属性。
         * 生效场景：当 options.tab.panelElement 包含预期的最后一个子元素时。
         */
        this.element = isHTMLElement(lastElement) ? lastElement : document.createElement("div");
        const firstElement = options.tab.panelElement.firstElementChild;
        /**
         * 作用：确保大纲面板的头部元素已被正确渲染且为 HTMLElement。
         * 意图：初始化 Outline 类实例的 headerElement 属性。
         * 生效场景：当 options.tab.panelElement 包含预期的第一个子元素时。
         */
        this.headerElement = isHTMLElement(firstElement) ? firstElement : document.createElement("div");

        this.initInputEvents();
        this.initTree(options);
        this.initHeaderEvents(options);
        this.bindSort();

        // @内联回调
        fetchPost("/api/outline/getDocOutline", { id: this.blockId, preview: this.isPreview }, response => {
            this.update(response);
            if (this.blockId) {
                const ial = (options.tab.model instanceof Editor) ? options.tab.model.editor?.protyle?.background?.ial : undefined;
                this.updateDocTitle(ial, response.data?.length || 0);
            }
        });
    }



    /**
     * 作用：更新大纲面板顶部的文档标题和统计计数。
     * 意图：根据传入的文档属性和条目数量，刷新面板头部的图标、标题及计数显示，主要用于 PIN 模式下的文档信息展示。
     * 调用时机：初始化获取大纲数据回调中，或文档信息变更时。
     * @param ial 文档的属性对象（如 icon, title）。
     * @param count 大纲条目数量。
     */
    public updateDocTitle(ial?: IObject, count?: number) {
        const docTitleElement = this.headerElement.nextElementSibling;
        if (!isHTMLElement(docTitleElement)) {
            return;
        }
        if (this.type === "pin") {
            if (!ial && typeof count === "undefined") {
                docTitleElement.classList.add("fn__none");
                return;
            }
            if (ial) {
                let iconHTML = `${unicode2Emoji(ial.icon || window.siyuan?.storage?.[Constants.LOCAL_IMAGES]?.file || "", "b3-list-item__graphic", true)}`;
                if (ial.icon === Constants.ZWSP && docTitleElement.firstElementChild) {
                    iconHTML = docTitleElement.firstElementChild.outerHTML;
                }
                const counter = docTitleElement.querySelector(".counter");
                docTitleElement.innerHTML = `${iconHTML}<span class="b3-list-item__text">${escapeHtml(ial.title || "")}</span>${counter?.outerHTML || ""}`;
                docTitleElement.setAttribute("title", ial.title || "");
                docTitleElement.classList.remove("fn__none");
            }
            if (typeof count === "number" && count !== -1) {
                const counterElement = docTitleElement.querySelector(".counter");
                if (count > 0) {
                    /**
                     * 作用：更新计数器元素的文本内容。
                     * 意图：当计数器已存在（且为 HTMLElement）时直接更新，否则在 fallback 中创建。
                     * 生效场景：当 docTitleElement 下已存在 .counter 元素时。
                     */
                    if (isHTMLElement(counterElement)) {
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



    /**
     * 作用：根据给定的编辑器节点元素设置大纲高亮。
     * 意图：在大纲中定位并高亮与编辑器当前焦点对应的标题节点，如果当前节点不是标题则向上查找最近的标题。
     * 调用时机：编辑器光标位置变更或点击块时。
     * @param nodeElement 编辑器中的块元素。
     */
    public setCurrent(nodeElement: HTMLElement) {
        if (!nodeElement) {
            return;
        }
        if (nodeElement.getAttribute("data-type") === "NodeHeading") {
            const id = nodeElement.getAttribute("data-node-id");
            if (id) {
                this.setCurrentById(id);
            }
        } else {
            let previousElement = getPreviousBlock(nodeElement);
            while (previousElement) {
                if (previousElement.getAttribute("data-type") === "NodeHeading") {
                    break;
                }
                previousElement = getPreviousBlock(previousElement);
            }
            if (previousElement) {
                const prevId = previousElement.getAttribute("data-node-id");
                if (prevId) {
                    this.setCurrentById(prevId);
                }
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

    /**
     * 作用：在预览模式下根据元素设置大纲高亮。
     * 意图：在预览模式滚动或交互时，同步大纲的高亮状态。
     * 调用时机：预览视图滚动或交互时。
     * @param nodeElement 预览视图中的元素。
     */
    public setCurrentByPreview(nodeElement: Element) {
        if (!nodeElement) {
            return;
        }
        let previousElement: Element | null = nodeElement;
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

    /**
     * 作用：根据 ID 高亮大纲节点并滚动到可视区域。
     * 意图：实现具体的高亮逻辑，包括移除旧高亮、查找新节点、处理自动展开父级以及计算滚动位置。
     * 调用时机：内部调用，或明确知道目标 ID 时调用。
     * @param id 目标大纲节点的 ID。
     */
    public setCurrentById(id: string) {
        const focusElements = this.element.querySelectorAll(".b3-list-item.b3-list-item--focus");
        focusElements.forEach(item => item.classList.remove("b3-list-item--focus"));
        let currentElement = this.element.querySelector(`.b3-list-item[data-node-id="${id}"]`);
        if (!isHTMLElement(currentElement)) {
            return;
        }
        /**
         * 作用：保持当前大纲的展开状态。
         * 意图：当配置了 keepCurrentExpand 时，自动展开当前高亮节点的所有父级，并显示出来。
         * 生效场景：`window.siyuan.storage` 中配置了 `keepCurrentExpand` 为 true。
         */
        if (window.siyuan?.storage?.[Constants.LOCAL_OUTLINE]?.keepCurrentExpand) {
            let ulElement = currentElement.parentElement;
            while (ulElement && !ulElement.classList.contains("b3-list") && ulElement.tagName === "UL") {
                ulElement.classList.remove("fn__none");
                const arrowElement = ulElement.previousElementSibling?.querySelector(".b3-list-item__arrow");
                if (arrowElement) {
                    arrowElement.classList.add("b3-list-item__arrow--open");
                }
                ulElement = ulElement.parentElement;
            }
            this.saveExpendIds();
        } else {
            while (currentElement && currentElement.clientHeight === 0 && currentElement.parentElement) {
                const prev: Element | null = currentElement.parentElement.previousElementSibling;
                if (!isHTMLElement(prev)) {
                    break;
                }
                currentElement = prev;
            }
        }
        if (currentElement) {
            currentElement.classList.add("b3-list-item--focus");
            const elementRect = this.element.getBoundingClientRect();
            this.element.scrollTop = this.element.scrollTop + (currentElement.getBoundingClientRect().top - (elementRect.top + elementRect.height / 2));
        }
    }

    /**
     * 作用：更新大纲树的数据并刷新视图。
     * 意图：接收 WebSocket 或请求返回的数据，刷新树结构，同时保留滚动位置和高亮状态，必要时恢复搜索过滤。
     * 调用时机：收到后端大纲数据更新时。
     * @param data 包含大纲数据的对象。
     * @param callbackId 可选的回调 ID，用于更新 blockId。
     */
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
            const popoverElements = this.tree.element.querySelectorAll(".popover__block");
            popoverElements.forEach(item => item.classList.remove("popover__block"));
            this.element.scrollTop = scrollTop;
        } else if (this.blockId) {
            const searchInput = this.headerElement.querySelector("input.b3-text-field.search__label");
            /**
             * 作用：在非预览模式下刷新时恢复搜索过滤。
             * 意图：当搜索框存在（且为 HTMLInputElement）且用户已输入内容时，重新应用过滤。
             * 生效场景：blockId 存在且搜索框有值时。
             */
            if (isHTMLInputElement(searchInput) && searchInput.value) {
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

    /**
     * 作用：持久化保存大纲节点的展开状态。
     * 意图：将当前展开的节点 ID 列表发送给后端保存，以便下次重新加载文档时恢复展开状态。
     * 调用时机：在某些交互操作后或自动展开逻辑完成后调用。
     */
    public saveExpendIds() {
        if (window.siyuan?.config?.readonly || window.siyuan?.isPublish) {
            return;
        }
        if (!this.isPreview && this.type === "pin") {
            fetchPost("/api/storage/setOutlineStorage", { docID: this.blockId, val: { expandIds: this.tree.getExpandIds() } });
        }
    }
}
