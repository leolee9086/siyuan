import {enableLuteMarkdownSyntax, restoreLuteMarkdownSyntax} from "../util/paste";
import {hasClosestBlock, hasClosestByAttribute, hasClosestByTag, isInEmbedBlock} from "../util/hasClosest";
import {focusBlock, focusByWbr, getEditorRange, setInsertWbrHTML} from "../util/selection";
import {Constants} from "../../constants";
import {removeEmbed} from "./removeEmbed";
import {fetchSyncPost} from "../../util/network/fetch";
import {encodeBase64} from "../util/compatibility";
import {isIncludeCell} from "../util/table/selection/geometry";
import {getTableRangeHTML} from "../util/table";
import {updateCellsValue} from "../render/av/cell.update";
import {getContenteditableElement, getNextBlock, getTopAloneElement, hasNextSibling} from "./getBlock";
import {removeBlock} from "./remove";
import {updateTransaction} from "./transaction/update";
import {highlightRender} from "../render/highlightRender";
import {mathRender} from "../render/mathRender";
import {updateAVName} from "../render/av/action/name";
import * as dayjs from "dayjs";
import {nbsp2space, removeZWJ} from "../util/normalizeText";
import {emojiToMd} from "./index.copy";

export async function handleCut(
    protyle: IProtyle,
    event: ClipboardEvent & { target: HTMLElement },
) {
    window.siyuan.ctrlIsPressed = false; // https://github.com/siyuan-note/siyuan/issues/6373
    if (protyle.disabled) {
        return;
    }
    if (event.target.tagName === "PROTYLE-HTML" || event.target.localName === "input") {
        event.stopPropagation();
        return;
    }

    if (protyle.options.render.breadcrumb) {
        protyle.breadcrumb.hide();
    }
    const range = getEditorRange(protyle.wysiwyg.element);
    let nodeElement = hasClosestBlock(range.startContainer);
    if (!nodeElement) {
        event.stopPropagation();
        event.preventDefault();
        return;
    }
    // https://github.com/siyuan-note/siyuan/issues/11793
    const embedElement = isInEmbedBlock(nodeElement);
    if (embedElement && !embedElement.classList.contains("protyle-wysiwyg--select")) {
        nodeElement = embedElement;
    }
    event.stopPropagation();
    event.preventDefault();
    const selectImgElement = nodeElement.querySelector(".img--select");
    const selectAVElement = nodeElement.querySelector(".av__row--select, .av__cell--select");
    const selectTableElement = nodeElement.querySelector(".table__select")?.clientWidth > 0;
    let selectTableRange = false;
    let tableRangeElement: HTMLElement = null;
    let tableRangeStartCell: HTMLElement = null;
    let tableRangeEndCell: HTMLElement = null;
    if (!selectTableElement) {
        const startCell = hasClosestByTag(range.startContainer, "TD") || hasClosestByTag(range.startContainer, "TH");
        const endCell = hasClosestByTag(range.endContainer, "TD") || hasClosestByTag(range.endContainer, "TH");
        if (startCell && endCell && startCell !== endCell) {
            const startTable = (startCell as HTMLElement).closest("table");
            if (startTable && startTable === (endCell as HTMLElement).closest("table")) {
                selectTableRange = true;
                tableRangeElement = (startCell as HTMLElement).closest('[data-type="NodeTable"]') as HTMLElement;
                tableRangeStartCell = startCell as HTMLElement;
                tableRangeEndCell = endCell as HTMLElement;
            }
        }
    }
    let selectElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
    const cloneElement = range.cloneContents();
    if (selectElements.length === 0 && range.toString() === "" && !cloneElement.querySelector("img") &&
        !selectImgElement && !selectAVElement && !selectTableElement && !selectTableRange) {
        nodeElement.classList.add("protyle-wysiwyg--select");
        selectElements = [nodeElement];
    }
    let html = "";
    let textPlain = "";
    let isInCodeBlock = false;
    let needClipboardWrite = false;
    if (selectElements.length > 0) {
        if (selectElements[0].getAttribute("data-type") === "NodeListItem" &&
            selectElements[0].parentElement.classList.contains("list") &&   // 反链复制列表项 https://github.com/siyuan-note/siyuan/issues/6555
            selectElements[0].parentElement.childElementCount - 1 === selectElements.length) {
            const hasNoLiElement = selectElements.find(item => {
                if (!selectElements[0].parentElement.contains(item)) {
                    return true;
                }
            });
            if (!hasNoLiElement) {
                selectElements = [selectElements[0].parentElement];
            }
        }
        let listHTML = "";
        for (let i = 0; i < selectElements.length; i++) {
            const item = getTopAloneElement(selectElements[i]);
            let itemHTML = "";
            if (item.getAttribute("data-type") === "NodeHeading" && item.getAttribute("fold") === "1") {
                needClipboardWrite = true;
                const response = await fetchSyncPost("/api/block/getHeadingChildrenDOM", {
                    id: item.getAttribute("data-node-id"),
                    removeFoldAttr: false
                });
                itemHTML = response.data;
            } else if (item.getAttribute("data-type") !== "NodeBlockQueryEmbed" && item.querySelector('[data-type="NodeHeading"][fold="1"]')) {
                needClipboardWrite = true;
                const response = await fetchSyncPost("/api/block/getBlockDOM", {
                    id: item.getAttribute("data-node-id"),
                    notebook: protyle.notebookId,
                });
                itemHTML = response.data.dom;
            } else {
                itemHTML = removeEmbed(item);
            }
            if (item.getAttribute("data-type") === "NodeListItem") {
                if (!listHTML) {
                    listHTML = `<div data-subtype="${item.getAttribute("data-subtype")}" data-node-id="${Lute.NewNodeID()}" data-type="NodeList" class="list">`;
                }
                listHTML += itemHTML;
                if (i === selectElements.length - 1 ||
                    selectElements[i + 1].getAttribute("data-type") !== "NodeListItem" ||
                    selectElements[i + 1].getAttribute("data-subtype") !== item.getAttribute("data-subtype")
                ) {
                    html += `${listHTML}<div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
                    listHTML = "";
                }
            } else {
                html += itemHTML;
            }
        }
        const nextElement = getNextBlock(selectElements[selectElements.length - 1]);
        removeBlock(protyle, nodeElement, range, "remove");
        if (nextElement) {
            // Ctrl+X 剪切后光标应跳到下一行行首 https://github.com/siyuan-note/siyuan/issues/5485
            focusBlock(nextElement);
        }
    } else if (selectAVElement) {
        needClipboardWrite = true;
        const cellsValue = await updateCellsValue(protyle, nodeElement);
        html = JSON.stringify(cellsValue.json);
        textPlain = cellsValue.text;
    } else if (selectTableElement) {
        const selectCellElements: HTMLTableCellElement[] = [];
        const scrollLeft = nodeElement.firstElementChild.scrollLeft;
        const scrollTop = nodeElement.querySelector("table").scrollTop;
        const tableSelectElement = nodeElement.querySelector(".table__select") as HTMLElement;
        const tableElement = nodeElement.querySelector("table");
        nodeElement.querySelectorAll("th, td").forEach((item: HTMLTableCellElement) => {
            if (!item.classList.contains("fn__none") && isIncludeCell({
                tableSelectElement,
                scrollLeft,
                scrollTop,
                item,
            })) {
                selectCellElements.push(item);
            }
        });
        tableSelectElement.removeAttribute("style");
        if (getSelection().rangeCount > 0) {
            const range = getSelection().getRangeAt(0);
            if (nodeElement.contains(range.startContainer)) {
                range.insertNode(document.createElement("wbr"));
            }
        }
        const oldHTML = nodeElement.outerHTML;
        nodeElement.querySelector("wbr")?.remove();
        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
        if (selectCellElements.length > 0) {
            html = getTableRangeHTML(tableElement, selectCellElements[0], selectCellElements[selectCellElements.length - 1]);
        } else {
            html = "<table></table>";
        }
        selectCellElements.forEach((item) => {
            item.innerHTML = "";
        });
        textPlain = protyle.lute.HTML2Md(html);
        updateTransaction(protyle, nodeElement, oldHTML);
    } else {
        const id = nodeElement.getAttribute("data-node-id");
        setInsertWbrHTML(nodeElement, range, protyle);
        const oldHTML = protyle.wysiwyg.lastHTMLs[id] || nodeElement.outerHTML;
        const tempElement = document.createElement("div");
        // 首次选中标题时，range.startContainer 会为空
        let startContainer = range.startContainer;
        if (startContainer.nodeType === 3 && startContainer.textContent === "") {
            const nextSibling = hasNextSibling(range.startContainer);
            if (nextSibling) {
                startContainer = nextSibling;
            }
        }
        const headElement = hasClosestByAttribute(startContainer, "data-type", "NodeHeading");
        if (headElement && range.toString() === headElement.firstElementChild.textContent) {
            tempElement.insertAdjacentHTML("afterbegin", headElement.firstElementChild.innerHTML);
            headElement.firstElementChild.innerHTML = "";
        } else if (range.toString() !== "" && startContainer === range.endContainer &&
            range.startContainer.nodeType === 3 &&
            // 需使用 wholeText https://github.com/siyuan-note/siyuan/issues/14339
            range.endOffset === (range.endContainer as Text).wholeText.length &&
            range.startOffset === 0 &&
            !["DIV", "TD", "TH", "TR"].includes(range.startContainer.parentElement.tagName)) {
            // 选中整个内联元素
            tempElement.append(range.startContainer.parentElement);
            textPlain = tempElement.textContent;
        } else if (selectImgElement) {
            tempElement.append(selectImgElement);
        } else if (range.startContainer.nodeType === 3 && range.startContainer.parentElement.tagName === "SPAN" &&
            range.startContainer.parentElement.getAttribute("data-type") &&
            range.startContainer.parentElement === range.endContainer.parentElement) {
            // 剪切粗体等字体中的一部分
            const spanElement = range.startContainer.parentElement;
            const attributes = spanElement.attributes;
            const newSpanElement = document.createElement("span");
            for (let i = 0; i < attributes.length; i++) {
                newSpanElement.setAttribute(attributes[i].name, attributes[i].value);
            }
            if (spanElement.getAttribute("data-type").indexOf("block-ref") > -1 &&
                spanElement.getAttribute("data-subtype") === "d") {
                // 引用被剪切后需变为静态锚文本
                newSpanElement.setAttribute("data-subtype", "s");
                spanElement.setAttribute("data-subtype", "s");
            }
            newSpanElement.textContent = range.toString();
            textPlain = range.toString();
            range.deleteContents();
            tempElement.append(newSpanElement);
        } else {
            if (selectTableRange || cloneElement.querySelectorAll("td, th").length > 0) {
                const tableScrollLeft = nodeElement.firstElementChild.scrollLeft;
                const tableScrollTop = nodeElement.firstElementChild.scrollTop;
                const contentScrollTop = protyle.contentElement.scrollTop;
                if (selectTableRange) {
                    const tableElement = tableRangeElement.querySelector("table");
                    const newTableHTML = getTableRangeHTML(tableElement, tableRangeStartCell, tableRangeEndCell);
                    tempElement.innerHTML = newTableHTML;
                    textPlain = protyle.lute.HTML2Md(newTableHTML);
                    const wbrElement = document.createElement("wbr");
                    range.insertNode(wbrElement);
                    range.setStartAfter(wbrElement);
                    range.extractContents();
                } else {
                    // 表格内多格子 cut https://github.com/siyuan-note/siyuan/issues/564
                    const wbrElement = document.createElement("wbr");
                    range.insertNode(wbrElement);
                    range.setStartAfter(wbrElement);
                    tempElement.append(range.extractContents());
                }
                nodeElement.outerHTML = protyle.lute.SpinBlockDOM(nodeElement.outerHTML);
                nodeElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`) as HTMLElement;
                mathRender(nodeElement);
                focusByWbr(nodeElement, range);
                if (tableScrollLeft > 0) {
                    nodeElement.firstElementChild.scrollLeft = tableScrollLeft;
                }
                if (tableScrollTop > 0) {
                    nodeElement.firstElementChild.scrollTop = tableScrollTop;
                }
                if (contentScrollTop > 0) {
                    protyle.contentElement.scrollTop = contentScrollTop;
                    protyle.scroll.lastScrollTop = contentScrollTop - 1;
                }
            } else {
                const inlineMathElement = hasClosestByAttribute(range.commonAncestorContainer, "data-type", "inline-math");
                if (inlineMathElement) {
                    // 表格内剪切数学公式 https://ld246.com/article/1631708573504
                    tempElement.append(inlineMathElement);
                } else {
                    tempElement.append(range.cloneContents());
                    let parentElement: false | Element = getContenteditableElement(nodeElement);
                    // https://ld246.com/article/1647689760545
                    if (nodeElement.classList.contains("av")) {
                        updateAVName(protyle, nodeElement);
                    } else if (nodeElement.classList.contains("table")) {
                        parentElement = hasClosestByTag(range.startContainer, "TD") || hasClosestByTag(range.startContainer, "TH");
                    } else if (cloneElement.querySelector('.img, [data-type="inline-math"]')) {
                        textPlain = "";
                        cloneElement.childNodes.forEach((item: Element) => {
                            if (item.nodeType === 3) {
                                textPlain += item.textContent;
                            } else if (item.nodeType === 1 &&
                                (item.classList.contains("img") || item.getAttribute("data-type") === "inline-math")) {
                                textPlain += protyle.lute.BlockDOM2StdMd(item.outerHTML).trimEnd();
                            } else {
                                textPlain += item.textContent;
                            }
                        });
                    } else if (!hasClosestByTag(range.startContainer, "CODE")) {
                        textPlain = range.toString();
                    }
                    range.deleteContents();
                    if (parentElement) {
                        // 引用文本剪切 https://ld246.com/article/1647689760545
                        // 表格多行剪切 https://ld246.com/article/1652603836350
                        // 自定义表情的段落剪切后表情丢失 https://ld246.com/article/1668781478724
                        Array.from(parentElement.children).forEach(item => {
                            if (item.textContent === "" && (item.nodeType === 1 && !["BR", "IMG"].includes(item.tagName))) {
                                item.remove();
                            }
                        });
                    }
                }
            }
        }
        emojiToMd(tempElement);
        html = tempElement.innerHTML;
        // https://github.com/siyuan-note/siyuan/issues/10722
        if (hasClosestByAttribute(range.startContainer, "data-type", "NodeCodeBlock") ||
            hasClosestByTag(range.startContainer, "CODE")) {
            textPlain = tempElement.textContent.replace(Constants.ZWSP, "");
            isInCodeBlock = true;
        }
        // https://github.com/siyuan-note/siyuan/issues/4321
        if (!nodeElement.classList.contains("table")) {
            const editableElement = getContenteditableElement(nodeElement);
            if (editableElement && editableElement.textContent === "") {
                editableElement.innerHTML = "";
            }
        }
        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
        if (nodeElement.getAttribute("data-type") === "NodeCodeBlock") {
            range.insertNode(document.createElement("wbr"));
            nodeElement.querySelector('[data-render="true"]')?.removeAttribute("data-render");
            highlightRender(nodeElement);
        }
        if (nodeElement.parentElement.parentElement && !nodeElement.classList.contains("av")) {
            // 选中 heading 时，使用删除的 transaction
            setInsertWbrHTML(nodeElement, range, protyle);
            updateTransaction(protyle, nodeElement, oldHTML);
        }
    }
    protyle.hint.render(protyle);
    if (!selectAVElement) {
        textPlain = textPlain || protyle.lute.BlockDOM2StdMd(html).trimEnd(); // 需要 trimEnd，否则 \n 会导致 https://github.com/siyuan-note/siyuan/issues/6218
        if (nodeElement.classList.contains("table")) {
            textPlain = textPlain.replace(/<br>/g, "\n").replace(/<br\/>/g, "\n");
            textPlain = textPlain.endsWith("\n") ? textPlain.replace(/\n$/, "") : textPlain;
        }
    }
    textPlain = removeZWJ(nbsp2space(textPlain)); // Replace non-breaking spaces with normal spaces when copying https://github.com/siyuan-note/siyuan/issues/9382
    event.clipboardData.setData("text/plain", textPlain);

    if (!isInCodeBlock) {
        enableLuteMarkdownSyntax(protyle);
        let textSiyuan: string;
        if (selectTableElement || selectTableRange) {
            const newId = Lute.NewNodeID();
            textSiyuan = `<div data-node-id="${newId}" data-type="NodeTable" class="table"><div contenteditable="true" spellcheck="false">${html}<div class="protyle-action__table"><div class="table__resize"></div><div class="table__select"></div></div></div><div class="protyle-attr" contenteditable="false">\u200b</div></div>`;
            html = textSiyuan;
        } else {
            textSiyuan = html;
        }
        restoreLuteMarkdownSyntax(protyle);
        event.clipboardData.setData("text/siyuan", textSiyuan);
        // 在 text/html 中插入注释节点，用于右键菜单粘贴时获取 text/siyuan 数据
        const textHTML = `<!--data-siyuan='${encodeBase64(textSiyuan)}'-->` + removeZWJ((selectTableElement || selectTableRange) ? html : protyle.lute.BlockDOM2HTML(selectAVElement ? textPlain : html));
        event.clipboardData.setData("text/html", textHTML);
        if (needClipboardWrite) {
            try {
                await navigator.clipboard.write([new ClipboardItem({
                    ["text/plain"]: textPlain,
                    ["text/html"]: textHTML,
                })]);
            } catch (e) {
                console.log("Cut write clipboard error:", e);
            }
        }
    }
}
