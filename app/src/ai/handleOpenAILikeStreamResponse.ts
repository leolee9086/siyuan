import { parseAndValidateStreamData } from "./chatStream.utils";

// 定义流式响应结果类型
export interface StreamResponseResult {
    content: string | null;
    isFinished: boolean;
    error?: Error;
}

// 处理流式响应 - 纯函数，不直接修改状态
export const handleOpenAILikeStreamResponse = (
    dataStr: string,
): StreamResponseResult => {
    const data = parseAndValidateStreamData(dataStr);
    if (!data) {
        return {
            content: null,
            isFinished: false,
            error: new Error('接到了空的data,检查响应结构')
        };
    }
    if (!data.choices) {
        return {
            content: null,
            isFinished: false,
            error: new Error('响应结构不正确,检查响应结构')
        };
    }
    if (!(data.choices.length > 0)) {
        return {
            content: null,
            isFinished: false,
            error: new Error('choice长度错误,检查响应结构')
        };
    }
    const choice = data.choices[0];
    if (!choice) {
        return {
            content: null,
            isFinished: false
        };
    }

    // 检查是否是结束标记
    if (choice.finish_reason === 'stop') {
        return {
            content: null,
            isFinished: true
        };
    }

    try {
        // 优先处理 content 字段，如果没有则处理 reasoning_content 字段
        const content = choice.delta?.content || choice.message?.content;
        const reasoningContent = choice.delta?.reasoning_content || choice.message?.reasoning_content;

        // 处理普通内容
        if (typeof content === 'string' && content.length > 0) {
            return {
                content: content,
                isFinished: false
            };
        }

        // 处理推理内容
        if (typeof reasoningContent === 'string' && reasoningContent.length > 0) {
            return {
                content: reasoningContent,
                isFinished: false
            };
        }

        // 处理非字符串内容的情况，可能是数字、对象等
        if (content !== undefined && content !== null && content !== '') {
            console.warn('接收到非字符串内容:', content);
            const stringContent = String(content);
            return {
                content: stringContent,
                isFinished: false
            };
        }

        // 处理非字符串推理内容的情况
        if (reasoningContent !== undefined && reasoningContent !== null && reasoningContent !== '') {
            console.warn('接收到非字符串推理内容:', reasoningContent);
            const stringContent = String(reasoningContent);
            return {
                content: stringContent,
                isFinished: false
            };
        }

        // 如果是空内容且不是结束标记，可能是流式数据的中间状态，直接返回
        return {
            content: null,
            isFinished: false
        };

    } catch (e) {
        console.error("Failed to parse SSE data:", dataStr);
        return {
            content: null,
            isFinished: false,
            error: new Error('检查响应结构')
        };
    }
};

