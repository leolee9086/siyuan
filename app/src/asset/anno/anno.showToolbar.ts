/** 用途：设置元素位置。使用范围：工具栏定位。解耦评估：通过 ./imports 转发。 */
import { isHTMLElement, setPosition } from "./imports";
/** 用途：清除 rect 元素。使用范围：工具栏状态管理。解耦评估：同目录模块。 */
import { clearRectElement, setRectElement } from "./state/selection";
/** 用途：隐藏矩形缩放手柄。使用范围：工具栏切换。解耦评估：复用 rectAnnotationResize 纯几何辅助。 */
import { hideRectResizeHandles } from "../rectAnnotationResize";

/** 处理文本选区范围的工具栏定位。 */
const handleRange = (utilElement: HTMLElement, range: Range) => {
    utilElement.classList.add("pdf__util--hide");
    const rects = range.getClientRects();
    const rect = rects.item(rects.length - 1);
    if (rect) {
        setPosition(utilElement, rect.left, rect.bottom);
    }
    clearRectElement();
};

const isRectAnnotationElement = (element: HTMLElement) => element.dataset.mode === "rect" ||
    (element.dataset.mode === "" && element.childElementCount === 1 &&
        /-P\d+-\d{14}-\w{7}$/.test(element.dataset.content || ""));

const syncToolbarMenu = (utilElement: HTMLElement, type?: "contextmenu") => {
    const hide = type === "contextmenu";
    for (const item of Array.from(utilElement.querySelectorAll(".pdf__util__hide"))) {
        if (!(item instanceof HTMLElement)) {
            continue;
        }
        if (hide) {
            item.classList.add("fn__none");
        }
        if (!hide) {
            item.classList.remove("fn__none");
        }
    }
};

const ensureRectHandles = (target: HTMLElement) => {
    if (!isRectAnnotationElement(target)) {
        return;
    }
    target.classList.add("pdf__rect--selected");
    const annotationElement = target.firstElementChild;
    if (!isHTMLElement(annotationElement)) {
        return;
    }
    for (const corner of ["nw", "ne", "sw", "se"] as const) {
        const handle = document.createElement("span");
        handle.className = `pdf__rect-resize pdf__rect-resize--${corner}`;
        annotationElement.append(handle);
    }
    const targetRect = annotationElement.getBoundingClientRect();
    for (const item of Array.from(annotationElement.querySelectorAll<HTMLElement>(".pdf__rect-resize"))) {
        const handleRect = item.getBoundingClientRect();
        const vertical = handleRect.top + handleRect.height / 2 < targetRect.top + targetRect.height / 2 ? "n" : "s";
        const horizontal = handleRect.left + handleRect.width / 2 < targetRect.left + targetRect.width / 2 ? "w" : "e";
        item.dataset.direction = vertical + horizontal;
    }
};

const placeToolbar = (target: HTMLElement, utilElement: HTMLElement) => {
    const firstRectElement = target.firstElementChild;
    if (!firstRectElement) {
        return;
    }
    const targetRect = firstRectElement.getBoundingClientRect();
    setPosition(utilElement, targetRect.left, targetRect.bottom + 4, targetRect.height + 8);
};

export const showToolbar = (
    element: HTMLElement,
    range?: Range,
    target?: HTMLElement,
    type?: "contextmenu",
) => {
    hideRectResizeHandles(element);
    if (target) {
        target.setAttribute("prevent-popover", "true");
        requestAnimationFrame(() => target.removeAttribute("prevent-popover"));
    }
    const utilElement = element.querySelector(".pdf__util");
    if (!(utilElement instanceof HTMLElement)) {
        return;
    }
    utilElement.classList.remove("fn__none");
    syncToolbarMenu(utilElement, type);
    if (range) {
        handleRange(utilElement, range);
        return;
    }
    if (!target) {
        return;
    }
    setRectElement(target);
    ensureRectHandles(target);
    utilElement.classList.remove("pdf__util--hide");
    placeToolbar(target, utilElement);
};
