import type { AssistantResponseState } from "./session/session.types";
import { AIConfig, chatResponseDataSchema } from "./types";
import { 从块DOM提取首个符合条件的特定语言代码块内容 } from "./parser/toolCallDetector";
import { JAVASCRIPT_TOOLS_CLASS, JAVASCRIPT_TOOLS_WAIT_CLASS } from "./constants";

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

const cache = new Map()
// 处理工具调用的通用函数
const 处理工具调用 = (
    tempDiv: HTMLElement,
    toolClass: string,
    回调函数: ((code: string) => Promise<void>) | undefined,
    错误信息前缀: string,
    state: AssistantResponseState
): void => {
    const 代码块处理条件 = (blockElement: Element, content: string) => {

        let flag = false
        let lastUsed = cache.get(content)
        if (!state.responseContentStr.split('\`\`\`').pop()?.trim()) {
            flag = true
            cache.set(content, flag)
        }
        console.log(flag, lastUsed)
        return flag && !lastUsed
    }
    const toolCode = 从块DOM提取首个符合条件的特定语言代码块内容(tempDiv, toolClass, 代码块处理条件);
    if (toolCode && 回调函数) {
        回调函数(toolCode).catch(error => {
            console.error(`${错误信息前缀}执行失败:`, error);
        });
    }
};

// 渲染blockDOM内容（纯数据处理，不包含DOM操作）
export const processBlockDOMContent = (
    state: AssistantResponseState,
    lute: Lute
): string => {
    if (!lute) {
        throw new Error('缺少lute实例,无法处理工具调用')
    }
    // 使用lute引擎将内容转换为块级DOM
    const blockDom = lute.SpinBlockDOM(state.responseContentStr);
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
    处理工具调用(tempDiv, JAVASCRIPT_TOOLS_WAIT_CLASS, state.onWaitToolCallDetected, '工具调用', state);

    // 检测并处理DOM中的异步工具调用
    处理工具调用(tempDiv, JAVASCRIPT_TOOLS_CLASS, state.onAsyncToolCallDetected, '异步工具调用', state);

    // 更新处理后的blockDOM
    const processedBlockDom = tempDiv.innerHTML;
    state.blockDOMContent = processedBlockDom;
    return processedBlockDom;
};

