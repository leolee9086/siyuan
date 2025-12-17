import { isInIOS, isInAndroid, isInHarmony } from "../../protyle/util/compatibility";
import { getSiyuanConfig } from "../siyuanEnvironments/getSiyuanConfig.environment";
import { getWindowWebkit, getWindowJSAndroid, getWindowJSHarmony } from "../siyuanEnvironments/windowNative.environment";

export const updateMobileTheme = (OSTheme: string) => {
    if (isInIOS() || isInAndroid() || isInHarmony()) {
        setTimeout(() => {
            updateMobileStatusBar(OSTheme);
        }, 500); // 移动端需要加载完才可以获取到颜色
    }
};

const updateMobileStatusBar = (OSTheme: string) => {
    const backgroundColor = rgba2hex(getComputedStyle(document.body).getPropertyValue("--b3-theme-background").trim());
    let mode = getSiyuanConfig().appearance.mode;
    if (getSiyuanConfig().appearance.modeOS) {
        mode = OSTheme === "dark" ? 1 : 0;
    }
    if (isInIOS()) {
        getWindowWebkit().messageHandlers.changeStatusBar.postMessage((backgroundColor || (mode === 0 ? "#fff" : "#1e1e1e")) + " " + mode);
    } else if (isInAndroid()) {
        getWindowJSAndroid().changeStatusBarColor(backgroundColor, mode);
    } else if (isInHarmony()) {
        getWindowJSHarmony().changeStatusBarColor(backgroundColor, mode);
    }
};

const rgba2hex = (rgba: string) => {
    if (rgba.startsWith("#")) {
        return rgba;
    }
    let a: any;
    const rgb: any = rgba.replace(/\s/g, "").match(/^rgba?\((\d+),(\d+),(\d+),?([^,\s)]+)?/i);
    const alpha = (rgb && rgb[4] || "").trim();
    let hex = rgb ?
        (rgb[1] | 1 << 8).toString(16).slice(1) +
        (rgb[2] | 1 << 8).toString(16).slice(1) +
        (rgb[3] | 1 << 8).toString(16).slice(1) : rgba;

    a = (alpha !== "") ? alpha : 0o1;
    a = ((a * 255) | 1 << 8).toString(16).slice(1);
    hex = hex + a;
    return hex;
};
