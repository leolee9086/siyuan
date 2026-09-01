import type { AppFacade } from "./imports";
import {
    copyPlainText,
    copyPNGByLink,
    copyTextByType,
    Custom,
    duplicateBlock,
    duplicateCompletely,
    execByCommand,
    Editor,
    fetchPost,
    getActiveTab,
    getAllModels,
    getContentByInlineHTML,
    getPlainText,
    getSiyuanBlockPanels,
    getSiyuanConfig,
    getSiyuanDialogs,
    getWindowSelection,
    goEnd,
    goHome,
    hasClosestBlock,
    hasClosestByAttribute,
    hasClosestByClassName,
    hideElements,
    isOnlyMeta,
    matchHotKey,
    onlyProtyleCommand,
    openBacklink,
    openCardByData,
    openExportPreviewTab,
    openGraph,
    openOutline,
    quickMakeCard,
    reloadProtyle,
    resize,
    saveLayout,
    Search,
    setEditMode,
    siyuanI18n,
    writeText,
    zoomOut,
} from "./imports";
import {resolveBacklinkEditorKeyCommand} from "../../../../layout/dock/backlink/backlinkKeyboard.router";

const getTitleText = (protyle: IProtyle) => {
    return protyle.title?.editElement.textContent || siyuanI18n.untitled;
};

export const editKeydown = (app: AppFacade, event: KeyboardEvent) => {
    const eventTarget = event.target as HTMLElement;
    if (resolveBacklinkEditorKeyCommand({
        insideBottomBacklink: hasClosestByClassName(eventTarget, "sy__backlink--bottom", true) !== null,
        insideNestedProtyle: hasClosestByClassName(eventTarget, "protyle", true) !== null,
    }) === "ignore-bottom-chrome") {
        return false;
    }
    const config = getSiyuanConfig();
    let protyle: IProtyle;
    let range: Range | null = null;
    const selection = getWindowSelection();
    if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
    }
    const activePanelElement = document.querySelector(".layout__tab--active");
    let isFileFocus = false;
    if (activePanelElement && activePanelElement.classList.contains("sy__file")) {
        isFileFocus = true;
    }
    if (range) {
        getSiyuanDialogs().find((item) => {
            if (item.editors) {
                Object.keys(item.editors).find((key) => {
                    if (item.editors[key].protyle.element.contains(range.startContainer)) {
                        protyle = item.editors[key].protyle;
                        isFileFocus = false;
                        return true;
                    }
                });
                if (protyle) {
                    return true;
                }
            }
        });
    }
    const activeTab = getActiveTab();
    if (!protyle && activeTab) {
        if (activeTab.model instanceof Editor) {
            protyle = activeTab.model.getCurrentProtyle(range || undefined);
        } else if (activeTab.model instanceof Search) {
            if (activeTab.model.element.querySelector("#searchUnRefPanel").classList.contains("fn__none")) {
                protyle = activeTab.model.editors.edit.protyle;
            } else {
                protyle = activeTab.model.editors.unRefEdit.protyle;
            }
        } else if (activeTab.model instanceof Custom && activeTab.model.editors?.length > 0) {
            if (range) {
                activeTab.model.editors.find((item) => {
                    if (item.protyle.element.contains(range.startContainer)) {
                        protyle = item.protyle;
                        return true;
                    }
                });
            }
        }
        if (!protyle) {
            return false;
        }
    } else if (!protyle) {
        if (!protyle && range) {
            getSiyuanBlockPanels().find((item) => {
                item.editors.find((editorItem) => {
                    if (editorItem.protyle.element.contains(range.startContainer)) {
                        protyle = editorItem.protyle;
                        return true;
                    }
                });
                if (protyle) {
                    return true;
                }
            });
        }
        const models = getAllModels();
        if (!protyle) {
            models.backlink.find((item) => {
                if (item.element.classList.contains("layout__tab--active")) {
                    if (range) {
                        item.editors.find((editor) => {
                            if (editor.protyle.element.contains(range.startContainer)) {
                                protyle = editor.protyle;
                                return true;
                            }
                        });
                    }
                    if (!protyle && item.editors.length > 0) {
                        protyle = item.editors[0].protyle;
                    }
                    return true;
                }
            });
        }
        if (!protyle) {
            models.editor.find((item) => {
                if (item.parent.headElement.classList.contains("item--focus")) {
                    protyle = item.editor.protyle;
                    return true;
                }
            });
        }
        if (!protyle) {
            return false;
        }
    }
    if (!isFileFocus && matchHotKey(config.keymap.general.replace.custom, event)) {
        execByCommand({
            command: "replace",
            app,
            protyle,
            previousRange: range,
        });
        event.preventDefault();
        return true;
    }
    if (!isFileFocus && matchHotKey(config.keymap.general.search.custom, event)) {
        execByCommand({
            command: "search",
            app,
            protyle,
            previousRange: range,
        });
        event.preventDefault();
        return true;
    }
    if (!isFileFocus && matchHotKey(config.keymap.editor.general.quickMakeCard.custom, event) && !config.readonly && range) {
        if (protyle.title?.editElement.contains(range.startContainer)) {
            quickMakeCard(protyle, [protyle.title.element]);
        } else {
            const selectElement: Element[] = [];
            protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select").forEach((item) => {
                selectElement.push(item);
            });
            if (selectElement.length === 0) {
                const nodeElement = hasClosestBlock(range.startContainer);
                if (nodeElement) {
                    selectElement.push(nodeElement);
                }
            }
            quickMakeCard(protyle, selectElement);
        }
        event.preventDefault();
        return true;
    }
    if (!isFileFocus && matchHotKey(config.keymap.general.addToDatabase.custom, event)) {
        execByCommand({
            command: "addToDatabase",
            app,
            protyle,
            previousRange: range,
        });
        event.preventDefault();
        return true;
    }
    if (!isFileFocus && matchHotKey(config.keymap.editor.general.spaceRepetition.custom, event) && !config.readonly) {
        fetchPost("/api/riff/getTreeRiffDueCards", { rootID: protyle.block.rootID }, (response) => {
            openCardByData(app, response.data, "doc", protyle.block.rootID, getTitleText(protyle));
        });
        event.preventDefault();
        return true;
    }
    if (!isFileFocus && matchHotKey(config.keymap.general.move.custom, event)) {
        execByCommand({
            command: "move",
            app,
            protyle,
            previousRange: range,
        });
        event.preventDefault();
        return true;
    }
    if (!isFileFocus && !event.repeat && !protyle.disabled &&
        matchHotKey(config.keymap.editor.general.duplicate.custom, event)) {
        event.preventDefault();
        event.stopPropagation();
        let selectsElement: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
        if (selectsElement.length === 0 && range) {
            const nodeElement = hasClosestBlock(range.startContainer);
            if (nodeElement) {
                selectsElement = [nodeElement];
            }
        }
        duplicateBlock(selectsElement, protyle);
        return true;
    }

    const target = event.target as HTMLElement;
    if (target.tagName !== "TABLE" && ["INPUT", "TEXTAREA"].includes(target.tagName)) {
        return false;
    }
    if (!event.altKey && !event.shiftKey && isOnlyMeta(event) && event.key === "Home") {
        goHome(protyle);
        hideElements(["select"], protyle);
        event.stopPropagation();
        event.preventDefault();
        return true;
    }
    if (!event.altKey && !event.shiftKey && isOnlyMeta(event) && event.key === "End") {
        goEnd(protyle);
        hideElements(["select"], protyle);
        event.stopPropagation();
        event.preventDefault();
        return true;
    }
    if (matchHotKey(config.keymap.editor.general.exitFocus.custom, event)) {
        event.preventDefault();
        zoomOut({ protyle, id: protyle.block.rootID, focusId: protyle.block.id });
        return true;
    }
    if (matchHotKey(config.keymap.editor.general.focusBreadcrumb.custom, event)) {
        if (protyle.breadcrumb?.focus(range)) {
            event.preventDefault();
            return true;
        }
    }
    if (matchHotKey(config.keymap.editor.general.switchReadonly.custom, event)) {
        event.preventDefault();
        onlyProtyleCommand({
            protyle,
            command: "switchReadonly",
            previousRange: range,
        });
        return true;
    }
    if (matchHotKey(config.keymap.editor.general.switchAdjust.custom, event)) {
        event.preventDefault();
        onlyProtyleCommand({
            protyle,
            command: "switchAdjust",
            previousRange: range,
        });
        return true;
    }
    if (matchHotKey(config.keymap.editor.general.backlinks.custom, event)) {
        event.preventDefault();
        if (range) {
            const refElement = hasClosestByAttribute(range.startContainer, "data-type", "block-ref");
            if (refElement) {
                openBacklink({
                    app: protyle.app,
                    blockId: (refElement.dataset.id || "").split(/\s+/)[0],
                });
                return true;
            }
        }
        openBacklink({
            app: protyle.app,
            blockId: protyle.block.id,
            rootId: protyle.block.rootID,
            useBlockId: protyle.block.showAll,
            title: protyle.title ? getTitleText(protyle) : null,
        });
        return true;
    }
    if (matchHotKey(config.keymap.editor.general.graphView.custom, event)) {
        event.preventDefault();
        if (range) {
            const refElement = hasClosestByAttribute(range.startContainer, "data-type", "block-ref");
            if (refElement) {
                openGraph({
                    app: protyle.app,
                    blockId: (refElement.dataset.id || "").split(/\s+/)[0],
                });
                return true;
            }
        }
        openGraph({
            app: protyle.app,
            blockId: protyle.block.id,
            rootId: protyle.block.rootID,
            useBlockId: protyle.block.showAll,
            title: protyle.title ? getTitleText(protyle) : null,
        });
        return true;
    }
    if (matchHotKey(config.keymap.editor.general.outline.custom, event)) {
        event.preventDefault();
        openOutline({
            app,
            rootId: protyle.block.rootID,
            title: protyle.options.render.title ? getTitleText(protyle) : "",
            isPreview: false,
        });
        return true;
    }
    if (matchHotKey(config.keymap.editor.general.copyPlainText.custom, event) && range) {
        const nodeElement = hasClosestBlock(range.startContainer);
        if (!nodeElement) {
            return false;
        }
        if (range.toString() === "") {
            const selectsElement: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
            let html = "";
            if (selectsElement.length === 0) {
                selectsElement.push(nodeElement);
            }
            selectsElement.forEach((item) => {
                html += `${getPlainText(item)}\n`;
            });
            copyPlainText(html.trimEnd());
        } else {
            copyPlainText(range.toString());
        }
        event.preventDefault();
        return true;
    }
    if (matchHotKey(config.keymap.editor.general.duplicateCompletely.custom, event) && range) {
        const nodeElement = hasClosestBlock(range.startContainer);
        if (!nodeElement || !nodeElement.classList.contains("av")) {
            return false;
        }
        duplicateCompletely(protyle, nodeElement);
        event.preventDefault();
        return true;
    }
    if (matchHotKey(config.keymap.editor.general.refresh.custom, event)) {
        reloadProtyle(protyle, true);
        event.preventDefault();
        return true;
    }
    if (matchHotKey(config.keymap.editor.general.fullscreen.custom, event)) {
        protyle.app.toggleFullscreen(protyle.element);
        resize(protyle);
        event.preventDefault();
        return true;
    }
    if (matchHotKey(config.keymap.editor.general.wysiwyg.custom, event) && !protyle.options.backlinkData) {
        setEditMode(protyle, "wysiwyg");
        reloadProtyle(protyle, true);
        saveLayout();
        event.preventDefault();
        return true;
    }
    if (matchHotKey(config.keymap.editor.general.preview.custom, event)) {
        void openExportPreviewTab({
            app,
            blockId: protyle.block.rootID,
        });
        event.preventDefault();
        return true;
    }
    if (range && !isFileFocus && matchHotKey(config.keymap.editor.general.copyBlockRef.custom, event)) {
        event.preventDefault();
        event.stopPropagation();
        if (hasClosestByClassName(range.startContainer, "protyle-title")) {
            copyTextByType([protyle.block.rootID], "ref");
        } else {
            const nodeElement = hasClosestBlock(range.startContainer);
            if (!nodeElement) {
                return false;
            }
            const selectImgElement = nodeElement.querySelector(".img--select");
            if (selectImgElement) {
                const imageElement = selectImgElement.querySelector("img");
                if (imageElement) {
                    copyPNGByLink(imageElement.getAttribute("src"));
                    return true;
                }
            }
            const ids = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select")).map((item) => item.getAttribute("data-node-id"));
            if (ids.length > 0) {
                copyTextByType(ids, "ref");
                return true;
            }
            if (range.toString() !== "") {
                getContentByInlineHTML(range, (content) => {
                    writeText(`((${nodeElement.getAttribute("data-node-id")} "${content.trim()}"))`);
                });
            } else {
                copyTextByType([nodeElement.getAttribute("data-node-id")], "ref");
            }
        }
        return true;
    }
    if (hasClosestByClassName(target, "protyle-title__input")) {
        return false;
    }
    if (matchHotKey(config.keymap.editor.general.undo.custom, event)) {
        protyle.undo.undo(protyle);
        event.preventDefault();
        return true;
    }
    if (matchHotKey(config.keymap.editor.general.redo.custom, event)) {
        protyle.undo.redo(protyle);
        event.preventDefault();
        return true;
    }
    return false;
};
