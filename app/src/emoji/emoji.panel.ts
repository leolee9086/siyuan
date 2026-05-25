import {fetchPost} from "../util/network/fetch";
import {Dialog} from "../dialog";
import {Constants} from "../constants";
import {setStorageVal} from "../protyle/util/compatibility";
import {buildDynamicTabHTML} from "./emoji.dynamic";
import {handleEmojiKeydown} from "./emoji.panel.keyboard";
import {
    unicode2Emoji,
    filterEmoji,
    lazyLoadEmoji,
    lazyLoadEmojiImg,
    addEmoji,
    getRandomEmoji,
    updateFileTreeEmoji,
    updateOutlineEmoji,
    getEmojiDesc,
    getEmojiTitle,
} from "./index";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

const renderEmojiContent = (previousIndex: string, previousContentElement: Element) => {
    if (!previousIndex) {
        return;
    }
    let html = "";
    window.siyuan.emojis[parseInt(previousIndex)].items.forEach(emoji => {
        html += `<button data-unicode="${emoji.unicode}" class="emojis__item ariaLabel" aria-label="${getEmojiDesc(emoji)}">${unicode2Emoji(emoji.unicode)}</button>`;
    });
    previousContentElement.innerHTML = html;
    previousContentElement.removeAttribute("data-index");
    previousContentElement.removeAttribute("style");
};

export const buildDialogHTML = (dynamicURL: string, dynamicCurrentObj: IObject, id: string, hide?: { dynamic: boolean, custom: boolean }) => {
    return `<div class="emojis">
    <div class="emojis__tabheader">
        <div data-type="tab-emoji" class="ariaLabel block__icon block__icon--show" aria-label="${siyuanI18n.emoji}"><svg><use xlink:href="#iconEmoji"></use></svg></div>
        <div class="fn__space"></div>
        <div data-type="tab-dynamic" class="ariaLabel block__icon block__icon--show${hide?.dynamic ? " fn__none" : ""}" aria-label="${siyuanI18n.dynamicIcon}"><svg><use xlink:href="#iconCalendar"></use></svg></div>
        <div class="fn__flex-1"></div>
        <span class="block__icon block__icon--show fn__flex-center ariaLabel" data-action="remove" aria-label="${siyuanI18n.remove}"><svg><use xlink:href="#iconTrashcan"></use></svg></span>
    </div>
    <div class="emojis__tabbody">
        <div class="fn__none" data-type="tab-emoji">
            <div class="fn__hr"></div>
            <div class="fn__flex">
                <span class="fn__space"></span>
                <label class="b3-form__icon fn__flex-1" style="overflow:initial;">
                    <svg class="b3-form__icon-icon"><use xlink:href="#iconSearch"></use></svg>
                    <input class="b3-form__icon-input b3-text-field fn__block" placeholder="${siyuanI18n.search}">
                </label>
                <span class="fn__space"></span>
                <span class="block__icon block__icon--show fn__flex-center ariaLabel" data-action="random" aria-label="${siyuanI18n.random}"><svg><use xlink:href="#iconRefresh"></use></svg></span>
                <span class="fn__space"></span>
            </div>
            <div class="emojis__panel">${filterEmoji("", undefined, hide?.custom)}</div>
            <div class="fn__flex">
                ${[
            ["2b50", siyuanI18n.recentEmoji],
            ["1f527", getEmojiTitle(0)],
            ["1f60d", getEmojiTitle(1)],
            ["1f433", getEmojiTitle(2)],
            ["1f96a", getEmojiTitle(3)],
            ["1f3a8", getEmojiTitle(4)],
            ["1f3dd-fe0f", getEmojiTitle(5)],
            ["1f52e", getEmojiTitle(6)],
            ["267e-fe0f", getEmojiTitle(7)],
            ["1f6a9", getEmojiTitle(8)],
        ].map(([unicode, title], index) => {
            if (hide?.custom && index === 1) {
                return "";
            }
            return `<div data-type="${index}" class="emojis__type ariaLabel" aria-label="${title}">${unicode2Emoji(unicode)}</div>`;
        }).join("")}
            </div>
        </div>
        <div class="fn__none" data-type="tab-dynamic">
            ${buildDynamicTabHTML(dynamicURL, dynamicCurrentObj, id)}
        </div>
    </div>
</div>`;
};

export const bindEmojiPanelEvents = (
    dialog: Dialog,
    dialogElement: HTMLElement,
    emojisContentElement: Element,
    emojiSearchInputElement: HTMLInputElement,
    id: string,
    type: "doc" | "notebook" | "av",
    callback?: (emoji: string) => void,
    dynamicTextElements?: NodeListOf<HTMLInputElement>,
    dynamicDateElement?: HTMLInputElement,
    dynamicURL?: string,
    hide?: { dynamic: boolean, custom: boolean }
) => {
    emojiSearchInputElement.addEventListener("compositionend", () => {
        emojisContentElement.innerHTML = filterEmoji(emojiSearchInputElement.value, undefined, hide?.custom);
        if (emojiSearchInputElement.value) {
            emojisContentElement.nextElementSibling.classList.add("fn__none");
        } else {
            emojisContentElement.nextElementSibling.classList.remove("fn__none");
        }
        emojisContentElement.scrollTop = 0;
        dialog.element.querySelector(".emojis__item")?.classList.add("emojis__item--current");
        if (emojiSearchInputElement.value === "") {
            lazyLoadEmoji(dialog.element);
        }
        lazyLoadEmojiImg(dialog.element);
    });
    emojiSearchInputElement.addEventListener("input", (event: InputEvent) => {
        if (event.isComposing) {
            return;
        }
        emojisContentElement.innerHTML = filterEmoji(emojiSearchInputElement.value, undefined, hide?.custom);
        if (emojiSearchInputElement.value) {
            emojisContentElement.nextElementSibling.classList.add("fn__none");
        } else {
            emojisContentElement.nextElementSibling.classList.remove("fn__none");
        }
        emojisContentElement.scrollTop = 0;
        dialog.element.querySelector(".emojis__item")?.classList.add("emojis__item--current");
        if (emojiSearchInputElement.value === "") {
            lazyLoadEmoji(dialog.element);
        }
        lazyLoadEmojiImg(dialog.element);
    });
    emojiSearchInputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        handleEmojiKeydown(event, dialog, emojisContentElement, emojiSearchInputElement, id, type, callback);
    });
    // 不能使用 getEventName 否则 https://github.com/siyuan-note/siyuan/issues/5472
    dialog.element.addEventListener("click", (event) => {
        let target = event.target as HTMLElement;
        while (target && target !== dialog.element) {
            if (target.classList.contains("emojis__type")) {
                const titleElement = emojisContentElement.querySelector(`[data-type="${target.getAttribute("data-type")}"]`) as HTMLElement;
                if (titleElement) {
                    const index = titleElement.nextElementSibling.getAttribute("data-index");
                    if (index) {
                        renderEmojiContent(titleElement.previousElementSibling?.getAttribute("data-index"), titleElement.previousElementSibling);
                        renderEmojiContent(index, titleElement.nextElementSibling);
                    }
                    emojisContentElement.scrollTo({
                        top: titleElement.offsetTop - 77,
                        // behavior: "smooth"  不能使用，否则无法定位
                    });
                }
                break;
            } else if (target.getAttribute("data-action") === "remove") {
                if (type === "notebook") {
                    fetchPost("/api/notebook/setNotebookIcon", {
                        notebook: id,
                        icon: ""
                    }, () => {
                        updateFileTreeEmoji("", id, "iconNewNoteBook");
                    });
                } else if (type === "doc") {
                    fetchPost("/api/attr/setBlockAttrs", {
                        id: id,
                        attrs: {"icon": ""}
                    }, () => {
                        updateFileTreeEmoji("", id);
                        updateOutlineEmoji("", id);
                    });
                }
                if (callback) {
                    callback("");
                }
                dialog.destroy();
                break;
            } else if (target.classList.contains("emojis__item") || target.getAttribute("data-action") === "random" || target.classList.contains("emoji__dynamic-item")) {
                let unicode = "";
                if (target.classList.contains("emojis__item")) {
                    unicode = target.getAttribute("data-unicode");
                    dialog.destroy();
                } else if (target.classList.contains("emoji__dynamic-item")) {
                    unicode = target.getAttribute("src");
                    dialog.destroy();
                } else {
                    // 随机
                    unicode = getRandomEmoji();
                }
                if (type === "notebook") {
                    fetchPost("/api/notebook/setNotebookIcon", {
                        notebook: id,
                        icon: unicode
                    }, () => {
                        updateFileTreeEmoji(unicode, id, "iconNewNoteBook");
                    });
                } else if (type === "doc") {
                    fetchPost("/api/attr/setBlockAttrs", {
                        id,
                        attrs: {"icon": unicode}
                    }, () => {
                        updateFileTreeEmoji(unicode, id);
                        updateOutlineEmoji(unicode, id);
                    });
                }
                if (callback) {
                    callback(unicode);
                }
                addEmoji(unicode);
                break;
            } else if (target.getAttribute("data-type")?.startsWith("tab-")) {
                dialogElement.querySelectorAll('.emojis__tabheader [data-type|="tab"]').forEach((item: HTMLElement) => {
                    if (item.dataset.type === target.dataset.type) {
                        item.classList.add("block__icon--active");
                    } else {
                        item.classList.remove("block__icon--active");
                    }
                });
                dialogElement.querySelectorAll(".emojis__tabbody > div").forEach((item: HTMLElement) => {
                    if (item.dataset.type === target.dataset.type) {
                        item.classList.remove("fn__none");
                    } else {
                        item.classList.add("fn__none");
                    }
                });
                window.siyuan.storage[Constants.LOCAL_EMOJIS].currentTab = target.dataset.type.replace("tab-", "");
                setStorageVal(Constants.LOCAL_EMOJIS, window.siyuan.storage[Constants.LOCAL_EMOJIS]);
                break;
            } else if (target.classList.contains("color__square")) {
                dynamicTextElements[0].value = target.getAttribute("style").replace("background-color:", "");
                dynamicTextElements[0].dispatchEvent(new CustomEvent("input"));
                break;
            } else if ("clearDate" === target.dataset.action) {
                dynamicDateElement.value = "";
                dynamicDateElement.dispatchEvent(new CustomEvent("change"));
                break;
            }
            target = target.parentElement;
        }
    });
};
