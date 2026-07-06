/**
 * @fileoverview 设置输入框事件处理
 */

import { setStorageVal } from "../../../ai/imports";
import { Constants } from "../../../constants";
import { Protyle } from "../../../protyle";
import { electronUndo } from "../../../protyle/undo";
import { addClearButton } from "../../../util/DOM/addClearButton";
import { inputEvent } from "../../inputEvent";
import { saveKeyList } from "../../toggleHistory";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 设置输入框事件处理
 * 
 * @param element - 根容器元素
 * @param searchInputElement - 搜索输入框
 * @param replaceInputElement - 替换输入框
 * @param config - 搜索配置
 * @param edit - 预览编辑器
 * @param updateCB - 配置更新回调
 */
export function setupInputHandlers(
    element: HTMLElement,
    searchInputElement: HTMLInputElement,
    replaceInputElement: HTMLInputElement,
    config: Config.IUILayoutTabSearchConfig,
    edit: Protyle,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
): void {
    bindSearchInputEvents(element, searchInputElement, config, edit, updateCB);
    bindKeyboardEvents(searchInputElement, replaceInputElement);
    initClearButtons(element, searchInputElement, replaceInputElement, config, edit, updateCB);
}

/**
 * 绑定搜索输入框的基本事件
 */
function bindSearchInputEvents(
    element: HTMLElement,
    searchInputElement: HTMLInputElement,
    config: Config.IUILayoutTabSearchConfig,
    edit: Protyle,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
) {
    const inputHandler = handleInput(element, config, edit, updateCB);
    searchInputElement.addEventListener("compositionend", inputHandler);
    searchInputElement.addEventListener("input", inputHandler);

    searchInputElement.addEventListener("blur", () => {
        handleBlur(searchInputElement, config);
    });
}

/**
 * 处理失去焦点事件
 */
function handleBlur(searchInputElement: HTMLInputElement, config: Config.IUILayoutTabSearchConfig) {
    if (!config.removed) {
        saveKeyList("keys", searchInputElement.value);
        return;
    }
    config.k = searchInputElement.value;
    const storage = window.siyuan.storage;  
    if (storage) {
        storage[Constants.LOCAL_SEARCHDATA] = Object.assign({}, config);
        setStorageVal(Constants.LOCAL_SEARCHDATA, storage[Constants.LOCAL_SEARCHDATA]);
    }
    saveKeyList("keys", searchInputElement.value);
}

/**
 * 处理输入事件
 */
function handleInput(
    element: HTMLElement,
    config: Config.IUILayoutTabSearchConfig,
    edit: Protyle,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
) {
    return (event: Event) => {
        config.page = 1;
        if (event instanceof InputEvent && event.isComposing) {
            return;
        }
        inputEvent(element, config, edit, true);
        if (updateCB) {
            updateCB(config);
        }
    };
}

/**
 * 绑定键盘快捷键事件
 */
function bindKeyboardEvents(
    searchInputElement: HTMLInputElement,
    replaceInputElement: HTMLInputElement,
) {
    searchInputElement.addEventListener("keydown", (event) => {
        electronUndo(event);
    });

    replaceInputElement.addEventListener("keydown", (event) => {
        electronUndo(event);
    });
}

/**
 * 初始化搜索框和替换框的清空按钮
 */
function initClearButtons(
    element: HTMLElement,
    searchInputElement: HTMLInputElement,
    replaceInputElement: HTMLInputElement,
    config: Config.IUILayoutTabSearchConfig,
    edit: Protyle,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
) {
    addClearButton({
        inputElement: searchInputElement,
        right: 8,
        height: searchInputElement.clientHeight,
        clearAriaLabel: siyuanI18n.clear,
        clearCB() {
            config.page = 1;
            inputEvent(element, config, edit);
            if (updateCB) {
                updateCB(config);
            }
        }
    });

    addClearButton({
        right: 8,
        inputElement: replaceInputElement,
        height: searchInputElement.clientHeight,
        clearAriaLabel: siyuanI18n.clear,
    });
}
