import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { MenuItem } from "../../../menus/Menu.Item";

export const showSortMenu = (sort: string, treeElement: HTMLElement, onSearch: () => void) => {
    const clickEvent = (currentSort: string) => {
        const sortElement = treeElement.previousElementSibling?.querySelector('[data-type="sort"]');
        if (sortElement) {
            sortElement.setAttribute("data-sort", currentSort);
        }
        onSearch();
    };
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.append(new MenuItem({
        icon: sort === "0" ? "iconSelect" : undefined,
        label: siyuanI18n.fileNameASC,
        click: () => {
            clickEvent("0");
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        icon: sort === "1" ? "iconSelect" : undefined,
        label: siyuanI18n.fileNameDESC,
        click: () => {
            clickEvent("1");
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        icon: sort === "4" ? "iconSelect" : undefined,
        label: siyuanI18n.fileNameNatASC,
        click: () => {
            clickEvent("4");
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        icon: sort === "5" ? "iconSelect" : undefined,
        label: siyuanI18n.fileNameNatDESC,
        click: () => {
            clickEvent("5");
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({ type: "separator" }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        icon: sort === "9" ? "iconSelect" : undefined,
        label: siyuanI18n.createdASC,
        click: () => {
            clickEvent("9");
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        icon: sort === "10" ? "iconSelect" : undefined,
        label: siyuanI18n.createdDESC,
        click: () => {
            clickEvent("10");
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        icon: sort === "2" ? "iconSelect" : undefined,
        label: siyuanI18n.modifiedASC,
        click: () => {
            clickEvent("2");
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        icon: sort === "3" ? "iconSelect" : undefined,
        label: siyuanI18n.modifiedDESC,
        click: () => {
            clickEvent("3");
        }
    }).element);
};
