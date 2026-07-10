/** 用途：Rect 矩形类型。使用范围：表格单元格与选区的几何计算。解耦评估：通过 imports.ts 转发。 */
import type { Rect } from "./imports";
/** 用途：createRect 几何构造器。使用范围：将 DOM 尺寸转换为数组形式的矩形。解耦评估：通过 imports.ts 转发。 */
import { createRect } from "./imports";

/** 合并单元格边界判定的像素容差。 */
const TABLE_SELECT_TOLERANCE = 6;

/**
 * 获取更新表格选区所需的稳定 DOM 节点。
 *
 * 意图：拖拽期间表格可能被重渲染，集中验证相关节点避免后续 DOM 访问产生空值异常。
 * 调用时机：每次根据鼠标移动位置更新表格单元格选区前调用。
 */
function getTableSelectionElements(tableBlockElement: HTMLElement) {
    const tableContentElement = tableBlockElement.firstElementChild;
    const tableElement = tableBlockElement.querySelector("table");
    const tableSelectElement = tableBlockElement.querySelector(".table__select");
    // 仅完整的表格块具备设置选区所需的可滚动容器、表格和覆盖层。
    if (!(tableContentElement instanceof HTMLElement) ||
        !(tableElement instanceof HTMLTableElement) ||
        !(tableSelectElement instanceof HTMLElement)) {
        return;
    }
    return { tableContentElement, tableElement, tableSelectElement };
}

/**
 * 计算两个单元格覆盖范围的初始矩形。
 *
 * 意图：使用几何并集替代分支式坐标计算，使重叠或跨列合并单元格也能得到完整边界。
 * 调用时机：确认拖拽终点为表格单元格后，在合并单元格修正前调用。
 */
function computeInitialTableSelectRect(targetRect: Rect, moveTargetRect: Rect) {
    const left = Math.min(targetRect[0], moveTargetRect[0]);
    const top = Math.min(targetRect[1], moveTargetRect[1]);
    const right = Math.max(targetRect[0] + targetRect[2], moveTargetRect[0] + moveTargetRect[2]);
    const bottom = Math.max(targetRect[1] + targetRect[3], moveTargetRect[1] + moveTargetRect[3]);
    return createRect(left, top, right - left, bottom - top);
}

/**
 * 根据横向相交的合并单元格扩展选区宽度。
 *
 * 意图：使选区包含横跨左右边缘的完整单元格，防止合并单元格只被部分选中。
 * 调用时机：选区上、下边缘经过单元格时调用。
 */
function expandTableSelectWidth(cellRect: Rect, selectionRect: Rect, widthOverlaps: readonly [boolean, boolean]) {
    const [overlapsRight, overlapsLeft] = widthOverlaps;
    // 将选区右边界扩展到跨越该边界的单元格末端。
    if (overlapsRight) {
        selectionRect[2] = cellRect[0] + cellRect[2] - selectionRect[0];
    }
    // 将选区左边界扩展到跨越该边界的单元格起点。
    if (overlapsLeft) {
        selectionRect[2] = selectionRect[0] + selectionRect[2] - cellRect[0];
        selectionRect[0] = cellRect[0];
    }
}

/**
 * 根据完全位于纵向范围内的单元格修正选区宽度。
 *
 * 意图：单元格同时跨越左右边界时优先扩展左边界，确保矩形选区保持稳定。
 * 调用时机：单元格未跨越选区上下边界但位于选区纵向范围内时调用。
 */
function expandTableSelectInteriorWidth(cellRect: Rect, selectionRect: Rect, widthOverlaps: readonly [boolean, boolean]) {
    const [overlapsRight, overlapsLeft] = widthOverlaps;
    // 同时跨越左右边界时优先扩展左边界。
    if (overlapsLeft) {
        selectionRect[2] = selectionRect[0] + selectionRect[2] - cellRect[0];
        selectionRect[0] = cellRect[0];
        return;
    }
    // 未跨越左边界时才扩展右边界。
    if (overlapsRight) {
        selectionRect[2] = cellRect[0] + cellRect[2] - selectionRect[0];
    }
}

/**
 * 根据跨越顶部的合并单元格扩展选区。
 *
 * 意图：将选区顶边延伸到完整的合并单元格起点，避免只选择到其局部区域。
 * 调用时机：单元格垂直跨越选区顶边且存在横向交集时调用。
 */
function expandTableSelectTop(cellRect: Rect, selectionRect: Rect, shouldExpandHeight: boolean) {
    if (!shouldExpandHeight) {
        return;
    }
    selectionRect[3] = selectionRect[1] + selectionRect[3] - cellRect[1];
    selectionRect[1] = cellRect[1];
}

/**
 * 根据跨越底部的合并单元格扩展选区。
 *
 * 意图：将选区底边延伸到完整的合并单元格末端，避免只选择到其局部区域。
 * 调用时机：单元格垂直跨越选区底边且存在横向交集时调用。
 */
function expandTableSelectBottom(cellRect: Rect, selectionRect: Rect, shouldExpandHeight: boolean) {
    if (!shouldExpandHeight) {
        return;
    }
    selectionRect[3] = cellRect[3] + cellRect[1] - selectionRect[1];
}

/**
 * 修正因合并单元格跨越选区边界而产生的不完整矩形。
 *
 * 意图：保持表格框选始终覆盖完整单元格，兼容行列合并造成的边界穿透。
 * 调用时机：计算拖拽起点与终点的初始矩形后调用。
 */
function adjustTableSelectRectForMergedCells(tableCells: NodeListOf<HTMLTableCellElement>, selectionRect: Rect) {
    for (const cell of tableCells) {
        const cellRect = createRect(cell.offsetLeft, cell.offsetTop, cell.clientWidth, cell.clientHeight);
        const overlapsRight = cellRect[0] < selectionRect[0] + selectionRect[2] &&
            cellRect[0] + cellRect[2] > selectionRect[0] + selectionRect[2];
        const overlapsLeft = cellRect[0] < selectionRect[0] && cellRect[0] + cellRect[2] > selectionRect[0];
        const isInsideHorizontalRange = cellRect[0] + TABLE_SELECT_TOLERANCE > selectionRect[0] &&
            cellRect[0] + cellRect[2] - TABLE_SELECT_TOLERANCE < selectionRect[0] + selectionRect[2];
        const shouldExpandHeight = isInsideHorizontalRange || overlapsRight || overlapsLeft;
        const widthOverlaps: [boolean, boolean] = [overlapsRight, overlapsLeft];
        const overlapsTop = cellRect[1] < selectionRect[1] && cellRect[1] + cellRect[3] > selectionRect[1];
        // 顶边优先于底边处理，保证高单元格完整覆盖当前选区。
        if (overlapsTop) {
            expandTableSelectTop(cellRect, selectionRect, shouldExpandHeight);
            expandTableSelectWidth(cellRect, selectionRect, widthOverlaps);
            continue;
        }
        const overlapsBottom = cellRect[1] < selectionRect[1] + selectionRect[3] &&
            cellRect[1] + cellRect[3] > selectionRect[1] + selectionRect[3];
        // 底边相交时同样扩展选区，并跳过仅调整侧边的路径。
        if (overlapsBottom) {
            expandTableSelectBottom(cellRect, selectionRect, shouldExpandHeight);
            expandTableSelectWidth(cellRect, selectionRect, widthOverlaps);
            continue;
        }
        const isInsideVerticalRange = cellRect[1] + TABLE_SELECT_TOLERANCE > selectionRect[1] &&
            cellRect[1] + cellRect[3] - TABLE_SELECT_TOLERANCE < selectionRect[1] + selectionRect[3];
        // 单元格完全位于纵向范围内时，修正被其跨越的左右边界。
        if (isInsideVerticalRange) {
            expandTableSelectInteriorWidth(cellRect, selectionRect, widthOverlaps);
        }
    }
}

/**
 * 更新表格拖拽框选覆盖层的坐标和尺寸。
 *
 * 意图：在拖拽经过表格单元格时隐藏浏览器文本选区，并用覆盖层呈现完整的单元格选区。
 * 调用时机：表格单元格拖拽移动期间，终点单元格发生变化时调用。
 * @param options - 当前拖拽涉及的锚点、终点、表格块和编辑器实例。
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export function computeTableSelectRect(options: {
    target: HTMLElement;
    moveTarget: HTMLElement | boolean;
    tableBlockElement: HTMLElement;
    protyle: IProtyle;
}) {
    const { target, moveTarget, tableBlockElement, protyle } = options;
    if (typeof moveTarget === "boolean") {
        return;
    }
    const tableSelectionElements = getTableSelectionElements(tableBlockElement);
    const wysiwygElement = protyle.wysiwyg?.element;
    // 表格或编辑器可能在拖拽期间被销毁；此时停止更新已经失效的选区。
    if (!tableSelectionElements || !wysiwygElement) {
        return;
    }
    const { tableContentElement, tableElement, tableSelectElement } = tableSelectionElements;
    tableContentElement.style.setProperty("-webkit-user-modify", "read-only");
    const targetRect = createRect(target.offsetLeft, target.offsetTop, target.clientWidth, target.clientHeight);
    const moveTargetRect = createRect(moveTarget.offsetLeft, moveTarget.offsetTop, moveTarget.clientWidth, moveTarget.clientHeight);
    const selectionRect = computeInitialTableSelectRect(targetRect, moveTargetRect);
    // https://github.com/siyuan-note/insider/issues/1015
    const tableCells = tableBlockElement.querySelectorAll<HTMLTableCellElement>("th, td");
    adjustTableSelectRectForMergedCells(tableCells, selectionRect);
    wysiwygElement.classList.add("protyle-wysiwyg--hiderange");
    tableSelectElement.setAttribute("style", `left:${selectionRect[0] - tableContentElement.scrollLeft}px;top:${selectionRect[1] - tableElement.scrollTop}px;height:${selectionRect[3]}px;width:${selectionRect[2] + 1}px;`);
}
