/**
 * 用途：获取siyuan存储对象，用于操作本地存储中的AI动作配置
 * 使用范围：AI动作配置的读取、写入和持久化
 * 解耦评估：通过imports.ts统一转发，避免直接依赖siyuan环境
 */
import { getSiyuanStorage } from "./imports";
/**
 * 用途：获取siyuan国际化文本，用于对话框标题等UI文本
 * 使用范围：AI对话框的UI标题
 * 解耦评估：通过imports.ts统一转发，避免直接依赖siyuan环境
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：AI动作配置的类型定义
 * 使用范围：存储上下文和动作配置的类型标注
 * 解耦评估：类型导入，不涉及运行时耦合
 */
import type { AiActionConfig } from "./types";
/**
 * 用途：AI动作存储上下文类型，用于提供存储操作的接口定义
 * 使用范围：存储上下文对象和函数参数的类型标注
 * 解耦评估：类型导入，不涉及运行时耦合
 */
import type { AiActionStorageContext } from "./types";
/**
 * 用途：常量定义，用于本地存储键名
 * 使用范围：本地存储的键名引用
 * 解耦评估：通过imports.ts统一转发
 */
import { Constants } from "./imports";
/**
 * 用途：对话框实例类型，用于对话框创建和销毁
 * 使用范围：对话框实例化操作
 * 解耦评估：通过imports.ts统一转发
 * @AIDONE 当前 dialog 依然通过 imports.ts 导入，调用方通过 createDialog 工厂创建实例；若后续需要替换为参数注入方式，可通过 DialogFactory 接口解耦
 */
import { Dialog } from "./imports";
/**
 * 用途：本地存储写入函数
 * 使用范围：AI动作配置持久化
 * 解耦评估：通过imports.ts统一转发
 */
import { setStorageVal } from "./imports";
/**
 * 用途：Vue组件挂载配置类型，用于定义对话框组件的数据、模板和事件处理器
 * 使用范围：对话框Vue配置的类型标注
 * 解耦评估：类型导入，通过imports.ts统一转发
 */
import type { VueComponentMountConfig } from "./imports";
/**
 * 用途：创建Vue对话框的工具函数
 * 使用范围：对话框实例化
 * 解耦评估：通过imports.ts统一转发
 */
import { createVueDialog } from "./imports";
/**
 * 用途：AI编辑对话框组件
 * 使用范围：对话框模板渲染
 * 解耦评估：组件导入，通过imports.ts统一转发
 */
import { AiEditDialog } from "./imports";

/**
 * 创建AI动作存储上下文
 * @returns AI动作存储上下文对象
 */
const createAiActionStorageContext = () => {
    return {
        /** 获取全部AI动作配置列表 */
        getAiActions: () => {
            if (!getSiyuanStorage()) {
                throw Error("siyuan对象结构不正确");
            }

            return getSiyuanStorage()[Constants.LOCAL_AI] || [];
        },

        /** 覆盖设置AI动作配置列表 */
        setAiActions: (actions: AiActionConfig[]) => {
            if (!getSiyuanStorage()) {
                throw Error("siyuan对象结构不正确");
            }

            getSiyuanStorage()[Constants.LOCAL_AI] = actions;
        },

        /** 将当前AI动作配置持久化到本地存储 */
        saveAiActions: () => {
            if (!getSiyuanStorage()) {
                throw Error("siyuan对象结构不正确");
            }

            setStorageVal(Constants.LOCAL_AI, getSiyuanStorage()[Constants.LOCAL_AI]);
        }
    };
};

/**
 * 更新AI自定义动作配置
 * 遵循函数标准形式，使用inputs、outputs、ctx结构
 * @显式返回类型原因 async函数需要显式标注Promise<void>以明确异步边界
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
)=> {
    const { originalName, originalMemo, newName, newMemo } = inputs;

    // 验证输入参数
    if (!originalName || !originalMemo || !newName || !newMemo) {
        throw Error("更新AI动作配置：所有参数都不能为空");
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
 * @显式返回类型原因 async函数需要显式标注Promise<void>以明确异步边界
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
        throw Error("删除AI动作配置：名称和描述不能为空");
    }

    const actions = ctx.getAiActions();
    const filteredActions = actions.filter(action =>
        !(action.name === name && action.memo === memo)
    );

    // 检查是否找到了要删除的项目
    if (actions.length === filteredActions.length) {
        throw Error(`未找到要删除的AI动作配置：${name} - ${memo}`);
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
        /** 取消编辑并关闭对话框 */
        handleCancel: () => dialog.destroy(),

        /** 确认编辑：更新动作配置并关闭对话框 */
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

        /** 删除当前动作配置并关闭对话框 */
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
 * @显式返回类型原因 必须显式标注返回类型以符合VueComponentMountConfig接口定义
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
        template: "<AiEditDialog :name=\"name\" :memo=\"memo\" @cancel=\"handleCancel\" @confirm=\"handleConfirm\" @delete=\"handleDelete\" ref=\"aiEditDialogComponent\" />",
        initMethodName: "focusSearchInput"
    };
};

/**
 * 创建并显示AI自定义动作编辑对话框
 * 提供用户界面用于编辑现有的AI自定义动作配置
 * @显式返回类型原因 必须显式标注返回类型以符合createVueDialog对工厂函数的类型要求
 *
 * @param customName - 要编辑的自定义动作名称
 * @param customMemo - 要编辑的自定义动作描述
 * @returns 创建的对话框实例
 */
const editDialog = (customName: string, customMemo: string): Dialog => {
    // 验证输入参数
    if (!customName || !customMemo) {
        throw Error("编辑AI动作配置：名称和描述不能为空");
    }

    return createVueDialog({
        dataKey: Constants.DIALOG_AIUPDATECUSTOMACTION,
        /** @简洁函数 工厂函数，利用闭包捕获customName/customMemo参数，延迟到对话框创建时生成Vue配置 */
        vueConfigFactory: (dialog: Dialog) => createEditDialogVueConfig(customName, customMemo, dialog),
        dialogOptions: {
            title: siyuanI18n.update
        }
    });
};

// 导出编辑对话框函数
export { editDialog };
