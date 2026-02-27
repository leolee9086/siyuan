import { fetchPost } from "../util/network/fetch";
import { isCurrentEditor } from "./util.isCurrentEditor";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { Graph } from "../layout/dock/Graph";
import { Backlink } from "../layout/dock/Backlink";
import { Forwardlink } from "../layout/dock/forwardlink/Forwardlink";

/**
 * 更新关系图面板
 * 
 * 作用：检查关系图面板是否需要更新，并在需要时调用 searchGraph
 * 意图：当编辑器内容变更或焦点切换时，同步更新关系图
 * 调用时机：updateBacklinkGraph 中遍历 graph 模型时
 * 
 * @param item - 关系图模型
 * @param protyle - 当前编辑器实例
 */
const updateGraph = (item: Graph, protyle: IProtyle | undefined) => {
    if (item.type === "global" || (protyle && item.blockId === protyle.block?.id)) {
        return;
    }
    if (item.type === "local" && item.rootId !== protyle?.block?.rootID) {
        return;
    }
    let blockId = "";
    if (protyle && protyle.block) {
        blockId = protyle.block.showAll ? protyle.block.id : protyle.block.parentID;
    }
    if (blockId === item.blockId) {
        return;
    }
    item.searchGraph(true, blockId);
};

/**
 * 更新反向链接面板
 * 
 * 作用：检查反链面板是否需要更新，并在需要时重新获取反链数据
 * 意图：同步更新反向链接视图
 * 调用时机：updateBacklinkGraph 中遍历 backlink 模型时
 * 
 * @param item - 反链模型
 * @param protyle - 当前编辑器实例
 */
const updateBacklink = (item: Backlink, protyle: IProtyle | undefined) => {
    if (item.type === "local" && item.rootId !== protyle?.block?.rootID) {
        return;
    }
    let blockId = "";
    if (protyle && protyle.block) {
        blockId = protyle.block.showAll ? protyle.block.id : protyle.block.parentID;
    }
    if (blockId === item.blockId) {
        return;
    }
    const refreshElement = item.element.querySelector('.block__icon[data-type="refresh"] svg');
    if (refreshElement) {
        refreshElement.classList.add("fn__rotate");
    }
    const sort = item.status[blockId] ? item.status[blockId].sort.toString() : getSiyuanConfig().editor.backlinkSort.toString();
    const mSort = item.status[blockId] ? item.status[blockId].mSort.toString() : getSiyuanConfig().editor.backmentionSort.toString();

    fetchPost("/api/ref/getBacklink2", {
        sort,
        mSort,
        id: blockId || "",
        k: item.inputsElement[0].value,
        mk: item.inputsElement[1].value,
    }, response => {
        if (!isCurrentEditor(blockId) || item.blockId === blockId) {
            refreshElement?.classList.remove("fn__rotate");
            return;
        }
        item.saveStatus();
        item.blockId = blockId;
        item.render(response.data);
    });
};

/**
 * 更新相关的反链和关系图
 * @param models
 * @param protyle
 * @returns
 */
export const updateBacklinkGraph = (models: IModels, protyle: IProtyle | undefined) => {
    if (protyle && protyle.element.classList.contains("fn__none")) {
        return;
    }
    for (const item of models.graph) {
        updateGraph(item, protyle);
    }
    for (const item of models.backlink) {
        updateBacklink(item, protyle);
    }
    for (const item of models.forwardlink) {
        updateForwardlink(item, protyle);
    }
};

/**
 * 更新正向链接面板
 * 
 * 作用：当编辑器焦点变化时，更新正向链接面板的根 ID
 * 意图：保持正向链接显示当前文档的引用
 * 调用时机：updateBacklinkGraph 中遍历 forwardlink 模型时
 * 
 * @param item - 正向链接模型
 * @param protyle - 当前编辑器实例
 */
const updateForwardlink = (item: Forwardlink, protyle: IProtyle | undefined) => {
    let blockId = "";
    if (protyle && protyle.block) {
        blockId = protyle.block.rootID;
    }

    if (item.type === "local") {
        if (item.rootId === blockId) {
            item.refresh();
        }
        return;
    }

    if (blockId === item.rootId) {
        return;
    }
    item.rootId = blockId;
    item.refresh();
};
