/**
 * 使用块内容生成图片
 *
 * 基于 ModelScope 文生图 API 实现
 */

/**
 * 用途：提交ModelScope文生图任务
 * 使用范围：生成块内容图片流程的第一步
 * 解耦评估：通过imports.ts转发，已实现模块边界隔离
 */
import { 提交生成任务 } from "./imports";

/**
 * 用途：轮询ModelScope任务状态直到完成
 * 使用范围：生成块内容图片流程的第二步
 * 解耦评估：通过imports.ts转发，已实现模块边界隔离
 */
import { 轮询任务直到完成 } from "./imports";

/**
 * 用途：获取生成的图片数据
 * 使用范围：生成块内容图片流程的第三步
 * 解耦评估：通过imports.ts转发，已实现模块边界隔离
 */
import { 获取图片 } from "./imports";

/**
 * 用途：从ModelScope响应中提取图片URL
 * 使用范围：生成块内容图片流程的结果解析
 * 解耦评估：通过imports.ts转发，已实现模块边界隔离
 */
import { 提取图片URL } from "./imports";

/**
 * 用途：ModelScope认证数据类型
 * 使用范围：函数内部获取API Token的类型约束
 * 解耦评估：类型定义，通过imports.ts转发
 */
import type { ModelScopeAuthData } from "./imports";

/**
 * 用途：生成块内容图片的参数类型
 * 使用范围：主函数参数类型约束
 * 解耦评估：类型定义，通过imports.ts转发
 */
import type { 生成块内容图片参数 } from "./imports";

/**
 * 用途：显示错误提示消息
 * 使用范围：未配置API Token时的用户提示
 * 解耦评估：通过imports.ts转发，已实现模块边界隔离
 */
import { showMessage } from "./imports";

// 导出类型供外部使用
export type { 生成块内容图片参数 };

/**
 * 创建进度报告器
 * 
 * @param onProgress - 可选的进度回调函数
 * @returns 进度报告函数
 */
function 创建进度报告器(onProgress?: (msg: string) => void) {
    return (msg: string) => {
        if (onProgress) {
            onProgress(msg);
        }
        console.log(`[生成块内容图片] ${msg}`);
    };
}

/**
 * @AIDONE 插入到块后的行为已改为 onComplete 回调,由调用方决定如何处理生成的图片
 * 使用块内容生成图片
 * @显式返回类型原因: 异步函数作为公开导出 API，Promise<void> 显式标注确保调用方不会遗漏 await，同时作为契约文档供 IDE 类型提示。
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
        // 验证配置有效性：profile为null表示配置文件损坏，data?.apiToken为空表示用户未填写Token
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

        // 检查任务是否成功：ModelScope API返回的task_status为"SUCCEED"表示成功，其他状态（如FAILED、TIMEOUT）表示失败
        if (status.task_status !== "SUCCEED") {
            console.error("[生成块内容图片] 任务失败:", status.error);
            reportProgress("[任务失败] " + status.error);
            return;
        }

        // 3. 提取图片 URL
        const imageUrl = await 提取图片URL(status);
        if (!imageUrl) {
            console.error("[生成块内容图片] 未获取到图片 URL");
            return;
        }

        // 4. 获取图片 Base64
        const base64Data = await 获取图片({imageUrl});
        if (!base64Data) {
            console.error("[生成块内容图片] 未获取到图片数据");
            return;
        }
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
