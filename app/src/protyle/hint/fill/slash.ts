import {Constants} from "../../../constants";
import {hasClosestBlock, hasClosestByAttribute, hasClosestByClassName} from "../../util/hasClosest";
import {focusByRange, focusByWbr, focusBlock} from "../../util/selection";
import {getSelectionPosition} from "../../util/selection";
import {hintEmbed} from "../extend";
import {hintRef} from "../extend.hintRef";
import {getBlockRefAnchorText, newFileInProtyle} from "../../../util/file/newFile";
import {getContenteditableElement, hasNextSibling, hasPreviousSibling} from "../../wysiwyg/getBlock";
import {transaction} from "../../wysiwyg/transaction/submit";
import {updateTransaction} from "../../wysiwyg/transaction/update";
import {insertHTML} from "../../util/insertHTML";
import {highlightRender} from "../../render/highlightRender";
import {setFold} from "../../util/blockFold";
import {imgMenu} from "../../../menus/protyleMenus/imageMenu/protyle.imgMenu";
import {assetMenu} from "../../../menus/protyleMenus/assetMenu/protyle.asset";
import {insertAssetIntoProtyle} from "../../asset/insert";
import {fetchPost} from "../../../util/network/fetch";
import {getDisplayName, pathPosix} from "../../../util/file/pathName";
import {blockRender} from "../../render/blockRender";
import {openFileById} from "../../../editor/utils.openFileById";
import {openMobileFileById} from "../../../mobile/editor";
import {contentRendererRegistry} from "../../../registry/contentRenderer/ContentRendererRegistry";
import {AIChat} from "../../../ai/chatStream";
import {isMobile} from "../../../platform";
import {avRender} from "../../render/av/render";
import {genIconHTML} from "../../render/util";
import type {HintDomain} from "../hint.types";

/**
 * 修复图片光标位置：当光标前一个节点是图片且图片后无兄弟节点时，插入零宽字符防止光标丢失。
 * 从 Hint 类的 fixImageCursor 私有方法原样提取。
 * @同步豁免: 遗留代码 — 需要同步操作 DOM Range
 */
function fixImageCursor(range: Range) {
    const previous = hasPreviousSibling(range.startContainer);
    if (previous && previous.nodeType !== 3 && (previous as HTMLElement).classList.contains("img")) {
        if (!hasNextSibling(previous)) {
            range.insertNode(document.createTextNode(Constants.ZWSP));
            range.collapse(false);
        }
    }
}

export interface IFillSlashContext {
    hint: HintDomain;
    value: string;
    protyle: IProtyle;
    range: Range;
    nodeElement: HTMLElement;
    id: string;
    html: string;
    genEmojiHTML: (protyle: IProtyle) => void;
}

/**
 * 处理 fill 方法中斜杠命令（/ 或 、）触发的所有分支逻辑。
 * 包括：引用/嵌入切换、模板/挂件/资源菜单、新建文档/子文档、AI对话、
 * 行内标记、emoji、样式、插件斜杠命令、代码块/图片/HTML块/表格等块级插入。
 * 从 Hint.fill 方法的斜杠命令分发段落（原 index.ts 655-901 行）原样提取。
 * @同步豁免: 遗留代码 — 需要同步操作 DOM 和事务
 */
export function handleFillSlash(ctx: IFillSlashContext): void {
    const {hint, value, protyle, range, id, html, genEmojiHTML} = ctx;
    const nodeElement = ctx.nodeElement;

    if (protyle.lite) {
        insertHTML(value, protyle);
        return;
    }
    if (value === "((" || value === "{{") {
        hint.enableExtend = true;
        handleRefOrEmbed(hint, value, protyle, range);
        return;
    }
    if (value === Constants.ZWSP) {
        range.deleteContents();
        fixImageCursor(range);
        protyle.toolbar.showTpl(protyle, nodeElement, range);
        updateTransaction(protyle, nodeElement, html);
        return;
    }
    if (value === Constants.ZWSP + 1) {
        range.deleteContents();
        fixImageCursor(range);
        protyle.toolbar.showWidget(protyle, nodeElement, range);
        updateTransaction(protyle, nodeElement, html);
        return;
    }
    if (value === Constants.ZWSP + 2) {
        range.deleteContents();
        fixImageCursor(range);
        protyle.toolbar.range = range;
        const rangePosition = getSelectionPosition(nodeElement, range);
        assetMenu({
            protyle,
            position: {x: rangePosition.left, y: rangePosition.top + 26, w: 0, h: 26},
            destination: {
                kind: "editor",
                select: (url) => insertAssetIntoProtyle(url, protyle),
            },
        });
        updateTransaction(protyle, nodeElement, html);
        return;
    }
    if (value === Constants.ZWSP + 3) {
        range.deleteContents();
        return;
    }
    if (value === Constants.ZWSP + 4) {
        handleNewDoc(protyle);
        return;
    }
    if (value === Constants.ZWSP + 6) {
        handleNewSubDoc(protyle);
        return;
    }
    if (value === Constants.ZWSP + 5) {
        range.deleteContents();
        AIChat(protyle, nodeElement);
        return;
    }
    if (Constants.INLINE_TYPE.includes(value)) {
        handleInlineType(protyle, value, range);
        return;
    }
    if (value === "emoji") {
        range.deleteContents();
        range.insertNode(document.createTextNode(":"));
        range.collapse(false);
        focusByRange(range);
        genEmojiHTML(protyle);
        return;
    }
    if (value.startsWith("style")) {
        range.deleteContents();
        fixImageCursor(range);
        nodeElement.setAttribute("style", value.split(Constants.ZWSP)[1] || "");
        updateTransaction(protyle, nodeElement, html);
        return;
    }
    if (value.startsWith("plugin")) {
        handlePlugin(protyle, value, nodeElement);
        return;
    }
    // 默认：块级内容插入（代码块、图片、HTML块、表格、分割线等）
    handleBlockInsert(protyle, value, range, nodeElement, id, html);
}

/** @同步豁免: 遗留代码 — 切换到引用/嵌入模式，需要同步操作 DOM Range */
function handleRefOrEmbed(hint: HintDomain, value: string, protyle: IProtyle, range: Range) {
    if (value === "((") {
        hintRef("", protyle, "hint");
    } else {
        hintEmbed("", protyle);
    }
    hint.splitChar = value;
    hint.lastIndex = 0;
    range.deleteContents();
    // 光标位于 block-ref 内末尾时，需调整到 block-ref 的外面，避免把标记符插入到引用内部
    const refElement = hasClosestByAttribute(range.startContainer, "data-type", "block-ref");
    if (refElement && range.startContainer.nodeType === 3 &&
        range.startOffset === (range.startContainer as Text).textContent.length) {
        range.setStartAfter(refElement);
        range.collapse(true);
    }
    const textNode = document.createTextNode(value);
    range.insertNode(textNode);
    range.setEnd(textNode, value.length);
    range.collapse(false);
    focusByRange(range);
}

/** @同步豁免: 遗留代码 — 新建文档，回调中同步插入 DOM */
function handleNewDoc(protyle: IProtyle) {
    newFileInProtyle(protyle, (createDocId, createDocTitle) => {
        insertHTML(`<span data-type="block-ref" data-id="${createDocId}" data-subtype="d">${getBlockRefAnchorText(createDocTitle)}</span>`, protyle);
    });
}

/** @同步豁免: 遗留代码 — 新建子文档，回调中同步插入 DOM */
function handleNewSubDoc(protyle: IProtyle) {
    const newSubDocId = Lute.NewNodeID();
    fetchPost("/api/filetree/createDoc", {
        notebook: protyle.notebookId,
        path: pathPosix().join(getDisplayName(protyle.path, false, true), newSubDocId + ".sy"),
        title: "",
        md: ""
    }, () => {
        insertHTML(`<span data-type="block-ref" data-id="${newSubDocId}" data-subtype="d">${getBlockRefAnchorText("")}</span>`, protyle);
        if (isMobile) {
            openMobileFileById(protyle.app, newSubDocId, [Constants.CB_GET_CONTEXT, Constants.CB_GET_OPENNEW]);
        }
        if (!isMobile) {
            openFileById({
                app: protyle.app,
                id: newSubDocId,
                action: [Constants.CB_GET_CONTEXT, Constants.CB_GET_OPENNEW]
            });
        }
    });
}

/** @同步豁免: 遗留代码 — 行内标记插入，需要同步操作 toolbar */
function handleInlineType(protyle: IProtyle, value: string, range: Range) {
    range.deleteContents();
    focusByRange(range);
    if (["a", "block-ref", "inline-math", "inline-memo", "text"].includes(value)) {
        protyle.toolbar.element.querySelector(`[data-type="${value}"]`).dispatchEvent(new CustomEvent("click"));
        return;
    }
    protyle.toolbar.setInlineMark(protyle, value, "range");
}

/** @同步豁免: 遗留代码 — 插件斜杠命令回调 */
function handlePlugin(protyle: IProtyle, value: string, nodeElement: HTMLElement) {
    protyle.app.plugins.find((plugin) => {
        const ids = value.split(Constants.ZWSP);
        if (ids[1] === plugin.name) {
            plugin.protyleSlash.find((slash) => {
                if (slash.id === ids[2]) {
                    slash.callback(protyle.getInstance(), nodeElement);
                    return true;
                }
            });
            return true;
        }
    });
}

/** @同步豁免: 遗留代码 — 块级内容插入（代码块、图片、HTML块、表格等），需要同步操作 DOM 和事务 */
function handleBlockInsert(protyle: IProtyle, value: string, range: Range, initialNodeElement: HTMLElement, id: string, html: string) {
    const nodeElement = initialNodeElement;
    range.deleteContents();
    if (value !== "![]()") {
        fixImageCursor(range);
    }
    let textContent = value;
    if (value === "```") {
        textContent = value + (Constants.SIYUAN_RENDER_CODE_LANGUAGES.includes(window.siyuan.storage[Constants.LOCAL_CODELANG]) ? "" : window.siyuan.storage[Constants.LOCAL_CODELANG]) + Lute.Caret + "\n```";
    }
    const editableElement = getContenteditableElement(nodeElement);
    if (value === "![]()") { // https://github.com/siyuan-note/siyuan/issues/4586 1
        handleImageInsert(protyle, value, range, nodeElement, id, html);
        return;
    }
    let resultNodeElement: HTMLElement;
    if (editableElement.textContent === "" && nodeElement.getAttribute("data-type") === "NodeParagraph") {
        resultNodeElement = handleEmptyParagraphInsert(protyle, value, textContent, nodeElement, id, html, editableElement, range);
    } else {
        resultNodeElement = handleNonEmptyInsert(protyle, value, textContent, nodeElement, id, html, range);
    }
    handlePostInsert(protyle, value, resultNodeElement, range);
}

/** @同步豁免: 遗留代码 — 图片插入 */
function handleImageInsert(protyle: IProtyle, value: string, range: Range, initialNodeElement: HTMLElement, _id: string, html: string) {
    let nodeElement = initialNodeElement;
    range.insertNode(document.createElement("wbr"));
    range.insertNode(document.createTextNode(value));
    nodeElement.insertAdjacentHTML("afterend", protyle.lute.SpinBlockDOM(nodeElement.outerHTML));
    nodeElement = nodeElement.nextElementSibling as HTMLElement;
    nodeElement.previousElementSibling.remove();
    focusByWbr(nodeElement, range);
    updateTransaction(protyle, nodeElement, html);
    let imgElement: HTMLElement = range.startContainer.childNodes[range.startOffset - 1] as HTMLElement || range.startContainer as HTMLElement;
    if (imgElement && imgElement.nodeType !== 3 && imgElement.classList.contains("img")) {
        // 已经找到图片
    } else if (imgElement.previousSibling?.nodeType !== 3 && (imgElement.previousSibling as HTMLElement).classList.contains("img")) {
        // https://github.com/siyuan-note/siyuan/issues/7540
        imgElement = imgElement.previousSibling as HTMLElement;
    } else {
        Array.from(nodeElement.querySelectorAll(".img")).find((item: HTMLElement) => {
            if (item.querySelector("img").getAttribute("data-src") === "") {
                imgElement = item;
                return true;
            }
        });
    }
    const rect = imgElement.getBoundingClientRect();
    imgMenu(protyle, range, imgElement, {
        clientX: rect.left,
        clientY: rect.top
    });
}

/** @同步豁免: 遗留代码 — 空段落块级插入，返回更新后的 nodeElement 供后续渲染使用 */
function handleEmptyParagraphInsert(protyle: IProtyle, value: string, textContent: string, initialNodeElement: HTMLElement, id: string, html: string, editableElement: HTMLElement, _range: Range): HTMLElement {
    let nodeElement = initialNodeElement;
    let newHTML = "";
    if (value === "<div>") {
        newHTML = `<div data-node-id="${id}" data-type="NodeHTMLBlock" class="render-node" data-subtype="block">${genIconHTML()}<div><protyle-html data-content=""></protyle-html><span style="position: absolute">${Constants.ZWSP}</span></div><div class="protyle-attr" contenteditable="false"></div></div>`;
    } else {
        editableElement.textContent = textContent;
        newHTML = protyle.lute.SpinBlockDOM(nodeElement.outerHTML);
    }
    // 列表项内创建列表时保留空段落，避免形成 li>list 非法结构 https://github.com/siyuan-note/siyuan/issues/17890
    const tempCheck = document.createElement("div");
    tempCheck.innerHTML = newHTML;
    const keepEmptyInLi = hasClosestByClassName(nodeElement, "li") &&
        tempCheck.firstElementChild?.getAttribute("data-type") === "NodeList";
    if (keepEmptyInLi) {
        // 保留空段落时给新 NodeList 生成新 ID，避免与段落 ID 冲突
        const newListId = Lute.NewNodeID();
        tempCheck.firstElementChild.setAttribute("data-node-id", newListId);
        newHTML = tempCheck.innerHTML;
    }
    nodeElement.insertAdjacentHTML("afterend", newHTML);
    nodeElement = nodeElement.nextElementSibling as HTMLElement;
    if (!keepEmptyInLi) {
        nodeElement.previousElementSibling.remove();
        // https://github.com/siyuan-note/siyuan/issues/6864
        if (nodeElement.getAttribute("data-type") === "NodeTable") {
            nodeElement.querySelectorAll("colgroup col").forEach((item: HTMLElement) => {
                item.style.minWidth = "60px";
            });
        }
        updateTransaction(protyle, nodeElement, html);
    } else {
        // 保留空段落：原段落清空内容，新列表用 insert 操作
        editableElement.textContent = "";
        transaction(protyle, [{
            action: "update",
            id: id,
            data: nodeElement.previousElementSibling.outerHTML
        }, {
            action: "insert",
            id: nodeElement.getAttribute("data-node-id"),
            data: nodeElement.outerHTML,
            previousID: id
        }], [{
            action: "update",
            id: id,
            data: html
        }, {
            action: "delete",
            id: nodeElement.getAttribute("data-node-id")
        }]);
    }
    return nodeElement;
}

/** @同步豁免: 遗留代码 — 非空段落块级插入，返回更新后的 nodeElement 供后续渲染使用 */
function handleNonEmptyInsert(protyle: IProtyle, value: string, textContent: string, initialNodeElement: HTMLElement, id: string, html: string, _range: Range): HTMLElement {
    let nodeElement = initialNodeElement;
    let newHTML = protyle.lute.SpinBlockDOM(textContent);
    if (value === "<div>") {
        newHTML = `<div data-node-id="${Lute.NewNodeID()}" data-type="NodeHTMLBlock" class="render-node" data-subtype="block">${genIconHTML()}<div><protyle-html data-content=""></protyle-html><span style="position: absolute">${Constants.ZWSP}</span></div><div class="protyle-attr" contenteditable="false"></div></div>`;
    }
    // 列表项内创建列表时保留空段落，避免 ID 冲突和 li>list 非法结构 https://github.com/siyuan-note/siyuan/issues/17890
    const keepEmptyInLi2 = hasClosestByClassName(nodeElement, "li") &&
        (() => {
            const tc = document.createElement("div");
            tc.innerHTML = newHTML;
            return tc.firstElementChild?.getAttribute("data-type") === "NodeList";
        })();
    if (keepEmptyInLi2) {
        const newListId = Lute.NewNodeID();
        const tc = document.createElement("div");
        tc.innerHTML = newHTML;
        tc.firstElementChild!.setAttribute("data-node-id", newListId);
        newHTML = tc.innerHTML;
        const editableElement = getContenteditableElement(nodeElement);
        editableElement!.innerHTML = "";
        nodeElement.insertAdjacentHTML("afterend", newHTML);
        const newListEl = nodeElement.nextElementSibling as HTMLElement;
        transaction(protyle, [{
            action: "update",
            id: id,
            data: nodeElement.outerHTML
        }, {
            action: "insert",
            id: newListId,
            data: newListEl.outerHTML,
            previousID: id
        }], [{
            action: "update",
            id: id,
            data: html
        }, {
            action: "delete",
            id: newListId
        }]);
        focusBlock(newListEl);
        return newListEl;
    }
    const oldHTML = nodeElement.outerHTML;
    let foldData;
    if (nodeElement.getAttribute("data-type") === "NodeHeading" &&
        nodeElement.getAttribute("fold") === "1") {
        foldData = setFold(protyle, nodeElement, true, false, false, true);
    }
    nodeElement.insertAdjacentHTML("afterend", newHTML);
    const newId = newHTML.substr(newHTML.indexOf('data-node-id="') + 14, 22);
    nodeElement.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
    nodeElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${newId}"]`);
    // https://github.com/siyuan-note/siyuan/issues/6864
    if (nodeElement.getAttribute("data-type") === "NodeTable") {
        nodeElement.querySelectorAll("colgroup col").forEach((item: HTMLElement) => {
            item.style.minWidth = "60px";
        });
    }
    const doOperations: IOperation[] = [{
        data: oldHTML,
        id,
        action: "update"
    }, {
        data: nodeElement.outerHTML,
        id: newId,
        previousID: id,
        action: "insert"
    }];
    const undoOperations: IOperation[] = [{
        id: newId,
        action: "delete"
    }, {
        data: html,
        id,
        action: "update"
    }];
    if (foldData) {
        doOperations.push(...foldData.doOperations);
        undoOperations.push(...foldData.undoOperations);
    }
    transaction(protyle, doOperations, undoOperations);
    return nodeElement;
}

/** @同步豁免: 遗留代码 — 块级插入后的渲染处理 */
function handlePostInsert(protyle: IProtyle, value: string, initialNodeElement: HTMLElement, range: Range) {
    const nodeElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${initialNodeElement.getAttribute("data-node-id")}"]`) as HTMLElement || initialNodeElement;
    if (value === "<div>" || value === "$$" || (value.indexOf("```") > -1 && (value.length > 3 || nodeElement.classList.contains("render-node")))) {
        protyle.toolbar.showRender(protyle, nodeElement);
        contentRendererRegistry.renderBatch(nodeElement);
    } else if (value.startsWith("```")) {
        highlightRender(nodeElement);
    } else if (value.startsWith("<iframe") || value.startsWith("<video") || value.startsWith("<audio")) {
        protyle.gutter.renderMenu(protyle, nodeElement);
        const rect = nodeElement.getBoundingClientRect();
        window.siyuan.menus.menu.popup({
            x: rect.left,
            y: rect.top,
            isLeft: true
        });
        const itemElement = window.siyuan.menus.menu.element.querySelector('[data-id="assetVideo"], [data-id="assetAudio"], [data-id="assetIFrame"]');
        itemElement.classList.add("b3-menu__item--show");
        window.siyuan.menus.menu.showSubMenu(itemElement.querySelector(".b3-menu__submenu"));
        window.siyuan.menus.menu.element.querySelector("textarea").focus();
    } else if (value === "---") {
        focusBlock(nodeElement);
    } else if (nodeElement.classList.contains("av")) {
        avRender(nodeElement, protyle, () => {
            const titleHTMLElement = nodeElement.querySelector(".av__title") as HTMLInputElement;
            titleHTMLElement.focus();
            range.setStart(titleHTMLElement, 0);
            range.collapse(true);
            focusByRange(range);
        });
    } else {
        focusByWbr(nodeElement, range);
    }
}
