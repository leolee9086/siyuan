import { Constants } from "../../constants";
import { replaceFileName } from "../../editor/rename";
import { fetchPost } from "../../util/network/fetch";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {escapeHtml, escapeSearchHighlight, stripSearchMark} from "../../util/DOM/escape";
import { hasClosestBlock } from "../util/hasClosest";
import { getEditorRange } from "../util/selection";
import {genHintItemHTML} from "./result/item";
import {withEncryptedNotebook} from "../../util/file/notebook/store";

const genNewFileItem = (k: string) => {
    const newFileName = Lute.UnEscapeHTMLStr(replaceFileName(k));
    return {
        value: `((newFile "${newFileName}"${Constants.ZWSP}'${newFileName}${Lute.Caret}'))`,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconFile"></use></svg>
<span class="b3-list-item__text">${siyuanI18n.newFile} <mark>${k}</mark></span></div>`,
    };
};

/**
 * 生成块引用的值
 * @param item 块信息
 * @param key 搜索关键字
 * @param source 来源类型
 * @param nodeElement 当前节点元素
 * @returns 块引用的HTML字符串
 */
const genBlockRefValue = (item: IBlock, key: string, source: THintSource, nodeElement?: Element): string => {
    const refText = item.name ? stripSearchMark(escapeSearchHighlight(item.name)) : (item.refText ? item.refText.replace(new RegExp(Constants.ZWSP, "g"), "") : "*");

    if (source === "search") {
        return `<span data-type="block-ref" data-id="${item.id}" data-subtype="s">${key}${Constants.ZWSP}${refText}</span>`;
    } else if (source === "av") {
        let avRefText = refText;
        if (nodeElement) {
            avRefText = escapeHtml(item.ial["custom-sy-av-s-text-" + nodeElement.getAttribute("data-av-id")] || "") || avRefText;
        }
        return `<span data-type="block-ref" data-id="${item.id}" data-subtype="s">${avRefText}</span>`;
    } else {
        return `<span data-type="block-ref" data-id="${item.id}" data-subtype="d">${refText}</span>`;
    }
};

/** 生成多 ID 块引用的 HTML value */
export const genBlockRefValueMulti = (ids: string[], anchorText: string): string => {
    const joinedIds = ids.join(" ");
    return `<span data-type="block-ref" data-id="${joinedIds}" data-subtype="s">${anchorText}</span>`;
};
export const hintRef = (key: string, protyle: IProtyle, source: THintSource): IHintData[] => {
    if (!protyle.wysiwyg) {
        throw new Error("hintRef 方法调用时, protyle.wysiwyg 未定义");
    }
    const nodeElement = hasClosestBlock(getEditorRange(protyle.wysiwyg.element).startContainer);
    if (!protyle.hint) {
        throw new Error("hintRef 方法调用时, protyle.hint 未定义");
    }
    protyle.hint.genLoading(protyle);
    const refParams = protyle.lite ? {
        k: key,
        id: "",
        rootID: "",
        beforeLen: 48,
        isDatabase: false,
        isSquareBrackets: true,
    } : withEncryptedNotebook(protyle.notebookId, {
        k: key,
        id: nodeElement ? nodeElement.getAttribute("data-node-id") : protyle.block.parentID,
        beforeLen: Math.floor((Math.max(protyle.element.clientWidth / 2, 320) - 58) / 28.8),
        rootID: source === "av" ? "" : protyle.block.rootID,
        isDatabase: source === "av",
        isSquareBrackets: ["[[", "【【"].includes(protyle.hint.splitChar),
    });
    fetchPost("/api/search/searchRefBlock", refParams, (response) => {
        if (!protyle.hint) {
            throw new Error("hintRef 方法调用时, protyle.hint 未定义");
        }
        const blocks = response.data.blocks || [];
        // 只有多个搜索结果时才启用多选模式
        const isMultiRef = source === "search" && blocks.length > 1;
        protyle.hint.multiRefMode = isMultiRef;
        protyle.hint.selectedRefIds = isMultiRef ? new Set<string>() : undefined;
        const dataList: IHintData[] = [];
        if (isMultiRef) {
            if (response.data.newDoc) {
                dataList.push(genNewFileItem(response.data.k));
                dataList[0].focus = true;
            }
            blocks.forEach((item: IBlock) => {
                dataList.push({
                    value: item.id,
                    html: `<span class="b3-list-item__checkbox"><svg class="b3-list-item__graphic"><use xlink:href="#iconEmpty"></use></svg></span>${genHintItemHTML(item)}`,
                });
            });
        } else {
            if (response.data.newDoc) {
                dataList.push(genNewFileItem(response.data.k));
            }
            blocks.forEach((item: IBlock) => {
                const value = genBlockRefValue(item, key, source, nodeElement || undefined);
                dataList.push({
                    value,
                    html: genHintItemHTML(item),
                });
            });
        }
        if (source === "search") {
            protyle.hint.splitChar = "((";
            protyle.hint.lastIndex = -1;
        }
        if (dataList.length === 0) {
            dataList.push({
                value: "",
                html: siyuanI18n.emptyContent,
            });
        } else if (response.data.newDoc) {
            dataList[0] && (dataList[0].focus = true);
        }
        protyle.hint.genHTML(dataList, protyle, true, source);
        // 多选模式：在搜索框与结果列表之间插入固定确认按钮
        if (isMultiRef) {
            const confirmBtn = document.createElement("button");
            confirmBtn.className = "b3-list-item";
            confirmBtn.setAttribute("data-value", "__confirm__");
            confirmBtn.innerHTML = "<span class=\"b3-list-item__text\" style=\"color:var(--b3-theme-primary);font-weight:bold;\">✓ 确认插入 (0)</span>";
            // 插入在滚动列表之前（搜索框之后）
            const scrollContainer = protyle.hint.element.querySelector('div[style*="overflow:auto"]');
            if (scrollContainer) {
                scrollContainer.parentElement?.insertBefore(confirmBtn, scrollContainer);
            } else {
                protyle.hint.element.appendChild(confirmBtn);
            }
        }
    });
    return [];
};
