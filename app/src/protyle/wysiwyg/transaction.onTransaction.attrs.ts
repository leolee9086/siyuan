import {Constants} from "../../constants";
import {isMobile} from "../../platform";
import {disabledProtyle, enableProtyle} from "../util/onGet";
import {resize} from "../util/resize";
import {MERMAID_LAYOUT_ATTR} from "../render/mermaidLayout";
import {processRender} from "../util/processCode";

export const handleUpdateAttrs = (action: IOperation, protyle: IProtyle): void => {
    const data = action.data as any;
    const mermaidLayoutChanged = data.new[MERMAID_LAYOUT_ATTR] !== data.old[MERMAID_LAYOUT_ATTR];
    const attrsResult: Record<string, string> = {};
    let bookmarkHTML = "";
    let nameHTML = "";
    let aliasHTML = "";
    let memoHTML = "";
    let avHTML = "";
    Object.keys(data.new).forEach(key => {
        attrsResult[key] = data.new[key];
        const escapeHTML = Lute.EscapeHTMLStr(data.new[key]);
        if (key === "bookmark") {
            bookmarkHTML = `<div class="protyle-attr--bookmark">${escapeHTML}</div>`;
        } else if (key === "name") {
            nameHTML = `<div class="protyle-attr--name"><svg><use xlink:href="#iconN"></use></svg>${escapeHTML}</div>`;
        } else if (key === "alias") {
            aliasHTML = `<div class="protyle-attr--alias"><svg><use xlink:href="#iconA"></use></svg>${escapeHTML}</div>`;
        } else if (key === "memo") {
            memoHTML = `<div class="protyle-attr--memo ariaLabel" aria-label="${escapeHTML}" data-position="north"><svg><use xlink:href="#iconM"></use></svg></div>`;
        } else if (key === "custom-avs" && data.new["av-names"]) {
            avHTML = `<div class="protyle-attr--av"><svg><use xlink:href="#iconDatabase"></use></svg>${(data.new["av-names"])}</div>`;
        }
    });
    let nodeAttrHTML = bookmarkHTML + nameHTML + aliasHTML + memoHTML + avHTML;
    if (protyle.block.rootID === action.id) {
        // 文档
        if (protyle.title) {
            if (data.new["custom-avs"] && !data.new["av-names"]) {
                nodeAttrHTML += protyle.title.element.querySelector(".protyle-attr--av")?.outerHTML || "";
            }
            const refElement = protyle.title.element.querySelector(".protyle-attr--refcount");
            if (refElement) {
                nodeAttrHTML += refElement.outerHTML;
            }
            if (data.new[Constants.CUSTOM_RIFF_DECKS] && data.new[Constants.CUSTOM_RIFF_DECKS] !== data.old[Constants.CUSTOM_RIFF_DECKS]) {
                protyle.title.element.style.animation = "addCard 450ms linear";
                protyle.title.element.setAttribute(Constants.CUSTOM_RIFF_DECKS, data.new[Constants.CUSTOM_RIFF_DECKS]);
                setTimeout(() => {
                    protyle.title.element.style.animation = "";
                }, 450);
            } else if (!data.new[Constants.CUSTOM_RIFF_DECKS]) {
                protyle.title.element.removeAttribute(Constants.CUSTOM_RIFF_DECKS);
            }
            protyle.title.element.querySelector(".protyle-attr").innerHTML = nodeAttrHTML;
        }
        protyle.wysiwyg.renderCustom(attrsResult);
        if (data.new[Constants.CUSTOM_SY_FULLWIDTH] !== data.old[Constants.CUSTOM_SY_FULLWIDTH]) {
            resize(protyle);
        }
        if (data.new[Constants.CUSTOM_SY_READONLY] !== data.old[Constants.CUSTOM_SY_READONLY]) {
            let customReadOnly = data.new[Constants.CUSTOM_SY_READONLY];
            if (!customReadOnly) {
                customReadOnly = window.siyuan.config.editor.readOnly ? "true" : "false";
            }
            if (customReadOnly === "true") {
                disabledProtyle(protyle);
            } else {
                enableProtyle(protyle);
            }
        }
        const backgroundChanged = data.new.icon !== data.old.icon ||
            data.new["title-img"] !== data.old["title-img"] ||
            data.new.tags !== data.old.tags;
        if (backgroundChanged) {
            const bgProtyle = isMobile ? window.siyuan.mobile.editor.protyle : protyle;
            if (bgProtyle.background) {
                bgProtyle.background.ial.icon = data.new.icon;
                bgProtyle.background.ial.tags = data.new.tags;
                bgProtyle.background.ial["title-img"] = data.new["title-img"];
                bgProtyle.background.render(bgProtyle.background.ial, bgProtyle.block.rootID);
            }
            if (data.new.icon !== data.old.icon) {
                bgProtyle.model?.parent.setDocIcon(data.new.icon);
            }
        }
        return;
    }
    protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${action.id}"]`).forEach((item: HTMLElement) => {
        if (item.getAttribute("data-type") === "NodeThematicBreak") {
            return;
        }
        Object.keys(data.old).forEach(key => {
            item.removeAttribute(key);
            if (key === "custom-avs") {
                item.removeAttribute("av-names");
            }
        });
        if (data.new.style && data.new[Constants.CUSTOM_RIFF_DECKS] && data.new[Constants.CUSTOM_RIFF_DECKS] !== data.old[Constants.CUSTOM_RIFF_DECKS]) {
            data.new.style += ";animation:addCard 450ms linear";
        }
        Object.keys(data.new).forEach(key => {
            if ("id" === key) {
                // 设置属性以后不应该给块元素添加 id 属性 No longer add the `id` attribute to block elements after setting the attribute https://github.com/siyuan-note/siyuan/issues/15327
                return;
            }

            item.setAttribute(key, data.new[key]);
            if (key === Constants.CUSTOM_RIFF_DECKS &&
                data.new[Constants.CUSTOM_RIFF_DECKS] !== data.old[Constants.CUSTOM_RIFF_DECKS]) {
                item.style.animation = "addCard 450ms linear";
                setTimeout(() => {
                    if (item.parentElement) {
                        item.style.animation = "";
                    } else {
                        protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${action.id}"]`).forEach((realItem: HTMLElement) => {
                            realItem.style.animation = "";
                        });
                    }
                }, 450);
            }
        });
        if (data["data-av-type"]) {
            item.setAttribute("data-av-type", data["data-av-type"]);
        }
        const attrElements = item.querySelectorAll(".protyle-attr");
        const attrElement = attrElements[attrElements.length - 1];
        if (data.new["custom-avs"] && !data.new["av-names"]) {
            nodeAttrHTML += attrElement.querySelector(".protyle-attr--av")?.outerHTML || "";
        }
        const refElement = attrElement.querySelector(".protyle-attr--refcount");
        if (refElement) {
            nodeAttrHTML += refElement.outerHTML;
        }
        attrElement.innerHTML = nodeAttrHTML + Constants.ZWSP;
        if (mermaidLayoutChanged && item.getAttribute("data-subtype") === "mermaid") {
            item.removeAttribute("data-render");
            processRender(item);
        }
    });
};
