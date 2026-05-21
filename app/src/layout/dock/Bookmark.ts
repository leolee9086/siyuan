import { Tab } from "../Tab";
import { Model } from "../Model";
import { Tree } from "../../util/file/Tree";
import { setPanelFocus } from "../utils/setPanelFocus";
import { getDockByType } from "../tabUtil";
import { fetchPost } from "../../util/network/fetch";
import { openFileById } from "../../editor/utils.openFileById";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { openBookmarkMenu } from "../../menus/bookmark";
import { App } from "../../index";
import { Constants } from "../../constants";
import { checkFold } from "../../util/platform/noRelyPCFunction";
import { isOperations } from "./dock.guard";
import { Protyle } from "../../protyle";
import { getBookmarkPanelHTML, shouldReloadBookmark } from "./bookmark.util";
/**
 * @AIDONE 书签本质上也是查询结果列表,因此,应该像反向链接面板一样,初始化protyle
 * 让查询结果能够直接快速编辑,注意需要避免循环更新等边界情况
 */
export class Bookmark extends Model {

    public tree: Tree;
    public editors: Protyle[] = [];
    private element: HTMLElement;

    constructor(app: App, tab: Tab) {
        super({
            app,
            id: tab.id,
            type: "bookmark",
            msgCallback: (data) => {
                this._处理消息(data);
            }
        });
        this.element = tab.panelElement;
        this._初始化外观();
        this.tree = this._生成树对象(app);
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
        if ((data.cmd === "unmount" || data.cmd === "removeDoc" || data.cmd === "mount") && (data.cmd !== "mount" || data.code !== 1)) {
            fetchPost("/api/bookmark/getBookmark", {}, response => {
                this.update(response.data);
            });
        }
    }

    private _处理事务(data: IWebSocketData) {
        const itemData = data.data;
        if (!Array.isArray(itemData) || itemData.length === 0) {
            return;
        }
        const firstDataItem = itemData[0];
        const operations = firstDataItem?.doOperations;
        if (!isOperations(operations)) {
            return;
        }
        for (const item of operations) {
            this._执行操作检查(item);
        }
    }

    private _执行操作检查(item: IOperation) {
        if (shouldReloadBookmark(item)) {
            fetchPost("/api/bookmark/getBookmark", {}, response => {
                this.update(response.data);
            });
        }
    }

    private _初始化外观() {
        // S-forge: 添加 dockPanel 类来自远程分支
        this.element.classList.add("fn__flex-column", "file-tree", "sy__bookmark", "dockPanel");
        this.element.innerHTML = getBookmarkPanelHTML();
    }

    private _生成树对象(app: App): Tree {
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
            toggleClick: (element: HTMLElement) => this._toggleItem(element)
        });
    }

    private _onTreeClick(app: App, element: HTMLElement, event?: MouseEvent) {
        const eventTarget = event?.target;
        const actionElement = eventTarget instanceof HTMLElement ? hasClosestByClassName(eventTarget, "b3-list-item__action") : null;
        if (event && actionElement && actionElement.parentElement instanceof HTMLElement) {
            openBookmarkMenu(actionElement.parentElement, event, this);
            return;
        }
        const id = element.getAttribute("data-node-id");
        if (!id) {
            return;
        }
        // @内联回调
        checkFold(id, (zoomIn: boolean, action: TProtyleAction[]) => {
            openFileById({
                app,
                id,
                action,
                zoomIn,
                position: undefined
            });
        });
    }

    private static _onTreeCtrlClick(app: App, element: HTMLElement) {
        const id = element.getAttribute("data-node-id");
        if (!id) {
            return;
        }
        // @内联回调
        checkFold(id, (zoomIn: boolean) => {
            openFileById({
                app,
                id,
                keepCursor: true,
                action: zoomIn ? [Constants.CB_GET_HL, Constants.CB_GET_ALL] : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL],
                zoomIn
            });
        });
    }

    private static _onTreeAltShiftClick(app: App, element: HTMLElement) {
        const id = element.getAttribute("data-node-id");
        if (!id) {
            return;
        }
        checkFold(id, (zoomIn: boolean, action: TProtyleAction[]) => {
            openFileById({
                app,
                id,
                action,
                zoomIn,
                position: "bottom",
            });
        });
    }

    private _toggleItem(liElement: HTMLElement) {
        const toggleElement = liElement.firstElementChild;
        if (!toggleElement) {
            return;
        }
        const svgElement = toggleElement.firstElementChild;
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
        if (nextSibling && nextSibling.tagName === "DIV") {
            this._destroyEditor(nextSibling);
            nextSibling.remove();
        }

        const childrenList = liElement.nextElementSibling;
        if (childrenList?.tagName === "UL") {
            childrenList.classList.add("fn__none");
        }
    }

    private _destroyEditor(element: Element) {
        const index = this.editors.findIndex(e => e.protyle.element === element);
        if (index > -1) {
            const editor = this.editors[index];
            editor?.destroy();
            this.editors.splice(index, 1);
        }
    }

    private _expandItem(liElement: HTMLElement, svgElement: Element) {
        svgElement.classList.add("b3-list-item__arrow--open");
        const nextSibling = liElement.nextElementSibling;
        if (nextSibling && nextSibling.tagName === "UL") {
            nextSibling.classList.remove("fn__none");
        }

        const id = liElement.getAttribute("data-node-id");
        if (!id) {
            return;
        }
        const editorElement = document.createElement("div");
        editorElement.style.minHeight = "auto";
        liElement.after(editorElement);
        const editor = new Protyle(this.app, editorElement, {
            blockId: id,
            click: {
                preventInsetEmptyBlock: true
            },
            render: {
                background: false,
                gutter: true,
                scroll: false,
                breadcrumb: false,
            }
        });
        this.editors.push(editor);
    }

    private _绑定事件() {
        const collapseElement = this.element.querySelector('[data-type="collapse"]');
        if (collapseElement) {
            collapseElement.addEventListener("click", () => {
                this._onCollapseClick();
            });
        }
        const expandElement = this.element.querySelector('[data-type="expand"]');
        if (expandElement) {
            expandElement.addEventListener("click", () => {
                this.tree.expandAll();
            });
        }
        this.element.addEventListener("click", (event) => {
            if (event instanceof MouseEvent) {
                this._onElementClick(event);
            }
        });
        this.tree.element.addEventListener("scroll", () => {
            this._onTreeScroll();
        });
    }

    private _onCollapseClick() {
        this.tree.collapseAll();
        for (const item of this.editors) {
            item.protyle.element.remove();
            item.destroy();
        }
        this.editors = [];
    }

    private _onTreeScroll() {
        for (const item of Array.from(this.tree.element.querySelectorAll(".protyle-gutters"))) {
            item.classList.add("fn__none");
            item.innerHTML = "";
        }
        for (const item of Array.from(this.tree.element.querySelectorAll(".protyle-wysiwyg--hl"))) {
            item.classList.remove("protyle-wysiwyg--hl");
        }
    }

    private _onElementClick(event: MouseEvent) {
        setPanelFocus(this.element);
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
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
        }
    }

    public update(data?: IBlockTree[]) {
        for (const item of this.editors) {
            item.destroy();
        }
        this.editors = [];
        const element = this.element.querySelector('.block__icon[data-type="refresh"] svg');
        if (!element || element.classList.contains("fn__rotate")) {
            return;
        }
        if (data) {
            this.tree.updateData(data);
            return;
        }
        element.classList.add("fn__rotate");
        fetchPost("/api/bookmark/getBookmark", {}, response => {
            this._handleUpdateResponse(response.data, element);
        });
    }

    private _handleUpdateResponse(data: IBlockTree[], element: Element) {
        if (!element) {
            return;
        }
        const openNodes = this.tree.getExpandIds();
        this.tree.updateData(data);
        if (openNodes) {
            this.tree.setExpandIds(openNodes);
        }
        element.classList.remove("fn__rotate");
    }



}
