import { createToolbarItemElement } from "./ToolbarItem";
import { hasClosestBlock, hasClosestByAttribute } from "../util/hasClosest";

/**
 * 创建行内备注工具栏项
 *
 * 作用：渲染行内备注按钮并绑定点击行为
 * 意图：使用函数式渲染替代类继承实现
 * 调用时机：ToolbarItemFactory 在识别到 inline-memo 时调用
 */
export const createInlineMemoToolbarItem = (protyle: IProtyle, menuItem: IMenuItem): HTMLElement => {
    const element = createToolbarItemElement(protyle, menuItem);
    element.addEventListener("click", (event) => {
        showMemo(protyle, event);
    });
    return element;
};

const showMemo = (protyle: IProtyle, event: Event) => {
    protyle.toolbar.element.classList.add("fn__none");
    event.stopPropagation();

    const range = protyle.toolbar.range;
    const nodeElement = hasClosestBlock(range.startContainer);
    if (!nodeElement) {
        return;
    }
    const memoElement = hasClosestByAttribute(range.startContainer, "data-type", "inline-memo");
    if (memoElement && memoElement.textContent === range.toString()) {
        // https://github.com/siyuan-note/siyuan/issues/6569
        protyle.toolbar.showRender(protyle, memoElement);
        return;
    }

    if (range.toString() === "") {
        return;
    }

    protyle.toolbar.setInlineMark(protyle, "inline-memo", "range", {
        type: "inline-memo",
    });
};
