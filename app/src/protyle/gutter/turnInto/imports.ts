/** 用途：多块合并；使用范围：TurnInto 菜单动作；解耦评估：容器 owner 是唯一实现，菜单不耦合其他转换流程。 */
import {turnsIntoOneTransaction} from "../../wysiwyg/transaction/turns/container";
/** 用途：批量类型转换；使用范围：TurnInto 菜单动作；解耦评估：普通块 owner 独立维护段落和标题语义。 */
import {turnsIntoTransaction} from "../../wysiwyg/transaction/turns/multiple";
/** 用途：单块类型转换；使用范围：TurnInto 菜单动作；解耦评估：单块 owner 独立维护容器取消语义。 */
import {turnsOneInto} from "../../wysiwyg/transaction/turns/single";
/** 用途：非连续块组转换。使用范围：多选 TurnInto 菜单动作。解耦评估：分组 owner 负责组合连续组，菜单层不应复制其事务编排。 */
import {turnsIntoGroupsTransaction} from "../../wysiwyg/transaction/transforms/groups";

/** 多块合并菜单动作。 */
export {turnsIntoOneTransaction};
/** 批量类型转换菜单动作。 */
export {turnsIntoTransaction};
/** 单块类型转换菜单动作。 */
export {turnsOneInto};
/** 非连续块组转换。 */
export {turnsIntoGroupsTransaction};
