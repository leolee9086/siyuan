import { Constants } from "../../constants";
import { getSiyuanStorage } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { setStorageVal } from "../../protyle/util/compatibility";
import { getHightlightCoordsByRange } from "../anno.getHightlightCoordsByRange";
import { showHighlight } from "../anno.showHighlight";
import { copyAnno } from "../anno.copy";
import { hideToolbar } from "../anno.hideToolbar";
import { getConfig } from "../anno.config";
import { fetchPost } from "../../util/fetch";
import { showToolbar } from "../anno.showToolbar";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { rectElement, setRectElement } from "../anno";
import { AnnoConstants } from "../anno.constants";
import type { IPdfInstance } from "../anno.types";
import { createToolbarActionContext, toolbarActionRegistry } from "./click.handleToolbarAction";
import { externalEventClickHandler } from "./click.handleExternalEvent";
import { getLocationOrigin, getWindowSelection } from "../../util/siyuanEnvironments/windowStandard.environment";

/**
 * 更新已存在的注释颜色
 * 
 * 作用：
 * 修改当前选中注释的颜色,并更新配置和UI显示。包括:
 * 1. 更新配置对象中的颜色值
 * 2. 更新DOM中所有相关矩形元素的边框和背景色
 * 3. 将更新后的配置保存到服务器
 * 
 * 意图:
 * 允许用户在创建注释后修改其颜色,提供灵活的注释管理能力。
 * 
 * 调用时机:
 * 在 handleColorClick 函数中,当用户点击颜色选择器且 rectElement 存在时被调用(第 68 行)。
 * 表示用户正在修改已存在的注释,而非创建新注释。
 * 
 * @param color - 新的颜色值,格式为 CSS 颜色字符串(如 "rgb(255, 0, 0)")
 * @param element - 容器元素,用于查找和更新注释的DOM元素
 * @param pdf - PDF实例对象,用于获取文件路径和配置
 */
const updateExistingAnnotation = (color: string, element: HTMLElement, pdf: IPdfInstance) => {
    const config = getConfig(pdf);
    const id = rectElement?.getAttribute(AnnoConstants.ATTR.DATA_NODE_ID);
    if (!id) {
        return;
    }

    const annoItem = config[id];
    if (!annoItem) {
        return;
    }

    annoItem.color = color;
    const rectItems = element.querySelectorAll(`.${AnnoConstants.CSS.PDF_RECT}[${AnnoConstants.ATTR.DATA_NODE_ID}="${id}"]`);
    for (const rectItem of rectItems) {
        for (const item of Array.from(rectItem.children)) {
            if (item instanceof HTMLElement) {
                item.style.border = "2px solid " + color;
                item.style.backgroundColor = annoItem.type === "text" ? color : "transparent";
            }
        }
    }
    fetchPost("/api/asset/setFileAnnotation", {
        path: pdf.appConfig.file.replace(getLocationOrigin(), "").substr(1) + ".sya",
        data: JSON.stringify(config),
    });
};

/**
 * 创建新注释
 * 
 * 作用:
 * 基于当前文本选区创建新的高亮注释。包括:
 * 1. 从选区获取高亮坐标信息
 * 2. 在PDF上显示高亮矩形
 * 3. 设置第一个矩形为当前选中元素
 * 4. 复制注释引用到剪贴板
 * 
 * 意图:
 * 将用户选中的文本转换为可视化的注释,并自动复制引用以便快速插入到笔记中。
 * 
 * 调用时机:
 * 在 handleColorClick 函数中,当用户点击颜色选择器且 rectElement 不存在时被调用(第 72 行)。
 * 表示用户正在创建新注释,而非修改已存在的注释。
 * 
 * @param color - 高亮颜色,格式为 CSS 颜色字符串
 * @param pdf - PDF实例对象,包含当前PDF的配置和状态信息
 */
const createNewAnnotation = (color: string, pdf: IPdfInstance) => {
    const coords = getHightlightCoordsByRange(pdf, color);
    if (coords) {
        for (const [index, item] of coords.entries()) {
            const newElement = showHighlight(item, pdf);
            if (index === 0) {
                setRectElement(newElement);
                copyAnno(`${pdf.appConfig.file.replace(getLocationOrigin(), "").substr(1)}/${newElement.getAttribute(AnnoConstants.ATTR.DATA_NODE_ID)}`,
                    pdf.appConfig.file.replace(getLocationOrigin(), "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
            }
        }
    }
};

/**
 * 处理颜色选择器点击事件
 * 
 * 作用:
 * 响应用户点击颜色方块的操作。包括:
 * 1. 获取点击的颜色值
 * 2. 保存颜色到本地存储作为默认颜色
 * 3. 根据是否存在选中注释,决定更新现有注释或创建新注释
 * 4. 隐藏工具栏
 * 
 * 意图:
 * 统一处理颜色选择逻辑,支持创建和修改两种场景,同时记住用户的颜色偏好。
 * 
 * 调用时机:
 * 在 handlePdfClick 函数中,当检测到点击目标是颜色方块时被调用(第 127 行)。
 * 
 * @param target - 被点击的颜色方块元素,通过其 backgroundColor 获取颜色值
 * @param element - 容器元素,用于DOM操作
 * @param pdf - PDF实例对象
 */
const handleColorClick = (target: HTMLElement, element: HTMLElement, pdf: IPdfInstance) => {
    const color = target.style.backgroundColor;
    const pdfTheme = getSiyuanStorage()[Constants.LOCAL_PDFTHEME];
    pdfTheme.annoColor = color;
    setStorageVal(Constants.LOCAL_PDFTHEME, pdfTheme);

    if (rectElement) {
        updateExistingAnnotation(color, element, pdf);
        hideToolbar(element);
        return;
    }
    createNewAnnotation(color, pdf);
    hideToolbar(element);
};




/**
 * 处理文本选区
 * 
 * 作用:
 * 检查当前是否有有效的文本选区,并决定是否显示工具栏。包括:
 * 1. 获取当前选区和范围
 * 2. 验证选区是否非空且在PDF查看器内
 * 3. 显示或隐藏工具栏
 * 
 * 意图:
 * 确保工具栏只在有效选区时显示,避免在无效场景下干扰用户。
 * 
 * 调用时机:
 * 在 handleSelection 函数中通过 setTimeout 异步调用(第 91 行)。
 * 延迟执行是为了确保选区状态已稳定,避免在选区变化过程中进行判断。
 * 
 * @param element - 容器元素,用于工具栏的显示和隐藏操作
 */
const processSelection = (element: HTMLElement) => {
    const selection = getWindowSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (range && range.toString() !== "" &&
        hasClosestByClassName(range.commonAncestorContainer, AnnoConstants.CSS.PDF_VIEWER)) {
        showToolbar(element, range);
        return;
    }
    hideToolbar(element);
};

/**
 * 异步处理选区事件
 * 
 * 作用:
 * 延迟执行选区处理逻辑,确保选区状态已经稳定。
 * 
 * 意图:
 * 在文本选择操作完成后的下一个事件循环中处理选区,避免在选区变化过程中执行判断。
 * 这是因为浏览器在 mouseup 等事件触发时,选区可能尚未完全确定。
 * 
 * 调用时机:
 * 在 handlePdfClick 函数的默认分支中被调用(第 165 行)。
 * 当用户点击未匹配到其他特定交互元素时,检查是否有新的文本选区。
 * 
 * @param element - 容器元素,传递给 processSelection 函数
 */
const handleSelection = (element: HTMLElement) => {
    setTimeout(() => processSelection(element));
};

/**
 * 执行工具栏操作
 * 
 * 作用：
 * 根据操作类型从注册表中查找对应的处理函数并执行。支持的操作包括：
 * 移除注释、复制注释、关联注释、切换注释类型、下载注释为PNG等。
 * 
 * 意图：
 * 使用策略模式统一管理所有工具栏操作,避免冗长的 if-else 或 switch 语句。
 * 通过注册表模式使代码更易维护和扩展,添加新操作只需在 toolbarActionRegistry 中注册即可。
 * 
 * 调用时机：
 * 在 handlePdfClick 函数中,当用户点击工具栏按钮时被调用(第 149 行)。
 * 具体场景是点击目标具有 data-type 属性,该属性值对应操作类型(如 remove、copy 等)。
 * 
 * @param type - 操作类型,对应 AnnoConstants.ACTION 中定义的常量
 * @param pdf - PDF实例对象,包含当前PDF的配置和状态
 * @param element - 容器元素,用于DOM操作(如查找/移除注释元素、隐藏工具栏等)
 */
const executeToolbarAction = (type: string, pdf: IPdfInstance, element: HTMLElement) => {
    const handler = toolbarActionRegistry[type];
    if (handler) {
        const context = createToolbarActionContext(pdf, element);
        handler(context);
    }
};

/**
 * 处理PDF点击事件的主入口函数
 * 
 * 作用:
 * 统一处理PDF查看器中的所有点击事件,包括:
 * 1. 处理自定义事件(如快捷键触发的事件)
 * 2. 处理颜色选择器点击
 * 3. 处理PDF注释矩形点击(显示工具栏)
 * 4. 处理工具栏操作按钮点击
 * 5. 处理文本选区相关操作
 * 
 * 意图:
 * 作为事件分发中心,将不同类型的点击事件路由到对应的处理函数。
 * 使用责任链模式,从最具体的交互(颜色选择器、矩形、工具栏按钮)到最通用的交互(选区处理)依次判断。
 * 支持通过 AbortController 中断事件处理流程,允许外部事件处理器阻止后续处理。
 * 
 * 调用时机:
 * 注册为PDF查看器容器的点击事件监听器,在用户点击PDF区域时被调用。
 * 同时也可以通过自定义事件(CustomEvent)以编程方式触发。
 * 
 * 问题/改进:
 * - 当前使用 closest 查找可能影响性能,可考虑事件委托优化
 * - AbortController 的使用场景需要更明确的文档说明
 * 
 * @param event - 鼠标点击事件或自定义事件
 * @param element - PDF容器元素,用于DOM查询和工具栏操作
 * @param pdf - PDF实例对象,包含配置和状态信息
 */
export const handlePdfClick = async (event: MouseEvent | CustomEvent, element: HTMLElement, pdf: IPdfInstance) => {
    // 处理自定义事件（例如来自快捷键或其他组件的事件）
    const controller = new AbortController();
    const signal = controller.signal;
    signal.addEventListener("abort", (reason) => {
        console.log("Abort signal received:", reason);
    });
    //处理自定义事件
    const ctx = { event, element, pdf };

    if (externalEventClickHandler.guard(ctx)) {
        await externalEventClickHandler.handler(ctx, controller);
    }
    if (signal.aborted) {
        return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }

    // 1. 处理颜色方块点击
    const colorSquare = target.closest(`.${AnnoConstants.CSS.COLOR_SQUARE}`);
    if (colorSquare instanceof HTMLElement) {
        handleColorClick(colorSquare, element, pdf);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // 2. 处理PDF矩形点击（显示工具栏）
    const pdfRect = target.closest(`.${AnnoConstants.CSS.PDF_RECT}`);
    if (pdfRect instanceof HTMLElement) {
        showToolbar(element, undefined, pdfRect);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // 3. 处理工具栏操作
    const actionBtn = target.closest(`[${AnnoConstants.ATTR.DATA_TYPE}]`);
    const type = actionBtn?.getAttribute(AnnoConstants.ATTR.DATA_TYPE);
    if (type) {
        // 确保我们在工具栏或相关容器内（如果需要），
        // 但原始代码只检查了属性。
        // 我们还应该检查它不是pdf__outer本身，但closest处理了这一点。
        executeToolbarAction(type, pdf, element);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // 4. 处理选择（默认行为检查）
    // 仅在我们没有匹配到特定交互元素时
    // 但是等等，原始代码有一个在`pdf__outer`处中断的`while`循环。
    // 如果我们在`pdf__outer`内部点击了上面未处理的其他内容，我们会继续执行。
    // 原始代码在循环中还检查了`!target.classList.contains("pdf__outer")`。
    // 这里`closest`在找不到时自然停止。

    // 然而, 我们需要确保我们不处理PDF区域*外部*的点击（如果这是意图的话），
    // 但监听器附加到`element`（这可能是容器）。

    handleSelection(element);
};
