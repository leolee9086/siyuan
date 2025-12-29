/// #if !MOBILE
import { getAllEditor, getAllModels, getAllWnds } from "../../layout/getAll";
/// #endif
import { addLoading } from "../ui/initUI";
import { fetchPost } from "../../util/fetch";
import { Constants } from "../../constants";
import { hideAllElements, hideElements } from "../ui/hideElements";
import { hasClosestByClassName } from "../util/hasClosest";
import { reloadProtyle } from "../util/reload";
import { resize } from "../util/resize";
import { disabledProtyle, enableProtyle } from "../util/onGet";
import { isWindow } from "../../util/functions";
import { Wnd } from "../../layout/Wnd";
import {
    getSiyuanConfig,
    getSiyuanEditorIsFullscreen,
    getSiyuanLayout,
    getSiyuanZIndex,
    incrementSiyuanZIndex,
    setSiyuanEditorIsFullscreen
} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

const onNet2LocalAssets = (protyle: IProtyle) => {
    /// #if MOBILE
    reloadProtyle(protyle, false);
    /// #else
    getAllEditor().forEach(item => {
        if (item.protyle.block.rootID === protyle.block.rootID) {
            reloadProtyle(item.protyle, item.protyle.element === protyle.element);
        }
    });
    /// #endif
};

export const net2LocalAssets = (protyle: IProtyle, type: "Assets" | "Img") => {
    if (protyle.element.querySelector(".wysiwygLoading")) {
        return;
    }
    addLoading(protyle);
    hideElements(["toolbar"], protyle);
    fetchPost(`/api/format/net${type}2LocalAssets`, {
        id: protyle.block.rootID
    }, () => onNet2LocalAssets(protyle));
};

export const fullscreen = (element: Element, btnElement?: Element) => {
    setTimeout(() => {
        hideAllElements(["gutter"]);
    }, Constants.TIMEOUT_TRANSITION);   // 等待页面动画结束

    const isFullscreen = element.className.includes("fullscreen");
    if (isFullscreen) {
        element.classList.remove("fullscreen");
        document.getElementById("drag")?.classList.remove("fn__hidden");
    } else {
        element.classList.add("fullscreen");
        document.getElementById("drag")?.classList.add("fn__hidden");
    }
    if (isWindow()) {
        // 编辑器全屏
        /// #if !MOBILE
        const wndsTemp: Wnd[] = [];
        const layout = getSiyuanLayout()?.layout;
        if (layout) {
            getAllWnds(layout, wndsTemp);
        }
        wndsTemp.find(async item => {
            const headerElement = item.headersElement.parentElement;
            if (headerElement && headerElement.getBoundingClientRect().top <= 0) {
                // @ts-ignore
                (headerElement.querySelector(".item--readonly .fn__flex-1") as HTMLElement).style.WebkitAppRegion = isFullscreen ? "drag" : "";
                return true;
            }
        });
        /// #endif
    }
    /// #if !MOBILE
    if ("darwin" !== getSiyuanConfig()?.system.os && !isWindow()) {
        const windowControlsElement = document.getElementById("windowControls");
        if (isFullscreen) {
            windowControlsElement ? windowControlsElement.style.zIndex = "" : null;
        } else {
            incrementSiyuanZIndex();
            windowControlsElement ? windowControlsElement.style.zIndex = getSiyuanZIndex().toString() : null;
        }
    }
    /// #endif
    if (btnElement) {
        if (isFullscreen) {
            btnElement.querySelector("use")?.setAttribute("xlink:href", "#iconFullscreen");
        } else {
            btnElement.querySelector("use")?.setAttribute("xlink:href", "#iconFullscreenExit");
        }
        const dockLayoutElement = hasClosestByClassName(element, "layout--float");
        if (dockLayoutElement) {
            if (isFullscreen) {
                dockLayoutElement.setAttribute("data-temp", dockLayoutElement.style.transform);
                dockLayoutElement.style.transform = "none";
            } else {
                if (dockLayoutElement) {
                    dockLayoutElement.style.transform = dockLayoutElement.getAttribute("data-temp") || "";
                    dockLayoutElement.removeAttribute("data-temp");
                }
            }
        }
        return;
    }
    /// #if !MOBILE
    if (element.classList.contains("protyle")) {
        setSiyuanEditorIsFullscreen(!isFullscreen);
    }
    getAllModels().editor.forEach(item => {
        if (element !== item.element) {
            if (getSiyuanEditorIsFullscreen()) {
                if (item.element.classList.contains("fullscreen")) {
                    item.element.classList.remove("fullscreen");
                    resize(item.editor.protyle);
                }
            } else if (item.element.classList.contains("fullscreen")) {
                item.element.classList.remove("fullscreen");
                resize(item.editor.protyle);
            }
        }
    });
    /// #endif
};

export const updateReadonly = (target: Element, protyle: IProtyle) => {
    if (getSiyuanConfig()?.readonly) {
        return;
    }
    const useElement = target.querySelector("use");
    const isReadonly = useElement?.getAttribute("xlink:href") !== "#iconUnlock";
    if (getSiyuanConfig()?.editor.readOnly && isReadonly) {
        enableProtyle(protyle);
        return;
    }

    if (getSiyuanConfig()?.editor.readOnly) {
        disabledProtyle(protyle);
        return;
    }

    fetchPost("/api/attr/setBlockAttrs", {
        id: protyle.block.rootID,
        attrs: {
            [Constants.CUSTOM_SY_READONLY]: isReadonly ? "false" : "true"
        }
    });
};
