import { Tab } from "../../Tab";
import { Model } from "../../Model";
import { App } from "../../../index";

import { fetchPost } from "../../../util/fetch";
import { Tree } from "../../../util/Tree";
import { checkFold } from "../../../util/noRelyPCFunction";
import { openFileById } from "../../../editor/utils.openFileById";
import { Protyle } from "../../../protyle";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getIconByType } from "../../../editor/getIcon";
import { getDockByType } from "../../tabUtil";
import { getCustomListIcon, getTopExtHTML, handleRemoveFromStorage, handleRemoveItemFromList, updateListTarget } from "./customLists.util";
// Duplicate import removed
import { fetchPost } from "../../../util/fetch";
import { showCustomListMenu } from "./customLists.menu";

export interface ICustomList {
    id: string;
    title: string;
    icon: string;
    type: "dynamic" | "static"; // custom_list:dynamic:uuid or custom_list:static:uuid
    target: string | string[];
}

interface IBlock {
    id: string;
    content?: string;
    tag?: string;
    box?: string;
    type?: string;
    subType?: string;
    hPath?: string;
    ial?: { icon?: string };
}

export class CustomLists extends Model {
    public element: HTMLElement;
    public tree: Tree;
    public listData: ICustomList;
    public editors: Protyle[] = [];

    constructor(app: App, tab: Tab, data: ICustomList) {
        super({
            app,
            id: tab.id,
            msgCallback: (data) => {
                this.onMessage(data);
            }
        });
        this.element = tab.panelElement;
        this.listData = data;

        this.element.classList.add("fn__flex-column", "file-tree", "sy__custom-list");
        const icon = getCustomListIcon(this.listData.type);
        this.updateDockIcon(tab, icon);
        this.renderHeader(icon);


        this.tree = new Tree({
            element: this.element.lastElementChild as HTMLElement,
            data: [],
            topExtHTML: getTopExtHTML(this.listData.type),
            click: (element: HTMLElement, event?: MouseEvent) => this.onTreeClick(element, event),
            toggleClick: (element: HTMLElement) => this.toggleItem(element)
        });

        this.update();
        this.bindEvents();
    }

    public update() {
        if (this.listData.type === "dynamic") {
            const query = this.listData.target as string;
            if (!query) {
                return;
            }

            // Check if query is SQL (starts with select)
            if (query.trim().toLowerCase().startsWith("select")) {
                fetchPost("/api/query/sql", { stmt: query }, (response) => {
                    this.renderData(response.data);
                });
                return;
            }

            let searchConfig: any = {
                query: query,
                page: 1,
                pagesize: 50,
            };

            // Try to parse query as JSON config
            if (query.trim().startsWith("{")) {
                try {
                    const config = JSON.parse(query);
                    searchConfig = {
                        query: config.k,
                        method: config.method,
                        types: config.types,
                        paths: config.idPath || [],
                        groupBy: config.group,
                        orderBy: config.sort,
                        page: 1,
                        pagesize: 50,
                    };
                } catch (e) {
                    // Ignore error, treat as plain text query
                }
            }

            // Use searchBlock API to get results
            fetchPost("/api/search/fullTextSearchBlock", searchConfig, (response) => {
                this.renderData(response.data.blocks);
            });
        } else {
            // Static list - target is string[] of IDs
            const ids = this.listData.target as string[];
            if (!ids || ids.length === 0) {
                this.tree.updateData([]);
                return;
            }
            const sql = `SELECT * FROM blocks WHERE id IN ('${ids.join("','")}')`;
            fetchPost("/api/query/sql", { stmt: sql }, (response) => {
                this.renderData(response.data);
            });
        }
    }

    public updateTitle(title: string) {
        this.listData.title = title;
        const logo = this.element.querySelector(".block__logo");
        if (logo) {
            const icon = getCustomListIcon(this.listData.type);
            logo.innerHTML = `<svg class="block__logoicon"><use xlink:href="#${icon}"></use></svg>${title}`;
        }
    }

    private updateDockIcon(tab: Tab, icon: string) {
        if (tab.icon !== icon) {
            tab.icon = icon;
            tab.headElement?.querySelector("use")?.setAttribute("xlink:href", "#" + icon);
        }
        const key = `custom_list:${this.listData.type}:${this.listData.id}`;
        const dock = getDockByType(key);
        if (dock) {
            dock.element.querySelector(`[data-type="${key}"]`)?.querySelector("use")?.setAttribute("xlink:href", "#" + icon);
        }
    }

    private renderHeader(icon: string) {
        this.element.innerHTML = `<div class="block__icons">
    <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#${icon}"></use></svg>${this.listData.title}
    </div>
    <span class="fn__flex-1 fn__space"></span>
    <span data-type="refresh" class="block__icon ariaLabel" aria-label="${siyuanI18n.refresh}">
        <svg><use xlink:href="#iconRefresh"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="more" class="block__icon ariaLabel" aria-label="${siyuanI18n.more}">
        <svg><use xlink:href="#iconMore"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="remove" class="block__icon ariaLabel" aria-label="${siyuanI18n.remove}">
        <svg><use xlink:href="#iconTrashcan"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="collapse" class="block__icon ariaLabel" aria-label="${siyuanI18n.collapse}">
        <svg><use xlink:href="#iconContract"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="min" class="block__icon ariaLabel" aria-label="${siyuanI18n.min}">
        <svg><use xlink:href="#iconMin"></use></svg>
    </span>
</div>
<div class="fn__flex-1" style="overflow:auto;"></div>`;
    }

    private renderData(blocks: IBlock[]) {
        const treeData = blocks.map(block => mapBlockToTreeData(block));
        this.tree.updateData(treeData);
    }

    private onMessage(data: IWebSocketData) {
        if (data.cmd === "transactions" && this.listData.type === "dynamic") {
            // Optional: debounce update
        }
    }

    private bindEvents() {
        this.element.addEventListener("click", (event: MouseEvent) => {
            let target = event.target as HTMLElement | null;
            while (target && !target.isEqualNode(this.element)) {
                if (target.classList.contains("block__icon")) {
                    const type = target.getAttribute("data-type");
                    this.handleIconClick(type, event);
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                }
                target = target.parentElement;
            }
        });
    }

    private handleIconClick(type: string | null, event?: MouseEvent) {
        if (!type || !this.listData) {
 return; 
}
        switch (type) {
            case "refresh":
                this.update();
                break;
            case "collapse":
                this.tree.collapseAll();
                break;
            case "min":
                const key = `custom_list:${this.listData.type}:${this.listData.id}`;
                getDockByType(key).toggleModel(key, false, true);
                break;
            case "remove": {
                if (!this.listData.id) {
                    break;
                }
                handleRemoveFromStorage(this.listData.id, this.listData);
                break;
            }
            case "more":
                if (event) {
                    showCustomListMenu(this.app, this, event);
                }
                break;
        }
    }

    private onTreeClick(element: HTMLElement, event?: MouseEvent) {
        const id = element.getAttribute("data-node-id");
        if (!id) {
            return;
        }

        if (event && this.handleItemRemove(element, event, id)) {
            return;
        }

        // @内联回调
        checkFold(id, (zoomIn: boolean, action: TProtyleAction[]) => {
            openFileById({
                app: this.app,
                id,
                action,
                zoomIn
            });
        });
    }

    private handleItemRemove(element: HTMLElement, event: MouseEvent, id: string): boolean {
        let target = event.target as HTMLElement;
        while (target && !target.isEqualNode(element)) {
            if (target.classList.contains("b3-list-item__action")) {
                if (handleRemoveItemFromList(id, this.listData)) {
                    this.update();
                }
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
            target = target.parentElement;
        }
        return false;
    }

    private toggleItem(liElement: HTMLElement) {
        if (!liElement.nextElementSibling) {
            return;
        }
        const svgElement = liElement.firstElementChild?.firstElementChild;
        if (!svgElement) {
            return;
        }
        if (svgElement.classList.contains("b3-list-item__arrow--open")) {
            this.collapseItem(liElement, svgElement);
            return;
        }

        this.expandItem(liElement, svgElement);
    }

    private collapseItem(liElement: HTMLElement, svgElement: Element) {
        svgElement.classList.remove("b3-list-item__arrow--open");
        const nextSibling = liElement.nextElementSibling;
        if (nextSibling && nextSibling.tagName === "DIV") {
            const index = this.editors.findIndex(e => e.protyle?.element === nextSibling);
            if (index > -1) {
                const editor = this.editors[index];
                editor?.destroy();
                this.editors.splice(index, 1);
            }
            nextSibling.remove();
        }

        const childrenList = liElement.nextElementSibling;
        if (childrenList?.tagName === "UL") {
            childrenList.classList.add("fn__none");
        }
    }

    private expandItem(liElement: HTMLElement, svgElement: Element) {
        svgElement.classList.add("b3-list-item__arrow--open");
        const nextSibling = liElement.nextElementSibling;
        if (nextSibling && nextSibling.tagName === "UL") {
            nextSibling.classList.remove("fn__none");
        }

        const id = liElement.getAttribute("data-node-id");
        if (!id) {
            return;
        }

        // Ensure proper cleanup if re-expanding
        if (nextSibling && nextSibling.tagName === "DIV") {
            return;
        }

        const editorElement = document.createElement("div");
        editorElement.style.minHeight = "auto";

        liElement.after(editorElement);

        try {
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
        } catch (e) {
            console.error(e);
        }
    }
}


const sqlTypeToNodeType = (type: string): string => {
    switch (type) {
        case "d": return "NodeDocument";
        case "h": return "NodeHeading";
        case "p": return "NodeParagraph";
        case "l": return "NodeList";
        case "i": return "NodeListItem";
        case "q": return "NodeBlockquote";
        case "c": return "NodeCodeBlock";
        case "m": return "NodeMathBlock";
        case "t": return "NodeTable";
        case "s": return "NodeSuperBlock";
        case "b": return "NodeBlockQueryEmbed"; // b is usually embed in some contexts, or check
        case "av": return "NodeAttributeView";
        default: return "NodeParagraph";
    }
};

const mapBlockToTreeData = (block: IBlock): IBlockTree => {
    const nodeType = sqlTypeToNodeType(block.type || "p");
    return {
        id: block.id,
        text: block.content || "Untitled",
        name: block.content || "Untitled",
        icon: getIconByType(nodeType, block.subType),
        showArrow: true,
        type: nodeType, // Use full type
        nodeType: nodeType,
        subType: block.subType,
        box: block.box,
        hPath: block.hPath,
        depth: 0,
        ial: block.ial || {}
    };
};