// S-forge: 保留 siyuanI18n 封装，同时采用远程的 DIV 支持功能
import { siyuanI18n } from "../siyuanEnvironments/i18n.getI18n.environment";

// S-forge: 移植上游改进 - 支持清空时恢复原始padding，支持contenteditable元素的margin-right
const update = (inputElement: HTMLElement, clearElement: Element, right?: number) => {
    let value = "";
    if (inputElement.tagName === "DIV") {
        value = inputElement.textContent || "";
    } else {
        value = (inputElement as HTMLInputElement).value;
    }

    if (value === "") {
        clearElement.classList.add("fn__none");
        // S-forge: 移植上游改进 - 清空时恢复原始padding
        if (typeof right === "number") {
            inputElement.style.paddingRight = inputElement.dataset.oldPaddingRight || "";
        }
        return;
    }

    clearElement.classList.remove("fn__none");
    if (typeof right === "number") {
        // S-forge: 移植上游改进 - 数据库搜索需设置margin-right（contenteditable元素）
        const styleProperty = inputElement.getAttribute("contenteditable") ? "margin-right" : "padding-right";
        inputElement.style.setProperty(styleProperty, `${right * 2 + clearElement.clientWidth}px`, "important");
    }
};

// S-forge: 更新 clearInput 以支持 DIV 元素（采用远程的 DIV 支持功能）
const clearInput = (inputElement: HTMLElement, clearElement: Element, right?: number, clearCB?: () => void) => {
    if (inputElement.tagName === "DIV") {
        inputElement.textContent = "";
    } else {
        (inputElement as HTMLInputElement).value = "";
    }
    inputElement.focus();
    update(inputElement, clearElement, right);
    if (clearCB) {
        clearCB();
    }
};
export const addClearButton = (options: {
    inputElement: HTMLElement,
    clearCB?: () => void,
    right?: number,
    width?: string,
    height?: number
    className?: string
}) => {
    options.inputElement.dataset.oldPaddingRight = options.inputElement.style.paddingRight;
    options.inputElement.insertAdjacentHTML("afterend",
        `<svg class="${options.className || "b3-form__icon-clear"} ariaLabel" aria-label="${siyuanI18n.clear}" style="${options.right ? "right: " + options.right + "px;" : ""}${options.height ? "height:" + options.height + "px;" : ""}${options.width ? "width:" + options.width : ""}">
<use xlink:href="#iconCloseRound"></use></svg>`);
    const clearElement = options.inputElement.nextElementSibling;
    if (!clearElement) {
        return;
    }
    clearElement.addEventListener("click", () => {
        clearInput(options.inputElement, clearElement, options.right, options.clearCB);
    });
    options.inputElement.addEventListener("input", () => {
        update(options.inputElement, clearElement, options.right);
    });
    update(options.inputElement, clearElement, options.right);
};
