/** 用途：读取单元格类型。使用范围：普通单元格点击分支。解耦评估：单元格类型协议由 cell 子模块维护，click 侧直接消费即可。 */
import { getTypeByCellElement } from "./imports";
/** 用途：按类名查找滚动区、行和卡片容器。使用范围：普通单元格点击分支。解耦评估：DOM 遍历规则应继续复用共享工具而不是在此重写。 */
import { hasClosestByClassName } from "./imports";
/** 用途：收窄 DOM 查询结果。使用范围：滚动区、行和首列节点校验。解耦评估：DOM guard 属于基础能力，继续走本目录 imports.ts 最清晰。 */
import { isHTMLElement } from "./imports";
/** 用途：进入单元格编辑态。使用范围：可编辑表格单元格和卡片字段点击。解耦评估：编辑态实现由 cell 子模块维护，click 只负责入口。 */
import { popTextCell } from "./imports";
/** 用途：切换整行选择状态。使用范围：只读标记列点击。解耦评估：选择状态机属于 row 子模块，click 不应复制。 */
import { selectRow } from "./imports";
/** 用途：刷新表头选择状态。使用范围：清理旧整行选中后进入表格编辑态之前。解耦评估：头部状态与 row 选择逻辑耦合紧密，继续复用共享实现更稳。 */
import { updateHeader } from "./imports";
/** 用途：统一结束已处理点击。使用范围：普通单元格点击 handler 的成功分支。解耦评估：这是 click 子目录内部的共用动作，放在 shared.ts 里更利于复用。 */
import { consumeClickEvent } from "./shared";
/** 用途：识别只负责整行选择的标记列。使用范围：table 和 gallery/kanban 的单元格点击分流。解耦评估：这是 click 子目录内部规则，集中在 shared.ts 更容易统一维护。 */
import { isReadonlyRowMarkerCell } from "./shared";

/**
 * 作用：清理滚动容器内旧的表格整行选中态。
 * 意图：保持进入单元格编辑前先撤销整行选中的原行为。
 * 调用时机：表格可编辑单元格点击且准备进入编辑态时调用。
 * 问题/改进：当前仍依赖 `.av__firstcol use` DOM 结构。
 */
const clearSelectedTableRows = (scrollElement: HTMLElement) => {
    const selectedRows = scrollElement.querySelectorAll(".av__row--select");
    for (const selectedRow of selectedRows) {
        const firstColIcon = selectedRow.querySelector(".av__firstcol use");
        if (firstColIcon) {
            firstColIcon.setAttribute("xlink:href", "#iconUncheck");
        }
        selectedRow.classList.remove("av__row--select");
    }
};

/**
 * 作用：处理只读标记列的整行选择切换。
 * 意图：把 `updated`、`created`、`lineNumber` 三类列的行为固定为“切整行”。
 * 调用时机：表格单元格类型已经确认是只读标记列时调用。
 * 问题/改进：如果首列 DOM 结构变化，需要同步调整这里的查询方式。
 */
const selectReadonlyMarkerRow = (rowElement: HTMLElement) => {
    const firstColElement = rowElement.querySelector(".av__firstcol");
    if (!isHTMLElement(firstColElement)) {
        return false;
    }
    selectRow(firstColElement, "toggle");
    return true;
};

/**
 * 作用：处理表格视图中的单元格点击。
 * 意图：在“切整行”和“进入编辑态”之间保持和原实现一致的分流。
 * 调用时机：点击 `.av__cell` 且 viewType 为 table 时调用。
 * 问题/改进：当前仍依赖滚动区和行容器的 DOM 结构。
 */
const handleTableCellClick = (protyle: IProtyle, target: HTMLElement, cellType: string | undefined) => {
    const scrollCandidate = hasClosestByClassName(target, "av__scroll");
    if (!isHTMLElement(scrollCandidate)) {
        return false;
    }
    const rowCandidate = hasClosestByClassName(target, "av__row");
    if (!isHTMLElement(rowCandidate)) {
        return false;
    }
    // 只读标记列沿用原行为，点击时切换整行选择而不是进入编辑态。
    if (isReadonlyRowMarkerCell(cellType)) {
        return selectReadonlyMarkerRow(rowCandidate);
    }
    clearSelectedTableRows(scrollCandidate);
    updateHeader(rowCandidate);
    popTextCell(protyle, [target]);
    return true;
};

/**
 * 作用：处理卡片布局中的字段点击。
 * 意图：保持 gallery / kanban 里只对可编辑字段进入编辑态。
 * 调用时机：点击 `.av__cell` 且 viewType 不是 table 时调用。
 * 问题/改进：当前仍依赖 `.av__gallery-item` 容器来确认卡片上下文。
 */
const handleCardCellClick = (protyle: IProtyle, target: HTMLElement, cellType: string | undefined) => {
    // 卡片布局下这三类标记列仍然不进入编辑态，保持和旧实现一致。
    if (isReadonlyRowMarkerCell(cellType)) {
        return true;
    }
    const itemElement = hasClosestByClassName(target, "av__gallery-item");
    if (!itemElement) {
        return true;
    }
    popTextCell(protyle, [target]);
    return true;
};

/**
 * 作用：处理普通单元格点击。
 * 意图：保持表格和卡片布局下原始的编辑/选择行为。
 * 调用时机：class 分发命中 `.av__cell` 且编辑器未禁用时调用。
 * 问题/改进：当前仍依赖头行、pulse 和布局类型的 DOM 约定。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleCellClick = (protyle: IProtyle, target: HTMLElement, viewType: TAVView, event: MouseEvent) => {
    if (!target.classList.contains("av__cell") || protyle.disabled) {
        return false;
    }
    const headerRowElement = hasClosestByClassName(target, "av__row--header");
    if (headerRowElement) {
        return consumeClickEvent(event);
    }
    const pulseElement = target.querySelector(".av__pulse");
    if (pulseElement) {
        return false;
    }
    const cellType = getTypeByCellElement(target);
    // 表格布局需要继续区分整行选择和进入编辑态，行为与卡片布局不同。
    if (viewType !== "table") {
        handleCardCellClick(protyle, target, cellType);
        return consumeClickEvent(event);
    }
    const handled = handleTableCellClick(protyle, target, cellType);
    if (!handled) {
        return false;
    }
    return consumeClickEvent(event);
};
