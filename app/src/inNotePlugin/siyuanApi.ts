/**
 * Siyuan API 模块生成器
 * 动态生成 siyuan API 的 Blob URL，供笔记内插件 import 使用
 */
/** 用途：插件 API 基类。使用范围：siyuanApi 生成 API 模块。解耦评估：通过 imports.ts 转发。 */
import { API } from "./imports";

/** 缓存的 siyuan API 模块 Blob URL */
let siyuanApiModuleUrl: string | null = null;

/** 全局 API 变量名 */
const GLOBAL_API_KEY = "_siyuanInNotePluginAPI";

/**
 * 获取 siyuan API 模块的 Blob URL
 * 首次调用时生成，后续复用缓存
 * @同步豁免: 生命周期 — 在插件加载时同步生成 API 模块
 */
export function getSiyuanApiUrl() {
    if (siyuanApiModuleUrl) {
        return siyuanApiModuleUrl;
    }

    // 动态生成 ESM 模块代码
    // 通过全局变量桥接，避免 webpack 打包问题
    // @内联数组
    const moduleCode = [
        "const API = self.", GLOBAL_API_KEY, ";",
        "export const Plugin = API.Plugin;",
        "export const EventBus = API.EventBus;",
        "export const fetchPost = API.fetchPost;",
        "export const fetchSyncPost = API.fetchSyncPost;",
        "export const fetchGet = API.fetchGet;",
        "export const showMessage = API.showMessage;",
        "export const confirm = API.confirm;",
        "export const Dialog = API.Dialog;",
        "export const Menu = API.Menu;",
        "export const Setting = API.Setting;",
        "export const Constants = API.Constants;",
        "export const openTab = API.openTab;",
        "export const openWindow = API.openWindow;",
        "export const openMobileFileById = API.openMobileFileById;",
        "export const lockScreen = API.lockScreen;",
        "export const Protyle = API.Protyle;",
        "export const getFrontend = API.getFrontend;",
        "export const getBackend = API.getBackend;",
        "export const adaptHotkey = API.adaptHotkey;",
        "export const isMobile = API.isMobile;",
        "export default API;"
    ].join("\n");

    // 将 API 暴露到全局变量
    const win = document.defaultView;
    if (win) {
        // @ts-expect-error - runtime global assignment, Window type does not include custom key
        win[GLOBAL_API_KEY] = API;
    }

    // 创建 Blob URL
    const blob = new Blob([moduleCode], { type: "application/javascript" });
    siyuanApiModuleUrl = URL.createObjectURL(blob);

    return siyuanApiModuleUrl;
}

/**
 * 清理 siyuan API 模块 URL（通常不需要调用）
 * @同步豁免: 生命周期 — 在插件卸载时同步清理
 */
export function cleanupSiyuanApiUrl() {
    if (siyuanApiModuleUrl) {
        URL.revokeObjectURL(siyuanApiModuleUrl);
        siyuanApiModuleUrl = null;
    }
    const win = document.defaultView;
    if (win) {
        // @ts-expect-error - runtime global cleanup, Window type does not include custom key
        delete win[GLOBAL_API_KEY];
    }
}
