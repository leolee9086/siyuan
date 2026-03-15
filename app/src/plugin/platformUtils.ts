import {Constants} from "../constants";
import {isElectron} from "../platform";
import {ipcSend} from "../platform/electron/ipcRenderer";
// 该文件包含了一些与平台相关的工具函数，主要用于处理通知和兼容性问题。
export {
    openByMobile,
    readText,
    writeText,
    copyPlainText,
    getEventName,
    isOnlyMeta,
    isNotCtrl,
    isHuawei,
    isIPhone,
    isIPad,
    isMac,
    isInAndroid,
    isInIOS,
    updateHotkeyTip,
    getLocalStorage,
    setStorageVal,
} from "../protyle/util/compatibility";

export const sendNotification = (options: {
    channel?: string,
    title?: string,
    body?: string,
    delayInSeconds?: number,
    timeoutType?: "default" | "never" // 该参数仅在桌面端有效
}): Promise<number> => {
    return new Promise((resolve) => {
        const title = options.title || "";
        const body = options.body || "";
        const delayInSeconds = options.delayInSeconds || 0;
        if (!title.trim() && !body.trim()) {
            // 不能同时为空
            resolve(-1);
            return;
        }

        if (!isElectron) {
            const channel = options.channel || "SiYuan Notifications";
            if (window.JSAndroid && window.JSAndroid.sendNotification) {
                const id = window.JSAndroid.sendNotification(channel, title, body, delayInSeconds);
                resolve(id);
            } else if (window.JSHarmony && window.JSHarmony.sendNotification) {
                const id = window.JSHarmony.sendNotification(channel, title, body, delayInSeconds);
                resolve(id);
            } else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.sendNotification) {
                const callbackId = "cb_" + Date.now();
                // 定义临时回调
                if (!window.webkit.nativeCallbacks) {
                    window.webkit.nativeCallbacks = {};
                }
                window.webkit.nativeCallbacks[callbackId] = (id: number) => {
                    delete window.webkit.nativeCallbacks[callbackId];
                    resolve(id);
                };
                window.webkit.messageHandlers.sendNotification.postMessage({
                    title,
                    body,
                    delay: delayInSeconds,
                    callback: `window.webkit.nativeCallbacks.${callbackId}`
                });
            } else {
                resolve(-1);
            }
            return;
        }

        const timeoutId = window.setTimeout(() => {
            ipcSend(Constants.SIYUAN_CMD, {
                cmd: "notification",
                title,
                body,
                timeoutType: options.timeoutType || "default"
            });
        }, delayInSeconds * 1000);
        resolve(timeoutId);
    });
};

export const cancelNotification = (id: number) => {
    if (id < 0) {
        return;
    }

    if (!isElectron) {
        if (window.JSAndroid && window.JSAndroid.cancelNotification) {
            window.JSAndroid.cancelNotification(id);
        } else if (window.JSHarmony && window.JSHarmony.cancelNotification) {
            window.JSHarmony.cancelNotification(id);
        } else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.cancelNotification) {
            window.webkit.messageHandlers.cancelNotification.postMessage(id);
        }
        return;
    }

    clearTimeout(id);
};
