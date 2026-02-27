/**
 * CronJob 鉴权对话框模块
 * 
 * 作用：处理后端发送的 CronJob 鉴权请求，显示确认对话框供用户授权
 * 意图：在定时任务首次调用敏感 API 时需要用户确认，避免恶意脚本执行
 * 调用时机：由 processMessage.ts 在收到 cronjob_auth_request WebSocket 消息时调用
 */

import { confirmDialog } from "../../dialog/confirmDialog";
import { getSiyuanWebSocket } from "../siyuanEnvironments/getSiyuanConfig.environment";
import type { ICronjobAuthRequest } from "./cronjob.types";

/**
 * 处理 CronJob 鉴权请求
 * 
 * 作用：显示确认对话框，让用户决定是否授权任务执行
 * 意图：提供安全的交互式鉴权机制，防止未授权的 API 调用
 * 调用时机：由 processMessage.ts 在收到 cronjob_auth_request 消息时调用
 * 
 * @param data - 鉴权请求数据，包含 reqId、docId、taskName 和 reason
 */
export const handleCronjobAuthRequest = (data: ICronjobAuthRequest): void => {
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

    confirmDialog(
        "定时任务授权",
        dialogContent,
        () => {
            // 用户点击允许
            sendAuthResponse(reqId, true);
        },
        () => {
            // 用户点击拒绝
            sendAuthResponse(reqId, false);
        }
    );
};

/**
 * 发送鉴权响应到后端
 * 
 * 作用：通过 WebSocket 向内核发送用户的授权决定
 * 意图：将用户的允许/拒绝决定传回内核，以便内核继续或中止任务
 * 调用时机：在确认对话框的回调函数中调用
 * 
 * @param reqId - 请求唯一标识，用于匹配后端的等待通道
 * @param allow - 用户是否允许授权
 */
const sendAuthResponse = (reqId: string, allow: boolean): void => {
    const siyuanWs = getSiyuanWebSocket();
    const ws = siyuanWs?.ws;
    if (ws) {
        ws.send(JSON.stringify({
            cmd: "cronjob_auth_response",
            reqId: Date.now(),
            param: {
                reqId,
                allow
            }
        }));
    }
};

/**
 * HTML 转义工具函数
 * 
 * @简洁函数 简单的 XSS 防护工具，将文本内容转义为安全的 HTML
 * @param text - 需要转义的文本
 * @returns 转义后的 HTML 安全字符串
 */
const escapeHtml = (text: string): string => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
};
