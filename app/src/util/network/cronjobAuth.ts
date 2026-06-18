/**
 * CronJob 鉴权对话框模块
 * 
 * 作用：处理后端发送的 CronJob 鉴权请求，显示确认对话框供用户授权
 * 意图：在定时任务首次调用敏感 API 时需要用户确认，避免恶意脚本执行
 * 调用时机：由 processMessage.ts 在收到 cronjob_auth_request WebSocket 消息时调用
 */

/**
 * 用途：导入依赖注入接口类型，用于约束 handleCronjobAuthRequest 函数的 deps 参数结构
 * 使用范围：仅在本模块的 handleCronjobAuthRequest 函数的 deps 参数类型声明中使用，边界为本文件内的类型约束
 * 解耦评估：无法通过依赖注入或参数传递替代，类型导入必须直接导入以提供编译时类型检查
 */
import type { ICronjobAuthDependencies } from "./types";

/**
 * 用途：导入鉴权请求数据类型，用于约束 handleCronjobAuthRequest 函数的 data 参数结构
 * 使用范围：仅在本模块的 handleCronjobAuthRequest 函数的 data 参数类型声明中使用，边界为本文件内的类型约束
 * 解耦评估：无法通过依赖注入或参数传递替代，类型导入必须直接导入以提供编译时类型检查
 */
import type { ICronjobAuthRequest } from "./types";

/**
 * 处理 CronJob 鉴权请求
 *
 * 作用：显示确认对话框，让用户决定是否授权任务执行
 * 意图：提供安全的交互式鉴权机制，防止未授权的 API 调用
 * 调用时机：由 processMessage.ts 在收到 cronjob_auth_request 消息时调用
 *
 * @同步豁免: UI构建 - 必须同步调用 confirmDialog 以立即显示对话框，异步会导致用户交互延迟
 * @param data - 鉴权请求数据，包含 reqId、docId、taskName 和 reason
 * @param deps - 必须注入的依赖端口（confirmDialog + sendAuthResponse）
 */
export const handleCronjobAuthRequest = (data: ICronjobAuthRequest, deps: ICronjobAuthDependencies) => {
    const { reqId, docId, taskName, reason } = data;

    const dialogContent = `
        <div class="b3-dialog__content">
            <div class="fn__flex-column" style="gap: 12px;">
                <div class="b3-label">
                    <div class="fn__flex">
                        <span class="b3-label__icon">
                            <svg><use xlink:href="#iconLock"></use></svg>
                        </span>
                        <span style="font-weight: 600; font-size: 16px;">定时任务授权请求</span>
                    </div>
                </div>
                <div class="b3-label" style="padding: 8px; background: var(--b3-theme-background-light); border-radius: 4px;">
                    <div style="margin-bottom: 4px;"><b>任务名称：</b>${escapeHtml(taskName)}</div>
                    <div style="margin-bottom: 4px;"><b>文档 ID：</b><code>${escapeHtml(docId)}</code></div>
                    <div><b>请求原因：</b>${escapeHtml(reason)}</div>
                </div>
                <div class="b3-label__text" style="color: var(--b3-theme-on-surface-light);">
                    允许此任务将使其能够调用思源内核 API。本次授权仅在内核重启前有效。
                </div>
            </div>
        </div>
    `;

    deps.confirmDialog(
        "定时任务授权",
        dialogContent,
        () => {
            // 用户点击允许
            deps.sendAuthResponse(reqId, true);
        },
        () => {
            // 用户点击拒绝
            deps.sendAuthResponse(reqId, false);
        }
    );
};

/**
 * HTML 转义工具函数
 * 
 * @简洁函数 简单的 XSS 防护工具，将文本内容转义为安全的 HTML
 * @param text - 需要转义的文本
 * @returns 转义后的 HTML 安全字符串
 */
const escapeHtml = (text: string) => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
};
