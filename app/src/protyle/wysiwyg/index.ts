import {
    hasClosestBlock,
    hasClosestByAttribute,
    hasClosestByClassName,
    hasClosestByTag,
    isInEmbedBlock,
} from "../util/hasClosest";
import {
    getEditorRange,
    focusBlock,
    focusByWbr,
    focusByRange,
    setLastNodeRange,
    setFirstNodeRange,
    setInsertWbrHTML,
} from "../util/selection";
import { Constants } from "../../constants";
import { isMobile } from "../../util/platform/functions";
import { isOnlyMeta, isMac, copyPlainText, encodeBase64, readClipboard } from "../util/compatibility";
import { countBlockWord } from "../../layout/status";
import { dropEvent } from "../util/editorCommonEvent";
import { hideElements } from "../ui/hideElements";
import { keydown } from "./keydown";
import { isBrowserDesktop } from "../../platform";
import { getAllModels } from "../../layout/getAll";
import { stickyRow } from "../render/av/row";
import { clearSelect } from "../util/clearSelect";
import { renderCustomWithCtx, escapeInline } from "./utils/rendercustomWithCtx";
import { bindInputEvents } from "./index.input";
import { bindScrollEvent } from "./index.scroll";
import { handleCopy } from "./index.copy";
import { handleCut } from "./index.cut";
import { handleShiftSelect, handleCtrlSelect } from "./index.mousedown.select";
import { handleAvColResize, handleAvDragFill, handleAvCellSelect } from "./index.mousedown.av";
import { handleMediaResize, handleTableColResize } from "./index.mousedown.resize";
import { setupDragSelect } from "./index.mousedown.dragSelect";
import { handleContextmenu } from "./index.contextmenu";
import { handleClick } from "./index.click";
import { getContenteditableElement } from "./getBlock";
import { removeZWJ, nbsp2space } from "../util/normalizeText";
import { clearTableCell, isIncludeCell, setTableAlign } from "../util/table";
import { fetchPost, fetchSyncPost } from "../../util/network/fetch";
import { getEnableHTML, removeEmbed } from "./removeEmbed";
import { getTopAloneElement, isEndOfBlock } from "./getBlock";
import { previewDocImage } from "../preview/image";
import { selectRow } from "../render/av/row";
import { showMessage } from "../../dialog/message";
import { updateTransaction } from "./transaction";
import { input } from "./input";
import { countSelectWord } from "../../layout/status";
import { paste, getTextStar, enableLuteMarkdownSyntax, restoreLuteMarkdownSyntax } from "../util/paste";
import { MenuItem } from "../../menus/Menu.Item";
import { genCellValueByElement, getCellText, getTypeByCellElement } from "../render/av/cell";

export class WYSIWYG {
    public lastHTMLs: { [key: string]: string } = {};
    public element: HTMLDivElement;
    public preventKeyup: boolean;

    private preventClick: boolean;

    constructor(protyle: IProtyle) {
        this.element = document.createElement("div");
        this.element.className = "protyle-wysiwyg";
        this.element.setAttribute("spellcheck", "false");
        if (isMobile()) {
            // iPhone，iPad 端输入 contenteditable 为 true 时会在块中间插入 span
            // Android 端空块输入法弹出会收起 https://ld246.com/article/1689713888289
            this.element.setAttribute("contenteditable", "false");
        } else {
            this.element.setAttribute("contenteditable", "true");
        }
        if (window.siyuan.config.editor.displayBookmarkIcon) {
            this.element.classList.add("protyle-wysiwyg--attr");
        }
        this.bindCommonEvent(protyle);
        this.bindEvent(protyle);
        if (protyle.options.action.includes(Constants.CB_GET_HISTORY)) {
            return;
        }
        keydown(protyle, this.element);
        dropEvent(protyle, this.element);
    }

    public renderCustom(ial: IObject) {
        renderCustomWithCtx({ ial, wysiwyg: this });
    }


    private setEmptyOutline(protyle: IProtyle, element: HTMLElement) {
        let nodeElement = element;
        if (!element.getAttribute("data-node-id")) {
            const tempElement = hasClosestBlock(element);
            if (!tempElement) {
                return;
            }
            nodeElement = tempElement;
        }
        if (!isMobile()) {
            if (protyle.model) {
                getAllModels().outline.forEach(item => {
                    if (item.blockId === protyle.block.rootID) {
                        item.setCurrent(nodeElement);
                    }
                });
            }
        } else if (protyle.disabled) {
            protyle.toolbar.range = getEditorRange(nodeElement);
        }
    }

    private bindCommonEvent(protyle: IProtyle) {
        this.element.addEventListener("copy", async (event: ClipboardEvent & { target: HTMLElement }) => {
            window.siyuan.ctrlIsPressed = false; // https://github.com/siyuan-note/siyuan/issues/6373
            // https://github.com/siyuan-note/siyuan/issues/4600
            if (event.target.tagName === "PROTYLE-HTML" || event.target.localName === "input") {
                event.stopPropagation();
                return;
            }
            event.stopPropagation();
            event.preventDefault();
            const range = getEditorRange(protyle.wysiwyg.element);
            const nodeElement = hasClosestBlock(range.startContainer);
            if (!nodeElement) {
                return;
            }
            const selectImgElement = nodeElement.querySelector(".img--select");
            const selectAVElement = nodeElement.querySelector(".av__row--select, .av__cell--select");
            const selectTableElement = nodeElement.querySelector(".table__select")?.clientWidth > 0;
            let selectElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
            if (selectElements.length === 0 && range.toString() === "" && !range.cloneContents().querySelector("img") &&
                !selectImgElement && !selectAVElement && !selectTableElement) {
                nodeElement.classList.add("protyle-wysiwyg--select");
                countBlockWord([nodeElement.getAttribute("data-node-id")]);
                selectElements = [nodeElement];
            }
            let html = "";
            let textPlain = "";
            let isInCodeBlock = false;
            let needClipboardWrite = false;
            if (selectElements.length > 0) {
                const isRefText = selectElements[0].getAttribute("data-reftext") === "true";
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
                    const item = selectElements[i] as HTMLElement;
                    // 复制列表项中的块会变为复制列表项，因此不能使用 getTopAloneElement https://github.com/siyuan-note/siyuan/issues/8925
                    if (isRefText) {
                        html += getTextStar(item) + "\n\n";
                    } else {
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
                }
                if (isRefText) {
                    html = html.slice(0, -2);
                    selectElements[0].removeAttribute("data-reftext");
                }
            } else if (selectAVElement) {
                const cellElements: Element[] = Array.from(nodeElement.querySelectorAll(".av__cell--active, .av__cell--select")) || [];
                if (cellElements.length === 0) {
                    nodeElement.querySelectorAll(".av__row--select:not(.av__row--header)").forEach(rowElement => {
                        rowElement.querySelectorAll(".av__cell").forEach(cellElement => {
                            cellElements.push(cellElement);
                        });
                    });
                }
                if (cellElements.length > 0) {
                    html = "[";
                    cellElements.forEach((item: HTMLElement, index) => {
                        const cellText = getCellText(item);
                        if (index === 0 || (
                            cellElements[index - 1] !== item.previousElementSibling &&
                            !(item.previousElementSibling?.classList.contains("av__colsticky") && !cellElements[index - 1].nextElementSibling &&
                                cellElements[index - 1].parentElement === item.previousElementSibling)
                        )) {
                            html += "[";
                        }
                        html += JSON.stringify(genCellValueByElement(getTypeByCellElement(item), item)) + ",";
                        if (index === cellElements.length - 1 || (
                            cellElements[index + 1] !== item.nextElementSibling &&
                            !(!item.nextElementSibling && item.parentElement.nextElementSibling === cellElements[index + 1])
                        )) {
                            html = html.substring(0, html.length - 1) + "],";
                            textPlain += cellText + "\n";
                        } else {
                            textPlain += cellText + "\t";
                        }
                    });
                    textPlain = textPlain.substring(0, textPlain.length - 1);
                    html = html.substring(0, html.length - 1) + "]";
                }
            } else if (selectTableElement) {
                const scrollLeft = nodeElement.firstElementChild.scrollLeft;
                const scrollTop = nodeElement.querySelector("table").scrollTop;
                const tableSelectElement = nodeElement.querySelector(".table__select") as HTMLElement;
                html = "<table>";
                nodeElement.querySelectorAll("tr").forEach(rowElement => {
                    const rowCells: HTMLTableCellElement[] = [];
                    rowElement.querySelectorAll("th, td").forEach((item: HTMLTableCellElement) => {
                        if (!item.classList.contains("fn__none") && isIncludeCell({
                            tableSelectElement,
                            scrollLeft,
                            scrollTop,
                            item,
                        })) {
                            rowCells.push(item);
                        }
                    });
                    if (rowCells.length > 0) {
                        html += "<tr>";
                        rowCells.forEach(cell => {
                            html += cell.outerHTML;
                        });
                        html += "</tr>";
                    }
                });
                html += "</table>";
                textPlain = protyle.lute.HTML2Md(html);
            } else {
                const tempElement = document.createElement("div");
                // https://github.com/siyuan-note/siyuan/issues/5540
                const selectTypes = protyle.toolbar.getCurrentType(range);
                const spanElement = hasClosestByTag(range.startContainer, "SPAN");
                const headingElement = hasClosestByAttribute(range.startContainer, "data-type", "NodeHeading");
                const matchHeading = headingElement && headingElement.textContent.replace(Constants.ZWSP, "") === range.toString();
                if ((selectTypes.length > 0 && spanElement && spanElement.textContent.replace(Constants.ZWSP, "") === range.toString()) ||
                    matchHeading) {
                    if (matchHeading) {
                        // 复制标题 https://github.com/siyuan-note/insider/issues/297
                        tempElement.append(headingElement.cloneNode(true));
                        // https://github.com/siyuan-note/siyuan/issues/13232
                        headingElement.removeAttribute("fold");
                    } else if (!["DIV", "TD", "TH", "TR"].includes(range.startContainer.parentElement.tagName)) {
                        // 复制行内元素 https://github.com/siyuan-note/insider/issues/191
                        tempElement.append(range.startContainer.parentElement.cloneNode(true));
                        this.emojiToMd(tempElement);
                    } else {
                        // 直接复制块 https://github.com/siyuan-note/insider/issues/318
                        tempElement.append(range.cloneContents());
                        this.emojiToMd(tempElement);
                    }
                    html = tempElement.innerHTML;
                    textPlain = range.toString();
                } else if (selectImgElement) {
                    html = selectImgElement.outerHTML;
                    textPlain = selectImgElement.querySelector("img").getAttribute("data-src");
                } else if (selectTypes.length > 0 && range.startContainer.nodeType === 3 &&
                    range.startContainer.parentElement.tagName === "SPAN" &&
                    range.startContainer.parentElement === range.endContainer.parentElement) {
                    // 复制粗体等字体中的一部分
                    const attributes = range.startContainer.parentElement.attributes;
                    const spanElement = document.createElement("span");
                    for (let i = 0; i < attributes.length; i++) {
                        spanElement.setAttribute(attributes[i].name, attributes[i].value);
                    }
                    if (spanElement.getAttribute("data-type").indexOf("block-ref") > -1 &&
                        spanElement.getAttribute("data-subtype") === "d") {
                        // 需变为静态锚文本
                        spanElement.setAttribute("data-subtype", "s");
                    }
                    spanElement.textContent = range.toString();
                    html = spanElement.outerHTML;
                    textPlain = range.toString();
                } else {
                    tempElement.append(range.cloneContents());
                    this.emojiToMd(tempElement);
                    const inlineMathElement = hasClosestByAttribute(range.commonAncestorContainer, "data-type", "inline-math");
                    if (inlineMathElement) {
                        // 表格内复制数学公式 https://ld246.com/article/1631708573504
                        html = inlineMathElement.outerHTML;
                    } else {
                        html = tempElement.innerHTML;
                    }
                    // 不能使用 commonAncestorContainer https://ld246.com/article/1643282894693
                    textPlain = tempElement.textContent;
                    if (hasClosestByAttribute(range.startContainer, "data-type", "NodeCodeBlock")) {
                        if (isEndOfBlock(range)) {
                            textPlain = textPlain.replace(/\n$/, "");
                        }
                        isInCodeBlock = true;
                    } else if (hasClosestByTag(range.startContainer, "TD") || hasClosestByTag(range.startContainer, "TH")) {
                        tempElement.innerHTML = tempElement.innerHTML.replace(/<br>/g, "\n").replace(/<br\/>/g, "\n");
                        textPlain = tempElement.textContent.endsWith("\n") ? tempElement.textContent.replace(/\n$/, "") : tempElement.textContent;
                    } else if (tempElement.querySelector('.img, [data-type="inline-math"]')) {
                        textPlain = "";
                        tempElement.childNodes.forEach((item: Element) => {
                            if (item.nodeType === 3) {
                                textPlain += item.textContent;
                            } else if (item.nodeType === 1 &&
                                (item.classList.contains("img") || item.getAttribute("data-type").includes("inline-math"))) {
                                textPlain += protyle.lute.BlockDOM2StdMd(item.outerHTML).trimEnd();
                            } else {
                                textPlain += item.textContent;
                            }
                        });
                    } else if (!hasClosestByTag(range.startContainer, "CODE")) {
                        textPlain = range.toString();
                    }
                }
            }
            if (protyle.disabled) {
                html = getEnableHTML(html);
            }
            textPlain = textPlain || protyle.lute.BlockDOM2StdMd(html).trimEnd();
            textPlain = removeZWJ(nbsp2space(textPlain)) // Replace non-breaking spaces with normal spaces when copying https://github.com/siyuan-note/siyuan/issues/9382
                // Remove ZWSP when copying inline elements https://github.com/siyuan-note/siyuan/issues/13882
                .replace(new RegExp(Constants.ZWSP, "g"), "");
            event.clipboardData.setData("text/plain", textPlain);

            if (!isInCodeBlock) {
                enableLuteMarkdownSyntax(protyle);
                const textSiyuan = selectTableElement ? protyle.lute.HTML2BlockDOM(html) : html;
                event.clipboardData.setData("text/siyuan", textSiyuan);
                restoreLuteMarkdownSyntax(protyle);
                // 在 text/html 中插入注释节点，用于右键菜单粘贴时获取 text/siyuan 数据
                const textHTML = `<!--data-siyuan='${encodeBase64(textSiyuan)}'-->` + removeZWJ(selectTableElement ? html : protyle.lute.BlockDOM2HTML(selectAVElement ? textPlain : html));
                event.clipboardData.setData("text/html", textHTML);
                if (needClipboardWrite) {
                    try {
                        await navigator.clipboard.write([new ClipboardItem({
                            ["text/plain"]: textPlain,
                            ["text/html"]: textHTML,
                        })]);
                    } catch (e) {
                        console.log("Copy write clipboard error:", e);
                    }
                }
            }
        });

        this.element.addEventListener("mousedown", (event: MouseEvent) => {
            protyle.wysiwyg.element.classList.remove("protyle-wysiwyg--hiderange");
            if (event.button === 2) {
                // 右键
                return;
            }
            const documentSelf = document;
            documentSelf.onmouseup = null;
            let target = event.target as HTMLElement;
            let nodeElement = hasClosestBlock(target) as HTMLElement;
            const hasSelectClassElement = this.element.querySelector(".protyle-wysiwyg--select");
            const galleryItemElement = hasClosestByClassName(target, "av__gallery-item");
            // shift+click 多选
            if (handleShiftSelect(protyle, event, nodeElement, hasSelectClassElement, galleryItemElement)) {
                return;
            }
            // ctrl+click 多选
            if (handleCtrlSelect(protyle, event, target, nodeElement, hasSelectClassElement, galleryItemElement, this.element)) {
                return;
            }
            if (event.shiftKey) {
                let startElement;
                let endElement = nodeElement;
                // Electron 更新后 shift 向上点击获取的 range 不为上一个位置的 https://github.com/siyuan-note/siyuan/issues/9334
                if (getSelection().rangeCount > 0) {
                    startElement = hasClosestBlock(getSelection().getRangeAt(0).startContainer) as HTMLElement;
                }
                // shift 多选
                if (!hasSelectClassElement && galleryItemElement) {
                    galleryItemElement.classList.add("av__gallery-item--select");
                    let sideElement = galleryItemElement.previousElementSibling;
                    let previousList: Element[] = [];
                    while (sideElement) {
                        if (sideElement.classList.contains("av__gallery-item--select")) {
                            break;
                        } else {
                            previousList.push(sideElement);
                        }
                        sideElement = sideElement.previousElementSibling;
                        if (!sideElement) {
                            previousList = [];
                            break;
                        }
                    }
                    sideElement = galleryItemElement.nextElementSibling;
                    let nextList: Element[] = [];
                    while (sideElement) {
                        if (sideElement.classList.contains("av__gallery-item--select")) {
                            break;
                        } else {
                            nextList.push(sideElement);
                        }
                        sideElement = sideElement.nextElementSibling as HTMLElement;
                        if (!sideElement || sideElement.classList.contains("av__gallery-add")) {
                            nextList = [];
                            break;
                        }
                    }
                    previousList.concat(nextList).forEach(item => {
                        item.classList.add("av__gallery-item--select");
                    });
                    event.preventDefault();
                } else if (startElement && endElement && startElement !== endElement) {
                    let toDown = true;
                    const startRect = startElement.getBoundingClientRect();
                    const endRect = endElement.getBoundingClientRect();
                    let startTop = startRect.top;
                    let endTop = endRect.top;
                    if (startTop === endTop) {
                        // 横排 https://ld246.com/article/1663036247544
                        startTop = startRect.left;
                        endTop = endRect.left;
                    }
                    if (startTop > endTop) {
                        const tempElement = endElement;
                        endElement = startElement;
                        startElement = tempElement;
                        const tempTop = endTop;
                        endTop = startTop;
                        startTop = tempTop;
                        toDown = false;
                    }
                    let selectElements: Element[] = [];
                    let currentElement: HTMLElement = startElement;
                    let hasJump = false;
                    while (currentElement) {
                        if (currentElement && !currentElement.classList.contains("protyle-attr")) {
                            const currentRect = currentElement.getBoundingClientRect();
                            if (startRect.top === endRect.top ? (currentRect.left <= endTop) : (currentRect.top <= endTop)) {
                                if (hasJump) {
                                    // 父节点的下个节点在选中范围内才可使用父节点作为选中节点
                                    if (currentElement.nextElementSibling && !currentElement.nextElementSibling.classList.contains("protyle-attr")) {
                                        const currentNextRect = currentElement.nextElementSibling.getBoundingClientRect();
                                        if (startRect.top === endRect.top ?
                                            (currentNextRect.left <= endTop && currentNextRect.bottom <= endRect.bottom) :
                                            (currentNextRect.top <= endTop)) {
                                            selectElements = [currentElement];
                                            currentElement = currentElement.nextElementSibling as HTMLElement;
                                            hasJump = false;
                                        } else if (currentElement.parentElement.classList.contains("sb")) {
                                            currentElement = hasClosestBlock(currentElement.parentElement) as HTMLElement;
                                            hasJump = true;
                                        } else {
                                            break;
                                        }
                                    } else {
                                        currentElement = hasClosestBlock(currentElement.parentElement) as HTMLElement;
                                        hasJump = true;
                                    }
                                } else {
                                    selectElements.push(currentElement);
                                    currentElement = currentElement.nextElementSibling as HTMLElement;
                                }
                            } else if (currentElement.parentElement.classList.contains("sb")) {
                                // 跳出超级块横向排版中的未选中元素
                                currentElement = hasClosestBlock(currentElement.parentElement) as HTMLElement;
                                hasJump = true;
                            } else {
                                break;
                            }
                        } else {
                            currentElement = hasClosestBlock(currentElement.parentElement) as HTMLElement;
                            hasJump = true;
                        }
                    }
                    if (selectElements.length === 1 && !selectElements[0].classList.contains("list") &&
                        !selectElements[0].classList.contains("bq") && !selectElements[0].classList.contains("callout") &&
                        !selectElements[0].classList.contains("sb")) {
                        // 单个 p 不选中
                    } else {
                        const ids: string[] = [];
                        if (!hasSelectClassElement && protyle.scroll && !protyle.scroll.element.classList.contains("fn__none") && !protyle.scroll.keepLazyLoad &&
                            (startElement.getBoundingClientRect().top < -protyle.contentElement.clientHeight * 2 || endElement.getBoundingClientRect().bottom > protyle.contentElement.clientHeight * 2)) {
                            showMessage(window.siyuan.languages.crossKeepLazyLoad);
                        }
                        selectElements.forEach(item => {
                            if (!hasClosestByClassName(item, "protyle-wysiwyg--select")) {
                                item.classList.add("protyle-wysiwyg--select");
                                ids.push(item.getAttribute("data-node-id"));
                                // 清除选中的子块 https://ld246.com/article/1667826582251
                                item.querySelectorAll(".protyle-wysiwyg--select").forEach(subItem => {
                                    subItem.classList.remove("protyle-wysiwyg--select");
                                });
                            }
                        });
                        countBlockWord(ids);
                        if (toDown) {
                            focusBlock(selectElements[selectElements.length - 1], protyle.wysiwyg.element, false);
                        } else {
                            focusBlock(selectElements[0], protyle.wysiwyg.element, false);
                        }
                    }
                    event.preventDefault();
                }
                return;
            }
            if (isOnlyMeta(event) && !event.shiftKey && !event.altKey) {
                let ctrlElement = nodeElement;
                const rowElement = hasClosestByClassName(target, "av__row");
                if (!hasSelectClassElement && (galleryItemElement || (rowElement && !rowElement.classList.contains("av__row--header")))) {
                    if (galleryItemElement) {
                        galleryItemElement.classList.toggle("av__gallery-item--select");
                    } else if (rowElement) {
                        selectRow(rowElement.querySelector(".av__firstcol"), "toggle");
                    }
                } else if (ctrlElement) {
                    clearSelect(["row", "galleryItem"], this.element);
                    const embedBlockElement = isInEmbedBlock(ctrlElement);
                    if (embedBlockElement) {
                        ctrlElement = embedBlockElement;
                    }
                    ctrlElement = getTopAloneElement(ctrlElement) as HTMLElement;
                    if (ctrlElement.classList.contains("protyle-wysiwyg--select")) {
                        ctrlElement.classList.remove("protyle-wysiwyg--select");
                        ctrlElement.removeAttribute("select-start");
                        ctrlElement.removeAttribute("select-end");
                    } else {
                        ctrlElement.classList.add("protyle-wysiwyg--select");
                    }
                    ctrlElement.querySelectorAll(".protyle-wysiwyg--select").forEach(item => {
                        item.classList.remove("protyle-wysiwyg--select");
                        item.removeAttribute("select-start");
                        item.removeAttribute("select-end");
                    });
                    const ctrlParentElement = hasClosestByClassName(ctrlElement.parentElement, "protyle-wysiwyg--select");
                    if (ctrlParentElement) {
                        ctrlParentElement.classList.remove("protyle-wysiwyg--select");
                        ctrlParentElement.removeAttribute("select-start");
                        ctrlParentElement.removeAttribute("select-end");
                    }
                    const ids: string[] = [];
                    protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select").forEach(item => {
                        ids.push(item.getAttribute("data-node-id"));
                    });
                    countBlockWord(ids);
                }
                return;
            }

            // https://github.com/siyuan-note/siyuan/issues/15100
            if (galleryItemElement && !hasClosestByAttribute(target, "data-type", "av-gallery-more")) {
                documentSelf.onmouseup = () => {
                    documentSelf.onmousemove = null;
                    documentSelf.onmouseup = null;
                    documentSelf.ondragstart = null;
                    documentSelf.onselectstart = null;
                    documentSelf.onselect = null;
                    clearSelect(["galleryItem"], protyle.wysiwyg.element);
                    return false;
                };
                return;
            }
            const avDragFillElement = hasClosestByClassName(target, "av__drag-fill");
            // https://github.com/siyuan-note/siyuan/issues/3026
            hideElements(["select"], protyle);
            if (hasClosestByAttribute(target, "data-type", "av-gallery-more")) {
                clearSelect(["img", "row", "cell"], protyle.wysiwyg.element);
            } else if (!hasClosestByClassName(target, "av__firstcol") && !avDragFillElement) {
                clearSelect(["img", "av"], protyle.wysiwyg.element);
            }

            if ((hasClosestByClassName(target, "protyle-action") && !hasClosestByClassName(target, "code-block")) ||
                (hasClosestByClassName(target, "av__cell--header") && !hasClosestByClassName(target, "av__widthdrag"))) {
                return;
            }
            const wysiwygRect = protyle.wysiwyg.element.getBoundingClientRect();
            const wysiwygStyle = window.getComputedStyle(protyle.wysiwyg.element);
            const mostLeft = wysiwygRect.left + (parseInt(wysiwygStyle.paddingLeft) || 24) + 1;
            const mostRight = wysiwygRect.right - (parseInt(wysiwygStyle.paddingRight) || 16) - 2;

            const protyleRect = protyle.element.getBoundingClientRect();
            const mostBottom = protyleRect.bottom;
            const y = event.clientY;
            const contentRect = protyle.contentElement.getBoundingClientRect();
            // av col resize
            if (handleAvColResize(protyle, event, target, nodeElement as HTMLElement, contentRect, documentSelf, () => {
 this.preventClick = true; 
})) {
                return;
            }
            // av drag fill
            if (handleAvDragFill(protyle, event, avDragFillElement, nodeElement as HTMLElement, documentSelf, () => {
 this.preventClick = true; 
})) {
                return false;
            }
            // av cell select
            if (handleAvCellSelect(protyle, event, target, nodeElement as HTMLElement, contentRect, documentSelf, () => {
 this.preventClick = true; 
})) {
                return false;
            }
            // 图片、iframe、video、挂件缩放
            if (handleMediaResize(protyle, event, target, nodeElement as HTMLElement, mostRight, mostBottom, y, documentSelf)) {
                return;
            }
            // table cell select
            let tableBlockElement: HTMLElement | false;
            const targetCellElement = hasClosestByTag(target, "TH") || hasClosestByTag(target, "TD");
            if (targetCellElement) {
                target = targetCellElement;
            }
            if (target.tagName === "TH" || target.tagName === "TD" || target.firstElementChild?.tagName === "TABLE" ||
                target.classList.contains("table__resize") || target.classList.contains("table__select")) {
                tableBlockElement = nodeElement;
                if (tableBlockElement) {
                    tableBlockElement.querySelector(".table__select").removeAttribute("style");
                    window.siyuan.menus.menu.remove();
                    hideElements(["toolbar"], protyle);
                    if (target.classList.contains("table__select")) {
                        target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement;
                        nodeElement = hasClosestBlock(target) as HTMLElement;
                    }
                    event.stopPropagation();
                }
                // 后续拖拽操作写在多选节点中
            }
            // table col resize
            if (handleTableColResize(protyle, event, target, nodeElement as HTMLElement, documentSelf)) {
                return;
            }

            // 多选节点
            let clentX = event.clientX;
            if (event.clientX > mostRight) {
                clentX = mostRight;
            } else if (event.clientX < mostLeft) {
                clentX = mostLeft;
            }
            const mostTop = protyleRect.top + (protyle.options.render.breadcrumb ? protyle.breadcrumb.element.parentElement.clientHeight : 0);

            setupDragSelect({
                protyle, event, target, nodeElement, tableBlockElement,
                documentSelf, clentX, mostTop, mostRight, mostLeft, mostBottom, y,
                contentRect, wysiwygElement: this.element,
            });
            let mouseElement: Element;
            let moveCellElement: HTMLElement;
            let startFirstElement: Element;
            let endLastElement: Element;
            const needScroll = ["IMG", "VIDEO", "AUDIO"].includes(target.tagName) || target.classList.contains("img");
            documentSelf.onmousemove = (moveEvent: MouseEvent) => {
                let moveTarget: boolean | HTMLElement = moveEvent.target as HTMLElement;
                // table cell select
                if (tableBlockElement &&
                    !hasClosestByClassName(tableBlockElement, "protyle-wysiwyg__embed")) {
                    if (tableBlockElement.contains(moveTarget)) {
                        if (moveTarget.classList.contains("table__select")) {
                            moveTarget.classList.add("fn__none");
                            const pointElement = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
                            moveTarget.classList.remove("fn__none");
                            moveTarget = hasClosestByTag(pointElement, "TH") || hasClosestByTag(pointElement, "TD");
                        }
                        if (moveTarget && moveTarget === target) {
                            tableBlockElement.querySelector(".table__select").removeAttribute("style");
                            protyle.wysiwyg.element.classList.remove("protyle-wysiwyg--hiderange");
                            moveCellElement = moveTarget;
                            return false;
                        }
                        if (moveTarget && (moveTarget.tagName === "TH" || moveTarget.tagName === "TD") &&
                            (!moveCellElement || moveCellElement !== moveTarget)) {
                            // @ts-ignore
                            tableBlockElement.firstElementChild.style.webkitUserModify = "read-only";
                            let width = target.offsetLeft + target.clientWidth - moveTarget.offsetLeft;
                            let left = moveTarget.offsetLeft;
                            if (target.offsetLeft === moveTarget.offsetLeft) {
                                width = Math.max(target.clientWidth, moveTarget.clientWidth);
                            } else if (target.offsetLeft < moveTarget.offsetLeft) {
                                width = moveTarget.offsetLeft + moveTarget.clientWidth - target.offsetLeft;
                                left = target.offsetLeft;
                            }
                            let height = target.offsetTop + target.clientHeight - moveTarget.offsetTop;
                            let top = moveTarget.offsetTop;
                            if (target.offsetTop === moveTarget.offsetTop) {
                                height = Math.max(target.clientHeight, moveTarget.clientHeight);
                            } else if (target.offsetTop < moveTarget.offsetTop) {
                                height = moveTarget.offsetTop + moveTarget.clientHeight - target.offsetTop;
                                top = target.offsetTop;
                            }
                            // https://github.com/siyuan-note/insider/issues/1015
                            Array.from(tableBlockElement.querySelectorAll("th, td")).find((item: HTMLElement) => {
                                const updateWidth = item.offsetLeft < left + width && item.offsetLeft + item.clientWidth > left + width;
                                const updateWidth2 = item.offsetLeft < left && item.offsetLeft + item.clientWidth > left;
                                if (item.offsetTop < top && item.offsetTop + item.clientHeight > top) {
                                    if ((item.offsetLeft + 6 > left && item.offsetLeft + item.clientWidth - 6 < left + width) || updateWidth || updateWidth2) {
                                        height = top + height - item.offsetTop;
                                        top = item.offsetTop;
                                    }
                                    if (updateWidth) {
                                        width = item.offsetLeft + item.clientWidth - left;
                                    }
                                    if (updateWidth2) {
                                        width = left + width - item.offsetLeft;
                                        left = item.offsetLeft;
                                    }
                                } else if (item.offsetTop < top + height && item.offsetTop + item.clientHeight > top + height) {
                                    if ((item.offsetLeft + 6 > left && item.offsetLeft + item.clientWidth - 6 < left + width) || updateWidth || updateWidth2) {
                                        height = item.clientHeight + item.offsetTop - top;
                                    }
                                    if (updateWidth) {
                                        width = item.offsetLeft + item.clientWidth - left;
                                    }
                                    if (updateWidth2) {
                                        width = left + width - item.offsetLeft;
                                        left = item.offsetLeft;
                                    }
                                } else if (updateWidth2 && item.offsetTop + 6 > top && item.offsetTop + item.clientHeight - 6 < top + height) {
                                    width = left + width - item.offsetLeft;
                                    left = item.offsetLeft;
                                } else if (updateWidth && item.offsetTop + 6 > top && item.offsetTop + item.clientHeight - 6 < top + height) {
                                    width = item.offsetLeft + item.clientWidth - left;
                                }
                            });
                            protyle.wysiwyg.element.classList.add("protyle-wysiwyg--hiderange");
                            tableBlockElement.querySelector(".table__select").setAttribute("style", `left:${left - tableBlockElement.firstElementChild.scrollLeft}px;top:${top - tableBlockElement.querySelector("table").scrollTop}px;height:${height}px;width:${width + 1}px;`);
                            moveCellElement = moveTarget;
                        }
                        return;
                    } else {
                        tableBlockElement.querySelector(".table__select").removeAttribute("style");
                        moveCellElement = undefined;
                    }
                }
                // 在包含 img， video， audio 的元素上划选后无法上下滚动 https://ld246.com/article/1681778773806
                // 在包含 img， video， audio 的元素上拖拽无法划选 https://github.com/siyuan-note/siyuan/issues/11763
                if (needScroll) {
                    if (moveEvent.clientY < contentRect.top + Constants.SIZE_SCROLL_TB || moveEvent.clientY > contentRect.bottom - Constants.SIZE_SCROLL_TB) {
                        protyle.contentElement.scroll({
                            top: protyle.contentElement.scrollTop + (moveEvent.clientY < contentRect.top + Constants.SIZE_SCROLL_TB ? -Constants.SIZE_SCROLL_STEP : Constants.SIZE_SCROLL_STEP),
                            behavior: "smooth"
                        });
                    }
                }
                protyle.selectElement.classList.remove("fn__none");
                // 向左选择，遇到 gutter 就不会弹出 toolbar
                hideElements(["gutter"], protyle);
                let newTop = 0;
                let newLeft = 0;
                let newWidth = 0;
                let newHeight = 0;
                if (moveEvent.clientX < clentX) {
                    if (moveEvent.clientX < mostLeft) {
                        // 向左越界
                        newLeft = mostLeft;
                    } else {
                        // 向左
                        newLeft = moveEvent.clientX;
                    }
                    newWidth = clentX - newLeft;
                } else {
                    if (moveEvent.clientX > mostRight) {
                        // 向右越界
                        newLeft = clentX;
                        newWidth = mostRight - newLeft;
                    } else {
                        // 向右
                        newLeft = clentX;
                        newWidth = moveEvent.clientX - clentX;
                    }
                }

                if (moveEvent.clientY > y) {
                    if (moveEvent.clientY > mostBottom) {
                        // 向下越界
                        newTop = y;
                        newHeight = mostBottom - y;
                    } else {
                        // 向下
                        newTop = y;
                        newHeight = moveEvent.clientY - y;
                    }
                } else {
                    if (moveEvent.clientY < mostTop) {
                        // 向上越界
                        newTop = mostTop;
                    } else {
                        // 向上
                        newTop = moveEvent.clientY;
                    }
                    newHeight = y - newTop;
                }
                if (newHeight < 4) {
                    return;
                }
                protyle.selectElement.setAttribute("style", `background-color: ${protyle.selectElement.style.backgroundColor};top:${newTop}px;height:${newHeight}px;left:${newLeft + 2}px;width:${newWidth - 2}px;`);
                const newMouseElement = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
                if (mouseElement && mouseElement === newMouseElement && !mouseElement.classList.contains("protyle-wysiwyg") &&
                    !mouseElement.classList.contains("list") && !mouseElement.classList.contains("bq") &&
                    !mouseElement.classList.contains("sb") && !mouseElement.classList.contains("callout")) {
                    // 性能优化，同一个p元素不进行选中计算
                    return;
                } else {
                    mouseElement = newMouseElement;
                }
                hideElements(["select"], protyle);
                let firstElement;
                if (moveEvent.clientY > y) {
                    firstElement = startFirstElement || document.elementFromPoint(newLeft, newTop);
                    endLastElement = undefined;
                } else {
                    firstElement = document.elementFromPoint(newLeft, newTop);
                    startFirstElement = undefined;
                }
                if (!firstElement) {
                    return;
                }
                if (firstElement.classList.contains("protyle-wysiwyg") || firstElement.classList.contains("list") ||
                    firstElement.classList.contains("li") || firstElement.classList.contains("sb") ||
                    firstElement.classList.contains("callout") || firstElement.classList.contains("bq")) {
                    firstElement = document.elementFromPoint(newLeft, newTop + 16);
                }
                if (!firstElement) {
                    return;
                }
                let firstBlockElement = hasClosestBlock(firstElement);
                if (!firstBlockElement && firstElement.classList.contains("protyle-breadcrumb__bar")) {
                    firstBlockElement = firstElement.nextElementSibling as HTMLElement;
                }
                if (moveEvent.clientY > y) {
                    if (!startFirstElement) {
                        // 向上选择导致滚动条滚动到顶部再向下选择至 > y 时，firstBlockElement 为 undefined https://ld246.com/article/1705233964097
                        if (!firstBlockElement) {
                            firstBlockElement = protyle.wysiwyg.element.firstElementChild as HTMLElement;
                            if (firstBlockElement.classList.contains("protyle-breadcrumb__bar")) {
                                firstBlockElement = firstBlockElement.nextElementSibling as HTMLElement;
                            }
                        }
                        startFirstElement = firstBlockElement;
                    }
                } else if (!firstBlockElement &&
                    // https://github.com/siyuan-note/siyuan/issues/7580
                    moveEvent.clientY < protyle.wysiwyg.element.lastElementChild.getBoundingClientRect().bottom) {
                    firstBlockElement = protyle.wysiwyg.element.firstElementChild as HTMLElement;
                    if (firstBlockElement.classList.contains("protyle-breadcrumb__bar")) {
                        firstBlockElement = firstBlockElement.nextElementSibling as HTMLElement;
                    }
                }
                let selectElements: Element[] = [];
                let currentElement: Element | boolean = firstBlockElement;

                if (currentElement) {
                    // 从下往上划选遇到嵌入块时，选中整个嵌入块
                    const embedElement = isInEmbedBlock(currentElement);
                    if (embedElement) {
                        currentElement = embedElement;
                    }
                }

                let hasJump = false;
                const selectBottom = endLastElement ? endLastElement.getBoundingClientRect().bottom : (newTop + newHeight);
                while (currentElement) {
                    if (currentElement && !currentElement.classList.contains("protyle-attr")) {
                        const currentRect = currentElement.getBoundingClientRect();
                        if (currentRect.height > 0 && currentRect.top < selectBottom && currentRect.left < newLeft + newWidth) {
                            if (hasJump) {
                                // 父节点的下个节点在选中范围内才可使用父节点作为选中节点
                                if (currentElement.nextElementSibling && !currentElement.nextElementSibling.classList.contains("protyle-attr")) {
                                    const nextRect = currentElement.nextElementSibling.getBoundingClientRect();
                                    if (nextRect.top < selectBottom && nextRect.left < newLeft + newWidth) {
                                        selectElements = [currentElement];
                                        currentElement = currentElement.nextElementSibling;
                                        hasJump = false;
                                    } else if (currentElement.parentElement.classList.contains("sb")) {
                                        currentElement = hasClosestBlock(currentElement.parentElement);
                                        hasJump = true;
                                    } else {
                                        break;
                                    }
                                } else {
                                    currentElement = hasClosestBlock(currentElement.parentElement);
                                    hasJump = true;
                                }
                            } else {
                                if (!currentElement.classList.contains("protyle-breadcrumb__bar") &&
                                    !currentElement.classList.contains("protyle-breadcrumb__item")) {
                                    selectElements.push(currentElement);
                                }
                                if (!currentElement.nextElementSibling && currentElement.parentElement.classList.contains("callout-content")) {
                                    currentElement = currentElement.parentElement.nextElementSibling;
                                } else {
                                    currentElement = currentElement.nextElementSibling;
                                }
                            }
                        } else if (currentElement.parentElement.classList.contains("sb")) {
                            // 跳出超级块横向排版中的未选中元素
                            currentElement = hasClosestBlock(currentElement.parentElement);
                            hasJump = true;
                        } else if (currentRect.height === 0 && currentRect.width === 0 && currentElement.parentElement.getAttribute("fold") === "1") {
                            currentElement = currentElement.parentElement;
                            selectElements = [];
                        } else {
                            break;
                        }
                    } else {
                        currentElement = hasClosestBlock(currentElement.parentElement);
                        hasJump = true;
                    }
                }
                if (moveEvent.clientY <= y && !endLastElement) {
                    endLastElement = selectElements[selectElements.length - 1];
                }
                if (selectElements.length === 1 && !selectElements[0].classList.contains("list") &&
                    !selectElements[0].classList.contains("bq") && !selectElements[0].classList.contains("callout") &&
                    !selectElements[0].classList.contains("sb")) {
                    // 只有一个 p 时不选中
                    protyle.selectElement.style.backgroundColor = "transparent";
                    protyle.wysiwyg.element.classList.remove("protyle-wysiwyg--hiderange");
                } else {
                    protyle.wysiwyg.element.classList.add("protyle-wysiwyg--hiderange");
                    selectElements.forEach(item => {
                        if (!hasClosestByClassName(item, "protyle-wysiwyg__embed")) {
                            item.classList.add("protyle-wysiwyg--select");
                        }
                    });
                    protyle.selectElement.style.backgroundColor = "";
                }
            };

            documentSelf.onmouseup = (mouseUpEvent) => {
                documentSelf.onmousemove = null;
                documentSelf.onmouseup = null;
                documentSelf.ondragstart = null;
                documentSelf.onselectstart = null;
                documentSelf.onselect = null;
                startFirstElement = undefined;
                endLastElement = undefined;
                // 多选表格单元格后，选择菜单中的居左，然后 shift+左 选中的文字无法显示选中背景，因此需移除
                // 多选块后 shift+左 选中的文字无法显示选中背景，因此需移除
                protyle.wysiwyg.element.classList.remove("protyle-wysiwyg--hiderange");
                this.element.querySelectorAll("iframe").forEach(item => {
                    item.style.pointerEvents = "";
                });
                protyle.selectElement.classList.add("fn__none");
                protyle.selectElement.removeAttribute("style");
                if (tableBlockElement) {
                    // @ts-ignore
                    tableBlockElement.firstElementChild.style.webkitUserModify = "";
                    const tableSelectElement = tableBlockElement.querySelector(".table__select") as HTMLElement;
                    if (tableSelectElement.getAttribute("style")) {
                        if (getSelection().rangeCount > 0) {
                            getSelection().getRangeAt(0).collapse(false);
                        }
                        window.siyuan.menus.menu.remove();
                        if (!protyle.disabled) {
                            window.siyuan.menus.menu.append(new MenuItem({
                                id: "mergeCell",
                                label: window.siyuan.languages.mergeCell,
                                click: () => {
                                    if (tableBlockElement) {
                                        const selectCellElements: HTMLTableCellElement[] = [];
                                        const colIndexList: number[] = [];
                                        const colCount = tableBlockElement.querySelectorAll("th").length;
                                        let fnNoneMax = 0;
                                        const scrollLeft = tableBlockElement.firstElementChild.scrollLeft;
                                        const scrollTop = tableBlockElement.querySelector("table").scrollTop;
                                        let isTHead = false;
                                        let isTBody = false;
                                        tableBlockElement.querySelectorAll("th, td").forEach((item: HTMLTableCellElement, index: number) => {
                                            if (item.classList.contains("fn__none")) {
                                                // 合并的元素中间有 fn__none 的元素
                                                if (item.previousElementSibling && item.previousElementSibling === selectCellElements[selectCellElements.length - 1]) {
                                                    selectCellElements.push(item);
                                                    if (!isTHead && item.parentElement.parentElement.tagName === "THEAD") {
                                                        isTHead = true;
                                                    } else if (!isTBody && item.parentElement.parentElement.tagName === "TBODY") {
                                                        isTBody = true;
                                                    }
                                                } else {
                                                    if (index < fnNoneMax && colIndexList.includes((index + 1) % colCount)) {
                                                        selectCellElements.push(item);
                                                        if (!isTHead && item.parentElement.parentElement.tagName === "THEAD") {
                                                            isTHead = true;
                                                        } else if (!isTBody && item.parentElement.parentElement.tagName === "TBODY") {
                                                            isTBody = true;
                                                        }
                                                    }
                                                }
                                            } else {
                                                if (isIncludeCell({
                                                    tableSelectElement,
                                                    scrollLeft,
                                                    scrollTop,
                                                    item,
                                                })) {
                                                    selectCellElements.push(item);
                                                    if (!isTHead && item.parentElement.parentElement.tagName === "THEAD") {
                                                        isTHead = true;
                                                    } else if (!isTBody && item.parentElement.parentElement.tagName === "TBODY") {
                                                        isTBody = true;
                                                    }
                                                    colIndexList.push((index + 1) % colCount);
                                                    // https://github.com/siyuan-note/insider/issues/1014
                                                    fnNoneMax = Math.max((item.rowSpan - 1) * colCount + index + 1, fnNoneMax);
                                                }
                                            }
                                        });
                                        tableSelectElement.removeAttribute("style");
                                        const oldHTML = tableBlockElement.outerHTML;
                                        let cellElement = selectCellElements[0];
                                        let colSpan = cellElement.colSpan;
                                        let index = 1;
                                        while (cellElement.nextElementSibling && cellElement.nextElementSibling === selectCellElements[index]) {
                                            cellElement = cellElement.nextElementSibling as HTMLTableCellElement;
                                            if (!cellElement.classList.contains("fn__none")) { // https://github.com/siyuan-note/insider/issues/1007#issuecomment-1046195608
                                                colSpan += cellElement.colSpan;
                                            }
                                            index++;
                                        }
                                        let html = "";
                                        let rowElement: Element = selectCellElements[0].parentElement;
                                        let rowSpan = selectCellElements[0].rowSpan;
                                        selectCellElements.forEach((item, index) => {
                                            let cellHTML = item.innerHTML.trim();
                                            if (cellHTML.endsWith("<br>")) {
                                                cellHTML = cellHTML.substr(0, cellHTML.length - 4);
                                            }
                                            html += cellHTML + ((!cellHTML || index === selectCellElements.length - 1) ? "" : "<br>");
                                            if (index !== 0) {
                                                if (rowElement !== item.parentElement) {
                                                    if (!item.classList.contains("fn__none")) { // https://github.com/siyuan-note/insider/issues/1011
                                                        rowSpan += item.rowSpan;
                                                    }
                                                    rowElement = item.parentElement;
                                                    if (selectCellElements[0].parentElement.parentElement.tagName === "THEAD" && item.parentElement.parentElement.tagName !== "THEAD") {
                                                        selectCellElements[0].parentElement.parentElement.insertAdjacentElement("beforeend", item.parentElement);
                                                    }
                                                }
                                                item.classList.add("fn__none");
                                                item.innerHTML = "";
                                            }
                                        });

                                        // https://github.com/siyuan-note/insider/issues/1017
                                        if (isTHead && isTBody) {
                                            rowElement = rowElement.parentElement.nextElementSibling.firstElementChild;
                                            while (rowElement && rowElement.parentElement.tagName !== "THEAD") {
                                                let colSpanCount = 0;
                                                let noneCount = 0;
                                                Array.from(rowElement.children).forEach((item: HTMLTableCellElement) => {
                                                    colSpanCount += item.colSpan - 1;
                                                    if (item.classList.contains("fn__none")) {
                                                        noneCount++;
                                                    }
                                                });
                                                if (colSpanCount !== noneCount) {
                                                    selectCellElements[0].parentElement.parentElement.insertAdjacentElement("beforeend", rowElement);
                                                    rowElement = rowElement.parentElement.nextElementSibling.firstElementChild;
                                                } else {
                                                    break;
                                                }
                                            }
                                        }

                                        // 合并背景色不会修改，需要等计算完毕
                                        setTimeout(() => {
                                            if (tableBlockElement) {
                                                selectCellElements[0].innerHTML = (html.replace(/<br>$/, "") || "<br>") + "<wbr>";
                                                selectCellElements[0].colSpan = colSpan;
                                                selectCellElements[0].rowSpan = rowSpan;
                                                focusByWbr(selectCellElements[0], document.createRange());
                                                document.execCommand("insertHTML", false, "");
                                                updateTransaction(protyle, tableBlockElement.getAttribute("data-node-id"), tableBlockElement.outerHTML, oldHTML);
                                            }
                                        });
                                    }
                                }
                            }).element);
                            window.siyuan.menus.menu.append(new MenuItem({
                                id: "separator_1",
                                type: "separator"
                            }).element);
                            window.siyuan.menus.menu.append(new MenuItem({
                                id: "alignLeft",
                                icon: "iconAlignLeft",
                                accelerator: window.siyuan.config.keymap.editor.general.alignLeft.custom,
                                label: window.siyuan.languages.alignLeft,
                                click: () => {
                                    if (tableBlockElement) {
                                        const selectCellElements: HTMLTableCellElement[] = [];
                                        const scrollLeft = tableBlockElement.firstElementChild.scrollLeft;
                                        const scrollTop = tableBlockElement.querySelector("table").scrollTop;
                                        tableBlockElement.querySelectorAll("th, td").forEach((item: HTMLTableCellElement) => {
                                            if (!item.classList.contains("fn__none") &&
                                                isIncludeCell({
                                                    tableSelectElement,
                                                    scrollLeft,
                                                    scrollTop,
                                                    item,
                                                }) && (selectCellElements.length === 0 || (selectCellElements.length > 0 && item.offsetTop === selectCellElements[0].offsetTop))) {
                                                selectCellElements.push(item);
                                            }
                                        });
                                        tableSelectElement.removeAttribute("style");
                                        setTableAlign(protyle, selectCellElements, tableBlockElement, "left", getEditorRange(tableBlockElement));
                                    }
                                }
                            }).element);
                            window.siyuan.menus.menu.append(new MenuItem({
                                id: "alignCenter",
                                icon: "iconAlignCenter",
                                accelerator: window.siyuan.config.keymap.editor.general.alignCenter.custom,
                                label: window.siyuan.languages.alignCenter,
                                click: () => {
                                    if (tableBlockElement) {
                                        const selectCellElements: HTMLTableCellElement[] = [];
                                        const scrollLeft = tableBlockElement.firstElementChild.scrollLeft;
                                        const scrollTop = tableBlockElement.querySelector("table").scrollTop;
                                        tableBlockElement.querySelectorAll("th, td").forEach((item: HTMLTableCellElement) => {
                                            if (!item.classList.contains("fn__none") && isIncludeCell({
                                                    tableSelectElement,
                                                    scrollLeft,
                                                    scrollTop,
                                                    item,
                                                }) &&
                                                (selectCellElements.length === 0 || (selectCellElements.length > 0 && item.offsetTop === selectCellElements[0].offsetTop))) {
                                                selectCellElements.push(item);
                                            }
                                        });
                                        tableSelectElement.removeAttribute("style");
                                        setTableAlign(protyle, selectCellElements, tableBlockElement, "center", getEditorRange(tableBlockElement));
                                    }
                                }
                            }).element);
                            window.siyuan.menus.menu.append(new MenuItem({
                                id: "alignRight",
                                icon: "iconAlignRight",
                                accelerator: window.siyuan.config.keymap.editor.general.alignRight.custom,
                                label: window.siyuan.languages.alignRight,
                                click: () => {
                                    if (tableBlockElement) {
                                        const selectCellElements: HTMLTableCellElement[] = [];
                                        const scrollLeft = tableBlockElement.firstElementChild.scrollLeft;
                                        const scrollTop = tableBlockElement.querySelector("table").scrollTop;
                                        tableBlockElement.querySelectorAll("th, td").forEach((item: HTMLTableCellElement) => {
                                            if (!item.classList.contains("fn__none") && isIncludeCell({
                                                tableSelectElement,
                                                scrollLeft,
                                                scrollTop,
                                                item,
                                            }) && (selectCellElements.length === 0 || (selectCellElements.length > 0 && item.offsetTop === selectCellElements[0].offsetTop))) {
                                                selectCellElements.push(item);
                                            }
                                        });
                                        tableSelectElement.removeAttribute("style");
                                        setTableAlign(protyle, selectCellElements, tableBlockElement, "right", getEditorRange(tableBlockElement));
                                    }
                                }
                            }).element);
                            window.siyuan.menus.menu.append(new MenuItem({
                                id: "useDefaultAlign",
                                icon: "",
                                label: window.siyuan.languages.useDefaultAlign,
                                click: () => {
                                    if (tableBlockElement) {
                                        const selectCellElements: HTMLTableCellElement[] = [];
                                        const scrollLeft = tableBlockElement.firstElementChild.scrollLeft;
                                        const scrollTop = tableBlockElement.querySelector("table").scrollTop;
                                        tableBlockElement.querySelectorAll("th, td").forEach((item: HTMLTableCellElement) => {
                                            if (!item.classList.contains("fn__none") && isIncludeCell({
                                                    tableSelectElement,
                                                    scrollLeft,
                                                    scrollTop,
                                                    item,
                                                }) &&
                                                (selectCellElements.length === 0 || (selectCellElements.length > 0 && item.offsetTop === selectCellElements[0].offsetTop))) {
                                                selectCellElements.push(item);
                                            }
                                        });
                                        tableSelectElement.removeAttribute("style");
                                        setTableAlign(protyle, selectCellElements, tableBlockElement, "", getEditorRange(tableBlockElement));
                                    }
                                }
                            }).element);
                            window.siyuan.menus.menu.append(new MenuItem({
                                id: "separator_2",
                                type: "separator"
                            }).element);
                        }
                        window.siyuan.menus.menu.append(new MenuItem({
                            id: "copyPlainText",
                            label: window.siyuan.languages.copyPlainText,
                            click() {
                                if (tableBlockElement) {
                                    const selectCellElements: HTMLTableCellElement[] = [];
                                    const scrollLeft = tableBlockElement.firstElementChild.scrollLeft;
                                    const scrollTop = tableBlockElement.querySelector("table").scrollTop;
                                    const tableSelectElement = tableBlockElement.querySelector(".table__select") as HTMLElement;
                                    tableBlockElement.querySelectorAll("th, td").forEach((item: HTMLTableCellElement) => {
                                        if (!item.classList.contains("fn__none") && isIncludeCell({
                                            tableSelectElement,
                                            scrollLeft,
                                            scrollTop,
                                            item,
                                        })) {
                                            selectCellElements.push(item);
                                        }
                                    });
                                    let textPlain = "";
                                    selectCellElements.forEach((item, index) => {
                                        textPlain += item.textContent.trim() + "\t";
                                        if (!item.nextElementSibling || !selectCellElements[index + 1] ||
                                            item.nextElementSibling !== selectCellElements[index + 1]) {
                                            textPlain = textPlain.slice(0, -1) + "\n";
                                        }
                                    });
                                    copyPlainText(textPlain.slice(0, -1));
                                    focusBlock(tableBlockElement);
                                }
                            }
                        }).element);
                        window.siyuan.menus.menu.append(new MenuItem({
                            id: "copy",
                            icon: "iconCopy",
                            accelerator: "⌘C",
                            label: window.siyuan.languages.copy,
                            click() {
                                if (tableBlockElement) {
                                    focusByRange(getEditorRange(tableBlockElement));
                                    document.execCommand("copy");
                                }
                            }
                        }).element);
                        if (!protyle.disabled) {
                            window.siyuan.menus.menu.append(new MenuItem({
                                id: "cut",
                                icon: "iconCut",
                                accelerator: "⌘X",
                                label: window.siyuan.languages.cut,
                                click() {
                                    if (tableBlockElement) {
                                        focusByRange(getEditorRange(tableBlockElement));
                                        document.execCommand("cut");
                                    }
                                }
                            }).element);
                            window.siyuan.menus.menu.append(new MenuItem({
                                id: "clear",
                                label: window.siyuan.languages.clear,
                                icon: "iconTrashcan",
                                accelerator: "⌦",
                                click() {
                                    clearTableCell(protyle, tableBlockElement as HTMLElement);
                                }
                            }).element);
                            window.siyuan.menus.menu.append(new MenuItem({
                                id: "paste",
                                label: window.siyuan.languages.paste,
                                icon: "iconPaste",
                                accelerator: "⌘V",
                                async click() {
                                    if (document.queryCommandSupported("paste")) {
                                        document.execCommand("paste");
                                    } else if (tableBlockElement) {
                                        try {
                                            const text = await readClipboard();
                                            paste(protyle, Object.assign(text, {target: tableBlockElement as HTMLElement}));
                                        } catch (e) {
                                            console.log(e);
                                        }
                                    }
                                }
                            }).element);
                        }
                        window.siyuan.menus.menu.popup({x: mouseUpEvent.clientX - 8, y: mouseUpEvent.clientY - 16});
                    }
                }

                const ids: string[] = [];
                const selectElement = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
                selectElement.forEach(item => {
                    ids.push(item.getAttribute("data-node-id"));
                });
                countBlockWord(ids);
                // 划选后不能存在跨块的 range https://github.com/siyuan-note/siyuan/issues/4473
                if (getSelection().rangeCount > 0) {
                    const range = getSelection().getRangeAt(0);
                    if (range.toString() === "" ||
                        window.siyuan.shiftIsPressed  // https://ld246.com/article/1650096678723
                    ) {
                        if (event.detail > 2) {
                            // table 前或最后一个 cell 三击状态不对
                            let cursorElement = hasClosestBlock(range.startContainer) as Element;
                            if (cursorElement) {
                                if (cursorElement.nextElementSibling?.classList.contains("table")) {
                                    setLastNodeRange(getContenteditableElement(cursorElement), range, false);
                                } else if (cursorElement.classList.contains("table")) {
                                    const cellElements = cursorElement.querySelectorAll("th, td");
                                    cursorElement = cellElements[cellElements.length - 1];
                                    if (cursorElement.contains(range.startContainer)) {
                                        setLastNodeRange(cursorElement, range, false);
                                    }
                                }
                            }
                            return;
                        }
                    }
                    if (selectElement.length > 0) {
                        range.collapse(true);
                        // https://github.com/siyuan-note/siyuan/issues/17092 & https://github.com/siyuan-note/siyuan/issues/15296
                        const endElement = hasClosestBlock(mouseUpEvent.target as HTMLElement);
                        if (endElement && document.activeElement.classList.contains("protyle-wysiwyg")) {
                            focusBlock(endElement);
                        }
                        return;
                    }
                    const startBlockElement = hasClosestBlock(range.startContainer);
                    let endBlockElement: false | HTMLElement;
                    if (mouseUpEvent.detail > 2 && range.endContainer.nodeType !== 3 && ["DIV", "TD", "TH"].includes((range.endContainer as HTMLElement).tagName) && range.endOffset === 0) {
                        // 三击选中段落块时，rangeEnd 会在下一个块
                        if ((range.endContainer as HTMLElement).classList.contains("protyle-attr") && startBlockElement) {
                            // 三击在悬浮层中会选择到 attr https://github.com/siyuan-note/siyuan/issues/4636
                            // 需要获取可编辑元素，使用 previousElementSibling 的话会 https://github.com/siyuan-note/siyuan/issues/9714
                            setLastNodeRange(getContenteditableElement(startBlockElement), range, false);
                        } else if (["TD", "TH"].includes((range.endContainer as HTMLElement).tagName)) {
                            const cellElement = hasClosestByTag(range.startContainer, "TH") || hasClosestByTag(range.startContainer, "TD");
                            if (cellElement) {
                                setLastNodeRange(cellElement, range, false);
                            }
                        }
                    } else {
                        endBlockElement = hasClosestBlock(range.endContainer);
                    }
                    if (startBlockElement && endBlockElement && endBlockElement !== startBlockElement) {
                        if ((range.startContainer.nodeType === 1 && (range.startContainer as HTMLElement).tagName === "DIV" && (range.startContainer as HTMLElement).classList.contains("protyle-attr")) ||
                            event.clientY > mouseUpEvent.clientY) {
                            setFirstNodeRange(getContenteditableElement(endBlockElement), range);
                        } else if (range.endOffset === 0 && range.endContainer.nodeType === 1 && (range.endContainer as HTMLElement).tagName === "DIV") {
                            setLastNodeRange(getContenteditableElement(startBlockElement), range, false);
                        } else {
                            range.collapse(true);
                        }
                    }
                }
            };
        });
    }

    private bindEvent(protyle: IProtyle) {
        // 删除块时，av 头尾需重新计算位置
        protyle.observer = new ResizeObserver(() => {
            const contentRect = protyle.contentElement.getBoundingClientRect();
            protyle.wysiwyg.element.querySelectorAll(".av").forEach((item: HTMLElement) => {
                if (item.querySelector(".av__scroll")) {
                    stickyRow(item, contentRect, "all");
                }
            });
        });

        this.element.addEventListener("focusout", () => {
            if (getSelection().rangeCount === 0) {
                return;
            }
            const range = getSelection().getRangeAt(0);
            if (this.element === range.startContainer || this.element.contains(range.startContainer)) {
                protyle.toolbar.range = range.cloneRange();
            }
        });

        this.element.addEventListener("cut", (event: ClipboardEvent & { target: HTMLElement }) => {
            handleCut(protyle, event);
        });

        let beforeContextmenuRange: Range;
        this.element.addEventListener("contextmenu", (event: MouseEvent & { detail: any }) => {
            handleContextmenu(protyle, event, beforeContextmenuRange);
        });

        this.element.addEventListener("pointerdown", () => {
            if (getSelection().rangeCount > 0) {
                beforeContextmenuRange = getSelection().getRangeAt(0);
            } else {
                beforeContextmenuRange = undefined;
            }
            if (isBrowserDesktop && protyle.breadcrumb) {
                const indentElement = protyle.breadcrumb.element.parentElement.querySelector('[data-type="indent"]');
                if (indentElement && getSelection().rangeCount > 0) {
                    setTimeout(() => {
                        const newRange = getSelection().getRangeAt(0);
                        const blockElement = hasClosestBlock(newRange.startContainer);
                        if (!blockElement) {
                            return;
                        }
                        const outdentElement = protyle.breadcrumb.element.parentElement.querySelector('[data-type="outdent"]');
                        if (blockElement.parentElement.classList.contains("li")) {
                            indentElement.removeAttribute("disabled");
                            outdentElement.removeAttribute("disabled");
                        } else {
                            indentElement.setAttribute("disabled", "true");
                            outdentElement.setAttribute("disabled", "true");
                        }
                    }, 520);
                }
            }
        });

        bindScrollEvent(protyle, this.element);

        bindInputEvents(
            protyle, this.element,
            () => this.preventKeyup,
            (v) => {
 this.preventKeyup = v; 
},
            this.setEmptyOutline.bind(this),
        );

        const clickState = { mobileBlur: false };
        // 输入法测试点 https://github.com/siyuan-note/siyuan/issues/3027
        let isComposition = false; // for iPhone
        this.element.addEventListener("compositionstart", (event) => {
            isComposition = true;
            // 微软双拼由于 focusByRange 导致无法输入文字，因此不再 keydown 中记录了，但 keyup 会记录拼音字符，因此使用 isComposition 阻止 keyup 记录。
            // 但搜狗输入法选中后继续输入不走 keydown，isComposition 阻止了 keyup 记录，因此需在此记录。
            const range = getEditorRange(protyle.wysiwyg.element);
            const nodeElement = hasClosestBlock(range.startContainer);
            if (!isMac() && nodeElement) {
                setInsertWbrHTML(nodeElement, range, protyle);
            }
            event.stopPropagation();
        });

        this.element.addEventListener("compositionend", (event: InputEvent) => {
            event.stopPropagation();
            isComposition = false;
            const range = getEditorRange(this.element);
            const blockElement = hasClosestBlock(range.startContainer);
            if (!blockElement) {
                return;
            }
            if ("" !== event.data) {
                escapeInline(protyle, range, event);
                // 小鹤音形 ;k 不能使用 setTimeout;
                // wysiwyg.element contenteditable 为 false 时，连拼 needRender 必须为 false
                // hr 渲染；任务列表、粗体、数学公示结尾 needRender 必须为 true
                input(protyle, blockElement, range, true);
            } else {
                const id = blockElement.getAttribute("data-node-id");
                if (protyle.wysiwyg.lastHTMLs[id]) {
                    updateTransaction(protyle, id, blockElement.outerHTML, protyle.wysiwyg.lastHTMLs[id]);
                }
            }
        });

        let timeout: number;
        this.element.addEventListener("input", (event: InputEvent) => {
            const target = event.target as HTMLElement;
            if (target.tagName === "VIDEO" || target.tagName === "AUDIO" || event.inputType === "historyRedo") {
                return;
            }
            if (event.inputType === "historyUndo") {
                /// #if !BROWSER
                ipcRenderer.send(Constants.SIYUAN_CMD, "redo");
                /// #endif
                window.siyuan.menus.menu.remove();
                return;
            }
            const range = getEditorRange(this.element);
            const blockElement = hasClosestBlock(range.startContainer);
            if (!blockElement) {
                return;
            }
            if ([":", "(", "【", "（", "[", "{", "「", "『", "#", "/", "、"].includes(event.data)) {
                protyle.hint.enableExtend = true;
            }
            if (event.isComposing || isComposition ||
                // https://github.com/siyuan-note/siyuan/issues/337 编辑器内容拖拽问题
                event.inputType === "deleteByDrag" || event.inputType === "insertFromDrop"
            ) {
                return;
            }
            escapeInline(protyle, range, event);

            if ((/^\d{1}$/.test(event.data) || event.data === "‘" || event.data === "“" ||
                // 百度输入法中文反双引号 https://github.com/siyuan-note/siyuan/issues/9686
                event.data === "”" ||
                event.data === "「")) {
                clearTimeout(timeout);  // https://github.com/siyuan-note/siyuan/issues/9179
                timeout = window.setTimeout(() => {
                    input(protyle, blockElement, range, true); // 搜狗拼音数字后面句号变为点；Mac 反向双引号无法输入
                });
            } else {
                if (isMac() && event.data === "【】") {
                    setTimeout(() => {
                        input(protyle, blockElement, range, true, event);
                    }, Constants.TIMEOUT_INPUT);
                } else {
                    clearTimeout(timeout); // https://github.com/siyuan-note/siyuan/issues/9179
                    timeout = window.setTimeout(() => {
                        input(protyle, blockElement, range, true, event);
                    });
                }
            }
            event.stopPropagation();
        });

        this.element.addEventListener("keyup", (event) => {
            const range = getEditorRange(this.element).cloneRange();
            const nodeElement = hasClosestBlock(range.startContainer);

            if (event.key !== "PageUp" && event.key !== "PageDown" && event.key !== "Home" && event.key !== "End" &&
                event.key.indexOf("Arrow") === -1 && event.key !== "Escape" && event.key !== "Shift" &&
                event.key !== "Meta" && event.key !== "Alt" && event.key !== "Control" && event.key !== "CapsLock" &&
                !event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey &&
                !/^F\d{1,2}$/.test(event.key)) {
                // 搜狗输入法不走 keydown，没有选中字符后不走 compositionstart，需重新记录历史状态
                if (!isMac() && nodeElement &&
                    // 微软双拼 keyup 会记录拼音字符，因此在 compositionstart 记录
                    !isComposition &&
                    (typeof protyle.wysiwyg.lastHTMLs[nodeElement.getAttribute("data-node-id")] === "undefined" || range.toString() !== "" || !this.preventKeyup)) {
                    setInsertWbrHTML(nodeElement, range, protyle);
                }
                this.preventKeyup = false;
                return;
            }

            // 需放在 lastHTMLs 后，否则 https://github.com/siyuan-note/siyuan/issues/4388
            if (this.preventKeyup) {
                this.preventKeyup = false;
                return;
            }

            if ((event.shiftKey || isOnlyMeta(event)) && !event.isComposing && range.toString() !== "") {
                // 工具栏
                protyle.toolbar.render(protyle, range, event);
                countSelectWord(range);
            }

            if (event.eventPhase !== 3 && !event.shiftKey && (event.key.indexOf("Arrow") > -1 || event.key === "Home" || event.key === "End" || event.key === "PageUp" || event.key === "PageDown") && !event.isComposing) {
                if (nodeElement) {
                    clearSelect(["img", "av"], protyle.wysiwyg.element);
                    this.setEmptyOutline(protyle, nodeElement);
                    if (range.toString() === "" && !nodeElement.classList.contains("protyle-wysiwyg--select")) {
                        countSelectWord(range, protyle.block.rootID);
                    }
                    if (protyle.breadcrumb) {
                        const indentElement = protyle.breadcrumb.element.parentElement.querySelector('[data-type="indent"]');
                        if (indentElement) {
                            const outdentElement = protyle.breadcrumb.element.parentElement.querySelector('[data-type="outdent"]');
                            if (nodeElement.parentElement.classList.contains("li")) {
                                indentElement.removeAttribute("disabled");
                                outdentElement.removeAttribute("disabled");
                            } else {
                                indentElement.setAttribute("disabled", "true");
                                outdentElement.setAttribute("disabled", "true");
                            }
                        }
                    }
                }
                event.stopPropagation();
            }

            // 按下方向键后块高亮跟随光标移动 https://github.com/siyuan-note/siyuan/issues/8918
            if ((event.key === "ArrowLeft" || event.key === "ArrowRight") &&
                nodeElement && !nodeElement.classList.contains("protyle-wysiwyg--select")) {
                const selectElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
                let containRange = false;
                selectElements.find(item => {
                    if (item.contains(range.startContainer)) {
                        containRange = true;
                        return true;
                    }
                });
                if (!containRange && selectElements.length > 0) {
                    selectElements.forEach(item => {
                        item.classList.remove("protyle-wysiwyg--select");
                    });
                    nodeElement.classList.add("protyle-wysiwyg--select");
                }
            }
        });

        this.element.addEventListener("dblclick", (event: MouseEvent & { target: HTMLElement }) => {
            if (event.target.tagName === "IMG" && !event.target.classList.contains("emoji")) {
                previewDocImage((event.target as HTMLElement).getAttribute("src"), protyle.block.rootID);
                return;
            }
        });
        const mobileBlur = false;
        this.element.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
            if (this.preventClick) {
                this.preventClick = false;
                return;
            }
            handleClick(protyle, event, this.element, this.setEmptyOutline.bind(this), clickState);
        });
    }
}
