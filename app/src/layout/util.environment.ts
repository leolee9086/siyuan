/**
 * @fileoverview util.ts 环境封装
 * 封装所有 window 访问以符合 no-restricted-globals 规则
 * @同步豁免: 遗留代码 - 从原始 util.ts 迁移，保持原有行为以确保兼容性
 */

import type {LayoutDomain, LayoutWindow} from "./layout.types";

// ============ 思源核心对象访问 ============

/** @同步豁免: UI构建 - 需要同步访问布局对象 */
export const getSiyuanLayout = () => window.siyuan?.layout;

/** @同步豁免: UI构建 - 需要同步访问配置对象 */
export const getSiyuanConfig = () => window.siyuan?.config;

/** @同步豁免: UI构建 - 需要同步访问语言对象 */
export const getSiyuanLanguages = () => window.siyuan?.languages;

/** @同步豁免: UI构建 - 需要同步访问 storage 对象 */
export const getSiyuanStorage = () => window.siyuan?.storage;

/** @同步豁免: UI构建 - 获取中央布局 */
export const getCenterLayout = (): LayoutDomain | undefined => {
    return window.siyuan?.layout?.centerLayout;
};

// ============ 窗口操作 ============

/** @同步豁免: UI构建 - 刷新页面 - 需要同步调用原生API */
export const reloadWindow = (): void => window.location.reload();

// ============ 布局操作 ============

/** @同步豁免: UI构建 - 需要同步访问布局对象进行递归搜索 */
export const findInstanceInLayout = (
    layout: LayoutDomain | LayoutWindow,
    targetId: string
): LayoutDomain | LayoutWindow | undefined => {
    if (layout.id === targetId) {
        return layout;
    }
    if (!("direction" in layout)) {
        return undefined;
    }

    for (const child of layout.children) {
        const result = findInstanceInLayout(child, targetId);
        if (result) {
            return result;
        }
    }
    return undefined;
};

// ============ 存储操作 ============

/** @同步豁免: UI构建 - 重置文件位置存储 */
export const resetFilePositionStorage = (): void => {
    const storage = getSiyuanStorage();
    if (!storage) {
        return;
    }
     
    storage["local-fileposition"] = {};
};

/** @同步豁免: UI构建 - 重置对话框位置存储 */
export const resetDialogPositionStorage = (): void => {
    const storage = getSiyuanStorage();
    if (!storage) {
        return;
    }
     
    storage["local-dialogposition"] = {};
};

/** @同步豁免: UI构建 - 获取存储中的文件位置 */
export const getFilePositionStorage = (): IObject => {
    const storage = getSiyuanStorage();
     
    return storage?.["local-fileposition"] ?? {};
};

/** @同步豁免: UI构建 - 获取存储中的对话框位置 */
export const getDialogPositionStorage = (): IObject => {
    const storage = getSiyuanStorage();
     
    return storage?.["local-dialogposition"] ?? {};
};

// ============ 配置检查 ============

/** @同步豁免: UI构建 - 检查是否为只读模式 */
export const isReadOnlyMode = (): boolean => {
    return window.siyuan?.config?.readonly ?? false;
};
