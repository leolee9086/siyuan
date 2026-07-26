/** 用途：拖拽结束后恢复块焦点。使用范围：公开填充命令收尾。解耦评估：交互顺序要求直接调用唯一焦点实现，不通过事件延迟。 */
import {focusBlock} from "./imports";
/** 用途：读取目标 DOM 的原值。使用范围：undo 数据构造。解耦评估：值解析规则必须与 cell 领域唯一实现一致，不重复实现。 */
import {genCellValueByElement} from "./imports";
/** 用途：确定目标单元格列类型。使用范围：原值解析。解耦评估：复用位置领域唯一 DOM 解析，避免调用方预计算漂移。 */
import {getTypeByCellElement} from "./imports";
/** 用途：定位目标所属 AV 行。使用范围：按 rowID 收集目标。解耦评估：DOM 结构查询直达共享唯一实现。 */
import {hasClosestByClassName} from "./imports";
/** 用途：生成填充后的单元格 HTML。使用范围：事务前即时回写。解耦评估：复用 cell 渲染协议，参数注入会扩散同一固定依赖。 */
import {renderCell} from "./imports";
/** 用途：补齐填充后单元格属性。使用范围：HTML 回写后。解耦评估：与 renderCell 固定串联，复用唯一实现。 */
import {renderCellAttr} from "./imports";
/** 用途：提交填充 do/undo 操作。使用范围：存在可写目标时。解耦评估：事务是该命令明确副作用出口，不通过事件隐藏。 */
import {transaction} from "./imports";
/** 用途：声明操作生成选项。使用范围：内部生成阶段。解耦评估：纯类型不加载实现。 */
import type {DragFillRenderOptions} from "./dragFill.types";
/** 用途：声明完整填充命令。使用范围：公开入口。解耦评估：纯类型不加载实现。 */
import type {DragFillRequest} from "./dragFill.types";
/** 用途：声明按行排列的目标映射。使用范围：来源矩阵分发。解耦评估：纯类型不加载实现。 */
import type {DragFillTargetsByRow} from "./dragFill.types";
/** 用途：为单个目标生成成对事务操作。使用范围：按原 DOM 顺序逐项编排。解耦评估：纯步骤生成与 DOM/事务副作用分离。 */
import {createDragFillStep} from "./dragFill.step";

/** 按当前 DOM 顺序收集来源区域以外的活动单元格。 */
const collectDragFillTargets = (nodeElement: HTMLElement, originCellIds: string[]) => {
    const targetsByRow: DragFillTargetsByRow = {};
    for (const item of nodeElement.querySelectorAll<HTMLElement>(".av__cell--active")) {
        const itemID = item.dataset.id;
        if (!itemID) {
            throw new Error("AV drag fill target requires data-id");
        }
        if (originCellIds.includes(itemID)) {
            continue;
        }
        const rowElement = hasClosestByClassName(item, "av__row");
        if (!rowElement) {
            continue;
        }
        const rowID = rowElement.dataset.id;
        const colID = item.dataset.colId;
        const cellType = getTypeByCellElement(item);
        if (!rowID || !colID || !cellType) {
            throw new Error("AV drag fill target requires row, column, and type identity");
        }
        // 首次遇到目标行时建立列表，保持后续 Object.entries 与 DOM 行顺序一致。
        if (!targetsByRow[rowID]) {
            targetsByRow[rowID] = [];
        }
        const rowTargets = targetsByRow[rowID];
        const value = genCellValueByElement(cellType, item);
        if (!value.id) {
            throw new Error("AV drag fill target value requires id");
        }
        rowTargets.push({...value, id: value.id, colId: colID, element: item});
    }
    return targetsByRow;
};

/** 按来源矩阵生成操作并同步回写目标 DOM。 */
const buildDragFillOperations = (
    targetsByRow: DragFillTargetsByRow,
    originData: {[key: string]: IAVCellValue[]},
    options: DragFillRenderOptions,
) => {
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    const originKeys = Object.keys(originData);
    for (const [rowIndex, [rowID, targets]] of Object.entries(targetsByRow).entries()) {
        for (const [cellIndex, item] of targets.entries()) {
            const originKey = originKeys[rowIndex % originKeys.length];
            const originRow = originKey ? originData[originKey] : undefined;
            const originValue = originRow?.[cellIndex];
            // https://ld246.com/article/1707975507571 数据库下拉填充数据后异常
            const step = createDragFillStep({target: item, source: originValue, avID: options.avID, rowID});
            if (!step) {
                continue;
            }
            item.element.innerHTML = String(renderCell(step.data, 0, options.showIcon));
            renderCellAttr(item.element, step.data);
            Reflect.deleteProperty(item, "colId");
            Reflect.deleteProperty(item, "element");
            doOperations.push(step.doOperation);
            undoOperations.push(step.undoOperation);
        }
    }
    return {doOperations, undoOperations};
};

/** 将当前划选区域按来源矩阵复制，并提交可撤销事务。 @同步豁免: 需要绝对同步的DOM访问 */
export const dragFillCellsValue = ({
    protyle,
    nodeElement,
    originData,
    originCellIds,
    activeElement,
}: DragFillRequest) => {
    const dragFillElement = nodeElement.querySelector(".av__drag-fill");
    dragFillElement?.remove();
    const targetsByRow = collectDragFillTargets(nodeElement, originCellIds);
    const showIcon = activeElement.querySelector(".b3-menu__avemoji") ? true : false;
    const avID = nodeElement.dataset.avId;
    if (!avID) {
        throw new Error("AV drag fill root requires data-av-id");
    }
    const {doOperations, undoOperations} = buildDragFillOperations(
        targetsByRow,
        originData,
        {avID, showIcon},
    );
    focusBlock(nodeElement);
    // 没有可写目标时只恢复焦点，不提交空事务。
    if (doOperations.length > 0) {
        transaction(protyle, doOperations, undoOperations);
    }
};
