import {Constants} from "../../constants";
import {addEmoji, unicode2Emoji} from "../../emoji";
import {isOnlyMeta} from "../util/compatibility";
import {insertHTML} from "../util/insertHTML";
import {hideElements} from "../ui/hideElements";
import {upDownHint} from "../../util/DOM/upDownHint";
import type {HintDomain} from "./hint.types";

/** @同步豁免: 遗留代码 — 从 Hint.select 原样提取的键盘事件同步处理逻辑，需要即时阻止事件冒泡 */
export function handleSelect(hint: HintDomain, event: KeyboardEvent, protyle: IProtyle): boolean {
    const isEmojiPanel = hint.element.firstElementChild.classList.contains("emojis");
    if (hint.element.querySelectorAll("button").length === 0 && !isEmojiPanel) {
        return false;
    }
    if (event.key === "Enter") {
        return handleSelectEnter(hint, protyle, isEmojiPanel, event);
    }
    if (isEmojiPanel) {
        return handleSelectEmojiNavigation(hint, event);
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        upDownHint(hint.element.firstElementChild, event);
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        hideElements(["hint"], protyle);
        // 不需要 preventDefault https://github.com/siyuan-note/siyuan/issues/11846
        return true;
    }
    return false;
}

/** @同步豁免: 遗留代码 — Enter 键确认选择，需要同步阻止默认行为 */
function handleSelectEnter(hint: HintDomain, protyle: IProtyle, isEmojiPanel: boolean, event: KeyboardEvent): boolean {
    if (isEmojiPanel) {
        const currentElement = hint.element.querySelector(".emojis__item--current");
        if (!currentElement) {
            return false;
        }
        const unicode = currentElement.getAttribute("data-unicode");
        if (hint.element.querySelectorAll(".emojis__title").length > 2) {
            // /emoji 后会自动添加冒号，导致 range 无法计算，因此不依赖 this.fill
            const range = getSelection().getRangeAt(0);
            if (range.endContainer.nodeType !== 3) {
                range.endContainer.childNodes[range.endOffset - 1]?.remove();
            }
            addEmoji(unicode);
            let emoji;
            if (unicode.indexOf(".") > -1) {
                emoji = `:${unicode.split(".")[0]}: `;
            } else {
                emoji = unicode2Emoji(unicode) + " ";
            }
            insertHTML(protyle.lute.SpinBlockDOM(emoji), protyle);
            hint.element.classList.add("fn__none");
        } else {
            hint.fill(unicode, protyle);
        }
    } else {
        const mark = decodeURIComponent(hint.element.querySelector(".b3-list-item--focus").getAttribute("data-value"));
        if (mark === Constants.ZWSP + 3) {
            (hint.element.querySelector(".b3-list-item--focus input") as HTMLElement).click();
        } else {
            hint.fill(mark, protyle, true, isOnlyMeta(event));
        }
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
}

/** @同步豁免: 遗留代码 — emoji 面板方向键导航，需要同步操作 DOM 焦点 */
function handleSelectEmojiNavigation(hint: HintDomain, event: KeyboardEvent): boolean {
    const currentElement: HTMLElement = hint.element.querySelector(".emojis__item--current");
    if (!currentElement) {
        return false;
    }
    let newCurrentElement: HTMLElement;
    if (event.key === "ArrowLeft") {
        if (currentElement.previousElementSibling) {
            currentElement.classList.remove("emojis__item--current");
            newCurrentElement = currentElement.previousElementSibling as HTMLElement;
        } else if (currentElement.parentElement.previousElementSibling?.previousElementSibling) {
            currentElement.classList.remove("emojis__item--current");
            newCurrentElement = currentElement.parentElement.previousElementSibling.previousElementSibling.lastElementChild as HTMLElement;
        }
    } else if (event.key === "ArrowRight") {
        if (currentElement.nextElementSibling) {
            currentElement.classList.remove("emojis__item--current");
            newCurrentElement = currentElement.nextElementSibling as HTMLElement;
        } else if (currentElement.parentElement.nextElementSibling?.nextElementSibling) {
            currentElement.classList.remove("emojis__item--current");
            newCurrentElement = currentElement.parentElement.nextElementSibling.nextElementSibling.firstElementChild as HTMLElement;
        }
    } else if (event.key === "ArrowDown") {
        if (!currentElement.nextElementSibling) {
            const nextContentElement = currentElement.parentElement.nextElementSibling?.nextElementSibling;
            if (nextContentElement) {
                newCurrentElement = nextContentElement.firstElementChild as HTMLElement;
                currentElement.classList.remove("emojis__item--current");
            }
        } else {
            currentElement.classList.remove("emojis__item--current");
            let counter = Math.floor(currentElement.parentElement.clientWidth / (currentElement.clientWidth + 2));
            newCurrentElement = currentElement;
            while (newCurrentElement.nextElementSibling && counter > 0) {
                newCurrentElement = newCurrentElement.nextElementSibling as HTMLElement;
                counter--;
            }
        }
        event.preventDefault();
        event.stopPropagation();
    } else if (event.key === "ArrowUp") {
        if (!currentElement.previousElementSibling) {
            const prevContentElement = currentElement.parentElement.previousElementSibling?.previousElementSibling;
            if (prevContentElement) {
                newCurrentElement = prevContentElement.lastElementChild as HTMLElement;
                currentElement.classList.remove("emojis__item--current");
            }
        } else {
            currentElement.classList.remove("emojis__item--current");
            let counter = Math.floor(currentElement.parentElement.clientWidth / (currentElement.clientWidth + 2));
            newCurrentElement = currentElement;
            while (newCurrentElement.previousElementSibling && counter > 0) {
                newCurrentElement = newCurrentElement.previousElementSibling as HTMLElement;
                counter--;
            }
        }
        event.preventDefault();
        event.stopPropagation();
    }
    if (newCurrentElement) {
        newCurrentElement.classList.add("emojis__item--current");
        const emojisContentElement = hint.element.querySelector(".emojis__panel");
        if (newCurrentElement.offsetTop - 8 < emojisContentElement.scrollTop) {
            emojisContentElement.scrollTop = newCurrentElement.offsetTop - 8;
        } else {
            const topHeight = emojisContentElement.nextElementSibling.classList.contains("fn__none") ? 8 : 36;
            if (newCurrentElement.offsetTop + topHeight - hint.element.clientHeight + newCurrentElement.clientHeight > emojisContentElement.scrollTop) {
                emojisContentElement.scrollTop = newCurrentElement.offsetTop + topHeight - hint.element.clientHeight + newCurrentElement.clientHeight;
            }
        }
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
}
