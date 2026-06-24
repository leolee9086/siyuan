/**
 * cronjob.util.ts - 定时任务面板工具函数
 */

import type { 任务运行时信息, 任务状态类型 } from "../../util/network/types";

/**
 * 生成面板 HTML 结构
 */
export const 生成面板HTML = (): string => {
    return `
        <div class="block__icons">
            <span class="block__icon block__icon--show" data-type="min">
                <svg><use xlink:href="#iconMin"></use></svg>
            </span>
            <span class="fn__space"></span>
            <span class="block__icon--text">定时任务</span>
            <span class="fn__flex-1"></span>
            <span class="block__icon block__icon--show" data-type="refresh" aria-label="刷新">
                <svg><use xlink:href="#iconRefresh"></use></svg>
            </span>
        </div>
        <div class="cronjob-list fn__flex-1"></div>
    `;
};

/**
 * 获取状态对应的图标
 */
export const 获取状态图标 = (status: 任务状态类型): string => {
    switch (status) {
        case "running":
            return "▶";
        case "paused":
            return "⏸";
        case "error":
            return "⚠";
        default:
            return "○";
    }
};

/**
 * 获取状态对应的文本
 */
export const 获取状态文本 = (status: 任务状态类型): string => {
    switch (status) {
        case "running":
            return "运行中";
        case "paused":
            return "已暂停";
        case "error":
            return "出错";
        default:
            return "未运行";
    }
};

/**
 * 格式化相对时间
 * @param timestamp - 时间戳 (秒)
 */
export const 格式化相对时间 = (timestamp: number): string => {
    if (!timestamp || timestamp === 0) {
        return "从未";
    }

    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) {
        return "刚刚";
    }
    if (diff < 3600) {
        return `${Math.floor(diff / 60)}分钟前`;
    }
    if (diff < 86400) {
        return `${Math.floor(diff / 3600)}小时前`;
    }
    return `${Math.floor(diff / 86400)}天前`;
};

/**
 * 生成单个任务项 HTML
 */
export const 生成任务项HTML = (task: 任务运行时信息): string => {
    const isRunning = task.status === "running";
    const toggleLabel = isRunning ? "停止" : "启动";
    const statusClass = `cronjob-item__state--${task.status}`;

    return `
        <div class="cronjob-item" data-doc-id="${task.docId}">
            <div class="cronjob-item__header">
                <span class="cronjob-item__status">${获取状态图标(task.status)}</span>
                <a class="cronjob-item__name cronjob-action" href="javascript:void(0)" 
                   data-doc-id="${task.docId}" data-action="open" 
                   title="${task.description || task.name}&#10;点击打开定义文档">
                    ${task.name || "未命名任务"}
                </a>
                <span class="cronjob-item__state ${statusClass}">
                    ${获取状态文本(task.status)}
                </span>
            </div>
            <div class="cronjob-item__info">
                ${task.schedule || "无调度"} | 上次: ${格式化相对时间(task.lastRun)}
                ${task.runCount > 0 ? ` | 运行${task.runCount}次` : ""}
            </div>
            ${task.lastError ? `<div class="cronjob-item__error" title="${task.lastError}">错误: ${task.lastError.substring(0, 50)}...</div>` : ""}
            <div class="cronjob-item__actions">
                <button class="b3-button b3-button--small cronjob-action" data-doc-id="${task.docId}" data-action="toggle">
                    ${toggleLabel}
                </button>
                <button class="b3-button b3-button--small cronjob-action" data-doc-id="${task.docId}" data-action="run">
                    运行
                </button>
                <button class="b3-button b3-button--small cronjob-action" data-doc-id="${task.docId}" data-action="logs">
                    日志
                </button>
            </div>
        </div>
    `;
};

/**
 * 生成任务列表 HTML
 */
export const 生成任务列表HTML = (tasks: 任务运行时信息[]): string => {
    return tasks.map(task => 生成任务项HTML(task)).join("");
};

// 英文别名导出
export const generatePanelHTML = 生成面板HTML;
export const getStatusIcon = 获取状态图标;
export const getStatusText = 获取状态文本;
export const formatRelativeTime = 格式化相对时间;
export const generateTaskItemHTML = 生成任务项HTML;
export const generateTaskListHTML = 生成任务列表HTML;
