import type {LayoutTab} from "../layout.types";
import {Model} from "../Model";
import {Tree} from "../../util/file/tree/Tree";
import {setPanelFocus} from "../utils/setPanelFocus";
import {getDockByType} from "../query/dockByType";
import {fetchPost} from "../../util/network/fetch";
import {hasClosestByClassName} from "../../protyle/util/hasClosest";
import {openBookmarkMenu} from "../../menus/bookmark";
import type {AppFacade} from "../../app/AppFacade.types";
import {Constants} from "../../constants";
import {checkFold} from "../../block/fold/checkFold";
import {isOperations, isBlockTreeArray} from "./dock.guard";
import {
    getBookmarkPanelHTML, shouldReloadBookmark,
} from "./bookmark.util";
import {BookmarkDropController} from "./bookmarkDrop";
import {filterBookmarkData, getBookmarkFilterKeywords} from "./bookmarkFilter";
import {bookmarkModelBrand} from "./bookmark/bookmark.types";
import type {ProtyleDomain} from "../../protyle/protyle.types";
import type {TreeDomain} from "../../util/file/tree.types";
import {setDragTipGhost} from "../../protyle/util/dragTip";

export class Bookmark extends Model<AppFacade, LayoutTab> {
    public override parent: LayoutTab;

    public get [bookmarkModelBrand]() {
        return "Bookmark" as const;
    }

    private openNodes: string[] | undefined;
    private preFilterOpenNodes: string[] | undefined;
    private data: IBlockTree[] = [];
    private updating = false;
    private updatePending = false;
    private dropController: BookmarkDropController;
    public tree: TreeDomain;
    public editors: ProtyleDomain[] = [];
    private element: HTMLElement;

    constructor(app: AppFacade, tab: LayoutTab) {
        super({app});
        this.parent = tab;
        this.connect({id: tab.id, type: "bookmark", msgCallback: (data) => this._处理消息(data)});
        this.element = tab.panelElement;
        this._初始化外观();
        this.tree = this._生成树对象(app);
        this.dropController = new BookmarkDropController({element: this.tree.element, onChanged: () => this.update()});
        this.dropController.bind();
        this._绑定事件();
        this.update();
    }

    private _处理消息(data: IWebSocketData) {
        if (!data) {
            return;
        }
        if (data.cmd === "transactions") {
            this._处理事务(data);
            return;
        }
        const changesNotebook = data.cmd === "closeBox" || data.cmd === "removeBox" || data.cmd === "unmount" ||
            data.cmd === "removeDoc" || data.cmd === "mount";
        if (changesNotebook && (data.cmd !== "mount" || data.code !== 1)) {
            this.update();
        }
    }

    private _处理事务(data: IWebSocketData) {
        const operations = Array.isArray(data.data) ? data.data[0]?.doOperations : undefined;
        if (isOperations(operations) && operations.some(shouldReloadBookmark)) {
            this.update();
        }
    }

    private _初始化外观() {
        this.element.classList.add("fn__flex-column", "file-tree", "sy__bookmark", "dockPanel");
        this.element.innerHTML = getBookmarkPanelHTML();
    }

    private _生成树对象(app: AppFacade): Tree {
        const treeElement = this.element.lastElementChild;
        if (!(treeElement instanceof HTMLElement)) {
            throw new Error("bookmark tree element not found");
        }
        return new Tree({
            element: treeElement,
            data: [],
            click: (element: HTMLElement, event?: MouseEvent) => this._onTreeClick(app, element, event),
            rightClick: (element: HTMLElement, event: MouseEvent) => openBookmarkMenu(element, event, this),
            ctrlClick: (element: HTMLElement) => Bookmark._onTreeCtrlClick(app, element),
            altClick: (element: HTMLElement) => Bookmark._onTreeAltShiftClick(app, element),
            shiftClick: (element: HTMLElement) => Bookmark._onTreeAltShiftClick(app, element),
            blockExtHTML: '<span class="b3-list-item__action"><svg><use xlink:href="#iconMore"></use></svg></span>',
            topExtHTML: '<span class="b3-list-item__action"><svg><use xlink:href="#iconMore"></use></svg></span>',
            blockDraggable: !window.siyuan.config.readonly,
            dragStart: (element, event) => {
                const started = this.dropController.handleDragStart(element, event);
                if (!started) {
                    return false;
                }
                // 拖拽开始时按指针相对块首的位置渲染拖拽提示幽灵元素
                const rect = element.getBoundingClientRect();
                setDragTipGhost(element, event.clientX - rect.left, event.clientY - rect.top);
                return true;
            },
            dragEnd: (element) => this.dropController.handleDragEnd(element),
            toggleClick: (element: HTMLElement) => this._toggleItem(element),
        });
    }

    private _onTreeClick(app: AppFacade, element: HTMLElement, event?: MouseEvent) {
        const target = event?.target;
        const actionElement = target instanceof HTMLElement ? hasClosestByClassName(target, "b3-list-item__action") : null;
        if (event && actionElement?.parentElement instanceof HTMLElement) {
            openBookmarkMenu(actionElement.parentElement, event, this);
            return;
        }
        const id = element.getAttribute("data-node-id");
        if (!id) {
            return;
        }
        checkFold(id, (zoomIn: boolean, action: TProtyleAction[]) => {
            app.openBlock({id, action, zoomIn});
        });
    }

    private static _onTreeCtrlClick(app: AppFacade, element: HTMLElement) {
        const id = element.getAttribute("data-node-id");
        if (!id) {
            return;
        }
        checkFold(id, (zoomIn: boolean) => {
            app.openBlock({
                id,
                keepCursor: true,
                action: zoomIn ? [Constants.CB_GET_HL, Constants.CB_GET_ALL] :
                    [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL],
                zoomIn,
            });
        });
    }

    private static _onTreeAltShiftClick(app: AppFacade, element: HTMLElement) {
        const id = element.getAttribute("data-node-id");
        if (!id) {
            return;
        }
        checkFold(id, (zoomIn: boolean, action: TProtyleAction[]) => {
            app.openBlock({id, action, zoomIn, position: "bottom"});
        });
    }

    private _toggleItem(liElement: HTMLElement) {
        const svgElement = liElement.firstElementChild?.firstElementChild;
        if (!svgElement) {
            return;
        }
        if (svgElement.classList.contains("b3-list-item__arrow--open")) {
            this._collapseItem(liElement, svgElement);
            return;
        }
        this._expandItem(liElement, svgElement);
    }

    private _collapseItem(liElement: HTMLElement, svgElement: Element) {
        svgElement.classList.remove("b3-list-item__arrow--open");
        const nextSibling = liElement.nextElementSibling;
        if (nextSibling?.tagName === "DIV") {
            this._destroyEditor(nextSibling);
            nextSibling.remove();
        }
        if (liElement.nextElementSibling?.tagName === "UL") {
            liElement.nextElementSibling.classList.add("fn__none");
        }
    }

    private _destroyEditor(element: Element) {
        const index = this.editors.findIndex(editor => editor.protyle.element === element);
        if (index < 0) {
            return;
        }
        this.editors[index].destroy();
        this.editors.splice(index, 1);
    }

    private _destroyAllEditors() {
        for (const editor of this.editors) {
            editor.destroy();
        }
        this.editors = [];
    }

    private _expandItem(liElement: HTMLElement, svgElement: Element) {
        svgElement.classList.add("b3-list-item__arrow--open");
        if (liElement.nextElementSibling?.tagName === "UL") {
            liElement.nextElementSibling.classList.remove("fn__none");
        }
        const id = liElement.getAttribute("data-node-id");
        if (!id) {
            return;
        }
        const editorElement = document.createElement("div");
        editorElement.style.minHeight = "auto";
        liElement.after(editorElement);
        this.editors.push(this.app.createProtyle(editorElement, {
            blockId: id,
            click: {preventInsetEmptyBlock: true},
            render: {background: false, gutter: true, scroll: false, breadcrumb: false},
        }));
    }

    private _绑定事件() {
        this.element.querySelector('[data-type="collapse"]')?.addEventListener("click", () => this._onCollapseClick());
        this.element.querySelector('[data-type="expand"]')?.addEventListener("click", () => this.tree.expandAll());
        const inputElement = this._getFilterInput();
        inputElement.addEventListener("blur", () => this._syncFilterIndicator(inputElement));
        inputElement.addEventListener("input", (event: InputEvent) => {
            if (!event.isComposing) {
                this._filter();
            }
        });
        inputElement.addEventListener("compositionend", () => this._filter());
        this.element.addEventListener("click", (event) => {
            if (event instanceof MouseEvent) {
                this._onElementClick(event);
            }
        });
        this.tree.element.addEventListener("scroll", () => this._onTreeScroll());
    }

    private _getFilterInput() {
        const inputElement = this.element.querySelector<HTMLInputElement>("input.search__label");
        if (!inputElement) {
            throw new Error("bookmark filter input not found");
        }
        return inputElement;
    }

    private _syncFilterIndicator(inputElement: HTMLInputElement) {
        inputElement.classList.add("fn__none");
        const filterElement = inputElement.nextElementSibling;
        if (!(filterElement instanceof HTMLElement)) {
            return;
        }
        const value = inputElement.value.trim();
        filterElement.classList.toggle("block__icon--active", Boolean(value));
        filterElement.setAttribute("aria-label", value ? `${window.siyuan.languages.filter} ${value}` : window.siyuan.languages.filter);
    }

    private _onCollapseClick() {
        this.tree.collapseAll();
        this._destroyAllEditors();
    }

    private _onTreeScroll() {
        for (const item of this.tree.element.querySelectorAll(".protyle-gutters")) {
            item.classList.add("fn__none");
            item.innerHTML = "";
        }
        for (const item of this.tree.element.querySelectorAll(".protyle-wysiwyg--hl")) {
            item.classList.remove("protyle-wysiwyg--hl");
        }
    }

    private _onElementClick(event: MouseEvent) {
        const target = event.target;
        if (!(target instanceof HTMLElement) || target.tagName === "INPUT") {
            return;
        }
        setPanelFocus(this.element);
        const iconElement = hasClosestByClassName(target, "block__icon");
        if (iconElement && this.element.contains(iconElement)) {
            this._handleIconClick(iconElement.getAttribute("data-type"));
        }
    }

    private _handleIconClick(type: string | null) {
        if (type === "min") {
            getDockByType("bookmark")?.toggleModel("bookmark", false, true);
            return;
        }
        if (type === "refresh") {
            this.update();
            return;
        }
        if (type === "search") {
            const inputElement = this._getFilterInput();
            inputElement.classList.remove("fn__none");
            inputElement.select();
        }
    }

    public update(data?: IBlockTree[]) {
        if (data) {
            this.data = data;
            this._filter();
            return;
        }
        if (this.updating) {
            this.updatePending = true;
            return;
        }
        this.updating = true;
        const refreshElement = this.element.querySelector('.block__icon[data-type="refresh"] svg');
        refreshElement?.classList.add("fn__rotate");
        fetchPost("/api/bookmark/getBookmark", {}, response => this._handleUpdateResponse(response.data, refreshElement));
    }

    private _handleUpdateResponse(data: unknown, refreshElement: Element | null) {
        if (this.updatePending) {
            this.updatePending = false;
            this.updating = false;
            this.update();
            return;
        }
        if (isBlockTreeArray(data)) {
            this.data = data;
        }
        this.updating = false;
        refreshElement?.classList.remove("fn__rotate");
        this._filter();
    }

    private _filter() {
        const keywords = getBookmarkFilterKeywords(this._getFilterInput().value);
        const hasKeyword = keywords.length > 0;
        if (hasKeyword && this.preFilterOpenNodes === undefined && this.openNodes !== undefined) {
            this.preFilterOpenNodes = this.tree.getExpandIds();
        }
        if (!hasKeyword && this.preFilterOpenNodes === undefined && this.openNodes !== undefined) {
            this.openNodes = this.tree.getExpandIds();
        }
        const nextData = hasKeyword ? filterBookmarkData(this.data, keywords) : this.data;
        this._destroyAllEditors();
        this.tree.updateData(nextData);
        this._restoreExpansion(hasKeyword);
        this._assignBookmarkTargets(nextData);
    }

    private _restoreExpansion(hasKeyword: boolean) {
        if (hasKeyword) {
            this.tree.expandAll();
            return;
        }
        if (this.preFilterOpenNodes !== undefined) {
            this.tree.collapseAll();
            this.tree.setExpandIds(this.preFilterOpenNodes);
            this.openNodes = this.preFilterOpenNodes;
            this.preFilterOpenNodes = undefined;
            return;
        }
        if (this.openNodes !== undefined) {
            this.tree.collapseAll();
            this.tree.setExpandIds(this.openNodes);
            return;
        }
        this.openNodes = this.tree.getExpandIds();
    }

    private _assignBookmarkTargets(data: IBlockTree[]) {
        const groups = this.tree.element.querySelectorAll<HTMLElement>(':scope > ul > li[data-treetype="bookmark"]:not([data-node-id])');
        groups.forEach((item, index) => {
            const bookmark = data[index];
            if (bookmark) {
                item.dataset.bookmark = bookmark.name;
            }
        });
    }
}
