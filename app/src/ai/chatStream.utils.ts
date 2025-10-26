import { ChatState } from "./chatStream.types";
import { getAIConfigFromSiyuan } from "./types";

// 创建聊天状态
export const createChatResponseState = (): ChatState => {
    return {
        responseContentStr: "",
        isStreaming: false,
        isDone: false,
        abortFunction: null,
        blockDOMContent: ""
    };
};

// 更新聊天状态
export const updateChatState = (state: ChatState, updates: Partial<ChatState>): void => {
    Object.assign(state, updates);
};

// 构建AI请求参数
export const buildAIRequest = (inputValue: string, blockContent?: string) => {
    const aiConfig = getAIConfigFromSiyuan();
    
    // 构建包含块内容的提示词
    let promptContent = inputValue;
    if (blockContent) {
        promptContent = `请基于以下块内容回答用户的问题：

块内容：
${blockContent}

用户问题：
${inputValue}`;
    }
    
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

// 处理流式响应
export const handleOpenAILikeStreamResponse = (
    dataStr: string,
    state: ChatState,
    responseContent: HTMLElement,
    protyle?: IProtyle
) => {
    if (state.isStreaming) {
        try {
            // 解析OpenAI SSE响应格式
            const data = JSON.parse(dataStr) as any;
            
            // 处理错误
            if (data.error) {
                console.error("API Error:", data.error);
                return;
            }
            
            // 处理OpenAI流式响应格式
            if (data.choices && data.choices.length > 0) {
                const choice = data.choices[0];
                const content = choice.delta?.content || choice.message?.content;
                
                if (content) {
                    state.responseContentStr += content;
                    
                    // 使用blockDOM渲染内容
                    if (protyle) {
                        try {
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
                            
                            // 更新处理后的blockDOM
                            const processedBlockDom = tempDiv.innerHTML;
                            state.blockDOMContent = processedBlockDom;
                            
                            // 实时更新显示的内容
                            if (responseContent) {
                                responseContent.innerHTML = processedBlockDom;
                                // 自动滚动到底部
                                responseContent.scrollTop = responseContent.scrollHeight;
                            }
                        } catch (e) {
                            console.warn("Failed to render blockDOM:", e);
                            // 如果blockDOM渲染失败，回退到纯文本显示
                            if (responseContent) {
                                responseContent.textContent = state.responseContentStr;
                                responseContent.scrollTop = responseContent.scrollHeight;
                            }
                        }
                    } else {
                        // 如果没有protyle实例，回退到纯文本显示
                        if (responseContent) {
                            responseContent.textContent = state.responseContentStr;
                            responseContent.scrollTop = responseContent.scrollHeight;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("Failed to parse SSE data:", dataStr);
        }
    }
};

// 对话框销毁绑定
export const bindDialogDestroy = (dialog: any, element: Element, eventName: string) => {
    element.addEventListener(eventName, () => {
        dialog.destroy();
    });
};