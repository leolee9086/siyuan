/**
 * 嵌入 Dock 工具函数
 */

import type { IEmbeddingDataset } from "./embeddingDock.types";

/**
 * 生成唯一 ID
 */
export const 生成ID = (): string => {
    return `ds_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
};
export const generateId = 生成ID;

/**
 * 获取数据集类型图标
 */
export const 获取类型图标 = (type: "dynamic" | "static"): string => {
    return type === "dynamic" ? "iconSQL" : "iconList";
};
export const getTypeIcon = 获取类型图标;

/**
 * 格式化时间
 */
export const 格式化时间 = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;

    if (diff < 60000) {
        return "刚刚";
    }
    if (diff < 3600000) {
        return `${Math.floor(diff / 60000)} 分钟前`;
    }
    if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)} 小时前`;
    }
    return date.toLocaleDateString();
};
export const formatTime = 格式化时间;

/**
 * 验证数据集配置
 */
export const 验证配置 = (dataset: Partial<IEmbeddingDataset>): string | null => {
    if (!dataset.title?.trim()) {
        return "标题不能为空";
    }
    if (dataset.type === "dynamic" && !dataset.target) {
        return "动态数据集需要配置 SQL 查询";
    }
    if (dataset.type === "static" && (!Array.isArray(dataset.target) || dataset.target.length === 0)) {
        return "静态数据集需要至少一个块 ID";
    }
    return null;
};
export const validateConfig = 验证配置;
