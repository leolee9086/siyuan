import type { ChatSessionState } from '../ai/session/session.types';
import type { 
    StreamChatBusinessLogic, 
    StreamHandlers, 
    MessageHistory, 
    AIRequestParams 
} from './streamChat.types';

/**
 * 创建流式响应处理函数
 * @param businessLogic 业务逻辑接口
 * @param chatState 聊天状态
 * @param onCompleteStatus 完成状态回调
 * @param onErrorStatus 错误状态回调
 * @param onAbortStatus 终止状态回调
 * @param protyleInstance protyle实例
 * @returns 流式处理器对象
 */
const createStreamHandlers = (
    businessLogic: StreamChatBusinessLogic,
    chatState: ChatSessionState,
    onCompleteStatus: () => void,
    onErrorStatus: (error: Error) => void,
    onAbortStatus: () => void,
    protyleInstance: IProtyle
): StreamHandlers => {
    return {
        onMessage: (dataStr: string) => {
            chatState.isStreaming = true;
            const content = businessLogic.handleOpenAILikeStreamResponse(dataStr, chatState);
            if (content) {
                businessLogic.processBlockDOMContent(chatState, protyleInstance);
            }
        },
        onDone: () => {
            businessLogic.updateChatState(chatState, { isStreaming: false, isDone: true });
            onCompleteStatus();
        },
        onError: (error: Error) => {
            businessLogic.updateChatState(chatState, { isStreaming: false });
            onErrorStatus(error);
        },
        onAbort: () => {
            businessLogic.updateChatState(chatState, { isStreaming: false });
            onAbortStatus();
        },
    };
};

/**
 * 准备AI请求参数
 * @param businessLogic 业务逻辑接口
 * @param signal 取消信号
 * @param messageHistory 消息历史
 * @returns AI请求参数
 */
const prepareAIRequest = (
    businessLogic: StreamChatBusinessLogic,
    signal: AbortSignal,
    messageHistory?: MessageHistory
): AIRequestParams => {
    const aiConfig = businessLogic.getAIConfigFromSiyuan();

    // 如果有消息历史，构建包含历史的请求
    let messages: any[] = [];
    messages = messageHistory?.map(msg => ({
        role: msg.role,
        content: msg.content
    })) || [];

    // 构建包含消息历史的请求体
    const requestBodyWithHistory = {
        model: aiConfig.apiModel,
        messages: messages,
        temperature: aiConfig.apiTemperature,
        max_tokens: aiConfig.apiMaxTokens,
        stream: true
    };

    const headers = businessLogic.buildRequestHeaders();

    return {
        url: `${aiConfig.apiBaseURL}/chat/completions`,
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBodyWithHistory),
        timeout: aiConfig.apiTimeout,
        signal,
    };
};

/**
 * 发起流请求
 * @param businessLogic 业务逻辑接口
 * @param requestParams 请求参数
 * @param state 聊天状态
 * @param setCompleteStatus 设置完成状态的函数
 * @param setErrorStatus 设置错误状态的函数
 * @param setAbortStatus 设置终止状态的函数
 * @param protyle protyle实例
 */
const initiateStreamRequest = async (
    businessLogic: StreamChatBusinessLogic,
    requestParams: AIRequestParams,
    state: ChatSessionState,
    setCompleteStatus: () => void,
    setErrorStatus: (error: Error) => void,
    setAbortStatus: () => void,
    protyle: IProtyle
): Promise<null> => {
    state.isStreaming = true;
    const handlers = createStreamHandlers(businessLogic, state, setCompleteStatus, setErrorStatus, setAbortStatus, protyle);

    await businessLogic.universalStreamRequest(requestParams, handlers);
    // 不再需要返回 abortFunction，因为取消操作完全由外部 AbortSignal 控制
    return null;
};

/**
 * 处理AI请求的业务逻辑
 * @param businessLogic 业务逻辑接口
 * @param state 聊天状态
 * @param protyle protyle实例
 * @param showResponse 显示响应的函数
 * @param setCompleteStatus 设置完成状态的函数
 * @param setErrorStatus 设置错误状态的函数
 * @param setAbortStatus 设置终止状态的函数
 * @param messageHistory 消息历史
 * @returns 终止函数
 */
export const handleAIRequest = async (
    businessLogic: StreamChatBusinessLogic,
    state: ChatSessionState,
    protyle: IProtyle,
    showResponse: () => void,
    setCompleteStatus: () => void,
    setErrorStatus: (error: Error) => void,
    setAbortStatus: () => void,
    messageHistory: MessageHistory
): Promise<(() => void) | null> => {

    showResponse();
    businessLogic.updateChatState(state, {
        isStreaming: true,
        isDone: false,
    });

    // 创建 AbortController 来控制取消操作
    const controller = new AbortController();

    try {
        const requestParams = prepareAIRequest(businessLogic, controller.signal, messageHistory);
        await initiateStreamRequest(
            businessLogic,
            requestParams,
            state,
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
        businessLogic.updateChatState(state, { isStreaming: false });
        setErrorStatus(errorMessage);
        return null;
    }
};