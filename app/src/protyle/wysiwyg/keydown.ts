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
import { htmlBlockGuard, htmlBlockGuardRgistyItem, inputElementGuard, protyleDisabledGuard, protyleHaveSelectedGuard } from "./keydown.guards";
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
import { listCheckToggleMiddleware, listIndentMiddleware, listOutdentMiddleware, listTransformMiddleware } from "./keydown.list";
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
import { hintSlashMiddleware } from "./keydown.slashHint";
import { redoMiddleware, undoMiddleware } from "./keydown.editorStack";
import { commonHotkeyMiddleware } from "./keydown.commonHotkey";
import { fixTableMiddleware } from "./keydown.table";

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

        const range = getEditorRange(protyle.wysiwyg.element);
        const nodeElement = hasClosestBlock(range.startContainer);
        if (!nodeElement) { throw (new Error('未能找到块元素')) }
        let eventState: Record<string, string> = {
            blockType: ""
        }
        if (event.target.localName === "protyle-html") {
            eventState.blockType = "NodeHTMLBlock"
            eventState.elementTarget = "protyle-html"
        }
        if (event.target.localName === 'input') {
            eventState.blockType = nodeElement.getAttribute("data-type")
        }
        const history: string[] = []
        let currentItem = { handle: async () => { }, describe: "" }
        const eventDriver = {
            abort: (reason: string) => controller.abort(`中止处理${currentItem.describe}:${reason}\n\n${history.join('')}\n\n${new Error().stack?.replace('Error', '')}`),
            stop: (reason: string) => { event.stopPropagation(); console.log(`停止冒泡:${currentItem.describe}:${reason}\n\n${new Error().stack?.replace('Error', '')}`) },
            prevent: (reason: string) => { event.preventDefault(); console.log(`阻止原生事件:${currentItem.describe}:${reason}\n\n${new Error().stack?.replace('Error', '')}`) },
        }
        const createHandleWithRecord = (item: any) => {
            return async (
                event: KeyboardEvent,
                protyle: IProtyle,
                nodeElement: HTMLElement,
                range: Range,
            ) => {
                history.push(item.describe)
                await item.handle(event, protyle, nodeElement, range, eventDriver)
            }
        }
        const executeItem = async (item: any) => {
            currentItem = item
            let flag = true
            for await (const [key, flagValue] of Object.entries(eventState)) {
                const conditionValue = item.conditions[key];
                if (!(conditionValue === undefined || conditionValue === flagValue)) {
                    flag = false
                }
            }
            flag && await createHandleWithRecord(currentItem)(event, protyle, nodeElement, range)
        }
        const editorContext = { event, protyle, nodeElement, range, controller }
        //守卫函数传入控制器但是不要修改状态
        //currentItem = htmlBlockGuardRgistyItem
        //eventState.blockType === htmlBlockGuardRgistyItem.condition.blockType && await createHandleWithRecord(htmlBlockGuardRgistyItem)(event, protyle, nodeElement, range)
        await executeItem(htmlBlockGuardRgistyItem)
        if (signal.aborted) { return }
        //当在input元素中输入时
        await inputElementGuard(editorContext)
        if (signal.aborted) { return }
        await protyleDisabledGuard(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await protyleHaveSelectedGuard(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await setProtyleWysiwygPreventKeyupMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await hideProtyleUtilMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await hideProtyleToolbarMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await crossBlockCopyMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        if (document.querySelector(".av__panel")) {
            controller.abort("属性视图面板已打开");
        }
        if (signal.aborted) { return }
        if (avKeydown(event, nodeElement, protyle)) {
            controller.abort("属性视图键盘事件处理");
        }
        if (signal.aborted) { return }
        //选中块状态下插入新的块
        await handleSelectedBlockInsertKeyMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        if (event.isComposing) {
            event.stopPropagation();
            controller.abort("输入法处理中");
        }
        if (signal.aborted) { return }

        // https://github.com/siyuan-note/siyuan/issues/2261
        await hintSlashMiddleware(editorContext)
        if (signal.aborted) { return }
        // 有可能输入 shift+. ，因此需要使用 event.key 来进行判断
        await insertWbrMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }

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

        await foldHotkeyMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }

        await expandSelectMiddleware(event, protyle, nodeElement, editorElement, range, controller)
        if (signal.aborted) { return }

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
        await pageNavigationMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        // hint: 上下、回车选择
        if (!event.altKey && !event.shiftKey &&
            ((event.key.indexOf("Arrow") > -1 && isNotCtrl(event)) || event.key === "Enter") &&
            !protyle.hint.element.classList.contains("fn__none") && protyle.hint.select(event, protyle)) {
            return;
        }
        //行内元素菜单和块菜单
        await inlineMenuMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await fixTableMiddleware(editorContext)
        if (signal.aborted) { return }
        // 上下左右光标移动
        await arrowNavigationMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        // 删除，不可使用 isNotCtrl(event)，否则软删除回导致 https://github.com/siyuan-note/siyuan/issues/5607
        // 不可使用 !event.shiftKey，否则 https://ld246.com/article/1666434796806
        await deleteKeyMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        // 软换行
        await softEnterMiddleware(editorContext)
        if (signal.aborted) { return }
        // 代码块语言选择 https://github.com/siyuan-note/siyuan/issues/14126
        await altEnterMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        // 回车
        await enterKeyMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) { return }
        await selectAllMiddleware(editorContext)
        if (signal.aborted) { return }
        await undoMiddleware(editorContext)
        if (signal.aborted) { return }
        await redoMiddleware(editorContext)
        if (signal.aborted) { return }
        /// #if !MOBILE
        await commonHotkeyMiddleware(editorContext)
        if (signal.aborted) { return }
        /// #endif
        await copyTextMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await attrMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await renameMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await createNamedNewFileMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await createNewFileByContentMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await formatMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await escapeKeyMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        // h1 - h6 hotkey
        await headingTransformMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await handleCodeBlockCreation(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        // toolbar action
        await toolbarLastUsedMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await toolbarHotkeyMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await listOutdentMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await listIndentMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await listTransformMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await handleTableBlockCreation(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await listCheckToggleMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await insertBeforeMiddleWare(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await insertAfterMiddleWare(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await jumpToMiddleWare(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await moveToUpMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await moveToDownMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await handleVLayoutMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await handleHLayoutMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await aiActionsMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await aiWritingMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        await openInNewTabMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        // tab 需等待 list 和 table 处理完成,避免在这些块中造成异常行为
        await tabKeyMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) { return }
        await contextMenuMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        /// #if !MOBILE
        await blockRefMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        /// #endif
        await pasteAsPlainTextMiddleware(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
        /// #if !BROWSER
        await openLocalMiddleWare(event, protyle, nodeElement, range, controller)
        if (signal.aborted) { return }
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
