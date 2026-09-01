/** 用途：访问事务应用 ID 与编辑属性名。使用范围：无编辑器提交和更新标记。解耦评估：常量是稳定基础协议。 */
import {Constants} from "../../../constants";
/** 导出全局常量。 */
export {Constants};

/** 用途：提交事务网络请求。使用范围：无 Protyle 的直接内核提交。解耦评估：直达网络唯一实现。 */
import {fetchPost} from "../../../util/network/fetch";
/** 导出 POST 请求。 */
export {fetchPost};

/** 用途：执行本地 DOM 同步并排队提交。使用范围：事务命令主流程。解耦评估：当前真实实现，后续按专项 TTT 拆分内部职责。 */
import {promiseTransaction} from "../transaction.promise";
/** 导出本地同步事务实现。 */
export {promiseTransaction};

/** 用途：为视图级折叠上下文归一化事务内容。使用范围：提交前。解耦评估：视图状态属于 Protyle 工具域，事务只调用其稳定协议。 */
import {prepareViewFoldTransaction} from "../../util/viewFold";
/** 导出视图折叠事务预处理。 */
export {prepareViewFoldTransaction};

/** 用途：去除仅用于编辑器展示的标题编号标记。使用范围：事务落盘前。解耦评估：编号规则由 Protyle 工具域独占。 */
import {cleanHeadingNumberOperations} from "../../util/headingNumber";
/** 导出标题编号事务清理函数。 */
export {cleanHeadingNumberOperations};
