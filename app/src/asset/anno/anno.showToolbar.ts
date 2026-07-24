/** 用途：设置元素位置。使用范围：工具栏定位。解耦评估：通过 ./imports 转发。 */
import { setPosition } from "./imports";
/** 用途：清除 rect 元素。使用范围：工具栏状态管理。解耦评估：同目录模块。 */
import { clearRectElement } from "./state/selection";
/** 用途：设置 rect 元素。使用范围：工具栏状态管理。解耦评估：同目录模块。 */
import { setRectElement } from "./state/selection";

/**
 * 处理文本选区范围的工具栏定位
 * 
 * @作用 当用户选中PDF文本时，计算并设置工具栏在选区末尾的位置
 * @意图 将工具栏显示在用户操作的直接上下文中，提高交互效率
 * @调用时机 在 showToolbar 函数中处理有 range 参数的情况时调用
 * 
 * @param utilElement - 工具栏DOM元素
 * @param range - 文本选区范围对象
 */
const handleRange = (utilElement: HTMLElement, range: Range) => {
    utilElement.classList.add("pdf__util--hide");
    const rects = range.getClientRects();
    const rect = rects.item(rects.length - 1);
    if (rect) {
        setPosition(utilElement, rect.left, rect.bottom);
    }
    clearRectElement();
};

/**
 * 显示或更新PDF注释工具栏
 * 
 * @作用 根据不同的触发场景（选区、点击已有注释、右键菜单）显示工具栏并调整其按钮可见性
 * @意图 提供统一的交互入口，根据上下文展示相关的功能按钮
 * @调用时机 1. 文本选区改变时 2. 点击矩形注释时 3. PDF页面右键点击时
 * 
 * @param element - PDF查看器的容器元素
 * @param range - 可选的文本选区范围
 * @param target - 可选的触发目标（如已有的注释元素）
 * @param type - 可选的触发类型，为 "contextmenu" 时仅展示导出相关的按钮
 */
export const showToolbar = (element: HTMLElement, range?: Range, target?: HTMLElement, type?: "contextmenu") => {
    /** @同步豁免: 涉及DOM访问和位置计算，需要立即反馈UI状态 */
    if (target) {
        // 阻止 popover
        target.setAttribute("prevent-popover", "true");
        // 使用 requestAnimationFrame 替代 setTimeout，确保在下一帧重置属性，处理非确定性时机问题
        requestAnimationFrame(() => {
            target.removeAttribute("prevent-popover");
        });
    }

    const utilElement = element.querySelector(".pdf__util");
    if (!(utilElement instanceof HTMLElement)) {
        return;
    }
    utilElement.classList.remove("fn__none");

    /** 
     * 处理右键菜单触发时的按钮过滤逻辑
     * 生效场景：当用户通过右键（而非选区或点击注释）打开工具栏时，隐藏不相关的注释编辑按钮
     */
    const hideItems = utilElement.querySelectorAll(".pdf__util__hide");
    if (type === "contextmenu") {
        for (const item of Array.from(hideItems)) {
            /** @场景判断: 遍历所有需要根据上下文隐藏的工具项 */
            if (item instanceof HTMLElement) {
                item.classList.add("fn__none");
            }
        }
    }

    /** 
     * 处理恢复按钮显示的逻辑
     * 生效场景：在非右键打开时恢复显示被隐藏的工具项
     */
    if (type !== "contextmenu") {
        for (const item of Array.from(hideItems)) {
            /** @场景判断: 在非右键打开时恢复显示被隐藏的工具项 */
            if (item instanceof HTMLElement) {
                item.classList.remove("fn__none");
            }
        }
    }

    if (range) {
        handleRange(utilElement, range);
        return;
    }
    if (!target) {
        return;
    }
    setRectElement(target);
    utilElement.classList.remove("pdf__util--hide");
    const firstRectElement = target.firstElementChild;
    if (firstRectElement) {
        const targetRect = firstRectElement.getBoundingClientRect();
        setPosition(utilElement, targetRect.left, targetRect.top + targetRect.height + 4);
    }
};
