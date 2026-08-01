/** 用途：约束持久化工具调用条目结构。使用范围：投影层持久化输入类型定义；仅依赖类型，不加载运行时实现。 */
import type {AgentToolCall} from "./imports";

/** 用途：持久化助手消息的渲染输入，约束追加助手卡片所需的最小数据。使用场景：会话投影从持久化条目还原助手消息时传入。关联类型：与 PersistedToolCallsInput 共同描述一条持久化消息的两部分内容。 */
export interface PersistedAssistantInput {
    content: string;
    timestamp?: number;
    entryId?: string;
    allowRegenerate?: boolean;
}

/** 用途：持久化工具调用列表的渲染输入，约束工具卡片与可选助手正文的追加数据。使用场景：会话投影从持久化条目还原工具调用时传入。关联类型：复用 AgentToolCall 描述单个工具调用，与 PersistedAssistantInput 共同构成持久化消息。 */
export interface PersistedToolCallsInput {
    content: string;
    toolCalls: AgentToolCall[];
    timestamp?: number;
    entryId?: string;
}
