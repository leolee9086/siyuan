import {
    Dialog,
    isMobile,
    genUUID,
    genRandomColor,
    createVueDialog,
    AIChatDialog,
    VueComponentMountConfig,
    createBlockMasks,
    getContenteditableElement,
    handleAIRequest
} from "./imports";
import { setDialogContainerColor, removeBlockMask } from "./utils.mask";
import { reactive } from "vue";
import { fillContent } from "./actions.fillContent";
import { ChatSessionState, UIFunctions } from './session/session.types';
import { createTemporaryModule } from "./parser/toolCallDetector";
import { buildBlockContentPrompt } from "./prompts/blockContent.builder";
import { createSiyuanStreamChatBusinessLogic } from "./streamChat.businessLogicFactory";

const createAIStreamChatDialogVueConfig = (
    protyle: IProtyle,
    element: Element,
    selectedElements: Element[],
    dialog: Dialog
): VueComponentMountConfig => {
    // 创建聊天状态
    const state: ChatSessionState = reactive({
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
    });

    // 创建UI函数引用容器
    const uiFunctions: UIFunctions = {
        showResponse: () => { },
        setCompleteStatus: () => { },
        setErrorStatus: () => { },
        setAbortStatus: () => { },
        getResponseContentRef: (): HTMLElement | null => null,
    };

    // 创建事件处理函数
    const cancelHandler = createCancelHandler(state, dialog);
    const pauseHandler = createPauseHandler(state);
    const resumeHandler = createResumeHandler(state, protyle, uiFunctions);
    const confirmHandler = createConfirmHandler(state,protyle,selectedElements,element,uiFunctions,dialog);
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
            onUIFunctionsReady: (newUiFunctions: UIFunctions) => {
                Object.assign(uiFunctions, newUiFunctions);
            }
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
    state: ChatSessionState,
    resumeHandler: () => Promise<void>
) => {
    return async (toolCode: string) => {
        // 暂停当前的流式响应
        if (state.isStreaming && !state.isPaused) {
            state.isPaused = true;
            if (state.abortFunction) {
                state.abortFunction();
            }
            state.savedMessages.push({
                role: 'assistant',
                content: state.responseContentStr,
                timestamp: Date.now()
            });
        }

        try {
            // 执行工具调用
            const result = await createTemporaryModule(toolCode);
            console.log('工具调用执行结果:', result);
            // 将工具执行结果添加到消息历史中
            state.savedMessages.push({
                role: 'user',
                content: `Tool execution result: ${JSON.stringify(result)}`,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('工具调用执行失败:', error);
            // 将错误信息添加到消息历史中
            state.savedMessages.push({
                role: 'user',
                content: `Tool execution failed: ${error.message}`,
                timestamp: Date.now()
            });
        } finally {
            // 恢复对话
            await resumeHandler();
        }
    };
};

// 创建异步工具调用处理函数
const createAsyncToolCallHandler = (
    state: ChatSessionState
) => {
    return async (toolCode: string) => {
        let toolPromise: Promise<any> | null = null;
        try {
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
            console.error('异步工具调用执行失败:', error);
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
    state: ChatSessionState,
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
    state: ChatSessionState
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

// 创建恢复处理函数
const createResumeHandler = (
    state: ChatSessionState,
    protyle: IProtyle,
    uiFunctions: UIFunctions
) => {
    return async () => {
        if (state.isPaused) {
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

            // 重新发送请求
            const businessLogic = createSiyuanStreamChatBusinessLogic();
            const abortFn = await handleAIRequest(
                businessLogic,
                state,
                protyle,
                uiFunctions.showResponse,
                uiFunctions.setCompleteStatus,
                uiFunctions.setErrorStatus,
                uiFunctions.setAbortStatus,
                messages // 传入包含临时系统继续消息的消息历史
            );

            if (abortFn) {
                state.abortFunction = abortFn;
            }
        }
    };
};

// 创建确认处理函数
const createConfirmHandler = (
    state: ChatSessionState,
    protyle: IProtyle,
    selectedBlockElements: Element[],
    targetElement: Element,
    uiFunctions: UIFunctions,
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
                const editableElement = getContenteditableElement(blockElement);
                if (editableElement) {
                    blockContents.push(editableElement.textContent || '');
                }
            });
        }
        const promptContent = buildBlockContentPrompt(inputValue, blockContents);

        // 清空之前的内容
        state.responseContentStr = '';

        const businessLogic = createSiyuanStreamChatBusinessLogic();
        const abortFn = await handleAIRequest(
            businessLogic,
            state,
            protyle,
            uiFunctions.showResponse,
            uiFunctions.setCompleteStatus,
            uiFunctions.setErrorStatus,
            uiFunctions.setAbortStatus,
            [{ role: 'user', content: promptContent, timestamp: Date.now() }]
        );

        if (abortFn) {
            state.abortFunction = abortFn;
        }
    };
};

export const AIChat = (protyle: IProtyle, element: Element) => {
    const randomColor = genRandomColor();

    // 获取选中的块元素
    const selectedElementsNodeList = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    const selectedElements = selectedElementsNodeList.length > 0 ? Array.from(selectedElementsNodeList) : [];

    // 使用批量创建函数为目标元素和所有选中的块元素创建遮罩
    const maskElements = createBlockMasks(element, selectedElements, randomColor);

    const dialog = createVueDialog({
        dataKey: `ai-chat-dialog-${genUUID()}`,
        vueConfigFactory: (dialogInstance: Dialog) => createAIStreamChatDialogVueConfig(protyle, element, selectedElements, dialogInstance),
        dialogOptions: {
            title: "✨ " + window.siyuan.languages.aiWriting,
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