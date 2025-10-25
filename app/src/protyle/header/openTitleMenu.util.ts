export const closeTitleMenuIfOpened = () => {
    if (!window.siyuan.menus.menu.element.classList.contains("fn__none") &&
        window.siyuan.menus.menu.element.getAttribute("data-name") === "titleMenu") {
        window.siyuan.menus.menu.remove();
        return true;
    }
    else return false;
};
