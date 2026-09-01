/** 用途：读取空段落目标转换常量。使用范围：Markdown 构造和编辑属性标记。解耦评估：常量属于稳定基础协议。 */
import {Constants} from "../../../../../constants";
/** 导出转换所需常量。 */
export {Constants};

/** 用途：聚焦替换后的目标块。使用范围：空段落转换完成后。解耦评估：选择能力由 Protyle 工具域唯一提供。 */
import {focusBlock} from "../../../../util/selection";
/** 导出块焦点定位函数。 */
export {focusBlock};

/** 用途：关闭转换后的块标工具。使用范围：空段落转换完成后。解耦评估：UI 命令由 Protyle UI 域唯一提供。 */
import {hideElements} from "../../../../ui/hideElements";
/** 导出工具隐藏函数。 */
export {hideElements};

/** 用途：读取本地代码语言偏好。使用范围：空段落转代码块。解耦评估：环境访问封装在专用模块，不直接读取 window。 */
import {getSiyuanStorage} from "../../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出本地存储读取函数。 */
export {getSiyuanStorage};

/** 用途：读取段落可编辑节点。使用范围：空段落替换准备。解耦评估：块树查询由 WYSIWYG 工具域唯一提供。 */
import {getContenteditableElement} from "../../../getBlock";
/** 导出可编辑节点查询函数。 */
export {getContenteditableElement};

/** 用途：提交转换的可撤销操作。使用范围：空段落转换。解耦评估：提交协议由事务 owner 唯一提供。 */
import {transaction} from "../../submit";
/** 导出事务提交函数。 */
export {transaction};

/** 用途：刷新转换后的视觉内容。使用范围：空段落转换。解耦评估：低层命令只访问稳定端口。 */
import {getTransactionTransformVisualEffects} from "../../transformVisual/port";
/** 导出转换视觉端口读取函数。 */
export {getTransactionTransformVisualEffects};
