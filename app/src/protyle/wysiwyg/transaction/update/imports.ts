/** 用途：访问事务提交和更新所需的常量、HTML 处理及标识验证。使用范围：更新 owner 内部。解耦评估：同域网关集中外部依赖，更新 API 仅依赖稳定符号。 */
import {Constants} from "../../../../constants";
/** 导出编辑属性常量。 */
export {Constants};

/** 用途：清理更新 HTML 中的标题编号展示标记。使用范围：单块和批量更新。解耦评估：编号规则由 Protyle 工具域独占。 */
import {cleanHeadingNumberHTML} from "../../../util/headingNumber";
/** 导出标题编号清理函数。 */
export {cleanHeadingNumberHTML};

/** 用途：收窄批量更新元素到 HTML 元素。使用范围：执行调用方 DOM 回调前。解耦评估：DOM 类型判断由工具域统一提供。 */
import {isHTMLElement} from "../../../../util/DOM/element.guard";
/** 导出 HTML 元素判断函数。 */
export {isHTMLElement};

/** 用途：同步超级块布局。使用范围：单块更新提交前。解耦评估：超级块渲染规则由事务刷新域提供。 */
import {refreshSbs} from "../refreshSbs";
/** 导出超级块刷新函数。 */
export {refreshSbs};

/** 用途：验证事务操作 ID。使用范围：构造更新操作前。解耦评估：标识验证由事务 identity owner 提供。 */
import {requireTransactionIdentity} from "../identity";
/** 导出事务标识验证函数。 */
export {requireTransactionIdentity};

/** 用途：提交可撤销更新操作。使用范围：单块和批量更新完成后。解耦评估：提交协议由事务 submit owner 提供。 */
import {transaction} from "../submit";
/** 导出事务提交函数。 */
export {transaction};
