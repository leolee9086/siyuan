import { Dialog } from "../dialog";
import { isMobile } from "../util/functions";
import { createVueComponentInDialog, VueComponentMountConfig } from "../util/vue/mount";
import AiChatDialog from "../components/panels/aiChatDialog.vue";
import { kernelClient } from "../data/kernelSDK";
import { fillContent } from "./actions.fillContent";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
// 创建聊天对话框Vue应用配置
const createChatDialogVueConfig = (protyle: IProtyle, element: Element, dialog: Dialog): VueComponentMountConfig => {
    return {
        components: {
            AiChatDialog
        },
        eventHandlers: {
            handleCancel: dialog.destroy,
            handleConfirm: async (message: string) => {
                const res = await kernelClient.chatGPT({ msg: message });
                console.log(res, protyle, element);
                let msg = message;
                dialog.destroy();
                let content = res.data;
                if (content) {
                    content = "\n\n" + content;
                }
                if (msg === "Clear context") {
                    msg = "";
                }
                fillContent(protyle, `${msg}${content}`, [element]);
            }

        },
        template: "<AiChatDialog @cancel=\"handleCancel\" @confirm=\"handleConfirm\" ref=\"aiChatDialogComponent\" />",
        initMethodName: "focusChatInput"
    };
};

export const AIChat = (protyle: IProtyle, element: Element) => {
    const dialog = new Dialog({
        title: "✨ " + siyuanI18n.aiWriting,
        content: "",
        width: isMobile() ? "92vw" : "520px",
    });
    createVueComponentInDialog(dialog, createChatDialogVueConfig(protyle, element, dialog));
    return dialog;
};


