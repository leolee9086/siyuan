/**
 * Forwardlink.ts - 正向链接 Dock 组件
 * 
 * 作用：显示当前文档引用的其他文档/块列表 ("我引用了谁")
 * 意图：与反向链接 (Backlink) 相反，提供正向的引用关系视图
 * 
 * 核心差异:
 * - 反向链接: SELECT ... FROM refs WHERE def_block_id = 当前块ID (谁引用了我)
 * - 正向链接: SELECT ... FROM refs WHERE root_id = 当前文档ID (我引用了谁)
 */

import { Tab } from "../Tab";
import { Model } from "../Model";
import { Tree } from "../../util/Tree";
import { setPanelFocus } from "../utils/setPanelFocus";
import { getDockByType } from "../tabUtil";
import { fetchPost } from "../../util/fetch";
import { Constants } from "../../constants";
import { updateHotkeyAfterTip } from "../../protyle/util/compatibility";
import { openFileById } from "../../editor/utils.openFileById";
import { Protyle } from "../../protyle";
import { MenuItem } from "../../menus/Menu.Item";
import { App } from "../../index";
import { getIconByType } from "../../editor/getIcon";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { forgeI18n } from "../../util/siyuanEnvironments/forgeI18n.getI18n.environment";

/**
 * 正向链接树节点数据
 */
interface IForwardlinkTreeNode {
    id: string;
    name: string;
    type: string;
    subType?: string;
    box: string;
    hPath: string;
    count: number;
    children?: IForwardlinkTreeNode[];
}

/**
 * 正向链接 Dock 组件
 */
export class Forwardlink extends Model {
    public element: HTMLElement;
    public inputsElement: NodeListOf<HTMLInputElement>;
    public type: "pin" | "local";
    public blockId: string;
    public rootId: string;
    public tree: Tree;
    private notebookId: string;
    public editors: Protyle[] = [];
    public status: {
        [key: string]: {
            sort: number,
            scrollTop: number,
            forwardlinkOpenIds: string[],
        }
    } = {};

    constructor(options: {
        app: App,
        tab: Tab,
        blockId: string,
        rootId?: string,
        type: "pin" | "local"
    }) {
        super({
            app: options.app,
            id: options.tab.id,
            callback() {
                if (this.type === "local") {
                    fetchPost("/api/block/checkBlockExist", { id: this.blockId }, existResponse => {
                        if (!existResponse.data) {
                            this.parent.parent.removeTab(this.parent.id);
                        }
                    });
                }
            },
            msgCallback(data) {
                if (data && this.type === "local") {
                    switch (data.cmd) {
                        case "rename":
                            if (this.rootId === data.data.id) {
                                this.parent.updateTitle(data.data.title);
                            }
                            break;
                        case "unmount":
                            if (this.notebookId === data.data.box && this.type === "local") {
                                this.parent.parent.removeTab(this.parent.id);
                            }
                            break;
                        case "removeDoc":
                            if (data.data.ids.includes(this.rootId) && this.type === "local") {
                                this.parent.parent.removeTab(this.parent.id);
                            }
                            break;
                    }
                }
            }
        });
        this.blockId = options.blockId;
        this.rootId = options.rootId || options.blockId;
        this.type = options.type;
        this.element = options.tab.panelElement;
        this.element.classList.add("fn__flex-column", "file-tree", "sy__forwardlink");

        const defaultSort = "0"; // 默认按文件名升序
        this.element.innerHTML = `<div class="block__icons">
    <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconLink"></use></svg>${forgeI18n.正向链接 || "正向链接"}
    </div>
    <span class="counter listCount" style="margin-left: 0"></span>
    <span class="fn__flex-1"></span>
    <span class="fn__space"></span>
    <input class="b3-text-field search__label fn__none fn__size200" placeholder="${siyuanI18n.filterKeywordEnter}" />
    <span data-type="search" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.filter}"><svg><use xlink:href='#iconFilter'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="refresh" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.refresh}"><svg><use xlink:href='#iconRefresh'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="sort" data-sort="${defaultSort}" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.sort}"><svg><use xlink:href='#iconSort'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="expand" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.expand}${updateHotkeyAfterTip(window.siyuan.config.keymap.editor.general.expand.custom)}">
        <svg><use xlink:href="#iconExpand"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="collapse" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.collapse}${updateHotkeyAfterTip(window.siyuan.config.keymap.editor.general.collapse.custom)}">
        <svg><use xlink:href="#iconContract"></use></svg>
    </span>
    <span class="${this.type === "local" ? "fn__none " : ""}fn__space"></span>
    <span data-type="min" class="${this.type === "local" ? "fn__none " : ""}block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.min}${updateHotkeyAfterTip(window.siyuan.config.keymap.general.closeTab.custom)}"><svg><use xlink:href='#iconMin'></use></svg></span>
</div>
<div class="forwardlinkList fn__flex-1"></div>`;

        this.inputsElement = this.element.querySelectorAll("input");
        this.inputsElement.forEach((item) => {
            item.addEventListener("blur", (event: KeyboardEvent) => {
                const inputElement = event.target as HTMLInputElement;
                inputElement.classList.add("fn__none");
                const filterIconElement = inputElement.nextElementSibling;
                if (inputElement.value) {
                    filterIconElement.classList.add("block__icon--active");
                    filterIconElement.setAttribute("aria-label", siyuanI18n.filter + " " + inputElement.value);
                } else {
                    filterIconElement.classList.remove("block__icon--active");
                    filterIconElement.setAttribute("aria-label", siyuanI18n.filter);
                }
            });
            item.addEventListener("keydown", (event: KeyboardEvent) => {
                if (!event.isComposing && event.key === "Enter") {
                    this.搜索正向链接();
                }
            });
        });

        this.tree = new Tree({
            element: this.element.querySelector(".forwardlinkList") as HTMLElement,
            data: null,
            click: (element) => {
                this.toggleItem(element);
                this.setFocus();
            },
            ctrlClick: (element) => {
                openFileById({
                    app: options.app,
                    id: element.getAttribute("data-node-id"),
                    action: [Constants.CB_GET_CONTEXT]
                });
            },
            altClick(element) {
                openFileById({
                    app: options.app,
                    id: element.getAttribute("data-node-id"),
                    position: "right",
                    action: [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT]
                });
            },
            shiftClick(element) {
                openFileById({
                    app: options.app,
                    id: element.getAttribute("data-node-id"),
                    position: "bottom",
                    action: [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT]
                });
            },
            toggleClick: (liElement) => {
                this.toggleItem(liElement);
                this.setFocus();
            }
        });

        this.tree.element.addEventListener("scroll", () => {
            this.tree.element.querySelectorAll(".protyle-gutters").forEach(item => {
                item.classList.add("fn__none");
                item.innerHTML = "";
            });
            this.tree.element.querySelectorAll(".protyle-wysiwyg--hl").forEach((hlItem) => {
                hlItem.classList.remove("protyle-wysiwyg--hl");
            });
        });

        // 为了快捷键的 dispatch
        const collapseElement = this.element.querySelector('[data-type="collapse"]');
        if (collapseElement) {
            collapseElement.addEventListener("click", () => {
                this.tree.element.querySelectorAll(".protyle").forEach(item => {
                    item.classList.add("fn__none");
                });
                this.tree.element.querySelectorAll(".b3-list-item__arrow").forEach(item => {
                    item.classList.remove("b3-list-item__arrow--open");
                });
            });
        }

        const expandElement = this.element.querySelector('[data-type="expand"]');
        if (expandElement) {
            expandElement.addEventListener("click", () => {
                const firstChild = this.tree.element.firstElementChild;
                if (firstChild) {
                    Array.from(firstChild.children).forEach((item: HTMLElement) => {
                        if (item.tagName === "LI" && !item.querySelector(".b3-list-item__arrow--open")) {
                            this.toggleItem(item);
                        }
                    });
                }
            });
        }

        this.element.addEventListener("click", (event) => {
            this.setFocus();
            let target = event.target as HTMLElement;
            while (target && !target.isEqualNode(this.element)) {
                if (target.classList.contains("block__icon") && target.parentElement.parentElement === this.element) {
                    const type = target.getAttribute("data-type");
                    switch (type) {
                        case "refresh":
                            this.refresh();
                            break;
                        case "min":
                            getDockByType("forwardlink")?.toggleModel("forwardlink", false, true);
                            break;
                        case "search":
                            target.previousElementSibling.classList.remove("fn__none");
                            (target.previousElementSibling as HTMLInputElement).select();
                            break;
                        case "sort":
                            this.显示排序菜单(target.getAttribute("data-sort") || "0");
                            window.siyuan.menus.menu.popup({ x: event.clientX, y: event.clientY });
                            event.stopPropagation();
                            break;
                    }
                }
                target = target.parentElement;
            }
        });

        this.搜索正向链接(true);
    }

    private setFocus() {
        if (this.type === "local") {
            setPanelFocus(this.element.parentElement.parentElement);
        } else {
            setPanelFocus(this.element);
        }
    }

    /**
     * 显示排序菜单
     */
    private 显示排序菜单(sort: string) {
        const clickEvent = (currentSort: string) => {
            const sortElement = this.tree.element.previousElementSibling?.querySelector('[data-type="sort"]');
            if (sortElement) {
                sortElement.setAttribute("data-sort", currentSort);
            }
            this.搜索正向链接();
        };
        window.siyuan.menus.menu.remove();
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "0" ? "iconSelect" : undefined,
            label: siyuanI18n.fileNameASC,
            click: () => {
                clickEvent("0");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "1" ? "iconSelect" : undefined,
            label: siyuanI18n.fileNameDESC,
            click: () => {
                clickEvent("1");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "4" ? "iconSelect" : undefined,
            label: siyuanI18n.fileNameNatASC,
            click: () => {
                clickEvent("4");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "5" ? "iconSelect" : undefined,
            label: siyuanI18n.fileNameNatDESC,
            click: () => {
                clickEvent("5");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({ type: "separator" }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "9" ? "iconSelect" : undefined,
            label: siyuanI18n.createdASC,
            click: () => {
                clickEvent("9");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "10" ? "iconSelect" : undefined,
            label: siyuanI18n.createdDESC,
            click: () => {
                clickEvent("10");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "2" ? "iconSelect" : undefined,
            label: siyuanI18n.modifiedASC,
            click: () => {
                clickEvent("2");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "3" ? "iconSelect" : undefined,
            label: siyuanI18n.modifiedDESC,
            click: () => {
                clickEvent("3");
            }
        }).element);
    }

    /**
     * 展开/折叠列表项
     */
    private toggleItem(liElement: HTMLElement) {
        const svgElement = liElement.firstElementChild?.firstElementChild;
        if (!svgElement) {
            return;
        }

        const type = liElement.getAttribute("data-type");
        const id = liElement.getAttribute("data-node-id");
        if (!id) {
            return;
        }

        if (svgElement.classList.contains("b3-list-item__arrow--open")) {
            svgElement.classList.remove("b3-list-item__arrow--open");
            this.collapseItem(liElement);
        } else {
            svgElement.classList.add("b3-list-item__arrow--open");
            if (type === "NodeDocument") {
                this.fetchAndRenderBlocks(liElement, id);
            } else {
                this.renderBlockProtyle(liElement, id);
            }
        }
    }

    private collapseItem(liElement: HTMLElement) {
        const nextSibling = liElement.nextElementSibling as HTMLElement;
        if (nextSibling && nextSibling.getAttribute("data-type") === "wrapper") {
            const editorElement = nextSibling.querySelector(".protyle") as HTMLElement;
            if (editorElement) {
                const index = this.editors.findIndex(e => e.protyle.element === editorElement);
                if (index > -1) {
                    this.editors[index]?.destroy();
                    this.editors.splice(index, 1);
                }
            }
            nextSibling.remove();
        } else if (nextSibling) {
            // Fallback for old invalid DOM if present
            if (nextSibling.tagName === "UL") {
                nextSibling.remove();
            } else if (nextSibling.tagName === "DIV") {
                const index = this.editors.findIndex(e => e.protyle?.element === nextSibling);
                if (index > -1) {
                    this.editors[index]?.destroy();
                    this.editors.splice(index, 1);
                }
                nextSibling.remove();
            }
        }
    }

    private fetchAndRenderBlocks(liElement: HTMLElement, docId: string) {
        const sql = `
            SELECT 
                b.id,
                b.content,
                b.type,
                b.subType,
                b.box
            FROM refs AS r
            INNER JOIN blocks AS b ON b.id = r.def_block_id
            WHERE r.root_id = '${this.rootId}' 
            AND r.def_block_root_id = '${docId}'
            ORDER BY b.updated DESC
            LIMIT 64
        `;

        fetchPost("/api/query/sql", { stmt: sql }, (response) => {
            if (!response.data || response.data.length === 0) {
                return;
            }

            const wrapper = document.createElement("li");
            wrapper.setAttribute("data-type", "wrapper");
            wrapper.style.display = "block";

            const ul = document.createElement("ul");
            ul.className = "b3-list b3-list--background";

            let html = "";
            response.data.forEach((block: any) => {
                const icon = getIconByType(block.type, block.subType);
                // 暂时使用 escapeHtml 简单处理 content，或者不仅进行处理
                // CustomLists 使用 mapBlockToTreeData 处理
                html += `<li data-node-id="${block.id}" data-type="${block.type}" data-subtype="${block.subType || ''}" class="b3-list-item b3-list-item--hide-action">
                    <span class="b3-list-item__toggle"><svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg></span>
                    <span class="b3-list-item__icon"><svg><use xlink:href="#${icon}"></use></svg></span>
                    <span class="b3-list-item__text">${block.content || "无内容"}</span>
                </li>`;
            });
            ul.innerHTML = html;
            wrapper.appendChild(ul);
            liElement.after(wrapper);
        });
    }

    private renderBlockProtyle(liElement: HTMLElement, blockId: string) {
        const wrapper = document.createElement("li");
        wrapper.setAttribute("data-type", "wrapper");
        wrapper.style.display = "block";

        const editorElement = document.createElement("div");
        editorElement.style.minHeight = "auto";
        editorElement.className = "protyle"; // Marker class for collapse search

        wrapper.appendChild(editorElement);
        liElement.after(wrapper);

        try {
            const editor = new Protyle(this.app, editorElement, {
                blockId: blockId,
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

    /**
     * 刷新正向链接数据
     */
    public refresh() {
        this.搜索正向链接();
    }

    /**
     * 搜索正向链接
     * 
     * 作用：查询当前文档引用的所有目标块
     * 使用 SQL API 查询 refs 表，获取 root_id = 当前文档 的所有引用记录
     */
    private 搜索正向链接(init = false) {
        const element = this.element.querySelector('.block__icon[data-type="refresh"] svg');
        if (element?.classList.contains("fn__rotate")) {
            return;
        }
        element?.classList.add("fn__rotate");

        if (!this.rootId) {
            element?.classList.remove("fn__rotate");
            this.渲染数据({ forwardlinks: [], count: 0 });
            return;
        }

        const keyword = this.inputsElement[0]?.value || "";
        const sortAttr = this.tree.element.previousElementSibling?.querySelector('[data-type="sort"]')?.getAttribute("data-sort") || "0";

        // 构建排序条件
        let orderBy = "b.hPath ASC";
        switch (sortAttr) {
            case "0": orderBy = "b.hPath ASC"; break;
            case "1": orderBy = "b.hPath DESC"; break;
            case "2": orderBy = "b.updated ASC"; break;
            case "3": orderBy = "b.updated DESC"; break;
            case "4": orderBy = "b.hPath ASC"; break; // 自然排序前端处理
            case "5": orderBy = "b.hPath DESC"; break;
            case "9": orderBy = "b.created ASC"; break;
            case "10": orderBy = "b.created DESC"; break;
        }

        // 关键词过滤条件
        const keywordCondition = keyword
            ? `AND (b.content LIKE '%${keyword.replace(/'/g, "''")}%' OR b.hPath LIKE '%${keyword.replace(/'/g, "''")}%')`
            : "";

        // SQL 查询：获取当前文档引用的所有目标文档
        const sql = `
            SELECT DISTINCT 
                r.def_block_root_id as id,
                b.content as name,
                b.type,
                b.box,
                b.hPath,
                COUNT(*) as refCount
            FROM refs AS r
            INNER JOIN blocks AS b ON b.id = r.def_block_root_id
            WHERE r.root_id = '${this.rootId}'
            ${keywordCondition}
            GROUP BY r.def_block_root_id
            ORDER BY ${orderBy}
            LIMIT 512
        `;

        fetchPost("/api/query/sql", { stmt: sql }, response => {
            if (!init) {
                this.保存状态();
            }
            const data = response.data || [];
            this.渲染数据({
                forwardlinks: data.map((item: any) => ({
                    id: item.id,
                    name: item.name || item.hPath || "无标题",
                    type: "NodeDocument",
                    box: item.box,
                    hPath: item.hPath,
                    count: item.refCount || 1
                })),
                count: data.length
            });
        });
    }

    /**
     * 保存当前状态
     */
    public 保存状态() {
        const sortElement = this.tree.element.previousElementSibling?.querySelector('[data-type="sort"]');
        this.status[this.rootId] = {
            sort: parseInt(sortElement?.getAttribute("data-sort") || "0"),
            scrollTop: this.tree.element.scrollTop,
            forwardlinkOpenIds: []
        };
        this.tree.element.querySelectorAll(".b3-list-item__arrow--open").forEach(item => {
            const nodeId = item.closest("[data-node-id]")?.getAttribute("data-node-id");
            if (nodeId) {
                this.status[this.rootId].forwardlinkOpenIds.push(nodeId);
            }
        });
    }

    /**
     * 渲染正向链接数据
     */
    public 渲染数据(data: {
        forwardlinks: IForwardlinkTreeNode[],
        count: number
    }) {
        this.editors.forEach(item => {
            item.destroy();
        });
        this.editors = [];

        const refreshElement = this.element.querySelector('.block__icon[data-type="refresh"] svg');
        refreshElement?.classList.remove("fn__rotate");

        // 转换为 Tree 组件需要的数据格式
        const treeData: IBlockTree[] = data.forwardlinks.map(item => ({
            id: item.id,
            name: item.name,
            type: item.type,
            subType: item.subType || "",
            box: item.box,
            depth: 0,
            count: item.count,
            nodeType: item.type,
            hPath: item.hPath
        }));

        this.tree.updateData(treeData);

        // 更新计数显示
        const countElement = this.element.querySelector(".listCount");
        if (countElement) {
            if (data.count === 0) {
                countElement.classList.add("fn__none");
            } else {
                countElement.classList.remove("fn__none");
                countElement.textContent = data.count.toString();
            }
        }

        // 恢复状态
        if (this.status[this.rootId]) {
            this.status[this.rootId].forwardlinkOpenIds.forEach(id => {
                const liElement = this.tree.element.querySelector(`.b3-list-item[data-node-id="${id}"]`) as HTMLElement;
                if (liElement) {
                    this.toggleItem(liElement);
                }
            });

            const sortElement = this.tree.element.previousElementSibling?.querySelector('[data-type="sort"]');
            if (sortElement) {
                sortElement.setAttribute("data-sort", this.status[this.rootId].sort.toString());
            }

            setTimeout(() => {
                this.tree.element.scrollTop = this.status[this.rootId].scrollTop;
            }, Constants.TIMEOUT_LOAD);
        }
    }
}
