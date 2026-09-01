/** 用途：声明移动 Agent 打开回调的应用外观参数；使用范围：Agent 端口与其宿主注册边界；解耦评估：纯类型依赖，擦除后不加载应用入口，不能以事件替代稳定调用契约。 */
import type {AppFacade} from "../../app/AppFacade.types";

/** 移动 Agent 打开能力的调用契约。 */
export type MobileAgentOpener = (app: AppFacade) => void;
