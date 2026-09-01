import { isNotCtrl, updateHotkeyTip } from "../util/compatibility";
import {
    focusBlock,
    focusByRange,
    getBlockElementsByRange,
    getBlockRanges,
    getEditorRange,
    getSelectionOffset,
    getSelectionPosition,
    getUndoFocusContext,
    restoreFocusContext,
    selectAll,
} from "../util/selection";
import {selectTextToEditorBoundary} from "../util/selectionBoundary";
import {hasUnloadedDocumentBlocks} from "../util/documentRange";
import {
    hasClosestBlock,
    hasClosestByAttribute,
    hasClosestByClassName,
    hasClosestByTag,
    isInEmbedBlock,
} from "../util/hasClosest";
// S-forge: keydown 逻辑已重构拆分为多个中间件模块
import { Constants } from "../../constants";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { avPanelGuard, htmlBlockGuardRgistyItem, inputElementGuard, protyleDisabledGuard, protyleHaveSelectedGuard } from "./keydown.guards";
import { hideProtyleToolbarMiddleware, hideProtyleUtilMiddleware, setProtyleWysiwygPreventKeyupMiddleware } from "./keydown.middlewares";
import { handleSelectedBlockInsertKeyMiddleware, removeSelectIndicatorElementMiddleware, selectAllMiddleware } from "./keydown.select";
import { decorationMatchMiddleware } from "./keydown.decorations";
import { arrowLeftRightMiddleWare, arrowUpDownMiddleware } from "./keydown.arrow.select";
import { openByMiddleWare, openInNewTabMiddleware, openLocalMiddleWare } from "./keydown.openBy";
import { jumpToMiddleWare } from "./keydown.jump";
import { deleteKeyMiddleware } from "./keydown.delete";
import { altEnterMiddleware } from "./keydown.altEnter";
import { tabKeyMiddleware } from "./keydown.tab";
import { enterKeyMiddleware, softEnterMiddleware } from "./keydown.enter";
import { arrowNavigationMiddleware } from "./keydown.arrow.navigation";
import { contextMenuMiddleware, inlineMenuMiddleware } from "./keydown.menus";
import { headingTransformMiddleware } from "./keydown.headingTransform";
import { blockRefMiddleware } from "./keydown.blockRef";
import { foldHotkeyMiddleware } from "./keydown.hotkey.fold";
import { pasteAsPlainTextMiddleware } from "./keydown.paste";
import { aiActionsMiddleware, aiWritingMiddleware } from "./keydown.ai";
import { listUnifiedMiddleware } from "./keydown.list/unified";
import { expandSelectMiddleware } from "./keydown.expandSelect";
import { formatMiddleware } from "./keydown.format";
import { escapeKeyMiddleware } from "./keydown.escape";
import { toolbarHotkeyMiddleware, toolbarLastUsedMiddleware } from "./keydown.toolbarHotkey";
import { moveToDownMiddleware, moveToUpMiddleware } from "./keydown.move";
import { handleHLayoutMiddleware, handleVLayoutMiddleware } from "./keydown.superBlock";
import { handleCodeBlockCreation } from "./keydown.codeBlock";
import { handleTableBlockCreation } from "./keydow.table";
import { createNamedNewFileMiddleware, createNewFileByContentMiddleware } from "./keydown.createNewFile";
import { insertAfterMiddleWare, insertBeforeMiddleWare } from "./keydown.insert";
import { attrMiddleware, renameMiddleware } from "./keydown.attr";
import { copyTextMiddleware } from "./keydown.copy";
import { insertWbrMiddleware } from "./keydown.wbr";
import { crossBlockCopyMiddleware } from "./keydown.crossBlock";
import { pageNavigationMiddleware } from "./keydown.pageNavigation";
import { hideHintMiddleware, hintNavigationMiddleware, hintSlashMiddleware } from "./keydown.slashHint";
import { redoMiddleware, undoMiddleware } from "./keydown.editorStack";
import { commonHotkeyMiddleware } from "./keydown.commonHotkey";
import { fixTableMiddleware } from "./keydown.table";
import { superBlockSelectMiddleware } from "./keydown.superBlockSelect";
import { 处理块进入聚焦, 处理块退出聚焦 } from "./keydown.focus";
import { commonInputMiddleware } from "./keydown.commonInput";
import { matchHotKey } from "../util/hotKey";
import {checkFold} from "../../block/fold/checkFold";
import { openFileById } from "../../editor/utils.openFileById";
import { BlockPanel } from "../../block/panel/Panel";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isMobile } from "../../platform";
import { foldBlocksRecursively, foldHeadingGroup, getFoldBlock } from "../util/blockFold";
import { onlyProtyleCommand } from "../../boot/globalEvent/command/protyle";
import {hideElements} from "../ui/hideElements";
import {
    getContenteditableElement,
    getFirstBlock,
    getLastBlock,
    getNextBlock,
    getNextBlockSibling,
    getPreviousBlock,
    hasNextSibling,
    hasPreviousSibling,
} from "./getBlock";
import {turnsIntoTransaction} from "./transaction/turns/multiple";
import {isEmptyParagraph, turnEmptyParagraphsIntoTransaction} from "./transaction/transforms/emptyParagraph";
import {turnsIntoGroupsTransaction} from "./transaction/transforms/groups";
import { listIndent, listOutdent } from "./list";
import {formatPainter} from "../toolbar/FormatPainter";
import {applyTableCellStyleHotkey} from "../toolbar/tableCell";
import {isIncludeCell} from "../util/table/selection/geometry";
import {insertEmptySuperBlockColumn} from "../../block/util";
import {getAVTemplateInteractiveElement} from "../render/av/attributeValue";
import {focusAVByArrow} from "../render/av/focus";
import { countSelectWord } from "../runtime/status.port";
import { showMessage, hideMessage } from "../../dialog/message";
import { fetchPost } from "../../util/network/fetch";
/** 保留历史公开入口，并静态导出内容转换子域的同一函数身份。 */
export {getContentByInlineHTML} from "./keydown/content/getContentByInlineHTML";

let selectAllTipShown = false;

const showSelectAllTip = () => {
    if (selectAllTipShown || window.siyuan.config.appearance.notifications?.selectAllTip === false) {
        return;
    }
    const messageId = showMessage(`<div class="fn__flex fn__flex-wrap">
<span class="fn__flex-center">${window.siyuan.languages.selectAllTip.replace("${hotkey}", updateHotkeyTip("⌘A"))}</span>
<span class="fn__space"></span>
<button type="button" class="b3-button b3-button--white">${window.siyuan.languages.doNotRemindAgain}</button>
</div>`, 0, "info", "selectAllTip");
    if (!messageId) {
        return;
    }
    selectAllTipShown = true;
    document.querySelector(`#message [data-id="${messageId}"] button`)?.addEventListener("click", () => {
        hideMessage(messageId);
        fetchPost("/api/setting/setAppearance", {
            ...window.siyuan.config.appearance,
            notifications: {
                ...window.siyuan.config.appearance.notifications,
                selectAllTip: false,
            }
        });
    });
};

const showSelectAllIncompleteTip = () => {
    if (window.siyuan.config.appearance.notifications?.selectAllIncompleteTip === false) {
        return;
    }
    showMessage(window.siyuan.languages.selectAllIncompleteTip, 6000, "info", "selectAllIncompleteTip");
};

const getAdjacentInlineMath = (range: Range, editableElement: Element, previous: boolean): HTMLElement | undefined => {
    if (range.startContainer !== editableElement && !editableElement.contains(range.startContainer)) {
        return;
    }

    let currentNode: Node | null = range.startContainer;
    let adjacentNode: Node | false;
    if (currentNode.nodeType === Node.TEXT_NODE) {
        const text = currentNode.textContent || "";
        const adjacentText = previous ? text.substring(0, range.startOffset) : text.substring(range.startOffset);
        if (adjacentText.split(Constants.ZWSP).join("") !== "") {
            return;
        }
        adjacentNode = previous ? hasPreviousSibling(currentNode) : hasNextSibling(currentNode);
    } else {
        adjacentNode = currentNode.childNodes[previous ? range.startOffset - 1 : range.startOffset] || false;
    }

    while (currentNode) {
        while (adjacentNode &&
            ((adjacentNode.nodeType === Node.TEXT_NODE &&
                (adjacentNode.textContent || "").split(Constants.ZWSP).join("") === "") ||
                (adjacentNode.nodeType === Node.ELEMENT_NODE && (adjacentNode as Element).tagName === "WBR"))) {
            adjacentNode = previous ? hasPreviousSibling(adjacentNode) : hasNextSibling(adjacentNode);
        }
        if (adjacentNode) {
            if (adjacentNode.nodeType === Node.ELEMENT_NODE &&
                (adjacentNode as Element).matches("[data-type~='inline-math']")) {
                return adjacentNode as HTMLElement;
            }
            return;
        }
        if (currentNode === editableElement) {
            return;
        }
        currentNode = currentNode.parentNode;
        if (currentNode) {
            adjacentNode = previous ? hasPreviousSibling(currentNode) : hasNextSibling(currentNode);
        }
    }
};

const getRangeListItemElements = (editorElement: HTMLElement, range: Range) => {
    const listItemElements: HTMLElement[] = [];
    const blockRanges = getBlockRanges(editorElement, range);
    for (const blockRange of blockRanges) {
        const listItemElement = blockRange.blockElement.closest<HTMLElement>('[data-type="NodeListItem"]');
        if (!listItemElement || !editorElement.contains(listItemElement)) {
            return [];
        }
        if (!listItemElements.includes(listItemElement)) {
            listItemElements.push(listItemElement);
        }
    }
    if (listItemElements.length < 2) {
        return [];
    }
    const listElement = listItemElements[0].parentElement;
    if (listItemElements.some((item, index) => item.parentElement !== listElement ||
        index > 0 && item.previousElementSibling !== listItemElements[index - 1])) {
        return [];
    }
    return listItemElements;
};

export const keydown = (protyle: IProtyle, editorElement: HTMLElement) => {
    //@ts-ignore
    editorElement.addEventListener("keydown", async (event: KeyboardEvent & { target: HTMLElement }) => {
        // S-forge: 开始 - 事件中间件系统，使用AbortController实现可中断的键盘事件处理
        const controller: AbortController = new AbortController();
        const rawAbort = controller.abort;
        controller.abort = (reason: string) => {
            console.log(reason);
            if (!reason) {
                console.error("键盘事件取消未给出原因,检查代码实现");
            }
            rawAbort.bind(controller)(reason);
        };
        const signal = controller.signal;
        //中间件函数不传入控制器
        if (!protyle.wysiwyg) {
            console.error(protyle);
            throw (new Error("protyle结构错误"));
        }
        // S-forge: 结束

        // 上游合并：属性视图模板交互元素与 AV 搜索框内的按键不进入编辑器快捷键处理
        if (getAVTemplateInteractiveElement(event.target)) {
            event.stopPropagation();
            return;
        }
        if (hasClosestByAttribute(event.target, "data-type", "av-search")) {
            if (matchHotKey("⌘A", event)) {
                event.preventDefault();
                getSelection().getRangeAt(0).selectNodeContents(event.target);
            }
            event.stopPropagation();
            return;
        }
        // 撤销/重做快捷键始终阻止浏览器默认行为（上游合并）
        if (matchHotKey(Constants.SIYUAN_KEYMAP.editor.general.undo.default, event) ||
            matchHotKey(Constants.SIYUAN_KEYMAP.editor.general.redo.default, event)) {
            event.preventDefault();
        }

        const range = getEditorRange(protyle.wysiwyg.element);
        const nodeElement = hasClosestBlock(range.startContainer);
        if (!nodeElement) {
            throw (new Error("未能找到块元素"));
        }
        const eventState: Record<string, string> = {
            blockType: ""
        };
        if (event.target.localName === "protyle-html") {
            eventState.blockType = "NodeHTMLBlock";
            eventState.elementTarget = "protyle-html";
        }
        if (event.target.localName === "input") {
            eventState.blockType = nodeElement.getAttribute("data-type") || "";
        }
        const history: string[] = [];
        let currentItem = { handle: async () => { }, describe: "" };
        const eventDriver = {
            abort: (reason: string) => controller.abort(`中止处理${currentItem.describe}:${reason}\n\n${history.join("")}\n\n${new Error().stack?.replace("Error", "")}`),
            stop: (reason: string) => {
                event.stopPropagation(); console.log(`停止冒泡:${currentItem.describe}:${reason}\n\n${new Error().stack?.replace("Error", "")}`);
            },
            prevent: (reason: string) => {
                event.preventDefault(); console.log(`阻止原生事件:${currentItem.describe}:${reason}\n\n${new Error().stack?.replace("Error", "")}`);
            },
        };
        const createHandleWithRecord = (item: any) => {
            return async (
                event: KeyboardEvent,
                protyle: IProtyle,
                nodeElement: HTMLElement,
                range: Range,
            ) => {
                history.push(item.describe);
                await item.handle(event, protyle, nodeElement, range, eventDriver);
            };
        };
        const executeItem = async (item: any) => {
            currentItem = item;
            let flag = true;
            for await (const [key, flagValue] of Object.entries(eventState)) {
                const conditionValue = item.conditions[key];
                if (!(conditionValue === undefined || conditionValue === flagValue)) {
                    flag = false;
                }
            }
            flag && await createHandleWithRecord(currentItem)(event, protyle, nodeElement, range);
        };
        const editorContext = { event, protyle, nodeElement, range, controller };
        //守卫函数传入控制器但是不要修改状态
        //currentItem = htmlBlockGuardRgistyItem
        //eventState.blockType === htmlBlockGuardRgistyItem.condition.blockType && await createHandleWithRecord(htmlBlockGuardRgistyItem)(event, protyle, nodeElement, range)
        await executeItem(htmlBlockGuardRgistyItem);
        if (signal.aborted) {
            return;
        }
        //当在input元素中输入时
        (event.target?.localName === "input") ? await inputElementGuard(editorContext) : null;
        if (signal.aborted) {
            return;
        }
        protyle.disabled ? await protyleDisabledGuard(event, protyle, nodeElement, range, controller) : null;
        if (signal.aborted) {
            return;
        }
        (!protyle.selectElement?.classList.contains("fn__none")) ? await protyleHaveSelectedGuard(event, protyle, nodeElement, range, controller) : null;
        if (signal.aborted) {
            return;
        }
        await setProtyleWysiwygPreventKeyupMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await hideProtyleUtilMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await hideProtyleToolbarMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await crossBlockCopyMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        if (document.querySelector(".av__panel")) {
            controller.abort("属性视图面板已打开");
        }
        if (signal.aborted) {
            return;
        }
        await avPanelGuard(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        //选中块状态下插入新的块
        await handleSelectedBlockInsertKeyMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        if (event.isComposing) {
            event.stopPropagation();
            controller.abort("输入法处理中");
        }
        if (signal.aborted) {
            return;
        }
        // https://github.com/siyuan-note/siyuan/issues/2261
        await hintSlashMiddleware(editorContext);
        if (signal.aborted) {
            return;
        }
        // 有可能输入 shift+. ，因此需要使用 event.key 来进行判断
        await insertWbrMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        if (!getSiyuanGlobalMenus().menu.element.classList.contains("fn__none") &&
            (["←", "↑", "→", "↓"].includes(Constants.KEYCODELIST[event.keyCode] || "") || Constants.KEYCODELIST[event.keyCode] === "↩") &&
            !event.altKey && !event.shiftKey && isNotCtrl(event)) {
            event.preventDefault();
            return;
        } else if (event.key !== "Escape") {
            getSiyuanGlobalMenus().menu.remove();
        }
        if (!["Alt", "Meta", "Shift", "Control", "CapsLock", "Escape"].includes(event.key) && protyle.options.render!.breadcrumb) {
            protyle.breadcrumb?.hide();
        }
        await arrowUpDownMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        // 仅处理以下快捷键操作
        await commonInputMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await foldHotkeyMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await expandSelectMiddleware(event, protyle, nodeElement, editorElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await 处理块进入聚焦(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await 处理块退出聚焦(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await superBlockSelectMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }


        // 折叠子标题（上游合并）
        if (matchHotKey(window.siyuan.config.keymap.editor.general.foldChildHeadings.custom, event) && !event.repeat) {
            getFoldBlock(protyle, nodeElement, (elements) => {
                foldHeadingGroup(protyle, elements[0], "children");
            });
            hideElements(["gutter"], protyle);
            event.stopPropagation();
            event.preventDefault();
            return;
        }

        // 折叠同级标题（上游合并）
        if (matchHotKey(window.siyuan.config.keymap.editor.general.foldSiblingHeadings.custom, event) && !event.repeat) {
            getFoldBlock(protyle, nodeElement, (elements) => {
                foldHeadingGroup(protyle, elements[0], "siblings");
            });
            hideElements(["gutter"], protyle);
            event.stopPropagation();
            event.preventDefault();
            return;
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.general.foldRecursive.custom, event) && !event.repeat) {
            getFoldBlock(protyle, nodeElement, (elements) => {
                foldBlocksRecursively(protyle, elements);
            });
            event.stopPropagation();
            event.preventDefault();
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

        // https://github.com/siyuan-note/siyuan/issues/11726
        await hideHintMiddleware(editorContext);
        if (signal.aborted) {
            return;
        }
        // 选区扩展到页首/页尾（上游合并）
        let selectToPageStart: boolean | undefined;
        if (matchHotKey(window.siyuan.config.keymap.editor.general.selectToPageStart.custom, event)) {
            selectToPageStart = true;
        } else if (matchHotKey(window.siyuan.config.keymap.editor.general.selectToPageEnd.custom, event)) {
            selectToPageStart = false;
        }
        if (selectToPageStart !== undefined) {
            hideElements(["hint", "select"], protyle);
            const selectedRange = selectTextToEditorBoundary(protyle.wysiwyg.element, selectToPageStart);
            if (selectedRange) {
                if (selectToPageStart) {
                    protyle.wysiwyg.element.firstElementChild?.scrollIntoView();
                } else {
                    protyle.wysiwyg.element.lastElementChild?.scrollIntoView(false);
                }
                protyle.toolbar.render(protyle, selectedRange);
                countSelectWord(selectedRange, protyle.block.rootID);
            }
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        await pageNavigationMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        // hint: 上下、回车选择
        await hintNavigationMiddleware(editorContext);
        if (signal.aborted) {
            return;
        }
        //行内元素菜单和块菜单
        await inlineMenuMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await fixTableMiddleware(editorContext);
        if (signal.aborted) {
            return;
        }
        // 上下左右光标移动：先处理上游新增行为，未命中时交由箭头导航中间件
        if (!event.altKey && !event.shiftKey && isNotCtrl(event) && !event.isComposing && (event.key.indexOf("Arrow") > -1)) {
            const tdElementNav = hasClosestByTag(range.startContainer, "TD") || hasClosestByTag(range.startContainer, "TH");
            const navEditableElement = (tdElementNav || getContenteditableElement(nodeElement) || nodeElement) as HTMLElement;
            // 光标移向相邻行内公式时直接打开编辑框 https://github.com/siyuan-note/siyuan/issues/14938
            const inlineMathElement = range.collapsed && (event.key === "ArrowLeft" || event.key === "ArrowRight") ?
                getAdjacentInlineMath(range, navEditableElement, event.key === "ArrowLeft") : undefined;
            if (inlineMathElement) {
                event.stopPropagation();
                event.preventDefault();
                range.selectNode(inlineMathElement);
                protyle.toolbar.range = range;
                focusByRange(range);
                protyle.toolbar.showRender(protyle, inlineMathElement);
                return;
            }
            const navPosition = getSelectionOffset(navEditableElement, protyle.wysiwyg.element, range);
            if (nodeElement.classList.contains("code-block") && navPosition.end === navEditableElement.innerText.length) {
                // 代码块换最后一个 /n 肉眼是无法区分是否在其后的，因此统一在之前
                navPosition.end -= 1;

            }
            const navSelectionPosition = getSelectionPosition(navEditableElement, range);
            const isFirstLine = (navEditableElement.innerText.substr(0, navPosition.end).indexOf("\n") === -1 ||
                navPosition.start === 0) &&
                navSelectionPosition.top - navEditableElement.getBoundingClientRect().top < 20;
            const isLastLine = (navEditableElement.innerText.substr(navPosition.end).indexOf("\n") === -1 ||
                navPosition.end >= navEditableElement.innerText.trimEnd().length) &&
                navEditableElement.getBoundingClientRect().bottom - navSelectionPosition.top < 40;
            const isStart = navPosition.start === 0;
            const isEnd = navPosition.end >= navEditableElement.textContent.replace(/\n$/, "").length;
            const toPrevious = (event.key === "ArrowUp" && isFirstLine) ||
                (event.key === "ArrowLeft" && isStart);
            const toNext = (event.key === "ArrowDown" && isLastLine) ||
                (event.key === "ArrowRight" && isEnd);
            if (range.toString() === "" && range.collapsed && !nodeElement.classList.contains("av") &&
                hasClosestByClassName(range.startContainer, "av__title") && (toPrevious || toNext) &&
                focusAVByArrow(protyle, nodeElement, event.key, true)) {
                event.stopPropagation();
                event.preventDefault();
                return;
            }
            if (range.toString() === "" && range.collapsed && !nodeElement.classList.contains("av")) {
                let adjacentElement = toPrevious ? getPreviousBlock(nodeElement) as HTMLElement :
                    (toNext ? getNextBlock(nodeElement) as HTMLElement : undefined);
                if (adjacentElement) {
                    adjacentElement = (toPrevious ? getLastBlock(adjacentElement) : getFirstBlock(adjacentElement)) as HTMLElement;
                    // 显式聚焦空段落，避免浏览器跨越容器边界时跳过该块 https://github.com/siyuan-note/siyuan/issues/18862
                    if ((event.key === "ArrowUp" || event.key === "ArrowDown") && isEmptyParagraph(adjacentElement)) {
                        focusBlock(adjacentElement, undefined, event.key === "ArrowDown");
                        event.stopPropagation();
                        event.preventDefault();
                        return;
                    }
                    if (adjacentElement.classList.contains("av") &&
                        focusAVByArrow(protyle, adjacentElement as HTMLElement, event.key)) {
                        event.stopPropagation();
                        event.preventDefault();
                        return;
                    }
                }
            }
        }
        await arrowNavigationMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }

        const nodeType = nodeElement.getAttribute("data-type") || "";
        const selectText = range.toString();
        const endElement = hasClosestBlock(range.endContainer);
        const isCrossBlock = !!endElement && nodeElement !== endElement;
        // 跨块选择时将所选块整体转换为段落/标题（上游合并）
        const turnCrossBlockRangeInto = (type: TTurnInto, level?: number) => {
            if (!isCrossBlock || selectText === "") {
                return false;
            }
            const selectsElement = getBlockElementsByRange(range);
            if (selectsElement.length < 2 || selectsElement.some(item => item.classList.contains("li"))) {
                return false;
            }
            const focusContext = getUndoFocusContext(protyle.wysiwyg.element, range, true);
            turnsIntoTransaction({
                protyle,
                selectsElement,
                type,
                level,
                unfocus: true,
            });
            if (focusContext) {
                restoreFocusContext(protyle, focusContext);
            }
            event.preventDefault();
            event.stopPropagation();
            return true;
        };

        await deleteKeyMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        // 软换行
        await softEnterMiddleware(editorContext);
        if (signal.aborted) {
            return;
        }
        // 代码块语言选择 https://github.com/siyuan-note/siyuan/issues/14126
        await altEnterMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        // 全选：含"已全部选中"与"存在未加载块"提示（上游合并）
        if (matchHotKey("⌘A", event)) {
            event.preventDefault();
            const selectedCurrentContent = selectAll(protyle, nodeElement, range);
            if (selectedCurrentContent && !protyle.lite &&
                !nodeElement.classList.contains("code-block") && !isMobile) {
                showSelectAllTip();
            } else if (!selectedCurrentContent && hasUnloadedDocumentBlocks(
                protyle.wysiwyg.element,
                !protyle.lite && !protyle.block.showAll && protyle.block.scroll && !protyle.options.backlinkData
            )) {
                showSelectAllIncompleteTip();
            }
            return true;
        }
        await selectAllMiddleware(editorContext);
        if (signal.aborted) {
            return;
        }
        await undoMiddleware(editorContext);
        if (signal.aborted) {
            return;
        }
        await redoMiddleware(editorContext);
        if (signal.aborted) {
            return;
        }
        if (!isMobile) {
            await commonHotkeyMiddleware(editorContext);
            if (signal.aborted) {
                return;
            }
        }
        await copyTextMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await attrMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await renameMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await createNamedNewFileMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await createNewFileByContentMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await formatMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        // 格式刷激活时 Escape 仅退出格式刷（上游合并）
        if (event.key === "Escape" && formatPainter.deactivate()) {
            event.stopPropagation();
            event.preventDefault();
            return true;
        }
        await escapeKeyMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        // h1 - h6 与段落：跨块选择时优先整体转换（上游合并）
        if (matchHotKey(window.siyuan.config.keymap.editor.heading.paragraph.custom, event)) {
            if (turnCrossBlockRangeInto("Blocks2Ps")) {
                return true;
            }
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading1.custom, event)) {
            if (turnCrossBlockRangeInto("Blocks2Hs", 1)) {
                return true;
            }
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading2.custom, event)) {
            if (turnCrossBlockRangeInto("Blocks2Hs", 2)) {
                return true;
            }
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading3.custom, event)) {
            if (turnCrossBlockRangeInto("Blocks2Hs", 3)) {
                return true;
            }
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading4.custom, event)) {
            if (turnCrossBlockRangeInto("Blocks2Hs", 4)) {
                return true;
            }
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading5.custom, event)) {
            if (turnCrossBlockRangeInto("Blocks2Hs", 5)) {
                return true;
            }
        }
        if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading6.custom, event)) {
            if (turnCrossBlockRangeInto("Blocks2Hs", 6)) {
                return true;
            }
        }
        // h1 - h6 hotkey
        await headingTransformMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        // 空段落按插入代码块键时直接转换为代码块（上游合并）
        if (matchHotKey(window.siyuan.config.keymap.editor.insert.code.custom, event) &&
            !["NodeCodeBlock", "NodeHeading", "NodeTable"].includes(nodeType) &&
            !isInEmbedBlock(nodeElement)) {
            if (isEmptyParagraph(nodeElement)) {
                turnEmptyParagraphsIntoTransaction({
                    protyle,
                    nodeElements: [nodeElement],
                    type: "code",
                });
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
        }
        await handleCodeBlockCreation(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }

        // toolbar action
        // 表格框选状态下样式快捷键直接作用于选中单元格（上游合并）
        const tableSelectElement = nodeType === "NodeTable" ?
            nodeElement.querySelector(".table__select") as HTMLElement : undefined;
        if (tableSelectElement && tableSelectElement.clientHeight > 0) {
            const selectedCellElements: HTMLTableCellElement[] = [];
            const tableScrollLeft = nodeElement.firstElementChild?.scrollLeft || 0;
            const tableElement = nodeElement.querySelector("table");
            const tableScrollTop = tableElement ? tableElement.scrollTop : 0;
            nodeElement.querySelectorAll("th, td").forEach((item: HTMLTableCellElement) => {
                if (!item.classList.contains("fn__none") && isIncludeCell({
                    tableSelectElement,
                    scrollLeft: tableScrollLeft,
                    scrollTop: tableScrollTop,
                    item,
                })) {
                    selectedCellElements.push(item);
                }
            });
            if (applyTableCellStyleHotkey(protyle, selectedCellElements, event, () => {
                tableSelectElement.removeAttribute("style");
            })) {
                protyle.wysiwyg.preventKeyup = true;
                return true;
            }
        }
        await toolbarLastUsedMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await toolbarHotkeyMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        // 跨块范围的列表缩进/反缩进与分组转换（上游合并），其余情况交由统一列表中间件处理
        const isListOutdent = matchHotKey(window.siyuan.config.keymap.editor.list.outdent.custom, event);
        const isListIndent = matchHotKey(window.siyuan.config.keymap.editor.list.indent.custom, event);
        const hasSelectedElements = protyle.wysiwyg.element.querySelector(".protyle-wysiwyg--select");
        const rangeListItemElements = !hasSelectedElements && (isListOutdent || isListIndent) && isCrossBlock && selectText !== "" ?
            getRangeListItemElements(protyle.wysiwyg.element, range) : [];
        const rangeListItemFocusContext = rangeListItemElements.length > 0 ?
            getUndoFocusContext(protyle.wysiwyg.element, range, true) : undefined;
        if (rangeListItemElements.length > 0 && (isListOutdent || isListIndent)) {
            event.preventDefault();
            event.stopPropagation();
            if (isListOutdent) {
                await listOutdent(protyle, rangeListItemElements, range);
            } else {
                await listIndent(protyle, rangeListItemElements, range);
            }
            if (rangeListItemFocusContext) {
                restoreFocusContext(protyle, rangeListItemFocusContext);
            }
            return true;
        }
        const isMatchList = matchHotKey(window.siyuan.config.keymap.editor.insert.list.custom, event);
        const isMatchCheck = matchHotKey(window.siyuan.config.keymap.editor.insert.check.custom, event);
        const isMatchOList = matchHotKey(window.siyuan.config.keymap.editor.insert["ordered-list"].custom, event);
        const isMatchQuote = matchHotKey(window.siyuan.config.keymap.editor.insert.quote.custom, event);
        if ((isMatchList || isMatchOList || isMatchCheck || isMatchQuote) && !hasSelectedElements &&
            !isInEmbedBlock(nodeElement) && isCrossBlock && selectText !== "") {
            const rangeElements = getBlockElementsByRange(range);
            if (rangeElements.length > 1 && !rangeElements.some(item => item.classList.contains("li"))) {
                const rangeElementGroups: Element[][] = [];
                rangeElements.forEach(item => {
                    const group = rangeElementGroups[rangeElementGroups.length - 1];
                    const previousElement = group?.[group.length - 1];
                    if (previousElement?.parentElement === item.parentElement &&
                        getNextBlockSibling(previousElement) === item) {
                        group.push(item);
                    } else {
                        rangeElementGroups.push([item]);
                    }
                });
                const focusContext = getUndoFocusContext(protyle.wysiwyg.element, range, true);
                event.preventDefault();
                event.stopPropagation();
                await turnsIntoGroupsTransaction({
                    protyle,
                    selectsElementGroups: rangeElementGroups,
                    type: isMatchQuote ? "Blocks2Blockquote" :
                        (isMatchCheck ? "Blocks2TLs" : (isMatchList ? "Blocks2ULs" : "Blocks2OLs")),
                });
                if (focusContext) {
                    restoreFocusContext(protyle, focusContext);
                }
                return;
            }
        }
        // 列表操作统一中间件：合并处理所有列表操作（缩进、反缩进、类型转换、勾选切换）
        await listUnifiedMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await handleTableBlockCreation(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await insertBeforeMiddleWare(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await insertAfterMiddleWare(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await jumpToMiddleWare(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await moveToUpMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await moveToDownMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        // 在超级块左右插入空列（上游合并）
        if (!isInEmbedBlock(nodeElement)) {
            if (matchHotKey(window.siyuan.config.keymap.editor.general.insertSuperBlockLeft.custom, event)) {
                insertEmptySuperBlockColumn(protyle, "left");
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
            if (matchHotKey(window.siyuan.config.keymap.editor.general.insertSuperBlockRight.custom, event)) {
                insertEmptySuperBlockColumn(protyle, "right");
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
        }
        await handleVLayoutMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await handleHLayoutMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await aiActionsMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await aiWritingMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await openInNewTabMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        // tab 需等待 list 和 table 处理完成,避免在这些块中造成异常行为
        await tabKeyMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await contextMenuMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        if (!isMobile) {
            const refElement = hasClosestByAttribute(range.startContainer, "data-type", "block-ref");
            if (refElement) {
                const id = (refElement.getAttribute("data-id") || "").split(/\s+/)[0];
                if (matchHotKey(getSiyuanConfig().keymap.editor.general.openBy.custom, event) && id) {
                    checkFold(id, (zoomIn, action, isRoot) => {
                        if (!isRoot) {
                            action.push(Constants.CB_GET_HL);
                        }
                        openFileById({
                            app: protyle.app,
                            id,
                            action,
                            zoomIn,
                            scrollPosition: "start"
                        });
                    });
                    event.preventDefault();
                    event.stopPropagation();
                    return true;
                } else if (matchHotKey(getSiyuanConfig().keymap.editor.general.refTab.custom, event) && id) {
                    // 打开块引和编辑器中引用、反链、书签中点击事件需保持一致，都加载上下文
                    checkFold(id, (zoomIn) => {
                        openFileById({
                            app: protyle.app,
                            id,
                            action: zoomIn ? [Constants.CB_GET_HL, Constants.CB_GET_ALL] : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL],
                            keepCursor: true,
                            zoomIn,
                            scrollPosition: "start"
                        });
                    });
                    event.preventDefault();
                    event.stopPropagation();
                    return true;
                } else if (matchHotKey(getSiyuanConfig().keymap.editor.general.insertRight.custom, event) && id) {
                    checkFold(id, (zoomIn, action, isRoot) => {
                        if (!isRoot) {
                            action.push(Constants.CB_GET_HL);
                        }
                        openFileById({
                            app: protyle.app,
                            id,
                            position: "right",
                            action,
                            zoomIn,
                            scrollPosition: "start"
                        });
                    });
                    event.preventDefault();
                    event.stopPropagation();
                    return true;
                } else if (matchHotKey(getSiyuanConfig().keymap.editor.general.insertBottom.custom, event) && id) {
                    checkFold(id, (zoomIn, action, isRoot) => {
                        if (!isRoot) {
                            action.push(Constants.CB_GET_HL);
                        }
                        openFileById({
                            app: protyle.app,
                            id,
                            position: "bottom",
                            action,
                            zoomIn,
                            scrollPosition: "start"
                        });
                    });
                    event.preventDefault();
                    event.stopPropagation();
                    return true;
                } else if (matchHotKey(getSiyuanConfig().keymap.editor.general.refPopover.custom, event) && id) {
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
        }
        await pasteAsPlainTextMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await openLocalMiddleWare(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        //打开外部链接或者素材链接
        await openByMiddleWare(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        // 和自定义 alt+shift+左/右 冲突，降低优先级  https://github.com/siyuan-note/siyuan/issues/14638
        await arrowLeftRightMiddleWare(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        // 置于最后，太多快捷键会使用到选中元素
        removeSelectIndicatorElementMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        //工具条中的各种装饰元素快捷键不应该唤出工具条
        decorationMatchMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        //最后一步不再需要检查控制器是否已经取消
        return;
    });
};
