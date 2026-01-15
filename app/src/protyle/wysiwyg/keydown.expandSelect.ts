import { matchHotKey } from "../util/hotKey";
import { hideElements } from "../ui/hideElements";
import { getPreviousBlock, getNextBlock } from "./getBlock";
import { preventScroll } from "../scroll/preventScroll";
import { upSelect, downSelect, getStartEndElement } from "./commonHotkey/commonHotkey";

/**
 * 处理扩展向上选择的快捷键
 */
export const expandUpSelectMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    editorElement: HTMLElement,
    range: Range,
    controller: AbortController
): Promise<void> => {
    if (matchHotKey(window.siyuan.config.keymap.editor.general.expandUp.custom, event)) {
        upSelect({
            protyle, event, nodeElement, editorElement, range,
            cb(selectElements) {
                const previousElement = selectElements[0].previousElementSibling as HTMLElement;
                if (previousElement && previousElement.getAttribute("data-node-id")) {
                    previousElement.classList.add("protyle-wysiwyg--select");
                    selectElements.forEach(item => {
                        item.removeAttribute("select-end");
                    });
                    previousElement.setAttribute("select-end", "true");
                    const top = previousElement.getBoundingClientRect().top - protyle.contentElement.getBoundingClientRect().top;
                    if (top < 0) {
                        protyle.contentElement.scrollTop = protyle.contentElement.scrollTop + top;
                        protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop + 1;
                    }
                } else if (!selectElements[0].parentElement.classList.contains("protyle-wysiwyg")) {
                    hideElements(["select"], protyle);
                    selectElements[0].parentElement.classList.add("protyle-wysiwyg--select");
                }
            }
        });
        controller.abort("扩展向上选择处理完成");
    }
};

/**
 * 处理扩展向下选择的快捷键
 */
export const expandDownSelectMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    editorElement: HTMLElement,
    range: Range,
    controller: AbortController
): Promise<void> => {
    if (matchHotKey(window.siyuan.config.keymap.editor.general.expandDown.custom, event)) {
        downSelect({
            protyle, event, nodeElement, editorElement, range,
            cb(selectElements) {
                const selectLastElement = selectElements[selectElements.length - 1];
                const nextElement = selectLastElement.nextElementSibling as HTMLElement;
                if (nextElement && nextElement.getAttribute("data-node-id")) {
                    nextElement.classList.add("protyle-wysiwyg--select");
                    selectElements.forEach(item => {
                        item.removeAttribute("select-end");
                    });
                    nextElement.setAttribute("select-end", "true");
                    const bottom = nextElement.getBoundingClientRect().bottom - protyle.contentElement.getBoundingClientRect().bottom;
                    if (bottom > 0) {
                        protyle.contentElement.scrollTop = protyle.contentElement.scrollTop + bottom;
                        protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop - 1;
                    }
                } else if (!selectLastElement.parentElement.classList.contains("protyle-wysiwyg")) {
                    hideElements(["select"], protyle);
                    selectLastElement.parentElement.classList.add("protyle-wysiwyg--select");
                }
            }
        });
        controller.abort("扩展向下选择处理完成");
    }
};

/**
 * 处理Shift+向上箭头选择的快捷键
 */
export const shiftUpSelectMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    editorElement: HTMLElement,
    range: Range,
    controller: AbortController
): Promise<void> => {
    if (matchHotKey("⇧↑", event)) {
        upSelect({
            protyle, event, nodeElement, editorElement, range,
            cb(selectElements) {
                const startEndElement = getStartEndElement(selectElements);
                if (startEndElement.startElement.getBoundingClientRect().top >= startEndElement.endElement.getBoundingClientRect().top) {
                    const previousElement = startEndElement.endElement.previousElementSibling as HTMLElement;
                    if (previousElement && previousElement.getAttribute("data-node-id")) {
                        previousElement.classList.add("protyle-wysiwyg--select");
                        previousElement.setAttribute("select-end", "true");
                        startEndElement.endElement.removeAttribute("select-end");
                        const top = previousElement.getBoundingClientRect().top - protyle.contentElement.getBoundingClientRect().top;
                        if (top < 0) {
                            protyle.contentElement.scrollTop = protyle.contentElement.scrollTop + top;
                            protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop + 1;
                        }
                    } else if (!startEndElement.endElement.parentElement.classList.contains("protyle-wysiwyg")) {
                        hideElements(["select"], protyle);
                        startEndElement.endElement.parentElement.classList.add("protyle-wysiwyg--select");
                    }
                } else {
                    startEndElement.endElement.classList.remove("protyle-wysiwyg--select");
                    startEndElement.endElement.removeAttribute("select-end");
                    const previousElement = getPreviousBlock(startEndElement.endElement);
                    if (previousElement) {
                        previousElement.setAttribute("select-end", "true");
                        if (previousElement.getBoundingClientRect().top <= protyle.contentElement.getBoundingClientRect().top) {
                            preventScroll(protyle);
                            previousElement.scrollIntoView(true);
                        }
                    }
                }
            }
        });
        controller.abort("Shift+向上箭头选择处理完成");
    }
};

/**
 * 处理Shift+向下箭头选择的快捷键
 */
export const shiftDownSelectMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    editorElement: HTMLElement,
    range: Range,
    controller: AbortController
): Promise<void> => {
    if (matchHotKey("⇧↓", event)) {
        downSelect({
            protyle,
            event,
            nodeElement,
            editorElement,
            range,
            cb(selectElements) {
                const startEndElement = getStartEndElement(selectElements);
                if (startEndElement.startElement.getBoundingClientRect().top <= startEndElement.endElement.getBoundingClientRect().top) {
                    const nextElement = startEndElement.endElement.nextElementSibling as HTMLElement;
                    if (nextElement && nextElement.getAttribute("data-node-id")) {
                        if (nextElement.getBoundingClientRect().width === 0) {
                            // https://github.com/siyuan-note/siyuan/issues/11194
                            hideElements(["select"], protyle);
                            startEndElement.endElement.parentElement.classList.add("protyle-wysiwyg--select");
                        } else {
                            nextElement.classList.add("protyle-wysiwyg--select");
                            nextElement.setAttribute("select-end", "true");
                            startEndElement.endElement.removeAttribute("select-end");
                            const bottom = nextElement.getBoundingClientRect().bottom - protyle.contentElement.getBoundingClientRect().bottom;
                            if (bottom > 0) {
                                protyle.contentElement.scrollTop = protyle.contentElement.scrollTop + bottom;
                                protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop - 1;
                            }
                        }
                    } else if (!startEndElement.endElement.parentElement.classList.contains("protyle-wysiwyg")) {
                        hideElements(["select"], protyle);
                        startEndElement.endElement.parentElement.classList.add("protyle-wysiwyg--select");
                    }
                } else {
                    startEndElement.endElement.classList.remove("protyle-wysiwyg--select");
                    startEndElement.endElement.removeAttribute("select-end");
                    const nextElement = getNextBlock(startEndElement.endElement);
                    if (nextElement) {
                        nextElement.setAttribute("select-end", "true");
                        if (nextElement.getBoundingClientRect().bottom >= protyle.contentElement.getBoundingClientRect().bottom) {
                            preventScroll(protyle);
                            nextElement.scrollIntoView(false);
                        }
                    }
                }
            }
        });
        controller.abort("Shift+向下箭头选择处理完成");
    }
};

/**
 * 扩展选择中间件，处理所有扩展选择相关的快捷键
 * 包括 expandUp、expandDown、⇧↑、⇧↓ 等快捷键
 */
export const expandSelectMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    editorElement: HTMLElement,
    range: Range,
    controller: AbortController
): Promise<void> => {
    const signal = controller.signal;

    await expandUpSelectMiddleware(event, protyle, nodeElement, editorElement, range, controller);
    if (signal.aborted) {
        return;
    }

    await expandDownSelectMiddleware(event, protyle, nodeElement, editorElement, range, controller);
    if (signal.aborted) {
        return;
    }

    await shiftUpSelectMiddleware(event, protyle, nodeElement, editorElement, range, controller);
    if (signal.aborted) {
        return;
    }

    await shiftDownSelectMiddleware(event, protyle, nodeElement, editorElement, range, controller);
};