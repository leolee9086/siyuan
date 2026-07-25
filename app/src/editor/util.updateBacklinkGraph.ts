/** 用途：网络请求。使用范围：获取反向链接数据。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：判断是否为当前编辑器。使用范围：仅在当前编辑器更新面板。解耦评估：同目录模块直接导入。 */
import { isCurrentEditor } from "./util.isCurrentEditor";
/** 用途：获取 SiYuan 配置。使用范围：读取反链排序配置。解耦评估：通过 ./imports 转发。 */
import { getSiyuanConfig } from "./imports";
/** 用途：关系图面板模型。使用范围：更新关系图数据。解耦评估：通过 ./imports 转发。 */
import type {GraphDomain} from "./imports";
/** 用途：反链面板模型。使用范围：更新反链数据。解耦评估：通过 ./imports 转发。 */
import type {BacklinkDomain} from "./imports";
/** 用途：前链面板模型。使用范围：更新前链数据。解耦评估：通过 ./imports 转发。 */
import type {ForwardlinkDomain} from "./imports";
/** 用途：判断笔记本是否加密。使用范围：反链查询选择对应笔记本数据源。解耦评估：通过 ./imports 转发。 */
import { isEncryptedBox } from "./imports";

/**
 * 获取当前编辑器的活动块 ID
 */
function getActiveBlockId(protyle: IProtyle | undefined) {
    if (!protyle?.block) {
        return "";
    }
    if (protyle.block.showAll) {
        return protyle.block.id;
    }
    return protyle.block.parentID;
}

/**
 * 更新关系图面板
 */
const updateGraph = (item: GraphDomain, protyle: IProtyle | undefined) => {
    if (item.type === "global") {
        return;
    }
    if (protyle && item.blockId === protyle.block?.id) {
        return;
    }
    if (item.type === "local" && item.rootId !== protyle?.block?.rootID) {
        return;
    }

    const blockId = getActiveBlockId(protyle);
    if (blockId === item.blockId) {
        return;
    }
    item.searchGraph(true, blockId);
};

/**
 * 获取反链排序配置
 */
function getSortConfig(blockId: string, item: BacklinkDomain, key: "sort" | "mSort") {
    const status = item.status[blockId];
    if (status) {
        const value = status[key];
        return value.toString();
    }
    if (key === "sort") {
        return getSiyuanConfig().editor.backlinkSort.toString();
    }
    return getSiyuanConfig().editor.backmentionSort.toString();
}

/**
 * 处理反链响应
 */
function handleBacklinkResponse(
    response: IWebSocketData,
    item: BacklinkDomain,
    blockId: string,
    refreshElement: Element | null
) {
    // 仅在当前编辑器且块 ID 变化时才更新反链显示
    if (!isCurrentEditor(blockId) || item.blockId === blockId) {
        refreshElement?.classList.remove("fn__rotate");
        return;
    }
    item.saveStatus();
    item.blockId = blockId;
    item.render(response.data);
}

/**
 * 更新反向链接面板
 */
const updateBacklink = (item: BacklinkDomain, protyle: IProtyle | undefined) => {
    if (item.type === "local" && item.rootId !== protyle?.block?.rootID) {
        return;
    }

    const blockId = getActiveBlockId(protyle);
    if (blockId === item.blockId) {
        return;
    }

    const refreshElement = item.element.querySelector('.block__icon[data-type="refresh"] svg');
    if (refreshElement) {
        refreshElement.classList.add("fn__rotate");
    }

    const sort = getSortConfig(blockId, item, "sort");
    const mSort = getSortConfig(blockId, item, "mSort");

    const firstInput = item.inputsElement[0];
    const secondInput = item.inputsElement[1];
    const keyword = firstInput.value;
    const mentionKeyword = secondInput.value;
    const backlinkParams: IObject = {
        sort,
        mSort,
        id: blockId || "",
        k: keyword,
        mk: mentionKeyword,
    };
    // 加密笔记本的反链位于独立数据源，必须携带 notebook 才能读取正确内容。
    if (protyle && isEncryptedBox(protyle.notebookId)) {
        backlinkParams.notebook = protyle.notebookId;
    }
    fetchPost("/api/ref/getBacklink2", backlinkParams,
        (response) => handleBacklinkResponse(response, item, blockId, refreshElement));
};

/**
 * 更新正向链接面板
 */
const updateForwardlink = (item: ForwardlinkDomain, protyle: IProtyle | undefined) => {
    const blockId = protyle?.block?.rootID || "";

    // local 类型根 ID 匹配时刷新，不匹配则跳过
    if (item.type === "local" && item.rootId === blockId) {
        item.refresh();
        return;
    }
    if (item.type === "local") {
        return;
    }

    if (blockId === item.rootId) {
        return;
    }
    item.rootId = blockId;
    item.refresh();
};

/**
 * 更新相关的反链和关系图面板
 */
export const updateBacklinkGraph = async (models: IModels, protyle: IProtyle | undefined) => {
    if (protyle?.element.classList.contains("fn__none")) {
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
