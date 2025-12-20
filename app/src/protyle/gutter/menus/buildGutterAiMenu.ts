/**
 * 构建 Gutter AI 菜单项
 * 从 renderMenu 中拆分出来的 AI 操作菜单
 */

import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { openAIActionsMenu } from "../../../ai/actions";
import { getSForgeConfigs } from "../../../config/sforge";
import { 生成块内容图片 } from "./generateBlockImage";
import { createApp, App } from "vue";
import { Dialog } from "../../../dialog";
import AiImageGenerationProgress from "./AiImageGenerationProgress.vue";
import { ProfileManager } from "../../../config/profileManager";

/**
 * 构建 Gutter AI 菜单项的上下文参数
 */
interface IGutterAiMenuContext {
    protyle: IProtyle;
    nodeElement: Element;
}

/**
 * 获取块的文本内容
 */
function 获取块文本内容(nodeElement: Element): string {
    // 获取块内的纯文本内容
    const editableElement = nodeElement.querySelector("[contenteditable]");
    if (editableElement) {
        return editableElement.textContent || "";
    }
    return nodeElement.textContent || "";
}

/**
 * 处理 AI 图片生成逻辑
 */
async function handleAiImageGeneration(
    nodeElement: Element,
    protyle: IProtyle,
    authManager: ProfileManager
) {
    const blockText = 获取块文本内容(nodeElement);
    if (!blockText.trim()) {
        // TODO: 显示提示信息
        console.warn("块内容为空，无法生成图片");
        return;
    }

    let vueApp: App<Element> | null = null;
    const dialog = new Dialog({
        title: "AI 图片生成",
        content: `<div class="ai-image-generation-container" style="height: 100%;"></div>`,
        width: "500px",
        destroyCallback: () => {
            if (vueApp) {
                vueApp.unmount();
            }
        }
    });

    const container = dialog.element.querySelector(".ai-image-generation-container");
    if (!container) return; // Should not happen

    vueApp = createApp(AiImageGenerationProgress);
    const vm = vueApp.mount(container) as any; // Vue instance type is complex, any is acceptable here for updateStatus

    await 生成块内容图片({
        prompt: blockText,
        protyle,
        nodeElement,
        authManager,
        onProgress: (msg: string) => {
            if (vm && vm.updateStatus) {
                vm.updateStatus(msg);
            }
        }
    });

    if (vm && vm.updateStatus) {
        vm.updateStatus("生成完成", false);
    }
    // 延迟关闭，让用户看到完成状态
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
export function buildGutterAiMenu(context: IGutterAiMenuContext): IMenu | null {
    const { protyle, nodeElement } = context;

    // 禁用状态或分割线不显示 AI 菜单
    if (protyle.disabled || nodeElement.classList.contains("hr")) {
        return null;
    }

    const 原AI菜单项: IMenu = {
        id: "ai-actions",
        icon: "iconSparkles",
        label: siyuanI18n.ai,
        accelerator: getSiyuanConfig().keymap.editor.general.ai.custom,
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
        icon: "iconSparkles",
        label: siyuanI18n.ai,
        submenu: [
            原AI菜单项,
            {
                id: "ai-generate-image",
                icon: "iconImage",
                label: "使用块内容生成图片",
                click() {
                    handleAiImageGeneration(nodeElement, protyle, authManager);
                    // click needs to be a MouseEvent handler or similar if expected, but here it's IMenu click
                    return true;
                }
            }
        ]
    };
}
