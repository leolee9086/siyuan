/** 用途：AV 协议属性；使用范围：视图和虚拟滚动标记；解耦评估：经本阶段网关直达常量。 */
import {Constants} from "./imports";
/** 用途：定位失败消息；使用范围：不可见目标；解耦评估：经本阶段网关直达唯一实现。 */
import {showMessage} from "./imports";
/** 用途：定位请求和渲染数据状态；使用范围：窗口准备；解耦评估：直达统一状态所有者。 */
import {getAVLocateRequest} from "./imports";
/** 用途：缓存已渲染 AV 数据；使用范围：窗口准备；解耦评估：直达统一状态真实所有者。 */
import {setRenderedAVData} from "./imports";
/** 用途：读取画廊卡片宽度；使用范围：定位窗口列数计算；解耦评估：经样式所有者统一解析新旧字段。 */
import {getCardWidth} from "./imports";
/** 用途：完整定位请求；使用范围：失败消息状态；解耦评估：纯类型直达领域声明。 */
import type {IAVLocateRequest} from "../locate.types";

const locateRenderSize = 200;

/** 首次报告不可见目标，保持同一请求只显示一次消息。 */
const showUnavailableTarget = (request: IAVLocateRequest, status: IAVRenderTarget["status"]) => {
    if (request.messageShown) {
        return;
    }
    request.messageShown = true;
    // 被筛选或折叠分组隐藏共享同一用户提示。
    if (status === "filtered" || status === "groupHidden") {
        showMessage(window.siyuan.languages.databaseItemFiltered);
        return;
    }
    // 请求视图不存在时使用专属提示，区别于条目缺失。
    if (status === "viewNotFound") {
        showMessage(window.siyuan.languages.databaseViewNotFound);
        return;
    }
    showMessage(window.siyuan.languages.databaseItemNotFound);
};

/** 计算目标附近的稳定虚拟窗口及顶部 spacer。 */
const calculateLocateWindow = (blockElement: HTMLElement, data: IAV) => {
    const view = data.target.groupID ? data.view.groups?.find(item => item.id === data.target.groupID) : data.view;
    if (!view) {
        throw new Error(`AV locate expected group ${data.target.groupID}`);
    }
    const itemLength = "rows" in view ? view.rows.length : view.cards.length;
    const offset = data.target.offset || 0;
    const localIndex = Math.max(0, data.target.index - offset);
    let renderedStart = Math.max(0, localIndex - locateRenderSize / 2);
    const renderedEnd = Math.min(itemLength - 1, renderedStart + locateRenderSize - 1);
    renderedStart = Math.max(0, renderedEnd - locateRenderSize + 1);
    const bodyQuery = data.target.groupID ? `.av__body[data-group-id="${data.target.groupID}"]` : ".av__body";
    const currentBody = blockElement.querySelector(bodyQuery);
    // 表格按行高计算 spacer；卡片视图需要按列数换算。
    if (data.viewType === "table") {
        const rowElement = currentBody?.querySelector(".av__row[data-id]");
        const rowHeight = rowElement instanceof HTMLElement ? rowElement.offsetHeight : 36;
        return {itemLength, renderedStart, renderedEnd, topSpacerHeight: renderedStart * rowHeight, rowOffset: offset};
    }
    const itemElement = currentBody?.querySelector(".av__gallery-item");
    const itemHeight = itemElement instanceof HTMLElement ? itemElement.offsetHeight : 180;
    let columns = 1;
    // Gallery 根据卡片尺寸和容器宽度对齐整行窗口，看板保持单列计算。
    if (data.viewType === "gallery") {
        const minWidth = getCardWidth(view as IAVGallery) ?? 260;
        columns = Math.max(1, Math.floor((blockElement.clientWidth + 16) / (minWidth + 16)));
        renderedStart -= renderedStart % columns;
    }
    const topSpacerHeight = Math.floor(renderedStart / columns) * (itemHeight + 16);
    return {itemLength, renderedStart, renderedEnd, topSpacerHeight, rowOffset: offset};
};

/** 缓存服务端数据并为可见目标准备虚拟窗口。
 * @同步豁免: 需要绝对同步的DOM访问 - 根渲染紧接着使用本次计算的虚拟窗口生成 HTML。
 */
export const prepareAVLocate = (blockElement: HTMLElement, data: IAV, resetData: {
    virtualData: { [key: string]: IAVVirtualData },
}) => {
    setRenderedAVData(blockElement, data);
    const request = getAVLocateRequest(blockElement);
    if (!blockElement.isConnected || !request || !data.target || data.target.itemID !== request.itemID) {
        return;
    }
    // 目标不可见时只报告状态，不构造无效虚拟窗口。
    if (data.target.status !== "visible") {
        showUnavailableTarget(request, data.target.status);
        return;
    }
    // 临时视图定位直接更新 DOM 属性但不提交持久化事务。
    if (request.persistView === false && request.viewID) {
        blockElement.setAttribute(Constants.CUSTOM_SY_AV_VIEW, request.viewID);
    }
    const windowState = calculateLocateWindow(blockElement, data);
    // 大于 100 项沿用既有虚拟滚动开启阈值。
    if (windowState.itemLength > 100) {
        blockElement.setAttribute(Constants.ATTRIBUTE_V_SCROLL, "true");
    }
    resetData.virtualData[data.target.groupID || "all"] = {
        renderedStart: windowState.renderedStart,
        renderedEnd: windowState.renderedEnd,
        topSpacerHeight: windowState.topSpacerHeight,
        rowOffset: windowState.rowOffset,
        locate: true,
    };
};
