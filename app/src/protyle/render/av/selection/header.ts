/** 用途：定位当前 AV block。使用范围：由任意行或卡片刷新选择头；解耦评估：本域网关直达稳定 DOM 查询实现。 */
import {hasClosestBlock} from "./imports";
/** 用途：读取虚拟滚动选择统计。使用范围：DOM 被裁剪时恢复真实选择数；解耦评估：本域网关直达统一状态所有者。 */
import {getAVSelectStat} from "./imports";
/** 用途：选择计数器文案。使用范围：有选择项时更新计数；解耦评估：本域网关直达稳定环境访问器。 */
import {siyuanI18n} from "./imports";

/** 根据选择数量决定表头复选框图标；每次表头同步时调用，集中保持全选、空选和半选语义。 */
const getHeaderIcon = (selectCount: number, rowCount: number) => {
    if (selectCount === rowCount && rowCount !== 0) {
        return "#iconCheck";
    }
    if (selectCount === 0) {
        return "#iconUncheck";
    }
    return "#iconIndeterminateCheck";
};

/** 统计表格选择并同步表头 DOM；仅在当前 AV 类型为 table 时调用。 */
const updateTableHeader = (rowElement: HTMLElement) => {
    const bodyElement = rowElement.parentElement;
    if (!bodyElement) {
        return 0;
    }
    const stat = getAVSelectStat(bodyElement);
    const selectedRows = bodyElement.querySelectorAll(".av__row--select:not(.av__row--header)");
    const rows = bodyElement.querySelectorAll(".av__row:not(.av__row--header)");
    const selectCount = stat ? stat.selectCount : selectedRows.length;
    const rowCount = stat ? stat.loadedCount : rows.length;
    const headElement = bodyElement.firstElementChild;
    if (!(headElement instanceof HTMLElement)) {
        return selectCount;
    }
    headElement.classList.toggle("av__row--select", selectCount > 0);
    const useElement = headElement.querySelector("use");
    useElement?.setAttribute("xlink:href", getHeaderIcon(selectCount, rowCount));
    return selectCount;
};

/** 聚合画廊和看板各 body 的选择数；卡片类视图刷新计数器时调用。 */
const countCardSelection = (blockElement: Element) => {
    let selectCount = 0;
    for (const bodyElement of Array.from(blockElement.querySelectorAll<HTMLElement>(".av__body"))) {
        const stat = getAVSelectStat(bodyElement);
        const selectedItems = bodyElement.querySelectorAll(".av__gallery-item--select");
        selectCount += stat ? stat.selectCount : selectedItems.length;
    }
    return selectCount;
};

/** 显示或隐藏 AV 选择计数器；表格或卡片统计完成后统一调用。 */
const updateCounter = (blockElement: Element, selectCount: number) => {
    const counterElement = blockElement.querySelector(".av__counter");
    if (!counterElement) {
        return;
    }
    // 没有选择项时隐藏计数器，避免保留上一次选择的过期数字。
    if (selectCount === 0) {
        counterElement.classList.add("fn__none");
        return;
    }
    counterElement.classList.remove("fn__none");
    counterElement.innerHTML = `${selectCount} ${siyuanI18n.selected}`;
};

/** 同步 AV 选择计数、表格表头勾选态和计数器。 @同步豁免: 需要绝对同步的DOM访问 - 选择事件结束前必须完成视觉状态刷新。 */
export const updateHeader = (rowElement: HTMLElement) => {
    const blockElement = hasClosestBlock(rowElement);
    if (!blockElement) {
        return;
    }
    const selectCount = blockElement.getAttribute("data-av-type") === "table"
        ? updateTableHeader(rowElement)
        : countCardSelection(blockElement);
    updateCounter(blockElement, selectCount);
};
