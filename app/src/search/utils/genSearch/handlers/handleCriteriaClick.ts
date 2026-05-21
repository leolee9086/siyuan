/**
 * @fileoverview 搜索条件相关点击处理
 */

import { fetchPost } from "../../../../ai/imports";
import { Constants } from "../../../../constants";
import { Protyle } from "../../../../protyle";
import { getDefaultSubType, getDefaultType } from "../../../getDefault";
import { updateConfig } from "../../../util";

/**
 * 获取默认配置对象
 */
function getDefaultConfig(): Config.IUILayoutTabSearchConfig {
    return {
        name: "",
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
    updateConfig(element, getDefaultConfig(), config, edit, true);
    if (updateCB) {
        updateCB(config);
    }
    const currentChip = element.querySelector(".b3-chip--current");
    if (currentChip) {
        currentChip.classList.remove("b3-chip--current");
    }
    return config;
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
    const parent = target.parentElement;
    const currentElement = parent?.querySelector(".b3-chip--current");
    if (currentElement) {
        currentElement.classList.remove("b3-chip--current");
    }
    target.classList.add("b3-chip--current");

    const targetName = target.innerText.trim();
    const foundItem = criteriaData.find(item => item.name === targetName);
    if (foundItem) {
        updateConfig(element, foundItem, config, edit);
        updateCB?.(config);
    }

    return config;
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
    const parentElement = target.parentElement;
    if (!parentElement) {
        return config;
    }
    const name = parentElement.textContent || "";
    fetchPost("/api/storage/removeCriterion", { name });

    const criteriaIndex = criteriaData.findIndex(item => item.name === name);
    if (criteriaIndex !== -1) {
        criteriaData.splice(criteriaIndex, 1);
    }

    if (parentElement.classList.contains("b3-chip--current")) {
        updateConfig(element, getDefaultConfig(), config, edit, true);
    }

    parentElement.remove();
    return config;
}
