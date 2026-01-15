import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
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
 * 作用：创建自定义对话框的Vue应用配置
 * 意图：为AI自定义对话框组件提供必要的数据、事件处理器和模板配置，解耦组件定义与实例化逻辑
 * 调用时机：在创建对话框实例（createVueDialog）时，作为 vueConfigFactory 回调的一部分被调用
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
            /** @简洁函数 这是一个简单的回调，用于关闭对话框 */
            handleCancel: () => dialog.destroy(),
            /**
             * 作用：处理用户确认使用自定义AI动作的操作
             * 意图：执行选定的AI动作，获取结果并填充到编辑器中，同时关闭对话框
             * 调用时机：当用户在AI自定义动作对话框中点击"使用"或类似确认按钮时触发
             * 问题/改进：目前在请求发出后立即销毁对话框，如果请求耗时较长用户可能缺乏直观反馈（依赖 fillContent 的后续表现）
             */
            handleUse: async (customAction: string) => {
                const res = await localKernel.chatGPTWithAction({
                    ids,
                    action: customAction,
                });
                dialog.destroy();
                fillContent(protyle, res.data, elements);
            },
            /**
             * 作用：保存用户定义的AI动作配置
             * 意图：将用户输入的动作名称和指令内容持久化保存，以便后续重复使用
             * 调用时机：用户填写完相关信息并点击保存按钮时
             */
            handleSave: (name: string, customAction: string) => saveCustomAIAction(
                {
                    onAfterSave: dialog.destroy
                },
                {
                    name, customAction
                }
            )

        },
        template: "<AiCustomDialog @cancel=\"handleCancel\" @use=\"handleUse\" @save=\"handleSave\" ref=\"aiCustomDialogComponent\" />",
        initMethodName: "focusNameInput"
    };
};

/**
 * 作用：创建并显示AI自定义动作对话框
 * 意图：提供用户界面用于创建和使用AI自定义动作，作为功能入口
 * 调用时机：当用户从菜单或快捷键触发“AI自定义动作”功能时调用
 *
 * @param protyle - Protyle实例
 * @param ids - 文档ID列表
 * @param elements - 元素列表
 * @returns 创建的对话框实例
 */
export const customDialog = (protyle: IProtyle, ids: string[], elements: Element[]) => {
    return createVueDialog({
        dataKey: Constants.DIALOG_AICUSTOMACTION,
        /** @简洁函数 工厂函数，利用闭包透传上下文参数以创建 Vue 配置 */
        vueConfigFactory: (dialog: Dialog) => createCustomDialogVueConfig(protyle, ids, elements, dialog),
        dialogOptions: {
            title: siyuanI18n.aiCustomAction
        }
    });
};
