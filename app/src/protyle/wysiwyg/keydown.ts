import { isNotCtrl } from "../util/compatibility";
import {
    getEditorRange,
} from "../util/selection";
import {
    hasClosestBlock,
    hasClosestByAttribute,
} from "../util/hasClosest";
// S-forge: keydown 逻辑已重构拆分为多个中间件模块
import { Constants } from "../../constants";
import { fetchPost } from "../../util/network/fetch";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { avPanelGuard, htmlBlockGuard, htmlBlockGuardRgistyItem, inputElementGuard, protyleDisabledGuard, protyleHaveSelectedGuard } from "./keydown.guards";
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
import { checkFold } from "../../util/platform/noRelyPCFunction";
import { openFileById } from "../../editor/utils.openFileById";
import { BlockPanel } from "../../block/panel/Panel";
import { turnsIntoTransaction, turnsOneInto, updateTransaction } from "./transaction";
import { getSiyuanConfig, getSiyuanStorage } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getContenteditableElement } from "./getBlock";
import { highlightRender } from "../render/highlightRender";
import { isMobile } from "../../platform";
import {removeBlock, removeImage} from "./remove";
import { preventScroll } from "../scroll/preventScroll";
import { foldBlocksRecursively, getFoldBlock, setFold } from "../util/blockFold";
import { countBlockWord } from "../../layout/status";
import { onlyProtyleCommand } from "../../boot/globalEvent/command/protyle";
import { upSelect, downSelect, getStartEndElement } from "./commonHotkey";

export const getContentByInlineHTML = (range: Range, cb: (content: string) => void) => {
    let html = "";
    Array.from(range.cloneContents().childNodes).forEach((item) => {
        //文本节点
        if (item.nodeType === 3) {
            html += item.textContent;
        } else {
            //元素节点    
            if (item instanceof HTMLElement) {
                html += item.outerHTML;
            }
        }
    });
    fetchPost("/api/block/getDOMText", { dom: html }, (response) => {
        cb(response.data);
    });
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
        if (!event.altKey && !event.shiftKey && isNotCtrl(event) && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
            if (selectElements.length > 0) {
                event.preventDefault();
                event.stopPropagation();
                hideElements(["select"], protyle);
                if (event.key === "ArrowDown") {
                    const currentSelectElement = selectElements[selectElements.length - 1] as HTMLElement;
                    let nextElement = getNextBlock(currentSelectElement) as HTMLElement;
                    if (nextElement) {
                        if (nextElement.getBoundingClientRect().width === 0) {
                            // https://github.com/siyuan-note/siyuan/issues/4294
                            const foldElement = hasTopClosestByAttribute(nextElement, "fold", "1");
                            if (foldElement) {
                                nextElement = getNextBlock(foldElement) as HTMLElement;
                                if (nextElement) {
                                    nextElement = getFirstBlock(nextElement) as HTMLElement;
                                } else {
                                    nextElement = currentSelectElement;
                                }
                            } else {
                                nextElement = currentSelectElement;
                            }
                        } else if (nextElement.getAttribute("fold") === "1"
                            && (nextElement.classList.contains("sb") || nextElement.classList.contains("bq"))) {
                            // https://github.com/siyuan-note/siyuan/issues/3913
                        } else {
                            nextElement = getFirstBlock(nextElement) as HTMLElement;
                        }
                    } else {
                        nextElement = currentSelectElement;
                    }

                    nextElement.classList.add("protyle-wysiwyg--select");
                    countBlockWord([nextElement.getAttribute("data-node-id")]);
                    const bottom = nextElement.getBoundingClientRect().bottom - protyle.contentElement.getBoundingClientRect().bottom;
                    if (bottom > 0) {
                        protyle.contentElement.scrollTop = protyle.contentElement.scrollTop + bottom;
                        protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop - 1;
                    }
                    focusBlock(nextElement);
                } else if (event.key === "ArrowUp") {
                    let previousElement: HTMLElement = getPreviousBlock(selectElements[0]) as HTMLElement;
                    if (previousElement) {
                        previousElement = getLastBlock(previousElement) as HTMLElement;
                        if (previousElement.getBoundingClientRect().width === 0) {
                            // https://github.com/siyuan-note/siyuan/issues/4294
                            const foldElement = hasTopClosestByAttribute(previousElement, "fold", "1");
                            if (foldElement) {
                                previousElement = getFirstBlock(foldElement) as HTMLElement;
                            } else {
                                previousElement = selectElements[0] as HTMLElement;
                            }
                        } else if (previousElement) {
                            // https://github.com/siyuan-note/siyuan/issues/3913
                            const foldElement = hasTopClosestByAttribute(previousElement, "fold", "1");
                            if (foldElement && (foldElement.classList.contains("sb") || foldElement.classList.contains("bq"))) {
                                previousElement = foldElement;
                            }
                        }
                    } else if (protyle.title && protyle.title.editElement &&
                        (protyle.wysiwyg.element.firstElementChild.getAttribute("data-eof") === "1" || protyle.contentElement.scrollTop === 0)) {
                        const titleRange = setLastNodeRange(protyle.title.editElement, range, false);
                        titleRange.collapse(false);
                        focusByRange(titleRange);
                        event.stopPropagation();
                        event.preventDefault();
                    } else if (protyle.contentElement.scrollTop !== 0) {
                        protyle.contentElement.scrollTop = 0;
                        protyle.scroll.lastScrollTop = 8;
                    } else {
                        previousElement = selectElements[0] as HTMLElement;
                    }
                    if (previousElement) {
                        previousElement.classList.add("protyle-wysiwyg--select");
                        countBlockWord([previousElement.getAttribute("data-node-id")]);
                        const top = previousElement.getBoundingClientRect().top - protyle.contentElement.getBoundingClientRect().top;
                        if (top < 0) {
                            protyle.contentElement.scrollTop = protyle.contentElement.scrollTop + top;
                            protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop + 1;
                        }
                        focusBlock(previousElement);
                    }
                }
                return;
            }
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


        const nodeType = nodeElement.getAttribute("data-type");
        if (matchHotKey(window.siyuan.config.keymap.editor.general.collapse.custom, event) && !event.repeat) {
            getFoldBlock(protyle, nodeElement, (elements) => {
                setFold(protyle, elements[0]);
            });
            event.stopPropagation();
            event.preventDefault();
            return false;
        }

        if (matchHotKey(window.siyuan.config.keymap.editor.general.expand.custom, event) && !event.repeat) {
            getFoldBlock(protyle, nodeElement, (elements) => {
                setFold(protyle, elements[0], true);
            });
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
                    } else if (!getParentBlock(selectElements[0]).classList.contains("protyle-wysiwyg")) {
                        hideElements(["select"], protyle);
                        getParentBlock(selectElements[0]).classList.add("protyle-wysiwyg--select");
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
                    } else if (!getParentBlock(selectLastElement).classList.contains("protyle-wysiwyg")) {
                        hideElements(["select"], protyle);
                        getParentBlock(selectLastElement).classList.add("protyle-wysiwyg--select");
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
                        } else if (!getParentBlock(startEndElement.endElement).classList.contains("protyle-wysiwyg")) {
                            hideElements(["select"], protyle);
                            getParentBlock(startEndElement.endElement).classList.add("protyle-wysiwyg--select");
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
                                getParentBlock(startEndElement.endElement).classList.add("protyle-wysiwyg--select");
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
                        } else if (!getParentBlock(startEndElement.endElement).classList.contains("protyle-wysiwyg")) {
                            hideElements(["select"], protyle);
                            getParentBlock(startEndElement.endElement).classList.add("protyle-wysiwyg--select");
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
                const ids: string[] = [];
                ids.push(topElement.getAttribute("data-node-id"));
                let nextElement = event.key === "Home" ? topElement.previousElementSibling : topElement.nextElementSibling;
                while (nextElement) {
                    nextElement.classList.add("protyle-wysiwyg--select");
                    ids.push(nextElement.getAttribute("data-node-id"));
                    nextElement = event.key === "Home" ? nextElement.previousElementSibling : nextElement.nextElementSibling;
                }
                countBlockWord(ids);
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
        await hideHintMiddleware(editorContext);
        if (signal.aborted) {
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
        // 上下左右光标移动
        await arrowNavigationMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }


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
        // 回车
        await enterKeyMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
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
        await escapeKeyMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        // h1 - h6 hotkey
        await headingTransformMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        if (matchHotKey(getSiyuanConfig().keymap.editor.insert.code.custom, event) &&
            !["NodeCodeBlock", "NodeHeading", "NodeTable"].includes(nodeElement.getAttribute("data-type")!)) {
            const editElement = getContenteditableElement(nodeElement);
            if (editElement) {
                const id = nodeElement.getAttribute("data-node-id")!;
                const html = nodeElement.outerHTML;
                // 需要 EscapeHTMLStr https://github.com/siyuan-note/siyuan/issues/11451
                editElement.innerHTML = "```" + getSiyuanStorage()[Constants.LOCAL_CODELANG] + "\n" + Lute.EscapeHTMLStr(editElement.textContent) + "<wbr>\n```";
                const newHTML = protyle.lute!.SpinBlockDOM(nodeElement.outerHTML);
                nodeElement.outerHTML = newHTML;
                const newNodeElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`);
                updateTransaction(protyle, id, newHTML, html);
                highlightRender(newNodeElement!);
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
        }

        // toolbar action
        await toolbarLastUsedMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
        }
        await toolbarHotkeyMiddleware(event, protyle, nodeElement, range, controller);
        if (signal.aborted) {
            return;
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
                const id = (refElement.getAttribute("data-id") || '').split(/\s+/)[0];
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
