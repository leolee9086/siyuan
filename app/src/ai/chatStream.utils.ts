import type { ChatSessionState } from "./session/session.types";
import { AIConfig, chatResponseDataSchema } from "./types";
import { 检测同步工具调用代码块, 检测异步工具调用代码块 } from "./parser/toolCallDetector";


// 更新聊天状态
export const updateChatState = (state: ChatSessionState, updates: Partial<ChatSessionState>): void => {
    Object.assign(state, updates);
};


// 构建请求头
export const buildRequestHeaders = (aiConfig: AIConfig) => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": aiConfig.apiUserAgent,
    };

    // 根据API提供商添加认证头
    if (aiConfig.apiProvider === "OpenAI" || aiConfig.apiProvider === "ZhipuAI") {
        headers["Authorization"] = `Bearer ${aiConfig.apiKey}`;
    }

    // 如果有API版本，添加版本头
    if (aiConfig.apiVersion) {
        headers["API-Version"] = aiConfig.apiVersion;
    }

    return headers;
};

// 解析和验证流式响应数据
export const parseAndValidateStreamData = (dataStr: string) => {
    try {
        // 处理SSE数据格式，移除可能的前缀
        let cleanDataStr = dataStr.trim();
        
        // 移除 "data: " 前缀（如果存在）
        if (cleanDataStr.startsWith('data: ')) {
            cleanDataStr = cleanDataStr.substring(6);
        }
        
        // 跳过空行和 "[DONE]" 标记
        if (!cleanDataStr || cleanDataStr === '[DONE]') {
            return null;
        }

        // 解析JSON数据
        const rawData = JSON.parse(cleanDataStr);

        // 使用zod验证数据格式
        const parseResult = chatResponseDataSchema.safeParse(rawData);
        if (!parseResult.success) {
            console.error("数据格式验证失败:", parseResult.error);
            console.warn("原始数据:", rawData);
            return null;
        }

        const data = parseResult.data;

        // 处理错误
        if (data.error) {
            console.error("API Error:", data.error);
            return null;
        }

        return data;
    } catch (error) {
        console.error("解析SSE数据时发生错误:", error);
        console.warn("原始数据字符串:", dataStr);
        return null;
    }
};

// 渲染blockDOM内容（纯数据处理，不包含DOM操作）
export const processBlockDOMContent = (
    state: ChatSessionState,
    protyle: IProtyle
): string => {
    if (!protyle.lute) {
        console.error(protyle)
        throw new Error('protyle结构不正确')
    }
    // 使用lute引擎将内容转换为块级DOM
    const blockDom = protyle.lute.SpinBlockDOM(state.responseContentStr);
    state.blockDOMContent = blockDom;
    // 从生成的blockDOM中处理data-node-id属性并设置custom-assistant-name
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = blockDom;
    // 查找所有带有data-node-id属性的元素
    const elementsWithNodeId = tempDiv.querySelectorAll('[data-node-id]');
    elementsWithNodeId.forEach(element => {
        // 设置custom-assistant-name属性为default
        element.setAttribute('custom-assistant-name', 'default');
    });
    // 检测并处理DOM中的工具调用
    const toolCode = 检测同步工具调用代码块(tempDiv);
    if (toolCode && state.onWaitToolCallDetected) {
        // 使用回调函数执行工具调用
        state.responseContentStr = state.responseContentStr.replace(`custom-aitoolcall-fired='false'`, `custom-aitoolcall-fired='true'`)
        state.onWaitToolCallDetected(toolCode).catch(error => {
            console.error('工具调用执行失败:', error);
        });
    }

    // 检测并处理DOM中的异步工具调用
    const asyncToolCode = 检测异步工具调用代码块(tempDiv);
    if (asyncToolCode && state.onAsyncToolCallDetected) {
        // 使用回调函数执行异步工具调用
        state.responseContentStr = state.responseContentStr.replace(`custom-aitoolcall-fired='false'`, `custom-aitoolcall-fired='true'`)
        state.onAsyncToolCallDetected(asyncToolCode).catch(error => {
            console.error('异步工具调用执行失败:', error);
        });
    }

    // 更新处理后的blockDOM
    const processedBlockDom = tempDiv.innerHTML;
    state.blockDOMContent = processedBlockDom;
    return processedBlockDom;
};

