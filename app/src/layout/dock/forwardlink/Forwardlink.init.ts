/**
 * Forwardlink.init.ts - 正向链接组件初始化函数
 * 
 * 作用：从 Forwardlink 类提取的初始化相关模块级辅助函数
 * 意图：
 *   1. 将私有方法提取为模块级函数，便于单元测试
 *   2. 避免 Forwardlink.helpers.ts 超过 300 行限制
 */

import { Tree } from "../../../util/file/Tree";
import { Constants } from "../../../constants";
import { openFileById } from "../../../editor/utils.openFileById";
import type { AppFacade } from "../../../app/AppFacade.types";
import type {ForwardlinkDomain} from "./Forwardlink.types";
import { 切换列表项展开, 设置面板焦点 } from "./Forwardlink.helpers";

/**
 * 初始化 Tree 组件
 * 
 * 作用：创建并配置正向链接的 Tree 视图组件
 * 意图：从 Forwardlink 类的私有方法提取为模块级函数，便于单元测试
 * 调用时机：Forwardlink 构造函数中调用
 * 
 * @param forwardlink - Forwardlink 实例
 * @param app - 应用实例
 */
export function 初始化Tree组件(forwardlink: ForwardlinkDomain, app: AppFacade): void {
    const forwardlinkListElement = forwardlink.element.querySelector(".forwardlinkList");
    if (!(forwardlinkListElement instanceof HTMLElement)) {
        throw new Error("Forwardlink: .forwardlinkList 元素不存在");
    }
    forwardlink.tree = new Tree({
        element: forwardlinkListElement,
        data: [],
        /**
         * 单击列表项回调
         * 作用：展开/折叠列表项，并设置面板焦点
         */
        click: (element) => {
            切换列表项展开(forwardlink, element);
            设置面板焦点(forwardlink);
        },
        /**
         * Ctrl+单击回调
         * 作用：在当前编辑器中打开引用的块
         */
        ctrlClick: (element) => {
            const nodeId = element.getAttribute("data-node-id");
            if (!nodeId) {
                return;
            }
            openFileById({
                app: app,
                id: nodeId,
                action: [Constants.CB_GET_CONTEXT]
            });
        },
        /**
         * Alt+单击回调
         * 作用：在右侧新标签页打开引用的块
         */
        altClick(element) {
            const nodeId = element.getAttribute("data-node-id");
            if (!nodeId) {
                return;
            }
            openFileById({
                app: app,
                id: nodeId,
                position: "right",
                action: [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT]
            });
        },
        /**
         * Shift+单击回调
         * 作用：在下方新标签页打开引用的块
         */
        shiftClick(element) {
            const nodeId = element.getAttribute("data-node-id");
            if (!nodeId) {
                return;
            }
            openFileById({
                app: app,
                id: nodeId,
                position: "bottom",
                action: [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT]
            });
        },
        /**
         * 切换按钮点击回调
         * 作用：展开/折叠列表项，并设置面板焦点
         */
        toggleClick: (liElement) => {
            切换列表项展开(forwardlink, liElement);
            设置面板焦点(forwardlink);
        }
    });
}

/**
 * 处理消息回调
 * 
 * 作用：响应文档重命名、笔记本卸载、文档删除等事件
 * 意图：从 Forwardlink 类的私有方法提取为模块级函数，便于单元测试
 * 调用时机：Model 的 msgCallback 中调用
 * 
 * @param forwardlink - Forwardlink 实例
 * @param data - 消息数据
 */
export function 处理消息回调(
    forwardlink: ForwardlinkDomain,
    data: IWebSocketData
): void {
    // 如果消息没有 cmd 字段则忽略
    if (!data.cmd) {
        return;
    }
    const 消息处理映射: Record<string, () => void> = {
        /**
         * 文档重命名处理
         * 当当前显示的文档被重命名时，更新标签页标题
         */
        "rename": () => {
            // 仅当消息中的文档 ID 与当前 rootId 匹配时才更新标题
            if (forwardlink.rootId === data.data.id && data.data.title) {
                forwardlink.parent.updateTitle(data.data.title);
            }
        },
        /**
         * 笔记本卸载处理
         * 当当前文档所属的笔记本被卸载时，关闭标签页
         */
        "unmount": () => {
            // 仅当消息中的笔记本 ID 与当前 notebookId 匹配，且为 local 类型时才关闭
            if (forwardlink.notebookId === data.data.box && forwardlink.type === "local") {
                forwardlink.parent.parent.removeTab(forwardlink.parent.id);
            }
        },
        /**
         * 文档删除处理
         * 当当前显示的文档被删除时，关闭标签页
         */
        "removeDoc": () => {
            // 仅当删除的文档列表包含当前 rootId，且为 local 类型时才关闭
            if (data.data.ids?.includes(forwardlink.rootId) && forwardlink.type === "local") {
                forwardlink.parent.parent.removeTab(forwardlink.parent.id);
            }
        }
    };
    消息处理映射[data.cmd]?.();
}
