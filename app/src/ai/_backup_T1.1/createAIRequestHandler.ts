import { setLute } from "../protyle/render/setLute";
import { processBlockDOMContent } from "./chatStream.utils";
import { handleOpenAILikeStreamResponse } from "./handleOpenAILikeStreamResponse";
import { AIRequestController } from "./requestController.impl";
import { AssistantResponseState } from "./session/session.types";
import { getAIConfigFromSiyuan } from "./utils.config";

// 创建AI请求处理函数
export const createAIRequestHandlerWithState = async (
    state: AssistantResponseState,
    protyle: IProtyle,
    messages: Array<{ role: "user" | "assistant" | "system"; content: string; timestamp: number; }>
): Promise<AIRequestController> => {
    // 创建请求控制器，完全断开与state的直接联系
    const controller = new AIRequestController(
        {
            onStart: () => {
                state.isStreaming = true;
                state.isDone = false;
            },
            onMessage: (dataStr: string) => {
                const result = handleOpenAILikeStreamResponse(dataStr);
                if (result.error) {
                    return;
                }
                if (result.content) {
                    state.responseContentStr += result.content;
                    // 处理DOM内容
                    const lute = setLute({
                        emojiSite: protyle.options?.hint?.emojiPath as string,
                        emojis: protyle.options?.hint?.emoji as IObject,
                        headingAnchor: false,
                        listStyle: protyle.options.preview?.markdown?.listStyle ? true : false,
                        paragraphBeginningSpace: protyle.options.preview?.markdown?.paragraphBeginningSpace ? true : false,
                        sanitize: protyle.options.preview?.markdown?.sanitize ? true : false,
                    });
                    processBlockDOMContent(state, lute);
                }
                if (result.isFinished) {
                    state.isStreaming = false;
                    state.isDone = true;
                }
            },
            onComplete: () => {
                state.isStreaming = false;
                state.isDone = true;
            },
            onError: (error: Error) => {
                state.isStreaming = false;
                console.error(error);
            },
            onAbort: () => {
                state.isStreaming = false;
            },
            onPause: () => {
                state.isPaused = true;
            },
            onResume: () => {
                state.isPaused = false;
            }
        },
        getAIConfigFromSiyuan
    );
    // 立即保存取消函数到state，确保在请求开始前就能使用
    state.abortFunction = () => controller.cancelRequest();
    // 发起请求
    await controller.startRequest(messages);
    return controller;
};
