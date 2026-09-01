/** 用途：聚焦第一个转换结果。使用范围：多组选区转换完成后。解耦评估：选择能力由 Protyle 工具域唯一提供。 */
import {focusBlock} from "../../../../util/selection";
/** 导出块焦点定位函数。 */
export {focusBlock};

/** 用途：关闭转换后的块标工具。使用范围：多组选区转换完成后。解耦评估：UI 命令由 Protyle UI 域唯一提供。 */
import {hideElements} from "../../../../ui/hideElements";
/** 导出工具隐藏函数。 */
export {hideElements};

/** 用途：构建每个选区组的容器操作。使用范围：分组转换。解耦评估：只暴露稳定的转换事务命令。 */
import {turnsIntoOneTransaction} from "../../turns/container";
/** 导出单容器转换函数。 */
export {turnsIntoOneTransaction};

/** 用途：提交合并后的可撤销操作。使用范围：分组转换。解耦评估：事务提交由单一 owner 提供。 */
import {transaction} from "../../submit";
/** 导出事务提交函数。 */
export {transaction};
