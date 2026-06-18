/** 用途：动态添加脚本到页面。使用范围：graphvizRender 加载 Viz.js。解耦评估：通过 imports.ts 转发。 */
import { addScript } from "./imports";
/** 用途：应用常量。使用范围：graphvizRender 配置项。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "./imports";
/** 用途：图标 HTML 生成。使用范围：graphvizRender 渲染状态图标。解耦评估：同目录工具模块。 */
import { genIconHTML } from "./util";
/** 用途：DOM 类型守卫。使用范围：graphvizRender 查找最近块元素。解耦评估：通过 imports.ts 转发。 */
import { hasClosestByClassName } from "./imports";

/**
 * 收集需要渲染的 Graphviz 元素
 *
 * 作用：从容器元素中提取所有 data-subtype="graphviz" 的元素
 * 意图：将元素收集逻辑从主函数中分离，保持主函数简洁
 * 调用时机：graphvizRender 入口处调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
function collectGraphvizElements(element: Element) {
    // 当元素本身就是 graphviz 代码块时（编辑器内代码块编辑渲染场景），直接返回
    if (element.getAttribute("data-subtype") === "graphviz") {
        return element.getAttribute("data-render") === "true" ? [] : [element];
    }
    return Array.from(element.querySelectorAll('[data-subtype="graphviz"]:not([data-render="true"])'));
}

/**
 * 使用 Viz.js 渲染 Graphviz DOT 源码为 SVG 并写入渲染容器
 *
 * 作用：调用 Viz 实例将 DOT 语言源码渲染为 SVG，成功时插入 SVG，失败时显示错误信息
 * 意图：将异步的 Viz 渲染逻辑封装为独立函数，便于错误处理和可读性
 * 调用时机：renderSingleGraphvizElement 中确认有 data-content 后调用
 */
const renderGraphvizSvg = async (renderElement: HTMLElement, dataContent: string) => {
    try {
        const viz = await Viz.instance();
        const svgElement = viz.renderSVGElement(Lute.UnEscapeHTMLStr(dataContent));
        renderElement.innerHTML = `<span style="position: absolute;left:0;top:0;width: 1px;">${Constants.ZWSP}</span><div contenteditable="false">${svgElement.outerHTML}</div>`;
    } catch (error) {
        renderElement.innerHTML = `<span style="position: absolute;left:0;top:0;width: 1px;">${Constants.ZWSP}</span><div class="ft__error" contenteditable="false">graphviz render error: <br>${error}</div>`;
    }
};

/**
 * 渲染单个 Graphviz 代码块元素
 *
 * 作用：将单个 Graphviz 代码块的 data-content 渲染为 SVG 图形
 * 意图：将单个元素的渲染逻辑封装，供 graphvizRender 循环调用
 * 调用时机：graphvizRender 遍历每个 Graphviz 元素时调用
 */
const renderSingleGraphvizElement = async (
    element: Element,
    wysiwygElement: HTMLElement | false
) => {
    // 已渲染的元素跳过，避免重复渲染
    if (element.getAttribute("data-render") === "true") {
        return;
    }
    // 首次渲染时元素尚未插入工具栏图标，需要补充插入
    if (!element.firstElementChild?.classList.contains("protyle-icons")) {
        element.insertAdjacentHTML("afterbegin", genIconHTML(wysiwygElement));
    }
    const renderElement = element.firstElementChild?.nextElementSibling;
    // renderElement 可能因 DOM 结构异常而不存在，需防御性检查
    if (!(renderElement instanceof HTMLElement)) {
        return;
    }
    // 需置于异步渲染前，否则快速滚动会导致重复渲染
    element.setAttribute("data-render", "true");
    const dataContent = element.getAttribute("data-content");
    // 无内容时仅保留占位符，不执行渲染
    if (!dataContent) {
        renderElement.innerHTML = `<span style="position: absolute;left:0;top:0;width: 1px;">${Constants.ZWSP}</span>`;
        return;
    }
    await renderGraphvizSvg(renderElement, dataContent);
};

/**
 * 渲染 Graphviz DOT 语言代码块为 SVG 图形
 *
 * 作用：加载 Viz.js 库并将页面中的 Graphviz 代码块渲染为可视化 SVG 图形
 * 意图：作为 Graphviz 渲染的统一入口，协调资源加载和批量渲染
 * 调用时机：编辑器初始化、代码块内容变更、或导出预览时由 protyle 渲染管线调用
 */
export const graphvizRender = async (element: Element, cdn = Constants.PROTYLE_CDN) => {
    const graphvizElements = collectGraphvizElements(element);
    // 无 Graphviz 元素时直接返回，避免不必要的脚本加载
    if (graphvizElements.length === 0) {
        return;
    }
    await addScript(`${cdn}/js/graphviz/viz.js?v=3.11.0`, "protyleGraphVizScript");
    const wysiwygElement = hasClosestByClassName(element, "protyle-wysiwyg", true);
    for (const e of graphvizElements) {
        await renderSingleGraphvizElement(e, wysiwygElement);
    }
};
