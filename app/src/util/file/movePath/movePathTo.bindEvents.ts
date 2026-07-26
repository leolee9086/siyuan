import {Dialog} from "./imports";
import { 创建搜索输入处理器 } from "./movePathTo.inputEvent";
import { 创建历史菜单切换器 } from "./movePathTo.toggleHistory";
import { 创建键盘事件处理器 } from "./movePathTo.keydown";
import { 创建点击事件处理器 } from "./movePathTo.click";
import { 创建失焦事件处理器 } from "./movePathTo.blur";

import type {MovePathToOptions} from "./model/movePathTo.types";

/**
 * 绑定所有事件监听器到对话框
 * @param params - 事件绑定所需的 DOM 元素和配置选项
 */
export const 绑定事件监听器 = (params: {
    inputElement: HTMLInputElement;
    searchListElement: HTMLElement;
    searchTreeElement: HTMLElement;
    options: MovePathToOptions;
    dialog: Dialog;
}) => {
    const { inputElement, searchListElement, searchTreeElement, options, dialog } = params;

    const inputEvent = 创建搜索输入处理器(
        inputElement,
        searchListElement,
        searchTreeElement,
        options
    );

    const toggleMovePathHistory = 创建历史菜单切换器(inputElement, inputEvent);
    inputEvent();

    inputElement.addEventListener("compositionend", () => {
        inputEvent();
    });
    inputElement.addEventListener("input", () => {
        inputEvent();
    });
    inputElement.addEventListener("blur", 创建失焦事件处理器(inputElement));

    const lineHeight = 28;
    const 键盘事件处理器 = 创建键盘事件处理器({
        inputElement,
        searchListElement,
        searchTreeElement,
        toggleMovePathHistory,
        options,
        dialog,
        lineHeight
    });
    inputElement.addEventListener("keydown", 键盘事件处理器);

    const 点击事件处理器 = 创建点击事件处理器({
        searchListElement,
        searchTreeElement,
        toggleMovePathHistory,
        options,
        dialog,
        inputElement
    });
    dialog.element.addEventListener("click", 点击事件处理器);
};
