/** 用途：打开移动端全屏搜索模型；使用范围：移动 AppFacade 全局搜索能力；解耦评估：直达移动搜索唯一实现，不与桌面 Search 页签实现合并。 */
import {popSearch} from "../../menu/search";
/** 导出移动搜索入口。 */
export {popSearch};

/** 用途：约束移动搜索宿主完整能力；使用范围：移动 AppFacade 委托；解耦评估：纯类型直达完整应用外观，不加载具体 App。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 导出完整应用外观。 */
export type {AppFacade};
