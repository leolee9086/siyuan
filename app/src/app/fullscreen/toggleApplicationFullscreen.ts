/** 用途：全屏过渡时长；使用范围：延迟清理 gutter；解耦评估：经专属网关暴露真实常量。 */
import {Constants} from "./imports";
/** 用途：全部编辑器模型；使用范围：关闭其它全屏编辑器；解耦评估：经专属网关直达 Layout 查询。 */
import {getAllModels} from "./imports";
/** 用途：递归窗口查询；使用范围：拖拽区同步；解耦评估：经专属网关直达 Layout 查询。 */
import {getAllWnds} from "./imports";
/** 用途：系统配置；使用范围：窗口控件平台分支；解耦评估：经专属网关直达环境访问器。 */
import {getSiyuanConfig} from "./imports";
/** 用途：当前布局；使用范围：窗口遍历；解耦评估：经专属网关直达环境访问器。 */
import {getSiyuanLayout} from "./imports";
/** 用途：当前层级；使用范围：窗口控件恢复；解耦评估：经专属网关直达环境访问器。 */
import {getSiyuanZIndex} from "./imports";
/** 用途：浮动 Dock 查询；使用范围：全屏变换保存与恢复；解耦评估：经专属网关直达 DOM 查询。 */
import {hasClosestByClassName} from "./imports";
/** 用途：全局 gutter 清理；使用范围：全屏过渡完成；解耦评估：经专属网关直达唯一 UI 实现。 */
import {hideAllElements} from "./imports";
/** 用途：全局层级递增；使用范围：窗口控件恢复；解耦评估：经专属网关直达环境访问器。 */
import {incrementSiyuanZIndex} from "./imports";
/** 用途：移动平台判断；使用范围：跳过桌面窗口同步；解耦评估：经专属网关直达平台事实。 */
import {isMobile} from "./imports";
/** 用途：独立窗口判断；使用范围：拖拽区与窗口控件分支；解耦评估：经专属网关直达平台事实。 */
import {isWindow} from "./imports";
/** 用途：编辑器尺寸重算；使用范围：关闭其它全屏编辑器；解耦评估：经专属网关直达唯一实现。 */
import {resize} from "./imports";
/** 用途：全局编辑器全屏状态写入；使用范围：普通 Protyle 切换；解耦评估：经专属网关直达环境访问器。 */
import {setSiyuanEditorIsFullscreen} from "./imports";
/** 用途：完整布局窗口类型；使用范围：标题拖拽区同步；解耦评估：纯类型不加载具体 Wnd。 */
import type {LayoutWindow} from "./imports";

/** 更新独立窗口顶部可拖拽区域。 */
function updateHeaderDragRegion(item: LayoutWindow, enter: boolean) {
    const headerElement = item.headersElement.parentElement;
    if (!headerElement || headerElement.getBoundingClientRect().top > 0) {
        return false;
    }
    const readonlyElement = headerElement.querySelector(".item--readonly .fn__flex-1");
    // 全屏内容覆盖标题区域时取消拖拽，退出后恢复。
    if (readonlyElement instanceof HTMLElement) {
        readonlyElement.style.WebkitAppRegion = enter ? "" : "drag";
        return true;
    }
    return false;
}

/** 查找顶部窗口并同步拖拽区域。 */
function updateLayoutDragRegion(enter: boolean) {
    const windows: LayoutWindow[] = [];
    const layout = getSiyuanLayout()?.layout;
    if (layout) {
        getAllWnds(layout, windows);
    }
    windows.find((item) => updateHeaderDragRegion(item, enter));
}

/** 同步桌面窗口控件层级。 */
function updateWindowControlsZIndex(enter: boolean) {
    if ("darwin" === getSiyuanConfig()?.system.os || isWindow()) {
        return;
    }
    const controls = document.getElementById("windowControls");
    if (!enter) {
        if (controls) {
            controls.style.zIndex = "";
        }
        return;
    }
    incrementSiyuanZIndex();
    if (controls) {
        controls.style.zIndex = getSiyuanZIndex().toString();
    }
}

/** 同步桌面窗口的全屏外观。 */
function updateWindowUI(enter: boolean) {
    if (isMobile) {
        return;
    }
    // 独立窗口存在自绘标题栏，需同步顶部可拖拽区域。
    if (isWindow()) {
        updateLayoutDragRegion(enter);
    }
    updateWindowControlsZIndex(enter);
}

/** 同步触发按钮与浮动 Dock 变换。 */
function updateButtonAndDock(element: Element, button: Element, enter: boolean) {
    const useElement = button.querySelector("use");
    useElement?.setAttribute("xlink:href", enter ? "#iconFullscreenExit" : "#iconFullscreen");
    const dockLayout = hasClosestByClassName(element, "layout--float");
    if (!dockLayout) {
        return;
    }
    if (enter) {
        dockLayout.setAttribute("data-temp", dockLayout.style.transform);
        dockLayout.style.transform = "none";
        return;
    }
    dockLayout.style.transform = dockLayout.getAttribute("data-temp") || "";
    dockLayout.removeAttribute("data-temp");
}

/** 同步普通编辑器全屏状态并关闭其它全屏编辑器。 */
function syncEditors(element: Element, enter: boolean) {
    if (isMobile) {
        return;
    }
    // 仅普通 Protyle 全屏参与全局编辑器状态；Graph/Card 等按钮式全屏不修改该标记。
    if (element.classList.contains("protyle")) {
        setSiyuanEditorIsFullscreen(enter);
    }
    for (const item of getAllModels().editor) {
        // 全局只允许当前目标编辑器保持全屏，其它实例恢复尺寸。
        if (element !== item.element && item.element.classList.contains("fullscreen")) {
            item.element.classList.remove("fullscreen");
            resize(item.editor.protyle);
        }
    }
}

/** 显式设置应用工作区元素的全屏状态；状态未变化时返回 false。 @同步豁免: UI构建 */
export function setApplicationFullscreen(element: Element, enter: boolean, button?: Element) {
    if (element.classList.contains("fullscreen") === enter) {
        return false;
    }
    // CSS 全屏过渡由 TIMEOUT_TRANSITION 统一定义；结束后再清理 gutter，避免动画中闪烁。
    setTimeout(() => hideAllElements(["gutter"]), Constants.TIMEOUT_TRANSITION);
    element.classList.toggle("fullscreen", enter);
    document.getElementById("drag")?.classList.toggle("fn__hidden", enter);
    updateWindowUI(enter);
    if (button) {
        updateButtonAndDock(element, button, enter);
        return true;
    }
    syncEditors(element, enter);
    return true;
}

/** 切换应用工作区元素全屏并同步窗口、Dock、按钮与其它编辑器。 @同步豁免: UI构建 */
export function toggleApplicationFullscreen(element: Element, button?: Element) {
    return setApplicationFullscreen(element, !element.classList.contains("fullscreen"), button);
}
