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
    if (styleElement) {
        if (!styleElement.getAttribute("href")?.startsWith(themeAddress)) {
            styleElement.setAttribute("href", themeAddress);
        }
    } else {
        addStyle(themeAddress, "themeStyle");
    }
};

const updateGraphAndPDF = () => {
    /// #if !MOBILE
    getAllModels().graph.forEach(item => {
        item.searchGraph(false);
    });
    const pdfTheme = getSiyuanConfig().appearance.mode === 0 ? getSiyuanStorage()[Constants.LOCAL_PDFTHEME].light :
        getSiyuanStorage()[Constants.LOCAL_PDFTHEME].dark;
    document.querySelectorAll(".pdf__outer").forEach(item => {
        updatePDFAttributes(item as HTMLElement, pdfTheme === "dark");
    });
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

const loadThemeScript = (data: Config.IAppearance) => {
    const themeScriptElement = document.getElementById("themeScript");
    const themeScriptAddress = `/appearance/themes/${data.mode === 1 ? data.themeDark : data.themeLight}/theme.js?v=${data.themeVer}`;
    if (themeScriptElement) {
        if (!themeScriptElement.getAttribute("src").startsWith(themeScriptAddress)) {
            themeScriptElement.remove();
            addScript(themeScriptAddress, "themeScript");
        }
    } else {
        addScript(themeScriptAddress, "themeScript");
    }
};

const loadIcons = (data: Config.IAppearance) => {
    // load icons
    const isBuiltInIcon = ["ant", "material"].includes(data.icon);
    const iconScriptElement = document.getElementById("iconScript");
    const iconDefaultScriptElement = document.getElementById("iconDefaultScript");
    // 不能使用 data.iconVer，因为其他主题也需要加载默认图标，此时 data.iconVer 为其他图标的版本号
    const iconDefaultURL = `/appearance/icons/${isBuiltInIcon ? data.icon : "material"}/icon.js?v=${Constants.SIYUAN_VERSION}`;
    const iconThirdURL = `/appearance/icons/${data.icon}/icon.js?v=${data.iconVer}`;

    if ((isBuiltInIcon && iconDefaultScriptElement && iconDefaultScriptElement.getAttribute("src").startsWith(iconDefaultURL)) ||
        (!isBuiltInIcon && iconScriptElement && iconScriptElement.getAttribute("src").startsWith(iconThirdURL))) {
        // 第三方图标切换到 material
        if (isBuiltInIcon) {
            iconScriptElement?.remove();
            Array.from(document.body.children).forEach((item) => {
                if (item.tagName === "svg" &&
                    !item.getAttribute("data-name") &&
                    !["iconsMaterial", "iconsAnt"].includes(item.id)) {
                    item.remove();
                }
            });
        }
        return;
    }
    if (iconDefaultScriptElement && !iconDefaultScriptElement.getAttribute("src").startsWith(iconDefaultURL)) {
        iconDefaultScriptElement.remove();
        if (data.icon === "ant") {
            document.querySelectorAll("#iconsMaterial").forEach(item => {
                item.remove();
            });
        } else {
            document.querySelectorAll("#iconsAnt").forEach(item => {
                item.remove();
            });
        }
    }
    addScript(iconDefaultURL, "iconDefaultScript").then(() => {
        iconScriptElement?.remove();
        if (!isBuiltInIcon) {
            addScript(iconThirdURL, "iconScript").then(() => {
                Array.from(document.body.children).forEach((item, index) => {
                    if (item.tagName === "svg" &&
                        index !== 0 &&
                        !item.getAttribute("data-name") &&
                        !["iconsMaterial", "iconsAnt"].includes(item.id)) {
                        item.remove();
                    }
                });
            });
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

export const initAssets = () => {
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
        setTimeout(() => {
            loadingElement.remove();
        }, 160);
    }
    updateMobileTheme(windowMatchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    windowMatchMedia("(prefers-color-scheme: dark)").addEventListener("change", event => {
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
        }, async response => {
            if (getSiyuanConfig().appearance.themeJS) {
                if (getWindowDestroyTheme()) {
                    try {
                        await getWindowDestroyTheme()();
                        setWindowDestroyTheme(undefined);
                        document.getElementById("themeScript")?.remove();
                    } catch (e) {
                        console.error("destroyTheme error: " + e);
                    }
                } else {
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
            }
            getSiyuanConfig().appearance = response.data.appearance;
            loadAssets(response.data.appearance);
        });
    });
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
    } else {
        return getSiyuanConfig().appearance.mode === 0 ? "light" : "dark";
    }
};
