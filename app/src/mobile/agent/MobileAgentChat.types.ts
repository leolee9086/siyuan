/** 用途：约束移动 Agent 的应用上下文；使用范围：跨模块状态注册表；解耦评估：纯类型依赖，避免业务模块复制宿主字段。 */
import type {AppFacade} from "./imports";
/** 用途：约束共享 Agent 聊天模型引用；使用范围：状态注册表与轮询；解耦评估：纯类型依赖，模型实现由工厂集中装配。 */
import type {AgentChat} from "./imports";
/** 用途：约束共享 Tab 容器引用；使用范围：状态注册表与面板复用；解耦评估：纯类型依赖，生命周期由布局层维护。 */
import type {Tab} from "./imports";

/** 移动端 Agent 未读通知类型；用于菜单状态点和系统通知分流。 */
export type AgentChatNotification = "confirm" | "done";

/** 移动端 Agent 流式状态；用于菜单图标旋转状态同步。 */
export type AgentChatStatus = "running" | "idle";

/** 移动 Agent 的跨 HMR 状态；由 Symbol 注册表持有，避免模块级可变变量。 */
export interface MobileAgentChatState {
    app?: AppFacade;
    agentChat?: AgentChat;
    agentTab?: Tab;
    rootElement?: HTMLElement;
    detachedRoot?: DocumentFragment;
    visible: boolean;
    running: boolean;
    unread: AgentChatNotification | undefined;
}
