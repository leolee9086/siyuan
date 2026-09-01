/** 用途：清理旧选择状态。使用范围：右键行或卡片前同步新的选择范围。解耦评估：选择清理由共享能力维护更稳妥。 */
import { clearSelect } from "./imports";
/** 用途：反查属性视图根块。使用范围：selection 模块初始化上下文。解耦评估：DOM 定位逻辑统一复用更可靠。 */
import { hasClosestBlock } from "./imports";
/** 用途：收窄 DOM 查询结果。使用范围：构造 SelectedAttrViewRow 时校验节点类型。解耦评估：DOM 守卫继续走共享边界即可。 */
import { isHTMLElement } from "./imports";
/** 用途：把 DOM 上的 data-av-type 收窄为业务视图类型。使用范围：准备右键菜单状态时。解耦评估：视图类型收窄不应在业务文件内重复实现。 */
import { toAttrViewType } from "./imports";
/** 用途：刷新表格头部选择态。使用范围：表格行被右键选中后。解耦评估：头部状态刷新继续复用 row 模块能力更一致。 */
import { updateHeader } from "./imports";
import {hasClosestByClassName, setAVItemAnchor, updateAVRowSelect} from "./imports";
/** 用途：读取已选记录结构类型。使用范围：selection 模块内部构造主键上下文。解耦评估：类型集中在同层 types.ts 能避免局部重复定义。 */
import type { SelectedAttrViewRow } from "./types";

const SELECTED_ROW_SELECTOR = ".av__row--select:not(.av__row--header), .av__gallery-item--select";

/**
 * 作用：同步表格视图中被右键记录的选中态。
 * 意图：保持右键单行时会切换整行选中，但右键已选中的多行时不会丢掉多选范围。
 * 调用时机：`prepareContextmenuState` 在 table 视图中建立菜单上下文前调用。
 * 问题/改进：当前仍依赖首列 `use` 节点和 `updateHeader` 协议。
 */
const syncTableContextmenuSelection = (rowElement: HTMLElement, blockElement: Element) => {
    // 右键未选中的表格行时，需要先清掉旧行选择，保证当前菜单只作用于新的选择范围。
    if (!rowElement.classList.contains("av__row--select")) {
        clearSelect(["row"], blockElement);
    }
    clearSelect(["cell"], blockElement);
    rowElement.classList.add("av__row--select");
    const firstColUseElement = rowElement.querySelector(".av__firstcol use");
    if (firstColUseElement) {
        firstColUseElement.setAttribute("xlink:href", "#iconCheck");
    }
    updateHeader(rowElement);
};

/**
 * 作用：同步卡片视图中被右键记录的选中态。
 * 意图：保持 gallery / kanban 右键时沿用原有多选规则，只在右键未选中项时清空旧选择。
 * 调用时机：`prepareContextmenuState` 在卡片视图建立菜单上下文前调用。
 * 问题/改进：当前仍共用 `av__gallery-item--select` 作为 gallery 与 kanban 的选中标记。
 */
const syncCardContextmenuSelection = (rowElement: HTMLElement, blockElement: Element) => {
    // 卡片视图右键未选中项时，需要把旧卡片选择范围收回到当前项。
    if (!rowElement.classList.contains("av__gallery-item--select")) {
        clearSelect(["galleryItem"], blockElement);
    }
    rowElement.classList.add("av__gallery-item--select");
    const bodyElement = hasClosestByClassName(rowElement, "av__body");
    const rowID = rowElement.dataset.id;
    // 只有卡片仍位于有效 AV body 且具有记录 ID 时，才同步虚拟滚动选择快照。
    if (isHTMLElement(bodyElement) && rowID) {
        updateAVRowSelect(bodyElement, rowID, true);
    }
    updateHeader(rowElement);
};

const CONTEXTMENU_SELECTION_HANDLERS = new Map<TAVView, (rowElement: HTMLElement, blockElement: Element) => void>([
    ["table", syncTableContextmenuSelection],
    ["gallery", syncCardContextmenuSelection],
    ["kanban", syncCardContextmenuSelection],
]);

/**
 * 作用：把一个已选行节点转换为可复用的主键上下文。
 * 意图：右键菜单多个子模块都要读取主键单元格、块 ID 和 detached 状态，这里统一抽取避免重复 DOM 查询。
 * 调用时机：`collectSelectedRows` 遍历当前选中记录时调用。
 * 问题/改进：当前默认每行都存在 block 主键列，如果未来支持无 block 主键视图，需要补充兜底策略。
 */
const buildSelectedAttrViewRow = (rowCandidate: Element) => {
    if (!isHTMLElement(rowCandidate)) {
        return null;
    }
    const keyCellCandidate = rowCandidate.querySelector('.av__cell[data-dtype="block"]');
    if (!isHTMLElement(keyCellCandidate)) {
        return null;
    }
    const keyTextCandidate = keyCellCandidate.querySelector(".av__celltext");
    if (!isHTMLElement(keyTextCandidate)) {
        return null;
    }
    return {
        rowElement: rowCandidate,
        keyCellElement: keyCellCandidate,
        keyTextElement: keyTextCandidate,
        rowId: rowCandidate.getAttribute("data-id") || "",
        blockId: keyTextCandidate.getAttribute("data-id") || "",
        isDetached: keyCellCandidate.getAttribute("data-detached") === "true",
    };
};

/**
 * 作用：收集当前属性视图里已经选中的所有记录。
 * 意图：右键菜单后续的复制、插入和字段编辑都应以“当前选中范围”为准，而不是只作用于右键那一项。
 * 调用时机：右键记录选中态同步完成后立即调用。
 * 问题/改进：当前选中范围完全从 DOM class 读取，未来可考虑对接更显式的选择状态模型。
 */
const collectSelectedRows = (blockElement: Element) => {
    const selectedRows: SelectedAttrViewRow[] = [];
    const selectedRowCandidates = blockElement.querySelectorAll(SELECTED_ROW_SELECTOR);
    for (const selectedRowCandidate of selectedRowCandidates) {
        const selectedRow = buildSelectedAttrViewRow(selectedRowCandidate);
        if (!selectedRow) {
            continue;
        }
        selectedRows.push(selectedRow);
    }
    return selectedRows;
};

/**
 * 作用：准备属性视图右键菜单所需的共享上下文。
 * 意图：在真正构建菜单项之前，先把视图类型、选中范围和主键上下文收敛成稳定对象，降低后续子模块复杂度。
 * 调用时机：`avContextmenu` 入口在隐藏浮层后立即调用。
 * 问题/改进：当前仍依赖 DOM 结构即时计算菜单上下文，后续可视需要向显式状态收敛。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const prepareContextmenuState = (
    rowElement?: HTMLElement,
    options?: {blockElement?: HTMLElement},
) => {
    if (rowElement?.classList.contains("av__row--header")) {
        return null;
    }
    const blockCandidate = options?.blockElement || (rowElement ? hasClosestBlock(rowElement) : undefined);
    if (!isHTMLElement(blockCandidate)) {
        return null;
    }
    const blockElement = blockCandidate;
    const viewType = toAttrViewType(blockElement.getAttribute("data-av-type"));
    const selectionHandler = CONTEXTMENU_SELECTION_HANDLERS.get(viewType);
    if (!selectionHandler) {
        return null;
    }
    if (rowElement) {
        selectionHandler(rowElement, blockElement);
        setAVItemAnchor(blockElement, rowElement);
    }
    const selectedRows = collectSelectedRows(blockElement);
    const keyRow = selectedRows[0];
    if (!keyRow) {
        return null;
    }
    let hasAttachedBlock = false;
    for (const selectedRow of selectedRows) {
        if (selectedRow.isDetached) {
            continue;
        }
        hasAttachedBlock = true;
        break;
    }
    return {
        blockElement,
        viewType,
        rowElement: rowElement || keyRow.rowElement,
        selectedRows,
        keyRow,
        hasAttachedBlock,
    };
};
