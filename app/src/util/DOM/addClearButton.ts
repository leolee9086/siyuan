/**
 * 读取输入控件当前文本，兼容 input、textarea 和 contenteditable 场景。
 * 调用时机：清空按钮初始化与输入变化时同步调用。
 * 问题/改进：当前针对文本类控件建模，若未来需要支持更多可编辑元素可继续扩展。
 */
const getInputValue = (inputElement: HTMLElement) => {
    const isHtmlInput = inputElement instanceof HTMLInputElement;
    if (isHtmlInput) {
        return inputElement.value;
    }
    const isTextArea = inputElement instanceof HTMLTextAreaElement;
    if (isTextArea) {
        return inputElement.value;
    }
    return inputElement.textContent || "";
};

/**
 * 清空输入控件当前文本，保持对 input、textarea 与 contenteditable DIV 的兼容。
 * 调用时机：用户点击清空按钮后同步调用。
 * 问题/改进：当前沿用同步写 DOM 的方式，便于在同一事件循环内立即更新状态。
 */
const clearInputValue = (inputElement: HTMLElement) => {
    const isHtmlInput = inputElement instanceof HTMLInputElement;
    if (isHtmlInput) {
        inputElement.value = "";
        return;
    }
    const isTextArea = inputElement instanceof HTMLTextAreaElement;
    if (isTextArea) {
        inputElement.value = "";
        return;
    }
    inputElement.textContent = "";
};

/**
 * 在清空后恢复输入框原始右侧留白，避免按钮消失后仍保留额外空间。
 * 调用时机：清空按钮需要隐藏时同步调用。
 * 问题/改进：当前只恢复 `padding-right`，后续如需恢复更多样式可扩展为通用样式快照。
 */
const restoreInputSpacing = (inputElement: HTMLElement, right?: number) => {
    const hasRightOffset = typeof right === "number";
    if (!hasRightOffset) {
        return;
    }
    inputElement.style.paddingRight = inputElement.dataset.oldPaddingRight || "";
};

/**
 * 根据按钮宽度和输入类型设置右侧留白，避免文本覆盖清空按钮。
 * 调用时机：输入框存在内容且清空按钮可见时同步调用。
 * 问题/改进：目前仍使用内联样式，后续如有统一输入组件可迁回样式层。
 */
const applyInputSpacing = (inputElement: HTMLElement, clearElement: Element, right?: number) => {
    const hasRightOffset = typeof right === "number";
    if (!hasRightOffset) {
        return;
    }
    const usesMarginRight = inputElement.isContentEditable;
    const spacingProperty = usesMarginRight ? "margin-right" : "padding-right";
    const clearElementWidth = clearElement.getBoundingClientRect().width;
    const spacingValue = `${right * 2 + clearElementWidth}px`;
    inputElement.style.setProperty(spacingProperty, spacingValue, "important");
};

/**
 * 按输入内容更新清空按钮显隐和输入框右侧留白。
 * 调用时机：初始化按钮、输入事件触发、点击清空按钮后都会同步调用。
 * 问题/改进：目前使用内容是否为空作为唯一判定标准，如后续支持只读态可继续补充分支。
 */
const updateClearButtonState = (inputElement: HTMLElement, clearElement: Element, right?: number) => {
    const value = getInputValue(inputElement);
    const isEmpty = value === "";
    if (isEmpty) {
        clearElement.classList.add("fn__none");
        restoreInputSpacing(inputElement, right);
        return;
    }
    clearElement.classList.remove("fn__none");
    applyInputSpacing(inputElement, clearElement, right);
};

/**
 * 生成清空按钮的内联样式字符串，复用历史参数以避免影响现有调用方。
 * 调用时机：`addClearButton` 插入 SVG 按钮前同步调用。
 * 问题/改进：样式字符串仍由函数拼装，若未来按钮组件化可迁移到模板层。
 */
const buildButtonStyle = (options: {
    right?: number;
    width?: string;
    height?: number;
}) => {
    let style = "";
    const hasRightOffset = typeof options.right === "number";
    if (hasRightOffset) {
        style += `right: ${options.right}px;`;
    }
    const hasHeight = typeof options.height === "number";
    if (hasHeight) {
        style += `height:${options.height}px;`;
    }
    const hasWidth = !!options.width;
    if (hasWidth) {
        style += `width:${options.width};`;
    }
    return style;
};

/**
 * 响应清空按钮点击，清空内容并立即回写按钮状态。
 * 调用时机：`addClearButton` 绑定点击事件时复用该处理器。
 * 问题/改进：当前通过参数直传上下文，后续若按钮组件化可迁移到组件内部状态管理。
 */
const handleClearButtonClick = (
    inputElement: HTMLElement,
    clearElement: Element,
    right: number | undefined,
    clearCB?: () => void
) => {
    clearInputValue(inputElement);
    inputElement.focus();
    updateClearButtonState(inputElement, clearElement, right);
    clearCB?.();
};

/**
 * 为输入控件插入清空按钮，并绑定点击与输入联动逻辑。
 * 调用时机：搜索框、关系筛选框等需要即时清空交互的输入区域初始化时调用。
 * 问题/改进：当前通过插入相邻 SVG 的方式保持兼容，后续若统一表单组件可迁移到组件层。
 * @同步豁免: 需要绝对同步的DOM访问
 * @AIDONE 文案改为由参数传递，不再直接依赖国际化模块
 */
export const addClearButton = (options: {
    inputElement: HTMLElement;
    clearCB?: () => void;
    right?: number;
    width?: string;
    height?: number;
    className?: string;
    clearAriaLabel?: string;
}) => {
    options.inputElement.dataset.oldPaddingRight = options.inputElement.style.paddingRight;
    const className = options.className || "b3-form__icon-clear";
    const style = buildButtonStyle(options);
    const clearAriaLabel = options.clearAriaLabel;
    if(!clearAriaLabel) {
        throw new Error("addClearButton: 未提供清除按钮的 aria-label。");
    }
    options.inputElement.insertAdjacentHTML(
        "afterend",
        `<svg class="${className} ariaLabel" aria-label="${clearAriaLabel}" style="${style}"><use xlink:href="#iconCloseRound"></use></svg>`
    );
    const clearElement = options.inputElement.nextElementSibling;
    const hasClearElement = !!clearElement;
    if (!hasClearElement) {
        return;
    }
    clearElement.addEventListener("click", () => handleClearButtonClick(options.inputElement, clearElement, options.right, options.clearCB));
    options.inputElement.addEventListener("input", () => {
        updateClearButtonState(options.inputElement, clearElement, options.right);
    });
    updateClearButtonState(options.inputElement, clearElement, options.right);
};
