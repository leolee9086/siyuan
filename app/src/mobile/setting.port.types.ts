/** 用途：声明移动设置打开回调的应用外观参数；使用范围：设置端口和菜单宿主；解耦评估：纯类型依赖，擦除后不加载应用入口。 */
import type {AppFacade} from "../app/AppFacade.types";
/** 用途：约束可打开的设置页签标识；使用范围：移动设置端口调用边界；解耦评估：只依赖稳定 ID 类型，不加载设置装配模块。 */
import type {SettingTabId} from "../config/setting/setting.types";

/** 移动设置打开能力的调用契约。 */
export type MobileSettingOpener = (app: AppFacade, tab?: SettingTabId, returnCallback?: () => void) => void;
