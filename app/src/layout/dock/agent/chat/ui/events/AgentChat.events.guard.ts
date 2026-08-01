import type {AgentPanelConversationKind} from "./imports";

/** 校验目标选择框的值属于面板支持的会话类型。 */
export function isAgentPanelConversationKind(value: string): value is AgentPanelConversationKind {
    return value === "native-agent" || value === "magi";
}

/** 读取自定义事件载荷：仅当事件类型匹配时返回载荷，否则返回 null。 */
export function readCustomEventDetail<DetailType>(event: Event): DetailType | null {
    return event instanceof CustomEvent ? (event.detail as DetailType) : null;
}
