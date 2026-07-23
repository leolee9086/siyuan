import {Constants} from "../../constants";
import {hasClosestBlock} from "../util/hasClosest";
import {focusByRange, focusByWbr} from "../util/selection";
import {getSavePath} from "../../util/file/getSavePath";
import {getContenteditableElement} from "../wysiwyg/getBlock";
import {insertHTML} from "../util/insertHTML";
import {fetchPost} from "../../util/network/fetch";
import {pathPosix} from "../../util/file/pathName";
import {addEmoji, unicode2Emoji} from "../../emoji";
import {blockRender} from "../render/blockRender";
import {isMobile} from "../../platform";
import {isHTMLElement, isTextNode} from "../../util/DOM/element.guard";
import {getBlockRefAnchorText, newFileByRefHint} from "../../util/file/newFile";
import {handleFillSlash} from "./index.fill.slash";
import type {IFillSlashContext} from "./index.fill.slash";
import type {Hint} from "./index";

// AV 相关逻辑已拆分到 index.fill.av.ts
export {handleFillAv} from "./index.fill.av";

/** 嵌入块和标签触发的分隔符集合（中日文引号对和双花括号） */
const EMBED_TAG_SPLIT_CHARS = ["「「", "「『", "『「", "『『", "{{"];

/**
 * 将 setInlineMark 返回的首个引用元素的 range 末尾对齐到其最后子节点末尾，然后折叠。
 * handleNewFileBlockRef 和 handleBlockRef 共用此逻辑。
 */
function collapseRefElementRange(protyle: IProtyle, refElement: Node[] | undefined) {
    const toolbarRange = protyle.toolbar?.range;
    if (!toolbarRange) {
        return;
    }
    const firstRef = refElement?.[0];
    // 首元素存在且有子节点时，将 range 末尾对齐到引用元素的最后子节点
    if (firstRef?.lastChild) {
        toolbarRange.setEnd(firstRef.lastChild, firstRef.lastChild.textContent?.length ?? 0);
    }
    toolbarRange.collapse(false);
}

/**
 * Hint.fill 方法的主体逻辑（非 av、非斜杠部分）。
 * 处理 range 调整、块引用插入（含新建文件）、emoji 插入、嵌入/标签等提示，
 * 以及委托斜杠命令到 handleFillSlash。
 * @同步豁免: 遗留代码 — 需要同步操作 DOM Range 和事务
 */
export function handleFillContent(hint: Hint, value: string, protyle: IProtyle, refIsS: boolean, genEmojiHTML: (protyle: IProtyle) => void): void {
    const range = protyle.toolbar?.range;
    if (!range) {
        return;
    }
    const nodeElement = hasClosestBlock(range.startContainer);
    if (!nodeElement) {
        return;
    }
    hint.enableExtend = value === "emoji";
    // nodeElement 已通过上方守卫确认存在，直接取 id
    const id = nodeElement.getAttribute("data-node-id") ?? "";
    const html = nodeElement.outerHTML;
    adjustRangeForEndSplit(hint, range);
    // lastIndex > -1 表示 hint 解析到了有效的起始偏移，需要将 range 起点对齐到该位置
    if (hint.lastIndex > -1) {
        range.setStart(range.startContainer, hint.lastIndex);
        focusByRange(range);
    }
    // 新建文件：splitChar 为块引用键且 value 匹配 newFile 模式
    if (Constants.BLOCK_HINT_KEYS.includes(hint.splitChar) && value.startsWith("((newFile ") && value.endsWith(`${Lute.Caret}'))`)) {
        handleNewFileBlockRef(hint, value, protyle, range, refIsS);
        return;
    }
    // 普通块引用：splitChar 为块引用键但不是新建文件
    if (Constants.BLOCK_HINT_KEYS.includes(hint.splitChar)) {
        handleBlockRef(value, protyle, range, nodeElement, refIsS, hint.splitChar);
        return;
    }
    // emoji 输入：冒号触发的 emoji 选择
    if (hint.splitChar === ":") {
        handleEmoji(value, protyle);
        return;
    }
    // 嵌入块、标签等：中日文引号对、双花括号、井号或冒号触发
    if (EMBED_TAG_SPLIT_CHARS.includes(hint.splitChar) || hint.splitChar === "#" || hint.splitChar === ":") {
        handleEmbedOrTag(value, protyle, nodeElement, range);
        return;
    }
    // 斜杠命令：正斜杠或中文顿号触发
    if (hint.splitChar === "/" || hint.splitChar === "、") {
        const ctx: IFillSlashContext = {
            hint, value, protyle, range, nodeElement, id, html,
            genEmojiHTML,
        };
        handleFillSlash(ctx);
    }
}

/** @同步豁免: 遗留代码 — 调整 range 以匹配结束分隔符 */
function adjustRangeForEndSplit(hint: Hint, range: Range) {
    const endSplit = Constants.BLOCK_HINT_CLOSE_KEYS[hint.splitChar];
    const startContainer = range.startContainer;
    // 仅当 splitChar 为块引用键、存在结束分隔符、且起始容器为文本节点时才需要调整
    if (!Constants.BLOCK_HINT_KEYS.includes(hint.splitChar) || !endSplit || !isTextNode(startContainer)) {
        return;
    }
    // 文本中必须同时包含结束分隔符和起始分隔符才进行匹配
    // 在包含 )) 的块中引用时会丢失字符  https://ld246.com/article/1679980200782
    if (startContainer.wholeText.indexOf(endSplit) < 0 || startContainer.wholeText.indexOf(hint.splitChar) < 0) {
        return;
    }
    let matchEndChar = 0;
    let textNode: Node | null = startContainer;
    while (textNode && matchEndChar < 2) {
        const content = textNode.textContent ?? "";
        const index = content.indexOf(endSplit);
        const startIndex = content.indexOf(hint.splitChar);
        // 找到完整的结束分隔符，且它出现在起始分隔符之前（或起始分隔符不存在）
        if (index > -1 && (index < startIndex || startIndex < 0)) {
            matchEndChar = 2;
            range.setEnd(textNode, index + 2);
            break;
        }
        const indexOne = content.indexOf(endSplit.substr(1));
        // 找到结束分隔符的后半部分（跨节点匹配场景）
        if (indexOne > -1) {
            matchEndChar += 1;
        }
        // 两个半字符凑齐完整结束分隔符
        if (matchEndChar === 2) {
            range.setEnd(textNode, indexOne + 1);
            break;
        }
        textNode = textNode.nextSibling;
    }
}

/** @同步豁免: 遗留代码 — 通过块引用新建文档 */
function handleNewFileBlockRef(hint: Hint, value: string, protyle: IProtyle, range: Range, refIsS: boolean) {
    const fileNames = value.substring(11, value.length - 4).split(`"${Constants.ZWSP}'`);
    const realFileName = fileNames.length === 1 ? fileNames[0] : (fileNames[1] ?? fileNames[0]);
    newFileByRefHint(protyle, realFileName, (id) => {
        // https://github.com/siyuan-note/siyuan/issues/10133
        const toolbar = protyle.toolbar;
        if (!toolbar) {
            return;
        }
        toolbar.range = range;
        const anchorText = getBlockRefAnchorText((refIsS ? fileNames[0] : realFileName) ?? "");
        const refElement = toolbar.setInlineMark(protyle, "block-ref", "range", {
            type: "id",
            color: `${id}${Constants.ZWSP}${refIsS ? "s" : "d"}${Constants.ZWSP}${anchorText}`
        });
        collapseRefElementRange(protyle, refElement);
    });
}

/** 当提示值为空时，恢复空编辑区域的光标定位 */
function restoreCursorOnEmptyHint(nodeElement: HTMLElement, range: Range) {
    const editElement = getContenteditableElement(nodeElement);
    // 编辑区域内容为空时，需要插入 wbr 标记才能正确定位光标
    if (editElement?.textContent === "") {
        editElement.innerHTML = "<wbr>";
        focusByWbr(editElement, range);
    }
}

/** 设置块引用的子类型和锚文本 */
function applyBlockRefSubtype(tempElement: HTMLElement, refIsS: boolean, range: Range, splitChar: string) {
    // 静态引用：设置 subtype 为 s，若用户选中了非空文本则覆盖默认锚文本
    if (refIsS) {
        tempElement.setAttribute("data-subtype", "s");
        const staticText = range.toString().replace(splitChar, "");
        tempElement.innerText = staticText || tempElement.innerText;
        return;
    }
    // 动态引用：从 ZWSP 分隔的文本中提取动态锚文本
    tempElement.setAttribute("data-subtype", "d");
    const dynamicTexts = tempElement.innerText.split(Constants.ZWSP);
    // ZWSP 分隔后恰好两段时，第二段为实际动态锚文本
    const dynamicAnchor = dynamicTexts.length === 2 ? (dynamicTexts[1] ?? "") : "";
    tempElement.innerText = dynamicAnchor || tempElement.innerText;
}

/** @同步豁免: 遗留代码 — 插入块引用标记 */
function handleBlockRef(value: string, protyle: IProtyle, range: Range, nodeElement: HTMLElement, refIsS: boolean, splitChar: string) {
    // 提示值为空表示用户取消了选择，无需插入块引用，仅恢复光标
    if (value === "") {
        restoreCursorOnEmptyHint(nodeElement, range);
        return;
    }
    const wrapper = document.createElement("div");
    wrapper.innerHTML = value.replace(/<mark>/g, "").replace(/<\/mark>/g, "");
    const tempElement = wrapper.firstElementChild;
    if (!tempElement || !isHTMLElement(tempElement)) {
        return;
    }
    applyBlockRefSubtype(tempElement, refIsS, range, splitChar);
    const toolbar = protyle.toolbar;
    if (!toolbar) {
        return;
    }
    const refElement = toolbar.setInlineMark(protyle, "block-ref", "range", {
        type: "id",
        color: `${tempElement.getAttribute("data-id")}${Constants.ZWSP}${tempElement.getAttribute("data-subtype")}${Constants.ZWSP}${tempElement.textContent}`
    });
    collapseRefElementRange(protyle, refElement);
}

/** @同步豁免: 遗留代码 — 插入 emoji 字符 */
function handleEmoji(value: string, protyle: IProtyle) {
    addEmoji(value);
    // 带扩展名的 emoji（如 smile.png）使用 :name: 格式，否则使用 unicode 转换
    const emoji = value.indexOf(".") > -1
        ? `:${value.split(".")[0]}: `
        : unicode2Emoji(value) + " ";
    insertHTML(protyle.lute?.SpinBlockDOM(emoji) ?? "", protyle);
}

/** @同步豁免: 遗留代码 — 嵌入块、标签等提示插入 */
function handleEmbedOrTag(value: string, protyle: IProtyle, nodeElement: HTMLElement, range: Range) {
    // 提示值为空表示用户取消了选择，无需插入嵌入块/标签，仅恢复光标
    if (value === "") {
        restoreCursorOnEmptyHint(nodeElement, range);
        return;
    }
    insertHTML(protyle.lute?.SpinBlockDOM(value) ?? "", protyle, false, isMobile);
    if (protyle.wysiwyg) {
        blockRender(protyle, protyle.wysiwyg.element);
    }
}
