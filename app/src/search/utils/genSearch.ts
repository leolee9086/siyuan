/**
 * @fileoverview 生成搜索面板
 * @description 重构后的主函数，将原有952行的代码拆分为多个独立模块
 */

import { Constants } from "../../constants";
import type { App } from "../..";
import { initCriteriaMenu } from "../menu";
import { inputEvent } from "../inputEvent";

import { genSearchHTML } from "./genSearch/genSearchHTML";
import { initSearchEditors } from "./genSearch/initSearchEditors";
import { setupDragHandler } from "./genSearch/setupDragHandler";
import { setupInputHandlers } from "./genSearch/setupInputHandlers";
import { setupClickHandler } from "./genSearch/setupClickHandler";

/**
 * 生成搜索面板
 * 
 * @param app - 应用实例
 * @param config - 搜索配置
 * @param element - 根容器元素
 * @param closeCB - 关闭回调（不存在时为页签搜索）
 * @param updateCB - 配置更新回调
 * @returns 编辑器实例
 */
export const genSearch = (
    app: App,
    config: Config.IUILayoutTabSearchConfig,
    element: HTMLElement,
    closeCB?: () => void,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
) => {
    // 计算初始状态
    let includeChild = true;
    let enableIncludeChild = false;
    config.idPath.forEach(item => {
        if (item.endsWith(".sy")) {
            includeChild = false;
        }
        if (item.split("/").length > 1) {
            enableIncludeChild = true;
        }
    });

    // 生成 HTML
    element.innerHTML = genSearchHTML(config, !!closeCB, includeChild, enableIncludeChild);

    // 初始化搜索条件菜单
    const criteriaData: Config.IUILayoutTabSearchConfig[] = [];
    initCriteriaMenu(element.querySelector("#criteria"), criteriaData, config);

    // 获取DOM元素引用
    const searchPanelElement = element.querySelector("#searchList") as Element;
    const searchInputElement = element.querySelector("#searchInput") as HTMLInputElement;
    const replaceInputElement = element.querySelector("#replaceInput") as HTMLInputElement;
    const assetsElement = element.querySelector("#searchAssets") as HTMLElement;
    const unRefPanelElement = element.querySelector("#searchUnRefPanel") as HTMLElement;
    const localSearch = window.siyuan.storage[Constants.LOCAL_SEARCHASSET] as ISearchAssetOption;

    // 初始化编辑器
    const { edit, unRefEdit } = initSearchEditors(app, element, !!closeCB);

    // 设置输入框值
    searchInputElement.value = config.k || "";
    replaceInputElement.value = config.r || "";
    searchInputElement.select();

    // 设置拖拽处理
    setupDragHandler(element, edit, !!closeCB, localSearch);

    // 设置点击事件处理
    setupClickHandler(
        // UI 元素
        {
            element,
            searchInputElement,
            replaceInputElement,
            searchPanelElement,
            assetsElement,
            unRefPanelElement,
        },
        // 状态数据
        {
            app,
            config,
            edit,
            unRefEdit,
            criteriaData,
            localSearch,
        },
        // 回调函数
        {
            closeCB,
            updateCB,
        }
    );

    // 设置输入事件处理
    setupInputHandlers(element, searchInputElement, replaceInputElement, config, edit, updateCB);

    // 触发初始搜索
    inputEvent(element, config, edit);

    return { edit, unRefEdit };
};
