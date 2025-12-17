import { Constants } from "../constants";
import { addScript } from "../protyle/util/addScript";
import { addStyle } from "../protyle/util/addStyle";
/// #if !MOBILE
import { getAllModels } from "../layout/getAll";
import { exportLayout } from "../layout/util";
/// #endif
import { fetchPost } from "./fetch";
import { getSiyuanConfig, getSiyuanStorage } from "./siyuanEnvironments/getSiyuanConfig.environment";
import { getWindowDestroyTheme, setWindowDestroyTheme, windowMatchMedia } from "./siyuanEnvironments/windowAppearance.environment";
import { reloadLocation } from "./siyuanEnvironments/windowLocation.environment";
import { getWindowJSAndroid, getWindowJSHarmony, getWindowWebkit } from "./siyuanEnvironments/windowNative.environment";
import { isServiceWorkerAvailable } from "./siyuanEnvironments/windowStandard.environment";
import { setInlineStyle } from "./assets/setInlineStyle";
import { setCodeTheme } from "./assets/setCodeTheme";
import { updateMobileTheme } from "./assets/mobile";

export { setInlineStyle, setCodeTheme };

const updateHTMLAttrs = () => {
    const htmlElement = document.documentElement;
    htmlElement.setAttribute("lang", getSiyuanConfig().appearance.lang);
    htmlElement.setAttribute("data-theme-mode", getThemeMode());
    htmlElement.setAttribute("data-light-theme", getSiyuanConfig().appearance.themeLight);
    htmlElement.setAttribute("data-dark-theme", getSiyuanConfig().appearance.themeDark);
    const OSTheme = windowMatchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    if (getSiyuanConfig().appearance.modeOS && (
        (getSiyuanConfig().appearance.mode === 1 && OSTheme === "light") ||
        (getSiyuanConfig().appearance.mode === 0 && OSTheme === "dark")
    )) {
        fetchPost("/api/system/setAppearanceMode", { mode: OSTheme === "light" ? 0 : 1 });
        getSiyuanConfig().appearance.mode = (OSTheme === "light" ? 0 : 1);
    }
};

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

const loadCustomTheme = (data: Config.IAppearance) => {
    const styleElement = document.getElementById("themeStyle");
    if (!((data.mode === 1 && data.themeDark !== "midnight") || (data.mode === 0 && data.themeLight !== "daylight"))) {
        styleElement?.remove();
        return;
    }
    const themeAddress = `/appearance/themes/${data.mode === 1 ? data.themeDark : data.themeLight}/theme.css?v=${data.themeVer}`;
    if (!styleElement) {
        addStyle(themeAddress, "themeStyle");
        return;
    }
    if (!styleElement.getAttribute("href")?.startsWith(themeAddress)) {
        styleElement.setAttribute("href", themeAddress);
    }
};

const updateGraphAndPDF = () => {
    /// #if !MOBILE
    for (const item of getAllModels().graph) {
        item.searchGraph(false);
    }
    const pdfThemeSettings = getSiyuanStorage()[Constants.LOCAL_PDFTHEME];
    const pdfTheme = getSiyuanConfig().appearance.mode === 0 ? pdfThemeSettings.light : pdfThemeSettings.dark;
    for (const item of document.querySelectorAll(".pdf__outer")) {
        updatePDFAttributes(item as HTMLElement, pdfTheme === "dark");
    }
    /// #endif
};

const updatePDFAttributes = (item: HTMLElement, isDark: boolean) => {
    const darkElement = item.querySelector("#pdfDark");
    const lightElement = item.querySelector("#pdfLight");
    item.classList.toggle("pdf__outer--dark", isDark);
    lightElement?.classList.toggle("toggled", !isDark);
    darkElement?.classList.toggle("toggled", isDark);
};

const updateBrowserMeta = () => {
    /// #if BROWSER
    if (!getWindowWebkit()?.messageHandlers && !getWindowJSAndroid() && !getWindowJSHarmony() &&
        isServiceWorkerAvailable()) {
        document.head.insertAdjacentHTML("afterbegin", `<meta name="theme-color" content="${getComputedStyle(document.body).getPropertyValue("--b3-toolbar-background").trim()}">`);
    }
    /// #endif
};

const 移除冗余SVG图标 = () => {
    for (const [index, item] of Array.from(document.body.children).entries()) {
        if (item.tagName === "svg" &&
            index !== 0 &&
            !item.getAttribute("data-name") &&
            !["iconsMaterial", "iconsAnt"].includes(item.id)) {
            item.remove();
        }
    }
};

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

const loadIcons = (data: Config.IAppearance) => {
    // load icons
    const isBuiltInIcon = ["ant", "material"].includes(data.icon);
    const iconScriptElement = document.getElementById("iconScript");
    const iconDefaultScriptElement = document.getElementById("iconDefaultScript");
    // 不能使用 data.iconVer，因为其他主题也需要加载默认图标，此时 data.iconVer 为其他图标的版本号
    const iconDefaultURL = `/appearance/icons/${isBuiltInIcon ? data.icon : "material"}/icon.js?v=${Constants.SIYUAN_VERSION}`;
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
    if (iconDefaultScriptElement && !iconDefaultScriptElement.getAttribute("src")?.startsWith(iconDefaultURL)) {
        iconDefaultScriptElement.remove();
        const 待移除图标ID = data.icon === "ant" ? "#iconsMaterial" : "#iconsAnt";
        for (const item of document.querySelectorAll(待移除图标ID)) {
            item.remove();
        }
    }
    // @内联回调
    addScript(iconDefaultURL, "iconDefaultScript").then(() => {
        iconScriptElement?.remove();
        if (!isBuiltInIcon) {
            addScript(iconThirdURL, "iconScript").then(移除冗余SVG图标);
        }
    });
};

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

const handleAppearanceModeResponse = async (response: IWebSocketData) => {
    if (!getSiyuanConfig().appearance.themeJS) {
        getSiyuanConfig().appearance = response.data.appearance;
        loadAssets(response.data.appearance);
        return;
    }
    if (!getWindowDestroyTheme()) {
        /// #if !MOBILE
        exportLayout({
            cb() {
                reloadLocation();
            },
            errorExit: false,
        });
        /// #else
        reloadLocation();
        /// #endif
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

export const initAssets = () => {
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
        setTimeout(() => {
            loadingElement.remove();
        }, 160);
    }
    updateMobileTheme(windowMatchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    windowMatchMedia("(prefers-color-scheme: dark)").addEventListener("change", handlePrefersColorSchemeChange);
};

export const setMode = (modeElementValue: number) => {
    /// #if !MOBILE
    let mode = modeElementValue;
    if (modeElementValue === 2) {
        mode = windowMatchMedia("(prefers-color-scheme: dark)").matches ? 1 : 0;
    }
    fetchPost("/api/setting/setAppearance", Object.assign({}, getSiyuanConfig().appearance, {
        mode,
        modeOS: modeElementValue === 2,
    }));
    /// #endif
};

export const getThemeMode = () => {
    const OSTheme = windowMatchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    if (getSiyuanConfig().appearance.modeOS) {
        return OSTheme;
    }
    return getSiyuanConfig().appearance.mode === 0 ? "light" : "dark";
};
