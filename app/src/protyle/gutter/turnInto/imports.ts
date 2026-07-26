/** 用途：多块合并；使用范围：TurnInto 菜单动作；解耦评估：引用 transaction 领域唯一实现。 */
import {turnsIntoOneTransaction} from "../../wysiwyg/transaction.turns";
/** 用途：批量类型转换；使用范围：TurnInto 菜单动作；解耦评估：引用 transaction 领域唯一实现。 */
import {turnsIntoTransaction} from "../../wysiwyg/transaction.turns";
/** 用途：单块类型转换；使用范围：TurnInto 菜单动作；解耦评估：引用 transaction 领域唯一实现。 */
import {turnsOneInto} from "../../wysiwyg/transaction.turns";

/** 多块合并菜单动作。 */
export {turnsIntoOneTransaction};
/** 批量类型转换菜单动作。 */
export {turnsIntoTransaction};
/** 单块类型转换菜单动作。 */
export {turnsOneInto};
