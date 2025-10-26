import {Dialog} from "../dialog";
import {isMobile} from "../util/functions";
import { universalStreamRequest } from "../util/fetchStream";
import {fillContent} from "./actions.fillContent";
import { getAIConfigFromSiyuan,  ChatResponseData } from "./types";

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
    
    const inputElement = dialog.element.querySelector("textarea") as HTMLTextAreaElement;
    const responseContainer = dialog.element.querySelector(".ai-response-container") as HTMLElement;
    const responseContent = dialog.element.querySelector(".ai-response-content") as HTMLElement;
    const responseStatus = dialog.element.querySelector(".ai-response-status") as HTMLElement;
    const statusText = dialog.element.querySelector(".ai-status-text") as HTMLElement;
    const statusDots = dialog.element.querySelector(".ai-status-dots") as HTMLElement;
    
    const getInputValue = () => {
        return inputElement.value;
    }
    
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    const textButtonElement = btnsElement[1] as HTMLButtonElement;
    const cancelButtonElement = btnsElement[0] as HTMLButtonElement;
    
    dialog.bindInput(inputElement, () => {textButtonElement.click()});
    inputElement.focus();
    bindDialogDestroy(dialog, btnsElement[0], "click");
    
    // 状态动画
    let dotsInterval: NodeJS.Timeout | null = null;
    const startStatusAnimation = () => {
        let dots = 0;
        dotsInterval = setInterval(() => {
            dots = (dots + 1) % 4;
            statusDots.textContent = ".".repeat(dots);
        }, 500);
    };
    
    const stopStatusAnimation = () => {
        if (dotsInterval) {
            clearInterval(dotsInterval);
            dotsInterval = null;
        }
    };
    
    // 显示响应容器
    const showResponseContainer = () => {
        responseContainer.classList.remove("fn__none");
        responseContent.textContent = "";
        responseStatus.classList.remove("fn__none");
        statusText.textContent = "正在生成回复...";
        startStatusAnimation();
    };
    
    // 隐藏响应容器
    const hideResponseContainer = () => {
        responseContainer.classList.add("fn__none");
        responseStatus.classList.add("fn__none");
        stopStatusAnimation();
    };
    
    // 更新状态
    const updateStatus = (text: string, isError = false) => {
        statusText.textContent = text;
        if (isError) {
            statusText.style.color = "var(--b3-theme-error)";
        } else {
            statusText.style.color = "var(--b3-theme-on-surface)";
        }
    };
    
    let responseContentStr = "";
    let isStreaming = false;
    let isDone = false;
    let abortFunction: (() => void) | null = null;

    textButtonElement.addEventListener("click", () => {
        if (isStreaming) {
            // 终止响应
            if (abortFunction) {
                abortFunction();
            }
            return;
        }
        if (isDone) {
            // 用户确认插入内容
            fillContent(protyle, responseContentStr, [element]);
            dialog.destroy();
            return;
        }
        fetchChatGPTAction();
    });

    const fetchChatGPTAction = () => {
        let inputValue = getInputValue();
        if (!inputValue) {
            return;
        }

        textButtonElement.disabled = false;
        inputElement.disabled = true;
        showResponseContainer();
        
        // 更新按钮状态为"响应中...点击终止"
        textButtonElement.textContent = "响应中...点击终止";
        textButtonElement.style.color = "var(--b3-theme-error)";

        responseContentStr = "";
        isStreaming = true;
        isDone = false;
        
        try {
            // 获取AI配置
            const aiConfig = getAIConfigFromSiyuan();
            
            // 构建请求体
            const requestBody = {
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

            // 构建请求头
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

            universalStreamRequest(
                {
                    url: `${aiConfig.apiBaseURL}/chat/completions`,
                    method: "POST",
                    headers: headers,
                    body: requestBody,
                    timeout: aiConfig.apiTimeout
                },
                {
                    onMessage: (dataStr) => {
                        if (isStreaming) {
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
                                        responseContentStr += content;
                                        // 实时更新显示的内容
                                        const responseElement = dialog.element.querySelector(".ai-response-content") as HTMLElement;
                                        if (responseElement) {
                                            responseElement.textContent = responseContentStr;
                                            // 自动滚动到底部
                                            responseElement.scrollTop = responseElement.scrollHeight;
                                        }
                                    }
                                }
                            } catch (e) {
                                console.warn("Failed to parse SSE data:", dataStr);
                            }
                        }
                    },
                    onDone: () => {
                        isStreaming = false;
                        isDone = true;
                        stopStatusAnimation();
                        updateStatus("生成完成");
                        inputElement.disabled = false;
                        textButtonElement.textContent = window.siyuan.languages.confirm;
                        textButtonElement.style.color = "";
                        abortFunction = null;
                    },
                    onError: (error) => {
                        isStreaming = false;
                        stopStatusAnimation();
                        updateStatus(`生成失败: ${error.message}`, true);
                        console.error("Stream error:", error);
                        
                        // 恢复按钮状态
                        textButtonElement.disabled = false;
                        inputElement.disabled = false;
                        textButtonElement.textContent = window.siyuan.languages.confirm;
                        textButtonElement.style.color = "";
                        abortFunction = null;
                        
                        // 如果是超时错误，保留已有内容，不隐藏响应容器
                        if (error.message.includes("超时") && responseContentStr) {
                            updateStatus("响应超时，但已保留已有内容", false);
                        } else {
                            // 其他错误3秒后隐藏响应容器
                            setTimeout(() => {
                                hideResponseContainer();
                            }, 3000);
                        }
                    },
                    onAbort: () => {
                        // 终止回调
                        isStreaming = false;
                        stopStatusAnimation();
                        updateStatus("已终止响应", false);
                        textButtonElement.disabled = false;
                        inputElement.disabled = false;
                        textButtonElement.textContent = window.siyuan.languages.confirm;
                        textButtonElement.style.color = "";
                        abortFunction = null;
                    }
                }
            ).then((abortFn) => {
                abortFunction = abortFn;
            });
        } catch (error) {
            isStreaming = false;
            stopStatusAnimation();
            const errorMessage = error instanceof Error ? error.message : "获取AI配置失败";
            updateStatus(`配置错误: ${errorMessage}`, true);
            console.error("AI Config error:", error);
            
            // 恢复按钮状态
            textButtonElement.disabled = false;
            inputElement.disabled = false;
            textButtonElement.textContent = window.siyuan.languages.confirm;
            textButtonElement.style.color = "";
            abortFunction = null;
            
            // 3秒后隐藏响应容器
            setTimeout(() => {
                hideResponseContainer();
            }, 3000);
        }
    }

    // 取消按钮处理
    cancelButtonElement.addEventListener("click", () => {
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