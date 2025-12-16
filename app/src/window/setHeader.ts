import { isWindow } from "../util/functions";
import { Wnd } from "../layout/Wnd";
import { getAllTabs, getAllWnds } from "../layout/getAll";
import { Editor } from "../editor";
import { Asset } from "../asset";
import { Constants } from "../constants";
import { ipcRenderer } from "electron";
import { setLocationHash, getWindowInnerWidth } from "../util/siyuanEnvironments/windowLocation.environment";
import { getSiyuanLayout, getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";

export const setTabPosition = () => {
    if (!isWindow()) {
        return;
    }
    const layout = getSiyuanLayout().layout;
    if (!layout) {
        return;
    }
    const wndsTemp: Wnd[] = [];
    getAllWnds(layout, wndsTemp);

    wndsTemp.forEach(async item => {
        const headerElement = item.headersElement.parentElement;
        if (!headerElement) {
            return;
        }
        const rect = headerElement.getBoundingClientRect();
        const dragElement = headerElement.querySelector(".item--readonly .fn__flex-1") as HTMLElement;
        // 先设置默认值
        (dragElement.style as CSSStyleDeclarationElectron).WebkitAppRegion = "";
        // 再根据条件覆盖
        if (rect.top <= 0) {
            dragElement.style.height = (dragElement.parentElement?.clientHeight ?? 0) + "px";
            (dragElement.style as CSSStyleDeclarationElectron).WebkitAppRegion = "drag";
        }
        const headersLastElement = headerElement.lastElementChild as HTMLElement;
        const isDarwin = "darwin" === getSiyuanConfig().system.os;

        // darwin 系统专用：处理左侧 padding
        // 先设置默认值
        item.headersElement.style.paddingLeft = "";
        // 再根据条件覆盖
        const isFullScreen = isDarwin && await ipcRenderer.invoke(Constants.SIYUAN_GET, {
            cmd: "isFullScreen",
        });
        if (isDarwin && rect.top <= 0 && rect.left <= 0 && !isFullScreen) {
            // 用 marginLeft 左侧底部无线条
            item.headersElement.style.paddingLeft = "var(--b3-toolbar-left-mac)";
        }

        // 所有系统：处理右侧 padding
        // 显示器缩放后像素存在小数点偏差 https://github.com/siyuan-note/siyuan/issues/7355
        // 先设置默认值
        headersLastElement.style.paddingRight = "";
        // 再根据条件覆盖
        const isWindowRightEdge = rect.top <= 0 && rect.right + 8 >= getWindowInnerWidth();
        const needsDarwinLeftPadding = isDarwin && rect.top <= 0 && rect.left <= 0 && !isFullScreen;
        if (isWindowRightEdge) {
            headersLastElement.style.paddingRight = (42 * (isDarwin ? 1 : 4)) + "px";
        }
        if (!isWindowRightEdge && needsDarwinLeftPadding) {
            headersLastElement.style.paddingRight = "42px";
        }
    });
};


/** 从 tab 的 data-initdata 属性中提取 hash（如果是 Editor 类型） */
const getHashFromInitData = (headElement: HTMLElement): string => {
    const initTab = headElement.getAttribute("data-initdata");
    if (!initTab) {
        return "";
    }
    const initTabData = JSON.parse(initTab);
    if (initTabData.instance !== "Editor") {
        return "";
    }
    return initTabData.rootId + Constants.ZWSP;
};

export const setModelsHash = () => {
    if (!isWindow()) {
        return;
    }
    let hash = "";
    getAllTabs().forEach(tab => {
        // 卫语句：处理 tab.model 不存在的情况
        if (!tab.model) {
            hash += getHashFromInitData(tab.headElement);
            return;
        }
        // 卫语句：处理 Editor 类型
        if (tab.model instanceof Editor) {
            hash += tab.model.editor.protyle.block.rootID + Constants.ZWSP;
            return;
        }
        // 卫语句：处理 Asset 类型
        if (tab.model instanceof Asset) {
            hash += tab.model.path + Constants.ZWSP;
            return;
        }
    });
    setLocationHash(hash);
};
