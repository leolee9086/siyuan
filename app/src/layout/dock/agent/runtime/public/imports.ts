/** 用途：约束布局模型领域；使用范围：AgentChat 公开协议；解耦评估：纯类型依赖。 */
import type {ModelDomain} from "../../../../lifecycle/model.types";
/** 用途：约束布局页签；使用范围：AgentChat 公开协议；解耦评估：纯类型依赖。 */
import type {LayoutTab} from "../../../../layout.types";
/** 用途：约束应用能力；使用范围：AgentChat 公开协议；解耦评估：纯类型依赖。 */
import type {AppFacade} from "../../../../../app/AppFacade.types";
/** 用途：约束面板会话；使用范围：AgentChat 公开协议；解耦评估：纯类型依赖。 */
import type {AgentPanelConversation} from "../agentPanel.ports.types";

/** 导出布局模型领域类型。 */
export type {ModelDomain};
/** 导出布局页签类型。 */
export type {LayoutTab};
/** 导出应用能力类型。 */
export type {AppFacade};
/** 导出面板会话类型。 */
export type {AgentPanelConversation};
