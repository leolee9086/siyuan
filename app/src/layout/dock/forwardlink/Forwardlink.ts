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

import { Tab } from "../../Tab";
import { Model } from "../../Model";
import { Tree } from "../../../util/Tree";
import { setPanelFocus } from "../../utils/setPanelFocus";
import { getDockByType } from "../../tabUtil";
import { fetchPost } from "../../../util/fetch";
import { Constants } from "../../../constants";
import { openFileById } from "../../../editor/utils.openFileById";
import { Protyle } from "../../../protyle";
import { App } from "../../../index";
import { getIconByType } from "../../../editor/getIcon";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { IForwardlinkTreeNode, IForwardlinkStatus } from "./Forwardlink.types";
import { genForwardlinkHTML } from "./Forwardlink.html";
import { showSortMenu } from "./Forwardlink.menu";
import { searchForwardLinks, fetchBlocks } from "./Forwardlink.data";

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
    public status: IForwardlinkStatus = {};

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
        this.element.innerHTML = genForwardlinkHTML(this.type, defaultSort);

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
                            {
                                const sort = target.getAttribute("data-sort") || "0";
                                showSortMenu(sort, this.tree.element, () => this.搜索正向链接());
                                window.siyuan.menus.menu.popup({ x: event.clientX, y: event.clientY });
                            }
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
        fetchBlocks(this.rootId, docId, (blocks) => {
            if (blocks.length === 0) {
                return;
            }

            const wrapper = document.createElement("li");
            wrapper.setAttribute("data-type", "wrapper");
            wrapper.style.display = "block";

            const ul = document.createElement("ul");
            ul.className = "b3-list b3-list--background";

            let html = "";
            blocks.forEach((block: any) => {
                const icon = getIconByType(block.type, block.subType);
                // CustomLists 使用 mapBlockToTreeData 处理
                html += `<li data-node-id="${block.id}" data-type="${block.type}" data-subtype="${block.subType || ""}" class="b3-list-item b3-list-item--hide-action">
                    <span class="b3-list-item__toggle"><svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg></span>
                    <svg class="b3-list-item__graphic"><use xlink:href="#${icon}"></use></svg>
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

        searchForwardLinks(this.rootId, keyword, sortAttr, (data) => {
            if (!init) {
                this.保存状态();
            }
            this.渲染数据(data);
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
