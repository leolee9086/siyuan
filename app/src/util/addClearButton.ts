import { siyuanI18n } from "./siyuanEnvironments/i18n.getI18n.environment";

const update = (inputElement: HTMLInputElement, clearElement: Element, right?: number) => {
    if (inputElement.value === "" && typeof right === "number") {
        inputElement.style.paddingRight = inputElement.dataset.oldPaddingRight || "";
    }
    if (inputElement.value === "") {
        clearElement.classList.add("fn__none");
        return;
    }

    clearElement.classList.remove("fn__none");
    if (typeof right === "number") {
        inputElement.style.setProperty("padding-right", `${right * 2 + clearElement.clientWidth}px`, "important");
    }
};

const clearInput = (inputElement: HTMLInputElement, clearElement: Element, right?: number, clearCB?: () => void) => {
    inputElement.value = "";
    inputElement.focus();
    update(inputElement, clearElement, right);
    if (clearCB) {
        clearCB();
    }
};
export const addClearButton = (options: {
    inputElement: HTMLInputElement,
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
