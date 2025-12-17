
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
