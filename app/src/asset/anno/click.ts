/** 用途：系统常量。使用范围：点击处理。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：安全获取存储。使用范围：点击状态管理。解耦评估：通过 ./imports 转发。 */
import { getSiyuanStorage } from "./imports";
/** 用途：存储值设置。使用范围：点击状态持久化。解耦评估：通过 ./imports 转发。 */
import { setStorageVal } from "./imports";
/** 用途：获取高亮选区坐标。使用范围：点击处理。解耦评估：同目录模块。 */
import { getHightlightCoordsByRange } from "./anno.getHightlightCoordsByRange";
/** 用途：显示高亮。使用范围：点击响应。解耦评估：同目录模块。 */
import { showHighlight } from "./anno.showHighlight";
/** 用途：按属性值安全查找同一标注矩形。使用范围：颜色更新时避免未可信 ID 进入 CSS selector。解耦评估：同目录 guard 统一所有标注 DOM 查找策略。 */
import { getRectElementsByNodeId } from "./anno.guard";
/** 用途：复制标注。使用范围：点击处理。解耦评估：同目录模块。 */
import { copyAnno } from "./anno.copy";
/** 用途：隐藏工具栏。使用范围：点击处理。解耦评估：同目录模块。 */
import { hideToolbar } from "./anno.hideToolbar";
/** 用途：获取配置。使用范围：点击处理。解耦评估：同目录模块。 */
import { getConfig } from "./config";
/** 用途：网络请求。使用范围：点击后请求数据。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：显示工具栏。使用范围：点击响应。解耦评估：同目录模块。 */
import { showToolbar } from "./anno.showToolbar";
/** 用途：通过类名查找祖先元素。使用范围：点击目标定位。解耦评估：通过 ./imports 转发。 */
import { hasClosestByClassName } from "./imports";
/** 用途：rect 元素引用。使用范围：点击处理。解耦评估：同目录模块。 */
import { rectElement } from "./state/selection";
/** 用途：设置 rect 元素。使用范围：点击处理。解耦评估：同目录模块。 */
import { setRectElement } from "./state/selection";
/** 用途：标注常量。使用范围：点击处理。解耦评估：同目录常量文件。 */
import { AnnoConstants } from "./constants";
/** 用途：PDF 实例类型。使用范围：点击处理类型标注。解耦评估：同目录类型文件。 */
import type { IPdfInstance } from "./anno.types";
/** 用途：创建工具栏操作上下文。使用范围：点击分发前收集当前注释状态。解耦评估：同目录 handler owner 负责动作协议。 */
import { createToolbarActionContext } from "./click.handleToolbarAction";
/** 用途：解析无状态工具栏动作。使用范围：点击分发按 data-type 获取 handler。解耦评估：同目录 handler owner 避免模块级可变 registry。 */
import { getToolbarAction } from "./click.handleToolbarAction";
/** 用途：外部事件点击处理。使用范围：全局点击事件。解耦评估：同目录子模块。 */
import { externalEventClickHandler } from "./click/handleExternalEvent";
/** 用途：获取窗口来源和选区。使用范围：点击事件处理。解耦评估：通过 ./imports 转发。 */
import { getLocationOrigin } from "./imports";
/** 用途：获取窗口选区。使用范围：点击事件处理。解耦评估：通过 ./imports 转发。 */
import { getWindowSelection } from "./imports";

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
    const rectItems = getRectElementsByNodeId(element, id);
    for (const rectItem of rectItems) {
        for (const item of Array.from(rectItem.children)) {
            // Element.children 返回 HTMLCollection<Element>，Element 类型没有 style 属性。
            // 需要通过 instanceof 检查确保元素是 HTMLElement 才能访问和修改其样式。
            // 实际场景中，注释矩形的子元素都是 div（HTMLElement），此检查主要用于 TypeScript 类型收窄。
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
            // 当选区跨越多行时，会生成多个高亮矩形元素（每行一个）。
            // 这些矩形共享同一个 nodeId，属于同一个注释。
            // 只需对第一个矩形执行以下操作：
            // 1. setRectElement：将其设为当前选中矩形，作为后续编辑操作的目标
            // 2. copyAnno：复制注释引用到剪贴板，供用户粘贴到笔记中
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
 * 在 mouseup 事件监听器中调用，用于检测PDF中的文本选区。
 *
 * @param element - 容器元素,用于工具栏的显示和隐藏操作
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 必须立即读取selection状态，异步会导致选区状态丢失 */
export const processSelection = (element: HTMLElement) => {
    const selection = getWindowSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    // 检查是否存在有效的文本选区：
    // 1. range 存在 - 用户确实有选区范围
    // 2. range.toString() !== "" - 选区非空，用户选中了实际文本而非只是点击
    // 3. hasClosestByClassName - 选区的公共祖先容器位于 PDF 查看器内部，确保是在 PDF 中选中的文本
    // 只有同时满足这三个条件，才说明用户在 PDF 中选中了有效文本，应该显示注释工具栏
    if (range && range.toString() !== "" &&
        hasClosestByClassName(range.commonAncestorContainer, AnnoConstants.CSS.PDF_VIEWER)) {
        showToolbar(element, range);
        return;
    }
    hideToolbar(element);
};


/**
 * 执行工具栏操作
 * 
 * 作用：
 * 根据操作类型从 resolver 中取得对应的处理函数并执行。支持的操作包括：
 * 移除注释、复制注释、关联注释、切换注释类型、下载注释为PNG等。
 * 
 * 意图：
 * 使用无状态 resolver 统一管理所有工具栏操作，避免模块级 registry 在 HMR 或测试之间残留。
 * 新动作只需在 getToolbarAction 的 switch 中增加稳定 action 分支。
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
    const handler = getToolbarAction(type);
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

    // 判断是否需要处理外部自定义事件（如快捷键触发的注释操作）
    // 生效场景：事件是 CustomEvent 类型且携带了 detail 信息
    if (externalEventClickHandler.guard(ctx)) {
        await externalEventClickHandler.handler(ctx, controller);
    }
    // 检查外部事件处理器是否已中止后续处理
    // 生效场景：外部处理器调用 controller.abort() 表示已完全处理事件
    if (signal.aborted) {
        return;
    }

    const target = event.target;
    // 类型守卫：确保事件目标是可样式化元素（HTMLElement 或 SVGElement）
    // 生效场景：理论上点击事件的 target 都是 Element，支持 HTML 和 SVG 元素的点击处理
    // 使用统一的类型守卫以支持 SVG 元素交互
    if (!(target instanceof HTMLElement || target instanceof SVGElement)) {
        return;
    }

    // 1. 处理颜色方块点击
    const colorSquare = target.closest(`.${AnnoConstants.CSS.COLOR_SQUARE}`);
    // 类型守卫：closest() 返回 Element | null，需要收窄为 HTMLElement
    // 生效场景：用户点击了颜色选择器方块，需要处理颜色选择以创建新注释或修改现有注释颜色
    // 实际中点击目标总是 HTMLElement，此检查同时完成空值判断和类型收窄
    if (colorSquare instanceof HTMLElement) {
        handleColorClick(colorSquare, element, pdf);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // 2. 处理PDF矩形点击（显示工具栏）
    const pdfRect = target.closest(`.${AnnoConstants.CSS.PDF_RECT}`);
    // 类型守卫：closest() 返回 Element | null，需要收窄为 HTMLElement
    // 生效场景：用户点击了 PDF 注释矩形，需要显示工具栏供用户编辑注释
    // 实际中点击目标总是 HTMLElement，此检查主要用于 TypeScript 类型收窄
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

};

