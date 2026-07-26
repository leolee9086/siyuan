/**
 * @fileoverview 生成搜索面板
 * @description 重构后的主函数，将原有952行的代码拆分为多个独立模块
 */

import { Constants } from "../../constants";
import type { AppFacade } from "../../app/AppFacade.types";
import { initCriteriaMenu } from "../menu";
import { inputEvent } from "../inputEvent";

import { genSearchHTML } from "./genSearch/genSearchHTML";
import { initSearchEditors } from "./genSearch/initSearchEditors";
import { setupDragHandler } from "./genSearch/setupDragHandler";
import { setupInputHandlers } from "./genSearch/setupInputHandlers";
import { setupClickHandler } from "./genSearch/setupClickHandler";
import { initWebSearch } from "../webSearch";
import type {ProtyleDomain} from "../../protyle/protyle.types";

/** Bind local and web search interactions after the shared DOM has been created. */
const setupSearchInteractions = (context: {
    element: HTMLElement;
    app: AppFacade;
    config: Config.IUILayoutTabSearchConfig;
    edit: ProtyleDomain;
    unRefEdit: ProtyleDomain;
    criteriaData: Config.IUILayoutTabSearchConfig[];
    searchInputElement: HTMLInputElement;
    replaceInputElement: HTMLInputElement;
    searchPanelElement: Element;
    assetsElement: HTMLElement;
    unRefPanelElement: HTMLElement;
    localSearch: ISearchAssetOption;
    closeCB?: () => void;
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void;
}) => {
    const {element, app, config, edit, unRefEdit, criteriaData, searchInputElement, replaceInputElement,
        searchPanelElement, assetsElement, unRefPanelElement, localSearch, closeCB, updateCB} = context;
    setupDragHandler(element, edit, !!closeCB, localSearch);
    setupClickHandler({
        element,
        searchInputElement,
        replaceInputElement,
        searchPanelElement,
        assetsElement,
        unRefPanelElement,
    }, {
        app,
        config,
        edit,
        unRefEdit,
        criteriaData,
        localSearch,
    }, {closeCB, updateCB});
    setupInputHandlers(element, searchInputElement, replaceInputElement, config, edit, updateCB);
    initWebSearch(element, config, edit);
};

/** Resolve a required search control with a typed selector and a useful startup error. */
const requiredSearchElement = <T extends Element>(element: HTMLElement, selector: string) => {
    const result = element.querySelector<T>(selector);
    if (!result) {
        throw new Error("Search control not found: " + selector);
    }
    return result;
};

/**
 * 生成搜索面板
 * 
 * @param context - 应用实例、搜索配置、容器和可选回调
 * @returns 编辑器实例
 */
export const genSearch = (context: {
    app: AppFacade;
    config: Config.IUILayoutTabSearchConfig;
    element: HTMLElement;
    closeCB?: () => void;
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void;
}) => {
    const {app, config, element, closeCB, updateCB} = context;
    // 计算初始状态
    let includeChild = true;
    let enableIncludeChild = false;
    for (const item of config.idPath) {
        // A document path disables the child-document scope toggle.
        if (item.endsWith(".sy")) {
            includeChild = false;
        }
        // Nested paths allow the user to select a narrower child scope.
        if (item.split("/").length > 1) {
            enableIncludeChild = true;
        }
    }

    // 生成 HTML
    element.innerHTML = genSearchHTML({config, closeCB: !!closeCB, includeChild, enableIncludeChild});

    // 初始化搜索条件菜单
    const criteriaData: Config.IUILayoutTabSearchConfig[] = [];
    initCriteriaMenu(element.querySelector("#criteria"), criteriaData, config);

    // 获取DOM元素引用
    const searchPanelElement = requiredSearchElement(element, "#searchList");
    const searchInputElement = requiredSearchElement<HTMLInputElement>(element, "#searchInput");
    const replaceInputElement = requiredSearchElement<HTMLInputElement>(element, "#replaceInput");
    const assetsElement = requiredSearchElement<HTMLElement>(element, "#searchAssets");
    const unRefPanelElement = requiredSearchElement<HTMLElement>(element, "#searchUnRefPanel");
    const localSearch: ISearchAssetOption = window.siyuan.storage[Constants.LOCAL_SEARCHASSET];

    // 初始化编辑器
    const { edit, unRefEdit } = initSearchEditors(app, element, !!closeCB);

    // 设置输入框值
    searchInputElement.value = config.k || "";
    replaceInputElement.value = config.r || "";
    searchInputElement.select();

    setupSearchInteractions({element, app, config, edit, unRefEdit, criteriaData,
        searchInputElement, replaceInputElement, searchPanelElement, assetsElement, unRefPanelElement,
        localSearch, closeCB, ...(updateCB ? {updateCB} : {})});

    // 触发初始搜索
    inputEvent(element, config, edit);

    return { edit, unRefEdit };
};
