/** 用途：约束持久化状态与条目；使用范围：本目录全部流程；解耦评估：仅导入核心抽象接口，不加载 AgentChat class。 */
import type {AgentChatRuntime, SessionEntry} from "../../AgentChat.runtime.types";
/** 导出聊天运行时接口。 */
export type {AgentChatRuntime};
/** 导出会话条目类型。 */
export type {SessionEntry};

/** 用途：约束持久化会话数据；使用范围：快照、保存、重载和恢复；解耦评估：纯类型不加载仓储实现。 */
import type {AgentSession} from "../../../session/AgentSession.types";
/** 导出持久化会话类型。 */
export type {AgentSession};
