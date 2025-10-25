import { Dialog } from "../dialog";
import { isMobile } from "../util/functions";
import { handleAIChatConfirm } from "./chat.confirm";
import { createVueComponentInDialog, VueComponentMountConfig } from "../util/vue/mount";
import AiChatDialog from "../components/aiChatDialog.vue";

// 处理取消事件
const handleCancel = (dialog: Dialog) => {
    dialog.destroy();
};

// 处理确认事件
const handleConfirm = (
    dialog: Dialog,
    message: string,
    protyle: IProtyle,
    element: Element
) => {
    // 创建一个模拟的输入元素以保持与原有 handleAIChatConfirm 函数的兼容性
    const mockInputElement = { value: message } as HTMLTextAreaElement;
    handleAIChatConfirm(mockInputElement, dialog, protyle, element);
};

// 创建聊天对话框Vue应用配置
const createChatDialogVueConfig = (protyle: IProtyle, element: Element, dialog: Dialog): VueComponentMountConfig => {
    return {
        components: {
            AiChatDialog
        },
        eventHandlers: {
            handleCancel: () => handleCancel(dialog),
            handleConfirm: (message: string) => handleConfirm(dialog, message, protyle, element)
        },
        template: `<AiChatDialog @cancel="handleCancel" @confirm="handleConfirm" ref="aiChatDialogComponent" />`,
        initMethodName: "focusChatInput"
    };
};

export const AIChat = (protyle: IProtyle, element: Element) => {
    const dialog = new Dialog({
        title: "✨ " + window.siyuan.languages.aiWriting,
        content: "",
        width: isMobile() ? "92vw" : "520px",
    });
    
    createVueComponentInDialog(dialog, createChatDialogVueConfig(protyle, element, dialog));
    
    return dialog;
};


