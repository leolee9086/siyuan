/**
 * @fileoverview 搜索条件相关点击处理
 */

import { fetchPost } from "../../../../ai/imports";
import { Constants } from "../../../../constants";
import { Protyle } from "../../../../protyle";
import { getDefaultType } from "../../../getDefault";
import { updateConfig } from "../../../util";

/**
 * 获取默认配置对象
 */
function getDefaultConfig(): Partial<Config.IUILayoutTabSearchConfig> {
    return {
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
        replaceTypes: Object.assign({}, Constants.SIYUAN_DEFAULT_REPLACETYPES),
    };
}

/**
 * 处理移除条件点击
 */
export function handleRemoveCriterion(
    element: HTMLElement,
    config: Config.IUILayoutTabSearchConfig,
    edit: Protyle,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
): Config.IUILayoutTabSearchConfig {
    const newConfig = updateConfig(element, getDefaultConfig(), config, edit, true);
    if (updateCB) {
        updateCB(newConfig);
    }
    element.querySelector(".b3-chip--current")?.classList.remove("b3-chip--current");
    return newConfig;
}

/**
 * 处理设置条件点击
 */
export function handleSetCriteria(
    target: HTMLElement,
    config: Config.IUILayoutTabSearchConfig,
    criteriaData: Config.IUILayoutTabSearchConfig[],
    element: HTMLElement,
    edit: Protyle,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
): Config.IUILayoutTabSearchConfig {
    config.removed = false;
    target.parentElement?.querySelector(".b3-chip--current")?.classList.remove("b3-chip--current");
    target.classList.add("b3-chip--current");

    let newConfig = config;
    criteriaData.find(item => {
        if (item.name === target.innerText.trim()) {
            newConfig = updateConfig(element, item, config, edit);
            if (updateCB) {
                updateCB(newConfig);
            }
            return true;
        }
    });

    return newConfig;
}

/**
 * 处理删除条件点击
 */
export function handleRemoveCriteria(
    target: HTMLElement,
    config: Config.IUILayoutTabSearchConfig,
    criteriaData: Config.IUILayoutTabSearchConfig[],
    element: HTMLElement,
    edit: Protyle
): Config.IUILayoutTabSearchConfig {
    const name = target.parentElement?.textContent || "";
    fetchPost("/api/storage/removeCriterion", { name });

    criteriaData.find((item, index) => {
        if (item.name === name) {
            criteriaData.splice(index, 1);
            return true;
        }
    });

    let newConfig = config;
    if (target.parentElement?.classList.contains("b3-chip--current")) {
        newConfig = updateConfig(element, getDefaultConfig(), config, edit, true);
    }

    target.parentElement?.remove();
    return newConfig;
}
