import {getRandom, isMobile} from "../util/platform/functions";
import {fetchPost} from "../util/network/fetch";
import {Constants} from "../constants";
import {Files} from "../layout/dock/Files";
import {getDockByType} from "../layout/tabUtil";
import {platform} from "../platform";
import {getAllEditor, getAllModels} from "../layout/getAll";
import {setNoteBook} from "../util/file/pathName";
import {Dialog} from "../dialog";
import {setPosition} from "../util/DOM/setPosition";
import {setStorageVal} from "../protyle/util/compatibility";
import {parseDynamicState, bindDynamicEvents} from "./emoji.dynamic";
import {buildDialogHTML, bindEmojiPanelEvents} from "./emoji.panel";
import {getLuteInstance} from "../protyle/render/setLute";
export {filterEmoji} from "./emoji.filter";

export const getRandomEmoji = () => {
    const emojis = window.siyuan.emojis[getRandom(0, window.siyuan.emojis.length - 1)];
    if (typeof emojis.items[getRandom(0, emojis.items.length - 1)] === "undefined") {
        return "1f600";
    }
    return emojis.items[getRandom(0, emojis.items.length - 1)].unicode;
};

export const unicode2Emoji = (unicode: string, className = "", needSpan = false, lazy = false) => {
    if (!unicode) {
        return "";
    }
    let emoji = "";
    if (unicode.startsWith("api/icon/getDynamicIcon")) {
        emoji = `<img class="${className}" ${lazy ? "data-" : ""}src="${unicode}"/>`;
        emoji = Lute.Sanitize(emoji);
    } else if (unicode.indexOf(".") > -1) {
        emoji = `<img class="${className}" ${lazy ? "data-" : ""}src="/emojis/${unicode}"/>`;
        emoji = Lute.Sanitize(emoji);
    } else {
        try {
            unicode.split("-").forEach(item => {
                if (item.length < 5) {
                    emoji += String.fromCodePoint(parseInt("0" + item, 16));
                } else {
                    emoji += String.fromCodePoint(parseInt(item, 16));
                }
            });
            if (needSpan) {
                emoji = `<span class="${className}">${emoji}</span>`;
            }
        } catch (e) {
            // 自定义表情搜索报错 https://github.com/siyuan-note/siyuan/issues/5883
            // 这里忽略错误不做处理
        }
    }
    return emoji;
};

export const lazyLoadEmoji = (element: HTMLElement) => {
    const emojiIntersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entrie: IntersectionObserverEntry & { target: HTMLImageElement }) => {
            const index = entrie.target.getAttribute("data-index");
            if ((typeof entrie.isIntersecting === "undefined" ? entrie.intersectionRatio !== 0 : entrie.isIntersecting) && index) {
                let html = "";
                window.siyuan.emojis[parseInt(index)].items.forEach(emoji => {
                    html += `<button data-unicode="${emoji.unicode}" class="emojis__item ariaLabel" aria-label="${getEmojiDesc(emoji)}">
${unicode2Emoji(emoji.unicode)}</button>`;
                });
                entrie.target.innerHTML = html;
                entrie.target.removeAttribute("data-index");
                entrie.target.style.minHeight = "";
            }
        });
    });
    element.querySelectorAll(".emojis__content").forEach((panelElement) => {
        emojiIntersectionObserver.observe(panelElement);
    });
};

export const lazyLoadEmojiImg = (element: Element) => {
    const emojiIntersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entrie: IntersectionObserverEntry & { target: HTMLImageElement }) => {
            const src = entrie.target.getAttribute("data-src");
            if ((typeof entrie.isIntersecting === "undefined" ? entrie.intersectionRatio !== 0 : entrie.isIntersecting) && src) {
                entrie.target.src = src;
                entrie.target.removeAttribute("data-src");
            }
        });
    });
    element.querySelectorAll("img").forEach((panelElement) => {
        emojiIntersectionObserver.observe(panelElement);
    });
};

export const addEmoji = (unicode: string) => {
    window.siyuan.config.editor.emoji.unshift(unicode);
    if (window.siyuan.config.editor.emoji.length > Constants.SIZE_UNDO) {
        window.siyuan.config.editor.emoji.pop();
    }
    window.siyuan.config.editor.emoji = Array.from(new Set(window.siyuan.config.editor.emoji));

    fetchPost("/api/setting/setEmoji", {emoji: window.siyuan.config.editor.emoji});
};

export const openEmojiPanel = (
    id: string,
    type: "doc" | "notebook" | "av",
    position: IPosition,
    callback?: (emoji: string) => void,
    dynamicImgElement?: HTMLElement,
    hide?: {
        dynamic: boolean,
        custom: boolean
    }) => {
    if (type !== "av") {
        window.siyuan.menus.menu.remove();
    } else {
        window.siyuan.menus.menu.removeScrollEvent();
    }

    const dynamicURL = "api/icon/getDynamicIcon?";
    const dynamicCurrentObj = parseDynamicState(dynamicURL, dynamicImgElement);

    const dialog = new Dialog({
        disableAnimation: true,
        transparent: true,
        hideCloseIcon: true,
        width: isMobile() ? "80vw" : "368px",
        height: "50vh",
        content: buildDialogHTML(dynamicURL, dynamicCurrentObj, id, hide)
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_EMOJIS);
    dialog.element.querySelector(".b3-dialog__container").setAttribute("data-menu", "true");
    const dialogElement = dialog.element.querySelector(".b3-dialog") as HTMLElement;
    dialogElement.style.justifyContent = "inherit";
    dialogElement.style.alignItems = "inherit";
    const currentTab = window.siyuan.storage[Constants.LOCAL_EMOJIS].currentTab;
    dialog.element.querySelector(`.emojis__tabheader [data-type="tab-${currentTab}"]`).classList.add("block__icon--active");
    dialog.element.querySelector(`.emojis__tabbody [data-type="tab-${currentTab}"]`).classList.remove("fn__none");
    setPosition(dialog.element.querySelector(".b3-dialog__container"), position.x, position.y, position.h, position.w);
    dialog.element.querySelector(".emojis__item").classList.add("emojis__item--current");
    const emojiSearchInputElement = dialog.element.querySelector('[data-type="tab-emoji"] .b3-text-field') as HTMLInputElement;
    const emojisContentElement = dialog.element.querySelector(".emojis__panel");

    const {dynamicTextElements, dynamicDateElement} = bindDynamicEvents(dialog, dynamicURL, dynamicCurrentObj);

    bindEmojiPanelEvents(
        dialog, dialogElement, emojisContentElement, emojiSearchInputElement,
        id, type, callback, dynamicTextElements, dynamicDateElement, dynamicURL, hide
    );

    if (!isMobile() && currentTab === "emoji") {
        emojiSearchInputElement.focus();
    }
    lazyLoadEmoji(dialog.element);
    lazyLoadEmojiImg(dialog.element);
};

export const updateOutlineEmoji = (unicode: string, id: string) => {
    if (platform !== "browser-mobile") {
        getAllModels().outline.forEach(model => {
            if (model.blockId === id) {
                model.headerElement.nextElementSibling.firstElementChild.outerHTML = unicode2Emoji(unicode || window.siyuan.storage[Constants.LOCAL_IMAGES].file, "b3-list-item__graphic", true);
            }
        });
    }
};

export const updateFileTreeEmoji = (unicode: string, id: string, icon = "iconFile") => {
    let emojiElement;
    // 移动端从侧边栏获取文件树emoji元素
    if (platform === "browser-mobile") {
        emojiElement = document.querySelector(`#sidebar [data-type="sidebar-file"] [data-node-id="${id}"] .b3-list-item__icon`);
    }
    // 桌面端从dock面板获取文件树emoji元素
    if (platform !== "browser-mobile") {
        const dockFile = getDockByType("file");
        if (dockFile) {
            const files = dockFile.data.file as Files;
            if (icon === "iconFile") {
                emojiElement = files.element.querySelector(`[data-node-id="${id}"] .b3-list-item__icon`);
            } else {
                emojiElement = files.element.querySelector(`[data-node-id="${id}"] .b3-list-item__icon`) || files.element.querySelector(`[data-url="${id}"] .b3-list-item__icon`) || files.closeElement.querySelector(`[data-url="${id}"] .b3-list-item__icon`);
            }
        }
    }
    if (emojiElement) {
        emojiElement.innerHTML = unicode2Emoji(unicode || (icon === "iconFile" ? (emojiElement.previousElementSibling.classList.contains("fn__hidden") ? window.siyuan.storage[Constants.LOCAL_IMAGES].file : window.siyuan.storage[Constants.LOCAL_IMAGES].folder) : window.siyuan.storage[Constants.LOCAL_IMAGES].note));
    }
    if (icon !== "iconFile") {
        setNoteBook();
    }
};

export const getEmojiDesc = (emoji: IEmojiItem) => {
    if (window.siyuan.config.lang === "zh-CN") {
        return emoji.description_zh_cn;
    }
    if (window.siyuan.config.lang === "ja") {
        return emoji.description_ja_jp;
    }
    return emoji.description;
};

export const getEmojiTitle = (index: number) => {
    if (window.siyuan.config.lang === "zh-CN") {
        return window.siyuan.emojis[index].title_zh_cn;
    }
    if (window.siyuan.config.lang === "ja") {
        return window.siyuan.emojis[index].title_ja_jp;
    }
    return window.siyuan.emojis[index].title;
};

const putEmojis = (protyle: IProtyle) => {
    const lute = getLuteInstance();
    if (lute && window.siyuan.emojis[0].items.length > 0) {
        const emojis: IObject = {};
        window.siyuan.emojis[0].items.forEach(emojiITem => {
            emojis[emojiITem.keywords] = protyle.options.hint.emojiPath + "/" + emojiITem.unicode;
        });
        // Lute 已为所有编辑器共享单例，PutEmojis 只需调用一次
        lute.PutEmojis(emojis);
    }
};

export const reloadEmoji = () => {
    fetchPost("/api/system/getEmojiConf", {}, response => {
        window.siyuan.emojis = response.data as IEmoji[];
        const editors = getAllEditor();
        if (editors.length > 0) {
            putEmojis(editors[0].protyle);
        }
    });
};
