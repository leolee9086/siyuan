import { IDialog } from "./dialog.types";

/**
 * @function 创建输入框键盘事件处理器
 * @zh-CN
 * @作用: 为对话框创建键盘事件处理器的工厂函数，负责处理 Enter 和 Escape 键的行为
 * @意图: 统一管理对话框的键盘交互逻辑，包括全屏模式下的 ESC 键、普通模式下的关闭、以及 Enter 键提交
 * @调用时机: 在对话框初始化时调用，返回的处理器绑定到输入框元素上
 * @已知问题: 无
 * @改进方向: 无
 */
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

/**
 * @function 创建遮罩点击处理器
 * @zh-CN
 * @作用: 创建对话框遮罩层的点击事件处理器
 * @意图: 处理点击对话框外部（遮罩区域）时的行为，根据配置决定是否关闭对话框
 * @调用时机: 在对话框初始化时调用，返回的处理器绑定到遮罩元素上
 * @已知问题: 无
 * @改进方向: 无
 */
export function 创建遮罩点击处理器(dialog: IDialog, disableClose: boolean, disableScrimClose: boolean): (event: Event) => void {
    return (event: Event) => {
        if (!disableClose && !disableScrimClose) {
            dialog.destroy();
        }
        event.preventDefault();
        event.stopPropagation();
    };
}

/**
 * @function 创建关闭按钮点击处理器
 * @zh-CN
 * @作用: 创建对话框关闭按钮的点击事件处理器
 * @意图: 处理关闭按钮点击，全屏模式下退出全屏，普通模式下关闭对话框
 * @调用时机: 在对话框初始化时调用，返回的处理器绑定到关闭按钮上
 * @已知问题: 无
 * @改进方向: 无
 */
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

/**
 * @function 创建全屏按钮点击处理器
 * @zh-CN
 * @作用: 创建对话框全屏按钮的点击事件处理器
 * @意图: 处理全屏按钮点击，切换对话框的全屏状态
 * @调用时机: 在对话框初始化时调用，返回的处理器绑定到全屏按钮上
 * @已知问题: 无
 * @改进方向: 无
 */
export function 创建全屏按钮点击处理器(dialog: IDialog): (event: Event) => void {
    return (event: Event) => {
        dialog.fullscreen();
        event.preventDefault();
        event.stopPropagation();
    };
}

/**
 * @function 绑定对话框事件
 * @zh-CN
 * @作用: 统一绑定对话框的所有事件处理器（遮罩点击、关闭按钮、全屏按钮）
 * @意图: 集中管理对话框的事件绑定逻辑，确保所有交互正常工作
 * @调用时机: 在对话框 DOM 结构创建后、显示前调用
 * @已知问题: 无
 * @改进方向: 可以考虑使用 AbortController 统一管理事件监听器的清理
 */
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

// 需要导入 isNotCtrl 以支持键盘事件处理
import { isNotCtrl } from "../protyle/util/compatibility";
