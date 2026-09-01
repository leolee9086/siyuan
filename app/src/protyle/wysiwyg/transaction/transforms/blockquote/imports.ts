/** 用途：定位转换后的光标和保存撤销选择。使用范围：引述输入转换。解耦评估：选择协议由 Protyle 工具域唯一提供。 */
import {focusBlock} from "../../../../util/selection";
/** 导出块焦点定位函数。 */
export {focusBlock};

/** 用途：定位转换后的光标和保存撤销选择。使用范围：引述输入转换。解耦评估：选择协议由 Protyle 工具域唯一提供。 */
import {focusByWbr} from "../../../../util/selection";
/** 导出 WBR 焦点定位函数。 */
export {focusByWbr};

/** 用途：读取当前编辑范围。使用范围：引述输入转换。解耦评估：选择协议由 Protyle 工具域唯一提供。 */
import {getEditorRange} from "../../../../util/selection";
/** 导出编辑范围读取函数。 */
export {getEditorRange};

/** 用途：建立撤销后的焦点上下文。使用范围：引述输入转换。解耦评估：选择协议由 Protyle 工具域唯一提供。 */
import {getUndoFocusContext} from "../../../../util/selection";
/** 导出撤销焦点上下文函数。 */
export {getUndoFocusContext};

/** 用途：处理前置折叠标题。使用范围：插入空引述前。解耦评估：折叠协议由 Protyle 工具域唯一提供。 */
import {setFold} from "../../../../util/blockFold";
/** 导出标题折叠函数。 */
export {setFold};

/** 用途：在转换完成后关闭块标工具。使用范围：引述输入转换。解耦评估：UI 隐藏命令由 Protyle UI 域唯一提供。 */
import {hideElements} from "../../../../ui/hideElements";
/** 导出工具隐藏函数。 */
export {hideElements};

/** 用途：构建块转引述容器的操作。使用范围：已有段落转换为引述。解耦评估：引述 owner 只消费稳定转换命令。 */
import {turnsIntoOneTransaction} from "../../turns/container";
/** 导出单容器转换函数。 */
export {turnsIntoOneTransaction};

/** 用途：提交构造好的可撤销操作。使用范围：引述输入转换。解耦评估：提交协议由事务 owner 唯一提供。 */
import {transaction} from "../../submit";
/** 导出事务提交函数。 */
export {transaction};
