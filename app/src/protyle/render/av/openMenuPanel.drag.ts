import {transaction} from "../../wysiwyg/transaction/submit";
import {submitAVFilterTransaction} from "../../wysiwyg/transaction/prepared/av/view/avFilter";
/** 用途：提交分组拖拽排序；使用范围：Groups 拖拽分支；解耦评估：经 Groups drag 网关直达严格命令。 */
import {submitAVGroupTransaction} from "./group/drag/imports";
import { hasClosestByAttribute } from "../../util/hasClosest";
import {bindEditEvent, getEditHTML} from "./col/edit/render";
import {getColId} from "./col/identity/resolve";
import { getSelectHTML, bindSelectEvent } from "./select";
import { getEditableFilters, getFilterByPath, getFiltersHTML, getParentByPath } from "./filter";
import { getSortsHTML, bindSortsEvent } from "./sort";
import { updateAssetCell } from "./asset";
import {updateCellsValue} from "./cell.update";
import { getLanguageByIndex } from "./groups";
import { getPropertiesHTML } from "./col/properties/render";
import type { IMenuPanelContext } from "./openMenuPanel.types";

export const bindDragEvents = (ctx: IMenuPanelContext) => {
    const { avPanelElement, menuElement, options, avID, blockID, isCustomAttr } = ctx;

    avPanelElement.addEventListener("dragstart", (event: DragEvent) => {
        const target = event.target as HTMLElement;
        if (target.dataset.emptyGroup) {
            event.preventDefault();
            return;
        }
        window.siyuan.dragElement = target;
        window.siyuan.dragElement.style.opacity = ".38";
        return;
    });
    avPanelElement.addEventListener("drop", (event) => {
        counter = 0;
        if (!window.siyuan.dragElement) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        window.siyuan.dragElement.style.opacity = "";
        const sourceElement = window.siyuan.dragElement;
        window.siyuan.dragElement = undefined;
        if (options.protyle && options.protyle.disabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (!options.protyle && window.siyuan.config.readonly) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        const targetElement = avPanelElement.querySelector(".dragover__bottom, .dragover__top") as HTMLElement;
        if (!targetElement) {
            return;
        }
        const isTop = targetElement.classList.contains("dragover__top");
        const sourceId = sourceElement.dataset.id;
        const targetId = targetElement.dataset.id;
        if (targetElement.querySelector('[data-type="removeSort"]')) {
            const changeData = ctx.data.view.sorts;
            const oldData = Object.assign([], changeData);
            let sortFilter: IAVSort;
            changeData.find((sort, index: number) => {
                if (sort.column === sourceId) {
                    sortFilter = changeData.splice(index, 1)[0];
                    return true;
                }
            });
            changeData.find((sort, index: number) => {
                if (sort.column === targetId) {
                    if (isTop) {
                        changeData.splice(index, 0, sortFilter);
                    } else {
                        changeData.splice(index + 1, 0, sortFilter);
                    }
                    return true;
                }
            });

            transaction(options.protyle, [{
                action: "setAttrViewSorts",
                avID,
                data: changeData,
                blockID
            }], [{
                action: "setAttrViewSorts",
                avID,
                data: oldData,
                blockID
            }]);
            menuElement.innerHTML = getSortsHTML(ctx.fields, ctx.data.view.sorts);
            bindSortsEvent(options.protyle, menuElement, ctx.data, blockID);
            return;
        }
        if (targetElement.querySelector('[data-type="removeFilter"], [data-type="moreFilter"]') || targetElement.dataset.emptyGroup) {
            const sourcePath = sourceElement.dataset.path;
            const targetPath = targetElement.dataset.path;
            if (sourcePath && targetPath && sourcePath !== targetPath) {
                const editable = getEditableFilters(ctx.data);
                const src = getParentByPath(editable, sourcePath);
                const oldData = JSON.parse(JSON.stringify(ctx.data.view.filters));
                let moved: IAVFilter;
                let targetParent: IAVFilter[];
                let insertIndex: number;

                if (targetElement.dataset.emptyGroup) {
                    const groupNode = getFilterByPath(editable, targetPath);
                    if (!groupNode || !src.parent || src.index < 0 || src.index >= src.parent.length) {
                        return;
                    }
                    targetParent = groupNode.filters || (groupNode.filters = []);
                    [moved] = src.parent.splice(src.index, 1);
                    insertIndex = 0;
                } else {
                    const tgt = getParentByPath(editable, targetPath);
                    if (!src.parent || !tgt.parent || src.index < 0 || src.index >= src.parent.length || tgt.index < 0 || tgt.index >= tgt.parent.length) {
                        return;
                    }
                    const sameParent = src.parent === tgt.parent;
                    [moved] = src.parent.splice(src.index, 1);
                    if (!moved) {
                        ctx.data.view.filters = oldData;
                        return;
                    }
                    targetParent = tgt.parent;
                    insertIndex = sameParent ? (src.index < tgt.index ? tgt.index - 1 : tgt.index) : tgt.index;
                }

                if (!moved) {
                    ctx.data.view.filters = oldData;
                    return;
                }
                targetParent.splice(isTop ? insertIndex : insertIndex + 1, 0, moved);
                submitAVFilterTransaction(options.protyle, [{
                    action: "setAttrViewFilters",
                    avID,
                    data: ctx.data.view.filters,
                    blockID
                }], [{
                    action: "setAttrViewFilters",
                    avID,
                    data: oldData,
                    blockID
                }]);
            } else {
                const changeData = ctx.data.view.filters;
                const oldData = Object.assign([], changeData);
                let targetFilter: IAVFilter;
                changeData.find((filter, index: number) => {
                    if (filter.column === sourceId) {
                        targetFilter = changeData.splice(index, 1)[0];
                        return true;
                    }
                });
                changeData.find((filter, index: number) => {
                    if (filter.column === targetId) {
                        if (isTop) {
                            changeData.splice(index, 0, targetFilter);
                        } else {
                            changeData.splice(index + 1, 0, targetFilter);
                        }
                        return true;
                    }
                });

                submitAVFilterTransaction(options.protyle, [{
                    action: "setAttrViewFilters",
                    avID,
                    data: changeData,
                    blockID
                }], [{
                    action: "setAttrViewFilters",
                    avID,
                    data: oldData,
                    blockID
                }]);
            }
            menuElement.innerHTML = getFiltersHTML(ctx.data);
            return;
        }
        if (targetElement.querySelector('[data-type="av-view-edit"]')) {
            transaction(options.protyle, [{
                action: "sortAttrViewView",
                avID,
                blockID,
                id: sourceId,
                previousID: isTop ? targetElement.previousElementSibling?.getAttribute("data-id") : targetElement.getAttribute("data-id")
            }], [{
                action: "sortAttrViewView",
                avID,
                blockID,
                id: sourceId,
                previousID: sourceElement.previousElementSibling?.getAttribute("data-id")
            }]);
            if (isTop) {
                targetElement.before(sourceElement);
                targetElement.classList.remove("dragover__top");
            } else {
                targetElement.after(sourceElement);
                targetElement.classList.remove("dragover__bottom");
            }
            return;
        }
        if (targetElement.querySelector('[data-type="editAssetItem"]')) {
            if (isTop) {
                targetElement.before(sourceElement);
            } else {
                targetElement.after(sourceElement);
            }
            const replaceValue: IAVCellAssetValue[] = [];
            Array.from(targetElement.parentElement.children).forEach((item: HTMLElement) => {
                if (["image", "file"].includes(item.dataset.type)) {
                    replaceValue.push({
                        content: item.dataset.content,
                        name: item.dataset.name,
                        type: item.dataset.type as "image" | "file",
                    });
                }
            });
            updateAssetCell({
                protyle: options.protyle,
                cellElements: options.cellElements,
                replaceValue,
                blockElement: options.blockElement
            });
            return;
        }
        if (targetElement.querySelector('[data-type="setColOption"]')) {
            const colId = options.cellElements ? getColId(options.cellElements[0], ctx.data.viewType) : menuElement.querySelector(".b3-menu__item").getAttribute("data-col-id");
            const changeData = ctx.fields.find((column) => column.id === colId).options;
            const oldData = Object.assign([], changeData);
            let targetOption: { name: string, color: string };
            changeData.find((option, index: number) => {
                if (option.name === sourceElement.dataset.name) {
                    targetOption = changeData.splice(index, 1)[0];
                    return true;
                }
            });
            changeData.find((option, index: number) => {
                if (option.name === targetElement.dataset.name) {
                    if (isTop) {
                        changeData.splice(index, 0, targetOption);
                    } else {
                        changeData.splice(index + 1, 0, targetOption);
                    }
                    return true;
                }
            });
            transaction(options.protyle, [{
                action: "updateAttrViewColOptions",
                id: colId,
                avID,
                data: changeData,
            }], [{
                action: "updateAttrViewColOptions",
                id: colId,
                avID,
                data: oldData,
            }]);
            const oldScroll = menuElement.querySelector(".b3-menu__items").scrollTop;
            if (options.cellElements) {
                menuElement.innerHTML = getSelectHTML(ctx.fields, options.cellElements, false, options.blockElement);
                bindSelectEvent(options.protyle, ctx.data, menuElement, options.cellElements, options.blockElement);
            } else {
                menuElement.innerHTML = getEditHTML({
                    protyle: options.protyle,
                    data: ctx.data,
                    colId,
                    isCustomAttr
                });
                bindEditEvent({ protyle: options.protyle, data: ctx.data, menuElement, isCustomAttr, blockID });
            }
            menuElement.querySelector(".b3-menu__items").scrollTop = oldScroll;
            return;
        }
        if (targetElement.getAttribute("data-type") === "setRelationCell") {
            if (isTop) {
                targetElement.before(sourceElement);
            } else {
                targetElement.after(sourceElement);
            }
            targetElement.classList.remove("dragover__bottom", "dragover__top");
            const blockIDs: string[] = [];
            const contents: IAVCellValue[] = [];
            targetElement.parentElement.querySelectorAll(".fn__grab").forEach(item => {
                const dateElement = item.nextElementSibling as HTMLElement;
                blockIDs.push(dateElement.parentElement.dataset.rowId);
                contents.push({
                    isDetached: !dateElement.style.color,
                    type: "block",
                    block: {
                        content: dateElement.textContent,
                        id: dateElement.dataset.id
                    }
                });
            });
            updateCellsValue(options.protyle, options.blockElement as HTMLElement, {
                blockIDs,
                contents,
            }, options.cellElements);
            return;
        }
        if (targetElement.getAttribute("data-type") === "editCol") {
            const previousID = (isTop ? targetElement.previousElementSibling?.getAttribute("data-id") : targetElement.getAttribute("data-id")) || "";
            const undoPreviousID = sourceElement.previousElementSibling?.getAttribute("data-id") || "";
            if (previousID !== undoPreviousID && previousID !== sourceId) {
                transaction(options.protyle, [{
                    action: "sortAttrViewCol",
                    avID,
                    previousID,
                    id: sourceId,
                    blockID,
                }], [{
                    action: "sortAttrViewCol",
                    avID,
                    previousID: undoPreviousID,
                    id: sourceId,
                    blockID
                }]);
                let column: IAVColumn;
                ctx.fields.find((item, index: number) => {
                    if (item.id === sourceId) {
                        column = ctx.fields.splice(index, 1)[0];
                        return true;
                    }
                });
                ctx.fields.find((item, index: number) => {
                    if (item.id === targetId) {
                        if (isTop) {
                            ctx.fields.splice(index, 0, column);
                        } else {
                            ctx.fields.splice(index + 1, 0, column);
                        }
                        return true;
                    }
                });
            }
            menuElement.innerHTML = getPropertiesHTML(ctx.fields);
            return;
        }
        if (targetElement.querySelector('[data-type="hideGroup"]')) {
            const previousID = (isTop ? targetElement.previousElementSibling?.getAttribute("data-id") : targetElement.getAttribute("data-id")) || "";
            const undoPreviousID = sourceElement.previousElementSibling?.getAttribute("data-id") || "";
            if (previousID !== undoPreviousID && previousID !== sourceId) {
                submitAVGroupTransaction(options.protyle, [{
                    action: "sortAttrViewGroup",
                    avID,
                    blockID,
                    previousID,
                    id: sourceId,
                }], [{
                    action: "sortAttrViewGroup",
                    avID,
                    blockID,
                    previousID: undoPreviousID,
                    id: sourceId,
                }]);
                menuElement.querySelector('[data-type="goGroupsSort"] .b3-menu__accelerator').textContent = getLanguageByIndex(2, "sort");
                ctx.data.view.group.order = 2;
                ctx.data.view.groups.find((group, index) => {
                    if (group.id === sourceId) {
                        const groupData = ctx.data.view.groups.splice(index, 1)[0];
                        ctx.data.view.groups.find((item, index: number) => {
                            if (item.id === targetId) {
                                if (isTop) {
                                    ctx.data.view.groups.splice(index, 0, groupData);
                                } else {
                                    ctx.data.view.groups.splice(index + 1, 0, groupData);
                                }
                                return true;
                            }
                        });
                        return true;
                    }
                });
                if (isTop) {
                    targetElement.before(sourceElement);
                } else {
                    targetElement.after(sourceElement);
                }
            }
            targetElement.classList.remove("dragover__top", "dragover__bottom");
            return;
        }
    });
    let dragoverElement: HTMLElement;
    avPanelElement.addEventListener("dragover", (event: DragEvent) => {
        if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            return;
        }
        const target = event.target as HTMLElement;
        let targetElement = hasClosestByAttribute(target, "draggable", "true");
        if (!targetElement) {
            targetElement = hasClosestByAttribute(document.elementFromPoint(event.clientX, event.clientY - 1), "draggable", "true");
        }
        if (!targetElement || targetElement === window.siyuan.dragElement) {
            return;
        }
        event.preventDefault();
        if (dragoverElement && targetElement === dragoverElement) {
            const nodeRect = targetElement.getBoundingClientRect();
            avPanelElement.querySelectorAll(".dragover__bottom, .dragover__top").forEach((item: HTMLElement) => {
                item.classList.remove("dragover__bottom", "dragover__top");
            });
            if (event.clientY > nodeRect.top + nodeRect.height / 2) {
                targetElement.classList.add("dragover__bottom");
            } else {
                targetElement.classList.add("dragover__top");
            }
            return;
        }
        dragoverElement = targetElement;
    });
    let counter = 0;
    avPanelElement.addEventListener("dragleave", () => {
        counter--;
        if (counter === 0) {
            avPanelElement.querySelectorAll(".dragover__bottom, .dragover__top").forEach((item: HTMLElement) => {
                item.classList.remove("dragover__bottom", "dragover__top");
            });
        }
    });
    avPanelElement.addEventListener("dragenter", (event) => {
        event.preventDefault();
        counter++;
    });
    avPanelElement.addEventListener("dragend", () => {
        if (window.siyuan.dragElement) {
            window.siyuan.dragElement.style.opacity = "";
            window.siyuan.dragElement = undefined;
        }
    });
};
