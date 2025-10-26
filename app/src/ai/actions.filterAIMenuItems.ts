import { switchFnNoneByFlag } from "../util/DOM/fnClasses";

export const filterAIMenuItems = (element: HTMLElement, inputElement: HTMLInputElement) => {
    element.querySelectorAll(".b3-list-item").forEach(item => {
        const hasText = item.textContent.indexOf(inputElement.value) > -1;
        switchFnNoneByFlag(item, !hasText);
    });
    element.querySelectorAll(".b3-menu__separator").forEach(item => {
        switchFnNoneByFlag(item, !!inputElement.value);
    });
    element.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
    element.querySelector(".b3-list-item:not(.fn__none)")?.classList.add("b3-list-item--focus");
};
