export const htmlBlockGuard = async (
    event: KeyboardEvent & { target: HTMLElement },
    protyle: IProtyle,
    controller: AbortController
) => {
    if (event.target.localName === "protyle-html") {
        event.stopPropagation();
        controller.abort('html块由渲染函数处理,中止冒泡');
    }
}

export const inputElementGuard = async (
    event: KeyboardEvent & { target: HTMLElement },
    protyle: IProtyle,
    controller: AbortController
) => {
    if (event.target.localName === "input") {
        event.stopPropagation();
        controller.abort('输入框键盘按下,中止冒泡');
    }
}

export const protyleDisabledGuard = async (
    event: KeyboardEvent & { target: HTMLElement },
    protyle: IProtyle,
    controller: AbortController
) => {
    if (protyle.disabled) {
        event.stopPropagation();
        event.preventDefault();
        controller.abort("编辑器已禁用");
    }
}
export const protyleHaveSelectedGuard = async (
    event: KeyboardEvent & { target: HTMLElement },
    protyle: IProtyle,
    controller: AbortController
) => {
    if (!protyle.selectElement?.classList.contains("fn__none")) {
        event.stopPropagation();
        event.preventDefault();
        controller.abort("编辑器已有选中内容");
    }
}

export const avPanelGuard = (
    event: KeyboardEvent & { target: HTMLElement },
    protyle: IProtyle,
    controller: AbortController
) => {
    if (document.querySelector(".av__panel")) {
        controller.abort("属性视图面板已打开")
    }
}