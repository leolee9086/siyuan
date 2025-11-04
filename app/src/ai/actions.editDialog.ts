import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";
import { z } from "./deps";
import {
    Constants,
    Dialog,
    setStorageVal,
    VueComponentMountConfig,
    createVueDialog,
    AiEditDialog
} from "./imports";

/**
 * AI动作配置项类型定义
 */
const AiActionConfigSchema = z.object({
    name: z.string().min(1, "动作名称不能为空"),
    memo: z.string().min(1, "动作描述不能为空")
});

/**
 * AI动作配置项类型
 */
type AiActionConfig = z.infer<typeof AiActionConfigSchema>;

/**
 * AI动作存储上下文接口
 */
interface AiActionStorageContext {
    /**
     * 获取AI动作配置列表
     */
    getAiActions(): AiActionConfig[];

    /**
     * 设置AI动作配置列表
     */
    setAiActions(actions: AiActionConfig[]): void;

    /**
     * 保存AI动作配置到存储
     */
    saveAiActions(): void;
}

/**
 * 创建AI动作存储上下文
 * @returns AI动作存储上下文对象
 */
const createAiActionStorageContext = (): AiActionStorageContext => {
    return {
        getAiActions: (): AiActionConfig[] => {
            if (!window.siyuan.storage) {
                throw ('siyuan对象结构不正确')
            }

            return window.siyuan.storage[Constants.LOCAL_AI] || [];
        },

        setAiActions: (actions: AiActionConfig[]): void => {
            if (!window.siyuan.storage) {
                throw ('siyuan对象结构不正确')
            }

            window.siyuan.storage[Constants.LOCAL_AI] = actions;
        },

        saveAiActions: (): void => {
            if (!window.siyuan.storage) {
                throw ('siyuan对象结构不正确')
            }

            setStorageVal(Constants.LOCAL_AI, window.siyuan.storage[Constants.LOCAL_AI]);
        }
    };
};

/**
 * 更新AI自定义动作配置
 * 遵循函数标准形式，使用inputs、outputs、ctx结构
 */
const updateAiActionConfig = async (
    inputs: {
        originalName: string;
        originalMemo: string;
        newName: string;
        newMemo: string;
    },
    _outputs: undefined,
    ctx: AiActionStorageContext
): Promise<void> => {
    const { originalName, originalMemo, newName, newMemo } = inputs;

    // 验证输入参数
    if (!originalName || !originalMemo || !newName || !newMemo) {
        throw new Error("更新AI动作配置：所有参数都不能为空");
    }

    const actions = ctx.getAiActions();
    const updatedActions = actions.map(action => {
        if (action.name === originalName && action.memo === originalMemo) {
            return { name: newName, memo: newMemo };
        }
        return action;
    });

    ctx.setAiActions(updatedActions);
    ctx.saveAiActions();
};

/**
 * 删除AI自定义动作配置
 * 遵循函数标准形式，使用inputs、outputs、ctx结构
 */
const deleteAiActionConfig = async (
    inputs: {
        name: string;
        memo: string;
    },
    _outputs: undefined,
    ctx: AiActionStorageContext
): Promise<void> => {
    const { name, memo } = inputs;

    // 验证输入参数
    if (!name || !memo) {
        throw new Error("删除AI动作配置：名称和描述不能为空");
    }

    const actions = ctx.getAiActions();
    const filteredActions = actions.filter(action =>
        !(action.name === name && action.memo === memo)
    );

    // 检查是否找到了要删除的项目
    if (actions.length === filteredActions.length) {
        throw new Error(`未找到要删除的AI动作配置：${name} - ${memo}`);
    }

    ctx.setAiActions(filteredActions);
    ctx.saveAiActions();
};

/**
 * 创建编辑对话框的事件处理器
 * @param customName - 原始动作名称
 * @param customMemo - 原始动作描述
 * @param dialog - 对话框实例
 * @returns 事件处理器对象
 */
const createEditDialogEventHandlers = (customName: string, customMemo: string, dialog: Dialog) => {
    const ctx = createAiActionStorageContext();

    return {
        handleCancel: () => dialog.destroy(),

        handleConfirm: async (name: string, memo: string) => {
            try {
                await updateAiActionConfig({
                    originalName: customName,
                    originalMemo: customMemo,
                    newName: name,
                    newMemo: memo
                }, undefined, ctx);
                dialog.destroy();
            } catch (error) {
                console.error("更新AI动作配置失败:", error);
                // 可以在这里添加错误提示UI
            }
        },

        handleDelete: async () => {
            try {
                await deleteAiActionConfig({
                    name: customName,
                    memo: customMemo
                }, undefined, ctx);
                dialog.destroy();
            } catch (error) {
                console.error("删除AI动作配置失败:", error);
                // 可以在这里添加错误提示UI
            }
        }
    };
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
    const eventHandlers = createEditDialogEventHandlers(customName, customMemo, dialog);

    return {
        components: {
            AiEditDialog
        },
        data: {
            name: customName,
            memo: customMemo
        },
        eventHandlers,
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
const editDialog = (customName: string, customMemo: string): Dialog => {
    // 验证输入参数
    if (!customName || !customMemo) {
        throw new Error("编辑AI动作配置：名称和描述不能为空");
    }

    return createVueDialog({
        dataKey: Constants.DIALOG_AIUPDATECUSTOMACTION,
        vueConfigFactory: (dialog: Dialog) => createEditDialogVueConfig(customName, customMemo, dialog),
        dialogOptions: {
            title: siyuanI18n.update
        }
    });
};

// 导出编辑对话框函数
export { editDialog };
