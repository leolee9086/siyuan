import {unicode2Emoji, getEmojiDesc, getEmojiTitle} from "./emoji.render";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

export const filterEmoji = (key = "", max?: number, hideCustom = false) => {
    let html = "";
    const recentEmojis: IEmojiItem[] = [];
    if (key) {
        html = `<div class="emojis__title">${siyuanI18n.emoji}</div><div class="emojis__content">`;
    }
    let maxCount = 0;
    let keyHTML = "";
    const customStore: IEmojiItem[] = [];
    window.siyuan.emojis.forEach((category, index) => {
        if (hideCustom && category.id === "custom") {
            return;
        }
        if (!key) {
            html += `<div class="emojis__title" data-type="${index + 1}">${getEmojiTitle(index)}</div><div style="min-height:${index === 0 ? "30px" : "300px"}" class="emojis__content"${index > 1 ? ' data-index="' + index + '"' : ""}>`;
        }
        if (category.items.length === 0 && index === 0 && !key) {
            html += `<div style="margin-left: 4px">${siyuanI18n.setEmojiTip}</div>`;
        }

        category.items.forEach(emoji => {
            if (key) {
                if (window.siyuan.config.editor.emoji.includes(emoji.unicode) &&
                    (unicode2Emoji(emoji.unicode) === key ||
                        emoji.keywords.toLowerCase().indexOf(key.toLowerCase()) > -1 ||
                        emoji.description.toLowerCase().indexOf(key.toLowerCase()) > -1 ||
                        emoji.description_zh_cn.toLowerCase().indexOf(key.toLowerCase()) > -1 ||
                        emoji.description_ja_jp.toLowerCase().indexOf(key.toLowerCase()) > -1)
                ) {
                    recentEmojis.push(emoji);
                }
                if (max && maxCount > max) {
                    return;
                }
                if (unicode2Emoji(emoji.unicode) === key ||
                    emoji.keywords.toLowerCase().indexOf(key.toLowerCase()) > -1 ||
                    emoji.description.toLowerCase().indexOf(key.toLowerCase()) > -1 ||
                    emoji.description_zh_cn.toLowerCase().indexOf(key.toLowerCase()) > -1 ||
                    emoji.description_ja_jp.toLowerCase().indexOf(key.toLowerCase()) > -1) {
                    if (category.id === "custom") {
                        customStore.push(emoji);
                    } else {
                        keyHTML += `<button data-unicode="${emoji.unicode}" class="emojis__item ariaLabel" aria-label="${getEmojiDesc(emoji)}">
${unicode2Emoji(emoji.unicode, undefined, false, true)}</button>`;
                    }
                    maxCount++;
                }
            } else {
                if (window.siyuan.config.editor.emoji.includes(emoji.unicode)) {
                    recentEmojis.push(emoji);
                }
                if (index < 2) {
                    html += `<button data-unicode="${emoji.unicode}" class="emojis__item ariaLabel" aria-label="${getEmojiDesc(emoji)}">
${unicode2Emoji(emoji.unicode, undefined, false, true)}</button>`;
                }
            }
        });
        if (!key) {
            html += "</div>";
        }
    });
    if (key) {
        customStore.sort((a, b) => {
            const aKeywords = a.keywords.split("/");
            const bKeywords = b.keywords.split("/");
            if (aKeywords[aKeywords.length - 1].toLowerCase().indexOf(key.toLowerCase()) < bKeywords[bKeywords.length - 1].toLowerCase().indexOf(key.toLowerCase())) {
                return -1;
            }
            return 0;
        }).sort((a, b) => {
            const aKeywords = a.keywords.split("/");
            const bKeywords = b.keywords.split("/");
            if (aKeywords[aKeywords.length - 1].toLowerCase().indexOf(key.toLowerCase()) === bKeywords[bKeywords.length - 1].toLowerCase().indexOf(key.toLowerCase()) && aKeywords[aKeywords.length - 1].length < bKeywords[bKeywords.length - 1].length) {
                return -1;
            }
            return 0;
        }).forEach(item => {
            html += `<button data-unicode="${item.unicode}" class="emojis__item ariaLabel" aria-label="${getEmojiDesc(item)}">
${unicode2Emoji(item.unicode, undefined, false, true)}</button>`;
        });
        html = html + keyHTML + "</div>";
    }
    let recentHTML = "";
    if (recentEmojis.length > 0) {
        recentHTML = `<div class="emojis__title" data-type="0">${siyuanI18n.recentEmoji}</div><div class="emojis__content">`;
        window.siyuan.config.editor.emoji.forEach(emojiUnicode => {
            const emoji = recentEmojis.filter((item) => item.unicode === emojiUnicode);
            if (emoji[0]) {
                recentHTML += `<button data-unicode="${emoji[0].unicode}" class="emojis__item ariaLabel" aria-label="${getEmojiDesc(emoji[0])}">
${unicode2Emoji(emoji[0].unicode, undefined, false, true)}
</button>`;
            }
        });
        recentHTML += "</div>";
    }

    if (recentHTML + html === "") {
        return `<div class="emojis__title">${siyuanI18n.emptyContent}</div>`;
    }
    return recentHTML + html;
};
