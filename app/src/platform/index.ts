/**
 * 运行时平台检测模块
 *
 * 替代编译时 BROWSER / MOBILE 条件编译分支，
 * 提供类型安全的运行时平台检测。
 *
 * 检测逻辑基于现有代码库中已验证的模式：
 * - Electron 检测：`navigator.userAgent` 前缀（同 `getFrontend()`）
 * - 移动端检测：DOM 中 `#sidebar` 元素存在性（同 `isMobile()`）
 *
 * @module platform
 */

/** 用途：平台类型定义。使用范围：运行时平台检测的类型标注。解耦评估：同目录类型文件，直接导入。 */
import type { Platform } from "./platform.types";
/** 导出 Platform 类型，供外部模块使用 */
export type { Platform };

/** Webpack 在各构建目标中注入的编译期平台；源码运行时没有该值时使用 DOM/UA 兜底。 */
declare const __SFORGE_PLATFORM__: Platform | undefined;

/**
 * 运行时平台检测。
 *
 * 检测策略：
 * 1. UA 以 "SiYuan/" 开头 → Electron 桌面端（webpack.config.js: BROWSER=false, MOBILE=false）
 * 2. DOM 中存在 `#sidebar` → 浏览器移动端（webpack.mobile.js: BROWSER=true, MOBILE=true）
 * 3. 其余 → 浏览器桌面端（webpack.desktop.js: BROWSER=true, MOBILE=false）
 *
 * 注意：webpack.export.js 的导出构建在浏览器环境中运行，归入 browser-desktop。
 */
function detectPlatform(): Platform | undefined {
    if (typeof navigator === "undefined" || typeof document === "undefined") {
        return undefined;
    }
    if (navigator.userAgent.startsWith("SiYuan/")) {
        return "electron";
    }
    // 移动端 HTML 模板包含 #sidebar 元素，桌面端模板不包含
    if (document.getElementById("sidebar")) {
        return "browser-mobile";
    }
    return "browser-desktop";
}

/** 当前运行平台；浏览器宿主优先于 Electron-target bundle 的编译期默认值。 */
export const platform: Platform = detectPlatform() ?? (typeof __SFORGE_PLATFORM__ === "undefined"
    ? "browser-desktop"
    : __SFORGE_PLATFORM__);

/** 是否运行在浏览器环境（非 Electron），等价于原 BROWSER 分支 */
export const isBrowser: boolean = platform !== "electron";

/** 是否运行在移动端，等价于原 MOBILE 分支。 */
export const isMobile: boolean = platform === "browser-mobile";

/** 查询构建目标是否为移动平台；明确区别于 util/platform/functions 中的 DOM 查询。 @同步豁免: 性能考虑 */
export function isMobilePlatform() {
    return isMobile;
}

/** 是否运行在 Electron 桌面端，等价于原非 BROWSER 分支 */
export const isElectron: boolean = platform === "electron";

/** 浏览器桌面端（非移动端的浏览器），等价于原 BROWSER 且非 MOBILE 分支 */
export const isBrowserDesktop: boolean = platform === "browser-desktop";
