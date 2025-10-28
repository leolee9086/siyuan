import { Dialog } from "../dialog";
import { isMobile } from "../util/functions";
import { genUUID } from "../util/genID";
import { genMaskColor, createBlockMask, setDialogColor, removeBlockMask } from "./chatStream.mask";
import { createVueDialog } from "../util/dialog/createVueDialog";
import AIChatDialog from "../components/StreamChat.panel.vue";
import { VueComponentMountConfig } from "../util/vue/mount";
import { handleAIRequest, handleFillContent, ChatState } from "../components/streamChat.componentLogic";

const createAIChatDialogVueConfig = (
    protyle: IProtyle,
    element: Element,
    selectedElements: Element[],
    dialog: Dialog
): VueComponentMountConfig => {
    // 创建聊天状态
    const state: ChatState = {
        responseContentStr: '',
        isStreaming: false,
        isDone: false,
        abortFunction: null,
        blockDOMContent: '',
    };
    
    // 创建响应内容引用
    const responseContentRef = { value: null as HTMLElement | null };
    
    // 创建UI函数引用
    let showResponse: () => void;
    let setCompleteStatus: () => void;
    let setErrorStatus: (error: Error) => void;
    let setAbortStatus: () => void;
    
    // 创建事件处理函数
    const cancelHandler = createCancelHandler(state, dialog);
    const confirmHandler = createConfirmHandler(
        state,
        protyle,
        selectedElements,
        element,
        responseContentRef,
        () => showResponse?.(),
        () => setCompleteStatus?.(),
        (error: Error) => setErrorStatus?.(error),
        () => setAbortStatus?.(),
        dialog
    );
    
    return {
        components: {
            AIChatDialog
        },
        data: {
            onCancelClick: cancelHandler,
            onConfirmClick: confirmHandler,
            state,
            onUIFunctionsReady: (uiFunctions: any) => {
                showResponse = uiFunctions.showResponse;
                setCompleteStatus = uiFunctions.setCompleteStatus;
                setErrorStatus = uiFunctions.setErrorStatus;
                setAbortStatus = uiFunctions.setAbortStatus;
                
                // 获取responseContentRef
                if (uiFunctions.getResponseContentRef) {
                    const responseContentEl = uiFunctions.getResponseContentRef();
                    if (responseContentEl) {
                        responseContentRef.value = responseContentEl;
                    }
                }
            }
        },
        template: `<AIChatDialog
            :onCancelClick="onCancelClick"
            :onConfirmClick="onConfirmClick"
            :state="state"
            @ui-functions-ready="onUIFunctionsReady"
        />`,
    };
};

// 创建取消处理函数
const createCancelHandler = (
    state: ChatState,
    dialog: Dialog
) => {
    return () => {
        if (state.abortFunction) {
            state.abortFunction();
        }
        dialog.destroy();
    };
};

// 创建确认处理函数
const createConfirmHandler = (
    state: ChatState,
    protyle: IProtyle,
    selectedElements: Element[],
    targetElement: Element,
    responseContentRef: { value: HTMLElement | null },
    showResponse: () => void,
    setCompleteStatus: () => void,
    setErrorStatus: (error: Error) => void,
    setAbortStatus: () => void,
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
            handleFillContent(protyle, state, selectedElements, targetElement);
            dialog.destroy();
            return;
        }
        
        const abortFn = await handleAIRequest(
            inputValue,
            state,
            protyle,
            selectedElements,
            targetElement,
            responseContentRef.value!,
            showResponse,
            setCompleteStatus,
            setErrorStatus,
            setAbortStatus
        );
        
        if (abortFn) {
            state.abortFunction = abortFn;
        }
    };
};

export const AIChat = (protyle: IProtyle, element: Element) => {
    const randomColor = genMaskColor();

    // 获取选中的块元素
    const selectedElementsNodeList = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    const selectedElements = selectedElementsNodeList.length > 0 ? Array.from(selectedElementsNodeList) : [];

    // 为目标元素和所有选中的块元素创建遮罩
    const maskElements: HTMLElement[] = [];
    const mainMask = createBlockMask(element, randomColor);
    maskElements.push(mainMask);
    if (selectedElements.length > 0) {
        selectedElements.forEach(selectedElement => {
            if (selectedElement !== element) { // 避免重复创建
                const mask = createBlockMask(selectedElement, randomColor);
                maskElements.push(mask);
            }
        });
    }

    const dialog = createVueDialog({
        title: "✨ " + window.siyuan.languages.aiWriting,
        dataKey: `ai-chat-dialog-${genUUID()}`,
        width: isMobile() ? "92vw" : "520px",
        transparent: true,
        disableScrimClose: true,
        disableEscapeClose: true,
        scrimPointerEvents: true,
        closeButtonPosition: "inside",
        vueConfigFactory: (dialogInstance: Dialog) => createAIChatDialogVueConfig(protyle, element, selectedElements, dialogInstance),
        destroyCallback: () => {
            maskElements.forEach(mask => removeBlockMask(mask));
        }
    });

    setDialogColor(dialog, randomColor);

    // 监听块元素删除
    const observer = new MutationObserver(() => {
        if (!document.body.contains(element)) {
            observer.disconnect();
            dialog.destroy();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
};