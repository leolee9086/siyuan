import { Tab } from "../Tab";
import { Model } from "../Model";
import { Tree } from "../../util/Tree";
import { setPanelFocus } from "../utils/setPanelFocus";
import { getDockByType } from "../tabUtil";
import { fetchPost } from "../../util/fetch";
import { updateHotkeyAfterTip } from "../../protyle/util/compatibility";
import { openFileById } from "../../editor/utils.openFileById";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { openBookmarkMenu } from "../../menus/bookmark";
import { App } from "../../index";
import { Constants } from "../../constants";
import { checkFold } from "../../util/noRelyPCFunction";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isOperations } from "./dock.guard";

export class Bookmark extends Model {

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
        let needReload = false;
        const action = item.action;
        const itemContent = item.data;
        if ((action === "update" || action === "insert") && typeof itemContent === "string" && itemContent.indexOf('class="protyle-attr--bookmark"') > -1) {
            needReload = true;
        }
        if (action === "delete") {
            needReload = true;
        }
        if (needReload) {
            fetchPost("/api/bookmark/getBookmark", {}, response => {
                this.update(response.data);
            });
        }
    }

    private _初始化外观() {
        const config = getSiyuanConfig();
        this.element.classList.add("fn__flex-column", "file-tree", "sy__bookmark");
        this.element.innerHTML = `<div class="block__icons">
    <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconBookmark"></use></svg>${siyuanI18n.bookmark}
    </div>
    <span class="fn__flex-1"></span>
    <span class="fn__space"></span>
    <span data-type="refresh" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.refresh}"><svg><use xlink:href='#iconRefresh'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="expand" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.expand}${updateHotkeyAfterTip(config.keymap.editor.general.expand.custom)}">
        <svg><use xlink:href="#iconExpand"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="collapse" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.collapse}${updateHotkeyAfterTip(config.keymap.editor.general.collapse.custom)}">
        <svg><use xlink:href="#iconContract"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="min" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.min}${updateHotkeyAfterTip(config.keymap.general.closeTab.custom)}"><svg><use xlink:href='#iconMin'></use></svg></span>
</div>
<div class="fn__flex-1" style="margin-bottom: 8px"></div>`;
    }

    private _生成树对象(app: App): Tree {
        const treeElement = this.element.lastElementChild;
        if (!(treeElement instanceof HTMLElement)) {
            throw new Error("bookmark tree element not found");
        }
        return new Tree({
            element: treeElement,
            data: [],
            click: (element: HTMLElement, event?: MouseEvent) => {
                this._onTreeClick(app, element, event);
            },
            rightClick: (element: HTMLElement, event: MouseEvent) => {
                openBookmarkMenu(element, event, this);
            },
            ctrlClick: (element: HTMLElement) => {
                Bookmark._onTreeCtrlClick(app, element);
            },
            altClick: (element: HTMLElement) => {
                Bookmark._onTreeAltShiftClick(app, element);
            },
            shiftClick: (element: HTMLElement) => {
                Bookmark._onTreeAltShiftClick(app, element);
            },
            blockExtHTML: '<span class="b3-list-item__action"><svg><use xlink:href="#iconMore"></use></svg></span>',
            topExtHTML: '<span class="b3-list-item__action"><svg><use xlink:href="#iconMore"></use></svg></span>',
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
        checkFold(id, (zoomIn: boolean, action: TProtyleAction[]) => {
            Bookmark._openFileById(app, id, zoomIn, action);
        });
    }

    private static _onTreeCtrlClick(app: App, element: HTMLElement) {
        const id = element.getAttribute("data-node-id");
        if (!id) {
            return;
        }
        checkFold(id, (zoomIn: boolean) => {
            Bookmark._openFileByCtrlClick(app, id, zoomIn);
        });
    }

    private static _onTreeAltShiftClick(app: App, element: HTMLElement) {
        const id = element.getAttribute("data-node-id");
        if (!id) {
            return;
        }
        checkFold(id, (zoomIn: boolean, action: TProtyleAction[]) => {
            Bookmark._openFileById(app, id, zoomIn, action, "bottom");
        });
    }

    private _绑定事件() {
        const collapseElement = this.element.querySelector('[data-type="collapse"]');
        collapseElement?.addEventListener("click", () => {
            this.tree.collapseAll();
        });
        const expandElement = this.element.querySelector('[data-type="expand"]');
        expandElement?.addEventListener("click", () => {
            this.tree.expandAll();
        });
        this.element.addEventListener("click", (event) => {
            if (event instanceof MouseEvent) {
                this._onElementClick(event);
            }
        });
    }

    private _onElementClick(event: MouseEvent) {
        setPanelFocus(this.element);
        const eventTarget = event.target;
        if (!(eventTarget instanceof HTMLElement)) {
            return;
        }
        let target: HTMLElement | null = eventTarget;
        while (target && !target.isEqualNode(this.element)) {
            if (target.classList.contains("block__icon")) {
                const type = target.getAttribute("data-type");
                this._handleIconClick(type);
            }
            target = target.parentElement;
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
            if (element) {
                this._onUpdateData(response.data, element);
            }
        });
    }

    private _onUpdateData(data: IBlockTree[], element: Element) {
        const openNodes = this.tree.getExpandIds();
        this.tree.updateData(data);
        if (openNodes) {
            this.tree.setExpandIds(openNodes);
        }
        element.classList.remove("fn__rotate");
    }

    private static _openFileById(app: App, id: string, zoomIn: boolean, action: TProtyleAction[], position?: string) {
        openFileById({
            app,
            id,
            action,
            zoomIn,
            position
        });
    }

    private static _openFileByCtrlClick(app: App, id: string, zoomIn: boolean) {
        openFileById({
            app,
            id,
            keepCursor: true,
            action: zoomIn ? [Constants.CB_GET_HL, Constants.CB_GET_ALL] : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL],
            zoomIn
        });
    }

}
