/**
 * 获取窗口尺寸的环境封装
 * 用于替代直接访问 window 上的尺寸相关属性
 */

// ========== 视口尺寸（不含滚动条） ==========

/** 获取视口宽度 (window.innerWidth) */
export function getWindowWidth() {
    return window.innerWidth;
}

/** 获取视口高度 (window.innerHeight) */
export function getWindowHeight() {
    return window.innerHeight;
}

/** 获取视口尺寸 */
export function getWindowInnerSize(){
    return { width: window.innerWidth, height: window.innerHeight };
}

// ========== 浏览器窗口尺寸（含工具栏等） ==========

/** 获取浏览器窗口外部宽度 (window.outerWidth) */
export function getWindowOuterWidth() {
    return window.outerWidth;
}

/** 获取浏览器窗口外部高度 (window.outerHeight) */
export function getWindowOuterHeight() {
    return window.outerHeight;
}

/** 获取浏览器窗口外部尺寸 */
export function getWindowOuterSize(){
    return { width: window.outerWidth, height: window.outerHeight };
}

// ========== 滚动位置 ==========

/** 获取水平滚动位置 (window.scrollX) */
export function getScrollX() {
    return window.scrollX;
}

/** 获取垂直滚动位置 (window.scrollY) */
export function getScrollY() {
    return window.scrollY;
}

/** 获取滚动位置 */
export function getScrollPosition() {
    return { x: window.scrollX, y: window.scrollY };
}

// ========== 窗口相对屏幕的位置 ==========

/** 获取窗口相对屏幕的 X 位置 (window.screenX) */
export function getWindowScreenX() {
    return window.screenX;
}

/** 获取窗口相对屏幕的 Y 位置 (window.screenY) */
export function getWindowScreenY() {
    return window.screenY;
}

/** 获取窗口相对屏幕的位置 */
export function getWindowScreenPosition(){
    return { x: window.screenX, y: window.screenY };
}

// ========== 屏幕信息 ==========

/** 获取屏幕宽度 (window.screen.width) */
export function getScreenWidth() {
    return window.screen.width;
}

/** 获取屏幕高度 (window.screen.height) */
export function getScreenHeight() {
    return window.screen.height;
}

/** 获取屏幕尺寸 */
export function getScreenSize(){
    return { width: window.screen.width, height: window.screen.height };
}

/** 获取可用屏幕宽度（排除任务栏等）(window.screen.availWidth) */
export function getScreenAvailWidth() {
    return window.screen.availWidth;
}

/** 获取可用屏幕高度（排除任务栏等）(window.screen.availHeight) */
export function getScreenAvailHeight() {
    return window.screen.availHeight;
}

/** 获取可用屏幕尺寸 */
export function getScreenAvailSize(){
    return { width: window.screen.availWidth, height: window.screen.availHeight };
}

// ========== 设备像素比 ==========

/** 获取设备像素比 (window.devicePixelRatio) */
export function getDevicePixelRatio() {
    return window.devicePixelRatio;
}
