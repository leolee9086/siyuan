/** 用途：完整应用抽象外观；使用范围：前端动作执行宿主；解耦评估：纯类型直达抽象声明，不加载具体 App。 */
import type {AppFacade} from "../../../../app/AppFacade.types";

/** 前端动作处理器的完整注册项。 */
export interface FrontendAction {
    name: string;
    description?: string;
    handler: (
        args: Record<string, unknown>,
        app: AppFacade,
    ) => Promise<{result?: string; error?: string}>;
}

/** 兼容既有插件动作注册调用方的前端动作名称；与 FrontendAction 保持同一完整定义。 */
export type IAction = FrontendAction;

/** SForge 注册表持有的完整前端动作状态。 */
export interface FrontendActionRegistryState {
    actions: Map<string, FrontendAction>;
    builtInsInitialized: boolean;
}
