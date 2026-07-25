import type { AppFacade } from "../../../app/AppFacade.types";
import { fetchPost } from "../../../ai/imports";
import { openCardByData } from "../../../card/openCard";
import { Constants } from "../../../constants";
import { deleteFiles } from "../../../editor/deleteFile";
import { rename } from "../../../editor/rename";
import { openFileById } from "../../../editor/utils.openFileById";
import { Files } from "../../../layout/dock/Files";
import { getDockByType } from "../../../layout/tabUtil";
import { initFileMenu, initNavigationMenu } from "../../../menus/navigation";
import { copyTextByType } from "../../../protyle/toolbar/util";
import { isNotCtrl, isMac } from "../../../protyle/util/compatibility";
import { hasTopClosestByTag, hasClosestByAttribute, hasClosestByClassName } from "../../../protyle/util/hasClosest";
import { matchHotKey } from "../../../protyle/util/hotKey";
import { getStartEndElement } from "../../../protyle/wysiwyg/commonHotkey/commonHotkey";
import { getPreviousFileLi, getNextFileLi } from "../../../protyle/wysiwyg/getBlock";
import { transaction } from "../../../protyle/wysiwyg/transaction";
import { getDisplayName, getNotebookName } from "../../../util/file/pathName";
import { globalCommand } from "../command/global";
import { execByCommand } from "../command/panel";

export const fileTreeKeydown = (app: AppFacade, event: KeyboardEvent) => {
    const dockFile = getDockByType("file");
    if (!dockFile) {
        return false;
    }
    const files = dockFile.data.file as Files;
    if (typeof dockFile.data.file === "boolean") {
        return true;
    }

    if (matchHotKey(window.siyuan.config.keymap.general.selectOpen1.custom, event)) {
        event.preventDefault();
        globalCommand("selectOpen1", app);
        return;
    }

    if (!files.element.parentElement.classList.contains("layout__tab--active")) {
        return false;
    }

    let matchCommand = false;
    app.plugins.find(item => {
        item.commands.find(command => {
            if (command.fileTreeCallback && matchHotKey(command.customHotkey, event)) {
                matchCommand = true;
                command.fileTreeCallback(files);
                return true;
            }
        });
        if (matchCommand) {
            return true;
        }
    });
    if (matchCommand) {
        return true;
    }

    const liElements = Array.from(files.element.querySelectorAll(".b3-list-item--focus"));
    if (liElements.length === 0) {
        if (event.key.startsWith("Arrow") && isNotCtrl(event)) {
            const liElement = files.element.querySelector(".b3-list-item");
            if (liElement) {
                liElement.classList.add("b3-list-item--focus");
                files.lastSelectedElement = liElement;
            }
            event.preventDefault();
        }
        return false;
    }
    const topULElement = hasTopClosestByTag(liElements[0], "UL");
    if (!topULElement) {
        return false;
    }
    const notebookId = topULElement.getAttribute("data-url");
    const pathString = liElements[0].getAttribute("data-path");
    const isFile = liElements[0].getAttribute("data-type") === "navigation-file";
    const ids: string[] = [];
    liElements.forEach(item => {
        if (item.getAttribute("data-type") === "navigation-file") {
            ids.push(item.getAttribute("data-node-id"));
        }
    });

    if (matchHotKey(window.siyuan.config.keymap.editor.general.spaceRepetition.custom, event) && !window.siyuan.config.readonly) {
        if (isFile) {
            const id = liElements[0].getAttribute("data-node-id");
            fetchPost("/api/riff/getTreeRiffDueCards", { rootID: id }, (response) => {
                openCardByData(app, response.data, "doc", id, getDisplayName(liElements[0].getAttribute("data-name"), false, true));
            });
        } else {
            fetchPost("/api/riff/getNotebookRiffDueCards", { notebook: notebookId }, (response) => {
                openCardByData(app, response.data, "notebook", notebookId, getNotebookName(notebookId));
            });
        }
        event.preventDefault();
        return true;
    }

    if (matchHotKey(window.siyuan.config.keymap.editor.general.quickMakeCard.custom, event)) {
        if (ids.length > 0) {
            transaction(undefined, [{
                action: "addFlashcards",
                deckID: Constants.QUICK_DECK_ID,
                blockIDs: ids,
            }], [{
                action: "removeFlashcards",
                deckID: Constants.QUICK_DECK_ID,
                blockIDs: ids,
            }]);
        }
        event.preventDefault();
        return true;
    }

    if (matchHotKey(window.siyuan.config.keymap.general.addToDatabase.custom, event)) {
        execByCommand({
            command: "addToDatabase",
            app,
            fileLiElements: liElements
        });
        event.preventDefault();
        return true;
    }

    if (matchHotKey(window.siyuan.config.keymap.editor.general.rename.custom, event)) {
        window.siyuan.menus.menu.remove();
        // S-forge: 上游改进 - 支持空文档标题 (#17110)
        if (isFile) {
            fetchPost("/api/block/getDocInfo", {
                id: liElements[0].getAttribute("data-node-id")
            }, (response) => {
                rename({
                    notebookId,
                    path: pathString,
                    name: response.data.ial.title,
                    empty: response.data.ial[Constants.CUSTOM_SY_TITLE_EMPTY] === "true",
                    type: "file",
                });
            });
        } else {
            rename({
                notebookId,
                path: pathString,
                name: getNotebookName(notebookId),
                type: "notebook",
            });
        }
        event.preventDefault();
        return true;
    }

    if (matchHotKey("⌘/", event)) {
        const liRect = liElements[0].getBoundingClientRect();
        if (isFile) {
            initFileMenu(app, notebookId, pathString, liElements[0]).popup({
                x: liRect.right - 15,
                y: liRect.top + 15
            });
        } else {
            initNavigationMenu(app, liElements[0] as HTMLElement).popup({ x: liRect.right - 15, y: liRect.top + 15 });
        }
        return true;
    }

    if (!event.repeat && matchHotKey(window.siyuan.config.keymap.editor.general.duplicate.custom, event)) {
        event.preventDefault();
        event.stopPropagation();
        ids.forEach(item => {
            fetchPost("/api/filetree/duplicateDoc", {
                id: item,
            });
        });
        return true;
    }

    if (!event.repeat && matchHotKey(window.siyuan.config.keymap.editor.general.copyBlockRef.custom, event)) {
        event.preventDefault();
        event.stopPropagation();
        copyTextByType(ids, "ref");
        return true;
    }

    if (!event.repeat && matchHotKey(window.siyuan.config.keymap.editor.general.copyBlockEmbed.custom, event)) {
        event.preventDefault();
        event.stopPropagation();
        copyTextByType(ids, "blockEmbed");
        return true;
    }

    if (!event.repeat && matchHotKey(window.siyuan.config.keymap.editor.general.copyProtocol.custom, event)) {
        event.preventDefault();
        event.stopPropagation();
        copyTextByType(ids, "protocol");
        return true;
    }

    if (!event.repeat && matchHotKey(window.siyuan.config.keymap.editor.general.copyProtocolInMd.custom, event)) {
        event.preventDefault();
        event.stopPropagation();
        copyTextByType(ids, "protocolMd");
        return true;
    }
    if (!event.repeat && matchHotKey(window.siyuan.config.keymap.editor.general.copyHPath.custom, event)) {
        event.preventDefault();
        event.stopPropagation();
        copyTextByType(ids, "hPath");
        return true;
    }
    if (!event.repeat && matchHotKey(window.siyuan.config.keymap.editor.general.copyID.custom, event)) {
        event.preventDefault();
        event.stopPropagation();
        copyTextByType(ids, "id");
        return true;
    }

    if (isFile && matchHotKey(window.siyuan.config.keymap.general.move.custom, event)) {
        window.siyuan.menus.menu.remove();
        execByCommand({
            command: "move",
            app,
            fileLiElements: liElements
        });
        event.preventDefault();
        return true;
    }

    if (isFile && matchHotKey(window.siyuan.config.keymap.editor.general.insertRight.custom, event)) {
        window.siyuan.menus.menu.remove();
        openFileById({
            app,
            id: liElements[0].getAttribute("data-node-id"),
            action: [Constants.CB_GET_FOCUS],
            position: "right",
        });
        event.preventDefault();
        return true;
    }

    if (matchHotKey(window.siyuan.config.keymap.general.replace.custom, event)) {
        window.siyuan.menus.menu.remove();
        execByCommand({
            command: "replace",
            app,
            fileLiElements: liElements,
        });
        event.preventDefault();
        return true;
    }
    if (matchHotKey(window.siyuan.config.keymap.general.search.custom, event)) {
        window.siyuan.menus.menu.remove();
        execByCommand({
            command: "search",
            app,
            fileLiElements: liElements,
        });
        event.preventDefault();
        return true;
    }
    const target = event.target as HTMLElement;
    if (["INPUT", "TEXTAREA"].includes(target.tagName) ||
        hasClosestByAttribute(target, "contenteditable", null) ||
        hasClosestByClassName(target, "protyle", true)) {
        return false;
    }
    if (event.shiftKey) {
        if (event.key === "ArrowUp") {
            const startEndElement = getStartEndElement(liElements);
            let previousElement: Element;
            if (startEndElement.startElement.getBoundingClientRect().top >= startEndElement.endElement.getBoundingClientRect().top) {
                previousElement = getPreviousFileLi(startEndElement.endElement) as Element;
                if (previousElement) {
                    previousElement.classList.add("b3-list-item--focus");
                    previousElement.setAttribute("select-end", "true");
                    startEndElement.endElement.removeAttribute("select-end");
                }
            } else {
                startEndElement.endElement.classList.remove("b3-list-item--focus");
                startEndElement.endElement.removeAttribute("select-end");
                previousElement = getPreviousFileLi(startEndElement.endElement) as Element;
                if (previousElement) {
                    previousElement.setAttribute("select-end", "true");
                }
            }
            if (previousElement) {
                const previousRect = previousElement.getBoundingClientRect();
                const fileRect = files.element.getBoundingClientRect();
                if (previousRect.top < fileRect.top || previousRect.bottom > fileRect.bottom) {
                    previousElement.scrollIntoView(previousRect.top < fileRect.top);
                }
            }
        } else if (event.key === "ArrowDown") {
            const startEndElement = getStartEndElement(liElements);
            let nextElement: Element;
            if (startEndElement.startElement.getBoundingClientRect().top <= startEndElement.endElement.getBoundingClientRect().top) {
                nextElement = getNextFileLi(startEndElement.endElement) as Element;
                if (nextElement) {
                    nextElement.classList.add("b3-list-item--focus");
                    nextElement.setAttribute("select-end", "true");
                    startEndElement.endElement.removeAttribute("select-end");
                }
            } else {
                startEndElement.endElement.classList.remove("b3-list-item--focus");
                startEndElement.endElement.removeAttribute("select-end");
                nextElement = getNextFileLi(startEndElement.endElement) as Element;
                if (nextElement) {
                    nextElement.setAttribute("select-end", "true");
                }
            }
            if (nextElement) {
                const nextRect = nextElement.getBoundingClientRect();
                const fileRect = files.element.getBoundingClientRect();
                if (nextRect.top < fileRect.top || nextRect.bottom > fileRect.bottom) {
                    nextElement.scrollIntoView(nextRect.top < fileRect.top);
                }
            }
        }
        return;
    } else if (isNotCtrl(event)) {
        files.element.querySelector('[select-end="true"]')?.removeAttribute("select-end");
        files.element.querySelector('[select-start="true"]')?.removeAttribute("select-start");
        if ((event.key === "ArrowRight" && !liElements[0].querySelector(".b3-list-item__arrow--open") && !liElements[0].querySelector(".b3-list-item__toggle").classList.contains("fn__hidden")) ||
            (event.key === "ArrowLeft" && liElements[0].querySelector(".b3-list-item__arrow--open"))) {
            files.getLeaf(liElements[0], notebookId);
            liElements.forEach((item, index) => {
                if (index !== 0) {
                    item.classList.remove("b3-list-item--focus");
                }
            });
            event.preventDefault();
            return true;
        }
        if (event.key === "ArrowLeft") {
            let parentElement = liElements[0].parentElement.previousElementSibling;
            if (parentElement) {
                if (parentElement.tagName !== "LI") {
                    parentElement = files.element.querySelector(".b3-list-item");
                }
                liElements.forEach((item) => {
                    item.classList.remove("b3-list-item--focus");
                });
                parentElement.classList.add("b3-list-item--focus");
                files.lastSelectedElement = parentElement;
                const parentRect = parentElement.getBoundingClientRect();
                const fileRect = files.element.getBoundingClientRect();
                if (parentRect.top < fileRect.top || parentRect.bottom > fileRect.bottom) {
                    parentElement.scrollIntoView(parentRect.top < fileRect.top);
                }
            }
            event.preventDefault();
            return true;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            let nextElement = liElements[0];
            while (nextElement) {
                if (nextElement.nextElementSibling) {
                    if (nextElement.nextElementSibling.tagName === "UL") {
                        nextElement = nextElement.nextElementSibling.firstElementChild;
                    } else {
                        nextElement = nextElement.nextElementSibling;
                    }
                    break;
                } else {
                    if (nextElement.parentElement.classList.contains("fn__flex-1")) {
                        break;
                    } else {
                        nextElement = nextElement.parentElement;
                    }
                }
            }
            if (nextElement.classList.contains("b3-list-item")) {
                liElements.forEach((item) => {
                    item.classList.remove("b3-list-item--focus");
                });
                nextElement.classList.add("b3-list-item--focus");
                files.lastSelectedElement = nextElement;
                const nextRect = nextElement.getBoundingClientRect();
                const fileRect = files.element.getBoundingClientRect();
                if (nextRect.top < fileRect.top || nextRect.bottom > fileRect.bottom) {
                    nextElement.scrollIntoView(nextRect.top < fileRect.top);
                }
            }
            event.preventDefault();
            return true;
        }
        if (event.key === "ArrowUp") {
            let previousElement = liElements[0];
            while (previousElement) {
                if (previousElement.previousElementSibling) {
                    if (previousElement.previousElementSibling.tagName === "LI") {
                        previousElement = previousElement.previousElementSibling;
                    } else {
                        const liElements = previousElement.previousElementSibling.querySelectorAll(".b3-list-item");
                        previousElement = liElements[liElements.length - 1];
                    }
                    break;
                } else {
                    if (previousElement.parentElement.classList.contains("fn__flex-1")) {
                        break;
                    } else {
                        previousElement = previousElement.parentElement;
                    }
                }
            }
            if (previousElement.classList.contains("b3-list-item")) {
                liElements.forEach((item) => {
                    item.classList.remove("b3-list-item--focus");
                });
                previousElement.classList.add("b3-list-item--focus");
                files.lastSelectedElement = previousElement;
                const previousRect = previousElement.getBoundingClientRect();
                const fileRect = files.element.getBoundingClientRect();
                if (previousRect.top < fileRect.top || previousRect.bottom > fileRect.bottom) {
                    previousElement.scrollIntoView(previousRect.top < fileRect.top);
                }
            }
            event.preventDefault();
            return true;
        }
    }
    if (event.key === "Delete" || (event.key === "Backspace" && isMac())) {
        window.siyuan.menus.menu.remove();
        if (document.querySelector(`.b3-dialog--open[data-key="${Constants.DIALOG_CONFIRM}"]`)) {
            return;
        }
        deleteFiles(liElements);
        return true;
    }
    if (event.key === "Enter") {
        window.siyuan.menus.menu.remove();
        liElements.forEach(item => {
            if (item.getAttribute("data-type") === "navigation-file") {
                openFileById({ app, id: item.getAttribute("data-node-id"), action: [Constants.CB_GET_FOCUS] });
            } else {
                const itemTopULElement = hasTopClosestByTag(item, "UL");
                if (itemTopULElement) {
                    files.getLeaf(item, itemTopULElement.getAttribute("data-url"));
                }
            }
        });
        return true;
    }
};
