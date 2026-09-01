/** 用途：读取属性视图当前数据；使用范围：列宽自动适配；解耦评估：复用虚拟滚动的数据快照 owner。 */
import {getAVData} from "../virtualScroll";
/** 用途：将单元格值转换为可测量文本；使用范围：列宽自动适配；解耦评估：复用单元格 render owner。 */
import {getCellValueText} from "../cell";
/** 用途：测量文本并计算 table 列宽；使用范围：列宽自动适配；解耦评估：复用列宽算法 owner。 */
import {getAVColumnTextMeasurer, getAVTableFitWidths} from "../columnWidth";
/** 用途：读取属性视图 view 标识；使用范围：列宽事务；解耦评估：复用稳定协议常量。 */
import {Constants} from "../../../../constants";
/** 用途：提交可撤销的列宽事务；使用范围：列宽自动适配；解耦评估：复用 WYSIWYG 事务 owner。 */
import {transaction} from "../../../wysiwyg/transaction/submit";

/**
 * 提交实际发生变化的属性视图列宽，保留完整的撤销数据。
 * @同步豁免: UI 事件在当前调用栈内组装事务。
 */
const setAVColumnWidths = (protyle: IProtyle, blockElement: HTMLElement, widths: Record<string, string>) => {
    const oldWidths: Record<string, string> = {};
    const newWidths: Record<string, string> = {};
    Object.entries(widths).forEach(([columnID, width]) => {
        const headerElement = blockElement.querySelector<HTMLElement>(
            `.av__row--header .av__cell[data-col-id="${columnID}"]`,
        );
        if (!headerElement || headerElement.style.width === width) {
            return;
        }
        oldWidths[columnID] = headerElement.style.width || "200px";
        newWidths[columnID] = width;
    });
    if (Object.keys(newWidths).length === 0) {
        return;
    }
    const operation = {
        action: "setAttrViewColsWidth" as TOperation,
        avID: blockElement.dataset.avId,
        blockID: blockElement.dataset.nodeId,
        viewID: blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW),
    };
    transaction(protyle, [{
        ...operation,
        data: newWidths,
    }], [{
        ...operation,
        data: oldWidths,
    }]);
};

/**
 * 根据当前表格可见内容自动适配指定列或全部列的宽度。
 * @同步豁免: 双击列宽手柄时同步计算并提交事务。
 */
export const autoFitAVColumns = (protyle: IProtyle, blockElement: HTMLElement, columnIDs?: string[]) => {
    const data = getAVData(blockElement);
    if (!data || data.viewType !== "table") {
        return;
    }
    setAVColumnWidths(protyle, blockElement, getAVTableFitWidths(
        data.view as IAVTable,
        getCellValueText,
        getAVColumnTextMeasurer(blockElement),
        columnIDs,
    ));
};
