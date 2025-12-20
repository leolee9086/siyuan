/**
 * 使用块内容生成图片
 * 
 * 基于 ModelScope 文生图 API 实现
 */

import { ProfileManager } from "../../../config/profileManager";
import { fetchPost } from "../../../util/fetch";
import { Constants } from "../../../constants";
import { genAssetHTML } from "../../../asset/renderAssets";
import * as dayjs from "dayjs";
import {
    提交生成任务,
    轮询任务直到完成,
    获取图片,
    提取图片URL
} from "../../../apis/modelscope/client";

/**
 * 生成图片的参数
 */
export interface 生成块内容图片参数 {
    /** 提示词（块内容） */
    prompt: string;
    /** Protyle 实例 */
    protyle: IProtyle;
    /** 当前块元素 */
    nodeElement: Element;
    /** Auth 配置管理器 */
    authManager: ProfileManager;
    /** 进度回调 */
    onProgress?: (msg: string) => void;
}

/**
 * ModelScope Auth 配置数据结构
 */
interface ModelScopeAuthData {
    apiToken: string;
}

/**
 * 使用块内容生成图片
 */
export async function 生成块内容图片(params: 生成块内容图片参数): Promise<void> {
    const { prompt, nodeElement, authManager, onProgress } = params;

    const reportProgress = (msg: string) => {
        if (onProgress) onProgress(msg);
        console.log(`[生成块内容图片] ${msg}`);
    };

    try {
        // 获取当前激活的配置
        const activeId = await authManager.getActiveProfileId();
        if (!activeId) {
            console.error("未配置 ModelScope API Token，请先在设置中配置");
            // TODO: 显示提示对话框
            return;
        }

        const profile = await authManager.loadProfile<ModelScopeAuthData>(activeId);
        if (!profile || !profile.data?.apiToken) {
            console.error("配置无效或缺少 API Token");
            return;
        }

        const apiToken = profile.data.apiToken;

        reportProgress("开始生成，提示词: " + prompt.substring(0, 50) + "...");

        // 1. 提交生成任务
        const taskId = await 提交生成任务({
            apiToken,
            prompt
        });
        reportProgress("任务已提交, 正在生成中...");

        // 2. 轮询等待任务完成
        const status = await 轮询任务直到完成({
            apiToken,
            taskId
        });

        if (status.task_status !== "SUCCEED") {
            console.error("[生成块内容图片] 任务失败:", status.error);
            reportProgress("[任务失败] " + status.error);
            return;
        }

        // 3. 提取图片 URL
        const imageUrl = 提取图片URL(status);
        if (!imageUrl) {
            console.error("[生成块内容图片] 未获取到图片 URL");
            return;
        }

        // 4. 获取图片 Base64
        const base64Data = await 获取图片({ imageUrl });
        reportProgress("图片生成成功，正在上传...");

        // 5. 在块后插入图片
        await 插入图片到块后(nodeElement, base64Data, reportProgress);

    } catch (error) {
        console.error("[生成块内容图片] 生成失败:", error);
        reportProgress("[异常] " + error);
    }
}

/**
 * 上传图片
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
 * 插入段落
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
    reportProgress: (msg: string) => void
): Promise<void> {
    // 获取块 ID
    const blockId = nodeElement.getAttribute("data-node-id");
    if (!blockId) {
        console.error("无法获取块 ID");
        return;
    }

    // 1. 将 base64 转换为 Blob
    const response = await fetch(base64Data);
    const blob = await response.blob();

    // 2. 上传图片
    const timestamp = Date.now();
    const imageName = `ai-generated-${timestamp}.png`;

    const uploadResult = await 上传图片(blob, imageName);
    if (!uploadResult.success || !uploadResult.path) {
        console.error("[插入图片] 上传失败:", uploadResult.msg);
        reportProgress("[上传失败] " + uploadResult.msg);
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
        reportProgress("[插入失败] " + insertResult.msg);
        return;
    }
    reportProgress("图片插入成功");
}
