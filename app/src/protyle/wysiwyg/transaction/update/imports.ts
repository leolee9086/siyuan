/** 用途：访问编辑中属性协议。使用范围：单块与批量更新快照。解耦评估：直达常量所有者。 */
import {Constants} from "../../../../constants";
/** 导出全局常量。 */
export {Constants};

/** 用途：收窄批量事务中的 HTML 元素。使用范围：批量更新回调边界。解耦评估：直达共享 DOM 守卫。 */
import {isHTMLElement} from "../../../../util/DOM/element.guard";
/** 导出 HTML 元素守卫。 */
export {isHTMLElement};

/** 用途：验证更新操作身份。使用范围：单块与批量快照。解耦评估：直达事务身份唯一规则。 */
import {requireTransactionIdentity} from "../identity";
/** 导出事务身份验证。 */
export {requireTransactionIdentity};

/** 用途：提交生成的更新操作。使用范围：单块与批量更新收尾。解耦评估：直达事务提交唯一实现。 */
import {transaction} from "../submit";
/** 导出事务提交。 */
export {transaction};
