import {
    Dialog,
} from "./imports";
import { reactive } from "vue";
import { fillContent } from "./actions.fillContent";
import type { AssistantResponseState, RequestContext } from "./session/session.types";
import type { MessageHistory } from "../magi/types/session.types";
import { buildBlockContentPrompt } from "./prompts/blockContent.builder";
import { pauseResponse } from "./session/assistantResponse.streaming";
import { initializeRequestController, buildToolCallExecutorConfig } from "./session/assistantResponse.requestInit";
import { executeSyncToolCall, executeAsyncToolCallFn } from "./session/toolCallExecutor";

/**
 * 发起 AI 请求的统一入口（模块级函数）
 *
 * 作用：初始化或复用请求控制器，绑定取消函数，发起流式请求
 * 意图：从 createState 闭包中提取为模块级函数以满足 lint 规则
 * 调用时机：首次发送消息、工具调用后恢复、暂停后恢复
 */
async function doStartAIRequest(
    ctx: RequestContext,
    messages: MessageHistory
){
    ctx.controllerRef.value = initializeRequestController(
        ctx.state, ctx.startTimeRef, ctx.controllerRef.value, ctx.protyle
    );
    ctx.state.abortFunction = () => ctx.controllerRef.value?.cancelRequest();
    await ctx.controllerRef.value.startRequest(messages);
}

/**
 * 创建单次 AI 对话任务的响应式状态和事件处理函数
 *
 * 作用：初始化 AssistantResponseState 并绑定取消/暂停/恢复/确认/工具调用等操作
 * 意图：作为 chatStream.ts 入口的状态工厂，每次用户发起新对话时创建一组独立的状态和处理器
 * 调用时机：chatStream.ts 中 onCtrlEnterClick 每次触发时调用
 *
 * @param protyle - 编辑器实例，用于 lute 渲染和块内容提取
 * @param element - 目标块元素
 * @param selectedElements - 用户选中的块元素数组
 * @param dialog - 对话框实例，用于取消时销毁
 * @同步豁免: UI构建 - 工厂函数返回同步对象供 Vue reactive 绑定
 */
export function createState(
    protyle: IProtyle,
    element: Element,
    selectedElements: Element[],
    dialog: Dialog
) {
    // 请求上下文：打包闭包状态供模块级函数使用
    const ctx: RequestContext = {
        state: reactive({
            responseContentStr: "",
            isStreaming: false,
            isDone: false,
            abortFunction: null,
            blockDOMContent: "",
            /** @简洁函数 同步工具调用检测回调占位，由下方 toolCallConfig 绑定覆盖 */
            onWaitToolCallDetected: async () => { },
            /** @简洁函数 异步工具调用检测回调占位，由下方 toolCallConfig 绑定覆盖 */
            onAsyncToolCallDetected: async () => { },
            isPaused: false,
            savedMessages: [],
            asyncToolResults: [],
            errorCount: 0,
            syncToolCallCount: 0,
            asyncToolCallCount: 0
        }),
        startTimeRef: { value: 0 },
        controllerRef: { value: null },
        protyle
    };

    const { state } = ctx;
    const syncToolLimitNotified = { value: false };
    const asyncToolLimitNotified = { value: false };

    // 构建工具调用配置，绑定请求入口
    const toolCallConfig = buildToolCallExecutorConfig(
        state, ctx.startTimeRef,
        (messages) => doStartAIRequest(ctx, messages)
    );

    // 绑定工具调用回调到状态
    state.onWaitToolCallDetected = async (toolCode: string) => {
        await executeSyncToolCall(toolCode, toolCallConfig, syncToolLimitNotified);
    };
    state.onAsyncToolCallDetected = async (toolCode: string) => {
        await executeAsyncToolCallFn(toolCode, toolCallConfig, asyncToolLimitNotified);
    };

    // 创建事件处理函数
    const cancelHandler = createCancelHandler(state, dialog);
    const pauseHandler = createPauseHandler(state);
    const resumeHandler = createResumeHandler(state, ctx);
    const confirmHandler = createConfirmHandler(
        state, protyle, selectedElements, element, dialog, ctx
    );

    return { state, cancelHandler, pauseHandler, confirmHandler, resumeHandler };
}

/**
 * 创建取消处理函数
 * @同步豁免: UI构建 - 按钮点击回调必须同步执行
 */
function createCancelHandler(
    state: AssistantResponseState,
    dialog: Dialog
) {
    return () => {
        state.abortFunction?.();
        dialog.destroy();
    };
}

/**
 * 创建暂停处理函数（委托 streaming 模块）
 * @同步豁免: UI构建 - 按钮点击回调必须同步执行
 * @AITODO 这个函数仅仅是一个毫无意义的代理,必须消除
 */
function createPauseHandler(state: AssistantResponseState) {
    return () => {
        pauseResponse(state);
    };
}

/**
 * 创建恢复处理函数
 *
 * 作用：从暂停状态恢复，重建消息历史并重新发起请求
 * 意图：暂停后工具调用完成，需要将工具结果作为上下文继续对话
 */
function createResumeHandler(
    state: AssistantResponseState,
    ctx: RequestContext
) {
    return async () => {
        if (!state.isPaused) {
            throw new Error("状态管理错误,在非暂停状态下调用恢复回调");
        }
        // 重置状态
        state.isPaused = false;
        state.isStreaming = true;
        state.isDone = false;

        // 重新构建消息历史，附加系统继续消息
        const messages: MessageHistory = [
            ...state.savedMessages.map(msg => ({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp
            })),
            { role: "user", content: "system:continue", timestamp: Date.now() }
        ];

        try {
            await doStartAIRequest(ctx, messages);
        } catch (e) {
            console.error(e);
        }
    };
}

/**
 * 创建确认处理函数
 *
 * 作用：处理用户点击确认按钮的三种场景：
 *   1. 正在流式响应中 → 中止当前请求
 *   2. 响应已完成 → 将内容填充到编辑器
 *   3. 空闲状态 → 构建提示词并发起新请求
 */
function createConfirmHandler(
    state: AssistantResponseState,
    protyle: IProtyle,
    selectedBlockElements: Element[],
    targetElement: Element,
    dialog: Dialog,
    ctx: RequestContext
) {
    return async (inputValue: Array<{
        role: "user" | "assistant";
        content: string;
        timestamp: number;
    }>) => {
        if (state.isStreaming) {
            state.abortFunction?.();
            return;
        }
        if (state.isDone) {
            const targetElements = selectedBlockElements.length > 0
                ? selectedBlockElements
                : [targetElement];
            fillContent(protyle, state.responseContentStr, targetElements, state.blockDOMContent);
            dialog.destroy();
            return;
        }

        const blockContents: string[] = [];
        // 仅在用户选中了块元素时提取其 Markdown 内容作为上下文
        if (selectedBlockElements.length > 0) {
            for (const blockElement of selectedBlockElements) {
                const markdownContent = protyle.lute?.BlockDOM2StdMd(blockElement.outerHTML);
                if (markdownContent) {
                    blockContents.push(markdownContent.trim());
                }
            }
        }
        const promptContent = buildBlockContentPrompt(blockContents);

        // 清空之前的内容并发起请求
        state.responseContentStr = "";
        const messages: MessageHistory = [
            { role: "system", content: promptContent, timestamp: Date.now() },
            ...inputValue
        ];
        await doStartAIRequest(ctx, messages);
    };
}
