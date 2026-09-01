/**
 * MobileOutline 右键菜单相关逻辑
 * 从 MobileOutline.ts 拆分
 */
import {fetchPost} from "../../util/network/fetch";
import {writeBlockDOMClipboard} from "../../protyle/util/compatibility";
import {Constants} from "../../constants";
import {MenuItem} from "../../menus/Menu.Item";
import {transaction} from "../../protyle/wysiwyg/transaction/submit";
import {turnsIntoTransaction} from "../../protyle/wysiwyg/transaction/turns/multiple";
import {mathRender} from "../../protyle/render/mathRender";
import {genEmptyElement} from "../../block/element.factory";
import {focusBlock} from "../../protyle/util/selection";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {collapseSameLevel, collapseChildren, getHeadingLevel} from "./MobileOutline.expand";
import type {MobileOutlineContextMenuPort, MobileOutlineTreePort} from "./outline/ports.types";
import {confirmBlockRefForBlocks} from "../../util/checkBlockRef";
import {showMessage} from "../../dialog/message";

/**
 * 获取 Protyle 和块元素
 */
export function getProtyleAndBlockElement(outline: MobileOutlineTreePort, element: HTMLElement) {
    const id = element.getAttribute("data-node-id");
    if (!window.siyuan.mobile.editor?.protyle) {
        return;
    }
    const blockElement = window.siyuan.mobile.editor.protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`);
    if (!blockElement) {
        return;
    }
    return {
        protyle: window.siyuan.mobile.editor.protyle, blockElement
    };
}

const focusInsertedHeading = (element: Element | null) => {
    if (!element) {
        throw new Error("Inserted outline heading is missing from the editor DOM");
    }
    element.scrollIntoView();
    element.querySelector("wbr")?.remove();
    (element.querySelector('[contenteditable="true"]') as HTMLElement)?.focus({preventScroll: true});
    focusBlock(element);
};

const writeHeadingClipboard = async (protyle: IProtyle, responseData: string) => {
    return await writeBlockDOMClipboard({
        text: protyle.lute.BlockDOM2StdMd(responseData).trimEnd(),
        html: responseData + Constants.ZWSP,
    });
};

const reportClipboardFailure = () => {
    showMessage(siyuanI18n.clipboardPermissionDenied, 7000, "error");
};

const confirmHeadingDeletion = async (protyle: IProtyle, id: string, response: IWebSocketData) => {
    const operations = response.data?.doOperations as IOperation[] | undefined;
    if (!operations?.length) {
        console.error("Heading deletion transaction is missing operations", {id, response});
        return false;
    }
    if (!await confirmBlockRefForBlocks(
        protyle,
        operations.flatMap(operation => operation.id ? [operation.id] : []),
    )) {
        return false;
    }
    return Boolean(protyle.wysiwyg?.element.querySelector(`[data-node-id="${id}"]`));
};

/**
 * 生成标题级别转换菜单项
 */
export function genHeadingTransform(id: string, level: number) {
    return {
        id: "heading" + level,
        iconHTML: "",
        icon: "iconHeading" + level,
        label: siyuanI18n["heading" + level],
        click: () => {
            const protyle = window.siyuan.mobile.editor?.protyle;
            if (!protyle || !outline.tree.element.querySelector(`[data-node-id="${id}"]`)) {
                return;
            }
            const rootID = protyle.block.rootID;
            getSelection()?.removeAllRanges();
            fetchPost("/api/block/getHeadingLevelTransaction", {
                id,
                level
            }, (response) => {
                if (window.siyuan.mobile.editor?.protyle !== protyle || outline.blockId !== rootID ||
                    !response.data?.doOperations || !response.data?.undoOperations) {
                    return;
                }
                response.data.doOperations.forEach((operation: any, index: number) => {
                    protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach((itemElement: HTMLElement) => {
                        itemElement.outerHTML = operation.data;
                    });
                    // 使用 outer 后元素需要重新查询
                    protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach((itemElement: HTMLElement) => {
                        mathRender(itemElement);
                    });
                    if (index === 0) {
                        const focusElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${operation.id}"]`);
                        if (focusElement) {
                            focusElement.scrollIntoView({behavior: "smooth", block: "center"});
                        }
                    }
                });
                transaction(protyle, response.data.doOperations, response.data.undoOperations);
            });
        }
    };
}

/**
 * 显示右键菜单
 */
export function showContextMenu(outline: MobileOutlineContextMenuPort, element: HTMLElement) {
    if (outline.isPreview) {
        return; // 预览模式下不显示右键菜单
    }
    const currentLevel = getHeadingLevel(element);
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_OUTLINE_CONTEXT);
    const id = element.getAttribute("data-node-id");
    if (!window.siyuan.config.readonly) {
        // 升级
        if (currentLevel > 1) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "upgrade",
                icon: "iconUp",
                label: siyuanI18n.upgrade,
                click: () => {
                    const data = getProtyleAndBlockElement(outline, element);
                    if (data) {
                        getSelection()?.removeAllRanges();
                        turnsIntoTransaction({
                            protyle: data.protyle,
                            selectsElement: [data.blockElement],
                            type: "Blocks2Hs",
                            level: currentLevel - 1,
                            unfocus: true,
                        });
                    }
                }
            }).element);
        }

        // 降级
        if (currentLevel < 6) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "downgrade",
                icon: "iconDown",
                label: siyuanI18n.downgrade,
                click: () => {
                    const data = getProtyleAndBlockElement(outline, element);
                    if (data) {
                        getSelection()?.removeAllRanges();
                        turnsIntoTransaction({
                            protyle: data.protyle,
                            selectsElement: [data.blockElement],
                            type: "Blocks2Hs",
                            level: currentLevel + 1,
                            unfocus: true,
                        });
                    }
                }
            }).element);
        }
        outline.setCurrentById(id);
        const headingSubMenu = [];
        for (let i = 1; i <= 6; i++) {
            if (i !== currentLevel) {
                headingSubMenu.push(genHeadingTransform(id, i));
            }
        }

        if (headingSubMenu.length > 0) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "tWithSubtitle",
                type: "submenu",
                icon: "iconRefresh",
                label: siyuanI18n.tWithSubtitle,
                submenu: headingSubMenu
            }).element);
        }

        window.siyuan.menus.menu.append(new MenuItem({id: "separator_1", type: "separator"}).element);

        // 在前面插入同级标题
        window.siyuan.menus.menu.append(new MenuItem({
            id: "insertSameLevelHeadingBefore",
            icon: "iconBefore",
            label: siyuanI18n.insertSameLevelHeadingBefore,
            click: () => {
                const data = getProtyleAndBlockElement(outline, element);
                if (!data) {
                    return;
                }
                const newId = Lute.NewNodeID();
                const html = `<div data-subtype="h${currentLevel}" data-node-id="${newId}" data-type="NodeHeading" class="h${currentLevel}"><div contenteditable="true" spellcheck="false"><wbr></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
                const previousID = data.blockElement.previousElementSibling?.getAttribute("data-node-id");
                data.blockElement.insertAdjacentHTML("beforebegin", html);
                focusInsertedHeading(data.blockElement.previousElementSibling);
                transaction(data.protyle, [{
                    action: "insert",
                    data: html,
                    id: newId,
                    previousID,
                    parentID: data.blockElement.parentElement.getAttribute("data-node-id") || data.protyle.block.parentID,
                }], [{
                    action: "delete",
                    id: newId
                }]);
            }
        }).element);

        // 在后面插入同级标题
        window.siyuan.menus.menu.append(new MenuItem({
            id: "insertSameLevelHeadingAfter",
            icon: "iconAfter",
            label: siyuanI18n.insertSameLevelHeadingAfter,
            click: () => {
                const data = getProtyleAndBlockElement(outline, element);
                if (!data) {
                    return;
                }
                const rootID = data.protyle.block.rootID;
                focusBlock(data.blockElement);
                fetchPost("/api/block/getHeadingDeleteTransaction", {
                    id,
                }, (deleteResponse) => {
                    if (window.siyuan.mobile.editor?.protyle !== data.protyle || outline.blockId !== rootID ||
                        !deleteResponse.data?.doOperations?.length) {
                        return;
                    }
                    const previousID = deleteResponse.data.doOperations[deleteResponse.data.doOperations.length - 1].id;

                    const newId = Lute.NewNodeID();
                    const html = `<div data-subtype="h${currentLevel}" data-node-id="${newId}" data-type="NodeHeading" class="h${currentLevel}"><div contenteditable="true" spellcheck="false"><wbr></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
                    const previousElement = data.protyle.wysiwyg.element.querySelector(`[data-node-id="${previousID}"]`);
                    if (previousElement) {
                        previousElement.insertAdjacentHTML("afterend", html);
                        focusInsertedHeading(previousElement.nextElementSibling);
                    }
                    transaction(data.protyle, [{
                        action: "insert",
                        data: html,
                        id: newId,
                        previousID,
                    }], [{
                        action: "delete",
                        id: newId
                    }]);
                });
            }
        }).element);

        // 添加子标题
        if (currentLevel < 6) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "addChildHeading",
                icon: "iconAdd",
                label: siyuanI18n.addChildHeading,
                click: () => {
                    const data = getProtyleAndBlockElement(outline, element);
                    if (!data) {
                        return;
                    }
                    const rootID = data.protyle.block.rootID;
                    focusBlock(data.blockElement);
                    fetchPost("/api/block/getHeadingDeleteTransaction", {
                        id,
                    }, (deleteResponse) => {
                        if (window.siyuan.mobile.editor?.protyle !== data.protyle || outline.blockId !== rootID ||
                            !deleteResponse.data?.doOperations?.length || !deleteResponse.data?.undoOperations) {
                            return;
                        }
                        let previousID = deleteResponse.data.doOperations[deleteResponse.data.doOperations.length - 1].id;
                        deleteResponse.data.undoOperations.find((operationsItem: IOperation, index: number) => {
                            const startIndex = operationsItem.data.indexOf(' data-subtype="h');
                            if (index > 0 && startIndex > -1 && startIndex < 260 && parseInt(operationsItem.data.substring(startIndex + 16, startIndex + 17)) === currentLevel + 1) {
                                previousID = deleteResponse.data.undoOperations[index - 1].id;
                                return true;
                            }
                        });
                        const newId = Lute.NewNodeID();
                        const html = `<div data-subtype="h${currentLevel + 1}" data-node-id="${newId}" data-type="NodeHeading" class="h${currentLevel + 1}"><div contenteditable="true" spellcheck="false"><wbr></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
                        const previousElement = data.protyle.wysiwyg.element.querySelector(`[data-node-id="${previousID}"]`);
                        if (previousElement) {
                            previousElement.insertAdjacentHTML("afterend", html);
                            focusInsertedHeading(previousElement.nextElementSibling);
                        }
                        transaction(data.protyle, [{
                            action: "insert",
                            data: html,
                            id: newId,
                            previousID,
                        }], [{
                            action: "delete",
                            id: newId
                        }]);
                    });
                }
            }).element);
        }

        window.siyuan.menus.menu.append(new MenuItem({id: "separator_2", type: "separator"}).element);
    }

    // 复制带子标题
    window.siyuan.menus.menu.append(new MenuItem({
        id: "copyHeadings1",
        icon: "iconCopy",
        label: `${siyuanI18n.copy} ${siyuanI18n.headings1}`,
        click: () => {
            const data = getProtyleAndBlockElement(outline, element);
            if (!data) {
                return;
            }
            fetchPost("/api/block/getHeadingChildrenDOM", {
                id,
                removeFoldAttr: data.blockElement.getAttribute("fold") !== "1"
            }, async (response) => {
                if (!await writeHeadingClipboard(data.protyle, response.data)) {
                    reportClipboardFailure();
                }
            });
        }
    }).element);

    if (!window.siyuan.config.readonly) {
        // 剪切带子标题
        window.siyuan.menus.menu.append(new MenuItem({
            id: "cutHeadings1",
            icon: "iconCut",
            label: `${siyuanI18n.cut} ${siyuanI18n.headings1}`,
            click: () => {
                const data = getProtyleAndBlockElement(outline, element);
                if (!data) {
                    return;
                }
                fetchPost("/api/block/getHeadingChildrenDOM", {
                    id,
                    removeFoldAttr: data.blockElement.getAttribute("fold") !== "1"
                }, (response) => {
                    fetchPost("/api/block/getHeadingDeleteTransaction", {
                        id,
                    }, async (deleteResponse) => {
                        if (!await confirmHeadingDeletion(data.protyle, id, deleteResponse)) {
                            return;
                        }
                        if (!await writeHeadingClipboard(data.protyle, response.data)) {
                            reportClipboardFailure();
                            return;
                        }
                        deleteResponse.data.doOperations.forEach((operation: IOperation) => {
                            data.protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach((itemElement: HTMLElement) => {
                                itemElement.remove();
                            });
                        });
                        if (data.protyle.wysiwyg.element.childElementCount === 0) {
                            const newID = Lute.NewNodeID();
                            const emptyElement = genEmptyElement(false, false, newID);
                            data.protyle.wysiwyg.element.insertAdjacentElement("afterbegin", emptyElement);
                            deleteResponse.data.doOperations.push({
                                action: "insert",
                                data: emptyElement.outerHTML,
                                id: newID,
                                parentID: data.protyle.block.parentID
                            });
                            deleteResponse.data.undoOperations.push({
                                action: "delete",
                                id: newID,
                            });
                            focusBlock(emptyElement);
                        }
                        transaction(data.protyle, deleteResponse.data.doOperations, deleteResponse.data.undoOperations);
                    });
                });
            }
        }).element);

        // 删除
        window.siyuan.menus.menu.append(new MenuItem({
            id: "deleteHeadings1",
            icon: "iconTrashcan",
            label: `${siyuanI18n.delete} ${siyuanI18n.headings1}`,
            click: () => {
                const data = getProtyleAndBlockElement(outline, element);
                if (!data) {
                    return;
                }
                fetchPost("/api/block/getHeadingDeleteTransaction", {
                    id,
                }, async (response) => {
                    if (!await confirmHeadingDeletion(data.protyle, id, response)) {
                        return;
                    }
                    response.data.doOperations.forEach((operation: IOperation) => {
                        data.protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach((itemElement: HTMLElement) => {
                            itemElement.remove();
                        });
                    });
                    if (data.protyle.wysiwyg.element.childElementCount === 0) {
                        const newID = Lute.NewNodeID();
                        const emptyElement = genEmptyElement(false, false, newID);
                        data.protyle.wysiwyg.element.insertAdjacentElement("afterbegin", emptyElement);
                        response.data.doOperations.push({
                            action: "insert",
                            data: emptyElement.outerHTML,
                            id: newID,
                            parentID: data.protyle.block.parentID
                        });
                        response.data.undoOperations.push({
                            action: "delete",
                            id: newID,
                        });
                        focusBlock(emptyElement);
                    }
                    transaction(data.protyle, response.data.doOperations, response.data.undoOperations);
                });
            }
        }).element);
    }
    window.siyuan.menus.menu.append(new MenuItem({id: "separator_3", type: "separator"}).element);

    // 展开子标题
    window.siyuan.menus.menu.append(new MenuItem({
        id: "expandChildHeading",
        icon: "iconExpand",
        label: siyuanI18n.expandChildHeading,
        accelerator: "⌘" + siyuanI18n.clickArrow,
        click: () => collapseChildren(outline, element, true)
    }).element);

    // 折叠子标题
    window.siyuan.menus.menu.append(new MenuItem({
        id: "foldChildHeading",
        icon: "iconContract",
        label: siyuanI18n.foldChildHeading,
        accelerator: "⌘" + siyuanI18n.clickArrow,
        click: () => collapseChildren(outline, element, false)
    }).element);

    // 展开同级标题
    window.siyuan.menus.menu.append(new MenuItem({
        id: "expandSameLevelHeading",
        icon: "iconExpand",
        label: siyuanI18n.expandSameLevelHeading,
        accelerator: "⌥" + siyuanI18n.clickArrow,
        click: () => collapseSameLevel(outline, element, true)
    }).element);

    // 折叠同级标题
    window.siyuan.menus.menu.append(new MenuItem({
        id: "foldSameLevelHeading",
        icon: "iconContract",
        label: siyuanI18n.foldSameLevelHeading,
        accelerator: "⌥" + siyuanI18n.clickArrow,
        click: () => collapseSameLevel(outline, element, false)
    }).element);

    // 全部展开
    window.siyuan.menus.menu.append(new MenuItem({
        id: "expandAll",
        icon: "iconExpand",
        label: siyuanI18n.expandAll,
        click: () => {
            outline.tree.expandAll();
            outline.saveExpendIds();
        }
    }).element);

    // 全部折叠
    window.siyuan.menus.menu.append(new MenuItem({
        id: "foldAll",
        icon: "iconContract",
        label: siyuanI18n.foldAll,
        click: () => {
            outline.tree.collapseAll();
            outline.saveExpendIds();
        }
    }).element);

    window.siyuan.menus.menu.fullscreen("bottom");
}
