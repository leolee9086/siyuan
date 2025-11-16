import {
    Dialog,
    isMobile,
    genUUID,
    genRandomColor,
    createVueDialog,
    AIChatDialog,
    VueComponentMountConfig,
    createBlockMasks,
} from "./imports";
import { setDialogContainerColor, removeBlockMask } from "./utils.mask";
import { reactive } from "vue";
import { fillContent } from "./actions.fillContent";
import { AssistantResponseState } from './session/session.types';
import { createTemporaryModule } from "../util/code/scripts.executor";
import { buildBlockContentPrompt } from "./prompts/blockContent.builder";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";
import { getAIConfigFromSiyuan } from "./utils.config";
import { handleOpenAILikeStreamResponse } from "./handleOpenAILikeStreamResponse";
import { processBlockDOMContent } from "./chatStream.utils";
import { createAIRequestController, AIRequestController } from "./requestController.impl";

const createAIStreamChatDialogVueConfig = (
    protyle: IProtyle,
    element: Element,
    selectedElements: Element[],
    dialog: Dialog
): VueComponentMountConfig => {
    // 创建聊天状态
    const state: AssistantResponseState = reactive({
        responseContentStr: '',
        isStreaming: false,
        isDone: false,
        abortFunction: null,
        blockDOMContent: '',
        onWaitToolCallDetected: async () => { },
        onAsyncToolCallDetected: async () => { },
        isPaused: false,
        savedMessages: [],
        asyncToolResults: [],
        errorCount: 0,
        syncToolCallCount: 0,
        asyncToolCallCount: 0
    });

    // 创建事件处理函数
    const cancelHandler = createCancelHandler(state, dialog);
    const pauseHandler = createPauseHandler(state);
    const resumeHandler = createResumeHandler(state, protyle);
    const confirmHandler = createConfirmHandler(state, protyle, selectedElements, element, dialog);
    // 创建工具调用处理函数
    state.onWaitToolCallDetected = createWaitToolCallHandler(state, resumeHandler);
    state.onAsyncToolCallDetected = createAsyncToolCallHandler(state);
    return {
        components: {
            AIChatDialog
        },
        data: {
            onCancelClick: cancelHandler,
            onPauseClick: pauseHandler,
            onResumeClick: resumeHandler,
            onConfirmClick: confirmHandler,
            state,
        },
        template: `<AIChatDialog
            :onCancelClick="onCancelClick"
            :onPauseClick="onPauseClick"
            :onResumeClick="onResumeClick"
            :onConfirmClick="onConfirmClick"
            :state="state"
            @ui-functions-ready="onUIFunctionsReady"
        />`,
    };
};

// 创建等待工具调用处理函数
const createWaitToolCallHandler = (
    state: AssistantResponseState,
    resumeHandler: () => Promise<void>
) => {
    return async (toolCode: string) => {
        // 检查同步工具调用次数限制
        if (state.syncToolCallCount >= 10) {
            console.error('同步工具调用次数已达上限(10次)');
            state.savedMessages.push({
                role: 'user',
                content: 'system:同步工具调用次数已达上限(10次)，无法继续执行工具调用',
                timestamp: Date.now()
            });
            // 不执行工具调用，直接恢复对话
            await resumeHandler();
            return;
        }

        // 确保在正确的状态下执行工具调用
        // 如果正在流式响应中，需要先暂停
        console.log(state.isStreaming, state.isPaused)
        if (state.isStreaming && !state.isPaused) {
            state.isPaused = true;
            if (state.abortFunction) {
                state.abortFunction();
            }
            // 保存当前消息内容
            state.savedMessages.push({
                role: 'assistant',
                content: state.responseContentStr,
                timestamp: Date.now()
            });
        }

        // 确保状态已正确设置
        state.isStreaming = false;

        try {
            // 增加同步工具调用计数
            state.syncToolCallCount += 1;
            console.log(`同步工具调用次数: ${state.syncToolCallCount}/10`);

            // 执行工具调用
            const result = await createTemporaryModule(toolCode);
            console.log('工具调用执行结果:', result);
            if (!result.moduleExport.default) {
                throw new Error('必须使用default导出你需要查看的结果')
            }
            // 将工具执行结果添加到消息历史中
            state.savedMessages.push({
                role: 'user',
                content: `Tool execution result: ${JSON.stringify(await result.moduleExport.default)}`,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('工具调用执行失败:', error);
            // 将错误信息添加到消息历史中
            state.errorCount += 1
            if (error instanceof Error)
                state.savedMessages.push({
                    role: 'user',
                    content: `system:工具调用执行失败: ${error.message},\n你必须使用标准esm语法并且以default导出你需要的结果`,
                    timestamp: Date.now()
                });
        } finally {
            // 恢复对话
            console.log(state.errorCount)
            state.errorCount <= 3 && await resumeHandler();
        }
    };
};

// 创建异步工具调用处理函数
const createAsyncToolCallHandler = (
    state: AssistantResponseState
) => {
    return async (toolCode: string) => {
        // 检查异步工具调用次数限制
        if (state.asyncToolCallCount >= 10) {
            console.error('异步工具调用次数已达上限(10次)');
            // 不执行工具调用，直接返回错误结果
            state.asyncToolResults.push({ error: '异步工具调用次数已达上限(10次)，无法继续执行工具调用' });
            return;
        }

        let toolPromise: Promise<any> | null = null;
        try {
            // 增加异步工具调用计数
            state.asyncToolCallCount += 1;
            console.log(`异步工具调用次数: ${state.asyncToolCallCount}/10`);

            // 创建异步工具调用Promise并添加到结果堆栈
            toolPromise = createTemporaryModule(toolCode);
            state.asyncToolResults.push(toolPromise);

            // 等待工具调用完成
            const result = await toolPromise;
            console.log('异步工具调用执行结果:', result);

            // 将结果替换到asyncToolResults中，而不是添加到消息历史
            const index = state.asyncToolResults.indexOf(toolPromise);
            if (index !== -1) {
                state.asyncToolResults[index] = result;
            }
        } catch (error) {
            if (error instanceof Error)

                // 将错误信息替换到asyncToolResults中
                if (toolPromise) {
                    const index = state.asyncToolResults.indexOf(toolPromise);
                    if (index !== -1) {
                        state.asyncToolResults[index] = { error: error.message };
                    }
                }
        }
    };
};

// 创建取消处理函数
const createCancelHandler = (
    state: AssistantResponseState,
    dialog: Dialog
) => {
    return () => {
        if (state.abortFunction) {
            state.abortFunction();
        }
        dialog.destroy();
    };
};

// 创建暂停处理函数
const createPauseHandler = (
    state: AssistantResponseState
) => {
    return () => {
        if (state.isStreaming && !state.isPaused) {
            // 暂停请求
            state.isPaused = true;
            if (state.abortFunction) {
                state.abortFunction();
            }
            // 保存当前消息内容
            state.savedMessages.push({
                role: 'assistant',
                content: state.responseContentStr,
                timestamp: Date.now()
            });
        }
    };
};

// 创建AI请求处理函数
const createAIRequestHandler = async (
    state: AssistantResponseState,
    protyle: IProtyle,
    messages: Array<{ role: 'user' | 'assistant'|'system'; content: string; timestamp: number }>
): Promise<AIRequestController> => {
    // 创建请求控制器，完全断开与state的直接联系
    const controller = createAIRequestController(
        {
            onStart: () => {
                // 通过事件通知外部更新状态，而不是直接操作state
                state.isStreaming = true;
                state.isDone = false;
            },
            onMessage: (dataStr: string) => {
                // 使用新的文本流读取机制，传递当前内容而不是整个状态
                const result = handleOpenAILikeStreamResponse(dataStr, state.responseContentStr);

                if (result.error) {
                    return;
                }

                if (result.content) {
                    state.responseContentStr += result.content;
                    // 处理DOM内容
                    processBlockDOMContent(state, protyle);
                }

                if (result.isFinished) {
                    state.isStreaming=false;
                    state.isDone=true;
                }
            },
            onComplete: () => {
                state.isStreaming =false;
                state.isDone=true;
            },
            onError: (error: Error) => {
                state.isStreaming =false;
                console.error(error)
            },
            onAbort: () => {
                state.isStreaming =false;
            },
            onPause: () => {
                state.isPaused=true;
            },
            onResume: () => {
                state.isPaused=false;
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

// 创建恢复处理函数
const createResumeHandler = (
    state: AssistantResponseState,
    protyle: IProtyle,
) => {
    return async () => {
        if (!state.isPaused) {
            throw new Error("状态管理错误,在非暂停状态下调用恢复回调")
        }
        // 重置状态
        state.isPaused = false;
        state.isStreaming = true;
        state.isDone = false;

        // 重新构建消息历史，但不包含系统继续消息
        const messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }> = state.savedMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp
        }));

        // 临时添加系统继续消息到请求中，但不保存到历史
        messages.push({
            role: 'user',
            content: 'system:continue',
            timestamp: Date.now()
        });

        // 使用新的请求控制器发送请求
        try {
            await createAIRequestHandler(state, protyle, messages);
        } catch (e) {
            console.error(e)
        }

    };
};

// 创建确认处理函数
const createConfirmHandler = (
    state: AssistantResponseState,
    protyle: IProtyle,
    selectedBlockElements: Element[],
    targetElement: Element,
    dialog: Dialog
) => {
    return async (inputValue: string) => {
        if (state.isStreaming) {
            if (state.abortFunction) {
                state.abortFunction();
            }
            return;
        }
        if (state.isDone) {
            const targetElements = selectedBlockElements.length > 0 ? selectedBlockElements : [targetElement];
            fillContent(protyle, state.responseContentStr, targetElements, state.blockDOMContent);
            dialog.destroy();
            return;
        }
        let blockContents: string[] = [];
        if (selectedBlockElements.length > 0) {
            selectedBlockElements.forEach(blockElement => {
                // 使用 BlockDOM2StdMd 方法获取标准 Markdown 格式内容
                const markdownContent = protyle.lute?.BlockDOM2StdMd(blockElement.outerHTML);
                if (markdownContent) {
                    blockContents.push(markdownContent.trim());
                }
            });
        }
        const promptContent = buildBlockContentPrompt(blockContents);
        // 清空之前的内容
        state.responseContentStr = '';
        // 使用新的请求控制器发送请求
        await createAIRequestHandler(
            state,
            protyle,
            [{
                role:"system",content:promptContent,timestamp:Date.now()
            },
                { role: 'user', content:inputValue,   timestamp: Date.now() }
            ]
        );
    };
};

export const AIChat = (protyle: IProtyle, element: Element) => {
    const randomColor = genRandomColor();
    // 获取选中的块元素
    const selectedElementsNodeList = protyle.wysiwyg?.element.querySelectorAll(".protyle-wysiwyg--select") || [];
    const selectedElements = selectedElementsNodeList.length > 0 ? Array.from(selectedElementsNodeList) : [];
    // 使用批量创建函数为目标元素和所有选中的块元素创建遮罩
    const maskElements = createBlockMasks(element, selectedElements, randomColor);
    const dialog = createVueDialog({
        dataKey: `ai-chat-dialog-${genUUID()}`,
        vueConfigFactory: (dialogInstance: Dialog) => createAIStreamChatDialogVueConfig(protyle, element, selectedElements, dialogInstance),
        dialogOptions: {
            title: "✨ " + siyuanI18n.aiWriting,
            width: isMobile() ? "92vw" : "520px",
            transparent: true,
            disableScrimClose: true,
            disableEscapeClose: true,
            scrimPointerEvents: true,
            closeButtonPosition: "inside",
            destroyCallback: () => {
                maskElements.forEach(mask => removeBlockMask(mask));
            }
        }
    });
    setDialogContainerColor(dialog, randomColor);
    // 监听块元素删除
    const observer = new MutationObserver(() => {
        if (!document.body.contains(element)) {
            observer.disconnect();
            dialog.destroy();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
};