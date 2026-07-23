import { editorContext } from "./types";
/** 用途：放行框选复制快捷键。使用范围：选区 guard。解耦评估：经 WYSIWYG 目录入口复用无状态匹配器。 */
import {matchHotKey} from "./imports";

export const htmlBlockGuard = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    driver: any
) => {
    driver.stop("html块由渲染函数处理");
    driver.abort("html块由渲染函数处理");
};
export const htmlBlockGuardRgistyItem = {
    conditions: {
        blockType: "NodeHTMLBlock"
    },
    handle: htmlBlockGuard,
    describe: "用户在html块中输入时"
};




export const inputElementGuard = async (
    context: editorContext
) => {
    const { event, controller } = context;
    event.stopPropagation();
    controller.abort("输入框键盘按下,中止冒泡");
};

export const protyleDisabledGuard = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    event.stopPropagation();
    event.preventDefault();
    controller.abort("编辑器已禁用");
};
// S-forge: data-empty 检查，移植自上游 f6bc057c5
// 上游将 protyle.selectElement.style.backgroundColor === "" 改为 !protyle.selectElement.getAttribute("data-empty")
// 本地逆向条件：有 data-empty 属性表示无实际选中 → 不应中止
export const protyleHaveSelectedGuard = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (protyle.selectElement?.getAttribute("data-empty")) {
        return;
    }
    // 框选块时保留系统复制快捷键，由后续复制中间件消费选区。
    if (matchHotKey("⌘C", event)) {
        return;
    }
    event.stopPropagation();
    event.preventDefault();
    controller.abort("编辑器已有选中内容");
};

export const avPanelGuard = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (document.querySelector(".av__panel")) {
        controller.abort("属性视图面板已打开");
    }
};
