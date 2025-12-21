import { isMobile } from "../util/functions";
import { isNotCtrl } from "../protyle/util/compatibility";
import { Constants } from "../constants";
import { createVueComponentLoader } from "../util/vue/mount";
import { App } from "vue";
import { getSiyuanDialogStorage } from "../util/siyuanEnvironments/getDialog.environment";
import { getSiyuanWindowSize } from "../util/siyuanEnvironments/getWindow.environment";
import { isHTMLElement, isSVGElement, isSVGUseElement } from "./dialog.guard";

import { IDialogOptions, IDialog, I对话框HTML参数 } from "./dialog.types";
/** 创建输入框键盘事件处理器的工厂函数 */
export function 创建输入框键盘事件处理器(options: {
    dialog: IDialog;
    enterEvent: (() => void) | undefined;
    bindEnter: boolean;
    getTimeStamp: () => number;
    setTimeStamp: (value: number) => void;
    isFullscreen: () => boolean;
    disableEscapeClose: () => boolean;
}): (event: Event) => void {
    return (event: Event) => {
        if (!(event instanceof KeyboardEvent)) {
            return;
        }
        if (event.isComposing || event.repeat) {
            event.preventDefault();
            return;
        }
        if (event.key === "Escape" && options.isFullscreen()) {
            // 全屏模式下，ESC 键退出全屏
            options.dialog.fullscreen();
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (event.key === "Escape" && !options.disableEscapeClose()) {
            // 非全屏模式下，ESC 键关闭对话框
            options.dialog.destroy();
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (event.key === "Escape") {
            // ESC 键但不执行任何操作（全屏已处理或禁用了 ESC 关闭）
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        const { enterEvent } = options;
        const 应处理Enter = !event.shiftKey && isNotCtrl(event) && event.key === "Enter" && enterEvent && options.bindEnter;
        if (!应处理Enter) {
            return;
        }
        const timeStamp = options.getTimeStamp();
        if (timeStamp && event.timeStamp - timeStamp < 124) {
            return;
        }
        options.setTimeStamp(event.timeStamp);
        enterEvent();
        event.preventDefault();
        event.stopPropagation();
    };
}

/** 设置 resize 手柄的显示状态 */
export function 设置ResizeHandles显示状态(container: Element, visible: boolean): void {
    const resizeHandles = container.querySelectorAll("[class^='resize__']");
    for (const handle of resizeHandles) {
        if (handle instanceof HTMLElement) {
            handle.style.display = visible ? "" : "none";
        }
    }
}

/** 更新全屏按钮图标和标题 */
export function 更新全屏按钮状态(dialogElement: Element, isFullscreen: boolean): void {
    const fullscreenButton = dialogElement.querySelector(".b3-dialog__fullscreen use");
    const fullscreenButtonSvg = dialogElement.querySelector(".b3-dialog__fullscreen");
    if (isSVGUseElement(fullscreenButton)) {
        fullscreenButton.setAttribute("xlink:href", isFullscreen ? "#iconFullscreenExit" : "#iconFullscreen");
    }
    if (isSVGElement(fullscreenButtonSvg)) {
        fullscreenButtonSvg.setAttribute("title", isFullscreen ? "退出全屏" : "全屏");
    }
}

/** 计算对话框的初始位置 */
export function 计算对话框位置(options: IDialogOptions): { left?: string; top?: string; width?: string; height?: string } {
    if (isMobile() || !options.positionId) {
        return {};
    }
    const storage = getSiyuanDialogStorage();
    if (!storage) {
        return {};
    }
    const dialogPositions = storage[Constants.LOCAL_DIALOGPOSITION];
    if (!dialogPositions) {
        return {};
    }
    const dialogPosition = dialogPositions[options.positionId];
    if (!dialogPosition) {
        return {};
    }
    const windowSize = getSiyuanWindowSize();
    const 位置有效 = dialogPosition.left + dialogPosition.width + 34 <= windowSize.innerWidth &&
        dialogPosition.top + dialogPosition.height <= windowSize.innerHeight;
    if (!位置有效) {
        return {};
    }
    return {
        left: dialogPosition.left + "px",
        top: dialogPosition.top + "px",
        width: dialogPosition.width + "px",
        height: dialogPosition.height + "px"
    };
}

/** 生成关闭按钮的HTML */
export function 生成关闭按钮HTML(options: {
    disableClose: boolean;
    hideCloseIcon: boolean;
    closeButtonPosition: "outside" | "inside" | "inside-body";
    hasTitle: boolean;
}): string {
    if (options.disableClose || options.hideCloseIcon) {
        return "";
    }
    if (options.closeButtonPosition === "outside") {
        return `<svg ${(isMobile() && options.hasTitle) ? 'style="top:0;right:0;"' : ""} class="b3-dialog__close"><use xlink:href="#iconCloseRound"></use></svg>`;
    }
    if (options.closeButtonPosition === "inside" && options.hasTitle) {
        return "<svg class=\"b3-dialog__close b3-dialog__close--inside\" style=\"position: absolute; top: 50%; right: 0px; transform: translateY(-50%);\"><use xlink:href=\"#iconCloseRound\"></use></svg>";
    }
    if (options.closeButtonPosition === "inside-body") {
        return "<svg class=\"b3-dialog__close b3-dialog__close--inside-body\" style=\"position: absolute; top: 10px; right: 10px; z-index: 1;\"><use xlink:href=\"#iconCloseRound\"></use></svg>";
    }
    return "";
}

/** 生成全屏按钮的HTML */
export function 生成全屏按钮HTML(hasTitle: boolean, closeButtonPosition: string): string {
    if (!hasTitle) {
        return "";
    }
    const fullscreenButtonStyle = (closeButtonPosition === "inside" && hasTitle)
        ? "position: absolute; top: 50%; right: 30px; transform: translateY(-50%);"
        : "position: absolute; top: 50%; right: 10px; transform: translateY(-50%);";
    return `<svg class="b3-dialog__fullscreen" style="${fullscreenButtonStyle}" title="全屏"><use xlink:href="#iconFullscreen"></use></svg>`;
}

/** 计算标题栏的右侧内边距样式 */
export function 计算标题栏样式(hasTitle: boolean, closeButtonPosition: string): string {
    if (!hasTitle) {
        return "";
    }
    return closeButtonPosition === "inside"
        ? "position: relative; padding-right: 60px;"
        : "position: relative; padding-right: 30px;";
}


/** 生成对话框的HTML结构 */
export function 生成对话框HTML(params: I对话框HTML参数): string {
    return `<div class="b3-dialog" style="z-index: ${params.zIndex};${typeof params.left === "string" ? "display:block" : ""};${params.scrimPointerEvents ? " pointer-events:none" : ""}">
<div class="b3-dialog__scrim"${params.transparent ? 'style="background-color:transparent"' : ""}></div>
<div class="b3-dialog__container ${params.containerClassName || ""}" style="width:${params.width || "auto"};height:${params.height || "auto"};
left:${params.left || "auto"};top:${params.top || "auto"};${params.scrimPointerEvents ? " pointer-events:auto" : ""}">
  ${params.closeButtonPosition === "outside" ? params.closeButtonHtml : ""}
  <div class="resize__move b3-dialog__header${params.hasTitle ? "" : " fn__none"}" onselectstart="return false;" style="${params.headerPaddingRight}">${params.title || ""}${params.closeButtonPosition === "inside" ? params.closeButtonHtml : ""}${params.fullscreenButtonHtml}</div>
  <div class="b3-dialog__body" style="${params.closeButtonPosition === "inside-body" ? "position: relative;" : ""}">${params.content}${params.closeButtonPosition === "inside-body" ? params.closeButtonHtml : ""}</div>
  <div class="resize__rd"></div><div class="resize__ld"></div><div class="resize__lt"></div><div class="resize__rt"></div><div class="resize__r"></div><div class="resize__d"></div><div class="resize__t"></div><div class="resize__l"></div>
</div></div>`;
}

/** 创建遮罩点击事件处理器 */
export function 创建遮罩点击处理器(dialog: IDialog, disableClose: boolean, disableScrimClose: boolean): (event: Event) => void {
    return (event: Event) => {
        if (!disableClose && !disableScrimClose) {
            dialog.destroy();
        }
        event.preventDefault();
        event.stopPropagation();
    };
}

/** 创建关闭按钮点击事件处理器 */
export function 创建关闭按钮点击处理器(dialog: IDialog, isFullscreen: () => boolean): (event: Event) => void {
    return (event: Event) => {
        if (isFullscreen()) {
            dialog.fullscreen();
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        dialog.destroy();
        event.preventDefault();
        event.stopPropagation();
    };
}

/** 创建全屏按钮点击事件处理器 */
export function 创建全屏按钮点击处理器(dialog: IDialog): (event: Event) => void {
    return (event: Event) => {
        dialog.fullscreen();
        event.preventDefault();
        event.stopPropagation();
    };
}

/** 绑定对话框的事件处理器 */
export function 绑定对话框事件(dialog: IDialog, element: HTMLElement, disableClose: boolean, disableScrimClose: boolean, isFullscreen: () => boolean): void {
    // 遮罩点击事件
    const scrimElement = element.querySelector(".b3-dialog__scrim");
    scrimElement?.addEventListener("click", 创建遮罩点击处理器(dialog, disableClose, disableScrimClose));

    // 关闭按钮点击事件
    if (!disableClose) {
        const closeButtons = element.querySelectorAll(".b3-dialog__close");
        for (const button of closeButtons) {
            button.addEventListener("click", 创建关闭按钮点击处理器(dialog, isFullscreen));
        }
    }

    // 全屏按钮点击事件
    const fullscreenButton = element.querySelector(".b3-dialog__fullscreen");
    fullscreenButton?.addEventListener("click", 创建全屏按钮点击处理器(dialog));
}

/** 挂载标题Vue组件 */
export function 挂载标题Vue组件(element: HTMLElement, options: IDialogOptions): App | null {
    if (!options.titleVueConfig) {
        return null;
    }
    const titleElement = element.querySelector(".b3-dialog__header");
    if (!titleElement) {
        return null;
    }
    titleElement.innerHTML = "";
    if (isHTMLElement(titleElement)) {
        return createVueComponentLoader(
            titleElement,
            options.titleVueConfig,
            options.titleVueContext
        );
    }
    return null;
}
