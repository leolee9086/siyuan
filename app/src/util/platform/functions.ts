import { getSiyuanConfig } from "../siyuanEnvironments/getSiyuanConfig.environment";
import { getLocationSearch, isTouchDevice as isTouchDeviceEnv } from "../siyuanEnvironments/windowStandard.environment";
import { platform } from "../../platform";

const CONTAINER_BACKEND_SET = new Set(["docker", "ios", "android", "harmony"]);
const MOBILE_BACKEND_SET = new Set(["ios", "android", "harmony"]);

/** 判断内核是否在容器中 */
export const isKernelInContainer = (): boolean => {
    return CONTAINER_BACKEND_SET.has(getSiyuanConfig().system.container);
};

/** 判断内核是否在移动端 */
export const isKernelInMobile = (): boolean => {
    return MOBILE_BACKEND_SET.has(getSiyuanConfig().system.container);
};

/** 判断是否在移动端界面 */
export const isMobile = () => {
    return !!document.getElementById("sidebar");
};

/** 获取后端类型 "windows" | "linux" | "darwin" | "docker" | "android" | "ios" | "harmony" */
export const getBackend = () => {
    if (isKernelInContainer()) {
        return getSiyuanConfig().system.container;
    }
    return getSiyuanConfig().system.os;
};

/** 获取前端类型 "desktop" | "desktop-window" | "mobile" | "browser-desktop" | "browser-mobile" */
export const getFrontend = () => {
    if (platform === "browser-mobile" && navigator.userAgent.startsWith("SiYuan/")) {
        return "mobile";
    }
    if (platform === "browser-mobile") {
        return "browser-mobile";
    }
    if (!navigator.userAgent.startsWith("SiYuan/")) {
        return "browser-desktop";
    }
    return isWindow() ? "desktop-window" : "desktop";
};

/** 判断是否为窗口模式 */
export const isWindow = () => {
    return !document.getElementById("toolbar");
};

/** 判断是否为触摸设备 */
export const isTouchDevice = () => {
    return isTouchDeviceEnv();
};

/** 判断字符串数组是否相等 */
export const isArrayEqual = (arr1: string[], arr2: string[]) => {
    return arr1.length === arr2.length && arr1.every((item) => arr2.includes(item));
};

/** 获取随机数 */
export const getRandom = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min; //含最大值，含最小值
};

/** 获取 URL 查询参数 */
export const getSearch = (key: string, link = getLocationSearch()) => {
    const params = link.substring(link.indexOf("?"));
    const hashIndex = params.indexOf("#");
    // REF https://developer.mozilla.org/zh-CN/docs/Web/API/URLSearchParams
    const urlSearchParams = new URLSearchParams(params.substring(0, hashIndex >= 0 ? hashIndex : undefined));
    return urlSearchParams.get(key);
};

/** 判断是否在浏览器中 */
export const isBrowser = () => {
    return platform !== "electron";
};

/** 判断是否为动态引用（单 ID 或多 ID） */
export const isDynamicRef = (text: string) => {
    return /^\(\(\d{14}-\w{7}(?:\s+\d{14}-\w{7})* '.*'\)\)$/.test(text);
};

/** 判断是否为文件注解 */
export const isFileAnnotation = (text: string) => {
    return /^<<assets\/.+\/\d{14}-\w{7} ".+">>$/.test(text);
};

/** 判断是否为有效的自定义属性名 */
export const isValidCustomAttrName = (name: string) => {
    return /^[a-z][\-0-9a-z]*$/.test(name);
};

/** 判断对象是否相等 */
export const objEquals = (a: unknown, b: unknown): boolean => {
    if (a === b) {
        return true;
    }
    if (typeof a === "number" && isNaN(a) && typeof b === "number" && isNaN(b)) {
        return true;
    }
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
    }
    if (!a || !b || (typeof a !== "object" && typeof b !== "object")) {
        return a === b;
    }
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) {
        return false;
    }
    const keys = Object.keys(a as Record<string, unknown>);
    if (keys.length !== Object.keys(b as Record<string, unknown>).length) {
        return false;
    }
    return keys.every(k => objEquals((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
};

/** 副本名称加一 */
export const duplicateNameAddOne = (name: string) => {
    if (!name) {
        return "";
    }

    const nameMatch = name.match(/^(.*) \((\d+)\)$/);
    if (nameMatch && nameMatch[2]) {
        return `${nameMatch[1]} (${parseInt(nameMatch[2]) + 1})`;
    }
    return `${name} (1)`;
};

// 红绿灯为原生控件不随缩放变化，缩小时按 zoom 补偿 --b3-toolbar-left-mac 避免与工具栏内容重叠。
export const setToolbarLeftMac = (zoom: number) => {
    if (!getSiyuanConfig() || getBackend() !== "darwin") {
        return;
    }
    if (zoom >= .9 || document.body.classList.contains("body--fullscreen")) {
        document.body.style.removeProperty("--b3-toolbar-left-mac");
        return;
    }
    const base = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--b3-toolbar-left-mac")) || 74;
    document.body.style.setProperty("--b3-toolbar-left-mac", (base / zoom * .9) + "px");
};
