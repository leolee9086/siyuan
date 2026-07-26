import {Constants} from "../constants";
import {Menu} from "../plugin/Menu";
import {setStorageVal} from "../util/storage/setStorageVal";
import {escapeHtml} from "../util/DOM/escape";
import {hasClosestByClassName} from "../protyle/util/hasClosest";
import type {ProtyleDomain} from "../protyle/protyle.types";
import {assetInputEvent} from "./assets";
import {updateSearchResult} from "../mobile/menu/search";
import {inputEvent} from "./util";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import {isMobile} from "../platform";
/** 用途：保留资源历史保存的既有公开 API；使用范围：搜索历史菜单兼容出口；解耦评估：真实实现位于独立持久化子域，本模块只维持同一函数身份。 */
import {saveAssetKeyList} from "./history/storage";
/** 用途：保留搜索词历史保存的既有公开 API；使用范围：搜索历史菜单兼容出口；解耦评估：真实实现位于独立持久化子域，本模块只维持同一函数身份。 */
import {saveKeyList} from "./history/storage";

/** 导出资源搜索词历史保存能力。 */
export {saveAssetKeyList};
/** 导出普通搜索与替换词历史保存能力。 */
export {saveKeyList};

export const toggleReplaceHistory = (replaceInputElement: HTMLInputElement) => {
    const list = window.siyuan.storage[Constants.LOCAL_SEARCHKEYS];
    if (!list.replaceKeys || list.replaceKeys.length === 0 || (list.length === 1 && list[0] === replaceInputElement.value)) {
        return;
    }
    const menu = new Menu(Constants.MENU_SEARCH_REPLACE_HISTORY);
    if (menu.isOpen) {
        return;
    }
    menu.element.classList.add("b3-menu--list");
    menu.addItem({
        iconHTML: "",
        label: siyuanI18n.clearHistory,
        click() {
            window.siyuan.storage[Constants.LOCAL_SEARCHKEYS].replaceKeys = [];
            setStorageVal(Constants.LOCAL_SEARCHKEYS, window.siyuan.storage[Constants.LOCAL_SEARCHKEYS]);
        }
    });
    const separatorElement = menu.addSeparator(1);
    let current = true;
    list.replaceKeys.forEach((s: string) => {
        if (s !== replaceInputElement.value && s) {
            const menuItem = menu.addItem({
                iconHTML: "",
                label: escapeHtml(s),
                action: "iconCloseRound",
                bind(element) {
                    element.addEventListener("click", (itemEvent) => {
                        if (hasClosestByClassName(itemEvent.target as Element, "b3-menu__action")) {
                            list.replaceKeys.find((item: string, index: number) => {
                                if (item === s) {
                                    list.replaceKeys.splice(index, 1);
                                    return true;
                                }
                            });
                            window.siyuan.storage[Constants.LOCAL_SEARCHKEYS].replaceKeys = list.replaceKeys;
                            setStorageVal(Constants.LOCAL_SEARCHKEYS, window.siyuan.storage[Constants.LOCAL_SEARCHKEYS]);
                            if (element.previousElementSibling?.classList.contains("b3-menu__separator") && !element.nextElementSibling) {
                                window.siyuan.menus.menu.remove();
                            } else {
                                element.remove();
                            }
                        } else {
                            replaceInputElement.value = element.textContent;
                            window.siyuan.menus.menu.remove();
                        }
                        itemEvent.preventDefault();
                        itemEvent.stopPropagation();
                    });
                }
            });
            if (current) {
                menuItem.classList.add("b3-menu__item--current");
            }
            current = false;
        }
    });
    if (current) {
        separatorElement.remove();
    }
    const rect = replaceInputElement.previousElementSibling.getBoundingClientRect();
    menu.open({
        x: rect.left,
        y: rect.bottom
    });
};
export const toggleSearchHistory = (searchElement: Element, config: Config.IUILayoutTabSearchConfig, edit: ProtyleDomain) => {
    const searchInputElement = searchElement.querySelector("#searchInput, #toolbarSearch") as HTMLInputElement;
    const list = window.siyuan.storage[Constants.LOCAL_SEARCHKEYS];
    if (!list.keys || list.keys.length === 0 || (list.length === 1 && list[0] === searchInputElement.value)) {
        return;
    }
    const menu = new Menu(Constants.MENU_SEARCH_HISTORY);
    if (menu.isOpen) {
        return;
    }
    menu.element.classList.add("b3-menu--list");
    menu.addItem({
        iconHTML: "",
        label: siyuanI18n.clearHistory,
        click() {
            window.siyuan.storage[Constants.LOCAL_SEARCHKEYS].keys = [];
            setStorageVal(Constants.LOCAL_SEARCHKEYS, window.siyuan.storage[Constants.LOCAL_SEARCHKEYS]);
        }
    });
    const separatorElement = menu.addSeparator(1);
    let current = true;
    list.keys.forEach((s: string) => {
        if (s !== searchInputElement.value && s) {
            const menuItem = menu.addItem({
                iconHTML: "",
                label: escapeHtml(s),
                action: "iconCloseRound",
                bind(element) {
                    element.addEventListener("click", (itemEvent) => {
                        if (hasClosestByClassName(itemEvent.target as Element, "b3-menu__action")) {
                            list.keys.find((item: string, index: number) => {
                                if (item === s) {
                                    list.keys.splice(index, 1);
                                    return true;
                                }
                            });
                            window.siyuan.storage[Constants.LOCAL_SEARCHKEYS].keys = list.keys;
                            setStorageVal(Constants.LOCAL_SEARCHKEYS, window.siyuan.storage[Constants.LOCAL_SEARCHKEYS]);
                            if (element.previousElementSibling?.classList.contains("b3-menu__separator") && !element.nextElementSibling) {
                                window.siyuan.menus.menu.remove();
                            } else {
                                element.remove();
                            }
                        } else {
                            searchInputElement.value = element.textContent;
                            config.page = 1;
                            if (isMobile) {
                                updateSearchResult(config, searchElement, true);
                            }
                            if (!isMobile) {
                                inputEvent(searchElement, config, edit, true);
                            }
                            window.siyuan.menus.menu.remove();
                        }
                        itemEvent.preventDefault();
                        itemEvent.stopPropagation();
                    });
                }
            });
            if (current) {
                menuItem.classList.add("b3-menu__item--current");
            }
            current = false;
        }
    });
    if (current) {
        separatorElement.remove();
    }
    const rect = searchInputElement.previousElementSibling.getBoundingClientRect();
    menu.open({
        x: rect.left,
        y: rect.bottom
    });
};

export const toggleAssetHistory = (assetElement: Element) => {
    const assetInputElement = assetElement.querySelector("#searchAssetInput") as HTMLInputElement;
    const keys = window.siyuan.storage[Constants.LOCAL_SEARCHASSET].keys;
    if (!keys || keys.length === 0 || (keys.length === 1 && keys[0] === assetInputElement.value)) {
        return;
    }
    const menu = new Menu(Constants.MENU_SEARCH_ASSET_HISTORY);
    if (menu.isOpen) {
        return;
    }
    menu.element.classList.add("b3-menu--list");
    menu.addItem({
        iconHTML: "",
        label: siyuanI18n.clearHistory,
        click() {
            window.siyuan.storage[Constants.LOCAL_SEARCHASSET].keys = [];
            setStorageVal(Constants.LOCAL_SEARCHASSET, window.siyuan.storage[Constants.LOCAL_SEARCHASSET]);
        }
    });
    const separatorElement = menu.addSeparator(1);
    let current = true;
    keys.forEach((s: string) => {
        if (s !== assetInputElement.value && s) {
            const menuItem = menu.addItem({
                iconHTML: "",
                label: escapeHtml(s),
                action: "iconCloseRound",
                bind(element) {
                    element.addEventListener("click", (itemEvent) => {
                        if (hasClosestByClassName(itemEvent.target as Element, "b3-menu__action")) {
                            keys.find((item: string, index: number) => {
                                if (item === s) {
                                    keys.splice(index, 1);
                                    return true;
                                }
                            });
                            window.siyuan.storage[Constants.LOCAL_SEARCHASSET].keys = keys;
                            setStorageVal(Constants.LOCAL_SEARCHASSET, window.siyuan.storage[Constants.LOCAL_SEARCHASSET]);
                            if (element.previousElementSibling?.classList.contains("b3-menu__separator") && !element.nextElementSibling) {
                                window.siyuan.menus.menu.remove();
                            } else {
                                element.remove();
                            }
                        } else {
                            assetInputElement.value = element.textContent;
                            assetInputEvent(assetElement);
                            window.siyuan.menus.menu.remove();
                        }
                        itemEvent.preventDefault();
                        itemEvent.stopPropagation();
                    });
                }
            });
            if (current) {
                menuItem.classList.add("b3-menu__item--current");
            }
            current = false;
        }
    });
    if (current) {
        separatorElement.remove();
    }
    const rect = assetInputElement.previousElementSibling.getBoundingClientRect();
    menu.open({
        x: rect.left,
        y: rect.bottom
    });
};
