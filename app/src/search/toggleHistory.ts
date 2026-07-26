import {Constants} from "../constants";
import {Menu} from "../plugin/Menu";
import {setStorageVal} from "../protyle/util/compatibility";
import {escapeHtml} from "../util/DOM/escape";
import {hasClosestByClassName} from "../protyle/util/hasClosest";
import type {ProtyleDomain} from "../protyle/protyle.types";
import {assetInputEvent} from "./assets";
import {updateSearchResult} from "../mobile/menu/search";
import {inputEvent} from "./util";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig, getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import {isMobile} from "../platform";

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

export const saveKeyList = (type: "keys" | "replaceKeys", value: string) => {
    let list: string[] = window.siyuan.storage[Constants.LOCAL_SEARCHKEYS][type];
    list.splice(0, 0, value);
    list = Array.from(new Set(list));
    if (list.length > getSiyuanConfig().search.limit) {
        list.splice(getSiyuanConfig().search.limit, list.length - getSiyuanConfig().search.limit);
    }
    // new Set 后需重新赋值
    const storage = getSiyuanStorage();
    const localSearchKeys = storage[Constants.LOCAL_SEARCHKEYS];
    localSearchKeys[type] = list;
    setStorageVal(Constants.LOCAL_SEARCHKEYS, localSearchKeys);
};

export const saveAssetKeyList = (inputElement: HTMLInputElement) => {
    if (!inputElement.value) {
        return;
    }
    let list: string[] = window.siyuan.storage[Constants.LOCAL_SEARCHASSET].keys;
    list.splice(0, 0, inputElement.value);
    list = Array.from(new Set(list));
    if (list.length > getSiyuanConfig().search.limit) {
        list.splice(getSiyuanConfig().search.limit, list.length - getSiyuanConfig().search.limit);
    }
    window.siyuan.storage[Constants.LOCAL_SEARCHASSET].k = inputElement.value;
    window.siyuan.storage[Constants.LOCAL_SEARCHASSET].keys = list;
    setStorageVal(Constants.LOCAL_SEARCHASSET, window.siyuan.storage[Constants.LOCAL_SEARCHASSET]);
};
