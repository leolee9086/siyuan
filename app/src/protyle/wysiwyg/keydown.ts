import { hideElements } from "../ui/hideElements";
import { isMac, isNotCtrl, isOnlyMeta, writeText } from "../util/compatibility";
import {
    focusBlock,
    focusByRange,
    focusByWbr,
    getEditorRange,
    getSelectionOffset,
    getSelectionPosition,
    selectAll,
    setFirstNodeRange,
    setInsertWbrHTML,
    setLastNodeRange,
} from "../util/selection";
import {
    hasClosestBlock,
    hasClosestByAttribute,
    hasClosestByClassName,
    hasClosestByTag,
    hasTopClosestByAttribute,
    isInEmbedBlock
} from "../util/hasClosest";
import { removeBlock, removeImage } from "./remove";
import {
    getContenteditableElement,
    getFirstBlock,
    getLastBlock,
    getNextBlock,
    getPreviousBlock,
    getTopAloneElement,
    hasNextSibling,
    hasPreviousSibling,
    isEndOfBlock,
    isNotEditBlock,
} from "./getBlock";
import { isIncludesHotKey, matchHotKey } from "../util/hotKey";
import { enter, softEnter } from "./enter";
import { clearTableCell, fixTable } from "../util/table";
import {
    transaction,
    turnsIntoOneTransaction,
    turnsIntoTransaction,
    turnsOneInto,
    updateBatchTransaction,
    updateTransaction
} from "./transaction";
import { fontEvent } from "../toolbar/Font";
import { listIndent, listOutdent } from "./list";
import { addSubList } from "./list.addSubList";
import { newFileContentBySelect, rename, replaceFileName } from "../../editor/rename";
import { cancelSB, insertEmptyBlock, jumpToParent } from "../../block/util";
import { isLocalPath } from "../../util/pathName";
/// #if !MOBILE
import { openFileById } from "../../editor/utils.openFileById";
import { openBy } from "../../editor/utils.openBy";
/// #endif
import { alignImgCenter, alignImgLeft, commonHotkey, downSelect, getStartEndElement, upSelect } from "./commonHotkey";
import { inlineMathMenu, linkMenu, setFold, tagMenu } from "../../menus/protyle";
import { refMenu } from "../../menus/protyle.refMenu";
import { fileAnnotationRefMenu } from "../../menus/protyle.fileAnnotationRefMenu";
import { openAttr } from "../../menus/commonMenuItem";
import { Constants } from "../../constants";
import { fetchPost } from "../../util/fetch";
import { scrollCenter } from "../../util/highlightById";
import { BlockPanel } from "../../block/Panel";
import * as dayjs from "dayjs";
import { highlightRender } from "../render/highlightRender";
import { countBlockWord } from "../../layout/status";
import { moveToDown, moveToUp } from "./move";
import { pasteAsPlainText } from "../util/paste";
import { preventScroll } from "../scroll/preventScroll";
import { getSavePath, newFileBySelect } from "../../util/newFile";
import { removeSearchMark } from "../toolbar/util";
import { avKeydown } from "../render/av/keydown";
import { checkFold } from "../../util/noRelyPCFunction";
import { openAIActionsMenu } from "../../ai/actions";
import { openLink } from "../../editor/openLink";
import { onlyProtyleCommand } from "../../boot/globalEvent/command/protyle";
import { AIChat } from "../../ai/chat";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu";
import { htmlBlockGuard, inputElementGuard, protyleDisabledGuard, protyleHaveSelectedGuard } from "./keydown.guards";
import { hideProtyleToolbarMiddleware, hideProtyleUtilMiddleware, setProtyleWysiwygPreventKeyupMiddleware } from "./keydown.middlewares";
import { handleSelectedBlockInsertKeyMiddleware, removeSelectIndicatorElementMiddleware } from "./keydown.select";
import { decorationMatchMiddleware } from "./keydown.decorations";
import { arrowLeftRightMiddleWare, arrowUpDownMiddleware } from "./keydown.arrow.select";
import { openByMiddleWare } from "./keydown.openBy";
import { jumpToMiddleWare } from "./keydown.jump";
import { deleteKeyMiddleware } from "./keydown.delete";
import { altEnterMiddleware } from "./keydown.altEnter";
import { tabKeyMiddleware } from "./keydown.tab";
import { enterKeyMiddleware } from "./keydown.enter";
import { arrowNavigationMiddleware } from "./keydown.arrow.navigation";
import { inlineMenuMiddleware } from "./keydown.menus";

export const getContentByInlineHTML = (range: Range, cb: (content: string) => void) => {
    let html = "";
    Array.from(range.cloneContents().childNodes).forEach((item: HTMLElement) => {
        if (item.nodeType === 3) {
            html += item.textContent;
        } else {
            html += item.outerHTML;
        }
    });
    fetchPost("/api/block/getDOMText", { dom: html }, (response) => {
        cb(response.data);
    });
};

export const keydown = (protyle: IProtyle, editorElement: HTMLElement) => {
    //@ts-ignore
    editorElement.addEventListener("keydown", async (event: KeyboardEvent & { target: HTMLElement }) => {
        const controller: AbortController = new AbortController()
        const rawAbort = controller.abort
        controller.abort = (reason: string) => {
            console.log(reason)
            if (!reason) {
                console.error("键盘事件取消未给出原因,检查代码实现")
            }
            rawAbort.bind(controller)(reason)
        }
        const signal = controller.signal
        //中间件函数不传入控制器
        if (!protyle.wysiwyg) {
            console.error(protyle)
            throw (new Error('protyle结构错误'))
        }
        //守卫函数传入控制器但是不要修改状态
        await htmlBlockGuard(event, protyle, controller)
        if (signal.aborted) { return }
        await inputElementGuard(event, protyle, controller)
        if (signal.aborted) { return }
        await protyleDisabledGuard(event, protyle, controller)
        if (signal.aborted) { return }
        await protyleHaveSelectedGuard(event, protyle, controller)
        if (signal.aborted) { return }
        await setProtyleWysiwygPreventKeyupMiddleware(event, protyle)
        if (signal.aborted) { return }
        await hideProtyleUtilMiddleware(event, protyle)
        if (signal.aborted) { return }
        await hideProtyleToolbarMiddleware(event, protyle)
        if (signal.aborted) { return }
        const range = getEditorRange(protyle.wysiwyg.element);
        const nodeElement = hasClosestBlock(range.startContainer);
        if (!nodeElement) { throw (new Error('未能找到块元素')) }
        if (signal.aborted) { return }
        // https://ld246.com/article/1694506408293
        const endElement = hasClosestBlock(range.endContainer);
        if (!matchHotKey("⌘C", event) && endElement && nodeElement !== endElement) {
            event.stopPropagation();
            event.preventDefault();
            controller.abort("跨块选择被阻止");
        }
        if (signal.aborted) { return }
        if (document.querySelector(".av__panel")) {
            controller.abort("属性视图面板已打开");
        }
        if (signal.aborted) { return }
        if (avKeydown(event, nodeElement, protyle)) {
            controller.abort("属性视图键盘事件处理");
        }
        if (signal.aborted) { return }
        await handleSelectedBlockInsertKeyMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        if (event.isComposing) {
            event.stopPropagation();
            return;
        }
        // https://github.com/siyuan-note/siyuan/issues/2261
        if (!["⌘", "⇧", "⌥", "⌃"].includes(Constants.KEYCODELIST[event.keyCode])) {
            if (Constants.KEYCODELIST[event.keyCode] === "/" ||
                // 德语
                event.key === "/" ||
                // windows 中文
                (event.code === "Slash" && event.key === "Process" && event.keyCode === 229)) {
                protyle.hint.enableSlash = true;
            } else if (Constants.KEYCODELIST[event.keyCode] === "\\" ||
                // 德语
                event.key === "\\" ||
                // Mac 日文-罗马字 https://github.com/siyuan-note/siyuan/issues/13725
                (event.key === "," && event.keyCode === 229) ||
                // windows 中文
                (event.code === "Backslash" && event.key === "Process" && event.keyCode === 229)) {
                protyle.hint.enableSlash = false;
                hideElements(["hint"], protyle);
                // 此处不能返回，否则无法撤销 https://github.com/siyuan-note/siyuan/issues/2795
            }
        }
        // 有可能输入 shift+. ，因此需要使用 event.key 来进行判断
        if (event.key !== "PageUp" && event.key !== "PageDown" && event.key !== "Home" && event.key !== "End" && event.key.indexOf("Arrow") === -1 &&
            event.key !== "Escape" && event.key !== "Shift" && event.key !== "Meta" && event.key !== "Alt" && event.key !== "Control" && event.key !== "CapsLock" &&
            !isNotEditBlock(nodeElement) && !/^F\d{1,2}$/.test(event.key) &&
            // 微软双拼使用 compositionstart，否则 focusByRange 导致无法输入文字
            event.key !== "Process") {
            setInsertWbrHTML(nodeElement, range, protyle);
            protyle.wysiwyg.preventKeyup = true;
        }

        if (!getSiyuanGlobalMenus().menu.element.classList.contains("fn__none") &&
            (["←", "↑", "→", "↓"].includes(Constants.KEYCODELIST[event.keyCode]) || Constants.KEYCODELIST[event.keyCode] === "↩") &&
            !event.altKey && !event.shiftKey && isNotCtrl(event)) {
            event.preventDefault();
            return;
        } else if (event.key !== "Escape") {
            getSiyuanGlobalMenus().menu.remove();
        }

        if (!["Alt", "Meta", "Shift", "Control", "CapsLock", "Escape"].includes(event.key) && protyle.options.render.breadcrumb) {
            protyle.breadcrumb.hide();
        }

        await arrowUpDownMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }

        // 仅处理以下快捷键操作
        if (event.key !== "PageUp" && event.key !== "PageDown" && event.key !== "Home" && event.key !== "End" && event.key.indexOf("Arrow") === -1 &&
            isNotCtrl(event) && event.key !== "Escape" && !event.shiftKey && !event.altKey && !/^F\d{1,2}$/.test(event.key) &&
            event.key !== "Enter" && event.key !== "Tab" && event.key !== "Backspace" && event.key !== "Delete" && event.key !== "ContextMenu") {
            event.stopPropagation();
            hideElements(["select"], protyle);
            // https://github.com/siyuan-note/siyuan/issues/14743
            if (nodeElement && getContenteditableElement(nodeElement) &&
                range.endContainer.nodeType === 1 && (range.endContainer as HTMLElement).classList.contains("protyle-attr")) {
                range.collapse(true);
            }
            return false;
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.general.collapse.custom, event) && !event.repeat) {
            const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
            if (selectElements.length > 0) {
                setFold(protyle, selectElements[0]);
            } else {
                if (nodeElement.parentElement.getAttribute("data-type") === "NodeListItem") {
                    if (nodeElement.parentElement.childElementCount > 3) {
                        setFold(protyle, nodeElement.parentElement);
                    } else {
                        setFold(protyle, nodeElement);
                    }
                } else if (nodeElement.getAttribute("data-type") === "NodeHeading") {
                    setFold(protyle, nodeElement);
                } else {
                    setFold(protyle, getTopAloneElement(nodeElement));
                }
            }
            event.stopPropagation();
            event.preventDefault();
            return false;
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.general.expand.custom, event) && !event.repeat) {
            const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
            if (selectElements.length > 0) {
                setFold(protyle, selectElements[0], true);
            } else {
                if (nodeElement.parentElement.getAttribute("data-type") === "NodeListItem") {
                    if (nodeElement.parentElement.childElementCount > 3) {
                        setFold(protyle, nodeElement.parentElement, true);
                    } else {
                        setFold(protyle, nodeElement, true);
                    }
                } else if (nodeElement.getAttribute("data-type") === "NodeHeading") {
                    setFold(protyle, nodeElement, true);
                } else {
                    setFold(protyle, getTopAloneElement(nodeElement), true);
                }
            }
            event.stopPropagation();
            event.preventDefault();
            return;
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.general.expandUp.custom, event)) {
            upSelect({
                protyle, event, nodeElement, editorElement, range,
                cb(selectElements) {
                    const previousElement = selectElements[0].previousElementSibling as HTMLElement;
                    if (previousElement && previousElement.getAttribute("data-node-id")) {
                        previousElement.classList.add("protyle-wysiwyg--select");
                        selectElements.forEach(item => {
                            item.removeAttribute("select-end");
                        });
                        previousElement.setAttribute("select-end", "true");
                        const top = previousElement.getBoundingClientRect().top - protyle.contentElement.getBoundingClientRect().top;
                        if (top < 0) {
                            protyle.contentElement.scrollTop = protyle.contentElement.scrollTop + top;
                            protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop + 1;
                        }
                    } else if (!selectElements[0].parentElement.classList.contains("protyle-wysiwyg")) {
                        hideElements(["select"], protyle);
                        selectElements[0].parentElement.classList.add("protyle-wysiwyg--select");
                    }
                }
            });
            return;
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.general.expandDown.custom, event)) {
            downSelect({
                protyle, event, nodeElement, editorElement, range,
                cb(selectElements) {
                    const selectLastElement = selectElements[selectElements.length - 1];
                    const nextElement = selectLastElement.nextElementSibling as HTMLElement;
                    if (nextElement && nextElement.getAttribute("data-node-id")) {
                        nextElement.classList.add("protyle-wysiwyg--select");
                        selectElements.forEach(item => {
                            item.removeAttribute("select-end");
                        });
                        nextElement.setAttribute("select-end", "true");
                        const bottom = nextElement.getBoundingClientRect().bottom - protyle.contentElement.getBoundingClientRect().bottom;
                        if (bottom > 0) {
                            protyle.contentElement.scrollTop = protyle.contentElement.scrollTop + bottom;
                            protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop - 1;
                        }
                    } else if (!selectLastElement.parentElement.classList.contains("protyle-wysiwyg")) {
                        hideElements(["select"], protyle);
                        selectLastElement.parentElement.classList.add("protyle-wysiwyg--select");
                    }
                }
            });
            return;
        }

        if (matchHotKey("⇧↑", event)) {
            upSelect({
                protyle, event, nodeElement, editorElement, range,
                cb(selectElements) {
                    const startEndElement = getStartEndElement(selectElements);
                    if (startEndElement.startElement.getBoundingClientRect().top >= startEndElement.endElement.getBoundingClientRect().top) {
                        const previousElement = startEndElement.endElement.previousElementSibling as HTMLElement;
                        if (previousElement && previousElement.getAttribute("data-node-id")) {
                            previousElement.classList.add("protyle-wysiwyg--select");
                            previousElement.setAttribute("select-end", "true");
                            startEndElement.endElement.removeAttribute("select-end");
                            const top = previousElement.getBoundingClientRect().top - protyle.contentElement.getBoundingClientRect().top;
                            if (top < 0) {
                                protyle.contentElement.scrollTop = protyle.contentElement.scrollTop + top;
                                protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop + 1;
                            }
                        } else if (!startEndElement.endElement.parentElement.classList.contains("protyle-wysiwyg")) {
                            hideElements(["select"], protyle);
                            startEndElement.endElement.parentElement.classList.add("protyle-wysiwyg--select");
                        }
                    } else {
                        startEndElement.endElement.classList.remove("protyle-wysiwyg--select");
                        startEndElement.endElement.removeAttribute("select-end");
                        const previousElement = getPreviousBlock(startEndElement.endElement);
                        if (previousElement) {
                            previousElement.setAttribute("select-end", "true");
                            if (previousElement.getBoundingClientRect().top <= protyle.contentElement.getBoundingClientRect().top) {
                                preventScroll(protyle);
                                previousElement.scrollIntoView(true);
                            }
                        }
                    }
                }
            });
            return;
        }

        if (matchHotKey("⇧↓", event)) {
            downSelect({
                protyle,
                event,
                nodeElement,
                editorElement,
                range,
                cb(selectElements) {
                    const startEndElement = getStartEndElement(selectElements);
                    if (startEndElement.startElement.getBoundingClientRect().top <= startEndElement.endElement.getBoundingClientRect().top) {
                        const nextElement = startEndElement.endElement.nextElementSibling as HTMLElement;
                        if (nextElement && nextElement.getAttribute("data-node-id")) {
                            if (nextElement.getBoundingClientRect().width === 0) {
                                // https://github.com/siyuan-note/siyuan/issues/11194
                                hideElements(["select"], protyle);
                                startEndElement.endElement.parentElement.classList.add("protyle-wysiwyg--select");
                            } else {
                                nextElement.classList.add("protyle-wysiwyg--select");
                                nextElement.setAttribute("select-end", "true");
                                startEndElement.endElement.removeAttribute("select-end");
                                const bottom = nextElement.getBoundingClientRect().bottom - protyle.contentElement.getBoundingClientRect().bottom;
                                if (bottom > 0) {
                                    protyle.contentElement.scrollTop = protyle.contentElement.scrollTop + bottom;
                                    protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop - 1;
                                }
                            }
                        } else if (!startEndElement.endElement.parentElement.classList.contains("protyle-wysiwyg")) {
                            hideElements(["select"], protyle);
                            startEndElement.endElement.parentElement.classList.add("protyle-wysiwyg--select");
                        }
                    } else {
                        startEndElement.endElement.classList.remove("protyle-wysiwyg--select");
                        startEndElement.endElement.removeAttribute("select-end");
                        const nextElement = getNextBlock(startEndElement.endElement);
                        if (nextElement) {
                            nextElement.setAttribute("select-end", "true");
                            if (nextElement.getBoundingClientRect().bottom >= protyle.contentElement.getBoundingClientRect().bottom) {
                                preventScroll(protyle);
                                nextElement.scrollIntoView(false);
                            }
                        }
                    }
                }
            });
            return;
        }

        if (matchHotKey(window.siyuan.config.keymap.general.enter.custom, event)) {
            onlyProtyleCommand({
                protyle,
                command: "enter",
                previousRange: range,
            });
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        if (matchHotKey(window.siyuan.config.keymap.general.enterBack.custom, event)) {
            onlyProtyleCommand({
                protyle,
                command: "enterBack",
                previousRange: range,
            });
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        if ((event.shiftKey && !event.altKey && isNotCtrl(event) && (event.key === "Home" || event.key === "End") && isMac()) ||
            (event.shiftKey && !event.altKey && isOnlyMeta(event) && (event.key === "Home" || event.key === "End") && !isMac())) {
            const topElement = hasTopClosestByAttribute(nodeElement, "data-node-id", null);
            if (topElement) {
                // 超级块内已选中某个块
                topElement.querySelectorAll(".protyle-wysiwyg--select").forEach(item => {
                    item.classList.remove("protyle-wysiwyg--select");
                });
                topElement.classList.add("protyle-wysiwyg--select");
                let nextElement = event.key === "Home" ? topElement.previousElementSibling : topElement.nextElementSibling;
                while (nextElement) {
                    nextElement.classList.add("protyle-wysiwyg--select");
                    nextElement = event.key === "Home" ? nextElement.previousElementSibling : nextElement.nextElementSibling;
                }
                if (event.key === "Home") {
                    protyle.wysiwyg.element.firstElementChild.scrollIntoView();
                } else {
                    protyle.wysiwyg.element.lastElementChild.scrollIntoView(false);
                }
            }
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        // https://github.com/siyuan-note/siyuan/issues/11726
        if ((event.key === "Home" || event.key === "End") && !event.shiftKey && !event.altKey && isNotCtrl(event)) {
            hideElements(["hint"], protyle);
        }
        // 向上/下滚动一屏
        if (!event.altKey && !event.shiftKey && isNotCtrl(event) && (event.key === "PageUp" || event.key === "PageDown")) {
            if (event.key === "PageUp") {
                protyle.contentElement.scrollTop = protyle.contentElement.scrollTop - protyle.contentElement.clientHeight + 60;
                protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop + 1;
            } else {
                protyle.contentElement.scrollTop = protyle.contentElement.scrollTop + protyle.contentElement.clientHeight - 60;
                protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop - 1;
            }
            const contentRect = protyle.contentElement.getBoundingClientRect();
            let centerElement = document.elementFromPoint(contentRect.x + contentRect.width / 2, contentRect.y + contentRect.height / 2);
            if (centerElement.classList.contains("protyle-wysiwyg")) {
                centerElement = document.elementFromPoint(contentRect.x + contentRect.width / 2, contentRect.y + contentRect.height / 2 + Constants.SIZE_TOOLBAR_HEIGHT);
            }
            const centerBlockElement = hasClosestBlock(centerElement);
            if (centerBlockElement && centerBlockElement !== nodeElement) {
                focusBlock(centerBlockElement, undefined, false);
            }
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        // hint: 上下、回车选择
        if (!event.altKey && !event.shiftKey &&
            ((event.key.indexOf("Arrow") > -1 && isNotCtrl(event)) || event.key === "Enter") &&
            !protyle.hint.element.classList.contains("fn__none") && protyle.hint.select(event, protyle)) {
            return;
        }
        //行内元素菜单和块菜单
        await inlineMenuMiddleware(event,protyle,nodeElement,range,controller)
        if(signal.aborted){ return }
        if (fixTable(protyle, event, range)) {
            event.preventDefault();
            return;
        }
        const selectText = range.toString();
        // 上下左右光标移动
        await arrowNavigationMiddleware(event, protyle, nodeElement, range, controller)
        if(signal.aborted){ return}

        // 删除，不可使用 isNotCtrl(event)，否则软删除回导致 https://github.com/siyuan-note/siyuan/issues/5607
        // 不可使用 !event.shiftKey，否则 https://ld246.com/article/1666434796806
        await deleteKeyMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }


        // 软换行
        if (matchHotKey("⇧↩", event) && selectText === "" && softEnter(range, nodeElement, protyle)) {
            event.stopPropagation();
            event.preventDefault();
            return;
        }

        // 代码块语言选择 https://github.com/siyuan-note/siyuan/issues/14126
        await altEnterMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }

        // 回车
        await enterKeyMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) { return }

        if (matchHotKey("⌘A", event)) {
            event.preventDefault();
            selectAll(protyle, nodeElement, range);
            return true;
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.general.undo.custom, event)) {
            protyle.undo.undo(protyle);
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.general.redo.custom, event)) {
            protyle.undo.redo(protyle);
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        /// #if !MOBILE
        if (commonHotkey(protyle, event, nodeElement)) {
            return true;
        }
        /// #endif

        if (matchHotKey(window.siyuan.config.keymap.editor.general.copyText.custom, event)) {
            // 用于标识复制文本 *
            if (selectText !== "") {
                // 和复制块引用保持一致 https://github.com/siyuan-note/siyuan/issues/9093
                getContentByInlineHTML(range, (content) => {
                    writeText(`${content.trim()} ((${nodeElement.getAttribute("data-node-id")} "*"))`);
                });
            } else {
                const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
                if (selectElements.length > 0) {
                    selectElements[0].setAttribute("data-reftext", "true");
                    focusByRange(getEditorRange(nodeElement));
                    document.execCommand("copy");
                } else {
                    writeText(`((${nodeElement.getAttribute("data-node-id")} "*"))`);
                }
            }
            event.preventDefault();
            event.stopPropagation();
            return true;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.general.attr.custom, event)) {
            const topElement = getTopAloneElement(nodeElement);
            if (selectText === "") {
                const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
                let actionElement;
                if (selectElements.length === 1) {
                    actionElement = selectElements[0];
                } else {
                    actionElement = topElement;
                }
                openAttr(actionElement, "bookmark", protyle);
            } else {
                getContentByInlineHTML(range, (content) => {
                    const oldHTML = topElement.outerHTML;
                    const nameElement = topElement.lastElementChild.querySelector(".protyle-attr--name");
                    if (nameElement) {
                        nameElement.innerHTML = `<svg><use xlink:href="#iconN"></use></svg>${content.trim()}`;
                    } else {
                        topElement.lastElementChild.insertAdjacentHTML("afterbegin", `<div class="protyle-attr--name"><svg><use xlink:href="#iconN"></use></svg>${content.trim()}</div>`);
                    }
                    topElement.setAttribute("name", content.trim());
                    updateTransaction(protyle, topElement.getAttribute("data-node-id"), topElement.outerHTML, oldHTML);
                });
            }
            event.preventDefault();
            event.stopPropagation();
            return true;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.general.rename.custom, event) && !protyle.disabled) {
            if (selectText === "") {
                fetchPost("/api/block/getDocInfo", {
                    id: protyle.block.rootID
                }, (response) => {
                    rename({
                        notebookId: protyle.notebookId,
                        path: protyle.path,
                        name: response.data.ial.title,
                        range,
                        type: "file",
                    });
                });
            } else {
                fetchPost("/api/filetree/renameDoc", {
                    notebook: protyle.notebookId,
                    path: protyle.path,
                    title: replaceFileName(selectText),
                });
            }
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        const isNewNameFile = matchHotKey(window.siyuan.config.keymap.editor.general.newNameFile.custom, event);
        if (isNewNameFile || matchHotKey(window.siyuan.config.keymap.editor.general.newNameSettingFile.custom, event)) {
            if (!selectText.trim() && (nodeElement.querySelector("tr") || nodeElement.querySelector("span"))) {
                // 没选中时，都是纯文本就创建子文档 https://ld246.com/article/1663073488381/comment/1664804353295#comments
            } else {
                if (!selectText.trim() &&
                    getContenteditableElement(nodeElement).textContent  // https://github.com/siyuan-note/siyuan/issues/8099
                ) {
                    selectAll(protyle, nodeElement, range);
                }
                if (isNewNameFile) {
                    fetchPost("/api/filetree/getHPathByPath", {
                        notebook: protyle.notebookId,
                        path: protyle.path,
                    }, (response) => {
                        newFileBySelect(protyle, selectText, nodeElement, response.data, protyle.notebookId);
                    });
                } else {
                    getSavePath(protyle.path, protyle.notebookId, (pathString, targetNotebookId) => {
                        newFileBySelect(protyle, selectText, nodeElement, pathString, targetNotebookId);
                    });
                }
            }
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.general.newContentFile.custom, event)) {
            newFileContentBySelect(protyle);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.general.alignLeft.custom, event)) {
            const imgSelectElements = nodeElement.querySelectorAll(".img--select");
            if (imgSelectElements.length > 0) {
                alignImgLeft(protyle, nodeElement, Array.from(imgSelectElements), nodeElement.getAttribute("data-node-id"), nodeElement.outerHTML);
            } else {
                let selectElements: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
                if (selectElements.length === 0) {
                    selectElements = [nodeElement];
                }
                updateBatchTransaction(selectElements, protyle, (e: HTMLElement) => {
                    if (e.classList.contains("av")) {
                        e.style.justifyContent = "";
                    } else {
                        e.style.textAlign = "left";
                    }
                });
            }
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.general.alignCenter.custom, event)) {
            const imgSelectElements = nodeElement.querySelectorAll(".img--select");
            if (imgSelectElements.length > 0) {
                alignImgCenter(protyle, nodeElement, Array.from(imgSelectElements), nodeElement.getAttribute("data-node-id"), nodeElement.outerHTML);
            } else {
                let selectElements: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
                if (selectElements.length === 0) {
                    selectElements = [nodeElement];
                }
                updateBatchTransaction(selectElements, protyle, (e: HTMLElement) => {
                    if (e.classList.contains("av")) {
                        e.style.justifyContent = "center";
                    } else {
                        e.style.textAlign = "center";
                    }
                });
            }
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.general.alignRight.custom, event)) {
            let selectElements: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
            if (selectElements.length === 0) {
                selectElements = [nodeElement];
            }
            updateBatchTransaction(selectElements, protyle, (e: HTMLElement) => {
                if (e.classList.contains("av")) {
                    e.style.justifyContent = "flex-end";
                } else {
                    e.style.textAlign = "right";
                }
            });
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.general.rtl.custom, event)) {
            let selectElements: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
            if (selectElements.length === 0) {
                selectElements = [nodeElement];
            }
            updateBatchTransaction(selectElements, protyle, (e: HTMLElement) => {
                e.style.direction = "rtl";
            });
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.general.ltr.custom, event)) {
            let selectElements: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
            if (selectElements.length === 0) {
                selectElements = [nodeElement];
            }
            updateBatchTransaction(selectElements, protyle, (e: HTMLElement) => {
                e.style.direction = "ltr";
            });
            event.stopPropagation();
            event.preventDefault();
            return;
        }

        // esc
        if (event.key === "Escape") {
            if (event.repeat) {
                // https://github.com/siyuan-note/siyuan/issues/12989
                const cardElement = hasClosestByClassName(range.startContainer, "card__main", true);
                if (cardElement && document.activeElement && document.activeElement.classList.contains("protyle-wysiwyg")) {
                    (cardElement.querySelector(".card__action:not(.fn__none) button:not([disabled])") as HTMLElement).focus();
                    hideElements(["select"], protyle);
                }
            } else {
                if (!protyle.toolbar.element.classList.contains("fn__none") ||
                    !protyle.hint.element.classList.contains("fn__none") ||
                    !protyle.toolbar.subElement.classList.contains("fn__none")) {
                    hideElements(["toolbar", "hint", "util"], protyle);
                    protyle.hint.enableExtend = false;
                } else if (!window.siyuan.menus.menu.element.classList.contains("fn__none")) {
                    // 防止 ESC 时选中当前块
                    window.siyuan.menus.menu.remove(true);
                } else if (nodeElement.classList.contains("protyle-wysiwyg--select")) {
                    hideElements(["select"], protyle);
                    countBlockWord([], protyle.block.rootID);
                } else {
                    hideElements(["select"], protyle);
                    range.collapse(false);
                    nodeElement.classList.add("protyle-wysiwyg--select");
                    countBlockWord([nodeElement.getAttribute("data-node-id")], protyle.block.rootID);
                }
            }
            event.stopPropagation();
            event.preventDefault();
            return;
        }

        // h1 - h6 hotkey
        if (matchHotKey(window.siyuan.config.keymap.editor.heading.paragraph.custom, event)) {
            const selectsElement = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
            if (selectsElement.length === 0) {
                selectsElement.push(nodeElement);
            }
            if (selectsElement.length > 1) {
                turnsIntoTransaction({
                    protyle,
                    nodeElement: selectsElement[0],
                    type: "Blocks2Ps",
                });
            } else {
                const type = selectsElement[0].getAttribute("data-type");
                if (type === "NodeHeading") {
                    turnsIntoTransaction({
                        protyle,
                        nodeElement: selectsElement[0],
                        type: "Blocks2Ps",
                    });
                } else if (type === "NodeList") {
                    turnsOneInto({
                        protyle,
                        nodeElement: selectsElement[0],
                        id: selectsElement[0].getAttribute("data-node-id"),
                        type: "CancelList",
                    });
                } else if (type === "NodeBlockquote") {
                    turnsOneInto({
                        protyle,
                        nodeElement: selectsElement[0],
                        id: selectsElement[0].getAttribute("data-node-id"),
                        type: "CancelBlockquote",
                    });
                }
            }
            event.preventDefault();
            event.stopPropagation();
            return true;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading1.custom, event)) {
            turnsIntoTransaction({
                protyle,
                nodeElement,
                type: "Blocks2Hs",
                level: 1
            });
            event.preventDefault();
            event.stopPropagation();
            return true;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading2.custom, event)) {
            turnsIntoTransaction({
                protyle,
                nodeElement,
                type: "Blocks2Hs",
                level: 2
            });
            event.preventDefault();
            event.stopPropagation();
            return true;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading3.custom, event)) {
            turnsIntoTransaction({
                protyle,
                nodeElement,
                type: "Blocks2Hs",
                level: 3
            });
            event.preventDefault();
            event.stopPropagation();
            return true;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading4.custom, event)) {
            turnsIntoTransaction({
                protyle,
                nodeElement,
                type: "Blocks2Hs",
                level: 4
            });
            event.preventDefault();
            event.stopPropagation();
            return true;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading5.custom, event)) {
            turnsIntoTransaction({
                protyle,
                nodeElement,
                type: "Blocks2Hs",
                level: 5
            });
            event.preventDefault();
            event.stopPropagation();
            return true;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading6.custom, event)) {
            turnsIntoTransaction({
                protyle,
                nodeElement,
                type: "Blocks2Hs",
                level: 6
            });
            event.preventDefault();
            event.stopPropagation();
            return true;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.insert.code.custom, event) &&
            !["NodeCodeBlock", "NodeHeading", "NodeTable"].includes(nodeElement.getAttribute("data-type"))) {
            const editElement = getContenteditableElement(nodeElement);
            if (editElement) {
                const id = nodeElement.getAttribute("data-node-id");
                const html = nodeElement.outerHTML;
                // 需要 EscapeHTMLStr https://github.com/siyuan-note/siyuan/issues/11451
                editElement.innerHTML = "```" + window.siyuan.storage[Constants.LOCAL_CODELANG] + "\n" + Lute.EscapeHTMLStr(editElement.textContent) + "<wbr>\n```";
                const newHTML = protyle.lute.SpinBlockDOM(nodeElement.outerHTML);
                nodeElement.outerHTML = newHTML;
                const newNodeElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`);
                updateTransaction(protyle, id, newHTML, html);
                highlightRender(newNodeElement);
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
        }

        // toolbar action
        if (matchHotKey(window.siyuan.config.keymap.editor.insert.lastUsed.custom, event)) {
            protyle.toolbar.range = range;
            const selectElements: Element[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
            if (selectText === "" && selectElements.length === 0) {
                selectElements.push(nodeElement);
            }
            fontEvent(protyle, selectElements);
            event.stopPropagation();
            event.preventDefault();
            return;
        }

        if (!nodeElement.classList.contains("code-block") && !event.repeat && !isInEmbedBlock(nodeElement)) {
            let findToolbar = false;
            protyle.options.toolbar.find((menuItem: IMenuItem) => {
                if (!menuItem.hotkey) {
                    return false;
                }
                if (matchHotKey(menuItem.hotkey, event)) {
                    // 设置 lastHTMLs 会导致  protyle.toolbar.range 和 range 不一致，需重置一下 https://github.com/siyuan-note/siyuan/issues/10933
                    protyle.toolbar.range = range;
                    if (["block-ref"].includes(menuItem.name) && protyle.toolbar.range.toString() === "") {
                        return true;
                    }
                    findToolbar = true;
                    if (["a", "block-ref", "inline-math", "inline-memo", "text"].includes(menuItem.name)) {
                        protyle.toolbar.element.querySelector(`[data-type="${menuItem.name}"]`).dispatchEvent(new CustomEvent("click"));
                    } else if (Constants.INLINE_TYPE.includes(menuItem.name)) {
                        protyle.toolbar.setInlineMark(protyle, menuItem.name, "range");
                    } else if (menuItem.click) {
                        menuItem.click(protyle.getInstance());
                    }
                    return true;
                }
            });
            if (findToolbar) {
                event.preventDefault();
                event.stopPropagation();
                protyle.wysiwyg.preventKeyup = true;
                return true;
            }
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.list.outdent.custom, event)) {
            const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
            if (selectElements.length > 0) {
                let isContinuous = true;
                selectElements.forEach((item, index) => {
                    if (item.nextElementSibling && selectElements[index + 1]) {
                        if (selectElements[index + 1] !== item.nextElementSibling) {
                            isContinuous = false;
                        }
                    }
                });
                if (isContinuous &&
                    (selectElements[0].classList.contains("li") || selectElements[0].parentElement.classList.contains("li"))) {
                    listOutdent(protyle, Array.from(selectElements), range);
                }
                event.preventDefault();
                event.stopPropagation();
                return true;
            } else if (nodeElement.parentElement.classList.contains("li") && nodeElement.getAttribute("data-type") !== "NodeCodeBlock") {
                listOutdent(protyle, [nodeElement.parentElement], range);
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.list.indent.custom, event)) {
            const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
            if (selectElements.length > 0) {
                let isContinuous = true;
                selectElements.forEach((item, index) => {
                    if (item.nextElementSibling && selectElements[index + 1]) {
                        if (selectElements[index + 1] !== item.nextElementSibling) {
                            isContinuous = false;
                        }
                    }
                });
                if (isContinuous &&
                    (selectElements[0].classList.contains("li") || selectElements[0].parentElement.classList.contains("li"))) {
                    listIndent(protyle, Array.from(selectElements), range);
                }
                event.preventDefault();
                event.stopPropagation();
                return true;
            } else if (nodeElement.parentElement.classList.contains("li") && nodeElement.getAttribute("data-type") !== "NodeCodeBlock") {
                listIndent(protyle, [nodeElement.parentElement], range);
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
        }
        const isMatchList = matchHotKey(window.siyuan.config.keymap.editor.insert.list.custom, event);
        const isMatchCheck = matchHotKey(window.siyuan.config.keymap.editor.insert.check.custom, event);
        const isMatchOList = matchHotKey(window.siyuan.config.keymap.editor.insert["ordered-list"].custom, event);
        const isMatchQuote = matchHotKey(window.siyuan.config.keymap.editor.insert.quote.custom, event);
        if (isMatchList || isMatchOList || isMatchCheck || isMatchQuote) {
            const selectsElement: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
            if (selectsElement.length === 0) {
                selectsElement.push(nodeElement);
            }
            if (selectsElement.length === 1) {
                const subType = selectsElement[0].dataset.subtype;
                const type = selectsElement[0].dataset.type;
                if (isMatchQuote) {
                    if (["NodeHeading", "NodeParagraph", "NodeList"].includes(type)) {
                        turnsIntoOneTransaction({
                            protyle,
                            selectsElement,
                            type: "Blocks2Blockquote"
                        });
                    } else {
                        protyle.hint.splitChar = "/";
                        protyle.hint.lastIndex = -1;
                        protyle.hint.fill(">" + Lute.Caret, protyle);
                    }
                } else {
                    if (type === "NodeParagraph") {
                        turnsIntoOneTransaction({
                            protyle,
                            selectsElement,
                            type: isMatchCheck ? "Blocks2TLs" : (isMatchList ? "Blocks2ULs" : "Blocks2OLs")
                        });
                    } else if (type === "NodeList") {
                        const id = selectsElement[0].dataset.nodeId;
                        if (subType === "o" && (isMatchList || isMatchCheck)) {
                            turnsOneInto({
                                protyle,
                                nodeElement: selectsElement[0],
                                id,
                                type: isMatchCheck ? "UL2TL" : "OL2UL",
                            });
                        } else if (subType === "t" && (isMatchList || isMatchOList)) {
                            turnsOneInto({
                                protyle,
                                nodeElement: selectsElement[0],
                                id,
                                type: isMatchList ? "TL2UL" : "TL2OL",
                            });
                        } else if (subType === "u" && (isMatchCheck || isMatchOList)) {
                            turnsOneInto({
                                protyle,
                                nodeElement: selectsElement[0],
                                id,
                                type: isMatchCheck ? "OL2TL" : "UL2OL",
                            });
                        }
                    } else {
                        protyle.hint.splitChar = "/";
                        protyle.hint.lastIndex = -1;
                        protyle.hint.fill((isMatchCheck ? "- [ ] " : (isMatchList ? "- " : "1. ")) + Lute.Caret, protyle);
                    }
                }
            } else {
                let isList = false;
                let isContinue = false;
                selectsElement.find((item, index) => {
                    if (item.classList.contains("li")) {
                        isList = true;
                        return true;
                    }
                    if (item.nextElementSibling && selectsElement[index + 1] &&
                        item.nextElementSibling === selectsElement[index + 1]) {
                        isContinue = true;
                    } else if (index !== selectsElement.length - 1) {
                        isContinue = false;
                        return true;
                    }
                });
                if (!isList && isContinue) {
                    turnsIntoOneTransaction({
                        protyle,
                        selectsElement,
                        type: isMatchQuote ? "Blocks2Blockquote" : (isMatchCheck ? "Blocks2TLs" : (isMatchList ? "Blocks2ULs" : "Blocks2OLs"))
                    });
                }
            }
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.insert.table.custom, event)) {
            protyle.hint.splitChar = "/";
            protyle.hint.lastIndex = -1;
            protyle.hint.fill(`| ${Lute.Caret} |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |`, protyle);
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.list.checkToggle.custom, event)) {
            const taskItemElement = hasClosestByAttribute(range.startContainer, "data-subtype", "t");
            if (!taskItemElement) {
                return;
            }
            const html = taskItemElement.outerHTML;
            if (taskItemElement.classList.contains("protyle-task--done")) {
                taskItemElement.querySelector("use").setAttribute("xlink:href", "#iconUncheck");
                taskItemElement.classList.remove("protyle-task--done");
            } else {
                taskItemElement.querySelector("use").setAttribute("xlink:href", "#iconCheck");
                taskItemElement.classList.add("protyle-task--done");
            }
            taskItemElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, taskItemElement.getAttribute("data-node-id"), taskItemElement.outerHTML, html);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.general.insertBefore.custom, event)) {
            // https://github.com/siyuan-note/siyuan/issues/14290#issuecomment-2846594701
            nodeElement.querySelector(".img--select")?.classList.remove("img--select");
            insertEmptyBlock(protyle, "beforebegin");
            event.preventDefault();
            return true;
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.general.insertAfter.custom, event)) {
            nodeElement.querySelector(".img--select")?.classList.remove("img--select");
            insertEmptyBlock(protyle, "afterend");
            event.preventDefault();
            event.stopPropagation();
            return true;
        }
        await jumpToMiddleWare(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        if (matchHotKey(window.siyuan.config.keymap.editor.general.moveToUp.custom, event)) {
            event.preventDefault();
            event.stopPropagation();
            moveToUp(protyle, nodeElement, range);
            return;
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.general.moveToDown.custom, event)) {
            event.preventDefault();
            event.stopPropagation();
            moveToDown(protyle, nodeElement, range);
            return;
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.general.vLayout.custom, event)) {
            event.preventDefault();
            event.stopPropagation();
            const selectsElement: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
            if (selectsElement.length === 1 && selectsElement[0].getAttribute("data-type") === "NodeSuperBlock") {
                if (selectsElement[0].getAttribute("data-sb-layout") === "col") {
                    const oldHTML = selectsElement[0].outerHTML;
                    selectsElement[0].setAttribute("data-sb-layout", "row");
                    selectsElement[0].setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                    updateTransaction(protyle, selectsElement[0].getAttribute("data-node-id"), selectsElement[0].outerHTML, oldHTML);
                } else {
                    range.insertNode(document.createElement("wbr"));
                    const sbData = await cancelSB(protyle, selectsElement[0]);
                    transaction(protyle, sbData.doOperations, sbData.undoOperations);
                    focusByWbr(protyle.wysiwyg.element, range);
                }
                return;
            }
            if (selectsElement.length < 2 || selectsElement[0]?.classList.contains("li")) {
                return;
            }
            turnsIntoOneTransaction({
                protyle, selectsElement,
                type: "BlocksMergeSuperBlock",
                level: "row"
            });
            return;
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.general.hLayout.custom, event)) {
            event.preventDefault();
            event.stopPropagation();
            const selectsElement: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
            if (selectsElement.length === 1 && selectsElement[0].getAttribute("data-type") === "NodeSuperBlock") {
                if (selectsElement[0].getAttribute("data-sb-layout") === "row") {
                    const oldHTML = selectsElement[0].outerHTML;
                    selectsElement[0].setAttribute("data-sb-layout", "col");
                    selectsElement[0].setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                    updateTransaction(protyle, selectsElement[0].getAttribute("data-node-id"), selectsElement[0].outerHTML, oldHTML);
                } else {
                    range.insertNode(document.createElement("wbr"));
                    const sbData = await cancelSB(protyle, selectsElement[0]);
                    transaction(protyle, sbData.doOperations, sbData.undoOperations);
                    focusByWbr(protyle.wysiwyg.element, range);
                }
                return;
            }
            if (selectsElement.length < 2 || selectsElement[0]?.classList.contains("li")) {
                return;
            }
            turnsIntoOneTransaction({
                protyle, selectsElement,
                type: "BlocksMergeSuperBlock",
                level: "col"
            });
            return;
        }

        if (!event.repeat && matchHotKey(window.siyuan.config.keymap.editor.general.ai.custom, event)) {
            event.preventDefault();
            event.stopPropagation();
            let selectsElement: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
            if (selectsElement.length === 0) {
                selectsElement = [nodeElement];
            }
            openAIActionsMenu(selectsElement, protyle);
            return;
        }

        if (!event.repeat && matchHotKey(window.siyuan.config.keymap.editor.general.aiWriting.custom, event)) {
            event.preventDefault();
            event.stopPropagation();
            AIChat(protyle, nodeElement);
            return;
        }

        if (!event.repeat && matchHotKey(window.siyuan.config.keymap.editor.general.openInNewTab.custom, event)) {
            event.preventDefault();
            event.stopPropagation();
            const blockPanel = window.siyuan.blockPanels.find(item => {
                if (item.element.contains(nodeElement)) {
                    return true;
                }
            });
            const id = nodeElement.getAttribute("data-node-id");
            checkFold(id, (zoomIn, action) => {
                openFileById({
                    app: protyle.app,
                    id,
                    action,
                    zoomIn,
                    openNewTab: true
                });
                blockPanel.destroy();
            });
            return;
        }

        // tab 需等待 list 和 table 处理完成
        await tabKeyMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) { return }

        if (event.key === "ContextMenu") {
            const rangePosition = getSelectionPosition(nodeElement, range);
            protyle.wysiwyg.element.dispatchEvent(new CustomEvent("contextmenu", {
                detail: {
                    target: nodeElement,
                    y: rangePosition.top + 8,
                    x: rangePosition.left
                }
            }));
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        /// #if !MOBILE
        const refElement = hasClosestByAttribute(range.startContainer, "data-type", "block-ref");
        if (refElement) {
            const id = refElement.getAttribute("data-id");
            if (matchHotKey(window.siyuan.config.keymap.editor.general.openBy.custom, event)) {
                checkFold(id, (zoomIn, action, isRoot) => {
                    if (!isRoot) {
                        action.push(Constants.CB_GET_HL);
                    }
                    openFileById({
                        app: protyle.app,
                        id,
                        action,
                        zoomIn
                    });
                });
                event.preventDefault();
                event.stopPropagation();
                return true;
            } else if (matchHotKey(window.siyuan.config.keymap.editor.general.refTab.custom, event)) {
                // 打开块引和编辑器中引用、反链、书签中点击事件需保持一致，都加载上下文
                checkFold(id, (zoomIn) => {
                    openFileById({
                        app: protyle.app,
                        id,
                        action: zoomIn ? [Constants.CB_GET_HL, Constants.CB_GET_ALL] : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL],
                        keepCursor: true,
                        zoomIn
                    });
                });
                event.preventDefault();
                event.stopPropagation();
                return true;
            } else if (matchHotKey(window.siyuan.config.keymap.editor.general.insertRight.custom, event)) {
                checkFold(id, (zoomIn, action, isRoot) => {
                    if (!isRoot) {
                        action.push(Constants.CB_GET_HL);
                    }
                    openFileById({
                        app: protyle.app,
                        id,
                        position: "right",
                        action,
                        zoomIn
                    });
                });
                event.preventDefault();
                event.stopPropagation();
                return true;
            } else if (matchHotKey(window.siyuan.config.keymap.editor.general.insertBottom.custom, event)) {
                checkFold(id, (zoomIn, action, isRoot) => {
                    if (!isRoot) {
                        action.push(Constants.CB_GET_HL);
                    }
                    openFileById({
                        app: protyle.app,
                        id,
                        position: "bottom",
                        action,
                        zoomIn
                    });
                });
                event.preventDefault();
                event.stopPropagation();
                return true;
            } else if (matchHotKey(window.siyuan.config.keymap.editor.general.refPopover.custom, event)) {
                // open popover
                window.siyuan.blockPanels.push(new BlockPanel({
                    app: protyle.app,
                    isBacklink: false,
                    targetElement: refElement,
                    refDefs: [{ refID: id }]
                }));
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
        }
        /// #endif

        if (matchHotKey("⇧⌘V", event)) {
            event.returnValue = false;
            event.preventDefault();
            event.stopPropagation();
            pasteAsPlainText(protyle);
            return;
        }

        /// #if !BROWSER
        if (matchHotKey(window.siyuan.config.keymap.editor.general.showInFolder.custom, event)) {
            const aElement = hasClosestByAttribute(range.startContainer, "data-type", "a");
            if (aElement) {
                const linkAddress = aElement.getAttribute("data-href");
                if (isLocalPath(linkAddress)) {
                    openBy(linkAddress, "folder");
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
            return;
        }
        /// #endif
        //打开外部链接或者素材链接
        await openByMiddleWare(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        // 和自定义 alt+shift+左/右 冲突，降低优先级  https://github.com/siyuan-note/siyuan/issues/14638
        await arrowLeftRightMiddleWare(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        // 置于最后，太多快捷键会使用到选中元素
        removeSelectIndicatorElementMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        //工具条中的各种装饰元素快捷键不应该唤出工具条
        decorationMatchMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        //最后一步不再需要检查控制器是否已经取消
        return
    });
};
