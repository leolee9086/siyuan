/** 用途：完整应用外观；使用范围：身份入口模型查询与页签导航；解耦评估：纯类型直达外观声明。 */
import type {AppFacade} from "../../../../app/AppFacade.types";
/** 用途：完整 Custom 模型领域根；使用范围：身份页签匹配；解耦评估：纯类型直达领域声明。 */
import type {CustomDomain} from "../../../../layout/dock/custom/custom.types";
/** 用途：身份页签类型身份；使用范围：匹配和创建页签；解耦评估：直达相邻唯一声明。 */
import {MAGI_IDENTITY_ACCESS_TAB_TYPE} from "../tab";
/** 用途：读取缺省应用上下文；使用范围：无显式 App 的入口；解耦评估：直达环境唯一实现。 */
import {getSiyuanWebSocket} from "../../../../util/siyuanEnvironments/getSiyuanConfig.environment";

/** 身份打开子域使用的完整应用外观。 */
export type {AppFacade};
/** 身份打开子域使用的完整 Custom 模型。 */
export type {CustomDomain};
/** 身份打开子域使用的页签身份。 */
export {MAGI_IDENTITY_ACCESS_TAB_TYPE};
/** 身份打开子域使用的缺省应用环境读取。 */
export {getSiyuanWebSocket};
