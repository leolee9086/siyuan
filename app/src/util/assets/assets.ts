/** 本模块承接原 `util/assets.ts` 的资源初始化、主题模式和工作空间正文高亮职责。 */
import { Constants } from "../../constants";
import { addScript } from "../../protyle/util/addScript";
import { addStyle } from "../../protyle/util/addStyle";
import { getAllModels } from "../../layout/getAll";
import {exportLayout} from "../../layout/export/exportLayout";
import {isMobile, isBrowser} from "../../platform";
// S-forge: 模块化重构 - 使用环境抽象层和资源模块
import { fetchPost } from "../network/fetch";
import type { IFetchRequestObject } from "../network/types";
import { getSiyuanConfig, getSiyuanStorage } from "../siyuanEnvironments/getSiyuanConfig.environment";
import { getWindowDestroyTheme, setWindowDestroyTheme, windowMatchMedia } from "../siyuanEnvironments/windowAppearance.environment";
import { reloadLocation } from "../siyuanEnvironments/windowLocation.environment";
import { getWindowJSAndroid, getWindowJSHarmony, getWindowWebkit } from "../siyuanEnvironments/windowNative.environment";
import { isServiceWorkerAvailable } from "../siyuanEnvironments/windowStandard.environment";
import { setInlineStyle } from "./setInlineStyle";
import { setCodeTheme } from "./setCodeTheme";
import { updateMobileTheme } from "./mobile";
import { getBackend, getFrontend } from "../platform/functions";
import {getWorkspaceName} from "../processTitle";
import {getAllEditor} from "../../layout/getAll";
import {invalidateHeadingNumberMeasurements} from "../../protyle/util/headingNumberCore";
import {renderHeadingNumbers} from "../../protyle/util/headingNumber";
import {isCurrentThemeSupported} from "../themeCompatibility";
import {loadInlineStyles} from "../../protyle/toolbar/inlineStyle";

export { setInlineStyle, setCodeTheme };

/** 刷新所有编辑器的标题编号测量与展示。 */
export const refreshHeadingNumberMeasurements = () => {
    invalidateHeadingNumberMeasurements();
    getAllEditor().forEach((item) => renderHeadingNumbers(item.protyle));
};

/** 更新当前主题样式表地址而不重建整个主题。 */
export const refreshThemeStyle = (themeAddress: string) => {
    const appearance = getSiyuanConfig().appearance;
    if (!isCurrentThemeSupported(appearance, getFrontend())) {
        return;
    }
    const isCustomTheme = (appearance.mode === 1 && appearance.themeDark !== "midnight") ||
        (appearance.mode === 0 && appearance.themeLight !== "daylight");
    const styleElement = document.getElementById(isCustomTheme ? "themeStyle" : "themeDefaultStyle");
    if (styleElement instanceof HTMLLinkElement) {
        styleElement.href = themeAddress;
    }
};

/** 重新载入用户内联样式并更新编辑器样式表。 */
export const reloadInlineStyles = async () => {
    try {
        await loadInlineStyles(true);
    } catch (error) {
        console.error("reload inline styles error: " + error);
    }
    await setInlineStyle();
};

/** 更新 HTML 元素属性 */
const updateHTMLAttrs = () => {
    const htmlElement = document.documentElement;
    htmlElement.setAttribute("lang", getSiyuanConfig().appearance.lang);
    htmlElement.setAttribute("data-frontend", getFrontend());
    htmlElement.setAttribute("data-backend", getBackend());
    htmlElement.setAttribute("data-theme-mode", getThemeMode());
    htmlElement.setAttribute("data-light-theme", getSiyuanConfig().appearance.themeLight);
    htmlElement.setAttribute("data-dark-theme", getSiyuanConfig().appearance.themeDark);
    const OSTheme = windowMatchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    // 当启用了跟随系统主题(modeOS)且当前配置的模式与OS实际主题不一致时，同步修正模式
    // 生效场景：用户在系统层面切换了深色/浅色模式后首次加载页面
    if (getSiyuanConfig().appearance.modeOS && (
        (getSiyuanConfig().appearance.mode === 1 && OSTheme === "light") ||
        (getSiyuanConfig().appearance.mode === 0 && OSTheme === "dark")
    )) {
        fetchPost("/api/system/setAppearanceMode", { mode: OSTheme === "light" ? 0 : 1 });
        getSiyuanConfig().appearance.mode = (OSTheme === "light" ? 0 : 1);
    }
};

/** 加载默认主题 */
const loadDefaultTheme = (data: Config.IAppearance) => {
    const defaultStyleElement = document.getElementById("themeDefaultStyle");
    const defaultThemeAddress = `/appearance/themes/${data.mode === 1 ? "midnight" : "daylight"}/theme.css?v=${Constants.SIYUAN_VERSION}`;
    if (!defaultStyleElement) {
        addStyle(defaultThemeAddress, "themeDefaultStyle");
        return;
    }
    if (defaultStyleElement.getAttribute("href")?.startsWith(defaultThemeAddress)) {
        return;
    }
    const newStyleElement = document.createElement("link");
    // 等待新样式表加载完成再移除旧样式表
    new Promise((resolve) => {
        newStyleElement.rel = "stylesheet";
        newStyleElement.href = defaultThemeAddress;
        newStyleElement.onload = resolve;
        defaultStyleElement.parentNode?.insertBefore(newStyleElement, defaultStyleElement);
    }).then(() => {
        defaultStyleElement.remove();
        newStyleElement.id = "themeDefaultStyle";
    });
};

/** 加载自定义主题 */
const loadCustomTheme = (data: Config.IAppearance) => {
    const styleElement = document.getElementById("themeStyle");
    // 当前主题为内置默认主题(midnight/daylight)时无需加载自定义样式，移除已有的自定义样式元素
    // 生效场景：用户从第三方主题切换回内置主题
    if (!((data.mode === 1 && data.themeDark !== "midnight") || (data.mode === 0 && data.themeLight !== "daylight"))) {
        styleElement?.remove();
        return;
    }
    const themeAddress = `/appearance/themes/${data.mode === 1 ? data.themeDark : data.themeLight}/theme.css?v=${data.themeVer}`;
    if (!styleElement) {
        addStyle(themeAddress, "themeStyle");
        return;
    }
    // 样式表地址已变更时更新href，避免重复加载相同资源
    if (!styleElement.getAttribute("href")?.startsWith(themeAddress)) {
        styleElement.setAttribute("href", themeAddress);
    }
};

/** 更新图表和 PDF 主题 */
const updateGraphAndPDF = () => {
    if (!isMobile) {
        for (const item of getAllModels().graph) {
            item.searchGraph(false);
        }
        const pdfThemeSettings = getSiyuanStorage()[Constants.LOCAL_PDFTHEME];
        const pdfTheme = getSiyuanConfig().appearance.mode === 0 ? pdfThemeSettings.light : pdfThemeSettings.dark;
        for (const item of document.querySelectorAll(".pdf__outer")) {
            // querySelectorAll返回Element类型，需类型守卫确认为HTMLElement才能操作classList等属性
            if (item instanceof HTMLElement) {
                updatePDFAttributes(item, pdfTheme === "dark");
            }
        }
    }
};

/** 更新 PDF 属性 */
const updatePDFAttributes = (item: HTMLElement, isDark: boolean) => {
    const darkElement = item.querySelector("#pdfDark");
    const lightElement = item.querySelector("#pdfLight");
    item.classList.toggle("pdf__outer--dark", isDark);
    lightElement?.classList.toggle("toggled", !isDark);
    darkElement?.classList.toggle("toggled", isDark);
};

/** 更新浏览器 Meta */
const updateBrowserMeta = () => {
    // 仅在纯浏览器环境(非原生WebView/Android/Harmony)且支持ServiceWorker时注入theme-color meta标签
    // 生效场景：通过浏览器直接访问思源笔记的Web端
    if (isBrowser && !getWindowWebkit()?.messageHandlers && !getWindowJSAndroid() && !getWindowJSHarmony() &&
        isServiceWorkerAvailable()) {
        document.head.insertAdjacentHTML("afterbegin", `<meta name="theme-color" content="${getComputedStyle(document.body).getPropertyValue("--b3-body-background").trim()}">`);
    }
};

/** 移除冗余 SVG 图标 */
const 移除冗余SVG图标 = () => {
    for (const [index, item] of Array.from(document.body.children).entries()) {
        if (item.tagName === "svg" &&
            index !== 0 &&
            !item.getAttribute("data-name") &&
            "iconsLitheness" !== item.id) {
            item.remove();
        }
    }
};

/** 加载主题脚本 */
const loadThemeScript = (data: Config.IAppearance) => {
    const themeScriptElement = document.getElementById("themeScript");
    const themeScriptAddress = `/appearance/themes/${data.mode === 1 ? data.themeDark : data.themeLight}/theme.js?v=${data.themeVer}`;
    if (!themeScriptElement) {
        addScript(themeScriptAddress, "themeScript");
        return;
    }
    if (themeScriptElement.getAttribute("src")?.startsWith(themeScriptAddress)) {
        return;
    }
    themeScriptElement.remove();
    addScript(themeScriptAddress, "themeScript");
};

/** 加载图标 */
const loadIcons = (data: Config.IAppearance) => {
    // load icons
    const isBuiltInIcon = data.icon === "litheness";
    const iconScriptElement = document.getElementById("iconScript");
    const iconDefaultScriptElement = document.getElementById("iconDefaultScript");
    // 不能使用 data.iconVer，因为其他主题也需要加载默认图标，此时 data.iconVer 为其他图标的版本号
    const iconDefaultURL = `/appearance/icons/litheness/icon.js?v=${Constants.SIYUAN_VERSION}`;
    const iconThirdURL = `/appearance/icons/${data.icon}/icon.js?v=${data.iconVer}`;

    // 内置图标已加载：清理第三方图标后返回
    if (isBuiltInIcon && iconDefaultScriptElement && iconDefaultScriptElement.getAttribute("src")?.startsWith(iconDefaultURL)) {
        iconScriptElement?.remove();
        移除冗余SVG图标();
        return;
    }
    // 第三方图标已加载：直接返回
    if (!isBuiltInIcon && iconScriptElement && iconScriptElement.getAttribute("src")?.startsWith(iconThirdURL)) {
        return;
    }
    // @内联回调
    addScript(iconDefaultURL, "iconDefaultScript").then(() => {
        iconScriptElement?.remove();
        if (!isBuiltInIcon) {
            addScript(iconThirdURL, "iconScript").then(移除冗余SVG图标);
        }
    });
};

/** @同步豁免: UI构建 - loadAssets 在主题切换时同步编排多个DOM操作(样式表/脚本/属性)，调用方依赖同步执行顺序确保UI一致性 */
export const loadAssets = (data: Config.IAppearance) => {
    updateHTMLAttrs();
    loadDefaultTheme(data);
    loadCustomTheme(data);
    updateGraphAndPDF();
    updateBrowserMeta();
    setCodeTheme();
    loadThemeScript(data);
    loadIcons(data);
};

/** 处理外观模式响应 */
const handleAppearanceModeResponse = async (response: IWebSocketData) => {
    // 主题未启用JS：无需执行销毁逻辑，直接更新配置并重新加载资源
    if (!getSiyuanConfig().appearance.themeJS) {
        getSiyuanConfig().appearance = response.data.appearance;
        loadAssets(response.data.appearance);
        return;
    }
    // 主题JS已启用但未注册destroyTheme回调，桌面端需先保存布局再重载页面以清理主题副作用
    // 生效场景：第三方主题启用了themeJS但未实现destroyTheme生命周期钩子，且运行在桌面端
    if (!getWindowDestroyTheme() && !isMobile) {
        exportLayout({
            /** 回调函数 */
            cb() {
                reloadLocation();
            },
            errorExit: false,
        });
        return;
    }
    // 主题JS已启用但未注册destroyTheme回调，移动端直接重载页面
    if (!getWindowDestroyTheme() && isMobile) {
        reloadLocation();
        return;
    }
    try {
        await getWindowDestroyTheme()();
        setWindowDestroyTheme(undefined);
        const themeScriptElement = document.getElementById("themeScript");
        themeScriptElement?.remove();
    } catch (e) {
        console.error("destroyTheme error: " + e);
    }
    getSiyuanConfig().appearance = response.data.appearance;
    loadAssets(response.data.appearance);
};

/** 处理颜色方案变更 */
const handlePrefersColorSchemeChange = (event: MediaQueryListEvent) => {
    const OSTheme = event.matches ? "dark" : "light";
    updateMobileTheme(OSTheme);
    if (!getSiyuanConfig().appearance.modeOS) {
        return;
    }
    if ((getSiyuanConfig().appearance.mode === 0 && OSTheme === "light") ||
        (getSiyuanConfig().appearance.mode === 1 && OSTheme === "dark")) {
        return;
    }
    fetchPost("/api/system/setAppearanceMode", {
        mode: OSTheme === "light" ? 0 : 1
    }, handleAppearanceModeResponse);
};

/** @同步豁免: 生命周期 - initAssets 在应用启动阶段同步注册事件监听器和移除loading元素，属于初始化生命周期操作 */
export const initAssets = () => {
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
        // 延迟160ms移除loading元素，这是一个用户感知延迟：确保启动画面的淡出动画完成后再移除DOM节点
        // 160ms对应CSS过渡动画时长，无法通过transitionend监听因为loading元素本身可能无过渡样式
        setTimeout(() => {
            loadingElement.remove();
        }, 160);
    }
    updateMobileTheme(windowMatchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    windowMatchMedia("(prefers-color-scheme: dark)").addEventListener("change", handlePrefersColorSchemeChange);
};

/** @同步豁免: UI构建 - setMode 由UI事件处理器直接调用，需要同步读取DOM状态(matchMedia)并构建请求参数 */
export const setMode = (modeElementValue: number) => {
    if (isMobile) {
        return;
    }
    let mode = modeElementValue;
    // modeElementValue===2 表示"跟随系统"模式，需要根据当前OS主题偏好推断实际的深色/浅色模式值
    if (modeElementValue === 2) {
        mode = windowMatchMedia("(prefers-color-scheme: dark)").matches ? 1 : 0;
    }
    const requestData: IFetchRequestObject = {
        ...getSiyuanConfig().appearance,
        mode,
        modeOS: modeElementValue === 2,
    };
    fetchPost("/api/setting/setAppearance", requestData);
};

// S-forge: rgba2hex 和 updateMobileTheme 已提取到 ./assets/mobile 模块
/** @同步豁免: 需要绝对同步的DOM访问 - getThemeMode 被 updateHTMLAttrs 等同步DOM操作内联调用，返回值直接用于 setAttribute，必须同步返回字符串 */
export const getThemeMode = () => {
    const OSTheme = windowMatchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    if (getSiyuanConfig().appearance.modeOS) {
        return OSTheme;
    }
    return getSiyuanConfig().appearance.mode === 0 ? "light" : "dark";
};

export const setBodyHighlight = () => {
    const name = getWorkspaceName();
    if (!name) {
        return;
    }

    // 预定义颜色：赤橙黄绿青蓝紫（提高饱和度和亮度）
    const colors = [
        {h: 0, s: 85, l: 50},    // 赤 - 鲜艳红
        {h: 30, s: 90, l: 52},   // 橙 - 亮橙色
        {h: 50, s: 88, l: 50},   // 黄 - 金黄色
        {h: 140, s: 80, l: 48},  // 绿 - 翠绿色
        {h: 185, s: 85, l: 50},  // 青 - 亮青色
        {h: 230, s: 82, l: 52},  // 蓝 - 宝蓝色
        {h: 280, s: 85, l: 50},  // 紫 - 亮紫色
    ];

    let hue, saturation, lightness;

    if (name === "SiYuan") {
        // SiYuan 专用：更艳丽的紫色
        hue = 280;
        saturation = 85;
        lightness = 48;
    } else {
        // 根据工作空间名生成稳定的索引
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = (hash << 5) - hash + name.charCodeAt(i);
            hash |= 0;
        }

        const index = Math.abs(hash) % colors.length;
        const color = colors[index];
        hue = color.h;
        saturation = color.s;
        lightness = color.l;
    }

    document.documentElement.style.setProperty(
        "--b3-body-background-hl",
        `${hue}, ${saturation}%, ${lightness}%`
    );
};
