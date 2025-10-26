import {Dialog} from "../dialog";
import {isMobile} from "../util/functions";
import { universalStreamRequest } from "../util/fetchStream";
import {fillContent} from "./actions.fillContent";
import { getAIConfigFromSiyuan,  ChatResponseData } from "./types";

// 聊天状态接口
interface ChatState {
    responseContentStr: string;
    isStreaming: boolean;
    isDone: boolean;
    abortFunction: (() => void) | null;
}

// 创建聊天状态
const createChatState = (): ChatState => {
    return {
        responseContentStr: "",
        isStreaming: false,
        isDone: false,
        abortFunction: null
    };
};

// 更新聊天状态
const updateChatState = (state: ChatState, updates: Partial<ChatState>): void => {
    Object.assign(state, updates);
};

// UI元素接口
interface DialogElements {
    inputElement: HTMLTextAreaElement;
    responseContainer: HTMLElement;
    responseContent: HTMLElement;
    responseStatus: HTMLElement;
    statusText: HTMLElement;
    statusDots: HTMLElement;
    textButtonElement: HTMLButtonElement;
    cancelButtonElement: HTMLButtonElement;
}

// 初始化对话框元素
const initializeDialogElements = (dialog: Dialog): DialogElements => {
    const inputElement = dialog.element.querySelector("textarea") as HTMLTextAreaElement;
    const responseContainer = dialog.element.querySelector(".ai-response-container") as HTMLElement;
    const responseContent = dialog.element.querySelector(".ai-response-content") as HTMLElement;
    const responseStatus = dialog.element.querySelector(".ai-response-status") as HTMLElement;
    const statusText = dialog.element.querySelector(".ai-status-text") as HTMLElement;
    const statusDots = dialog.element.querySelector(".ai-status-dots") as HTMLElement;
    
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    const textButtonElement = btnsElement[1] as HTMLButtonElement;
    const cancelButtonElement = btnsElement[0] as HTMLButtonElement;
    
    return {
        inputElement,
        responseContainer,
        responseContent,
        responseStatus,
        statusText,
        statusDots,
        textButtonElement,
        cancelButtonElement
    };
};

// 创建状态动画管理器
const createStatusAnimationManager = (statusDots: HTMLElement) => {
    let dotsInterval: NodeJS.Timeout | null = null;
    
    const startAnimation = () => {
        let dots = 0;
        dotsInterval = setInterval(() => {
            dots = (dots + 1) % 4;
            statusDots.textContent = ".".repeat(dots);
        }, 500);
    };
    
    const stopAnimation = () => {
        if (dotsInterval) {
            clearInterval(dotsInterval);
            dotsInterval = null;
        }
    };
    
    return { startAnimation, stopAnimation };
};

// 显示响应容器
const showResponseContainer = (elements: DialogElements, animationManager: { startAnimation: () => void }) => {
    elements.responseContainer.classList.remove("fn__none");
    elements.responseContent.textContent = "";
    elements.responseStatus.classList.remove("fn__none");
    elements.statusText.textContent = "正在生成回复...";
    animationManager.startAnimation();
};

// 隐藏响应容器
const hideResponseContainer = (elements: DialogElements, animationManager: { stopAnimation: () => void }) => {
    elements.responseContainer.classList.add("fn__none");
    elements.responseStatus.classList.add("fn__none");
    animationManager.stopAnimation();
};

// 更新状态文本
const updateStatusText = (statusText: HTMLElement, text: string, isError = false) => {
    statusText.textContent = text;
    if (isError) {
        statusText.style.color = "var(--b3-theme-error)";
    } else {
        statusText.style.color = "var(--b3-theme-on-surface)";
    }
};

// 更新按钮状态
const updateButtonState = (
    textButtonElement: HTMLButtonElement,
    inputElement: HTMLTextAreaElement,
    text: string,
    color: string = ""
) => {
    textButtonElement.disabled = false;
    inputElement.disabled = false;
    textButtonElement.textContent = text;
    textButtonElement.style.color = color;
};

// 构建AI请求参数
const buildAIRequest = (inputValue: string) => {
    const aiConfig = getAIConfigFromSiyuan();
    
    return {
        model: aiConfig.apiModel,
        messages: [
            {
                role: "user",
                content: inputValue
            }
        ],
        temperature: aiConfig.apiTemperature,
        max_tokens: aiConfig.apiMaxTokens,
        stream: true
    };
};

// 构建请求头
const buildRequestHeaders = () => {
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
const handleStreamResponse = (
    dataStr: string,
    state: ChatState,
    responseContent: HTMLElement
) => {
    if (state.isStreaming) {
        try {
            // 解析OpenAI SSE响应格式
            const data = JSON.parse(dataStr) as ChatResponseData;
            
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
                    // 实时更新显示的内容
                    if (responseContent) {
                        responseContent.textContent = state.responseContentStr;
                        // 自动滚动到底部
                        responseContent.scrollTop = responseContent.scrollHeight;
                    }
                }
            }
        } catch (e) {
            console.warn("Failed to parse SSE data:", dataStr);
        }
    }
};

// 处理请求完成
const handleRequestComplete = (
    state: ChatState,
    elements: DialogElements,
    animationManager: { stopAnimation: () => void }
) => {
    updateChatState(state, {
        isStreaming: false,
        isDone: true,
        abortFunction: null
    });
    
    animationManager.stopAnimation();
    updateStatusText(elements.statusText, "生成完成");
    updateButtonState(elements.textButtonElement, elements.inputElement, window.siyuan.languages.confirm);
};

// 处理请求错误
const handleRequestError = (
    error: Error,
    state: ChatState,
    elements: DialogElements,
    animationManager: { stopAnimation: () => void }
) => {
    updateChatState(state, {
        isStreaming: false,
        abortFunction: null
    });
    
    animationManager.stopAnimation();
    updateStatusText(elements.statusText, `生成失败: ${error.message}`, true);
    console.error("Stream error:", error);
    
    // 恢复按钮状态
    updateButtonState(elements.textButtonElement, elements.inputElement, window.siyuan.languages.confirm);
    
    // 如果是超时错误，保留已有内容，不隐藏响应容器
    if (error.message.includes("超时") && state.responseContentStr) {
        updateStatusText(elements.statusText, "响应超时，但已保留已有内容", false);
    } else {
        // 其他错误3秒后隐藏响应容器
        setTimeout(() => {
            hideResponseContainer(elements, animationManager);
        }, 3000);
    }
};

// 处理请求终止
const handleRequestAbort = (
    state: ChatState,
    elements: DialogElements,
    animationManager: { stopAnimation: () => void }
) => {
    updateChatState(state, {
        isStreaming: false,
        abortFunction: null
    });
    
    animationManager.stopAnimation();
    updateStatusText(elements.statusText, "已终止响应", false);
    updateButtonState(elements.textButtonElement, elements.inputElement, window.siyuan.languages.confirm);
};

// 执行AI请求
const executeAIRequest = async (
    inputValue: string,
    state: ChatState,
    elements: DialogElements,
    animationManager: { startAnimation: () => void; stopAnimation: () => void }
) => {
    if (!inputValue) {
        return;
    }

    elements.textButtonElement.disabled = false;
    elements.inputElement.disabled = true;
    showResponseContainer(elements, animationManager);
    
    // 更新按钮状态为"响应中...点击终止"
    elements.textButtonElement.textContent = "响应中...点击终止";
    elements.textButtonElement.style.color = "var(--b3-theme-error)";

    updateChatState(state, {
        responseContentStr: "",
        isStreaming: true,
        isDone: false
    });
    
    try {
        const aiConfig = getAIConfigFromSiyuan();
        const requestBody = buildAIRequest(inputValue);
        const headers = buildRequestHeaders();

        const abortFn = await universalStreamRequest(
            {
                url: `${aiConfig.apiBaseURL}/chat/completions`,
                method: "POST",
                headers: headers,
                body: requestBody,
                timeout: aiConfig.apiTimeout
            },
            {
                onMessage: (dataStr) => handleStreamResponse(dataStr, state, elements.responseContent),
                onDone: () => handleRequestComplete(state, elements, animationManager),
                onError: (error) => handleRequestError(error, state, elements, animationManager),
                onAbort: () => handleRequestAbort(state, elements, animationManager)
            }
        );
        
        updateChatState(state, { abortFunction: abortFn });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "获取AI配置失败";
        handleRequestError(new Error(errorMessage), state, elements, animationManager);
        
        // 3秒后隐藏响应容器
        setTimeout(() => {
            hideResponseContainer(elements, animationManager);
        }, 3000);
    }
};

const AIChatDialogContent = (languages: any) => {
    return `<div class="b3-dialog__content">
        <textarea class="b3-text-field fn__block" placeholder="${languages.aiWriting}"></textarea>
        <div class="ai-response-container fn__none" style="margin-top: 8px; padding: 8px; background: var(--b3-theme-background); border: 1px solid var(--b3-border-color); border-radius: 4px;">
            <div class="ai-response-content"></div>
            <div class="ai-response-status fn__none" style="margin-top: 4px; font-size: 12px; color: var(--b3-theme-on-surface);">
                <span class="ai-status-text">正在生成回复...</span>
                <span class="ai-status-dots">...</span>
            </div>
        </div>
    </div>
    <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel">${languages.cancel}</button><div class="fn__space"></div>
        <button class="b3-button b3-button--text">${languages.confirm}</button>
    </div>`;
};

export const AIChat = (protyle: IProtyle, element: Element) => {
    const dialog = new Dialog({
        title: "✨ " + window.siyuan.languages.aiWriting,
        content: AIChatDialogContent(window.siyuan.languages),
        width: isMobile() ? "92vw" : "520px",
    });
    
    // 初始化UI元素
    const elements = initializeDialogElements(dialog);
    const state = createChatState();
    const animationManager = createStatusAnimationManager(elements.statusDots);
    
    // 获取输入值的函数
    const getInputValue = () => {
        return elements.inputElement.value;
    }
    
    // 绑定输入和焦点事件
    dialog.bindInput(elements.inputElement, () => {elements.textButtonElement.click()});
    elements.inputElement.focus();
    bindDialogDestroy(dialog, elements.cancelButtonElement, "click");

    // 主按钮点击事件处理
    elements.textButtonElement.addEventListener("click", () => {
        if (state.isStreaming) {
            // 终止响应
            if (state.abortFunction) {
                state.abortFunction();
            }
            return;
        }
        if (state.isDone) {
            // 用户确认插入内容
            fillContent(protyle, state.responseContentStr, [element]);
            dialog.destroy();
            return;
        }
        // 执行AI请求
        executeAIRequest(getInputValue(), state, elements, animationManager);
    });

    // 取消按钮处理
    elements.cancelButtonElement.addEventListener("click", () => {
        dialog.destroy();
    });
};

/**
 * 绑定对话框销毁事件
 * @param dialog 对话框
 * @param element 元素
 * @param eventName 事件名
 */
const bindDialogDestroy = (dialog: Dialog, element: Element, eventName: string) => {
    element.addEventListener(eventName, () => {
        dialog.destroy();
    });
}