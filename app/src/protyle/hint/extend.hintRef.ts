import { Constants } from "../../constants";
import { replaceFileName } from "../../editor/rename";
import { fetchPost } from "../../util/fetch";
import { hasClosestBlock } from "../util/hasClosest";
import { getEditorRange } from "../util/selection";
import { genHintItemHTML } from "./extend";

const genNewFileItem = (k: string) => {
    const newFileName = Lute.UnEscapeHTMLStr(replaceFileName(k));
    return {
        value: `((newFile "${newFileName}"${Constants.ZWSP}'${newFileName}${Lute.Caret}'))`,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconFile"></use></svg>
<span class="b3-list-item__text">${window.siyuan.languages.newFile} <mark>${k}</mark></span></div>`,
    }
}

/**
 * 生成块引用的值
 * @param item 块信息
 * @param key 搜索关键字
 * @param source 来源类型
 * @param nodeElement 当前节点元素
 * @returns 块引用的HTML字符串
 */
const genBlockRefValue = (item: IBlock, key: string, source: THintSource, nodeElement?: Element): string => {
    const refText = item.name || item.refText.replace(new RegExp(Constants.ZWSP, "g"), "");
    
    if (source === "search") {
        return `<span data-type="block-ref" data-id="${item.id}" data-subtype="s">${key}${Constants.ZWSP}${refText}</span>`;
    } else if (source === "av") {
        let avRefText = refText;
        if (nodeElement) {
            avRefText = item.ial["custom-sy-av-s-text-" + nodeElement.getAttribute("data-av-id")] || avRefText;
        }
        return `<span data-type="block-ref" data-id="${item.id}" data-subtype="s">${avRefText}</span>`;
    } else {
        return `<span data-type="block-ref" data-id="${item.id}" data-subtype="d">${refText}</span>`;
    }
}
export const hintRef = (key: string, protyle: IProtyle, source: THintSource): IHintData[] => {
    const nodeElement = hasClosestBlock(getEditorRange(protyle.wysiwyg.element).startContainer);
    protyle.hint.genLoading(protyle);
    fetchPost("/api/search/searchRefBlock", {
        k: key,
        id: nodeElement ? nodeElement.getAttribute("data-node-id") : protyle.block.parentID,
        beforeLen: Math.floor((Math.max(protyle.element.clientWidth / 2, 320) - 58) / 28.8),
        rootID: source === "av" ? "" : protyle.block.rootID,
        isDatabase: source === "av",
        isSquareBrackets: ["[[", "【【"].includes(protyle.hint.splitChar)
    }, (response) => {
        const dataList: IHintData[] = [];
        if (response.data.newDoc) {
            dataList.push(genNewFileItem(response.data.k));
        }
        response.data.blocks.forEach((item: IBlock) => {
            const value = genBlockRefValue(item, key, source, nodeElement || undefined);
            dataList.push({
                value,
                html: genHintItemHTML(item),
            });
        });
        if (source === "search") {
            protyle.hint.splitChar = "((";
            protyle.hint.lastIndex = -1;
        }
        if (dataList.length === 0) {
            dataList.push({
                value: "",
                html: window.siyuan.languages.emptyContent,
            });
        } else if (response.data.newDoc && dataList.length > 1) {
            dataList[1].focus = true;
        }
        protyle.hint.genHTML(dataList, protyle, true, source);
    });
    return [];
};
