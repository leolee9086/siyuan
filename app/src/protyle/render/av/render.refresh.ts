import {Constants} from "../../../constants";
import {addDragFill} from "./cell/decoration";
import {popTextCell} from "./cell/edit";
import {cellScrollIntoView} from "./cell/position";
import {renderAVAttribute} from "./blockAttr";
import {clearSelect} from "../../util/clearSelect";
import {showMessage} from "../../runtime/dialog.port";
import {openMenuPanel} from "./openMenuPanel";
import {avRender} from "./render";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import {hasClosestByClassName} from "../../util/hasClosest";
import {setAVLocateRequest} from "./locate/state/state";
import { getGroupFoldTip } from "./groupFold";
import { updateGroupFoldedStates } from "./groupFold";

const refreshTimeouts: {
    [key: string]: number;
} = {};

const getAVElements = (protyle: IProtyle, avID: string, viewID?: string): HTMLElement[] => {
    const elements = Array.from(protyle.wysiwyg.element.querySelectorAll(`.av[data-av-id="${avID}"]`)) as HTMLElement[];
    if (viewID) {
        return elements.filter((item) => getViewIDByAVElement(item) === viewID);
    }
    return elements;
};

const getViewIDByAVElement = (avElement: HTMLElement): string | null => {
    return avElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW)
        || avElement.querySelector(".layout-tab-bar .item--focus")?.getAttribute("data-id") // 旧版本的数据库块没有 CUSTOM_SY_AV_VIEW 属性，所以在视图元素上获取 viewID
        || null;
};

const isItemInData = (data: IAV, itemID: string): boolean => {
    const view = data.view as IAVTable & IAVGallery;
    if (view.groups?.length > 0) {
        return view.groups.some((group: IAVTable & IAVGallery) => {
            const items = data.viewType === "table" ? group.rows : group.cards;
            return items?.some((item: IAVRow | IAVGalleryItem) => item.id === itemID);
        });
    }
    const items = data.viewType === "table" ? view.rows : view.cards;
    return items?.some((item: IAVRow | IAVGalleryItem) => item.id === itemID);
};

const addingFocusTokens = new Map<string, symbol>();

const scrollAddingCellIntoView = (protyle: IProtyle, blockElement: HTMLElement, cellElement: HTMLElement) => {
    const rowElement = hasClosestByClassName(cellElement, "av__row");
    const bodyElement = hasClosestByClassName(cellElement, "av__body");
    if (rowElement && rowElement.dataset.index === "0" && bodyElement && !bodyElement.dataset.groupId) {
        const contentRect = protyle.contentElement.getBoundingClientRect();
        const blockRect = blockElement.getBoundingClientRect();
        protyle.contentElement.scrollTop += blockRect.top - contentRect.top;
        return;
    }
    cellScrollIntoView(blockElement, cellElement, false);
};

interface IAddingCellOptions {
    protyle: IProtyle;
    avID: string;
    blockID: string;
    itemID: string;
    groupID?: string;
}

const getAddingCellElement = (options: IAddingCellOptions) => {
    const blockElement = Array.from(options.protyle.wysiwyg.element.querySelectorAll(`.av[data-av-id="${options.avID}"]`)).find((item: HTMLElement) => {
        return item.dataset.nodeId === options.blockID;
    }) as HTMLElement;
    if (!blockElement) {
        return;
    }
    const groupQuery = options.groupID ? `[data-group-id="${options.groupID}"]` : "";
    let cellElement = blockElement.querySelector(`.av__body${groupQuery} [data-id="${options.itemID}"] .av__cell[data-dtype="block"]`) as HTMLElement;
    if (!cellElement) {
        const cellElements = blockElement.querySelectorAll(`.av__body [data-id="${options.itemID}"] .av__cell[data-dtype="block"]`);
        if (cellElements.length === 1) {
            cellElement = cellElements[0] as HTMLElement;
        }
    }
    if (!cellElement) {
        return;
    }
    return {blockElement, cellElement};
};

const waitForAddingCellPosition = async (options: IAddingCellOptions) => {
    let previousRect: DOMRect;
    let previousScrollTop: number;
    let stableFrames = 0;
    for (let i = 0; i < 120; i++) {
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
        });
        const result = getAddingCellElement(options);
        if (!result || result.cellElement.getBoundingClientRect().height === 0) {
            stableFrames = 0;
            continue;
        }
        const rect = result.cellElement.getBoundingClientRect();
        const scrollTop = options.protyle.contentElement.scrollTop;
        if (!options.protyle.wysiwyg.element.hasAttribute("data-top") && previousRect &&
            Math.abs(previousRect.top - rect.top) < 0.5 && Math.abs(previousRect.left - rect.left) < 0.5 &&
            Math.abs(previousRect.width - rect.width) < 0.5 && Math.abs(previousRect.height - rect.height) < 0.5 &&
            previousScrollTop === scrollTop) {
            stableFrames++;
            if (stableFrames === 2) {
                return result;
            }
        } else {
            stableFrames = 0;
        }
        previousRect = rect;
        previousScrollTop = scrollTop;
    }
};

export const refreshAV = (protyle: IProtyle, operation: IOperation) => {
    if (operation.action === "setAttrViewName") {
        getAVElements(protyle, operation.id).forEach((item) => {
            const titleElement = item.querySelector(".av__title") as HTMLElement;
            if (!titleElement) {
                return;
            }
            titleElement.textContent = operation.data;
            titleElement.dataset.title = operation.data;
        });
        return;
    }
    if (operation.action === "setAttrViewColWidth") {
        getAVElements(protyle, operation.avID, operation.viewID).forEach((item) => {
            const cellElement = item.querySelector(`.av__cell[data-col-id="${operation.id}"]`) as HTMLElement;
            if (!cellElement || cellElement.style.width === operation.data) {
                return;
            }
            item.querySelectorAll(".av__row").forEach(rowItem => {
                (rowItem.querySelector(`[data-col-id="${operation.id}"]`) as HTMLElement).style.width = operation.data;
            });
        });
        return;
    }
    if (operation.action === "setAttrViewColAlign") {
        getAVElements(protyle, operation.avID, operation.viewID).forEach((item) => {
            item.querySelectorAll(`.av__cell[data-col-id="${operation.id}"]`).forEach((cellElement: HTMLElement) => {
                cellElement.dataset.align = operation.data;
            });
        });
        return;
    }
    if (operation.action === "setAttrViewCardSize") {
        getAVElements(protyle, operation.avID, operation.viewID).forEach((item) => {
            if (item.getAttribute("data-av-type") === "kanban") {
                item.querySelectorAll(".av__kanban-group").forEach(galleryItem => {
                    galleryItem.classList.remove("av__kanban-group--small", "av__kanban-group--big");
                    if (operation.data === 0) {
                        galleryItem.classList.add("av__kanban-group--small");
                    } else if (operation.data === 2) {
                        galleryItem.classList.add("av__kanban-group--big");
                    }
                });
            } else {
                item.querySelectorAll(".av__gallery").forEach(galleryItem => {
                    galleryItem.classList.remove("av__gallery--small", "av__gallery--big");
                    if (operation.data === 0) {
                        galleryItem.classList.add("av__gallery--small");
                    } else if (operation.data === 2) {
                        galleryItem.classList.add("av__gallery--big");
                    }
                });
            }
        });
        return;
    }
    if (operation.action === "setAttrViewCardAspectRatio") {
        getAVElements(protyle, operation.avID, operation.viewID).forEach((item) => {
            item.querySelectorAll(".av__gallery-cover").forEach(coverItem => {
                coverItem.className = "av__gallery-cover av__gallery-cover--" + operation.data;
            });
        });
        return;
    }
    if (operation.action === "hideAttrViewName") {
        getAVElements(protyle, operation.avID, operation.viewID).forEach((item) => {
            const titleElement = item.querySelector(".av__title");
            if (titleElement) {
                if (!operation.data) {
                    titleElement.classList.remove("fn__none");
                } else {
                    // hide
                    titleElement.classList.add("fn__none");
                }
                if (item.getAttribute("data-av-type") === "gallery" && !item.querySelector(".av__group-title")) {
                    const galleryElement = item.querySelector(".av__gallery");
                    if (!operation.data) {
                        galleryElement.classList.remove("av__gallery--top");
                    } else {
                        // hide
                        galleryElement.classList.add("av__gallery--top");
                    }
                }
            }
        });
        return;
    }
    if (operation.action === "setAttrViewWrapField") {
        getAVElements(protyle, operation.avID, operation.viewID).forEach((item) => {
            item.querySelectorAll(".av__cell").forEach(fieldItem => {
                fieldItem.setAttribute("data-wrap", operation.data.toString());
            });
        });
        return;
    }
    if (operation.action === "setAttrViewFillColBackgroundColor") {
        getAVElements(protyle, operation.avID, operation.viewID).forEach((avItem: HTMLElement) => {
            const hasSelect = avItem.querySelector(".av__group-title .b3-chip");
            const kanbanElement = avItem.querySelector(".av__kanban");
            if (operation.data && hasSelect) {
                kanbanElement.classList.add("av__kanban--bg");
            } else {
                kanbanElement.classList.remove("av__kanban--bg");
            }
            avItem.querySelectorAll(".av__kanban-group").forEach(item => {
                if (operation.data && hasSelect) {
                    const nameElement = item.querySelector(".av__group-title .b3-chip") as HTMLElement;
                    if (nameElement) {
                        item.setAttribute("style", `--b3-av-kanban-background:var(--b3-font-background${nameElement.style.backgroundColor.slice(-2, -1)})`);
                    } else {
                        item.setAttribute("style", "--b3-av-kanban-background: var(--b3-border-color)");
                    }
                } else {
                    item.removeAttribute("style");
                }
            });
        });
        return;
    }
    if (operation.action === "setAttrViewFitImage") {
        getAVElements(protyle, operation.avID, operation.viewID).forEach((item) => {
            const imgElement = item.querySelector(".av__gallery-img");
            if (operation.data) {
                imgElement.classList.add("av__gallery-img--fit");
            } else {
                imgElement.classList.remove("av__gallery-img--fit");
            }
        });
        return;
    }
    if (operation.action === "setAttrViewShowIcon") {
        getAVElements(protyle, operation.avID, operation.viewID).forEach((item) => {
            item.querySelectorAll('.av__cell[data-dtype="block"] .b3-menu__avemoji').forEach(cellItem => {
                cellItem.classList.toggle("fn__none", !operation.data);
            });
            item.querySelectorAll('.av__cell[data-dtype="relation"] .av__cell--relation').forEach(cellItem => {
                cellItem.firstElementChild.classList.toggle("fn__none", !operation.data);
            });
        });
        return;
    }
    if (operation.action === "setAttrViewColWrap") {
        getAVElements(protyle, operation.avID, operation.viewID).forEach((item) => {
            item.querySelectorAll(`.av__cell[data-col-id="${operation.id}"],.av__cell[data-field-id="${operation.id}"]`).forEach(cellItem => {
                cellItem.setAttribute("data-wrap", operation.data.toString());
            });
        });
        return;
    }
    if (operation.action === "foldAttrViewGroup" || operation.action === "foldAttrViewGroups") {
        const folded = operation.action === "foldAttrViewGroup"
            ? {[operation.id]: operation.data as boolean}
            : operation.data as Record<string, boolean>;
        getAVElements(protyle, operation.avID, operation.viewID).forEach((item) => {
            updateGroupFoldedStates(item as HTMLElement, folded);
            Object.entries(folded).forEach(([groupID, groupFolded]) => {
                const foldElement = item.querySelector(`[data-type="av-group-fold"][data-id="${groupID}"]`) as HTMLElement;
                if (!foldElement) {
                    return;
                }
                if (foldElement.getAttribute("data-processed") === "true") {
                    foldElement.removeAttribute("data-processed");
                    return;
                }
                foldElement.firstElementChild.classList.toggle("av__group-arrow--open", !groupFolded);
                foldElement.parentElement.nextElementSibling.classList.toggle("fn__none", groupFolded);
                foldElement.setAttribute("aria-label", getGroupFoldTip(groupFolded));
                foldElement.removeAttribute("data-folding");
            });
        });
        return;
    }
    const addingFocusKey = `${protyle.id}-${operation.avID}`;
    const addingFocusToken = Symbol();
    if (operation.action === "insertAttrViewBlock") {
        addingFocusTokens.set(addingFocusKey, addingFocusToken);
    } else {
        addingFocusTokens.delete(addingFocusKey);
    }
    // 只能 setTimeout，以前方案快速输入后最后一次修改会被忽略；必须为每一个 protyle 单独设置，否则有多个 protyle 时，其余无法被执行
    clearTimeout(refreshTimeouts[protyle.id]);
    refreshTimeouts[protyle.id] = window.setTimeout(() => {
        // 修改表格名 avID 传入到 id 上了 https://github.com/siyuan-note/siyuan/issues/12724
        const avID = operation.action === "setAttrViewName" ? operation.id : operation.avID;
        const attrElement = document.querySelector(`.b3-dialog--open[data-key="${Constants.DIALOG_ATTR}"] .custom-attr > [data-av-id="${avID}"]`) as HTMLElement;
        if (attrElement) {
            // 更新属性面板
            attrElement.removeAttribute("data-rendering");
            renderAVAttribute(attrElement.parentElement, attrElement.dataset.nodeId, protyle);
        }
        getAVElements(protyle, avID).forEach((item) => {
            item.removeAttribute("data-render");
            if (operation.action === "replaceAttrViewBlock" && operation.retData?.duplicate &&
                (!operation.blockID || operation.blockID === item.dataset.nodeId) &&
                (!operation.context?.protyleID || operation.context.protyleID === protyle.id)) {
                setAVLocateRequest(item, {
                    itemID: operation.retData.targetItemID,
                    select: true,
                });
            }
            if (operation.action === "sortAttrViewRow") {
                clearSelect(["cell"], item);
            } else if (operation.action === "sortAttrViewCol") {
                item.querySelectorAll(".av__cell--active").forEach((item) => {
                    item.classList.remove("av__cell--active");
                    item.querySelector(".av__drag-fill")?.remove();
                });
                addDragFill(item.querySelector(".av__cell--select"));
            } else if (operation.action === "setAttrViewBlockView") {
                const viewTabElement = item.querySelector(`.av__views > .layout-tab-bar > .item[data-id="${operation.id}"]`) as HTMLElement;
                if (viewTabElement) {
                    item.querySelectorAll(".av__body").forEach((bodyItem: HTMLElement) => {
                        bodyItem.dataset.pageSize = viewTabElement.dataset.page;
                    });
                }
            } else if (operation.action === "addAttrViewView") {
                item.querySelectorAll(".av__body").forEach((bodyItem: HTMLElement) => {
                    bodyItem.dataset.pageSize = "50";
                });
            } else if (operation.action === "removeAttrViewView") {
                item.querySelectorAll(".av__body").forEach((bodyItem: HTMLElement) => {
                    bodyItem.dataset.pageSize = item.querySelector(`.av__views > .layout-tab-bar .item[data-id="${getViewIDByAVElement(item)}"]`)?.getAttribute("data-page");
                });
            } else if (operation.action === "sortAttrViewView" && operation.data === "unRefresh") {
                const viewTabElement = item.querySelector(`.av__views > .layout-tab-bar > .item[data-id="${operation.id}"]`) as HTMLElement;
                if (viewTabElement && !operation.previousID && !viewTabElement.previousElementSibling) {
                    return;
                } else if (viewTabElement && operation.previousID && viewTabElement.previousElementSibling?.getAttribute("data-id") === operation.previousID) {
                    return;
                }
            }
            const hasGhost = item.querySelector('[data-type="ghost"]');
            avRender(item, protyle, (data: IAV) => {
                if (operation.action === "insertAttrViewBlock" && operation.context?.ignoreTip !== "true") {
                    if (operation.context?.message) {
                        showMessage(operation.context.message);
                    } else {
                        const groupQuery = operation.groupID ? `[data-group-id="${operation.groupID}"]` : "";
                        if (["gallery", "kanban"].includes(item.getAttribute("data-av-type"))) {
                            operation.srcs.forEach(srcItem => {
                                const filesElement = item.querySelector(`.av__body${groupQuery} .av__gallery-item[data-id="${srcItem.itemID}"]`)?.querySelector(".av__gallery-fields");
                                if (filesElement && filesElement.querySelector('[data-dtype="block"]')?.parentElement.getAttribute("data-empty") === "true") {
                                    filesElement.classList.add("av__gallery-fields--edit");
                                }
                            });
                        }
                        let isAddingFocusPending = false;
                        if (operation.srcs.length === 1) {
                            let popCellElement = item.querySelector(`.av__body${groupQuery} [data-id="${operation.srcs[0].itemID}"] .av__cell[data-dtype="block"]`) as HTMLElement;
                            if (!popCellElement) {
                                const popCellElements = item.querySelectorAll(`.av__body [data-id="${operation.srcs[0].itemID}"] .av__cell[data-dtype="block"]`);
                                if (popCellElements.length === 1) {
                                    popCellElement = popCellElements[0] as HTMLElement;
                                }
                            }
                            if (popCellElement && popCellElement.getAttribute("data-detached") === "true" &&
                                popCellElement.querySelector(".av__celltext").textContent === "" &&
                                popCellElement.getBoundingClientRect().height !== 0 && hasGhost) {
                                if (item.getAttribute("data-av-type") !== "table") {
                                    if (addingFocusTokens.get(addingFocusKey) === addingFocusToken) {
                                        addingFocusTokens.delete(addingFocusKey);
                                        popTextCell(protyle, [popCellElement], "block");
                                    }
                                } else {
                                    isAddingFocusPending = true;
                                    const addingCellOptions = {
                                        protyle,
                                        avID,
                                        blockID: item.dataset.nodeId,
                                        itemID: operation.srcs[0].itemID,
                                        groupID: operation.groupID,
                                    };
                                    scrollAddingCellIntoView(protyle, item, popCellElement);
                                    waitForAddingCellPosition(addingCellOptions).then((result) => {
                                        if (addingFocusTokens.get(addingFocusKey) !== addingFocusToken) {
                                            return;
                                        }
                                        addingFocusTokens.delete(addingFocusKey);
                                        if (!result || result.cellElement.getAttribute("data-detached") !== "true" ||
                                            result.cellElement.querySelector(".av__celltext").textContent !== "") {
                                            return;
                                        }
                                        popTextCell(protyle, [result.cellElement], "block", {scrollIntoView: false});
                                    });
                                }
                            }
                        }
                        if (hasGhost && !isAddingFocusPending &&
                            addingFocusTokens.get(addingFocusKey) === addingFocusToken) {
                            addingFocusTokens.delete(addingFocusKey);
                        }
                        operation.srcs.find((srcItem) => {
                            if (!isItemInData(data, srcItem.itemID)) {
                                showMessage(siyuanI18n.databaseItemFiltered);
                                return true;
                            }
                        });
                    }
                } else if (operation.action === "addAttrViewView") {
                    if (item.getAttribute("data-node-id") === operation.blockID) {
                        openMenuPanel({protyle, blockElement: item, type: "config"});
                    }
                }
                item.removeAttribute("data-loading");
            });
        });
    }, ["insertAttrViewBlock", "addAttrViewCol", "removeAttrViewCol", "duplicateAttrViewKey"].includes(operation.action) ? 2 : 100);
};
