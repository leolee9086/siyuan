import { Tab } from "../Tab";
import { Model } from "../Model";
import { Tree } from "../../util/file/Tree";
import { setPanelFocus } from "../utils/setPanelFocus";
import { getDockByType } from "../tabUtil";
import { fetchPost } from "../../util/network/fetch";
import { openGlobalSearch } from "../../search/util";
import { MenuItem } from "../../menus/Menu.Item";
import { App } from "../../index";
import { openTagMenu } from "../../menus/tag";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { Constants } from "../../constants";

import { isOperations, isBlockTreeArray } from "./dock.guard";
import { Protyle } from "../../protyle";
import { getSiyuanConfig, getSiyuanMenus, getSiyuanKeyboardState } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getTagPanelHTML, getTagSortOptions, shouldReloadTag, TAG_EDITOR_RENDER_CONFIG, genTagBlockListHTML } from "./tag.util";

export class Tag extends Model {
    private openNodes: string[] = [];
    public tree: Tree;
    public editors: Protyle[] = [];
    private element: HTMLElement;

    constructor(app: App, tab: Tab) {
        super({
            app,
            id: tab.id,
            type: "tag",
            msgCallback: (data) => {
                this._处理消息(data);
            }
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
        if (data.cmd === "unmount" || data.cmd === "removeDoc" || (data.cmd === "mount" && data.code !== 1)) {
            this.update(); return;
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
        // S-forge: 合并远程新增的 "dockPanel" 类
        this.element.classList.add("fn__flex-column", "file-tree", "sy__tag", "dockPanel");
        this.element.innerHTML = getTagPanelHTML();
    }

    private _生成树对象(app: App): Tree {
        const treeElement = this.element.lastElementChild;
        if (!(treeElement instanceof HTMLElement)) {
            throw new Error("tag tree element not found");
        }
        const isReadonly = getSiyuanConfig()?.readonly ?? false;
        const extHTML = '<span class="b3-list-item__action"><svg><use xlink:href="#iconMore"></use></svg></span>';
        return new Tree({
            element: treeElement,
            data: [],
            click: (element: HTMLElement, event?: MouseEvent) => Tag._onTreeClick(app, element, event),
            rightClick: (element: HTMLElement, event: MouseEvent) => openTagMenu(element, event, element.getAttribute("data-label") ?? ""),
            blockExtHTML: isReadonly ? "" : extHTML,
            topExtHTML: isReadonly ? "" : extHTML,
            toggleClick: (element: HTMLElement) => this._toggleItem(element)
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
            click: { preventInsetEmptyBlock: true },
            render: TAG_EDITOR_RENDER_CONFIG
        }));
    }

    private _collapseBlock(liElement: HTMLElement, svgElement: Element) {
        svgElement.classList.remove("b3-list-item__arrow--open");
        const nextSibling = liElement.nextElementSibling;
        if (nextSibling && nextSibling.classList.contains("tag-editor-container")) {
            const protyleElement = nextSibling.firstElementChild;
            if (protyleElement) {
                this._destroyEditor(protyleElement);
            }
            nextSibling.remove();
        }
    }

    private static _onTreeClick(app: App, element: HTMLElement, event?: MouseEvent) {
        const eventTarget = event?.target;
        const actionElement = eventTarget instanceof HTMLElement && hasClosestByClassName(eventTarget, "b3-list-item__action");
        if (actionElement && actionElement.parentElement && event) {
            openTagMenu(actionElement.parentElement, event, element.getAttribute("data-label") ?? "");
            return;
        }
        const label = element.getAttribute("data-label") ?? "";
        openGlobalSearch(app, `#${label}#`, !getSiyuanKeyboardState().ctrlIsPressed, { method: 0 });
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
        } else {
            this._expandTag(liElement, svgElement);
        }
    }

    private _collapseTag(liElement: HTMLElement, svgElement: Element) {
        svgElement.classList.remove("b3-list-item__arrow--open");
        const nextSibling = liElement.nextElementSibling;
        if (nextSibling && nextSibling.tagName === "UL") {
            nextSibling.classList.add("fn__none");
            this._destroyEditorsInBlockList(nextSibling);
        }
    }

    private _destroyEditor(element: Element) {
        const index = this.editors.findIndex(e => e.protyle.element === element);
        if (index > -1) {
            this.editors[index].destroy();
            this.editors.splice(index, 1);
        }
    }

    private _destroyEditorsInBlockList(ulElement: Element) {
        const containers = ulElement.querySelectorAll(".tag-editor-container");
        for (const container of containers) {
            if (container instanceof HTMLElement) {
                const protyleElement = container.firstElementChild;
                if (protyleElement) {
                    this._destroyEditor(protyleElement);
                }
            }
        }
    }

    private _expandTag(liElement: HTMLElement, svgElement: Element) {
        svgElement.classList.add("b3-list-item__arrow--open");
        // 显示子标签列表
        const nextSibling = liElement.nextElementSibling;
        if (nextSibling && nextSibling.tagName === "UL") {
            nextSibling.classList.remove("fn__none");
            // 如果已经是加载过的块列表，则不需要重新加载
            if (nextSibling.getAttribute("data-loaded") === "true") {
                return;
            }
        }

        // 获取标签名并搜索对应的块
        const label = liElement.getAttribute("data-label");
        if (!label) {
            return;
        }

        // @内联回调
        fetchPost("/api/search/fullTextSearchBlock", {
            query: `#${label}#`,
            method: 0,
            pageSize: 30 // 增加数量
        }, (response) => {
            const blocks = response.data?.blocks;
            if (!blocks || blocks.length === 0) {
                return;
            }
            const html = genTagBlockListHTML(blocks);
            let targetUL = nextSibling;
            if (targetUL && targetUL.tagName === "UL") {
                // 如果已有子列表，追加块（去掉ul标签仅追加li）
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = html;
                const lis = tempDiv.querySelectorAll("li");
                for (const li of lis) {
                    if (targetUL) {
                        targetUL.appendChild(li);
                    }
                }
            } else {
                // 如果没有子列表，插入新列表
                liElement.insertAdjacentHTML("afterend", html);
                targetUL = liElement.nextElementSibling;
            }

            if (targetUL) {
                targetUL.setAttribute("data-loaded", "true");
                targetUL.classList.remove("fn__none");
            }
        });
    }




    private _绑定事件() {
        const collapseElement = this.element.querySelector('[data-type="collapse"]');
        if (collapseElement) {
            collapseElement.addEventListener("click", () => {
                this.tree.collapseAll();
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
    }

    private _onElementClick(event: MouseEvent) {
        setPanelFocus(this.element);
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
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
        if (type === "sort") {
            this._显示排序菜单(event);
        }
    }

    private _显示排序菜单(event: MouseEvent) {
        const config = getSiyuanConfig();
        const currentSort = config?.tag?.sort ?? 0;
        const menus = getSiyuanMenus();
        if (!menus) {
            return;
        }
        menus.menu.remove();

        const sortOptions = getTagSortOptions(currentSort);
        for (const option of sortOptions) {
            menus.menu.append(new MenuItem({
                icon: option.isSelected ? "iconSelect" : "",
                label: option.label,
                click: () => {
                    this._设置排序(option.sortValue);
                },
            }).element);
        }

        menus.menu.popup({ x: event.clientX, y: event.clientY });
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
        const element = this.element.querySelector('.block__icon[data-type="refresh"] svg');
        if (!element) {
            return;
        }
        if (element.classList.contains("fn__rotate")) {
            return;
        }
        element.classList.add("fn__rotate");
        const config = getSiyuanConfig();
        const sortValue = config?.tag?.sort ?? 0;
        fetchPost("/api/tag/getTag", {
            sort: sortValue,
            app: Constants.SIYUAN_APPID,
            ignoreMaxListHint
        }, response => {
            this._handleUpdateResponse(response.data, element);
        });
    }

    private _handleUpdateResponse(data: unknown, element: Element) {
        if (!element) {
            return;
        }
        if (this.openNodes && this.openNodes.length > 0) {
            this.openNodes = this.tree.getExpandIds();
        }
        // 使用类型守卫验证数据
        if (isBlockTreeArray(data)) {
            this.tree.updateData(data);
        }
        if (this.openNodes && this.openNodes.length > 0) {
            this.tree.setExpandIds(this.openNodes);
            return;
        }
        this.openNodes = this.tree.getExpandIds();
        element.classList.remove("fn__rotate");
    }
}

