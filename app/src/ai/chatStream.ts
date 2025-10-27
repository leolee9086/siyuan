import { Dialog } from "../dialog";
import { isMobile } from "../util/functions";
import { genUUID } from "../util/genID";
import { genMaskColor, createBlockMask, setDialogColor, removeBlockMask } from "./chatStream.mask";
import { createVueDialog } from "../util/dialog/createVueDialog";
import AIChatDialog from "./StreamChat.panel.vue";
import { VueComponentMountConfig } from "../util/vue/mount";

const createAIChatDialogVueConfig = (
    protyle: IProtyle,
    element: Element,
    selectedElements: Element[],
    dialog: Dialog
): VueComponentMountConfig => {
    return {
        components: {
            AIChatDialog
        },
        data: {
            protyle,
            targetElement: element,
            selectedElements,
            dialog,
        },
        template: `<AIChatDialog :protyle="protyle" :targetElement="targetElement" :selectedElements="selectedElements" :dialog="dialog" />`,
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