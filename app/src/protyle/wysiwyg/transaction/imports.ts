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
