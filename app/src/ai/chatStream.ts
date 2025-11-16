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

const createAIStreamChatDialogVueConfig = (
    protyle: IProtyle,
    element: Element,
    selectedElements: Element[],
    dialog: Dialog
): VueComponentMountConfig => {
    // 创建聊天状态
    const { state, cancelHandler, pauseHandler, confirmHandler, resumeHandler } = createState(
        protyle, element, selectedElements, dialog
    )

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