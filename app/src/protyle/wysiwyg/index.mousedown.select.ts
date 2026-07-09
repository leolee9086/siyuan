import {hasClosestBlock, hasClosestByClassName} from "../util/hasClosest";
import {focusBlock} from "../util/selection";
import {countBlockWord} from "../../layout/status";
import {showMessage} from "../../dialog/message";
import {getTopAloneElement} from "./getBlock";
import {isInEmbedBlock} from "../util/hasClosest";
import {clearSelect} from "../util/clearSelect";
import {selectRow} from "../render/av/row";
import {isOnlyMeta} from "../util/compatibility";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 处理 shift+click 多选逻辑。
 * @returns true 表示已处理（调用方应 return），false 表示未处理
 */
export function handleShiftSelect(
    protyle: IProtyle,
    event: MouseEvent,
    nodeElement: HTMLElement | false,
    hasSelectClassElement: Element | null,
    galleryItemElement: HTMLElement | false,
): boolean {
    if (!event.shiftKey) {
        return false;
    }
    let startElement: HTMLElement | false;
    let endElement = nodeElement;
    // Electron 更新后 shift 向上点击获取的 range 不为上一个位置的 https://github.com/siyuan-note/siyuan/issues/9334
    if (getSelection().rangeCount > 0) {
        startElement = hasClosestBlock(getSelection().getRangeAt(0).startContainer) as HTMLElement;
    }
    // shift 多选
    if (!hasSelectClassElement && galleryItemElement) {
        galleryItemElement.classList.add("av__gallery-item--select");
        let sideElement = galleryItemElement.previousElementSibling;
        let previousList: Element[] = [];
        while (sideElement) {
            if (sideElement.classList.contains("av__gallery-item--select")) {
                break;
            } else {
                previousList.push(sideElement);
            }
            sideElement = sideElement.previousElementSibling;
            if (!sideElement) {
                previousList = [];
                break;
            }
        }
        sideElement = galleryItemElement.nextElementSibling;
        let nextList: Element[] = [];
        while (sideElement) {
            if (sideElement.classList.contains("av__gallery-item--select")) {
                break;
            } else {
                nextList.push(sideElement);
            }
            sideElement = sideElement.nextElementSibling as HTMLElement;
            if (!sideElement || sideElement.classList.contains("av__gallery-add")) {
                nextList = [];
                break;
            }
        }
        previousList.concat(nextList).forEach(item => {
            item.classList.add("av__gallery-item--select");
        });
        event.preventDefault();
    } else if (startElement && endElement && startElement !== endElement) {
        let toDown = true;
        const startRect = startElement.getBoundingClientRect();
        const endRect = endElement.getBoundingClientRect();
        let startTop = startRect.top;
        let endTop = endRect.top;
        if (startTop === endTop) {
            // 横排 https://ld246.com/article/1663036247544
            startTop = startRect.left;
            endTop = endRect.left;
        }
        if (startTop > endTop) {
            const tempElement = endElement;
            endElement = startElement;
            startElement = tempElement;
            const tempTop = endTop;
            endTop = startTop;
            startTop = tempTop;
            toDown = false;
        }
        let selectElements: Element[] = [];
        let currentElement: HTMLElement = startElement as HTMLElement;
        let hasJump = false;
        while (currentElement) {
            if (currentElement.classList.contains("protyle-breadcrumb__bar")) {
                currentElement = currentElement.nextElementSibling as HTMLElement;
            }
            if (currentElement && !currentElement.classList.contains("protyle-attr")) {
                const currentRect = currentElement.getBoundingClientRect();
                if (startRect.top === endRect.top ? (currentRect.left <= endTop) : (currentRect.top <= endTop)) {
                    if (hasJump) {
                        // 父节点的下个节点在选中范围内才可使用父节点作为选中节点
                        if (currentElement.nextElementSibling && !currentElement.nextElementSibling.classList.contains("protyle-attr")) {
                            const currentNextRect = currentElement.nextElementSibling.getBoundingClientRect();
                            if (startRect.top === endRect.top ?
                                (currentNextRect.left <= endTop && currentNextRect.bottom <= endRect.bottom) :
                                (currentNextRect.top <= endTop)) {
                                selectElements = [currentElement];
                                currentElement = currentElement.nextElementSibling as HTMLElement;
                                hasJump = false;
                            } else if (currentElement.parentElement.classList.contains("sb")) {
                                currentElement = hasClosestBlock(currentElement.parentElement) as HTMLElement;
                                hasJump = true;
                            } else {
                                break;
                            }
                        } else {
                            currentElement = hasClosestBlock(currentElement.parentElement) as HTMLElement;
                            hasJump = true;
                        }
                    } else {
                        if (!currentElement.classList.contains("sb__resize")) {
                            selectElements.push(currentElement);
                        }
                        currentElement = currentElement.nextElementSibling as HTMLElement;
                    }
                } else if (currentElement.parentElement.classList.contains("sb")) {
                    // 跳出超级块横向排版中的未选中元素
                    currentElement = hasClosestBlock(currentElement.parentElement) as HTMLElement;
                    hasJump = true;
                } else {
                    break;
                }
            } else {
                currentElement = hasClosestBlock(currentElement.parentElement) as HTMLElement;
                hasJump = true;
            }
        }
        if (selectElements.length === 1 && !selectElements[0].classList.contains("list") &&
            !selectElements[0].classList.contains("bq") && !selectElements[0].classList.contains("callout") &&
            !selectElements[0].classList.contains("sb")) {
            // 单个 p 不选中
        } else {
            const ids: string[] = [];
            if (!hasSelectClassElement && protyle.scroll && !protyle.scroll.element.classList.contains("fn__none") && !protyle.scroll.keepLazyLoad &&
                (startElement.getBoundingClientRect().top < -protyle.contentElement.clientHeight * 2 || endElement.getBoundingClientRect().bottom > protyle.contentElement.clientHeight * 2)) {
                showMessage(siyuanI18n.crossKeepLazyLoad);
            }
            selectElements.forEach(item => {
                if (!hasClosestByClassName(item, "protyle-wysiwyg--select")) {
                    item.classList.add("protyle-wysiwyg--select");
                    ids.push(item.getAttribute("data-node-id"));
                    // 清除选中的子块 https://ld246.com/article/1667826582251
                    item.querySelectorAll(".protyle-wysiwyg--select").forEach(subItem => {
                        subItem.classList.remove("protyle-wysiwyg--select");
                    });
                }
            });
            countBlockWord(ids);
            if (toDown) {
                focusBlock(selectElements[selectElements.length - 1], protyle.wysiwyg.element, false);
            } else {
                focusBlock(selectElements[0], protyle.wysiwyg.element, false);
            }
        }
        event.preventDefault();
    }
    return true;
}

/**
 * 处理 ctrl+click 多选逻辑。
 * @returns true 表示已处理（调用方应 return），false 表示未处理
 */
export function handleCtrlSelect(
    protyle: IProtyle,
    event: MouseEvent,
    target: HTMLElement,
    nodeElement: HTMLElement | false,
    hasSelectClassElement: Element | null,
    galleryItemElement: HTMLElement | false,
    wysiwygElement: HTMLElement,
): boolean {
    if (!isOnlyMeta(event) || event.shiftKey || event.altKey) {
        return false;
    }
    let ctrlElement = nodeElement;
    const rowElement = hasClosestByClassName(target, "av__row");
    if (!hasSelectClassElement && (galleryItemElement || (rowElement && !rowElement.classList.contains("av__row--header")))) {
        if (galleryItemElement) {
            galleryItemElement.classList.toggle("av__gallery-item--select");
        } else if (rowElement) {
            selectRow(rowElement.querySelector(".av__firstcol"), "toggle");
        }
    } else if (ctrlElement) {
        clearSelect(["row", "galleryItem"], wysiwygElement);
        const embedBlockElement = isInEmbedBlock(ctrlElement);
        if (embedBlockElement) {
            ctrlElement = embedBlockElement;
        }
        ctrlElement = getTopAloneElement(ctrlElement) as HTMLElement;
        if (ctrlElement.classList.contains("protyle-wysiwyg--select")) {
            ctrlElement.classList.remove("protyle-wysiwyg--select");
            ctrlElement.removeAttribute("select-start");
            ctrlElement.removeAttribute("select-end");
        } else {
            ctrlElement.classList.add("protyle-wysiwyg--select");
        }
        ctrlElement.querySelectorAll(".protyle-wysiwyg--select").forEach(item => {
            item.classList.remove("protyle-wysiwyg--select");
            item.removeAttribute("select-start");
            item.removeAttribute("select-end");
        });
        const ctrlParentElement = hasClosestByClassName(ctrlElement.parentElement, "protyle-wysiwyg--select");
        if (ctrlParentElement) {
            ctrlParentElement.classList.remove("protyle-wysiwyg--select");
            ctrlParentElement.removeAttribute("select-start");
            ctrlParentElement.removeAttribute("select-end");
        }
        const ids: string[] = [];
        protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select").forEach(item => {
            ids.push(item.getAttribute("data-node-id"));
        });
        countBlockWord(ids);
    }
    return true;
}
