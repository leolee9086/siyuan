/** 用途：约束消息容器和当前助手占位；使用范围：交互卡片插入。 */
import type {AgentChatRuntime} from "./imports";

/** 在当前助手占位之前插入交互卡片。 @同步豁免: UI构建 */
export function insertBeforeAI(runtime: AgentChatRuntime, element: HTMLElement) {
    const assistantAnchor = runtime.currentAIElement;
    runtime.messagesContainer.insertBefore(element, assistantAnchor);
}
