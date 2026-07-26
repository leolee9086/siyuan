/** 用途：事务 API 常量；使用范围：Prepared Transaction 内核请求；解耦评估：直达协议常量所有者。 */
import {Constants} from "../../../../constants";
/** 导出事务常量。 */
export {Constants};

/** 用途：发送事务请求；使用范围：Prepared Transaction 内核写入；解耦评估：直达网络唯一实现。 */
import {fetchPost} from "../../../../util/network/fetch";
/** 导出 POST 请求。 */
export {fetchPost};

/** 用途：刷新编辑器字数；使用范围：事务响应完成；解耦评估：直达状态端口唯一实现。 */
import {countBlockWord} from "../../../runtime/status.port";
/** 导出字数刷新。 */
export {countBlockWord};

/** 用途：按编辑器串行提交事务；使用范围：Prepared Transaction 请求；解耦评估：直达事务队列唯一实现。 */
import {queueTransaction} from "../../../util/transactionQueue";
/** 导出事务队列。 */
export {queueTransaction};

/** 用途：登记撤销状态；使用范围：Prepared Transaction 提交前；解耦评估：直达 undo 唯一实现。 */
import {registerTransactionUndo} from "../undo";
/** 导出撤销登记。 */
export {registerTransactionUndo};

/** 用途：显示移动端待同步状态；使用范围：Prepared Transaction 网络排队前；解耦评估：直达事务生命周期唯一实现。 */
import {markTransactionSyncPending} from "../lifecycle/syncIndicator";
/** 导出同步指示器生命周期。 */
export {markTransactionSyncPending};
