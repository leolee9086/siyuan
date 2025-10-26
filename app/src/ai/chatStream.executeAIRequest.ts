import { universalStreamRequest } from "../util/fetchStream";
import { AIRequestConfig, StreamResponseHandlers } from "./chatStream.types";
import { updateChatState, buildAIRequest, buildRequestHeaders, handleOpenAILikeStreamResponse } from "./chatStream.utils";
import { showResponseContainer, hideResponseContainer, handleRequestComplete, handleRequestError, handleRequestAbort } from "./chatStream.ui";
import { getAIConfigFromSiyuan } from "./types";
import { hasClosestBlock } from "../protyle/util/hasClosest";
import { getContenteditableElement } from "../protyle/wysiwyg/getBlock";

// 执行AI请求
export const executeAIRequest = async (config: AIRequestConfig) => {
    const { inputValue, state, elements, animationManager } = config;
    
    if (!inputValue) {
        return;
    }

    // 设置UI状态
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
        // 获取块内容
        let blockContents: string[] = [];
        
        // 优先处理多个选中的块
        if (config.protyle && config.targetBlockElements && config.targetBlockElements.length > 0) {
            config.targetBlockElements.forEach(blockElement => {
                const editableElement = getContenteditableElement(blockElement);
                if (editableElement) {
                    blockContents.push(editableElement.textContent || "");
                }
            });
        }
        
        const requestBody = buildAIRequest(inputValue, blockContents);
        const headers = buildRequestHeaders();

        // 创建流式响应处理器
        const handlers: StreamResponseHandlers = {
            onMessage: (dataStr) => handleOpenAILikeStreamResponse(dataStr, state, elements.responseContent, config.protyle),
            onDone: () => handleRequestComplete({ state, elements, animationManager }),
            onError: (error) => handleRequestError({ error, state, elements, animationManager }),
            onAbort: () => handleRequestAbort({ state, elements, animationManager })
        };

        const abortFn = await universalStreamRequest(
            {
                url: `${aiConfig.apiBaseURL}/chat/completions`,
                method: "POST",
                headers: headers,
                body: requestBody,
                timeout: aiConfig.apiTimeout
            },
            handlers
        );

        updateChatState(state, { abortFunction: abortFn });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "获取AI配置失败";
        handleRequestError({ 
            error: new Error(errorMessage), 
            state, 
            elements, 
            animationManager 
        });

        // 3秒后隐藏响应容器
        setTimeout(() => {
            hideResponseContainer(elements, animationManager);
        }, 3000);
    }
};
