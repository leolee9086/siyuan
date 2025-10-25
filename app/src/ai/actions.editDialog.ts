import { Constants } from "../constants";
import { Dialog } from "../dialog";
import { setStorageVal } from "../protyle/util/compatibility";
import { VueComponentMountConfig } from "../util/vue/mount";
import { createVueDialog } from "../util/dialog/createVueDialog";
import AiEditDialog from "../components/aiEditDialog.vue";

/**
 * 更新AI自定义动作配置
 * @param name - 更新后的动作名称
 * @param memo - 更新后的动作描述
 * @param originalName - 原始动作名称
 * @param originalMemo - 原始动作描述
 */
const updateAiActionConfig = (
    name: string,
    memo: string,
    originalName: string,
    originalMemo: string
) => {
    window.siyuan.storage[Constants.LOCAL_AI].find((subItem: {
        name: string;
        memo: string;
    }) => {
        if (originalName === subItem.name && originalMemo === subItem.memo) {
            subItem.name = name;
            subItem.memo = memo;
            setStorageVal(Constants.LOCAL_AI, window.siyuan.storage[Constants.LOCAL_AI]);
            return true;
        }
    });
};

/**
 * 删除AI自定义动作配置
 * @param originalName - 要删除的动作名称
 * @param originalMemo - 要删除的动作描述
 */
const deleteAiActionConfig = (
    originalName: string,
    originalMemo: string
) => {
    window.siyuan.storage[Constants.LOCAL_AI].find((subItem: {
        name: string;
        memo: string;
    }, index: number) => {
        if (originalName === subItem.name && originalMemo === subItem.memo) {
            window.siyuan.storage[Constants.LOCAL_AI].splice(index, 1);
            setStorageVal(Constants.LOCAL_AI, window.siyuan.storage[Constants.LOCAL_AI]);
            return true;
        }
    });
};

/**
 * 创建编辑对话框的Vue应用配置
 * 为AI编辑对话框组件提供必要的数据、事件处理器和模板配置
 *
 * @param customName - 自定义动作名称
 * @param customMemo - 自定义动作描述
 * @param dialog - 对话框实例
 * @returns Vue组件挂载配置对象
 */
const createEditDialogVueConfig = (customName: string, customMemo: string, dialog: Dialog): VueComponentMountConfig => {
    return {
        components: {
            AiEditDialog
        },
        data: {
            name: customName,
            memo: customMemo
        },
        eventHandlers: {
            handleCancel: () => dialog.destroy(),
            handleConfirm: (name: string, memo: string) => {
                updateAiActionConfig(name, memo, customName, customMemo);
                dialog.destroy();
            },
            handleDelete: () => {
                deleteAiActionConfig(customName, customMemo);
                dialog.destroy();
            }
        },
        template: `<AiEditDialog :name="name" :memo="memo" @cancel="handleCancel" @confirm="handleConfirm" @delete="handleDelete" ref="aiEditDialogComponent" />`,
        initMethodName: "focusSearchInput"
    };
};

/**
 * 创建并显示AI自定义动作编辑对话框
 * 提供用户界面用于编辑现有的AI自定义动作配置
 *
 * @param customName - 要编辑的自定义动作名称
 * @param customMemo - 要编辑的自定义动作描述
 * @returns 创建的对话框实例
 */
export const editDialog = (customName: string, customMemo: string) => {
    return createVueDialog({
        title: window.siyuan.languages.update,
        dataKey: Constants.DIALOG_AIUPDATECUSTOMACTION,
        vueConfigFactory: (dialog: Dialog) => createEditDialogVueConfig(customName, customMemo, dialog)
    });
};
