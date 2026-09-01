/**
 * WebSocket 消息回调处理模块
 *
 * @description
 * 作用：处理来自后端的 WebSocket 消息，更新文件树 UI
 * 意图：将消息处理逻辑从 Files 类中分离，减少主文件行数
 */

import { setNoteBook } from "../../../util/file/pathName";
import type { AppFacade } from "../../../app/AppFacade.types";
import { handleCreateNotebook, handleUpdateDocInfo, handleRemove, handleMount } from "./wsHandlers";
import { applyFileTreeMoves } from "../../../util/fileTreeMoveDom";
import { normalizeFileTreeMoves } from "../../../util/fileTreeMove";
import { handleRenameNotebook, handleCreate } from "./wsHandlers.rename";
import { genDocAriaLabel, genNotebook } from "./htmlGenerators";
import { updateItemArrowFromModule } from "./treeNavigation";
import type { IFilesContext } from "./msgCallbackHandler.types";

// 重新导出类型以保持向后兼容
export type { IFilesContext } from "./msgCallbackHandler.types";

/**
 * 构建消息命令到处理函数的映射
 *
 * @description
 * 作用：创建 WebSocket 命令与对应处理函数的映射表
 * 意图：将映射构建逻辑从主函数中分离，减少函数行数
 * 调用时机：由 handleMsgCallback 在处理消息时调用
 *
 * @param data - WebSocket 消息数据
 * @param app - 应用实例
 * @param context - Files 实例上下文
 * @returns 命令到处理函数的映射
 */
function buildHandlersMap(
    data: IWebSocketData,
    app: AppFacade,
    context: IFilesContext
): Record<string, () => void> {
    const handleMoves = () => applyFileTreeMoves({
    host: {
        element: context.element,
        getLeaf: context.getLeaf,
        recordMovedExpandedDocIDs: context.recordMovedExpandedDocIDs,
        updateDocActionElement: context.updateDocActionElement,
        persistOpenPaths: context.persistOpenPaths,
    },
    moves: normalizeFileTreeMoves(data.data),
    ...(data.callback ? {callback: data.callback} : {}),
});
    return {
        /** 重新加载文档信息：更新文档的 aria-label 等元数据 */
        reloadDocInfo: () => handleUpdateDocInfo(context.element, data, genDocAriaLabel),
        /** 批量移动文档：同步文件树位置并保留已展开子树。 */
        moveDoc: handleMoves,
        moveDocs: handleMoves,

        /** 重新加载文件树：刷新整个笔记本列表 */
        reloadFiletree: () => setNoteBook(() => context.init(false)),
        /** 合并短时间内的笔记本顶层文档计数更新。 */
        reloadNotebookInfo: () => context.reloadNotebookInfo(),
        /** 挂载笔记本：添加笔记本到文件树并触发插件事件 */
        mount: () => {
            handleMount(context.element, context.closeElement, {
                data: data.data,
                ...(data.callback ? {callback: data.callback} : {}),
            }, genNotebook);
            for (const item of app.plugins) {
                item.eventBus.emit("opened-notebook", data);
            }
        },
        /** 创建笔记本：在文件树中添加新笔记本节点 */
        createnotebook: () => handleCreateNotebook(context.element, data, genNotebook),
        /** 卸载笔记本：从文件树移除笔记本并触发插件事件 */
        unmount: () => {
            handleRemove(context.element, context.closeElement, data, genNotebook);
            for (const item of app.plugins) {
                item.eventBus.emit("closed-notebook", data);
            }
        },
        /** 关闭笔记本：从打开列表移入关闭列表并触发插件事件 */
        closeBox: () => {
            handleRemove(context.element, context.closeElement, data, genNotebook);
            for (const item of app.plugins) {
                item.eventBus.emit("closed-notebook", data);
            }
        },
        /** 移除笔记本：从打开和关闭列表中移除并触发插件事件 */
        removeBox: () => {
            handleRemove(context.element, context.closeElement, data, genNotebook);
            for (const item of app.plugins) {
                item.eventBus.emit("closed-notebook", data);
            }
        },
        /** 删除文档：从文件树中移除文档节点 */
        removeDoc: () => handleRemove(context.element, context.closeElement, data, genNotebook),
        /** 创建文档：处理新文档创建，选中并更新父节点箭头 */
        create: () => handleCreate(
            data,
            context.selectItem.bind(context),
            // 柯里化：固定 element 和 getLeaf，只暴露 notebookId 和 filePath
            (notebookId, filePath) => updateItemArrowFromModule(
                context.element, notebookId, filePath, context.getLeaf.bind(context)
            )
        ),
        /** 创建每日笔记：选中新创建的每日笔记文档 */
        createdailynote: () => context.selectItem(data.data.box.id, data.data.path),
        /** 标题转文档：选中从标题转换生成的新文档 */
        heading2doc: () => context.selectItem(data.data.box.id, data.data.path),
        /** 列表转文档：选中从列表转换生成的新文档 */
        li2doc: () => context.selectItem(data.data.box.id, data.data.path),
        /** 重命名笔记本：更新笔记本在文件树中的显示名称 */
        renamenotebook: () => handleRenameNotebook(context.element, context.closeElement, data.data.box, data.data.name),
        /** 重命名文档：调用上下文的重命名处理方法 */
        rename: () => context.onRename(data.data),
    };
}

/**
 * 处理 WebSocket 消息回调
 *
 * @description
 * 作用：根据消息命令分发到对应的处理函数，更新文件树 UI
 * 意图：使用对象字面量映射替代 switch 语句，提高代码可维护性
 * 调用时机：当 WebSocket 收到消息时由 Model 基类调用
 *
 * @同步豁免: 遗留代码 - 此函数作为 WebSocket 消息回调，需要与现有的同步回调机制兼容，
 * Model 基类的 onMessage 方法期望同步处理函数
 *
 * @param data - WebSocket 消息数据
 * @param app - 应用实例，用于触发插件事件
 * @param context - Files 实例上下文，包含必要的方法和属性
 */
export function handleMsgCallback(
    data: IWebSocketData,
    app: AppFacade,
    context: IFilesContext
): void {
    // 数据或命令为空时直接返回
    if (!data || !data.cmd) {
        return;
    }

    const handlers = buildHandlersMap(data, app, context);
    const handler = handlers[data.cmd];

    // 没有对应的处理函数时直接返回（未知命令）
    if (handler) {
        handler();
    }
}
