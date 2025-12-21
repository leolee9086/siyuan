import { Tab } from "../Tab";
import { Model } from "../Model";
import { Tree } from "../../util/Tree";
import { setPanelFocus } from "../utils/setPanelFocus";
import { getDockByType } from "../tabUtil";
import { fetchPost } from "../../util/fetch";
import { updateHotkeyAfterTip } from "../../protyle/util/compatibility";
import { openGlobalSearch } from "../../search/util";
import { MenuItem } from "../../menus/Menu.Item";
import { App } from "../../index";
import { openTagMenu } from "../../menus/tag";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { Constants } from "../../constants";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { isOperations, isBlockTreeArray } from "./dock.guard";
import { getSiyuanConfig, getSiyuanMenus, getSiyuanKeyboardState } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/**
 * @AIDONE 此文件中的lint错误已被清理，重构了代码结构
 */
export class Tag extends Model {
    private openNodes: string[] = [];
    public tree: Tree;
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
        if (!data) {
            return;
        }
        if (data.cmd === "transactions") {
            this._处理事务(data);
            return;
        }
        if (data.cmd === "unmount" || data.cmd === "removeDoc") {
            this.update();
            return;
        }
        if (data.cmd === "mount" && data.code !== 1) {
            this.update();
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
            if (Tag._应该重新加载(item)) {
                this.update();
                return;
            }
        }
    }

    private static _应该重新加载(item: IOperation): boolean {
        if (item.action === "delete") {
            return true;
        }
        if ((item.action === "update" || item.action === "insert") && typeof item.data === "string") {
            return item.data.indexOf('data-type="tag"') > -1;
        }
        return false;
    }

    private _初始化外观() {
        this.element.classList.add("fn__flex-column", "file-tree", "sy__tag");
        this.element.innerHTML = Tag._生成面板HTML();
    }

    private static _生成面板HTML(): string {
        const config = getSiyuanConfig();
        const readonlyClass = config?.readonly ? " fn__none" : "";
        const expandHotkey = updateHotkeyAfterTip(config?.keymap?.editor?.general?.expand?.custom ?? "");
        const collapseHotkey = updateHotkeyAfterTip(config?.keymap?.editor?.general?.collapse?.custom ?? "");
        const minHotkey = updateHotkeyAfterTip(config?.keymap?.general?.closeTab?.custom ?? "");

        return `<div class="block__icons">
    <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconTags"></use></svg>${siyuanI18n.tag}
    </div>
    <span class="fn__flex-1"></span>
    <span class="fn__space"></span>
    <span data-type="refresh" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.refresh}"><svg><use xlink:href='#iconRefresh'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="sort" class="block__icon b3-tooltips b3-tooltips__sw${readonlyClass}" aria-label="${siyuanI18n.sort}">
        <svg><use xlink:href="#iconSort"></use></svg>
    </span>
    <span class="fn__space${readonlyClass}"></span>
    <span data-type="expand" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.expand}${expandHotkey}">
        <svg><use xlink:href="#iconExpand"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="collapse" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.collapse}${collapseHotkey}">
        <svg><use xlink:href="#iconContract"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="min" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.min}${minHotkey}"><svg><use xlink:href='#iconMin'></use></svg></span>
</div>
<div class="fn__flex-1" style="margin-bottom: 8px"></div>`;
    }

    private _生成树对象(app: App): Tree {
        const treeElement = this.element.lastElementChild;
        if (!(treeElement instanceof HTMLElement)) {
            throw new Error("tag tree element not found");
        }
        const config = getSiyuanConfig();
        const isReadonly = config?.readonly ?? false;

        return new Tree({
            element: treeElement,
            data: null,
            click: (element: HTMLElement, event?: MouseEvent) => Tag._onTreeClick(app, element, event),
            rightClick: (element: HTMLElement, event: MouseEvent) => {
                openTagMenu(element, event, element.getAttribute("data-label") ?? "");
            },
            blockExtHTML: isReadonly ? undefined : '<span class="b3-list-item__action"><svg><use xlink:href="#iconMore"></use></svg></span>',
            topExtHTML: isReadonly ? undefined : '<span class="b3-list-item__action"><svg><use xlink:href="#iconMore"></use></svg></span>'
        });
    }

    private static _onTreeClick(app: App, element: HTMLElement, event?: MouseEvent) {
        if (!event) {
            Tag._执行搜索(app, element);
            return;
        }
        const eventTarget = event.target;
        if (!(eventTarget instanceof HTMLElement)) {
            Tag._执行搜索(app, element);
            return;
        }
        const actionElement = hasClosestByClassName(eventTarget, "b3-list-item__action");
        if (actionElement && actionElement.parentElement) {
            const labelName = element.getAttribute("data-label");
            openTagMenu(actionElement.parentElement, event, labelName ?? "");
            return;
        }
        Tag._执行搜索(app, element);
    }

    private static _执行搜索(app: App, element: HTMLElement) {
        const label = element.getAttribute("data-label") ?? "";
        const keyboardState = getSiyuanKeyboardState();
        openGlobalSearch(app, `#${label}#`, !keyboardState.ctrlIsPressed, { method: 0 });
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

        const sortOptions = Tag._获取排序选项(currentSort);
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

    private static _获取排序选项(currentSort: number) {
        return [
            { sortValue: 0, label: siyuanI18n.fileNameASC, isSelected: currentSort === 0 },
            { sortValue: 1, label: siyuanI18n.fileNameDESC, isSelected: currentSort === 1 },
            { sortValue: 4, label: siyuanI18n.fileNameNatASC, isSelected: currentSort === 4 },
            { sortValue: 5, label: siyuanI18n.fileNameNatDESC, isSelected: currentSort === 5 },
            { sortValue: 7, label: siyuanI18n.refCountASC, isSelected: currentSort === 7 },
            { sortValue: 8, label: siyuanI18n.refCountDESC, isSelected: currentSort === 8 },
        ];
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
