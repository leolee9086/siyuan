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
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";
import { createState } from "./chatStream.state";
import { AssistantResponseState } from "./session/session.types";
import { reactive } from "vue";

const createAIStreamChatDialogVueConfig = (
    protyle: IProtyle,
    element: Element,
    selectedElements: Element[],
    dialog: Dialog
): VueComponentMountConfig => {
    // 创建聊天状态数组
    const taskStates: AssistantResponseState[] = reactive([]);

    // 创建初始状态

    // 创建新的任务状态处理函数
    const data = {
        onCancelClick: () => { },
        onPauseClick: () => { },
        onResumeClick: () => { },
        onConfirmClick: () => { },
        onCtrlEnterClick: async (inputValue: string) => { },
        taskStates: taskStates,
        inputHistory: [] as Array<{
            role: 'user' | 'assistant';
            content: string;
            timestamp: number;
        }>
    }
    data.onCtrlEnterClick = async (inputValue: string) => {
        const lastState = taskStates[taskStates.length - 1]
        lastState && data.inputHistory.push({
            role: "assistant",
            content: lastState?.responseContentStr,
            timestamp: Date.now()
        })

        // 创建新的状态
        data.inputHistory.push({
            role: "user",
            content: inputValue,
            timestamp: Date.now()
        })
        const { state: newState, cancelHandler: newCancelHandler, pauseHandler: newPauseHandler, confirmHandler: newConfirmHandler, resumeHandler: newResumeHandler } = createState(
            protyle, element, selectedElements, dialog
        );
        data.onCancelClick = newCancelHandler
        data.onPauseClick = newPauseHandler
        data.onResumeClick = newResumeHandler
        taskStates.push(newState);
        console.log(taskStates)

        // 执行新任务
        await newConfirmHandler(data.inputHistory);
    };


    return {
        components: {
            AIChatDialog
        },
        data,
        template: `<AIChatDialog
            :onCancelClick="onCancelClick"
            :onPauseClick="onPauseClick"
            :onResumeClick="onResumeClick"
            :onConfirmClick="onConfirmClick"
            :onCtrlEnterClick="onCtrlEnterClick"
            :taskStates="taskStates"
        />`,

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