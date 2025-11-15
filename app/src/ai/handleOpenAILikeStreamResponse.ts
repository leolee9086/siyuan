import { parseAndValidateStreamData, updateChatState } from "./chatStream.utils";
import type { ChatSessionState } from "./session/session.types";

// 处理流式响应

export const handleOpenAILikeStreamResponse = (
    dataStr: string,
    state: ChatSessionState
): string | null => {
    if (!state.isStreaming) {
        throw new Error('state 不在streaming状态');

    }
    const data = parseAndValidateStreamData(dataStr);
    if (!data) {
        throw new Error('接到了空的data,检查响应结构');
    }
    if (!data.choices) {
        throw new Error('响应结构不正确,检查响应结构');
    }
    if (!(data.choices.length > 0)) {
        throw new Error('choice长度错误,检查响应结构');
    }
    const choice = data.choices[0];
    if (!choice) {
        return null
    }
    // 检查是否是结束标记
    if (choice.finish_reason === 'stop') {
        // 流式结束，不需要处理内容，直接返回
        return null;
    }
    try {
        // 优先处理 content 字段，如果没有则处理 reasoning_content 字段
        const content = choice.delta?.content || choice.message?.content;
        const reasoningContent = choice.delta?.reasoning_content || choice.message?.reasoning_content;
        // 处理普通内容
        if (typeof content === 'string' && content.length > 0) {
            updateChatState(state, {
                responseContentStr: state.responseContentStr + content
            });
            // 返回处理后的内容，由组件逻辑负责DOM更新
            return content;
        }
        // 处理推理内容
        if (typeof reasoningContent === 'string' && reasoningContent.length > 0) {
            updateChatState(state, {
                responseContentStr: state.responseContentStr + reasoningContent
            });
            // 返回处理后的内容，由组件逻辑负责DOM更新
            return reasoningContent;
        }
        // 处理非字符串内容的情况，可能是数字、对象等
        if (content !== undefined && content !== null && content !== '') {
            console.warn('接收到非字符串内容:', content);
            const stringContent = String(content);
            updateChatState(state, {
                responseContentStr: state.responseContentStr + stringContent
            });
            return stringContent;
        }
        // 处理非字符串推理内容的情况
        if (reasoningContent !== undefined && reasoningContent !== null && reasoningContent !== '') {
            console.warn('接收到非字符串推理内容:', reasoningContent);
            const stringContent = String(reasoningContent);
            updateChatState(state, {
                responseContentStr: state.responseContentStr + stringContent
            });
            return stringContent;
        }

        // 如果是空内容且不是结束标记，可能是流式数据的中间状态，直接返回
        return null;


    } catch (e) {
        console.error("Failed to parse SSE data:", dataStr);
        throw new Error('检查响应结构');

    }

    throw new Error('分支检查覆盖不全');

};
