/**
 * AI图片生成辅助函数
 * 包含图片上传、块插入、文本获取等功能
 */

/**
 * 用途：HTTP POST请求
 * 使用范围：上传图片、插入块、获取块文本
 * 解耦评估：通过imports.ts统一管理
 */
import { fetchPost } from "./imports";
/**
 * 用途：系统常量
 * 使用范围：上传地址等
 * 解耦评估：通过imports.ts统一管理
 */
import { Constants } from "./imports";
/**
 * 用途：生成资源HTML
 * 使用范围：插入图片时生成img标签
 * 解耦评估：通过imports.ts统一管理
 */
import { genAssetHTML } from "./imports";
/**
 * 用途：日期时间格式化
 * 使用范围：生成块更新时间戳
 * 解耦评估：通过imports.ts统一管理
 */
import { dayjs } from "./imports";
/**
 * 用途：创建Vue应用实例
 * 使用范围：进度对话框组件挂载
 * 解耦评估：通过imports.ts统一管理
 */
import { createApp } from "./imports";
/**
 * 用途：Vue应用类型
 * 使用范围：进度对话框函数返回值类型
 * 解耦评估：通过imports.ts统一管理
 */
import type { App } from "./imports";
/**
 * 用途：创建模态对话框
 * 使用范围：AI图片生成进度显示
 * 解耦评估：通过imports.ts统一管理
 */
import { Dialog } from "./imports";
/**
 * 用途：进度状态更新器接口
 * 使用范围：进度对话框组件类型约束
 * 解耦评估：通过imports.ts统一管理
 */
import type { IProgressStatusUpdater } from "./imports";
/**
 * 用途：类型守卫函数
 * 使用范围：进度对话框创建后的类型检查
 * 解耦评估：通过imports.ts统一管理
 */
import { isProgressStatusUpdater } from "./imports";

/**
 * 上传图片到资源系统
 */
export async function 上传图片(blob: Blob, imageName: string) {
    const formData = new FormData();
    formData.append("file[]", blob, imageName);

    return new Promise((resolve) => {
        // @内联回调
        fetchPost(Constants.UPLOAD_ADDRESS, formData, (uploadResponse) => {
            // 检查上传响应：code !== 0 表示上传失败（服务器返回错误）
            // 此时需要将失败信息返回给调用方，中止后续流程
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
export async function 插入段落(previousID: string, paragraphHtml: string) {
    return new Promise((resolve) => {
        // @内联回调
        fetchPost("/api/block/insertBlock", {
            dataType: "dom",
            data: paragraphHtml,
            previousID
        }, (insertResponse) => {
            // 检查插入响应：code !== 0 表示插入块失败（API返回错误）
            // 此时需要将失败信息返回给调用方，中止后续流程
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
export async function 插入图片到块后(
    nodeElement: Element,
    base64Data: string,
    reportProgress: (msg: string, isLoading?: boolean) => void
) {
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
    // 检查上传结果：当上传失败(success=false)或路径缺失时中止流程
    // 即使 success 为 true，path 也可能为空(如服务器响应异常)，必须同时验证两者才能安全插入图片
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
export async function 获取块文本内容(nodeElement: Element) {
    const dom = nodeElement.outerHTML;
    return new Promise((resolve) => {
        // @内联回调 - 使用 getDOMText 从 DOM 提取纯文本
        fetchPost("/api/block/getDOMText", { dom }, (response) => {
            // 检查API响应：code !== 0 表示获取文本失败（API返回错误）
            // 此时返回空字符串，避免后续流程因内容缺失而中断
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
 * @同步豁免: UI构建 - 对话框创建和Vue组件挂载必须同步完成，确保UI立即可用
 */
export function 创建进度对话框(ProgressComponent: ReturnType<typeof import("vue").defineComponent>) {
    let vueApp: App<Element> | null = null;
    const dialog = new Dialog({
        title: "AI 图片生成",
        content: "<div class=\"ai-image-generation-container\" style=\"height: 100%;\"></div>",
        width: "500px",
        /**
         * 作用：对话框销毁时卸载Vue应用
         * 意图：防止内存泄漏，确保Vue组件正确清理
         * 调用时机：用户关闭对话框或对话框被程序销毁时
         */
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

    // 类型守卫检查：验证挂载的组件是否实现了IProgressStatusUpdater接口
    // 如果组件缺少updateStatus方法，说明传入了错误的组件，需要销毁对话框并返回null
    if (!isProgressStatusUpdater(mountedInstance)) {
        console.error("挂载的组件不符合 IProgressStatusUpdater 接口");
        dialog.destroy();
        return null;
    }

    return { dialog, vueApp, vm: mountedInstance };
}
