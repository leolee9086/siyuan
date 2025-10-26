import { DialogElements, AnimationManager, RequestCompleteConfig, RequestErrorConfig, RequestAbortConfig } from "./chatStream.types";
import { updateChatState } from "./chatStream.utils";

// 初始化对话框元素
export const initializeDialogElements = (dialog: any): DialogElements => {
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
export const createStatusAnimationManager = (statusDots: HTMLElement): AnimationManager => {
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
export const showResponseContainer = (elements: DialogElements, animationManager: AnimationManager) => {
    elements.responseContainer.classList.remove("fn__none");
    elements.responseContent.textContent = "";
    elements.responseStatus.classList.remove("fn__none");
    elements.statusText.textContent = "正在生成回复...";
    animationManager.startAnimation();
};

// 隐藏响应容器
export const hideResponseContainer = (elements: DialogElements, animationManager: AnimationManager) => {
    elements.responseContainer.classList.add("fn__none");
    elements.responseStatus.classList.add("fn__none");
    animationManager.stopAnimation();
};

// 更新状态文本
export const updateStatusText = (statusText: HTMLElement, text: string, isError = false) => {
    statusText.textContent = text;
    if (isError) {
        statusText.style.color = "var(--b3-theme-error)";
    } else {
        statusText.style.color = "var(--b3-theme-on-surface)";
    }
};

// 更新按钮状态
export const updateButtonState = (
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

// 处理请求完成
export const handleRequestComplete = (config: RequestCompleteConfig) => {
    const { state, elements, animationManager } = config;
    
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
export const handleRequestError = (config: RequestErrorConfig) => {
    const { error, state, elements, animationManager } = config;
    
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
export const handleRequestAbort = (config: RequestAbortConfig) => {
    const { state, elements, animationManager } = config;
    
    updateChatState(state, {
        isStreaming: false,
        abortFunction: null
    });
    
    animationManager.stopAnimation();
    updateStatusText(elements.statusText, "已终止响应", false);
    updateButtonState(elements.textButtonElement, elements.inputElement, window.siyuan.languages.confirm);
};

// AI聊天对话框内容
export const AIChatDialogContent = (languages: any) => {
    return `<div class="b3-dialog__content">
        <textarea class="b3-text-field fn__block" placeholder="${languages.aiWriting}"></textarea>
        <div class="ai-response-container fn__none protyle-wysiwyg protyle-wysiwyg--attr" style="margin-top: 8px; padding: 8px; background: var(--b3-theme-background); border: 1px solid var(--b3-border-color); border-radius: 4px;">
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