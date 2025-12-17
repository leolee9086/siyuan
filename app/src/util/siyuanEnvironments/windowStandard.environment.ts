
/**
 * 检查 ServiceWorker 是否可用
 * 封装了 window.navigator, window.caches, window.fetch 的检查
 * @returns boolean
 */
export const isServiceWorkerAvailable = () => {
    return "serviceWorker" in navigator && "caches" in window && "fetch" in window && !!navigator.serviceWorker;
};
