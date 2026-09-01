/**
 * 替代关系：本模块是原 `layout/dock/Outline.ts` 中 `Outline` 类的唯一现行所有者。
 */
import { Model } from "../../Model";
/** 用途：提供 Outline 所属页签的布局领域抽象；使用范围：Model 父级和构造参数；解耦评估：依赖布局根契约可切断对具体 Tab class 的类型边，具体 Tab 仅在组合根传入。 */
import type {LayoutTab} from "../../layout.types";
import { Tree } from "../../../util/file/tree/Tree";
import { fetchPost } from "../../../util/network/fetch";
import { Constants } from "../../../constants";
import { escapeHtml } from "../../../util/DOM/escape";
import { unicode2Emoji } from "../../../emoji";
import type {AppFacade} from "../../../app/AppFacade.types";
import {isEditorDomain} from "../../../editor/model/editorDomain.types";
import { hasClosestBlock } from "../../../protyle/util/hasClosest";

// 拆分模块导入
import { bindSort } from "./Outline.sort";
import { setFilter } from "./Outline.filter";
import { expandToLevel, showExpandLevelMenu, collapseSameLevel, collapseChildren } from "./Outline.expand";
import { showContextMenu, genHeadingTransform, getProtyleAndBlockElement } from "./Outline.contextMenu";
import { initInputEvents, createTreeConfig } from "./Outline.init";
import { initHeaderEvents } from "./Outline.header";
import { 生成面板HTML, 检查本地文档及其Tab存在的逻辑, 分发消息回调逻辑 } from "./Outline.helpers";
import { isHTMLElement, isHTMLInputElement } from "../../../util/DOM/element.guard";
import { setCurrent, setCurrentById, setCurrentByPreview } from "./Outline.setCurrent";
import { getSafeSiyuanConfig, getSafeSiyuanStorage, getSiyuanIsPublish } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import {getDockByType} from "../../query/dockByType";
import type {OutlineDomain} from "./types";
import type {TreeDomain} from "./types";
import {outlineModelBrand} from "./types";
export class Outline extends Model<AppFacade, LayoutTab> {
    public override parent: LayoutTab;

    public get [outlineModelBrand]() {
        return "Outline" as const;
    }

    public tree!: TreeDomain;
    public element: HTMLElement;
    public headerElement: HTMLElement;
    public type: "pin" | "local";
    public blockId: string;
    public isPreview: boolean;
    public preFilterExpandIds: string[] | null = null;

    // 绑定拆分模块的方法
    bindSort = () => bindSort(this);
    setFilter = () => setFilter(this);

    expandToLevel = (targetLevel: number) => expandToLevel(this, targetLevel);
    showExpandLevelMenu = (target: HTMLElement) => showExpandLevelMenu(this, target);
    collapseSameLevel = (element: HTMLElement, expand?: boolean) => collapseSameLevel(this, element, expand);
    collapseChildren = (element: HTMLElement, expand?: boolean) => collapseChildren(this, element, expand);
    minimize = () => getDockByType("outline")?.toggleModel("outline", false, true);
    /**
     * 作用：显示大纲条目的上下文菜单。
     * 意图：代理调用外部的 showContextMenu 函数，传入当前实例上下文。
     * 调用时机：用户右键点击大纲条目时。
     * @param element 触发菜单的目标元素。
     * @param event 鼠标事件对象。
     */
    showContextMenu = (element: HTMLElement, event: MouseEvent) => {
        showContextMenu(this, element, event);
    };
    genHeadingTransform = genHeadingTransform;
    getProtyleAndBlockElement = (node: Node) => {
        const blockElement = hasClosestBlock(node);
        return blockElement ? getProtyleAndBlockElement(this, blockElement) : undefined;
    };

    initHeaderEvents = initHeaderEvents;

    /**
     * 作用：Model 回调代理
     * 意图：响应 Model 的连接回调，检查大纲有效性
     * 调用时机：WebSocket 连接建立时
     */
    public onModelCallback(): void {
        检查本地文档及其Tab存在的逻辑(this);
    }

    /**
     * 作用：Model 消息回调代理
     * 意图：分发 WebSocket 消息到大纲处理器
     * 调用时机：收到 WebSocket 消息时
     * @param data 消息数据
     */
    public onModelMsgCallback(data: IWebSocketData): void {
        分发消息回调逻辑(this, data);
    }

    /**
     * 作用：创建 Outline 实例。
     * 意图：初始化大纲面板，绑定事件，并根据类型渲染内容。
     * @param options 包含应用实例、标签页、块 ID 等配置信息。
     */
    constructor(options: { app: AppFacade, tab: LayoutTab, blockId: string, type: "pin" | "local", isPreview: boolean }) {
        super({app: options.app});
        this.parent = options.tab;
        this.connect({
            id: options.tab.id,
            type: "outline",
            callback: Outline.prototype.onModelCallback,
            msgCallback: Outline.prototype.onModelMsgCallback,
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

        initInputEvents(this);
        this.tree = new Tree(createTreeConfig(this, options.app));
        initHeaderEvents(this, options);
        this.bindSort();

        // @内联回调
        fetchPost("/api/outline/getDocOutline", { id: this.blockId, preview: this.isPreview }, response => {
            this.update(response);
            /**
             * 作用：更新文档标题。
             * 意图：当 blockId 有效时，获取当前编辑器背景属性(ial)并更新标题和计数。
             * 生效场景：this.blockId 存在且非空。
             */
            if (this.blockId) {
                const tabModel = options.tab.model;
                const ial = tabModel && isEditorDomain(tabModel)
                    ? tabModel.editor.protyle.background?.ial
                    : undefined;
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
    public updateDocTitle(ial?: IObject, count?: number): void {
        const docTitleElement = this.headerElement.nextElementSibling;
        /**
         * 作用：确保标题元素存在。
         * 意图：如果找不到 docTitleElement，则无法更新标题，直接返回。
         * 生效场景：docTitleElement 不是有效的 HTML 元素。
         */
        if (!isHTMLElement(docTitleElement)) {
            return;
        }
        /**
         * 作用：根据大纲类型判断是否显示文档标题信息。
         * 意图：仅在 "pin" 模式下显示文档图标和标题；其他模式下隐藏该区域。
         * 生效场景：this.type 为 "pin" 时处理显示逻辑，否则隐藏。
         */
        if (this.type !== "pin") {
            docTitleElement.classList.add("fn__none");
            return;
        }

        /**
         * 作用：检查标题更新所需的数据完整性。
         * 意图：如果 ial 和 count 都缺失，隐藏标题栏以避免显示空白或错误状态。
         * 生效场景：ial 为假值且 count 为 undefined。
         */
        if (!ial && typeof count === "undefined") {
            docTitleElement.classList.add("fn__none");
            return;
        }
        if (ial) {
            const localImages = getSafeSiyuanStorage()?.[Constants.LOCAL_IMAGES];
            const iconHTML = (ial.icon === Constants.ZWSP && docTitleElement.firstElementChild) ?
                docTitleElement.firstElementChild.outerHTML :
                `${unicode2Emoji(ial.icon || localImages?.file || "", "b3-list-item__graphic", true)}`;
            const title = String(ial.title || "");

            const counter = docTitleElement.querySelector(".counter");
            docTitleElement.innerHTML = `${iconHTML}<span class="b3-list-item__text">${escapeHtml(title)}</span>${counter?.outerHTML || ""}`;
            docTitleElement.setAttribute("title", title);
            docTitleElement.classList.remove("fn__none");
        }

        updateCounter(docTitleElement, count);
    }





    setCurrent = (nodeElement: HTMLElement) => {
        setCurrent(this, nodeElement);
    };

    setCurrentByPreview = (nodeElement: Element) => {
        setCurrentByPreview(this, nodeElement);
    };

    setCurrentById = (id: string) => {
        setCurrentById(this, id);
    };

    /**
     * 作用：更新大纲树的数据并刷新视图。
     * 意图：接收 WebSocket 或请求返回的数据，刷新树结构，同时保留滚动位置和高亮状态，必要时恢复搜索过滤。
     * 调用时机：收到后端大纲数据更新时。
     * @param data 包含大纲数据的对象。
     * @param callbackId 可选的回调 ID，用于更新 blockId。
     */
    public update(data: IWebSocketData, callbackId?: string): void {
        const currentElement = this.element.querySelector(".b3-list-item--focus");
        let currentId;
        /**
         * 作用：获取当前获得焦点的节点 ID。
         * 意图：记录更新前的焦点状态，以便在数据更新后恢复。
         * 生效场景：DOM 中存在获得焦点的 .b3-list-item--focus 元素。
         */
        if (currentElement) {
            currentId = currentElement.getAttribute("data-node-id");
        }
        const scrollTop = this.element.scrollTop;
        /**
         * 作用：更新 blockId。
         * 意图：当回调中提供了新的 ID 时，更新当前大纲绑定的块 ID。
         * 生效场景：callbackId 非 undefined。
         */
        if (typeof callbackId !== "undefined") {
            this.blockId = callbackId;
        }
        this.tree.updateData(data.data);
        /**
         * 作用：处理预览模式下的特定清理逻辑。
         * 意图：在更新内容前清理弹出的气泡元素，并保持滚动位置。
         * 生效场景：当前处于预览模式 (this.isPreview 为 true)。
         */
        if (this.isPreview) {
            const popoverElements = this.tree.element.querySelectorAll(".popover__block");
            for (const item of popoverElements) {
                item.classList.remove("popover__block");
            }
            this.element.scrollTop = scrollTop;
        }

        /**
         * 作用：处理非预览模式下的刷新逻辑。
         * 意图：在普通编辑器模式下，需要恢复搜索状态并保持滚动位置。
         * 生效场景：当前不是预览模式，且 blockId 有效时。
         */
        if (!this.isPreview && this.blockId) {
            restoreFilter(this);
            this.element.scrollTop = scrollTop;
        }
        /**
         * 作用：恢复大纲条目的焦点状态。
         * 意图：根据更新前记录的 ID，重新高亮对应的节点，保持用户视觉焦点。
         * 生效场景：currentId 存在（之前有选中的节点）。
         */
        if (currentId) {
            const node = this.element.querySelector(`[data-node-id="${currentId}"]`);
            node?.classList.add("b3-list-item--focus");
        }
        this.element.removeAttribute("data-loading");
    }



    /**
     * 作用：持久化保存大纲节点的展开状态。
     * 意图：将当前展开的节点 ID 列表发送给后端保存，以便下次重新加载文档时恢复展开状态。
     * 调用时机：在某些交互操作后或自动展开逻辑完成后调用。
     */
    public saveExpendIds(): void {
        /**
         * 作用：只读模式拦截。
         * 意图：如果是只读或发布模式，禁止保存展开状态以避免副作用。
         * 生效场景：配置为 readonly 或 isPublish。
         */
        if (getSafeSiyuanConfig()?.readonly || getSiyuanIsPublish()) {
            return;
        }
        /**
         * 作用：判断是否需要保存展开状态。
         * 意图：仅在 "pin" 模式且非预览状态下，才持久化保存节点的展开状态。
         * 生效场景：非预览模式且为 "pin" 类型时。
         */
        if (!this.isPreview && this.type === "pin") {
            fetchPost("/api/storage/setOutlineStorage", { docID: this.blockId, val: { expandIds: this.tree.getExpandIds() } });
        }
    }

    /**
     * S-forge: 上游新增 - 重新加载大纲数据 (#16041)
     * 作用：重新从服务器获取大纲数据并更新UI
     * 意图：支持发布访问控制等场景下的大纲刷新
     * 调用时机：需要强制刷新大纲内容时
     * @param blockId 可选的块ID，默认使用当前blockId
     */
    public reload(blockId?: string): void {
        if (!blockId) {
            blockId = this.blockId;
        }
        // @内联回调 - 回调逻辑简单，处理大纲数据更新
        fetchPost("/api/outline/getDocOutline", {
            id: blockId,
            preview: this.isPreview
        }, response => {
            // 文档切换后不再更新原有推送 https://github.com/siyuan-note/siyuan/issues/13409
            if (blockId !== this.blockId) {
                return;
            }
            this.update(response);
            const selection = getSelection();
            if (!selection || selection.rangeCount === 0) {
                return;
            }
            const result = this.getProtyleAndBlockElement(selection.getRangeAt(0).startContainer);
            if (result?.blockElement?.getAttribute("data-type") !== "NodeHeading") {
                return;
            }
            this.setCurrent(result.blockElement);
        });
    }
}

/**
 * 作用：更新或移除计数器显示。
 * 意图：根据 count 值更新、创建或移除计数器元素。
 * @param docTitleElement 标题元素
 * @param count 计数
 */
const updateCounter = (docTitleElement: Element, count?: number): void => {
    /**
     * 作用：参数合法性检查。
     * 意图：如果 count 不是数字，无法进行计数更新操作，直接返回。
     * 生效场景：count 参数类型不为 number。
     */
    if (typeof count !== "number") {
        return;
    }

    const counterElement = docTitleElement.querySelector(".counter");

    /**
     * 作用：更新现有计数器。
     * 意图：如果计数器已存在且 count > 0，直接修改文本。
     * 生效场景：count > 0 && 存在 .counter 元素
     */
    if (count > 0 && isHTMLElement(counterElement)) {
        counterElement.textContent = count.toString();
        return;
    }

    /**
     * 作用：创建新计数器。
     * 意图：如果计数器不存在且 count > 0，插入新元素。
     * 生效场景：count > 0 && 不存在 .counter 元素
     */
    if (count > 0) {
        docTitleElement.insertAdjacentHTML("beforeend", `<span class="counter">${count.toString()}</span>`);
        return;
    }

    /**
     * 作用：移除计数器。
     * 意图：如果计数不为 -1 且不大于 0，移除计数器。
     * 生效场景：count !== -1 (implicit count <= 0) && 存在 .counter 元素
     */
    if (count !== -1 && counterElement) {
        counterElement.remove();
    }
};

/**
 * 作用：在非预览模式下刷新时恢复搜索过滤。
 * 意图：当搜索框存在（且为 HTMLInputElement）且用户已输入内容时，重新应用过滤。
 * @param outline Outline 实例
 */
function restoreFilter(outline: OutlineDomain): void {
    const searchInput = outline.headerElement.querySelector("input.b3-text-field.search__label");
    /**
     * 作用：检查搜索框是否有值。
     * 意图：只有当搜索框存在且有输入内容时才恢复过滤。
     * 生效场景：searchInput 为 HTMLInputElement 且 value 不为空。
     */
    if (isHTMLInputElement(searchInput) && searchInput.value) {
        outline.setFilter();
    }
}
