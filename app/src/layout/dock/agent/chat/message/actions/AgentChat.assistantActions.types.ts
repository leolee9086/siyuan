/** 描述助手消息动作栏的可选正文、时间和重新生成能力。 */
export interface AssistantMessageActionOptions {
    contentOverride?: string;
    timestamp?: number;
    allowRegenerate?: boolean;
}
