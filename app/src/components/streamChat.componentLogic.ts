import { ref, onUnmounted } from '../ai/deps';
import { buildAIRequest, buildRequestHeaders, handleOpenAILikeStreamResponse, updateChatState, processBlockDOMContent } from '../ai/chatStream.utils';
import { universalStreamRequest } from '../util/fetchStream';
import { getAIConfigFromSiyuan } from '../ai/types';
import { fillContent } from '../ai/actions.fillContent';
import { getContenteditableElement } from '../protyle/wysiwyg/getBlock';
import { ChatState } from '../ai/chatStream.types';
export {ChatState}

// UI状态上下文接口
interface StreamChatUIContext {
    showResponseContainer: { value: boolean };
    statusText: { value: string };
    statusColor: { value: string };
    dots: { value: string };
    dotsInterval: { value: NodeJS.Timeout | null };
}

// 渲染blockDOM内容到界面
const renderBlockDOMToUI = (
    state: ChatState,
    responseContent: HTMLElement,
    protyle: IProtyle
): void => {
    try {
        const processedBlockDom = processBlockDOMContent(state, protyle);
        // 实时更新显示的内容
        if (responseContent) {
            responseContent.innerHTML = processedBlockDom;
            // 自动滚动到底部
            responseContent.scrollTop = responseContent.scrollHeight;
        }
    } catch (e) {
        console.warn("Failed to render blockDOM:", e);
        // 如果blockDOM渲染失败，回退到纯文本显示
        fallbackToTextDisplay(state, responseContent);
    }
};

// 回退到纯文本显示
const fallbackToTextDisplay = (
    state: ChatState,
    responseContent: HTMLElement
): void => {
    if (responseContent) {
        responseContent.textContent = state.responseContentStr;
        responseContent.scrollTop = responseContent.scrollHeight;
    }
};

// 处理流式响应内容
const processStreamContent = (
    state: ChatState,
    responseContent: HTMLElement,
    protyle?: IProtyle
): void => {
    if (protyle) {
        renderBlockDOMToUI(state, responseContent, protyle);
    } else {
        // 如果没有protyle实例，回退到纯文本显示
        fallbackToTextDisplay(state, responseContent);
    }
};

// 创建流式响应处理函数，避免闭包
const createStreamHandlers = (
    chatState: ChatState,
    responseContent: HTMLElement,
    onCompleteStatus: () => void,
    onErrorStatus: (error: Error) => void,
    onAbortStatus: () => void,
    protyleInstance: IProtyle
) => {
    return {
        onMessage: (dataStr: string) => {
            const content = handleOpenAILikeStreamResponse(dataStr, chatState, protyleInstance);
            if (content) {
                processStreamContent(chatState, responseContent, protyleInstance);
            }
        },
        onDone: () => {
            updateChatState(chatState, { isStreaming: false, isDone: true });
            onCompleteStatus();
        },
        onError: (error: Error) => {
            updateChatState(chatState, { isStreaming: false });
            onErrorStatus(error);
        },
        onAbort: () => {
            updateChatState(chatState, { isStreaming: false });
            onAbortStatus();
        },
    };
};

// 开始动画函数
const startAnimation = (ctx: StreamChatUIContext) => {
    let dotCount = 0;
    ctx.dotsInterval.value = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        ctx.dots.value = '.'.repeat(dotCount);
    }, 500);
};

// 停止动画函数
const stopAnimation = (ctx: StreamChatUIContext) => {
    if (ctx.dotsInterval.value) {
        clearInterval(ctx.dotsInterval.value);
        ctx.dotsInterval.value = null;
    }
    ctx.dots.value = '';
};

// 显示响应函数
const showResponse = (ctx: StreamChatUIContext) => {
    ctx.showResponseContainer.value = true;
    ctx.statusText.value = '正在生成回复...';
    ctx.statusColor.value = 'var(--b3-theme-on-surface)';
    startAnimation(ctx);
};


// 设置错误状态函数
const setErrorStatus = (ctx: StreamChatUIContext, error: Error) => {
    ctx.statusText.value = `生成失败: ${error.message}`;
    ctx.statusColor.value = 'var(--b3-theme-error)';
    console.error('Stream error:', error);
    
    if (error.message.includes('超时')) {
        ctx.statusText.value = '响应超时，但已保留已有内容';
        ctx.statusColor.value = 'var(--b3-theme-on-surface)';
    } else {
        setTimeout(() => {
            ctx.showResponseContainer.value = false;
        }, 3000);
    }
};

// 设置终止状态函数
const setAbortStatus = (ctx: StreamChatUIContext) => {
    ctx.statusText.value = '已终止响应';
};

// 聚焦文本框函数
const focusTextarea = (textareaRef: { value: HTMLTextAreaElement | null }) => {
    textareaRef.value?.focus();
};
/**
 * 处理AI请求的业务逻辑
 * @param inputValue 输入值
 * @param state 聊天状态
 * @param protyle protyle实例
 * @param selectedBlockElements 选中的元素
 * @param targetElement 目标元素
 * @param showResponse 显示响应的函数
 * @param setCompleteStatus 设置完成状态的函数
 * @param setErrorStatus 设置错误状态的函数
 * @param setAbortStatus 设置终止状态的函数
 * @returns 终止函数
 */

// 准备AI请求参数
const prepareAIRequestWithBlocksElements = (inputValue: string, selectedBlockElements: Element[], signal: AbortSignal) => {
    const aiConfig = getAIConfigFromSiyuan();
    let blockContents: string[] = [];
    if (selectedBlockElements.length > 0) {
        selectedBlockElements.forEach(blockElement => {
            const editableElement = getContenteditableElement(blockElement);
            if (editableElement) {
                blockContents.push(editableElement.textContent || '');
            }
        });
    }
    const requestBody = buildAIRequest(inputValue, blockContents);
    const headers = buildRequestHeaders();
    
    return {
        url: `${aiConfig.apiBaseURL}/chat/completions`,
        method: 'POST',
        headers: headers,
        body: requestBody,
        timeout: aiConfig.apiTimeout,
        signal,
    };
};

// 发起流请求
const initiateStreamRequest = async (
    requestParams: any,
    state: ChatState,
    responseContent: HTMLElement,
    setCompleteStatus: () => void,
    setErrorStatus: (error: Error) => void,
    setAbortStatus: () => void,
    protyle: IProtyle
): Promise<null> => {
    const handlers = createStreamHandlers(state, responseContent, setCompleteStatus, setErrorStatus, setAbortStatus, protyle);
    
    await universalStreamRequest(requestParams, handlers);
    // 不再需要返回 abortFunction，因为取消操作完全由外部 AbortSignal 控制
    return null;
};

export const handleAIRequest = async (
    inputValue: string,
    state: ChatState,
    protyle: IProtyle,
    selectedElements: Element[],
    targetElement: Element,
    responseContent: HTMLElement,
    showResponse: () => void,
    setCompleteStatus: () => void,
    setErrorStatus: (error: Error) => void,
    setAbortStatus: () => void
): Promise<(() => void) | null> => {
    if (!inputValue) return null;
    
    showResponse();
    updateChatState(state, {
        responseContentStr: '',
        isStreaming: true,
        isDone: false,
    });
    
    // 创建 AbortController 来控制取消操作
    const controller = new AbortController();
    
    try {
        const requestParams = prepareAIRequestWithBlocksElements(inputValue, selectedElements, controller.signal);
        await initiateStreamRequest(
            requestParams,
            state,
            responseContent,
            setCompleteStatus,
            setErrorStatus,
            setAbortStatus,
            protyle
        );
        
        // 返回取消函数，调用它会中止请求
        return () => {
            controller.abort();
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error : new Error('请求失败');
        updateChatState(state, { isStreaming: false });
        setErrorStatus(errorMessage);
        return null;
    }
};

/**
 * 处理填充内容的业务逻辑
 * @param protyle protyle实例
 * @param state 聊天状态
 * @param selectedElements 选中的元素
 * @param targetElement 目标元素
 */
export const handleFillContent = (
    protyle: IProtyle,
    state: ChatState,
    selectedElements: Element[],
    targetElement: Element
): void => {
    const targetElements = selectedElements.length > 0 ? selectedElements : [targetElement];
    fillContent(protyle, state.responseContentStr, targetElements, state.blockDOMContent);
};

/**
 * 获取国际化文本的辅助函数
 * @param key 文本键
 * @returns 国际化文本
 */
export const getI18nText = (key: string): string => {
    return window.siyuan.languages?.[key] || key;
};

/**
 * 管理StreamChat组件的UI相关逻辑
 * 包括动画控制、状态显示等界面交互
 */
export function useStreamChatUI() {
    const showResponseContainer = ref(false);
    const statusText = ref('正在生成回复...');
    const statusColor = ref('var(--b3-theme-on-surface)');
    const dots = ref('');
    let dotsInterval: NodeJS.Timeout | null = null;

    // 创建UI上下文对象
    const uiContext: StreamChatUIContext = {
        showResponseContainer,
        statusText,
        statusColor,
        dots,
        dotsInterval: { value: dotsInterval }
    };

    onUnmounted(() => {
        stopAnimation(uiContext);
    });

    return {
        showResponseContainer,
        statusText,
        statusColor,
        dots,
        showResponse: () => showResponse(uiContext),
        hideResponse: () => { uiContext.showResponseContainer.value = false; },
        setCompleteStatus: () => { uiContext.statusText.value = '生成完成'; },
        setErrorStatus: (error: Error) => setErrorStatus(uiContext, error),
        setAbortStatus: () => setAbortStatus(uiContext),
        focusTextarea,
        stopAnimation: () => stopAnimation(uiContext)
    };
}