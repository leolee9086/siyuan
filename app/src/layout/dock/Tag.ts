import { Tab } from "../Tab";
import { Model } from "../Model";
import { Tree } from "../../util/file/Tree";
import { setPanelFocus } from "../utils/setPanelFocus";
import { getDockByType } from "../tabUtil";
import { fetchPost } from "../../util/network/fetch";
import { openGlobalSearch } from "../../search/util";
import { MenuItem } from "../../menus/Menu.Item";
import type {AppFacade} from "../../app/AppFacade.types";
import { openTagMenu } from "../../menus/tag";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { Constants } from "../../constants";
import { isOperations, isBlockTreeArray } from "./dock.guard";
import { Protyle } from "../../protyle";
import {
    getSiyuanConfig, getSiyuanMenus, getSiyuanKeyboardState,
} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import {
    getTagPanelHTML, getTagSortOptions, shouldReloadTag,
    TAG_EDITOR_RENDER_CONFIG, genTagBlockListHTML,
} from "./tag.util";
import { filterTagData, getTagFilterKeywords } from "./tagFilter";
import {tagModelBrand} from "./tag/tag.types";
import type {TreeDomain} from "../../util/file/tree.types";
import type {ProtyleDomain} from "../../protyle/protyle.types";

export class Tag extends Model<AppFacade, Tab> {
    public get [tagModelBrand]() {
        return "Tag" as const;
    }

    private openNodes: string[] | undefined;
    private preFilterOpenNodes: string[] | undefined;
    private data: IBlockTree[] = [];
    private filterData: IBlockTree[] | undefined;
    private updating = false;
    private pendingUpdate: boolean | undefined;
    private filterLoadPending = false;
    public tree: TreeDomain;
    public editors: ProtyleDomain[] = [];
    private element: HTMLElement;

    constructor(app: AppFacade, tab: Tab) {
        super({app});
        this.connect({
            id: tab.id,
            type: "tag",
            msgCallback: (data) => this._处理消息(data),
        });
        this.element = tab.panelElement;
        this._初始化外观();
        this.tree = this._生成树对象(app);
        this._绑定事件();
        this.update(false);
    }

    private _处理消息(data: IWebSocketData) {
        if (!data) {
            return;
        }
        if (data.cmd === "unmount" || data.cmd === "closeBox" || data.cmd === "removeBox" ||
            data.cmd === "removeDoc" || (data.cmd === "mount" && data.code !== 1)) {
            this.update();
            return;
        }
        if (data.cmd !== "transactions") {
            return;
        }
        const firstData = Array.isArray(data.data) ? data.data[0] : null;
        const ops = firstData?.doOperations;
        if (isOperations(ops) && ops.some(shouldReloadTag)) {
            this.update();
        }
    }

    private _初始化外观() {
        this.element.classList.add("fn__flex-column", "file-tree", "sy__tag", "dockPanel");
        this.element.innerHTML = getTagPanelHTML();
    }

    private _生成树对象(app: AppFacade): Tree {
        const treeElement = this.element.lastElementChild;
        if (!(treeElement instanceof HTMLElement)) {
            throw new Error("tag tree element not found");
        }
        const isReadonly = getSiyuanConfig()?.readonly ?? false;
        const extHTML = '<span class="b3-list-item__action"><svg><use xlink:href="#iconMore"></use></svg></span>';
        return new Tree({
            element: treeElement,
            data: [],
            click: (element: HTMLElement, event?: MouseEvent) => this._onTreeClick(app, element, event),
            rightClick: (element: HTMLElement, event: MouseEvent) => openTagMenu({
                event,
                labelName: element.getAttribute("data-label") ?? "",
                refresh: () => this.update(),
            }),
            blockExtHTML: isReadonly ? "" : extHTML,
            topExtHTML: isReadonly ? "" : extHTML,
            toggleClick: (element: HTMLElement) => this._toggleItem(element),
        });
    }

    private _expandBlock(liElement: HTMLElement, svgElement: Element) {
        svgElement.classList.add("b3-list-item__arrow--open");
        const id = liElement.getAttribute("data-node-id");
        if (!id) {
            return;
        }
        const container = document.createElement("div");
        container.className = "tag-editor-container";
        container.style.paddingLeft = "18px";
        liElement.after(container);
        this.editors.push(new Protyle(this.app, container, {
            blockId: id,
            click: {preventInsetEmptyBlock: true},
            render: TAG_EDITOR_RENDER_CONFIG,
        }));
    }

    private _collapseBlock(liElement: HTMLElement, svgElement: Element) {
        svgElement.classList.remove("b3-list-item__arrow--open");
        const nextSibling = liElement.nextElementSibling;
        if (nextSibling?.classList.contains("tag-editor-container")) {
            const protyleElement = nextSibling.firstElementChild;
            if (protyleElement) {
                this._destroyEditor(protyleElement);
            }
            nextSibling.remove();
        }
    }

    private _onTreeClick(app: AppFacade, element: HTMLElement, event?: MouseEvent) {
        const eventTarget = event?.target;
        const actionElement = eventTarget instanceof HTMLElement && hasClosestByClassName(eventTarget, "b3-list-item__action");
        if (actionElement && actionElement.parentElement && event) {
            openTagMenu({
                event,
                labelName: element.getAttribute("data-label") ?? "",
                refresh: () => this.update(),
            });
            return;
        }
        const label = element.getAttribute("data-label") ?? "";
        openGlobalSearch(app, `#${label}#`, !getSiyuanKeyboardState().ctrlIsPressed, {method: 0});
    }

    private _toggleItem(liElement: HTMLElement) {
        const svgElement = liElement.firstElementChild?.firstElementChild;
        if (!svgElement) {
            return;
        }
        if (liElement.getAttribute("data-treetype") === "tag-block") {
            if (svgElement.classList.contains("b3-list-item__arrow--open")) {
                this._collapseBlock(liElement, svgElement);
            } else {
                this._expandBlock(liElement, svgElement);
            }
            return;
        }
        if (svgElement.classList.contains("b3-list-item__arrow--open")) {
            this._collapseTag(liElement, svgElement);
            return;
        }
        this._expandTag(liElement, svgElement);
    }

    private _collapseTag(liElement: HTMLElement, svgElement: Element) {
        svgElement.classList.remove("b3-list-item__arrow--open");
        const nextSibling = liElement.nextElementSibling;
        if (nextSibling?.tagName === "UL") {
            nextSibling.classList.add("fn__none");
            this._destroyEditorsInBlockList(nextSibling);
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

    private _destroyEditorsInBlockList(element: Element) {
        for (const container of element.querySelectorAll(".tag-editor-container")) {
            const protyleElement = container.firstElementChild;
            if (protyleElement) {
                this._destroyEditor(protyleElement);
            }
        }
    }

    private _destroyAllEditors() {
        for (const editor of this.editors) {
            editor.destroy();
        }
        this.editors = [];
    }

    private _expandTag(liElement: HTMLElement, svgElement: Element) {
        svgElement.classList.add("b3-list-item__arrow--open");
        const nextSibling = liElement.nextElementSibling;
        if (nextSibling?.tagName === "UL") {
            nextSibling.classList.remove("fn__none");
            if (nextSibling.getAttribute("data-loaded") === "true") {
                return;
            }
        }
        const label = liElement.getAttribute("data-label");
        if (!label) {
            return;
        }
        fetchPost("/api/search/fullTextSearchBlock", {
            query: `#${label}#`,
            method: 0,
            pageSize: 30,
        }, (response) => {
            const blocks = response.data?.blocks;
            if (!blocks?.length) {
                return;
            }
            const html = genTagBlockListHTML(blocks);
            let targetList = nextSibling;
            if (targetList?.tagName === "UL") {
                const holder = document.createElement("div");
                holder.innerHTML = html;
                for (const item of holder.querySelectorAll("li")) {
                    targetList.appendChild(item);
                }
            } else {
                liElement.insertAdjacentHTML("afterend", html);
                targetList = liElement.nextElementSibling;
            }
            targetList?.setAttribute("data-loaded", "true");
            targetList?.classList.remove("fn__none");
        });
    }

    private _绑定事件() {
        this.element.querySelector('[data-type="collapse"]')?.addEventListener("click", () => this.tree.collapseAll());
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
    }

    private _getFilterInput() {
        const inputElement = this.element.querySelector<HTMLInputElement>("input.search__label");
        if (!inputElement) {
            throw new Error("tag filter input not found");
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

    private _onElementClick(event: MouseEvent) {
        const target = event.target;
        if (!(target instanceof HTMLElement) || target.tagName === "INPUT") {
            return;
        }
        setPanelFocus(this.element);
        const iconElement = hasClosestByClassName(target, "block__icon");
        if (iconElement && this.element.contains(iconElement)) {
            this._handleIconClick(iconElement.getAttribute("data-type"), event);
        }
    }

    private _handleIconClick(type: string | null, event: MouseEvent) {
        if (type === "min") {
            getDockByType("tag")?.toggleModel("tag", false, true);
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
            return;
        }
        if (type === "sort") {
            this._显示排序菜单(event);
        }
    }

    private _显示排序菜单(event: MouseEvent) {
        const currentSort = getSiyuanConfig()?.tag?.sort ?? 0;
        const menus = getSiyuanMenus();
        if (!menus) {
            return;
        }
        menus.menu.remove();
        for (const option of getTagSortOptions(currentSort)) {
            menus.menu.append(new MenuItem({
                icon: option.isSelected ? "iconSelect" : "",
                label: option.label,
                click: () => this._设置排序(option.sortValue),
            }).element);
        }
        menus.menu.popup({x: event.clientX, y: event.clientY});
        event.preventDefault();
        event.stopPropagation();
    }

    private _设置排序(sortValue: number) {
        const config = getSiyuanConfig();
        if (config?.tag) {
            config.tag.sort = sortValue;
        }
        this.update();
    }

    public update(ignoreMaxListHint = true) {
        if (this.updating) {
            this.pendingUpdate = ignoreMaxListHint;
            return;
        }
        this.updating = true;
        const refreshElement = this.element.querySelector('.block__icon[data-type="refresh"] svg');
        const hasFilter = getTagFilterKeywords(this._getFilterInput().value).length > 0;
        refreshElement?.classList.add("fn__rotate");
        fetchPost("/api/tag/getTag", {
            sort: getSiyuanConfig()?.tag?.sort ?? 0,
            app: Constants.SIYUAN_APPID,
            ignoreMaxListHint: hasFilter || ignoreMaxListHint,
        }, response => this._handleUpdateResponse(response.data, refreshElement, hasFilter || ignoreMaxListHint));
    }

    private _handleUpdateResponse(data: unknown, refreshElement: Element | null, completeData: boolean) {
        if (this.pendingUpdate !== undefined) {
            const pendingUpdate = this.pendingUpdate;
            this.pendingUpdate = undefined;
            this.updating = false;
            this.update(pendingUpdate);
            return;
        }
        if (isBlockTreeArray(data)) {
            this.data = data;
            this.filterData = completeData ? data : undefined;
        }
        this.updating = false;
        refreshElement?.classList.remove("fn__rotate");
        this._filter();
        if (this.filterLoadPending) {
            this.filterLoadPending = false;
            this._loadFilterData();
        }
    }

    private _loadFilterData() {
        const keywords = getTagFilterKeywords(this._getFilterInput().value);
        if (keywords.length === 0 || this.filterData) {
            this._filter();
            return;
        }
        if (this.updating) {
            this.filterLoadPending = true;
            return;
        }
        this.updating = true;
        const refreshElement = this.element.querySelector('.block__icon[data-type="refresh"] svg');
        refreshElement?.classList.add("fn__rotate");
        fetchPost("/api/tag/getTag", {
            sort: getSiyuanConfig()?.tag?.sort ?? 0,
            app: Constants.SIYUAN_APPID,
            ignoreMaxListHint: true,
        }, response => this._handleFilterLoadResponse(response.data, refreshElement));
    }

    private _handleFilterLoadResponse(data: unknown, refreshElement: Element | null) {
        if (this.pendingUpdate !== undefined) {
            const pendingUpdate = this.pendingUpdate;
            this.pendingUpdate = undefined;
            this.filterLoadPending = false;
            this.updating = false;
            this.update(pendingUpdate);
            return;
        }
        if (isBlockTreeArray(data)) {
            this.filterData = data;
        }
        this.filterLoadPending = false;
        this.updating = false;
        refreshElement?.classList.remove("fn__rotate");
        this._filter();
    }

    private _filter() {
        const keywords = getTagFilterKeywords(this._getFilterInput().value);
        const hasKeyword = keywords.length > 0;
        if (hasKeyword && this.preFilterOpenNodes === undefined && this.openNodes !== undefined) {
            this.preFilterOpenNodes = this.tree.getExpandIds();
        }
        if (!hasKeyword && this.preFilterOpenNodes === undefined && this.openNodes !== undefined) {
            this.openNodes = this.tree.getExpandIds();
        }
        if (hasKeyword && !this.filterData) {
            this._loadFilterData();
            return;
        }
        const nextData = hasKeyword ? filterTagData(this.filterData ?? [], keywords) : this.data;
        this._destroyAllEditors();
        this.tree.updateData(nextData);
        this._restoreFilterExpansion(hasKeyword);
    }

    private _restoreFilterExpansion(hasKeyword: boolean) {
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
}
