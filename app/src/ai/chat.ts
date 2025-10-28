import { Dialog } from "../dialog";
import { isMobile } from "../util/functions";
import { processAIChatRequestWithProtyle } from "./chat.confirm";
import { createVueComponentInDialog, VueComponentMountConfig } from "../util/vue/mount";
import AiChatDialog from "../components/panels/aiChatDialog.vue";
// 创建聊天对话框Vue应用配置
const createChatDialogVueConfig = (protyle: IProtyle, element: Element, dialog: Dialog): VueComponentMountConfig => {
    return {
        components: {
            AiChatDialog
        },
        eventHandlers: {
            handleCancel: dialog.destroy,
            handleConfirm: (message: string) => processAIChatRequestWithProtyle(
                { dialog, element, protyle },
                { msg: message }
            )
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


