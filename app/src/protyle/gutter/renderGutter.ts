import { buildGutterHtml } from "./buildGutterHtml";
import { observeStandaloneGutterPosition, setGutterPosition } from "./setGutterPosition";

/**
 * 渲染编辑器侧边栏（Gutter）内容
 *
 * 这是 Gutter 渲染的核心函数，负责根据当前元素和目标位置渲染 Gutter 的内容。
 * 它会生成适当的按钮、图标和提示信息，并设置正确的位置。
 *
 * @param protyle 编辑器实例，包含编辑器的所有配置和状态
 * @param element 需要渲染 Gutter 的目标元素
 * @param options 渲染选项对象
 * @param options.target 可选的目标子元素，用于精确定位
 * @param options.gutterElement Gutter 的 DOM 元素容器
 * @param options.gutterTip Gutter 的提示文本，包含快捷键信息
 */
export const renderGutter = (protyle: IProtyle, element: Element, options: { target?: Element | undefined, gutterElement: HTMLElement, gutterTip: string }) => {
    // 检查标题是否已渲染完成，防止在标题未渲染时显示 Gutter
    // 参考: https://github.com/siyuan-note/siyuan/issues/4659
    if (protyle.title && protyle.title.element.getAttribute("data-render") !== "true") {
        return;
    }

    // 防止在文本选择时触碰图标导致高亮无法移除
    const selectElement = protyle.element.querySelector(".protyle-select");
    if (selectElement && !selectElement.classList.contains("fn__none")) {
        return;
    }

    // 确保内容元素存在
    if (!protyle.contentElement) {
        return;
    }

    const { target, gutterElement, gutterTip } = options;
    const result = buildGutterHtml(protyle, element, target, gutterTip, gutterElement);

    // 防止 Gutter 抖动，如果内容匹配且已有子元素，则不重新渲染
    // 参考: https://github.com/siyuan-note/siyuan/issues/4166
    if (result.match && gutterElement.childElementCount > 0) {
        gutterElement.classList.remove("fn__none");
        return;
    }

    // 更新 Gutter 内容
    gutterElement.innerHTML = result.html;
    gutterElement.classList.remove("fn__none");
    gutterElement.style.width = "";

    // 设置 Gutter 位置
    setGutterPosition(protyle, result.element, gutterElement, result.listItem, result.nodeElement, result.space);
    observeStandaloneGutterPosition({
        protyle,
        element: result.element,
        gutterElement,
        listItem: result.listItem,
        nodeElement: result.nodeElement,
        space: result.space,
    });

    // 追加块标边缘的框线（悬浮块标显示）与+号（悬浮框线显示），默认隐藏，由 mousemove 定位
    // 双元素：框线贴块标边缘不移动（避免闪烁），+号独立定位在外偏位置
    gutterElement.insertAdjacentHTML("beforeend", `<button class="protyle-gutters__line" data-type="gutterLineBefore" style="display:none"></button><button class="protyle-gutters__line" data-type="gutterLineAfter" style="display:none"></button><button class="protyle-gutters__plus ariaLabel" data-type="gutterPlusBefore" data-position="4west" aria-label="${window.siyuan.languages.insertBefore}" style="display:none"><svg><use xlink:href="#iconAdd"></use></svg></button><button class="protyle-gutters__plus ariaLabel" data-type="gutterPlusAfter" data-position="4west" aria-label="${window.siyuan.languages.insertAfter}" style="display:none"><svg><use xlink:href="#iconAdd"></use></svg></button>`);
};
