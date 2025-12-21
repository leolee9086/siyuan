import { Tab } from "../Tab";
import { Model } from "../Model";
import { Tree } from "../../util/Tree";
import { setPanelFocus } from "../utils/setPanelFocus";
import { getDockByType } from "../tabUtil";
import { fetchPost } from "../../util/fetch";
import { openGlobalSearch } from "../../search/util";
import { MenuItem } from "../../menus/Menu.Item";
import { App } from "../../index";
import { openTagMenu } from "../../menus/tag";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { Constants } from "../../constants";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { isOperations, isBlockTreeArray } from "./dock.guard";
import { Protyle } from "../../protyle";
import { getSiyuanConfig, getSiyuanMenus, getSiyuanKeyboardState } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getTagPanelHTML, getTagSortOptions, shouldReloadTag, TAG_EDITOR_RENDER_CONFIG } from "./tag.util";
/**
 * @AIDONE tag列表本质上也是一个块查询结果列表,因此,它应该能够显示编辑器直接编辑块的内容
 * 参考书签和反向链接面板实现
 */
export class Tag extends Model {
    private openNodes: string[] = [];
    public tree: Tree;
    public editors: Protyle[] = [];
    private element: HTMLElement;

    constructor(app: App, tab: Tab) {
        super({
            app,
            id: tab.id,
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
        if (!data) return;
        if (data.cmd === "unmount" || data.cmd === "removeDoc" || (data.cmd === "mount" && data.code !== 1)) { this.update(); return; }
        if (data.cmd !== "transactions") return;
        const firstData = Array.isArray(data.data) ? data.data[0] : null;
        const ops = firstData?.doOperations;
        if (isOperations(ops) && ops.some(shouldReloadTag)) this.update();
    }

    private _初始化外观() {
        this.element.classList.add("fn__flex-column", "file-tree", "sy__tag");
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
        if (svgElement.classList.contains("b3-list-item__arrow--open")) {
            this._collapseItem(liElement, svgElement);
            return;
        }
        this._expandItem(liElement, svgElement);
    }

    private _collapseItem(liElement: HTMLElement, svgElement: Element) {
        svgElement.classList.remove("b3-list-item__arrow--open");
        // 移除编辑器容器
        const nextSibling = liElement.nextElementSibling;
        if (nextSibling && nextSibling.classList.contains("tag-editor-container")) {
            this._destroyEditorsInContainer(nextSibling);
            nextSibling.remove();
        }
        // 隐藏子标签列表
        const childrenList = liElement.nextElementSibling;
        if (childrenList?.tagName === "UL") {
            childrenList.classList.add("fn__none");
        }
    }

    private _destroyEditorsInContainer(container: Element) {
        const editorsToRemove: number[] = [];
        for (let index = 0; index < this.editors.length; index++) {
            const editor = this.editors[index];
            if (editor && container.contains(editor.protyle.element)) {
                editor.destroy();
                editorsToRemove.push(index);
            }
        }
        // 从后往前删除，避免索引错误
        for (let i = editorsToRemove.length - 1; i >= 0; i--) {
            const indexToRemove = editorsToRemove[i];
            if (typeof indexToRemove === "number") {
                this.editors.splice(indexToRemove, 1);
            }
        }
    }

    private _expandItem(liElement: HTMLElement, svgElement: Element) {
        svgElement.classList.add("b3-list-item__arrow--open");
        // 显示子标签列表
        const nextSibling = liElement.nextElementSibling;
        if (nextSibling && nextSibling.tagName === "UL") {
            nextSibling.classList.remove("fn__none");
        }
        // 获取标签名并搜索对应的块
        const label = liElement.getAttribute("data-label");
        if (!label) {
            return;
        }
        // 创建编辑器容器
        const containerElement = document.createElement("div");
        containerElement.className = "tag-editor-container";
        containerElement.style.paddingLeft = "18px";
        liElement.after(containerElement);
        // @内联回调
        // 搜索带有此标签的块
        fetchPost("/api/search/fullTextSearchBlock", {
            query: `#${label}#`,
            method: 0,
            pageSize: 10 // 限制数量避免性能问题
        }, (response) => {
            const blocks = response.data?.blocks;
            if (!blocks || blocks.length === 0) {
                containerElement.innerHTML = `<div class="b3-list--empty" style="padding: 8px;">${siyuanI18n.emptyContent}</div>`;
                return;
            }
            this._createEditorsForBlocks(blocks, containerElement);
        });
    }

    private _createEditorsForBlocks(blocks: { id: string }[], container: Element) {
        for (const block of blocks) {
            const el = document.createElement("div");
            el.style.cssText = "min-height: auto; margin-bottom: 8px";
            container.appendChild(el);
            this.editors.push(new Protyle(this.app, el, {
                blockId: block.id,
                click: { preventInsetEmptyBlock: true },
                render: TAG_EDITOR_RENDER_CONFIG
            }));
        }
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

