/** 用途：聚焦第一个转换结果。使用范围：多组选区转换完成后。解耦评估：通过同域 imports 网关使用选择能力。 */
import {focusBlock} from "./imports";
/** 用途：关闭转换后的块标工具。使用范围：多组选区转换完成后。解耦评估：通过同域 imports 网关使用 UI 命令。 */
import {hideElements} from "./imports";
/** 用途：构建每个选区组的容器操作。使用范围：分组转换。解耦评估：通过同域 imports 网关使用转换事务。 */
import {turnsIntoOneTransaction} from "./imports";
/** 用途：提交合并后的可撤销操作。使用范围：分组转换。解耦评估：通过同域 imports 网关使用提交协议。 */
import {transaction} from "./imports";

/** 作用：把多个连续选择组转换为独立容器。意图：在一次撤销记录中保持每组原有边界。调用时机：多选转列表、引述或标注时。 */
export const turnsIntoGroupsTransaction = async (options: {
    protyle: IProtyle,
    selectsElementGroups: Element[][],
    type: Exclude<TTurnIntoOne, "BlocksMergeSuperBlock">,
}) => {
    const firstGroup = options.selectsElementGroups[0];
    const firstElement = firstGroup?.[0];
    if (!firstElement) {
        return;
    }
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    for (const selectsElement of options.selectsElementGroups) {
        if (selectsElement.length === 0) {
            continue;
        }
        const groupOperations = await turnsIntoOneTransaction({
            protyle: options.protyle,
            selectsElement,
            type: options.type,
            getOperations: true,
        });
        if (!groupOperations) {
            continue;
        }
        doOperations.push(...groupOperations.doOperations);
        undoOperations.splice(0, 0, ...groupOperations.undoOperations);
    }
    transaction(options.protyle, doOperations, undoOperations);
    const firstID = firstElement.getAttribute("data-node-id");
    if (firstID) {
        focusBlock(options.protyle.wysiwyg.element.querySelector(`[data-node-id="${firstID}"]`));
    }
    hideElements(["gutter"], options.protyle);
};
