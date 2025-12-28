/**
 * Outline 右键菜单中的编辑相关功能
 * 从 Outline.contextMenu.ts 进一步拆分
 */
import { MenuItem } from "../../../menus/Menu.Item";
import { Constants } from "../../../constants";
import { fetchPost } from "../../../util/fetch";
import { getAllModels } from "../../getAll";
import { transaction, turnsIntoTransaction } from "../../../protyle/wysiwyg/transaction";
import { genEmptyElement } from "../../../block/util";
import { focusBlock, focusByWbr } from "../../../protyle/util/selection";
import { mathRender } from "../../../protyle/render/mathRender";
import { isInAndroid, isInHarmony, writeText } from "../../../protyle/util/compatibility";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getWindowJSAndroid, getWindowJSHarmony } from "../../../util/siyuanEnvironments/windowNative.environment";
import { isOperations, isHTMLElement } from "../dock.guard";
import type { Outline } from "./Outline";

/** 获取 Protyle 和块元素 */
export function getProtyleAndBlockElement(this: Outline, element: HTMLElement) {
    const id = element.getAttribute("data-node-id");
    const editItem = getAllModels().editor.find(editItem => editItem.editor.protyle.block.rootID === this.blockId);
    if (!editItem) {
        return;
    }
    const protyle = editItem.editor.protyle;
    if (!protyle.wysiwyg) {
        return;
    }
    const blockElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`);
    if (!blockElement || !isHTMLElement(blockElement)) {
        return;
    }
    return { protyle, blockElement };
}

/** 处理标题级别变换的响应 */
const 处理标题级别变换响应 = (protyle: IProtyle, responseData: { doOperations: IOperation[]; undoOperations: IOperation[] }) => {
    for (const op of responseData.doOperations) {
        const elements = protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${op.id}"]`);
        for (const el of elements) {
            if (isHTMLElement(el)) {
                el.outerHTML = op.data;
            }
        }
        const newElements = protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${op.id}"]`);
        for (const el of newElements) {
            if (isHTMLElement(el)) {
                mathRender(el);
            }
        }
    }
    const firstOp = responseData.doOperations[0];
    if (firstOp) {
        const focusEl = protyle.wysiwyg.element.querySelector(`[data-node-id="${firstOp.id}"]`);
        focusEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    transaction(protyle, responseData.doOperations, responseData.undoOperations);
};

/** 生成标题级别转换菜单项 */
export function genHeadingTransform(this: Outline, id: string, level: number) {
    return {
        id: "heading" + level, iconHTML: "", icon: "iconHeading" + level,
        label: siyuanI18n["heading" + level],
        click: () => {
            const editItem = getAllModels().editor.find(editItem => editItem.editor.protyle.block.rootID === this.blockId);
            if (!editItem) {
                return;
            }
            const protyle = editItem.editor.protyle;
            fetchPost("/api/block/getHeadingLevelTransaction", { id, level }, (response) => {
                if (!protyle || !response.data) {
                    return;
                }
                处理标题级别变换响应(protyle, response.data);
            });
        }
    };
}

/** 添加升降级菜单项 */
export function appendLevelMenuItems(this: Outline, element: HTMLElement, id: string, currentLevel: number) {
    if (currentLevel > 1) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "upgrade", icon: "iconUp", label: siyuanI18n.upgrade,
            click: () => {
                const data = this.getProtyleAndBlockElement(element);
                if (data) {
                    turnsIntoTransaction({
                        protyle: data.protyle,
                        selectsElement: [data.blockElement],
                        type: "Blocks2Hs",
                        level: currentLevel - 1
                    });
                }
            }
        }).element);
    }
    if (currentLevel < 6) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "downgrade", icon: "iconDown", label: siyuanI18n.downgrade,
            click: () => {
                const data = this.getProtyleAndBlockElement(element);
                if (data) {
                    turnsIntoTransaction({
                        protyle: data.protyle,
                        selectsElement: [data.blockElement],
                        type: "Blocks2Hs",
                        level: currentLevel + 1
                    });
                }
            }
        }).element);
    }
    const headingSubMenu = [];
    for (let i = 1; i <= 6; i++) {
        if (currentLevel !== i) {
            headingSubMenu.push(this.genHeadingTransform(id, i));
        }
    }
    if (headingSubMenu.length > 0) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "tWithSubtitle", type: "submenu", icon: "iconRefresh", label: siyuanI18n.tWithSubtitle, submenu: headingSubMenu }).element);
    }
}

const genHeadingHTML = (level: number, newId: string) => `<div data-subtype="h${level}" data-node-id="${newId}" data-type="NodeHeading" class="h${level}"><div contenteditable="true" spellcheck="false"><wbr></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;

/** 创建插入同级标题后的响应处理器 */
const 创建插入同级标题后处理器 = (
    获取Protyle和块元素: () => { protyle: IProtyle; blockElement: HTMLElement } | undefined,
    currentLevel: number
) => (response: IWebSocketData) => {
    const data = 获取Protyle和块元素();
    if (!data || !response.data || !isOperations(response.data.doOperations)) {
        return;
    }
    const doOps = response.data.doOperations;
    const lastOp = doOps[doOps.length - 1];
    const previousID = lastOp.id;
    const newId = Lute.NewNodeID(), html = genHeadingHTML(currentLevel, newId);
    transaction(data.protyle, [{ action: "insert", data: html, id: newId, previousID }], [{ action: "delete", id: newId }]);
    const prevEl = data.protyle.wysiwyg.element.querySelector(`[data-node-id="${previousID}"]`);
    if (!prevEl) {
        return;
    }
    prevEl.insertAdjacentHTML("afterend", html);
    const nextEl = prevEl.nextElementSibling;
    if (nextEl) {
        nextEl.scrollIntoView();
        focusByWbr(nextEl, document.createRange());
    }
};

/** 创建添加子标题的响应处理器 */
const 创建添加子标题响应处理器 = (
    获取Protyle和块元素: () => { protyle: IProtyle; blockElement: HTMLElement } | undefined,
    currentLevel: number
) => (delResp: IWebSocketData) => {
    let previousID = delResp.data.doOperations[delResp.data.doOperations.length - 1].id;
    const idx = delResp.data.undoOperations.findIndex((op: IOperation) => {
        const si = op.data.indexOf(' data-subtype="h');
        return si > -1 && si < 260 && parseInt(op.data.substring(si + 16, si + 17)) === currentLevel + 1;
    });
    if (idx > -1) {
        previousID = delResp.data.undoOperations[idx - 1].id;
    }
    const data = 获取Protyle和块元素();
    if (!data) {
        return;
    }
    const newId = Lute.NewNodeID(), html = genHeadingHTML(currentLevel + 1, newId);
    transaction(data.protyle, [{ action: "insert", data: html, id: newId, previousID }], [{ action: "delete", id: newId }]);
    const prevEl = data.protyle.wysiwyg.element.querySelector(`[data-node-id="${previousID}"]`);
    if (prevEl) {
        prevEl.insertAdjacentHTML("afterend", html);
        const nextEl = prevEl.nextElementSibling;
        if (nextEl) {
            nextEl.scrollIntoView();
            focusByWbr(nextEl, document.createRange());
        }
    }
};

/** 添加插入标题菜单项 */
export function appendInsertMenuItems(this: Outline, element: HTMLElement, id: string, currentLevel: number) {
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "insertSameLevelHeadingBefore", icon: "iconBefore", label: siyuanI18n.insertSameLevelHeadingBefore,
        click: () => {
            const data = this.getProtyleAndBlockElement(element);
            if (!data) {
                return;
            }
            const newId = Lute.NewNodeID(), html = genHeadingHTML(currentLevel, newId);
            transaction(data.protyle, [{ action: "insert", data: html, id: newId, previousID: data.blockElement.previousElementSibling?.getAttribute("data-node-id") ?? undefined, parentID: data.blockElement.parentElement.getAttribute("data-node-id") || data.protyle.block.parentID }], [{ action: "delete", id: newId }]);
            data.blockElement.insertAdjacentHTML("beforebegin", html);
            const 新插入的元素 = data.blockElement.previousElementSibling;
            if (新插入的元素 instanceof HTMLElement) {
                新插入的元素.scrollIntoView();
                focusByWbr(新插入的元素, document.createRange());
            }
        }
    }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "insertSameLevelHeadingAfter", icon: "iconAfter", label: siyuanI18n.insertSameLevelHeadingAfter,
        click: () => {
            fetchPost("/api/block/getHeadingDeleteTransaction", { id }, 创建插入同级标题后处理器(() => this.getProtyleAndBlockElement(element), currentLevel));
        }
    }).element);
    if (currentLevel < 6) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "addChildHeading", icon: "iconAdd", label: siyuanI18n.addChildHeading,
            click: () => {
                fetchPost("/api/block/getHeadingDeleteTransaction", { id }, 创建添加子标题响应处理器(() => this.getProtyleAndBlockElement(element), currentLevel));
            }
        }).element);
    }
}

const writeClipboard = (protyle: IProtyle, respData: string) => {
    if (isInAndroid()) {
        getWindowJSAndroid()?.writeHTMLClipboard(protyle.lute.BlockDOM2StdMd(respData).trimEnd(), respData + Constants.ZWSP);
    } else if (isInHarmony()) {
        getWindowJSHarmony()?.writeHTMLClipboard(protyle.lute.BlockDOM2StdMd(respData).trimEnd(), respData + Constants.ZWSP);
    } else {
        writeText(respData + Constants.ZWSP);
    }
};

const handleEmptyContent = (protyle: IProtyle, doOps: IOperation[], undoOps: IOperation[]) => {
    if (protyle.wysiwyg.element.childElementCount === 0) {
        const newID = Lute.NewNodeID(), emptyEl = genEmptyElement(false, false, newID);
        protyle.wysiwyg.element.insertAdjacentElement("afterbegin", emptyEl);
        doOps.push({ action: "insert", data: emptyEl.outerHTML, id: newID, parentID: protyle.block.parentID });
        undoOps.push({ action: "delete", id: newID });
        focusBlock(emptyEl);
    }
};

/** 添加复制/剪切/删除菜单项 */
export function appendClipboardMenuItems(this: Outline, element: HTMLElement, id: string) {
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "copyHeadings1", icon: "iconCopy", label: `${siyuanI18n.copy} ${siyuanI18n.headings1}`,
        click: () => {
            const data = this.getProtyleAndBlockElement(element);
            fetchPost("/api/block/getHeadingChildrenDOM", { id, removeFoldAttr: data.blockElement.getAttribute("fold") !== "1" }, (resp) => {
                writeClipboard(data.protyle, resp.data);
            });
        }
    }).element);
    if (!getSiyuanConfig().readonly) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "cutHeadings1", icon: "iconCut", label: `${siyuanI18n.cut} ${siyuanI18n.headings1}`,
            click: () => {
                const data = this.getProtyleAndBlockElement(element);
                fetchPost("/api/block/getHeadingChildrenDOM", { id, removeFoldAttr: data.blockElement.getAttribute("fold") !== "1" }, (resp) => {
                    writeClipboard(data.protyle, resp.data);
                    fetchPost("/api/block/getHeadingDeleteTransaction", { id }, (delResp) => {
                        delResp.data.doOperations.forEach((op: IOperation) => {
                            data.protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${op.id}"]`).forEach((el: HTMLElement) => el.remove());
                        });
                        handleEmptyContent(data.protyle, delResp.data.doOperations, delResp.data.undoOperations);
                        transaction(data.protyle, delResp.data.doOperations, delResp.data.undoOperations);
                    });
                });
            }
        }).element);
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "deleteHeadings1", icon: "iconTrashcan", label: `${siyuanI18n.delete} ${siyuanI18n.headings1}`,
            click: () => {
                const data = this.getProtyleAndBlockElement(element);
                fetchPost("/api/block/getHeadingDeleteTransaction", { id }, (resp) => {
                    resp.data.doOperations.forEach((op: IOperation) => {
                        data.protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${op.id}"]`).forEach((el: HTMLElement) => el.remove());
                    });
                    handleEmptyContent(data.protyle, resp.data.doOperations, resp.data.undoOperations);
                    transaction(data.protyle, resp.data.doOperations, resp.data.undoOperations);
                });
            }
        }).element);
    }
}
