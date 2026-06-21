import { matchHotKey, isIncludesHotKey } from "../util/hotKey";
import { addSubList } from "./list.addSubList";
import { hasClosestByClassName } from "../util/hasClosest";
import { updateCalloutType } from "./callout";
import { calibur } from "calibur-router";
import { type } from "arktype";

/**
 * Alt+Enter 动作分发器
 */
const altEnterRouter = calibur.universe(type({
    isIncludesHotKey: "boolean",
    hasCodeBlock: "boolean",
    hasCallout: "boolean"
}))
    .split(
        type({ isIncludesHotKey: "false", hasCodeBlock: "true" }),
        () => "SHOW_CODE_LANGUAGE"
    )
    .split(
        type({ isIncludesHotKey: "false", hasCodeBlock: "false", hasCallout: "true" }),
        () => "UPDATE_CALLOUT"
    )
    .split(
        type({ isIncludesHotKey: "false", hasCodeBlock: "false", hasCallout: "false" }),
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
    const codeBlockElements = selectElements.filter(item => item.classList.contains("code-block"));
    const calloutElements = getCalloutElements(selectElements);
    const command = getAltEnterCommand(codeBlockElements, calloutElements);

    // 当所有选中的都是代码块时，显示代码语言选择器，允许用户更改代码语言
    if (command === "SHOW_CODE_LANGUAGE") {
        showCodeLanguage(protyle, codeBlockElements, event, controller);
        return;
    }

    if (command === "UPDATE_CALLOUT") {
        updateCalloutType(calloutElements, protyle);
        event.stopPropagation();
        event.preventDefault();
        controller.abort("Alt+Enter 修改 Callout 类型");
        return;
    }

    // 当选中包含非代码块元素（通常是列表项）时，执行添加子列表的操作
    if (command === "ADD_SUB_LIST") {
        addSubList(protyle, nodeElement, range);
        event.stopPropagation();
        event.preventDefault();
        controller.abort("Alt+Enter 添加子列表");
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
    // 当用户没有通过多选功能选中任何块时，将当前光标所在的块作为默认选中元素
    // 这样即使用户只是将光标放在单个代码块内按 Alt+Enter，也能触发相应操作
    if (selectElements.length === 0) {
        selectElements.push(nodeElement);
    }
    return selectElements;
};

/**
 * 根据选中元素状态，使用 Router 决策后续动作
 * @param selectElements 选中的元素列表
 */
const getAltEnterCommand = (codeBlockElements: Element[], calloutElements: HTMLElement[]) => {
    return altEnterRouter({
        isIncludesHotKey: isIncludesHotKey("⌥↩"),
        hasCodeBlock: codeBlockElements.length > 0,
        hasCallout: calloutElements.length > 0
    });
};

const getCalloutElements = (selectElements: Element[]) => {
    const calloutElements: HTMLElement[] = [];
    selectElements.forEach((item) => {
        const calloutElement = hasClosestByClassName(item, "callout");
        const liElement = hasClosestByClassName(item, "li");
        if (calloutElement instanceof HTMLElement &&
            (!liElement || (liElement instanceof HTMLElement && liElement.contains(calloutElement)))) {
            calloutElements.push(calloutElement);
        }
    });
    return calloutElements;
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
    for (const item of selectElements) {
        const langElement = item.querySelector(".protyle-action__language");
        // querySelector 返回的是 Element 类型，需要验证是否为 HTMLElement 才能安全操作
        // 当用户选中代码块时，该选择器会找到语言显示元素，其应为 HTMLElement
        if (langElement instanceof HTMLElement) {
            languageElements.push(langElement);
        }
    }
    protyle.toolbar?.showCodeLanguage(protyle, languageElements);
    event.stopPropagation();
    event.preventDefault();
    controller.abort("Alt+Enter 显示代码语言选择器");
};
