import { Dialog } from "../dialog";
import { ChatSessionState } from "../ai/session/session.types";
import { getAIConfigFromSiyuan, chatResponseDataSchema } from "../ai/types";
import { buildBlockContentPrompt } from "../ai/prompts/blockContent.builder";
import { detectToolCalls, detectAsyncToolCalls } from "../ai/parser/toolCallDetector";


// 更新聊天状态
export const updateChatState = (state: ChatSessionState, updates: Partial<ChatSessionState>): void => {
    Object.assign(state, updates);
};

// 构建AI请求参数
export const buildAIRequest = (inputValue: string, blockContents?: string[]) => {
    const aiConfig = getAIConfigFromSiyuan();

    // 使用新的提示词构建函数
    const promptContent = buildBlockContentPrompt(inputValue, blockContents);

    return {
        model: aiConfig.apiModel,
        messages: [
            {
                role: "user",
                content: promptContent
            }
        ],
        temperature: aiConfig.apiTemperature,
        max_tokens: aiConfig.apiMaxTokens,
        stream: true
    };
};

// 构建请求头
export const buildRequestHeaders = () => {
    const aiConfig = getAIConfigFromSiyuan();

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
const parseAndValidateStreamData = (dataStr: string) => {
    // 解析OpenAI SSE响应格式
    const rawData = JSON.parse(dataStr);

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
};

// 渲染blockDOM内容（纯数据处理，不包含DOM操作）
export const processBlockDOMContent = (
    state: ChatSessionState,
    protyle: IProtyle
): string => {
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
    const toolCode = detectToolCalls(tempDiv);
    if (toolCode && state.onWaitToolCallDetected) {
        // 使用回调函数执行工具调用
        state.responseContentStr = state.responseContentStr.replace(`custom-aitoolcall-fired='false'`, `custom-aitoolcall-fired='true'`)
        state.onWaitToolCallDetected(toolCode).catch(error => {
            console.error('工具调用执行失败:', error);
        });
    }

    // 检测并处理DOM中的异步工具调用
    const asyncToolCode = detectAsyncToolCalls(tempDiv);
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

// 处理流式响应
export const handleOpenAILikeStreamResponse = (
    dataStr: string,
    state: ChatSessionState,
) => {
    if (state.isStreaming) {
        try {
            const data = parseAndValidateStreamData(dataStr);
            if (!data) {
                return;
            }

            // 处理OpenAI流式响应格式
            if (data.choices && data.choices.length > 0) {
                const choice = data.choices[0];
                const content = choice.delta?.content || choice.message?.content;

                if (content) {
                    updateChatState(state, {
                        responseContentStr: state.responseContentStr + content
                    });
                    // 返回处理后的内容，由组件逻辑负责DOM更新
                    return content;
                }
            }
        } catch (e) {
            console.warn("Failed to parse SSE data:", dataStr);
        }
    }
    return null;
};

// 对话框销毁绑定
export const bindDialogDestroy = (dialog: Dialog, element: Element, eventName: string) => {
    element.addEventListener(eventName, () => {
        dialog.destroy();
    });
};