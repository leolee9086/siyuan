
/**
 * 检查 ServiceWorker 是否可用
 * 封装了 window.navigator, window.caches, window.fetch 的检查
 * @returns boolean
 */
export const isServiceWorkerAvailable = () => {
    return "serviceWorker" in navigator && "caches" in window && "fetch" in window && !!navigator.serviceWorker;
};

/**
 * 获取 Service Worker 容器
 * @returns ServiceWorkerContainer
 */
export const getServiceWorkerContainer = () => {
    return navigator.serviceWorker;
};

/**
 * 封装 window.crypto.getRandomValues
 * @param array typedArray
 * @returns typedArray
 */
export const getRandomValues = (array: Uint32Array) => {
    return window.crypto.getRandomValues(array);
};

/**
 * 封装 window.location.search
 * @returns string
 */
export const getLocationSearch = () => {
    return window.location.search;
};


/**
 * 封装 window.ontouchstart
 * @returns boolean
 */
export const isTouchDevice = () => {
    return ("ontouchstart" in window) && navigator.maxTouchPoints > 1;
};

/**
 * 封装 window.isSecureContext
 * 检查当前上下文是否为安全上下文（HTTPS 或 localhost）
 * @returns boolean
 */
export const isSecureContext = () => {
    return window.isSecureContext;
};

/**
 * 封装 window.getSelection
 * @returns Selection | null
 */
export const getWindowSelection = () => {
    return window.getSelection();
};

/**
 * 封装 window.location.origin
 * @returns string
 */
export const getLocationOrigin = () => {
    return window.location.origin;
};
