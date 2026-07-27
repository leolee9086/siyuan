import { getAllEditor, getAllModels, getAllWnds } from "../../layout/getAll";
import { isMobile } from "../../platform";
import {addLoading} from "../ui/loading";
import { fetchPost } from "../../util/network/fetch";
import { Constants } from "../../constants";
import { hideAllElements, hideElements } from "../ui/hideElements";
import { hasClosestByClassName } from "../util/hasClosest";
import { reloadProtyle } from "../util/reload";
import { resize } from "../util/resize";
import { disabledProtyle, enableProtyle } from "../util/onGet";
import { isWindow } from "../../util/platform/functions";
import { Wnd } from "../../layout/Wnd";
import {
    getSiyuanConfig,
    getSiyuanLayout,
    getSiyuanZIndex,
    incrementSiyuanZIndex,
    setSiyuanEditorIsFullscreen
} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

const onNet2LocalAssets = (protyle: IProtyle) => {
    if (isMobile) {
        reloadProtyle(protyle, false);
        return;
    }
    for (const item of getAllEditor()) {
        if (item.protyle.block.rootID === protyle.block.rootID) {
            reloadProtyle(item.protyle, item.protyle.element === protyle.element);
        }
    }
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

const updateHeaderDragRegion = (item: Wnd, isFullscreen: boolean) => {
    const headerElement = item.headersElement.parentElement;
    if (!headerElement || headerElement.getBoundingClientRect().top > 0) {
        return false;
    }
    const readonlyElement = headerElement.querySelector(".item--readonly .fn__flex-1");
    if (readonlyElement instanceof HTMLElement) {
        readonlyElement.style.WebkitAppRegion = isFullscreen ? "drag" : "";
        return true;
    }
    return false;
};

const updateLayoutDragRegion = (isFullscreen: boolean) => {
    if (isMobile) {
        return;
    }
    const wndsTemp: Wnd[] = [];
    const layout = getSiyuanLayout()?.layout;
    if (layout) {
        getAllWnds(layout, wndsTemp);
    }
    wndsTemp.find((item) => updateHeaderDragRegion(item, isFullscreen));
};

const updateWindowControlsZIndex = (isFullscreen: boolean) => {
    if (isMobile) {
        return;
    }
    if ("darwin" === getSiyuanConfig()?.system.os || isWindow()) {
        return;
    }
    const windowControlsElement = document.getElementById("windowControls");
    if (isFullscreen && windowControlsElement) {
        windowControlsElement.style.zIndex = "";
    }

    if (isFullscreen) {
        return;
    }

    incrementSiyuanZIndex();
    if (windowControlsElement) {
        windowControlsElement.style.zIndex = getSiyuanZIndex().toString();
    }
};

const updateWindowUI = (isFullscreen: boolean) => {
    if (isMobile) {
        return;
    }
    // 编辑器全屏时更新窗口标题栏拖拽区域
    if (isWindow()) {
        updateLayoutDragRegion(isFullscreen);
    }
    updateWindowControlsZIndex(isFullscreen);
};

const updateButtonAndDock = (element: Element, btnElement: Element, isFullscreen: boolean) => {
    const useElement = btnElement.querySelector("use");
    useElement?.setAttribute("xlink:href", isFullscreen ? "#iconFullscreen" : "#iconFullscreenExit");

    const dockLayoutElement = hasClosestByClassName(element, "layout--float");
    if (!dockLayoutElement) {
        return;
    }

    if (isFullscreen) {
        dockLayoutElement.setAttribute("data-temp", dockLayoutElement.style.transform);
        dockLayoutElement.style.transform = "none";
        return;
    }

    dockLayoutElement.style.transform = dockLayoutElement.getAttribute("data-temp") || "";
    dockLayoutElement.removeAttribute("data-temp");
};

const syncEditors = (element: Element, isFullscreen: boolean) => {
    if (isMobile) {
        return;
    }
    if (element.classList.contains("protyle")) {
        setSiyuanEditorIsFullscreen(!isFullscreen);
    }
    for (const item of getAllModels().editor) {
        if (element !== item.element && item.element.classList.contains("fullscreen")) {
            item.element.classList.remove("fullscreen");
            resize(item.editor.protyle);
        }
    }
};

export const fullscreen = (element: Element, btnElement?: Element) => {
    setTimeout(() => {
        hideAllElements(["gutter"]);
    }, Constants.TIMEOUT_TRANSITION);   // 等待页面动画结束

    const isFullscreen = element.className.includes("fullscreen");
    element.classList.toggle("fullscreen", !isFullscreen);
    const dragElement = document.getElementById("drag");
    dragElement?.classList.toggle("fn__hidden", !isFullscreen);

    updateWindowUI(isFullscreen);

    if (btnElement) {
        updateButtonAndDock(element, btnElement, isFullscreen);
        return;
    }
    syncEditors(element, isFullscreen);
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
