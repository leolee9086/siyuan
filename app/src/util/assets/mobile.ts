/** 用途：平台兼容性检测（iOS）。使用范围：mobile.ts 平台判断。解耦评估：通过 imports.ts 转发。 */
import { isInIOS } from "./imports";
/** 用途：平台兼容性检测（Android）。使用范围：mobile.ts 平台判断。解耦评估：通过 imports.ts 转发。 */
import { isInAndroid } from "./imports";
/** 用途：平台兼容性检测（Harmony）。使用范围：mobile.ts 平台判断。解耦评估：通过 imports.ts 转发。 */
import { isInHarmony } from "./imports";
/** 用途：思源配置。使用范围：mobile.ts 读取移动端配置。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanConfig } from "./imports";
/** 用途：获取 WebKit window 对象。使用范围：mobile.ts 原生接口。解耦评估：通过 imports.ts 转发。 */
import { getWindowWebkit } from "./imports";
/** 用途：获取 Android window 对象。使用范围：mobile.ts 原生接口。解耦评估：通过 imports.ts 转发。 */
import { getWindowJSAndroid } from "./imports";
/** 用途：获取 Harmony window 对象。使用范围：mobile.ts 原生接口。解耦评估：通过 imports.ts 转发。 */
import { getWindowJSHarmony } from "./imports";

/**
 * 更新移动端主题状态栏颜色
 *
 * 作用：根据操作系统主题设置移动端应用的状态栏颜色，确保状态栏与思源笔记主题保持一致
 *
 * 意图：移动端应用（iOS/Android/Harmony）需要在原生层面设置状态栏颜色，
 *      以提供沉浸式的用户体验。此函数作为桥接层，将思源笔记的主题变化同步到原生端。
 *
 * 调用时机：
 * - 应用启动时初始化主题
 * - 用户切换明暗主题时
 * - 系统主题发生变化时（跟随系统模式）
 *
 * 问题/改进：
 * - 当前使用500ms的固定延迟，无法精确获知CSS变量计算完成的时机
 * - 未来可考虑使用 MutationObserver 监听 body 的 class 变化来精确触发
 *
 * @param OSTheme - 操作系统主题，"dark" 或 "light"
 */
/** @同步豁免: 生命周期 - 此函数在主题变化回调中同步调用，改为async会增加不必要的复杂度，且调用方无需等待结果 */
export const updateMobileTheme = (OSTheme: string) => {
    // 仅在移动端环境（iOS/Android/Harmony）下执行状态栏更新
    // 桌面端无需处理，因为桌面浏览器不支持原生状态栏颜色设置
    if (isInIOS() || isInAndroid() || isInHarmony()) {
        // 延迟500ms执行以确保DOM和CSS变量已完全加载和计算
        // 无法使用确定性方案的原因：CSS变量(--b3-theme-background)的计算依赖于DOM渲染完成，
        // 但没有可靠的事件来监听CSS变量何时准备就绪
        // 500ms的确定依据：经过测试，这是确保在大多数移动设备上CSS变量已计算完成的最小时间
        setTimeout(() => {
            updateMobileStatusBar(OSTheme);
        }, 500);
    }
};

/**
 * 执行移动端状态栏颜色更新
 *
 * 作用：获取当前主题背景色并调用对应平台的原生接口更新状态栏颜色
 *
 * 意图：不同移动端平台（iOS/Android/HarmonyOS）使用不同的原生通信机制，
 *      此函数负责根据当前运行平台调用相应的原生API。
 *
 * 调用时机：由 updateMobileTheme 在延迟500ms后调用，确保CSS变量已计算完成
 *
 * 问题/改进：
 * - 各平台的通信机制不同，错误处理机制不完善
 * - 未来可统一封装原生调用接口，提供更一致的错误处理和日志
 *
 * @param OSTheme - 操作系统主题，用于在跟随系统模式时确定当前模式（"dark" 或 "light"）
 */
const updateMobileStatusBar = (OSTheme: string) => {
    // 从CSS变量获取主题背景色并转换为十六进制格式
    const backgroundColor = rgba2hex(getComputedStyle(document.body).getPropertyValue("--b3-theme-background").trim());
    // 获取当前显示模式：0=浅色, 1=深色
    let mode = getSiyuanConfig().appearance.mode;
    // 检查是否启用了"跟随系统"模式
    // 生效场景：用户在设置中开启了"跟随系统"选项，此时需要根据系统主题覆盖手动设置的模式
    if (getSiyuanConfig().appearance.modeOS) {
        mode = OSTheme === "dark" ? 1 : 0;
    }
    // 平台分发：根据当前运行平台调用对应的原生接口
    // 每个平台使用不同的JSBridge或messageHandler机制与原生通信
    if (isInIOS()) {
        // iOS通过WebKit messageHandler与原生通信，传递颜色和模式
        getWindowWebkit().messageHandlers.changeStatusBar.postMessage((backgroundColor || (mode === 0 ? "#fff" : "#1e1e1e")) + " " + mode);
        return;
    }
    // 检查当前是否为Android平台
    // 生效场景：应用在Android WebView中运行，需要通过JSBridge与Android原生通信
    if (isInAndroid()) {
        // Android通过JSBridge接口直接调用原生方法
        getWindowJSAndroid().changeStatusBarColor(backgroundColor, mode);
        return;
    }
    // 检查当前是否为HarmonyOS平台
    // 生效场景：应用在HarmonyOS WebView中运行，需要通过JSBridge与HarmonyOS原生通信
    if (isInHarmony()) {
        // HarmonyOS通过JSBridge接口直接调用原生方法
        getWindowJSHarmony().changeStatusBarColor(backgroundColor, mode);
    }
};

/**
 * 将RGB/RGBA颜色值转换为十六进制格式
 *
 * 作用：将CSS计算得到的rgb/rgba字符串转换为移动端原生接口所需的hex格式
 *
 * 意图：移动端原生接口需要十六进制格式的颜色值，而CSS变量返回的是rgb/rgba格式，
 *      此函数作为格式转换工具，确保颜色值能被原生接口正确解析。
 *
 * 调用时机：在 updateMobileStatusBar 中获取主题背景色后调用
 *
 * 问题/改进：
 * - 当前实现使用位运算技巧转换，可读性一般
 * - 可考虑使用正则表达式捕获组优化解析逻辑
 * - 对于无效输入直接返回原字符串，可考虑更严格的错误处理
 *
 * @param rgba - RGB或RGBA格式的颜色字符串，如 "rgb(255,255,255)" 或 "rgba(30,30,30,1)"
 * @returns 十六进制颜色字符串，如 "ffffff" 或 "ffffff00"
 */
const rgba2hex = (rgba: string) => {
    // 如果已经是十六进制格式，直接返回
    if (rgba.startsWith("#")) {
        return rgba;
    }
    // 解析rgb/rgba字符串，提取r,g,b,a分量
    const rgb = rgba.replace(/\s/g, "").match(/^rgba?\((\d+),(\d+),(\d+),?([^,\s)]+)?/i);
    if (!rgb) {
        return rgba;
    }
    const alpha = (rgb[4] || "").trim();
    const r = Number(rgb[1]);
    const g = Number(rgb[2]);
    const b = Number(rgb[3]);
    // 验证解析的数值是否有效
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return rgba;
    }
    // 将RGB分量转换为两位的十六进制字符串
    // 使用位运算技巧：通过 (value | 1 << 8) 确保至少3位十六进制，再用slice(1)取后两位
    let hex = (r | 1 << 8).toString(16).slice(1) +
        (g | 1 << 8).toString(16).slice(1) +
        (b | 1 << 8).toString(16).slice(1);

    // 处理透明度：默认为1（不透明）
    const a = (alpha !== "") ? Number(alpha) : 0o1;
    if (isNaN(a)) {
        return rgba;
    }
    // 将alpha值(0-1)转换为两位的十六进制字符串
    const alphaHex = ((a * 255) | 1 << 8).toString(16).slice(1);
    hex = hex + alphaHex;
    return hex;
};
