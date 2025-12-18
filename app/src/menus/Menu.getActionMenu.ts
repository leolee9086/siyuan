
export const getActionMenu = (element: Element, next: boolean) => {
    let actionMenuElement: Element | null = element;
    while (actionMenuElement &&
        (actionMenuElement.classList.contains("b3-menu__separator") ||
            actionMenuElement.classList.contains("b3-menu__item--readonly") ||
            // https://github.com/siyuan-note/siyuan/issues/12518
            actionMenuElement.getBoundingClientRect().height === 0)) {
        if (actionMenuElement.querySelector(".b3-text-field")) {
            break;
        }
        actionMenuElement = next
            ? actionMenuElement.nextElementSibling
            : actionMenuElement.previousElementSibling;
    }
    return actionMenuElement;
};
