/**
 * @fileoverview 搜索控制相关点击处理
 */

import {setStorageVal} from "../../../../util/storage/setStorageVal";
import { Constants } from "../../../../constants";
import { openFile } from "../../../../editor/util";
import { MenuItem } from "../../../../menus/Menu.Item";
import type {ProtyleDomain} from "../../../../protyle/protyle.types";
import { hasClosestByClassName } from "../../../../protyle/util/hasClosest";
import { resize } from "../../../../protyle/util/resize";
import { siyuanI18n } from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
import {getDefaultSubType, getDefaultType} from "../../../defaults/searchDefaults";
import { inputEvent } from "../../../inputEvent";
import { moreMenu, queryMenu } from "../../../menu";
import { toggleReplaceHistory } from "../../../toggleHistory";
import { updateConfig, genQueryHTML } from "../../../util";
import type { AppFacade } from "../../../../app/AppFacade.types";

/**
 * 处理搜索刷新
 */
export function handleSearchRefresh(
    element: HTMLElement,
    config: Config.IUILayoutTabSearchConfig,
    edit: ProtyleDomain,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
): void {
    inputEvent(element, config, edit);
    if (updateCB) {
        updateCB(config);
    }
}

/**
 * 处理在新标签页打开
 */
export function handleSearchOpen(
    app: AppFacade,
    config: Config.IUILayoutTabSearchConfig,
    searchInputElement: HTMLInputElement,
    replaceInputElement: HTMLInputElement,
    closeCB?: () => void
): void {
    config.k = searchInputElement.value;
    config.r = replaceInputElement.value;
    openFile({
        app,
        searchData: config,
        position: (!window.siyuan.config.fileTree.noSplitScreenWhenOpenTab && (window.siyuan.layout.centerLayout.children.length > 1 || window.innerWidth > 1024)) ? "right" : undefined
    });
    if (closeCB) {
        closeCB();
    }
}

/**
 * 处理更多菜单
 */
export function handleSearchMore(
    target: HTMLElement,
    config: Config.IUILayoutTabSearchConfig,
    criteriaData: Config.IUILayoutTabSearchConfig[],
    element: HTMLElement,
    edit: ProtyleDomain,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
): Config.IUILayoutTabSearchConfig {
    let newConfig = config;

    moreMenu(config, criteriaData, element, {
        onChange: () => {
            config.page = 1;
            inputEvent(element, config, edit, true);
            if (updateCB) {
                updateCB(config);
            }
        },
        removeCriterion: () => {
            newConfig = updateConfig(element, {
                removed: true,
                sort: 0,
                group: 0,
                hasReplace: false,
                method: 0,
                hPath: "",
                idPath: [],
                k: "",
                r: "",
                page: 1,
                types: getDefaultType(),
                subTypes: getDefaultSubType(),
                replaceTypes: Object.assign({}, Constants.SIYUAN_DEFAULT_REPLACETYPES),
            }, config, edit, true);
            if (updateCB) {
                updateCB(newConfig);
            }
            element.querySelector("#criteria .b3-chip--current")?.classList.remove("b3-chip--current");
        },
        appendLayoutItems: () => {
            const localData = window.siyuan.storage[Constants.LOCAL_SEARCHKEYS];
            const isPopover = hasClosestByClassName(element, "b3-dialog__container");
            window.siyuan.menus.menu.append(new MenuItem({
                iconHTML: "",
                label: siyuanI18n.layout,
                type: "submenu",
                submenu: [{
                    iconHTML: "",
                    label: siyuanI18n.topBottomLayout,
                    current: isPopover ? localData.layout === 0 : localData.layoutTab === 0,
                    click() {
                    element.querySelector(".search__layout")?.classList.remove("search__layout--row");
                    edit.protyle.element.style.width = "";
                    if ((isPopover && localData.row) || (!isPopover && localData.rowTab)) {
                        edit.protyle.element.style.height = isPopover ? localData.row : localData.rowTab;
                        edit.protyle.element.classList.remove("fn__flex-1");
                    } else {
                        edit.protyle.element.classList.add("fn__flex-1");
                    }
                    resize(edit.protyle);
                    if (isPopover) {
                        localData.layout = 0;
                    } else {
                        localData.layoutTab = 0;
                    }
                    setStorageVal(Constants.LOCAL_SEARCHKEYS, window.siyuan.storage[Constants.LOCAL_SEARCHKEYS]);
                }
            }, {
                iconHTML: "",
                label: siyuanI18n.leftRightLayout,
                current: isPopover ? localData.layout === 1 : localData.layoutTab === 1,
                click() {
                    element.querySelector(".search__layout")?.classList.add("search__layout--row");
                    edit.protyle.element.style.height = "";
                    if ((isPopover && localData.col) || (!isPopover && localData.colTab)) {
                        edit.protyle.element.style.width = isPopover ? localData.col : localData.colTab;
                        edit.protyle.element.classList.remove("fn__flex-1");
                    } else {
                        edit.protyle.element.classList.add("fn__flex-1");
                    }
                    resize(edit.protyle);
                    if (isPopover) {
                        localData.layout = 1;
                    } else {
                        localData.layoutTab = 1;
                    }
                    setStorageVal(Constants.LOCAL_SEARCHKEYS, window.siyuan.storage[Constants.LOCAL_SEARCHKEYS]);
                }
            }]
        }).element);
        },
    });

    const rect = target.getBoundingClientRect();
    window.siyuan.menus.menu.popup({ x: rect.right, y: rect.bottom, isLeft: true });

    return newConfig;
}

/**
 * 处理搜索语法检查
 */
export function handleSearchSyntaxCheck(
    target: HTMLElement,
    config: Config.IUILayoutTabSearchConfig,
    element: HTMLElement,
    edit: ProtyleDomain,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
): void {
    queryMenu(config, () => {
        const syntaxCheckElement = element.querySelector("#searchSyntaxCheck");
        if (syntaxCheckElement) {
            syntaxCheckElement.outerHTML = genQueryHTML(config.method, "searchSyntaxCheck");
        }
        config.page = 1;
        inputEvent(element, config, edit, true);
        if (updateCB) {
            updateCB(config);
        }
    });
    const rect = target.getBoundingClientRect();
    window.siyuan.menus.menu.popup({ x: rect.right, y: rect.bottom, isLeft: true });
}

/**
 * 处理替换历史按钮
 */
export function handleReplaceHistoryBtn(element: HTMLElement): void {
    const replaceInput = element.querySelector("#replaceInput");
    if (replaceInput) {
        toggleReplaceHistory(replaceInput as HTMLInputElement);
    }
}
