/**
 * 布局反序列化环境封装
 * 封装所有 window 访问以符合 no-restricted-globals 规则
 * @同步豁免: 遗留代码 - 此模块从 util.ts 迁移，保持原有同步行为以确保兼容性
 */
/** 用途：Layout 布局实例类型。使用范围：反序列化恢复布局时进行类型标注。解耦评估：同目录类型导入，不涉及跨层耦合。 */
import { Layout } from "./index";

// ============ 思源核心对象访问 ============

/** @同步豁免: UI构建 - 布局恢复需要同步访问全局布局对象 */
export const getSiyuanLayout = () => window.siyuan?.layout;

/** @同步豁免: UI构建 - 布局恢复需要同步访问配置对象 */
export const getSiyuanConfig = () => window.siyuan?.config;

/** @同步豁免: UI构建 - 布局恢复需要同步访问国际化对象 */
export const getSiyuanLanguages = () => window.siyuan?.languages;

/**
 * 设置思源布局的根 Layout
 * @同步豁免: UI构建 - 布局恢复需要同步设置根布局
 */
export const setSiyuanLayoutLayout = (layout: Layout) => {
    // 检查 siyuan.layout 是否存在，避免空引用
    if (!window.siyuan?.layout) {
        return;
    }
    window.siyuan.layout.layout = layout;
};

/** @同步豁免: UI构建 - 布局恢复需要同步获取根布局 */
export const getSiyuanLayoutLayout = () => window.siyuan?.layout?.layout;

// ============ UI布局配置访问 ============

/** @同步豁免: UI构建 - 布局恢复需要同步获取UI布局配置 */
export const getUILayoutConfig = () => window.siyuan?.config?.uiLayout;

/** @同步豁免: UI构建 - 布局恢复需要同步获取文件树配置 */
export const getFileTreeConfig = () => window.siyuan?.config?.fileTree;

// ============ 首次加载状态管理 ============

/**
 * 检查并标记浏览器首次加载状态
 * 用于在浏览器环境下判断是否为首次加载，避免重复执行启动逻辑
 * @同步豁免: UI构建 - 布局恢复需要同步检查首次加载状态
 * @returns true 表示是首次加载，false 表示已加载过
 */
export const checkAndMarkFirstLoad = (sessionKey: string) => {
    // 已存在标记说明不是首次加载
    if (sessionStorage.getItem(sessionKey)) {
        return false;
    }
    // 设置标记并返回首次加载
    sessionStorage.setItem(sessionKey, "true");
    return true;
};
