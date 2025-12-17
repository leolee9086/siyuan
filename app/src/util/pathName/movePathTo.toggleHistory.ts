import { setStorageVal } from "../../ai/imports";
import { Constants } from "../../constants";
import { Menu } from "../../plugin/Menu";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { getSiyuanGlobalMenus } from "../siyuanEnvironments/getMenu.environment";
import { getSiyuanStorage } from "../siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../siyuanEnvironments/i18n.getI18n.environment";
import { escapeHtml } from "../escape";

/**
 * 创建切换移动路径历史记录菜单的处理函数
 */
export function 创建历史菜单切换器(
    inputElement: HTMLInputElement,
    inputEvent: (event?: InputEvent) => void
) {
    return () => {
        const storage = getSiyuanStorage();
        const movePath = storage[Constants.LOCAL_MOVE_PATH];
        const keys = movePath?.keys;
        if (!keys || keys.length === 0 || (keys.length === 1 && keys[0] === inputElement.value)) {
            return;
        }
        const menu = new Menu(Constants.MENU_MOVE_PATH_HISTORY);
        if (menu.isOpen) {
            return;
        }
        menu.element.classList.add("b3-menu--list");
        填充历史菜单(menu, keys as string[], inputElement, inputEvent);
        const rect = inputElement.getBoundingClientRect();
        menu.open({
            x: rect.left,
            y: rect.bottom
        });
    };
}

function 填充历史菜单(
    menu: Menu,
    keys: string[],
    inputElement: HTMLInputElement,
    inputEvent: (event?: InputEvent) => void
) {
    menu.addItem({
        iconHTML: "",
        label: siyuanI18n.clearHistory,
        click() {
            const storage = getSiyuanStorage();
            if (storage) {
                const movePath = storage[Constants.LOCAL_MOVE_PATH];
                movePath.keys = [];
                setStorageVal(Constants.LOCAL_MOVE_PATH, movePath);
            }
        }
    });
    const separatorElement = menu.addSeparator(1);
    let current = true;
    for (const s of keys) {
        if (s === inputElement.value || !s) {
            continue;
        }
        const menuItem = menu.addItem({
            iconHTML: "",
            label: escapeHtml(s),
            action: "iconCloseRound",
            bind(element) {
                element.addEventListener("click", (itemEvent) => {
                    处理历史菜单项点击(itemEvent, element, keys, s, inputElement, inputEvent);
                });
            }
        });
        if (current && menuItem) {
            menuItem.classList.add("b3-menu__item--current");
        }
        current = false;
    }
    if (current && separatorElement) {
        separatorElement.remove();
    }
}

/**
 * 处理历史菜单项的点击事件
 */
function 处理历史菜单项点击(
    itemEvent: MouseEvent,
    element: HTMLElement,
    keys: string[],
    s: string,
    inputElement: HTMLInputElement,
    inputEvent: (event?: InputEvent) => void
) {
    if (!hasClosestByClassName(itemEvent.target as Element, "b3-menu__action")) {
        inputElement.value = element.textContent ?? "";
        inputEvent();
        getSiyuanGlobalMenus().menu.remove();
        itemEvent.preventDefault();
        itemEvent.stopPropagation();
        return;
    }

    keys.find((item: string, index: number) => {
        if (item === s) {
            keys.splice(index, 1);
            return true;
        }
    });
    const storage = getSiyuanStorage();
    if (storage) {
        const movePath = storage[Constants.LOCAL_MOVE_PATH];
        movePath.keys = keys;
        setStorageVal(Constants.LOCAL_MOVE_PATH, movePath);
    }
    itemEvent.preventDefault();
    itemEvent.stopPropagation();
    const isPrevSeparator = element.previousElementSibling?.classList.contains("b3-menu__separator");
    if (isPrevSeparator && !element.nextElementSibling) {
        getSiyuanGlobalMenus().menu.remove();
        return;
    }
    element.remove();
}
