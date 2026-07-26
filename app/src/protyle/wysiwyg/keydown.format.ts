import {updateBatchTransaction} from "./transaction/update";
import { alignImgCenter, alignImgLeft } from "./commonHotkey/commonHotkeyAlign";
import { matchHotKey } from "../util/hotKey";

// 左对齐快捷键处理
export const alignLeftMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (!window.siyuan?.config?.keymap?.editor?.general?.alignLeft?.custom || !matchHotKey(window.siyuan.config.keymap.editor.general.alignLeft.custom, event)) {
        return;
    }

    const imgSelectElements = nodeElement.querySelectorAll(".img--select");
    if (imgSelectElements.length > 0) {
        alignImgLeft(protyle, nodeElement, Array.from(imgSelectElements), nodeElement.getAttribute("data-node-id") || "", nodeElement.outerHTML);
    } else {
        let selectElements: HTMLElement[] = Array.from(protyle.wysiwyg?.element?.querySelectorAll(".protyle-wysiwyg--select") || []);
        if (selectElements.length === 0) {
            selectElements = [nodeElement];
        }
        updateBatchTransaction(selectElements, protyle, (e: HTMLElement) => {
            if (e.classList.contains("av")) {
                e.style.justifyContent = "";
            } else {
                e.style.textAlign = "left";
            }
        });
    }
    event.stopPropagation();
    event.preventDefault();
    controller.abort("左对齐处理完成");
};

// 居中对齐快捷键处理
export const alignCenterMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (!window.siyuan?.config?.keymap?.editor?.general?.alignCenter?.custom || !matchHotKey(window.siyuan.config.keymap.editor.general.alignCenter.custom, event)) {
        return;
    }

    const imgSelectElements = nodeElement.querySelectorAll(".img--select");
    if (imgSelectElements.length > 0) {
        alignImgCenter(protyle, nodeElement, Array.from(imgSelectElements), nodeElement.getAttribute("data-node-id") || "", nodeElement.outerHTML);
    } else {
        let selectElements: HTMLElement[] = Array.from(protyle.wysiwyg?.element?.querySelectorAll(".protyle-wysiwyg--select") || []);
        if (selectElements.length === 0) {
            selectElements = [nodeElement];
        }
        updateBatchTransaction(selectElements, protyle, (e: HTMLElement) => {
            if (e.classList.contains("av")) {
                e.style.justifyContent = "center";
            } else {
                e.style.textAlign = "center";
            }
        });
    }
    event.stopPropagation();
    event.preventDefault();
    controller.abort("居中对齐处理完成");
};

// 右对齐快捷键处理
export const alignRightMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (!window.siyuan?.config?.keymap?.editor?.general?.alignRight?.custom || !matchHotKey(window.siyuan.config.keymap.editor.general.alignRight.custom, event)) {
        return;
    }

    let selectElements: HTMLElement[] = Array.from(protyle.wysiwyg?.element?.querySelectorAll(".protyle-wysiwyg--select") || []);
    if (selectElements.length === 0) {
        selectElements = [nodeElement];
    }
    updateBatchTransaction(selectElements, protyle, (e: HTMLElement) => {
        if (e.classList.contains("av")) {
            e.style.justifyContent = "flex-end";
        } else {
            e.style.textAlign = "right";
        }
    });
    event.stopPropagation();
    event.preventDefault();
    controller.abort("右对齐处理完成");
};

// 从右到左文本方向快捷键处理
export const rtlMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (!window.siyuan?.config?.keymap?.editor?.general?.rtl?.custom || !matchHotKey(window.siyuan.config.keymap.editor.general.rtl.custom, event)) {
        return;
    }

    let selectElements: HTMLElement[] = Array.from(protyle.wysiwyg?.element?.querySelectorAll(".protyle-wysiwyg--select") || []);
    if (selectElements.length === 0) {
        selectElements = [nodeElement];
    }
    updateBatchTransaction(selectElements, protyle, (e: HTMLElement) => {
        e.style.direction = "rtl";
    });
    event.stopPropagation();
    event.preventDefault();
    controller.abort("从右到左文本方向处理完成");
};

// 从左到右文本方向快捷键处理
export const ltrMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (!window.siyuan?.config?.keymap?.editor?.general?.ltr?.custom || !matchHotKey(window.siyuan.config.keymap.editor.general.ltr.custom, event)) {
        return;
    }

    let selectElements: HTMLElement[] = Array.from(protyle.wysiwyg?.element?.querySelectorAll(".protyle-wysiwyg--select") || []);
    if (selectElements.length === 0) {
        selectElements = [nodeElement];
    }
    updateBatchTransaction(selectElements, protyle, (e: HTMLElement) => {
        e.style.direction = "ltr";
    });
    event.stopPropagation();
    event.preventDefault();
    controller.abort("从左到右文本方向处理完成");
};

// 格式化快捷键处理中间件
export const formatMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    await alignLeftMiddleware(event, protyle, nodeElement, range, controller);
    if (controller.signal.aborted) {
        return;
    }

    await alignCenterMiddleware(event, protyle, nodeElement, range, controller);
    if (controller.signal.aborted) {
        return;
    }

    await alignRightMiddleware(event, protyle, nodeElement, range, controller);
    if (controller.signal.aborted) {
        return;
    }

    await rtlMiddleware(event, protyle, nodeElement, range, controller);
    if (controller.signal.aborted) {
        return;
    }

    await ltrMiddleware(event, protyle, nodeElement, range, controller);
    // 最后一个中间件不需要检查 aborted 状态
};