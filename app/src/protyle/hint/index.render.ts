import {Constants} from "../../constants";
import {hasClosestBlock, hasClosestByAttribute, isInEmbedBlock} from "../util/hasClosest";
import {getSelectionOffset, getSelectionPosition} from "../util/selection";
import {genHintItemHTML, hintSlash} from "./extend";
import {setPosition} from "../../util/DOM/setPosition";
import {hasPreviousSibling} from "../wysiwyg/getBlock";
import {filterEmoji, getEmojiDesc, getEmojiTitle, lazyLoadEmoji, lazyLoadEmojiImg, unicode2Emoji} from "../../emoji";
import {isMobile} from "../../platform";
import {fetchPost} from "../../util/network/fetch";
import {withEncryptedNotebook} from "../../util/pathName";
import type {Hint} from "./index";

/** @同步豁免: 遗留代码 — 从 Hint.render 原样提取的渲染逻辑 */
export function handleRender(hint: Hint, protyle: IProtyle) {
    if (!window.getSelection().focusNode) {
        hint.element.classList.add("fn__none");
        clearTimeout(hint.timeId);
        return;
    }
    if (!hint.enableExtend) {
        clearTimeout(hint.timeId);
        return;
    }
    protyle.toolbar.range = getSelection().getRangeAt(0);
    // 粘贴后 range.startContainer 为空 https://github.com/siyuan-note/siyuan/issues/7360
    if (protyle.toolbar.range.startContainer.nodeType === 3 && protyle.toolbar.range.startContainer.textContent === "") {
        const lastSibling = hasPreviousSibling(protyle.toolbar.range.startContainer) as Text;
        if (lastSibling && lastSibling.nodeType === 3) {
            if (lastSibling.wholeText !== lastSibling.textContent) {
                let previousSibling = lastSibling.previousSibling;
                while (previousSibling && previousSibling.nodeType === 3) {
                    if (previousSibling.textContent === "") {
                        previousSibling = previousSibling.previousSibling;
                        previousSibling.nextSibling.remove();
                    } else {
                        lastSibling.textContent = previousSibling.textContent + lastSibling.textContent;
                        previousSibling.remove();
                        break;
                    }
                }
            }
            protyle.toolbar.range.setStart(lastSibling, lastSibling.textContent.length);
            protyle.toolbar.range.collapse(true);
        }
    }
    const start = getSelectionOffset(protyle.toolbar.range.startContainer, protyle.wysiwyg.element).start;
    const currentLineValue = protyle.toolbar.range.startContainer.textContent.substring(0, start) || "";
    const key = getKey(hint, currentLineValue, protyle.options.hint.extend);
    if (typeof key === "undefined" ||
        hasClosestByAttribute(protyle.toolbar.range.startContainer, "data-type", "code") ||
        hasClosestByAttribute(protyle.toolbar.range.startContainer, "data-type", "NodeCodeBlock")) {
        hint.element.classList.add("fn__none");
        clearTimeout(hint.timeId);
        return;
    }

    // https://github.com/siyuan-note/siyuan/issues/7933
    if (hint.splitChar === "#") {
        const blockElement = hasClosestBlock(protyle.toolbar.range.startContainer);
        if (blockElement && blockElement.getAttribute("data-type") === "NodeHeading") {
            const blockIndex = getSelectionOffset(protyle.toolbar.range.startContainer, blockElement).start;
            if (blockElement.textContent.startsWith("#".repeat(blockIndex))) {
                hint.element.classList.add("fn__none");
                clearTimeout(hint.timeId);
                return;
            }
        }
    }

    if (hint.splitChar === ":") {
        clearTimeout(hint.timeId);
        if (key) {
            handleGenEmojiHTML(hint, protyle, key);
        } else {
            hint.element.classList.add("fn__none");
        }
        return;
    }
    // https://github.com/siyuan-note/siyuan/issues/5083
    if (hint.splitChar === "/" || hint.splitChar === "、") {
        clearTimeout(hint.timeId);
        if (protyle.lite) {
            protyle.options.hint.extend.find((item) => {
                if (item.key === "/" && item.hint) {
                    item.hint(key, protyle, "hint");
                    return true;
                }
            });
            return;
        }
        const blockElement = hasClosestBlock(protyle.toolbar.range.startContainer);
        if (hint.enableSlash && !isMobile && blockElement && !isInEmbedBlock(blockElement)) {
            hint.genHTML(hintSlash(key, protyle), protyle, false, "hint");
        }
        return;
    }

    protyle.options.hint.extend.forEach((item) => {
        if (item.key === hint.splitChar) {
            clearTimeout(hint.timeId);
            hint.timeId = window.setTimeout(() => {
                hint.genHTML(item.hint(key, protyle, "hint"), protyle, false, "hint");
            }, protyle.options.hint.delay);
        }
    });
}

/** 从 Hint.getKey 原样提取 */
export function getKey(hint: Hint, currentLineValue: string, extend: IHintExtend[]) {
    const prevSplit = hint.splitChar;
    const prevLastIndex = hint.lastIndex;
    hint.lastIndex = -1;
    hint.splitChar = "";
    for (const item of extend) {
        let currentLastIndex = currentLineValue.lastIndexOf(item.key);
        // https://ld246.com/article/1701670704754
        if (Constants.BLOCK_HINT_KEYS.includes(item.key) && currentLastIndex > -1) {
            const thirdLastIndex = currentLineValue.lastIndexOf(item.key + item.key.substring(0, 1));
            if (thirdLastIndex > -1) {
                currentLastIndex = Math.min(currentLastIndex, currentLineValue.lastIndexOf(item.key + item.key.substring(0, 1)));
            }
        }
        if (hint.lastIndex < currentLastIndex) {
            hint.splitChar = item.key;
            hint.lastIndex = currentLastIndex;
        }
    }
    if (hint.lastIndex === -1) {
        return undefined;
    }
    // 上一次提示没有结束时不能被其余提示干扰 https://github.com/siyuan-note/siyuan/issues/14324
    if (!hint.element.classList.contains("fn__none") && prevSplit && prevSplit !== hint.splitChar &&
        !(["/", "、"].includes(prevSplit) && hint.splitChar === ":")) {
        hint.splitChar = prevSplit;
        hint.lastIndex = prevLastIndex;
    }
    // 冒号前为数字或冒号不进行emoji提示
    if (hint.splitChar === ":") {
        hint.enableEmoji = !(/\d/.test(currentLineValue.substr(hint.lastIndex - 1, 1)) ||
            currentLineValue.substr(hint.lastIndex - 1, 2) === "::");

    }
    const lineArray = currentLineValue.split(hint.splitChar);
    const lastItem = lineArray[lineArray.length - 1];
    if (lineArray.length > 1 &&
        // https://github.com/siyuan-note/siyuan/issues/10637
        lastItem.trimStart() === lastItem &&
        lastItem.length < Constants.SIZE_TITLE) {
        // 输入法自动补全 https://github.com/siyuan-note/insider/issues/100
        if (hint.splitChar === "【【" && currentLineValue.endsWith("【【】")) {
            return "";
        }
        return lastItem;
    }
    return undefined;
}

/** @同步豁免: 遗留代码 — 从 Hint.genEmojiHTML 原样提取的 emoji 面板生成逻辑 */
export function handleGenEmojiHTML(hint: Hint, protyle: IProtyle, value = "") {
    if (value && !hint.enableEmoji) {
        return;
    }

    const panelElement = hint.element.querySelector(".emojis__panel");
    if (panelElement) {
        panelElement.innerHTML = filterEmoji(value, 256);
        if (value) {
            panelElement.nextElementSibling.classList.add("fn__none");
        } else {
            panelElement.nextElementSibling.classList.remove("fn__none");
        }
        lazyLoadEmojiImg(panelElement);
    } else {
        // max-height：min(402px,40vh) 和 .protyle-hint 保持一致，否则 emoji 不显示底部导航
        hint.element.innerHTML = `<div style="padding:0;max-height:min(402px,40vh);width:366px" class="emojis">
<div class="emojis__panel">${filterEmoji(value, 256)}</div>
<div class="fn__flex${value ? " fn__none" : ""}">
    ${[
                ["2b50", window.siyuan.languages.recentEmoji],
                ["1f527", getEmojiTitle(0)],
                ["1f60d", getEmojiTitle(1)],
                ["1f433", getEmojiTitle(2)],
                ["1f96a", getEmojiTitle(3)],
                ["1f3a8", getEmojiTitle(4)],
                ["1f3dd-fe0f", getEmojiTitle(5)],
                ["1f52e", getEmojiTitle(6)],
                ["267e-fe0f", getEmojiTitle(7)],
                ["1f6a9", getEmojiTitle(8)],
            ].map(([unicode, title], index) =>
                `<button data-type="${index}" class="emojis__type ariaLabel" aria-label="${title}">${unicode2Emoji(unicode)}</button>`
            ).join("")}
</div>
</div>`;
        lazyLoadEmoji(hint.element);
        lazyLoadEmojiImg(hint.element);
    }
    const firstEmojiElement = hint.element.querySelector(".emojis__item");
    if (firstEmojiElement) {
        firstEmojiElement.classList.add("emojis__item--current");
        hint.element.classList.remove("fn__none");
        const textareaPosition = getSelectionPosition(protyle.wysiwyg.element);
        setPosition(hint.element, textareaPosition.left, textareaPosition.top + 26, 30);
        hint.element.querySelector(".emojis__panel").scrollTop = 0;
    } else {
        hint.element.classList.add("fn__none");
    }
}

/** @同步豁免: 遗留代码 — 从 Hint.genSearchHTML 原样提取的搜索引用块逻辑 */
export function handleGenSearchHTML(hint: Hint, protyle: IProtyle, searchElement: HTMLInputElement, nodeElement: false | HTMLElement, oldValue: string, source: THintSource) {
    hint.element.lastElementChild.innerHTML = '<div class="ft__center"><img style="height:32px;width:32px;" src="/stage/loading-pure.svg"></div>';
    fetchPost("/api/search/searchRefBlock", withEncryptedNotebook(protyle.notebookId, {
        k: searchElement.value,
        id: nodeElement ? nodeElement.getAttribute("data-node-id") : protyle.block.parentID,
        beforeLen: Math.floor((Math.max(protyle.element.clientWidth / 2, 320) - 58) / 28.8),
        rootID: source === "av" ? "" : protyle.block.rootID,
        isDatabase: source === "av",
    }), (response) => {
        let searchHTML = "";
        if (response.data.newDoc) {
            const blockRefText = `((newFile "${oldValue}"${Constants.ZWSP}'${response.data.k}${Lute.Caret}'))`;
            searchHTML += `<button style="width: calc(100% - 16px)" class="b3-list-item b3-list-item--two${response.data.blocks.length === 0 ? " b3-list-item--focus" : ""}" data-value="${encodeURIComponent(blockRefText)}"><div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconFile"></use></svg>
<span class="b3-list-item__text">${window.siyuan.languages.newFile} <mark>${response.data.k}</mark></span></div></button>`;
        }
        response.data.blocks.forEach((item: IBlock, index: number) => {
            let blockRefHTML;
            if (source === "av") {
                // av 搜索时需要获取值 https://github.com/siyuan-note/siyuan/issues/12020
                let refText = item.name || item.refText.replace(new RegExp(Constants.ZWSP, "g"), "");
                if (nodeElement) {
                    refText = item.ial["custom-sy-av-s-text-" + nodeElement.getAttribute("data-av-id")] || refText;
                }
                blockRefHTML = `<span data-type="block-ref" data-id="${item.id}" data-subtype="s">${refText}</span>`;
            } else {
                blockRefHTML = `<span data-type="block-ref" data-id="${item.id}" data-subtype="s">${oldValue}</span>`;
            }
            searchHTML += `<button style="width: calc(100% - 16px)" class="b3-list-item b3-list-item--two${index === 0 ? " b3-list-item--focus" : ""}" data-value="${encodeURIComponent(blockRefHTML)}">
${genHintItemHTML(item)}
</button>`;
        });
        if (searchHTML === "") {
            searchHTML = `<button style="width: calc(100% - 16px)" class="b3-list-item b3-list-item--two" data-value="">${window.siyuan.languages.emptyContent}</button>`;
        }
        hint.element.lastElementChild.innerHTML = searchHTML;
        setPosition(hint.element, parseInt(hint.element.style.left), parseInt(hint.element.style.right));
    });
}
