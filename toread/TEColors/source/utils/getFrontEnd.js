export const isPublish = () => {
    return !siyuan.config.ai.openAI
}
export const isHuawei = () => {
    return window.siyuan.config.system.osPlatform.toLowerCase().indexOf("huawei") > -1;
};
export const isIPhone = () => {
    return navigator.userAgent.indexOf("iPhone") > -1;
};
export const isIPad = () => {
    return navigator.userAgent.indexOf("iPad") > -1;
};
export const isMac = () => {
    return navigator.platform.toUpperCase().indexOf("MAC") > -1;
};
export const isInAndroid = () => {
    return window.siyuan.config.system.container === "android" && window.JSAndroid;
};
export const isInIOS = () => {
    return window.siyuan.config.system.container === "ios" && window.webkit?.messageHandlers;
};
