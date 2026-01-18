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
import { getDockByType } from "../../tabUtil";
import { fetchPost } from "../../../util/fetch";
import { Constants } from "../../../constants";
import { Protyle } from "../../../protyle";
import { App } from "../../../index";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { IForwardlinkTreeNode, IForwardlinkStatus } from "./Forwardlink.types";
import { genForwardlinkHTML } from "./Forwardlink.html";
import { showSortMenu } from "./Forwardlink.menu";
import {
    切换列表项展开,
    执行正向链接搜索,
    绑定输入框事件,
    绑定Tree滚动事件,
    绑定折叠按钮事件,
    绑定展开按钮事件,
    绑定主元素点击事件,
    初始化Tree组件,
    处理消息回调
} from "./Forwardlink.helpers";
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";

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
            /**
             * 初始化回调
             * 
             * 作用：在 Model 基类初始化完成后执行，检查块是否存在
             * 调用时机：Model 构造函数完成后自动调用
             */
            callback(this: Forwardlink) {
                // 仅对本地类型检查块是否存在，pin 类型是全局共享的
                // 注意：使用 options.type 而非 this.type，因为此时 super() 还未完成，this.type 尚未赋值
                if (options.type === "local") {
                    fetchPost("/api/block/checkBlockExist", { id: this.blockId }, existResponse => {
                        // 块不存在时关闭标签页
                        if (!existResponse.data) {
                            this.parent.parent.removeTab(this.parent.id);
                        }
                    });
                }
            },
            /**
             * 消息回调处理
             * 
             * 作用：响应系统消息事件（如重命名、卸载、删除文档）
             * 调用时机：Model 基类收到 WebSocket 消息时自动调用
             */
            msgCallback(this: Forwardlink, data) {
                // 仅对本地类型响应消息回调,pin 类型不需要响应这些事件
                // 因为 pin 类型是全局共享的,不与特定文档绑定
                // 注意：使用 options.type 而非 this.type，因为此时 super() 还未完成，this.type 尚未赋值
                if (data && options.type === "local") {
                    处理消息回调(this, data);
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
        绑定输入框事件(this, siyuanI18n);

        初始化Tree组件(this, options);
        绑定Tree滚动事件(this);
        绑定折叠按钮事件(this);
        绑定展开按钮事件(this);
        绑定主元素点击事件(this, getDockByType, showSortMenu, getSiyuanGlobalMenusMenu);

        执行正向链接搜索(this, true);
    }



    /**
     * 刷新正向链接数据
     */
    public refresh() {
        执行正向链接搜索(this);
    }

    /**
     * 保存当前状态
     */
    public 保存状态() {
        const sortElement = this.tree.element.previousElementSibling?.querySelector('[data-type="sort"]');
        const forwardlinkOpenIds: string[] = [];
        const savedStatus = {
            sort: parseInt(sortElement?.getAttribute("data-sort") || "0"),
            scrollTop: this.tree.element.scrollTop,
            forwardlinkOpenIds
        };
        this.status[this.rootId] = savedStatus;
        for (const item of this.tree.element.querySelectorAll(".b3-list-item__arrow--open")) {
            const nodeId = item.closest("[data-node-id]")?.getAttribute("data-node-id");
            if (nodeId) {
                savedStatus.forwardlinkOpenIds.push(nodeId);
            }
        }
    }

    /**
     * 渲染正向链接数据
     */
    public 渲染数据(data: {
        forwardlinks: IForwardlinkTreeNode[],
        count: number
    }) {
        for (const editor of this.editors) {
            editor.destroy();
        }
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
            // 当正向链接数量为 0 时，隐藏计数元素而不是显示"0"
            // 这样可以避免显示无意义的数字，保持界面整洁
            if (data.count === 0) {
                countElement.classList.add("fn__none");
            } else {
                countElement.classList.remove("fn__none");
                countElement.textContent = data.count.toString();
            }
        }

        // 恢复状态：如果之前保存过当前文档的状态，则恢复展开项、排序和滚动位置
        const savedStatus = this.status[this.rootId];
        if (savedStatus) {
            for (const id of savedStatus.forwardlinkOpenIds) {
                const liElement = this.tree.element.querySelector(`.b3-list-item[data-node-id="${id}"]`);
                // 只有当元素存在且是 HTMLElement 类型时才展开
                // querySelector 可能返回 null，或者不是 HTMLElement 的元素
                if (liElement instanceof HTMLElement) {
                    切换列表项展开(this, liElement);
                }
            }

            const sortElement = this.tree.element.previousElementSibling?.querySelector('[data-type="sort"]');
            if (sortElement) {
                sortElement.setAttribute("data-sort", savedStatus.sort.toString());
            }

            setTimeout(() => {
                // 延迟执行期间 rootId 可能已变化，需要重新检查状态是否存在
                const currentStatus = this.status[this.rootId];
                if (currentStatus) {
                    this.tree.element.scrollTop = currentStatus.scrollTop;
                }
            }, Constants.TIMEOUT_LOAD);
        }
    }
}
