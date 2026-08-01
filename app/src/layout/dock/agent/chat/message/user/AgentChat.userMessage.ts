/** 用途：约束用户消息状态；使用范围：本文件全部函数。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束用户消息可选展示字段；使用范围：消息创建和追加；解耦评估：直接复用消息领域聚合类型，不重复声明零碎接口。 */
import type {UserMessageOptions} from "./imports";
/** 用途：消息追加后贴底；使用范围：用户消息追加；解耦评估：滚动意图由统一反馈函数处理。 */
import {scrollToBottom} from "./imports";
/** 用途：绑定用户消息动作；使用范围：消息元素构建；解耦评估：复制和编辑事件集中在用户动作模块。 */
import {bindUserMessageActions} from "./AgentChat.userActions";
/** 用途：创建只读正文；使用范围：消息元素构建；解耦评估：正文 DOM 规则集中在用户渲染模块。 */
import {createUserMessageBody} from "./AgentChat.userRender";
/** 用途：执行富文本后处理；使用范围：消息追加；解耦评估：复用用户渲染模块的统一后处理入口。 */
import {renderUserMessage} from "./AgentChat.userRender";

/**
 * 创建带复制和编辑入口的用户消息元素。
 * @同步豁免: UI构建 消息必须在追加到列表前同步完成 DOM 结构和事件绑定。
 */
export function createUserMessage(runtime: AgentChatRuntime, text: string, options: UserMessageOptions = {}) {
    const {timestamp, entryId, blockHTML} = options;
    const element = document.createElement("div");
    element.className = "agent-chat__msg agent-chat__msg--user";
    if (entryId) {
        element.setAttribute("data-message-id", entryId);
    }
    const body = createUserMessageBody(runtime, text, blockHTML);
    element.appendChild(body);
    bindUserMessageActions(runtime, {
        element,
        body,
        text,
        ...(timestamp !== undefined ? {timestamp} : {}),
        ...(entryId !== undefined ? {entryID: entryId} : {}),
    });
    return element;
}

/**
 * 追加并渲染用户消息，然后把消息视图定位到底部。
 * @同步豁免: UI构建 用户轮次建立要求条目 DOM、富文本后处理和滚动意图在同一事件周期内登记。
 */
export function appendUserMessage(runtime: AgentChatRuntime, text: string, options: UserMessageOptions = {}) {
    const element = createUserMessage(runtime, text, options);
    runtime.messagesContainer.appendChild(element);
    renderUserMessage(runtime, element);
    scrollToBottom(runtime, true);
}

/** 重新导出用户消息渲染入口，供再生成流程更新替换节点。 */
export {renderUserMessage};
