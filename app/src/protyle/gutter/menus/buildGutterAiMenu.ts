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
import { fetchPost } from "../../../util/fetch";
import { Constants } from "../../../constants";
import { genAssetHTML } from "../../../asset/renderAssets";
import * as dayjs from "dayjs";
import type { IGutterEditMenuContext, IProgressStatusUpdater } from "../gutter.types";


/**
 * 上传图片到资源系统
 */
async function 上传图片(blob: Blob, imageName: string): Promise<{ success: boolean; msg: string; path?: string }> {
    const formData = new FormData();
    formData.append("file[]", blob, imageName);

    return new Promise((resolve) => {
        // @内联回调
        fetchPost(Constants.UPLOAD_ADDRESS, formData, (uploadResponse) => {
            if (uploadResponse.code !== 0) {
                resolve({ success: false, msg: uploadResponse.msg });
                return;
            }
            const assetPath = uploadResponse.data.succMap[imageName];
            resolve({ success: true, msg: "success", path: assetPath });
        });
    });
}

/**
 * 插入段落到指定块后面
 */
async function 插入段落(previousID: string, paragraphHtml: string): Promise<{ success: boolean; msg: string }> {
    return new Promise((resolve) => {
        // @内联回调
        fetchPost("/api/block/insertBlock", {
            dataType: "dom",
            data: paragraphHtml,
            previousID
        }, (insertResponse) => {
            if (insertResponse.code !== 0) {
                resolve({ success: false, msg: insertResponse.msg });
                return;
            }
            resolve({ success: true, msg: "success" });
        });
    });
}

/**
 * 在当前块后插入图片
 * 
 * 流程：先将 base64 图片上传到资源系统，再使用资源路径插入块
 */
async function 插入图片到块后(
    nodeElement: Element,
    base64Data: string,
    reportProgress: (msg: string, isLoading?: boolean) => void
): Promise<void> {
    // 获取块 ID
    const blockId = nodeElement.getAttribute("data-node-id");
    if (!blockId) {
        console.error("无法获取块 ID");
        return;
    }

    reportProgress("正在上传图片...");

    // 1. 将 base64 转换为 Blob
    const response = await fetch(base64Data);
    const blob = await response.blob();

    // 2. 上传图片
    const timestamp = Date.now();
    const imageName = `ai-generated-${timestamp}.png`;

    const uploadResult = await 上传图片(blob, imageName);
    if (!uploadResult.success || !uploadResult.path) {
        console.error("[插入图片] 上传失败:", uploadResult.msg);
        reportProgress("[上传失败] " + uploadResult.msg, false);
        return;
    }

    reportProgress("图片上传成功, 正在插入文档...");

    // 3. 生成新块 ID 和时间戳
    const newBlockId = Lute.NewNodeID();
    const updateTime = dayjs().format("YYYYMMDDHHmmss");

    // 4. 使用正确的图片 DOM 结构
    const imgName = `ai-generated-${timestamp}`;
    const imgHtml = genAssetHTML(".png", uploadResult.path, imgName, imageName);
    const paragraphHtml = `<div data-node-id="${newBlockId}" data-type="NodeParagraph" class="p" updated="${updateTime}"><div contenteditable="true" spellcheck="false">${imgHtml}</div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;

    // 5. 使用思源 API 插入新段落到当前块后面
    const insertResult = await 插入段落(blockId, paragraphHtml);
    if (!insertResult.success) {
        console.error("[插入图片] 插入失败:", insertResult.msg);
        reportProgress("[插入失败] " + insertResult.msg, false);
        return;
    }
    reportProgress("图片插入成功");
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
 * 安全更新 Vue 组件的状态
 * @param vm - Vue 组件实例
 * @param msg - 状态消息
 * @param isLoading - 是否显示加载状态
 */
function safeUpdateStatus(vm: IProgressStatusUpdater, msg: string, isLoading = true) {
    vm?.updateStatus?.(msg, isLoading);
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
        content: "<div class=\"ai-image-generation-container\" style=\"height: 100%;\"></div>",
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
    const vm = vueApp.mount(container) as unknown as IProgressStatusUpdater;

    await 生成块内容图片({
        prompt: blockText,
        protyle,
        nodeElement,
        authManager,
        onProgress: (msg: string) => safeUpdateStatus(vm, msg),
        onComplete: async (base64Data: string) => {
            await 插入图片到块后(nodeElement, base64Data, (msg: string, isLoading?: boolean) => safeUpdateStatus(vm, msg, isLoading ?? true));
        }
    });

    safeUpdateStatus(vm, "生成完成", false);
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
export function buildGutterAiMenu(context: IGutterEditMenuContext): IMenu | null {
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
