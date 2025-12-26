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
        return;
    }
    if (isInAndroid()) {
        getWindowJSAndroid().changeStatusBarColor(backgroundColor, mode);
        return;
    }
    if (isInHarmony()) {
        getWindowJSHarmony().changeStatusBarColor(backgroundColor, mode);
    }
};

const rgba2hex = (rgba: string) => {
    if (rgba.startsWith("#")) {
        return rgba;
    }
    const rgb = rgba.replace(/\s/g, "").match(/^rgba?\((\d+),(\d+),(\d+),?([^,\s)]+)?/i);
    if (!rgb) {
        return rgba;
    }
    const alpha = (rgb[4] || "").trim();
    const r = Number(rgb[1]);
    const g = Number(rgb[2]);
    const b = Number(rgb[3]);
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return rgba;
    }
    let hex = (r | 1 << 8).toString(16).slice(1) +
        (g | 1 << 8).toString(16).slice(1) +
        (b | 1 << 8).toString(16).slice(1);

    const a = (alpha !== "") ? Number(alpha) : 0o1;
    if (isNaN(a)) {
        return rgba;
    }
    const alphaHex = ((a * 255) | 1 << 8).toString(16).slice(1);
    hex = hex + alphaHex;
    return hex;
};
