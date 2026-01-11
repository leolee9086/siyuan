/**
 * Siyuan API 模块生成器
 * 动态生成 siyuan API 的 Blob URL，供笔记内插件 import 使用
 */
import { API } from "../plugin/API";

/** 缓存的 siyuan API 模块 Blob URL */
let siyuanApiModuleUrl: string | null = null;

/** 全局 API 变量名 */
const GLOBAL_API_KEY = "_siyuanInNotePluginAPI";

/**
 * 获取 siyuan API 模块的 Blob URL
 * 首次调用时生成，后续复用缓存
 */
export function getSiyuanApiUrl(): string {
    if (siyuanApiModuleUrl) {
        return siyuanApiModuleUrl;
    }

    // 动态生成 ESM 模块代码
    // 通过全局变量桥接，避免 webpack 打包问题
    const moduleCode = `
// 动态生成的 siyuan API ESM 模块
const API = window.${GLOBAL_API_KEY};

// 导出核心类和函数
export const Plugin = API.Plugin;
export const EventBus = API.EventBus;

// 导出 HTTP 请求函数
export const fetchPost = API.fetchPost;
export const fetchSyncPost = API.fetchSyncPost;
export const fetchGet = API.fetchGet;

// 导出 UI 组件和工具
export const showMessage = API.showMessage;
export const confirm = API.confirm;
export const Dialog = API.Dialog;
export const Menu = API.Menu;
export const Setting = API.Setting;

// 导出常量
export const Constants = API.Constants;

// 导出编辑器相关
export const openTab = API.openTab;
export const openWindow = API.openWindow;
export const openMobileFileById = API.openMobileFileById;
export const lockScreen = API.lockScreen;

// 导出 Protyle 相关
export const Protyle = API.Protyle;

// 导出工具函数
export const getFrontend = API.getFrontend;
export const getBackend = API.getBackend;
export const adaptHotkey = API.adaptHotkey;
export const isMobile = API.isMobile;

// 默认导出整个 API 对象
export default API;
`;

    // 将 API 暴露到全局变量
    (window as unknown as Record<string, unknown>)[GLOBAL_API_KEY] = API;

    // 创建 Blob URL
    const blob = new Blob([moduleCode], { type: "application/javascript" });
    siyuanApiModuleUrl = URL.createObjectURL(blob);

    return siyuanApiModuleUrl;
}

/**
 * 清理 siyuan API 模块 URL（通常不需要调用）
 */
export function cleanupSiyuanApiUrl(): void {
    if (siyuanApiModuleUrl) {
        URL.revokeObjectURL(siyuanApiModuleUrl);
        siyuanApiModuleUrl = null;
    }
    delete (window as unknown as Record<string, unknown>)[GLOBAL_API_KEY];
}
