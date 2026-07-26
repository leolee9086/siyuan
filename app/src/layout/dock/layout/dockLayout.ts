/**
 * Dock 布局初始化：从当前全局布局树解析方位节点并同步装配尺寸分隔条。
 */

/** 用途：表示 Dock 挂载的完整布局节点；使用范围：方位解析与分隔条定位。 */
import type {LayoutDomain} from "./imports";
/** 用途：从异构布局树识别完整布局节点；使用范围：Dock 构造期方位解析；解耦评估：子域网关直达唯一守卫实现，避免具体 Layout class 与断言。 */
import {isLayoutDomain} from "./imports";
/** 用途：表示正在初始化的完整 Dock 聚合根；使用范围：写入布局状态与样式。 */
import type {DockDomain} from "./imports";

/**
 * 作用：把全局布局树候选值收窄为完整 LayoutDomain。
 * 意图：布局数组同时容纳窗口，Dock 初始化不得依赖具体 Layout class 或使用断言。
 * 调用时机：从全局布局树读取目标节点后立即执行。
 */
const resolveLayout = (candidate: object | undefined) => isLayoutDomain(candidate) ? candidate : undefined;

/**
 * 作用：取得目标布局之后的分隔条元素。
 * 意图：左侧 Dock 的调整手柄位于布局节点之后，并需以 DOM 类型检查收窄。
 * 调用时机：左侧 Dock 初始化布局时执行。
 */
const getNextResizeElement = (layout: LayoutDomain) => {
    const element = layout.element.nextElementSibling;
    return element instanceof HTMLElement ? element : undefined;
};

/**
 * 作用：取得目标布局之前的分隔条元素。
 * 意图：右侧和底部 Dock 共用相同 DOM 相邻关系与类型收窄。
 * 调用时机：右侧或底部 Dock 初始化布局时执行。
 */
const getPreviousResizeElement = (layout: LayoutDomain) => {
    const element = layout.element.previousElementSibling;
    return element instanceof HTMLElement ? element : undefined;
};

/**
 * 作用：按 Dock 方位从当前全局布局树解析挂载节点。
 * 意图：方位关系属于即时布局事实，不以模块级策略对象保存可变引用。
 * 调用时机：每个 Dock 实例构造并初始化布局时执行一次。
 */
const resolveDockLayout = (position: TDockPosition) => {
    const rootLayout = window.siyuan?.layout?.layout;
    const children = rootLayout?.children;
    if (position === "Bottom") {
        return resolveLayout(children?.[1]);
    }
    const firstChild = children?.[0];
    if (position === "Left") {
        return resolveLayout(firstChild?.children?.[0]);
    }
    return resolveLayout(firstChild?.children?.[2]);
};

/** 按 Dock 方位取得相邻的尺寸分隔条。 */
const resolveResizeElement = (position: TDockPosition, layout: LayoutDomain) =>
    position === "Left" ? getNextResizeElement(layout) : getPreviousResizeElement(layout);

/** 返回 Dock 方位对应的布局样式类。 */
const getDockLayoutClass = (position: TDockPosition) =>
    position === "Left" ? "layout__dockl" : position === "Right" ? "layout__dockr" : "layout__dockb";

/** 返回 Dock 方位对应的分隔条标记。 */
const getDockResizeHTML = (position: TDockPosition) => position === "Bottom"
    ? '<div class="layout__dockresize"></div>'
    : '<div class="layout__dockresize layout__dockresize--lr"></div>';

/**
 * 初始化 Dock 布局。
 * @同步豁免: UI构建 - Dock 构造函数必须在后续读取 elements 和绑定 resize 之前同步完成布局及分隔条装配。
 */
export function initDockLayout(dock: DockDomain, position: TDockPosition) {
    const layout = resolveDockLayout(position);
    if (!layout) {
        return;
    }
    const resizeElement = resolveResizeElement(position, layout);
    if (!resizeElement) {
        return;
    }
    dock.layout = layout;
    dock.resizeElement = resizeElement;
    dock.layout.element.classList.add(getDockLayoutClass(position));
    dock.layout.element.insertAdjacentHTML("beforeend", getDockResizeHTML(position));
}
