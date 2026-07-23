/** 用途：Outline 大纲模型类。使用范围：创建和管理大纲。解耦评估：通过 ./imports 转发。 */
import { Outline } from "./imports";
/** 用途：通过属性查找 DOM 元素。使用范围：高亮大纲项时定位元素。解耦评估：通过 ./imports 转发。 */
import { hasClosestByAttribute } from "./imports";
/** 用途：网络请求。使用范围：获取大纲数据。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：判断当前编辑器是否激活。使用范围：大纲更新前检查。解耦评估：同目录模块直接导入。 */
import { isCurrentEditor } from "./util.isCurrentEditor";
/** 用途：判断笔记本是否加密。使用范围：大纲查询选择对应笔记本数据源。解耦评估：通过 ./imports 转发。 */
import { isEncryptedBox } from "./imports";

/**
 * 高亮当前大纲项
 * 
 * 作用：获取当前选区并高亮对应的大纲项
 * 意图：当用户在编辑器中移动光标时，大纲应同步高亮
 * 调用时机：handleOutlineResponse 中调用
 * 
 * @param protyle - 编辑器实例
 * @param item - Outline 实例
 */
const highlightCurrentOutlineItem = (protyle: IProtyle, item: Outline) => {
    const selection = getSelection();
    /**
     * 作用：高亮当前大纲项
     * 意图：如果有选区且在大纲视口范围内，高亮对应项
     * 生效场景：selection count > 0
     */
    if (!selection || selection.rangeCount === 0) {
        return;
    }
    const startContainer = selection.getRangeAt(0).startContainer;
    /**
     * 作用：确保选区在编辑器内
     * 意图：排除大纲或其他面板的选区
     * 生效场景：wysiwyg 包含 startContainer
     */
    if (!protyle.wysiwyg?.element.contains(startContainer)) {
        return;
    }
    const currentElement = hasClosestByAttribute(startContainer, "data-node-id", null);
    if (currentElement) {
        item.setCurrent(currentElement);
    }
};

/**
 * 处理 getDocOutline 响应
 * 
 * @param response 后端返回的大纲数据
 * @param item Outline 实例
 * @param blockId 当前编辑器块 ID
 * @param isPreview 是否预览模式
 * @param reload 是否重载
 * @param protyle 编辑器实例
 */
const handleOutlineResponse = (
    response: IWebSocketData,
    item: Outline,
    blockId: string,
    isPreview: boolean,
    reload: boolean,
    protyle: IProtyle | undefined
) => {
    if (!reload && (!isCurrentEditor(blockId) || item.blockId === blockId) &&
        item.isPreview === isPreview) {
        return;
    }
    item.isPreview = isPreview;
    item.update(response, blockId);
    if (!protyle) {
        item.updateDocTitle();
        return;
    }
    /**
     * 作用：更新文档标题
     * 意图：当 blockId 有效时，获取当前编辑器背景属性(ial)并更新标题和计数
     * 生效场景：ial 存在
     */
    if (protyle.background?.ial) {
        item.updateDocTitle(protyle.background.ial, response.data?.length || 0);
    }
    highlightCurrentOutlineItem(protyle, item);
};

/**
 * 更新大纲项
 * 
 * 作用：获取最新的大纲数据并更新指定的大纲面板
 * 意图：当编辑器内容变更或切换时，保持大纲视图与内容同步
 * 调用时机：updateOutline 函数中遍历大纲模型时调用
 * 
 * @param item - 大纲模型实例
 * @param protyle - 当前编辑器实例
 * @param reload - 是否强制重载
 */
const updateOutlineItem = (item: Outline, protyle: IProtyle | undefined, reload: boolean) => {
    let blockId = "";
    /**
     * 作用：获取当前块 ID
     * 意图：如果编辑器和块存在，使用其 rootID
     * 生效场景：protyle.block 存在
     */
    if (protyle && protyle.block) {
        blockId = protyle.block.rootID || "";
    }
    // local 类型的大纲在重载时使用 item.blockId 作为后备块 ID
    if (!blockId && reload && item.type === "local") {
        blockId = item.blockId;
    }
    const isPreview = false;

    if (blockId === item.blockId && !reload && item.isPreview === isPreview) {
        return;
    }

    /**
     * 作用：清空大纲内容
     * 意图：当当前块ID为空但大纲项仍有旧数据时，重置大纲显示
     * 生效场景：blockId 为空且 item.blockId 有值
     */
    if (!blockId && item.blockId) {
        item.blockId = blockId;
        const emptyResponse: IWebSocketData = {
            code: 0,
            msg: "",
            data: []
        };
        item.update(emptyResponse);
        item.updateDocTitle();
    }

    if (!blockId) {
        return;
    }

    const outlineParams: IObject = {
        id: blockId,
        preview: isPreview
    };
    // 加密笔记本的大纲位于独立数据源，必须携带 notebook 才能读取正确内容。
    if (protyle && isEncryptedBox(protyle.notebookId)) {
        outlineParams.notebook = protyle.notebookId;
    }
    fetchPost("/api/outline/getDocOutline", outlineParams, response => {
        handleOutlineResponse(response, item, blockId, isPreview, reload, protyle);
    });
};

/**
 * 更新大纲面板
 * 
 * 作用：遍历所有大纲模型，找到需要更新的面板并执行更新
 * 意图：对外暴露的统一更新接口
 * 调用时机：updatePanelByEditor, switchEditor 等
 * 
 * @param models - 所有模型集合
 * @param protyle - 当前编辑器实例
 * @param reload - 是否强制重载
 * @同步豁免: UI构建 遍历调用 updateOutlineItem，无异步等待
 */
export const updateOutline = (models: IModels, protyle: IProtyle | undefined, reload = false) => {
    for (const item of models.outline) {
        /**
         * 作用：判断是否需要更新当前大纲项
         * 意图：不仅需要更新对应的 "pin" 面板，也需要过滤掉无关的面板
         * 生效场景：reload 为 true 或 item 为 pin 类型且状态不一致
         */
        if (reload ||
            (item.type === "pin" &&
                (!protyle || item.blockId !== protyle.block?.rootID ||
                    item.isPreview)
            )
        ) {
            updateOutlineItem(item, protyle, reload);
        }
    }
};
