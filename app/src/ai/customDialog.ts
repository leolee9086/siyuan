import { fillContent } from "./actions.fillContent";
import {
    Constants,
    Dialog,
    VueComponentMountConfig,
    createVueDialog,
    AiCustomDialog,
    saveCustomAIAction,
    localKernel
} from "./imports";



/**
 * 创建自定义对话框的Vue应用配置
 * 为AI自定义对话框组件提供必要的数据、事件处理器和模板配置
 *
 * @param protyle - Protyle实例
 * @param ids - 文档ID列表
 * @param elements - 元素列表
 * @param dialog - 对话框实例
 * @returns Vue组件挂载配置对象
 */
const createCustomDialogVueConfig = (
    protyle: IProtyle,
    ids: string[],
    elements: Element[],
    dialog: Dialog
): VueComponentMountConfig => {
    return {
        components: {
            AiCustomDialog
        },
        data: {},
        eventHandlers: {
            handleCancel: () => dialog.destroy(),
            handleUse: async (customAction: string) => {
                const res = await localKernel.chatGPTWithAction({
                    ids,
                    action: customAction,
                })
                dialog.destroy();
                fillContent(protyle, res.data, elements);

            },
            handleSave: (name: string, customAction: string) => saveCustomAIAction(
                {
                    onAfterSave: dialog.destroy
                },
                {
                    name, customAction
                }
            )

        },
        template: `<AiCustomDialog @cancel="handleCancel" @use="handleUse" @save="handleSave" ref="aiCustomDialogComponent" />`,
        initMethodName: "focusNameInput"
    };
};

/**
 * 创建并显示AI自定义动作对话框
 * 提供用户界面用于创建和使用AI自定义动作
 *
 * @param protyle - Protyle实例
 * @param ids - 文档ID列表
 * @param elements - 元素列表
 * @returns 创建的对话框实例
 */
export const customDialog = (protyle: IProtyle, ids: string[], elements: Element[]) => {
    return createVueDialog({
        dataKey: Constants.DIALOG_AICUSTOMACTION,
        vueConfigFactory: (dialog: Dialog) => createCustomDialogVueConfig(protyle, ids, elements, dialog),
        dialogOptions: {
            title: window.siyuan.languages.aiCustomAction
        }
    });
};
