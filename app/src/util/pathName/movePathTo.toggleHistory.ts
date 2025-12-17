import { setStorageVal } from "../../ai/imports";
import { Constants } from "../../constants";
import { Menu } from "../../plugin/Menu";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { escapeHtml } from "../escape";

/**
 * 创建切换移动路径历史记录菜单的处理函数
 */
export function 创建历史菜单切换器(
    inputElement: HTMLInputElement,
    inputEvent: (event?: InputEvent) => void
) {
    return () => {
        const keys = window.siyuan.storage?.[Constants.LOCAL_MOVE_PATH]?.keys;
        if (!keys || keys.length === 0 || (keys.length === 1 && keys[0] === inputElement.value)) {
            return;
        }
        const menu = new Menu(Constants.MENU_MOVE_PATH_HISTORY);
        if (menu.isOpen) {
            return;
        }
        menu.element.classList.add("b3-menu--list");
        menu.addItem({
            iconHTML: "",
            label: window.siyuan.languages?.clearHistory,
            click() {
                if (window.siyuan.storage) {
                    window.siyuan.storage[Constants.LOCAL_MOVE_PATH].keys = [];
                    setStorageVal(Constants.LOCAL_MOVE_PATH, window.siyuan.storage[Constants.LOCAL_MOVE_PATH]);
                }
            }
        });
        const separatorElement = menu.addSeparator(1);
        let current = true;
        for (const s of keys as string[]) {
            if (s !== inputElement.value && s) {
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
        }
        if (current && separatorElement) {
            separatorElement.remove();
        }
        const rect = inputElement.getBoundingClientRect();
        menu.open({
            x: rect.left,
            y: rect.bottom
        });
    };
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
    if (hasClosestByClassName(itemEvent.target as Element, "b3-menu__action")) {
        keys.find((item: string, index: number) => {
            if (item === s) {
                keys.splice(index, 1);
                return true;
            }
        });
        if (window.siyuan.storage) {
            window.siyuan.storage[Constants.LOCAL_MOVE_PATH].keys = keys;
            setStorageVal(Constants.LOCAL_MOVE_PATH, window.siyuan.storage[Constants.LOCAL_MOVE_PATH]);
        }
        const isPrevSeparator = element.previousElementSibling?.classList.contains("b3-menu__separator");
        if (isPrevSeparator && !element.nextElementSibling) {
            window.siyuan.menus?.menu.remove();
        } else {
            element.remove();
        }
    } else {
        inputElement.value = element.textContent ?? "";
        inputEvent();
        window.siyuan.menus?.menu.remove();
    }
    itemEvent.preventDefault();
    itemEvent.stopPropagation();
}
