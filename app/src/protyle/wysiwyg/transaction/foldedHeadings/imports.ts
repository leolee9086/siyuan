/** 用途：提供折叠标题事务所需应用常量。使用范围：展开持久化折叠标题。解耦评估：常量属于稳定基础协议。 */
import {Constants} from "../../../../constants";
/** 导出事务应用常量。 */
export {Constants};

/** 用途：提交展开标题事务。使用范围：非视图折叠标题展开。解耦评估：网络访问由唯一请求层提供。 */
import {fetchSyncPost} from "../../../../util/network/fetch";
/** 导出同步事务请求函数。 */
export {fetchSyncPost};

/** 用途：识别视图级折叠上下文。使用范围：展开标题前分流。解耦评估：折叠状态由 Protyle 工具域独占。 */
import {hasViewFoldContext} from "../../../util/viewFold";
/** 导出视图折叠查询函数。 */
export {hasViewFoldContext};

/** 用途：切换视图级临时折叠。使用范围：视图折叠标题展开。解耦评估：折叠状态由 Protyle 工具域独占。 */
import {setViewFoldTransient} from "../../../util/viewFold";
/** 导出视图折叠切换函数。 */
export {setViewFoldTransient};
