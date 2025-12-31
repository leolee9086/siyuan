/**
 * 获取窗口尺寸的环境封装
 * 用于替代直接访问 window 上的尺寸相关属性
 */

// ========== 视口尺寸（不含滚动条） ==========

/** 获取视口宽度 (window.innerWidth) */
export function getWindowWidth(): number {
    return window.innerWidth;
}

/** 获取视口高度 (window.innerHeight) */
export function getWindowHeight(): number {
    return window.innerHeight;
}

/** 获取视口尺寸 */
export function getWindowInnerSize(): { width: number; height: number } {
    return { width: window.innerWidth, height: window.innerHeight };
}

// ========== 浏览器窗口尺寸（含工具栏等） ==========

/** 获取浏览器窗口外部宽度 (window.outerWidth) */
export function getWindowOuterWidth(): number {
    return window.outerWidth;
}

/** 获取浏览器窗口外部高度 (window.outerHeight) */
export function getWindowOuterHeight(): number {
    return window.outerHeight;
}

/** 获取浏览器窗口外部尺寸 */
export function getWindowOuterSize(): { width: number; height: number } {
    return { width: window.outerWidth, height: window.outerHeight };
}

// ========== 滚动位置 ==========

/** 获取水平滚动位置 (window.scrollX) */
export function getScrollX(): number {
    return window.scrollX;
}

/** 获取垂直滚动位置 (window.scrollY) */
export function getScrollY(): number {
    return window.scrollY;
}

/** 获取滚动位置 */
export function getScrollPosition(): { x: number; y: number } {
    return { x: window.scrollX, y: window.scrollY };
}

// ========== 窗口相对屏幕的位置 ==========

/** 获取窗口相对屏幕的 X 位置 (window.screenX) */
export function getWindowScreenX(): number {
    return window.screenX;
}

/** 获取窗口相对屏幕的 Y 位置 (window.screenY) */
export function getWindowScreenY(): number {
    return window.screenY;
}

/** 获取窗口相对屏幕的位置 */
export function getWindowScreenPosition(): { x: number; y: number } {
    return { x: window.screenX, y: window.screenY };
}

// ========== 屏幕信息 ==========

/** 获取屏幕宽度 (window.screen.width) */
export function getScreenWidth(): number {
    return window.screen.width;
}

/** 获取屏幕高度 (window.screen.height) */
export function getScreenHeight(): number {
    return window.screen.height;
}

/** 获取屏幕尺寸 */
export function getScreenSize(): { width: number; height: number } {
    return { width: window.screen.width, height: window.screen.height };
}

/** 获取可用屏幕宽度（排除任务栏等）(window.screen.availWidth) */
export function getScreenAvailWidth(): number {
    return window.screen.availWidth;
}

/** 获取可用屏幕高度（排除任务栏等）(window.screen.availHeight) */
export function getScreenAvailHeight(): number {
    return window.screen.availHeight;
}

/** 获取可用屏幕尺寸 */
export function getScreenAvailSize(): { width: number; height: number } {
    return { width: window.screen.availWidth, height: window.screen.availHeight };
}

// ========== 设备像素比 ==========

/** 获取设备像素比 (window.devicePixelRatio) */
export function getDevicePixelRatio(): number {
    return window.devicePixelRatio;
}
