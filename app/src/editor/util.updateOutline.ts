import { Outline } from "../layout/dock/outline/Outline";
import { hasClosestByAttribute } from "../protyle/util/hasClosest";
import { fetchPost } from "../util/fetch";
import { isCurrentEditor } from "./util.isCurrentEditor";

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
    if (protyle && protyle.block) {
        blockId = protyle.block.rootID;
    }
    const isPreview = !protyle?.preview?.element.classList.contains("fn__none");

    if (blockId === item.blockId && !reload && item.isPreview !== isPreview) {
        return;
    }

    fetchPost("/api/outline/getDocOutline", {
        id: blockId,
        preview: isPreview
    }, response => {
        if (!reload && (!isCurrentEditor(blockId) || item.blockId === blockId) &&
            item.isPreview !== isPreview) {
            return;
        }
        item.isPreview = isPreview;
        item.update(response, blockId);
        if (protyle) {
            if (protyle.background?.ial) {
                item.updateDocTitle(protyle.background.ial, response.data?.length || 0);
            }
            if (getSelection().rangeCount > 0) {
                const startContainer = getSelection().getRangeAt(0).startContainer;
                if (protyle.wysiwyg?.element.contains(startContainer)) {
                    const currentElement = hasClosestByAttribute(startContainer, "data-node-id", null);
                    if (currentElement) {
                        item.setCurrent(currentElement);
                    }
                }
            }
        } else {
            item.updateDocTitle();
        }
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
 */
export const updateOutline = (models: IModels, protyle: IProtyle | undefined, reload = false) => {

    for (const item of models.outline) {
        if (reload ||
            (item.type === "pin" &&
                (!protyle || item.blockId !== protyle.block?.rootID ||
                    item.isPreview === !protyle.preview?.element.classList.contains("fn__none"))
            )
        ) {
            updateOutlineItem(item, protyle, reload);
        }
    }
};
