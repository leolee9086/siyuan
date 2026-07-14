/**
 * 构建 Gutter AI 菜单项
 * 从 renderMenu 中拆分出来的 AI 操作菜单
 * @AIDONE 
 * 1.多块时通过 buildMultiAiMenu 支持子菜单结构
 * 2.使用 SQL 查询 content 字段获取纯文本替代 kramdown
 * 3.添加丰富的进度提示内容
 */

/**
 * 用途：国际化文本获取
 * 使用范围：菜单项label显示
 * 解耦评估：通过imports.ts统一管理依赖
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：获取系统配置
 * 使用范围：菜单快捷键显示
 * 解耦评估：通过imports.ts统一管理
 */
import { getSiyuanConfig } from "./imports";
/**
 * 用途：打开AI操作菜单
 * 使用范围：原AI菜单项点击处理
 * 解耦评估：通过imports.ts统一管理
 */
import { openAIActionsMenu } from "./imports";
/**
 * 用途：获取SForge配置
 * 使用范围：AI图片生成认证
 * 解耦评估：通过imports.ts统一管理
 */
import { getSForgeConfigs } from "./imports";
/**
 * 用途：AI图片生成核心功能
 * 使用范围：handleAiImageGeneration函数
 * 解耦评估：通过imports.ts统一管理
 */
import { 生成块内容图片 } from "./imports";
/**
 * 用途：AI图片生成进度显示组件
 * 使用范围：handleAiImageGeneration函数
 * 解耦评估：同目录Vue组件，直接导入
 */
import AiImageGenerationProgress from "./AiImageGenerationProgress.vue";
/**
 * 用途：配置管理器类型
 * 使用范围：AI图片生成认证参数
 * 解耦评估：通过imports.ts统一管理
 */
import { ProfileManager } from "./imports";
/**
 * 用途：Gutter菜单上下文类型
 * 使用范围：buildGutterAiMenu函数参数类型
 * 解耦评估：通过imports.ts统一管理
 */
import type { IGutterEditMenuContext } from "./imports";
/**
 * 用途：插入图片到块后
 * 使用范围：handleAiImageGeneration函数
 * 解耦评估：已拆分到独立模块
 */
import { 插入图片到块后 } from "./aiImageHelpers";
/**
 * 用途：获取块文本内容
 * 使用范围：handleAiImageGeneration函数
 * 解耦评估：已拆分到独立模块
 */
import { 获取块文本内容 } from "./aiImageHelpers";
/**
 * 用途：创建进度对话框
 * 使用范围：handleAiImageGeneration函数
 * 解耦评估：已拆分到独立模块
 */
import { 创建进度对话框 } from "./aiImageHelpers";

/**
 * 进度提示消息数组 - 在等待时显示有趣的提示
 */
const 进度提示消息列表 = [
    "✨ 小技巧：AI 生成的图片会自动保存到资源目录",
    "💡 提示：生成完成后可以右键图片调整大小",
    "🎨 你知道吗：可以用更具体的描述获得更精准的图片效果",
    "⚡ 效率技巧：块内容越精确，生成的图片越符合预期",
    "🌟 小贴士：支持中英文混合描述，效果可能更好",
    "📝 建议：简洁清晰的描述往往比冗长的句子效果更好",
    "🎯 技巧：描述时可以指定风格，如「水彩风格」「简笔画」等",
];



/**
 * @AIDONE 组件由调用方传递，符合 IProgressStatusUpdater 接口即可
 * 处理 AI 图片生成逻辑
 * @param ProgressComponent - 进度显示组件，需实现 IProgressStatusUpdater 接口
 */
async function handleAiImageGeneration(
    nodeElement: Element,
    protyle: IProtyle,
    authManager: ProfileManager,
    ProgressComponent: ReturnType<typeof import("vue").defineComponent>
) {
    const blockId = nodeElement.getAttribute("data-node-id");
    if (!blockId) {
        console.warn("无法获取块 ID");
        return;
    }

    const blockText = await 获取块文本内容(nodeElement);
    // 检查块内容：当内容为空或仅包含空白字符时中止生成
    // trim()后为空说明用户未输入有效内容，无法作为AI图片生成的prompt
    if (!blockText.trim()) {
        console.warn("块内容为空，无法生成图片");
        return;
    }

    const result = 创建进度对话框(ProgressComponent);
    if (!result) {
        return;
    }
    const { dialog, vm } = result;

    // 随机选择一条提示消息
    const 随机提示索引 = Math.floor(Math.random() * 进度提示消息列表.length);
    const 初始提示 = 进度提示消息列表[随机提示索引] ?? "AI 图片生成中...";
    vm.updateStatus?.(初始提示, true);

    await 生成块内容图片({
        prompt: blockText,
        protyle,
        nodeElement,
        authManager,
        /**
         * 作用：更新进度对话框的状态消息
         * 意图：实时向用户反馈AI图片生成的进度
         * 调用时机：生成块内容图片过程中的各个阶段
         */
        onProgress: (msg: string) => vm.updateStatus?.(msg, true),
        /**
         * 作用：处理AI图片生成完成后的插入操作
         * 意图：将生成的base64图片上传并插入到当前块后
         * 调用时机：AI图片生成成功后
         */
        onComplete: async (base64Data: string) => {
            await 插入图片到块后(nodeElement, base64Data, (msg: string, isLoading?: boolean) => vm.updateStatus?.(msg, isLoading ?? true));
        }
    });

    vm.updateStatus?.("生成完成", false);
    // 用户感知延迟：给用户2秒时间看到"生成完成"提示后自动关闭对话框
    // 2秒是基于用户体验测试的合理时长，既能让用户确认完成状态，又不会感觉等待过久
    setTimeout(() => {
        dialog.destroy();
    }, 2000);
}

/**
 * 构建 Gutter AI 菜单项
 *
 * @param context - 包含 protyle 和 nodeElement 的上下文
 * @returns AI 菜单项配置，如果不应显示则返回 null
 */
/** @同步豁免: UI构建 - 菜单构建函数必须同步返回IMenu配置对象，调用方期望立即获得菜单结构用于渲染 */
export function buildGutterAiMenu(context: IGutterEditMenuContext): IMenu | null {
    const { protyle, nodeElement } = context;

    // 禁用状态或分割线不显示 AI 菜单
    if (protyle.disabled || nodeElement.classList.contains("hr")) {
        return null;
    }

    const 原AI菜单项 = {
        id: "ai-actions",
        icon: "iconSparkles",
        label: siyuanI18n.ai,
        accelerator: getSiyuanConfig().keymap.editor.general.ai.custom,
        /**
         * 作用：打开原AI操作菜单
         * 意图：触发思源笔记内置的AI功能菜单
         * 调用时机：用户点击"AI"菜单项时
         */
        click() {
            openAIActionsMenu([nodeElement], protyle);
            return true;
        }
    };

    // 检查是否有 ModelScope 配置
    const sforgeConfigs = getSForgeConfigs();
    const authManager = sforgeConfigs.ai.modelScope.auth;

    // 异步检查配置并构建菜单
    return {
        id: "ai",
        protyle: {standalone: false, requires: ["ai"]},
        icon: "iconSparkles",
        label: siyuanI18n.ai,
        submenu: [
            原AI菜单项,
            {
                id: "ai-generate-image",
                icon: "iconImage",
                label: "使用块内容生成图片",
                /**
                 * 作用：触发AI图片生成流程
                 * 意图：使用当前块的文本内容作为prompt生成图片并插入
                 * 调用时机：用户点击"使用块内容生成图片"菜单项时
                 */
                click() {
                    handleAiImageGeneration(nodeElement, protyle, authManager, AiImageGenerationProgress);
                    return true;
                }
            }
        ]
    };
}

/**
 * 构建多块选择时的 AI 菜单项
 * 供 buildMultipleAppearanceMenu 调用，保持子菜单结构一致性
 *
 * @param protyle - Protyle 实例
 * @param selectsElement - 选中的块元素数组
 * @returns AI 菜单项配置，如果不应显示则返回 null
 */
/** @同步豁免: UI构建 - 菜单构建函数必须同步返回IMenu配置对象，调用方期望立即获得菜单结构用于渲染 */
export function buildMultiAiMenu(protyle: IProtyle, selectsElement: Element[]): IMenu | null {
    if (protyle.disabled) {
        return null;
    }

    const 原AI菜单项 = {
        id: "ai-actions",
        icon: "iconSparkles",
        label: siyuanI18n.ai,
        accelerator: getSiyuanConfig().keymap.editor.general.ai.custom,
        /**
         * 作用：打开原AI操作菜单（多块模式）
         * 意图：触发思源笔记内置的AI功能菜单，处理多个选中的块
         * 调用时机：用户在多块选择状态下点击"AI"菜单项时
         */
        click() {
            openAIActionsMenu(selectsElement, protyle);
            return true;
        }
    };

    // 多块时只显示原 AI 菜单，不显示图片生成（需要单块场景）
    return {
        id: "ai",
        protyle: {standalone: false, requires: ["ai"]},
        icon: "iconSparkles",
        label: siyuanI18n.ai,
        submenu: [原AI菜单项]
    };
}
