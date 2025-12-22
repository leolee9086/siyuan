/**
 * 构建 Gutter AI 菜单项
 * 从 renderMenu 中拆分出来的 AI 操作菜单
 * @AIDONE 
 * 1.多块时通过 buildMultiAiMenu 支持子菜单结构
 * 2.使用 SQL 查询 content 字段获取纯文本替代 kramdown
 * 3.添加丰富的进度提示内容
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
import { isProgressStatusUpdater } from "../gutter.guard";

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
 * 获取块的纯文本内容（通过 getDOMText 接口）
 * 使用块元素的 DOM 直接提取纯文本，性能优于 SQL 查询且不会截断
 * @param nodeElement - 块元素
 * @returns 块的完整纯文本内容，如果失败则返回空字符串
 */
async function 获取块文本内容(nodeElement: Element): Promise<string> {
    const dom = nodeElement.outerHTML;
    return new Promise((resolve) => {
        // @内联回调 - 使用 getDOMText 从 DOM 提取纯文本
        fetchPost("/api/block/getDOMText", { dom }, (response) => {
            if (response.code !== 0) {
                console.error("获取块内容失败:", response.msg);
                resolve("");
                return;
            }
            resolve(response.data || "");
        });
    });
}

/**
 * 创建进度对话框并挂载 Vue 组件
 * @returns 对话框实例、Vue 应用实例和状态更新器，失败返回 null
 */
function 创建进度对话框(ProgressComponent: ReturnType<typeof import("vue").defineComponent>): { dialog: Dialog; vueApp: App<Element>; vm: IProgressStatusUpdater } | null {
    let vueApp: App<Element> | null = null;
    const dialog = new Dialog({
        title: "AI 图片生成",
        content: "<div class=\"ai-image-generation-container\" style=\"height: 100%;\"></div>",
        width: "500px",
        destroyCallback: () => {
            vueApp?.unmount();
        }
    });

    const container = dialog.element.querySelector(".ai-image-generation-container");
    if (!container) {
        return null;
    }

    vueApp = createApp(ProgressComponent);
    const mountedInstance = vueApp.mount(container);

    if (!isProgressStatusUpdater(mountedInstance)) {
        console.error("挂载的组件不符合 IProgressStatusUpdater 接口");
        dialog.destroy();
        return null;
    }

    return { dialog, vueApp, vm: mountedInstance };
}

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
        onProgress: (msg: string) => vm.updateStatus?.(msg, true),
        onComplete: async (base64Data: string) => {
            await 插入图片到块后(nodeElement, base64Data, (msg: string, isLoading?: boolean) => vm.updateStatus?.(msg, isLoading ?? true));
        }
    });

    vm.updateStatus?.("生成完成", false);
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
                    handleAiImageGeneration(nodeElement, protyle, authManager, AiImageGenerationProgress);
                    // click needs to be a MouseEvent handler or similar if expected, but here it's IMenu click
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
export function buildMultiAiMenu(protyle: IProtyle, selectsElement: Element[]): IMenu | null {
    if (protyle.disabled) {
        return null;
    }

    const 原AI菜单项: IMenu = {
        id: "ai-actions",
        icon: "iconSparkles",
        label: siyuanI18n.ai,
        accelerator: getSiyuanConfig().keymap.editor.general.ai.custom,
        click() {
            openAIActionsMenu(selectsElement, protyle);
            return true;
        }
    };

    // 多块时只显示原 AI 菜单，不显示图片生成（需要单块场景）
    return {
        id: "ai",
        icon: "iconSparkles",
        label: siyuanI18n.ai,
        submenu: [原AI菜单项]
    };
}
