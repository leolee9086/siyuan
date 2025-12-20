/**
 * 使用块内容生成图片
 * 
 * 基于 ModelScope 文生图 API 实现
 */

import {
    提交生成任务,
    轮询任务直到完成,
    获取图片,
    提取图片URL
} from "../../../apis/modelscope/client";
import type { ModelScopeAuthData } from "../../../apis/modelscope/types";
import type { 生成块内容图片参数 } from "../gutter.types";
import { showMessage } from "../../../dialog/message";

// 导出类型供外部使用
export type { 生成块内容图片参数 } from "../gutter.types";

/**
 * 创建进度报告器
 * 
 * @param onProgress - 可选的进度回调函数
 * @returns 进度报告函数
 */
function 创建进度报告器(onProgress?: (msg: string) => void): (msg: string) => void {
    return (msg: string) => {
        if (onProgress) onProgress(msg);
        console.log(`[生成块内容图片] ${msg}`);
    };
}

/**
 * @AIDONE 插入到块后的行为已改为 onComplete 回调,由调用方决定如何处理生成的图片
 * 使用块内容生成图片
 */
export async function 生成块内容图片(params: 生成块内容图片参数): Promise<void> {
    const { prompt, authManager, onProgress, onComplete } = params;

    const reportProgress = 创建进度报告器(onProgress);

    try {
        // 获取当前激活的配置
        const activeId = await authManager.getActiveProfileId();
        if (!activeId) {
            // @AIDONE: 显示提示对话框
            showMessage("未配置 ModelScope API Token，请先在设置中配置", 5000, "error");
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
        reportProgress("图片生成成功");

        // 5. 通过回调将结果传递给调用方处理
        if (onComplete) {
            await onComplete(base64Data);
        }

    } catch (error) {
        console.error("[生成块内容图片] 生成失败:", error);
        reportProgress("[异常] " + error);
    }
}
