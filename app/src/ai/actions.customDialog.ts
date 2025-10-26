import { Constants } from "../constants";
import { Dialog } from "../dialog";
import { setStorageVal } from "../protyle/util/compatibility";
import { fetchPost } from "../util/fetch";
import { fillContent } from "./actions.fillContent";
import { VueComponentMountConfig } from "../util/vue/mount";
import { createVueDialog } from "../util/dialog/createVueDialog";
import AiCustomDialog from "../components/aiCustomDialog.vue";
import { saveCustomAIAction } from "../data/localStorage";

/**
 * 处理使用按钮的点击事件
 * 调用AI API并填充内容
 *
 * @param dialog - 对话框实例
 * @param protyle - Protyle实例
 * @param ids - 文档ID列表
 * @param elements - 元素列表
 * @param customAction - 自定义动作内容
 */
const handleUseClick = (
    dialog: Dialog,
    protyle: IProtyle,
    ids: string[],
    elements: Element[],
    customAction: string
) => {
    fetchPost("/api/ai/chatGPTWithAction", {
        ids,
        action: customAction,
    }, (response) => {
        dialog.destroy();
        fillContent(protyle, response.data, elements);
    });
};

/**
 * 处理保存按钮的点击事件
 * 将自定义动作保存到本地存储
 *
 * @param dialog - 对话框实例
 * @param name - 动作名称
 * @param customAction - 自定义动作内容
 */
const handleSaveClick = (
    dialog: Dialog,
    name: string,
    customAction: string
) => {
    saveCustomAIAction(
        {
            onAfterSave:dialog.destroy
        },
        {
            name,customAction
        }
    )
};

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
            handleUse: (customAction: string) => handleUseClick(dialog, protyle, ids, elements, customAction),
            handleSave: (name: string, customAction: string) => handleSaveClick(dialog, name, customAction)
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
        title: window.siyuan.languages.aiCustomAction,
        dataKey: Constants.DIALOG_AICUSTOMACTION,
        vueConfigFactory: (dialog: Dialog) => createCustomDialogVueConfig(protyle, ids, elements, dialog)
    });
};
