import type { AssistantResponseState } from "./session.types";
import type { ToolCallExecutorConfig } from "./toolCallExecutor";
import { AIRequestController } from "../../magi/service/requestController";
import { getAIConfigFromSiyuan } from "../utils.config";
import { handleOpenAILikeStreamResponse } from "../../magi/service/streamResponseHandler";
import { processBlockDOMContent } from "../chatStream.utils";
import { setLute } from "../../protyle/render/setLute";
import {
    appendResponseContent, startStreaming, stopStreaming,
    setDone, pauseResponse, resumeResponse
} from "./assistantResponse.streaming";

/**
 * 构建工具调用执行器配置
 *
 * 作用：将 state 和操作函数适配为 ToolCallExecutorConfig 接口
 * 意图：toolCallExecutor 模块通过配置对象与状态解耦
 * 调用时机：执行工具调用前构建配置
 *
 * @param state - 响应状态对象
 * @param startTimeRef - 开始时间引用
 * @param startAIRequestFn - 发起 AI 请求的函数引用
 * @同步豁免: 遗留代码 - ToolCallExecutorConfig 接口要求同步函数引用，异步化需要修改整个工具调用链路
 */
export function buildToolCallExecutorConfig(
    state: AssistantResponseState,
    startTimeRef: { value: number },
    startAIRequestFn: (messages: Array<{ role: "user" | "assistant"; content: string; timestamp: number }>) => Promise<void>
): ToolCallExecutorConfig {
    return {
        /** @简洁函数 直接返回状态对象 */
        getState: () => state,
        /** @简洁函数 工具调用事件（当前无消费者，保留接口兼容） */
        emitToolCallEvent: () => { /* 事件系统已移除，无消费者 */ },
        /** @简洁函数 代理发起AI请求 */
        startAIRequest: (messages) => startAIRequestFn(messages),
        /** @简洁函数 代理暂停响应 */
        pause: () => pauseResponse(state),
        /** @简洁函数 代理自动恢复检查 */
        autoResumeIfNeeded: async () => {
            if (state.errorCount > 3) {
                return;
            }
            await startAIRequestFn([
                ...state.savedMessages,
                { role: "user", content: "system:continue", timestamp: Date.now() }
            ]);
        }
    };
}

/**
 * 处理 SSE 消息的回调：解析内容、追加到响应、执行 DOM 渲染和工具调用检测
 *
 * 作用：将单条 SSE 数据解析为内容增量，更新状态，并在有 lute 时执行 DOM 处理
 * 意图：从 initializeRequestController 中提取以降低函数复杂度
 * 调用时机：每收到一条 SSE 消息时由 AIRequestController 调用
 * @同步豁免: 性能考虑 - SSE 流式回调必须同步处理以保证消息顺序
 */
function handleStreamMessage(dataStr: string, state: AssistantResponseState, lute: Lute | null): void {
    const result = handleOpenAILikeStreamResponse(dataStr);
    if (result.error) {
        return;
    }
    if (result.content) {
        appendResponseContent(state, result.content);
    }
    // 有新内容且 lute 可用时，将响应渲染为块级 DOM 并检测工具调用
    if (result.content && lute) {
        processBlockDOMContent(state, lute);
    }
    if (result.isFinished) {
        setDone(state);
    }
}

/**
 * 初始化请求控制器
 *
 * 作用：创建 AIRequestController 实例并绑定流式响应的生命周期回调
 * 意图：将网络请求的事件映射到状态变更
 * 调用时机：首次发起请求时调用
 *
 * @param state - 响应状态对象
 * @param startTimeRef - 开始时间引用
 * @param currentRequestController - 当前已存在的请求控制器（如有则先销毁）
 * @param protyle - protyle 实例，用于 lute 渲染；为 null 时跳过 DOM 处理
 * @同步豁免: 遗留代码 - AIRequestController 构造函数是同步的，返回值直接赋给字段
 */
export function initializeRequestController(
    state: AssistantResponseState,
    startTimeRef: { value: number },
    currentRequestController: AIRequestController | null,
    protyle: IProtyle | null
): AIRequestController {
    if (currentRequestController) {
        currentRequestController.destroy();
    }

    // 若提供了 protyle，创建 lute 实例用于将 Markdown 转换为块级 DOM
    const lute = protyle ? setLute({
        emojiSite: protyle.options?.hint?.emojiPath ?? "",
        emojis: protyle.options?.hint?.emoji ?? {},
        headingAnchor: false,
        listStyle: !!protyle.options.preview?.markdown?.listStyle,
        paragraphBeginningSpace: !!protyle.options.preview?.markdown?.paragraphBeginningSpace,
        sanitize: !!protyle.options.preview?.markdown?.sanitize,
    }) : null;

    return new AIRequestController(
        {
            /** @简洁函数 流式请求开始时标记进入流式状态 */
            onStart: () => startStreaming(state, startTimeRef),
            /** @简洁函数 处理每条 SSE 消息 */
            onMessage: (dataStr: string) => handleStreamMessage(dataStr, state, lute),
            /** @简洁函数 流式请求正常结束时标记完成 */
            onComplete: () => setDone(state),
            /** @简洁函数 请求出错时记录错误 */
            onError: (error: Error) => {
                state.isStreaming = false;
                console.error(error);
            },
            /** @简洁函数 请求被主动中止时停止流式状态 */
            onAbort: () => stopStreaming(state),
            /** @简洁函数 暂停事件 */
            onPause: () => pauseResponse(state),
            /** @简洁函数 恢复事件 */
            onResume: () => resumeResponse(state, startTimeRef)
        },
        getAIConfigFromSiyuan
    );
}
