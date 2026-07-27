/**
 * 用途：页签完整领域抽象。使用范围：CustomLists 的父宿主和公开契约。解耦评估：纯类型依赖，不加载 Tab class。
 */
import type {LayoutTab} from "../../layout.types";
/**
 * 用途：模型基类。使用范围：CustomLists 继承自 Model。解耦评估：框架基类，必须继承。
 */
import { Model } from "../../Model";
/**
 * 用途：应用实例类型。使用范围：构造和调用参数。解耦评估：通过 imports 引入。
 */
import type { AppFacade } from "../../../app/AppFacade.types";
/**
 * 用途：HTTP POST 请求。使用范围：数据查询和更新。解耦评估：作为网络基础设施直接导入。
 */
import { fetchPost } from "../../../util/network/fetch";
/**
 * 用途：树形列表完整领域抽象。使用范围：CustomLists 数据展示。解耦评估：具体 Tree 由组合工厂注入。
 */
import type {TreeDomain, TreeOptions} from "../../../util/file/tree.types";
/**
 * 用途：检查块折叠状态。使用范围：树节点点击时判断是否需要 zoomIn。解耦评估：平台工具函数，通过参数传递解耦。
 */
import {checkFold} from "../../../block/fold/checkFold";
/**
 * 用途：根据 ID 打开文件。使用范围：树节点点击打开。解耦评估：通过 openFileById 参数注入。
 */
import { openFileById } from "../../../editor/utils.openFileById";
/**
 * 用途：块编辑器完整领域抽象。使用范围：展开树节点时创建内嵌编辑器。解耦评估：具体 Protyle 由组合工厂注入。
 */
import type {ProtyleDomain} from "../../../protyle/protyle.types";
/**
 * 用途：Dock 完整领域抽象。使用范围：注入的 Dock 查找结果。解耦评估：纯类型依赖，不加载 Dock class。
 */
import type {DockDomain} from "../dock.types";
/**
 * 用途：自定义列表工具函数。使用范围：图标、扩展 HTML、存储操作。解耦评估：工具函数集合。
 */
import { getCustomListIcon, getTopExtHTML, handleRemoveFromStorage, handleRemoveItemFromList } from "./customLists.util";
/**
 * 用途：类型定义。使用范围：类型约束。解耦评估：纯类型定义。
 */
import { ICustomList, IBlock } from "./customLists.types";

/** @同步豁免: UI构建 - 更新 dock 图标必须同步操作 DOM */
const updateDockIcon = (
    tab: LayoutTab,
    icon: string,
    listData: ICustomList,
    getDockByType: (type: string) => DockDomain | undefined,
) => {
    const key = `custom_list:${listData.type}:${listData.id}`;
    const dock = getDockByType(key);
    if (!dock) {
        return;
    }
    // 仅当图标变更时才更新 DOM，避免冗余操作
    if (tab.icon !== icon) {
        tab.icon = icon;
        tab.headElement?.querySelector("use")?.setAttribute("xlink:href", "#" + icon);
    }
    dock.elements[0]?.querySelector(`[data-type="${key}"]`)?.querySelector("use")?.setAttribute("xlink:href", "#" + icon);
};

/** @同步豁免: UI构建 - 头部 HTML 渲染必须同步完成 */
const renderHeader = (element: HTMLElement, icon: string, title: string) => {
    const siyuanI18n = window.siyuan.languages;
    element.innerHTML = `<div class="block__icons">
    <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#${icon}"></use></svg>${title}
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
};

/** @同步豁免: UI构建 - 树数据更新必须同步完成 */
const renderData = (blocks: IBlock[], tree: TreeDomain) => {
    const sqlTypeMap: Record<string, string> = {
        d: "NodeDocument", h: "NodeHeading", p: "NodeParagraph",
        l: "NodeList", i: "NodeListItem", q: "NodeBlockquote",
        c: "NodeCodeBlock", m: "NodeMathBlock", t: "NodeTable",
        s: "NodeSuperBlock", b: "NodeBlockQueryEmbed", av: "NodeAttributeView",
    };
    const treeData = blocks.map(block => {
        const nodeType = sqlTypeMap[block.type || "p"] || "NodeParagraph";
        return {
            id: block.id,
            name: block.content || "Untitled",
            icon: window.siyuan.util.getIconByType(nodeType, block.subType),
            showArrow: true,
            type: nodeType,
            nodeType: nodeType,
            subType: block.subType || "",
            box: block.box || "",
            hPath: block.hPath || "",
            depth: 0,
        } as IBlockTree;
    });
    tree.updateData(treeData);
};

const handleContainerClick = (
    event: MouseEvent,
    owner: CustomLists,
    showMenu: (app: AppFacade, customList: CustomLists, event: MouseEvent) => void,
) => {
    let target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }
    // 沿 DOM 冒泡查找点击的工具栏图标
    while (target && !target.isEqualNode(owner.element)) {
        if (target.classList.contains("block__icon")) {
            const type = target.getAttribute("data-type");
            if (type === "more") {
                showMenu(owner.app, owner, event);
            } else {
                owner.handleIconClick(type, event);
            }
            event.preventDefault();
            event.stopPropagation();
            break;
        }
        target = target.parentElement;
    }
};

const handleItemRemoveOnTree = (
    target: HTMLElement,
    element: HTMLElement,
    event: MouseEvent,
    id: string,
    owner: CustomLists,
    saveCustomLists: (customLists: Record<string, ICustomList>) => void,
) => {
    let current = target;
    // 沿 DOM 冒泡查找列表项删除按钮
    while (current && !current.isEqualNode(element)) {
        if (current.classList.contains("b3-list-item__action")) {
            // 从静态列表的 ID 数组中移除并持久化
            if (handleRemoveItemFromList(id, owner.listData, saveCustomLists)) {
                owner.update();
            }
            event.preventDefault();
            event.stopPropagation();
            return true;
        }
        current = current.parentElement;
    }
    return false;
};

/**
 * 图标工具栏操作映射表
 * key: data-type 属性值，value: 处理函数
 */
const getIconHandlers = (
    owner: CustomLists,
    getDockByType: (type: string) => DockDomain | undefined,
    saveCustomLists: (customLists: Record<string, ICustomList>) => void,
): Record<string, () => void> => ({
    refresh: () => owner.update(),
    collapse: () => owner.tree.collapseAll(),
    min: () => {
        const key = `custom_list:${owner.listData.type}:${owner.listData.id}`;
        getDockByType(key)?.toggleModel(key, false, true);
    },
    remove: () => {
        if (owner.listData.id) {
            const key = `custom_list:${owner.listData.type}:${owner.listData.id}`;
            handleRemoveFromStorage(owner.listData.id, owner.listData, getDockByType(key), saveCustomLists);
        }
    },
});

/**
 * 将 SQL 短类型名映射为 Lute AST 节点类型全名
 * @param type - SQL 查询返回的块类型短名
 */
const sqlTypeToNodeType = (type: string) => {
    const map: Record<string, string> = {
        d: "NodeDocument", h: "NodeHeading", p: "NodeParagraph",
        l: "NodeList", i: "NodeListItem", q: "NodeBlockquote",
        c: "NodeCodeBlock", m: "NodeMathBlock", t: "NodeTable",
        s: "NodeSuperBlock", b: "NodeBlockQueryEmbed", av: "NodeAttributeView",
    };
    return map[type] || "NodeParagraph";
};

// @允许继承: FrameworkRequired - Model 是框架要求的基类，所有面板类都必须继承
export class CustomLists extends Model<AppFacade, LayoutTab> {
    public element: HTMLElement;
    public tree: TreeDomain;
    public listData: ICustomList;
    public editors: ProtyleDomain[] = [];
    private readonly getDockByType: (type: string) => DockDomain | undefined;
    private readonly saveCustomLists: (customLists: Record<string, ICustomList>) => void;

    constructor(
        app: AppFacade,
        tab: LayoutTab,
        data: ICustomList,
        getDockByType: (type: string) => DockDomain | undefined,
        saveCustomLists: (customLists: Record<string, ICustomList>) => void,
        createTree: (options: TreeOptions) => TreeDomain,
        createProtyle: (app: AppFacade, element: HTMLElement, options: IProtyleOptions) => ProtyleDomain,
        showMenu: (app: AppFacade, customList: CustomLists, event: MouseEvent) => void,
    ) {
        super({
            app,
            id: tab.id,
            msgCallback: (msgData) => {
                // WebSocket 消息回调，触发数据源为动态列表的更新
                if (msgData.cmd === "transactions" && data.type === "dynamic") {
                    // 动态列表收到事务通知时可在此处 debounce 刷新
                }
            }
        });
        this.element = tab.panelElement;
        this.listData = data;
        this.getDockByType = getDockByType;
        this.saveCustomLists = saveCustomLists;

        this.element.classList.add("fn__flex-column", "file-tree", "sy__custom-list");
        const icon = getCustomListIcon(this.listData.type);
        updateDockIcon(tab, icon, data, getDockByType);
        renderHeader(this.element, icon, data.title);

        const treeElement = this.element.querySelector(":scope > :last-child");
        if (!(treeElement instanceof HTMLElement)) {
            throw new Error("CustomLists: tree container not found");
        }
        this.tree = createTree({
            element: treeElement,
            data: [],
            topExtHTML: getTopExtHTML(this.listData.type),
            click: (element: HTMLElement, clickEvent?: MouseEvent) => {
                const id = element.getAttribute("data-node-id");
                // 缺少节点 ID 时不处理
                if (!id) {
                    return;
                }
                // 检查是否为列表项删除操作
                if (clickEvent && clickEvent.target instanceof HTMLElement) {
                    if (handleItemRemoveOnTree(clickEvent.target, element, clickEvent, id, this, saveCustomLists)) {
                        return;
                    }
                }
                // 检查折叠状态后打开文件
                checkFold(id, (zoomIn: boolean, action: TProtyleAction[]) => {
                    openFileById({
                        app: this.app,
                        id,
                        action,
                        zoomIn
                    });
                });
            },
            toggleClick: (liElement: HTMLElement) => {
                // 无相邻节点时不处理
                if (!liElement.nextElementSibling) {
                    return;
                }
                const svgElement = liElement.firstElementChild?.firstElementChild;
                if (!svgElement) {
                    return;
                }
                // 判断当前折叠状态并切换
                if (svgElement.classList.contains("b3-list-item__arrow--open")) {
                    svgElement.classList.remove("b3-list-item__arrow--open");
                    // 移除相邻的编辑器 DOM 节点
                    const nextSibling = liElement.nextElementSibling;
                    if (nextSibling && nextSibling.tagName === "DIV") {
                        const index = this.editors.findIndex(e => e.protyle?.element === nextSibling);
                        if (index > -1) {
                            this.editors[index]?.destroy();
                            this.editors.splice(index, 1);
                        }
                        nextSibling.remove();
                    }
                    // 隐藏子列表
                    const childrenList = liElement.nextElementSibling;
                    if (childrenList?.tagName === "UL") {
                        childrenList.classList.add("fn__none");
                    }
                    return;
                }
                svgElement.classList.add("b3-list-item__arrow--open");
                // 显示子列表
                const nextSibling = liElement.nextElementSibling;
                if (nextSibling && nextSibling.tagName === "UL") {
                    nextSibling.classList.remove("fn__none");
                }
                const blockId = liElement.getAttribute("data-node-id");
                // 缺少块 ID 时不创建编辑器
                if (!blockId) {
                    return;
                }
                // 防止重复展开
                if (nextSibling && nextSibling.tagName === "DIV") {
                    return;
                }
                const editorElement = document.createElement("div");
                editorElement.style.minHeight = "auto";
                liElement.after(editorElement);
                try {
                    const editor = createProtyle(this.app, editorElement, {
                        blockId: blockId,
                        click: { preventInsetEmptyBlock: true },
                        render: { background: false, gutter: true, scroll: false, breadcrumb: false },
                    });
                    this.editors.push(editor);
                } catch (e) {
                    console.error(e);
                }
            }
        });
        this.element.addEventListener("click", (event) => handleContainerClick(event, this, showMenu));
        this.update();
    }

    /**
     * 刷新列表数据
     * 动态列表根据 target 执行 SQL 查询或全文搜索；静态列表根据 ID 集合查询
     * 调用时机：初始化、点击刷新按钮、数据变更后
     */
    public update() {
        if (this.listData.type === "dynamic") {
            const query = this.listData.target;
            // 空查询不执行
            if (!query) {
                return;
            }
            // SQL 查询模式
            if (query.trim().toLowerCase().startsWith("select")) {
                fetchPost("/api/query/sql", { stmt: query }, (response) => {
                    renderData(response.data, this.tree);
                });
                return;
            }
            let searchConfig: Record<string, unknown> = {
                query: query,
                page: 1,
                pagesize: 50,
            };
            // JSON 格式的搜索配置
            if (query.trim().startsWith("{")) {
                try {
                    const config = JSON.parse(query) as Record<string, unknown>;
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
                } catch (_e) {
                    // JSON 解析失败时作为纯文本查询
                }
            }
            fetchPost("/api/search/fullTextSearchBlock", searchConfig, (response) => {
                const blocks = (response.data as { blocks: IBlock[] }).blocks;
                renderData(blocks, this.tree);
            });
            return;
        }
        // 静态列表模式：target 为块 ID 数组
        if (this.listData.type === "static") {
            const ids = this.listData.target;
            // 无 ID 时清空树
            if (!ids || ids.length === 0) {
                this.tree.updateData([]);
                return;
            }
            const sql = `SELECT * FROM blocks WHERE id IN ('${ids.join("','")}')`;
            fetchPost("/api/query/sql", { stmt: sql }, (response) => {
                renderData(response.data, this.tree);
            });
        }
    }

    /**
     * 更新列表标题并刷新 DOM
     * 调用时机：菜单中编辑标题后
     * @param title - 新标题
     */
    public updateTitle(title: string) {
        this.listData.title = title;
        const logo = this.element.querySelector(".block__logo");
        if (logo) {
            const icon = getCustomListIcon(this.listData.type);
            logo.innerHTML = `<svg class="block__logoicon"><use xlink:href="#${icon}"></use></svg>${title}`;
        }
    }

    /**
     * 处理图标工具栏点击
     * 调用时机：用户点击头部工具栏图标时
     * @param type - data-type 属性值
     * @param event - 原始鼠标事件
     */
    public handleIconClick(type: string | null, _event?: MouseEvent) {
        if (!type) {
            return;
        }
        const handler = getIconHandlers(this, this.getDockByType, this.saveCustomLists)[type];
        if (handler) {
            handler();
        }
    }
}
