import { matchHotKey, isIncludesHotKey } from "../util/hotKey";
import { addSubList } from "./list.addSubList";
import { calibur } from "calibur-router";
import { type } from "arktype";

/**
 * Alt+Enter 动作分发器
 */
const altEnterRouter = calibur.universe(type({
    isIncludesHotKey: "boolean",
    hasNonCodeBlock: "boolean"
}))
    .split(
        type({ isIncludesHotKey: "false", hasNonCodeBlock: "false" }),
        () => "SHOW_CODE_LANGUAGE"
    )
    .split(
        type({ isIncludesHotKey: "false", hasNonCodeBlock: "true" }),
        () => "ADD_SUB_LIST"
    )
    .remain(() => "IGNORE")
    .build();

/**
 * Alt+Enter 快捷键中间件
 * 处理代码块语言选择和子列表添加功能
 * @param event 键盘事件
 * @param protyle Protyle 实例
 * @param nodeElement 当前块元素
 * @param range 光标范围
 * @param controller 控制器
 */
export const altEnterMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    const selectText = range.toString();
    // 检查是否匹配 Alt+Enter 快捷键且没有选中文本
    if (!(matchHotKey("⌥↩", event) && selectText === "")) {
        return;
    }

    const selectElements = getSelectElements(protyle, nodeElement);
    const command = getAltEnterCommand(selectElements);

    // 当所有选中的都是代码块时，显示代码语言选择器，允许用户更改代码语言
    if (command === "SHOW_CODE_LANGUAGE") {
        showCodeLanguage(protyle, selectElements, event, controller);
        return;
    }

    // 当选中包含非代码块元素（通常是列表项）时，执行添加子列表的操作
    if (command === "ADD_SUB_LIST") {
        addSubList(protyle, nodeElement, range);
        event.stopPropagation();
        event.preventDefault();
        controller.abort();
        return;
    }
};

/**
 * 获取当前选中的元素列表
 * 如果没有多选元素，则返回当前所在的块元素
 * @param protyle Protyle 实例
 * @param nodeElement 当前光标所在的块元素
 */
const getSelectElements = (protyle: IProtyle, nodeElement: HTMLElement) => {
    const selectElements = Array.from(protyle.wysiwyg?.element?.querySelectorAll(".protyle-wysiwyg--select") || []);
    if (selectElements.length === 0) {
        selectElements.push(nodeElement);
    }
    return selectElements;
};

/**
 * 根据选中元素状态，使用 Router 决策后续动作
 * @param selectElements 选中的元素列表
 */
const getAltEnterCommand = (selectElements: Element[]) => {
    const hasNonCodeBlock = selectElements.some(item => !item.classList.contains("code-block"));
    return altEnterRouter({
        isIncludesHotKey: isIncludesHotKey("⌥↩"),
        hasNonCodeBlock
    });
};

/**
 * 显示代码块语言选择菜单
 * @param protyle Protyle 实例
 * @param selectElements 选中的代码块元素
 * @param event 原始键盘事件
 * @param controller 中止控制器，用于阻止默认行为
 */
const showCodeLanguage = (protyle: IProtyle, selectElements: Element[], event: KeyboardEvent, controller: AbortController) => {
    const languageElements: HTMLElement[] = [];
    selectElements.forEach(item => {
        const langElement = item.querySelector(".protyle-action__language");
        if (langElement instanceof HTMLElement) {
            languageElements.push(langElement);
        }
    });
    protyle.toolbar?.showCodeLanguage(protyle, languageElements);
    event.stopPropagation();
    event.preventDefault();
    controller.abort();
};