import { editorContext } from "./types";

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
export const protyleHaveSelectedGuard = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (protyle.selectElement?.style.backgroundColor !== "") {
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
