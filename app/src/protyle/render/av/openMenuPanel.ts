import { fetchPost } from "../../../util/network/fetch";
import { bindEditEvent, getColId, getEditHTML } from "./col";
import { setPosition } from "../../../util/DOM/setPosition";
import { hasClosestByClassName } from "../../util/hasClosest";
import { bindSelectEvent, getSelectHTML } from "./select";
import { getFiltersHTML } from "./filter";
import { bindSortsEvent, getSortsHTML } from "./sort";
import { bindDateEvent, getDateHTML } from "./date";
import { bindAssetEvent, getAssetHTML } from "./asset";
import { Constants } from "../../../constants";
import { hideElements } from "../../ui/hideElements";
import { isMobile } from "../../../platform";
import { bindSwitcherEvent, bindViewEvent, getFieldsByData, getSwitcherHTML, getViewHTML } from "./view";
import { focusBlock } from "../../util/selection";
import { getFieldIdByCellElement } from "./row";
import { bindRelationEvent, getRelationHTML } from "./relation";
import { bindRollupData, getRollupHTML } from "./rollup";
import { getPageSize } from "./groups";
export type { IMenuPanelContext } from "./openMenuPanel.types";
import type { IMenuPanelContext } from "./openMenuPanel.types";
import { bindDragEvents } from "./openMenuPanel.drag";
import { handleSortsFiltersClick } from "./openMenuPanel.click.sortsFilters";
import { handleColEditClick } from "./openMenuPanel.click.colEdit";
import { handleColOpsClick } from "./openMenuPanel.click.colOps";
import { handleViewClick } from "./openMenuPanel.click.view";
import { handleCellClick } from "./openMenuPanel.click.cell";
import { handleGroupsClick } from "./openMenuPanel.click.groups";
export { getPropertiesHTML } from "./openMenuPanel.properties";
import { getPropertiesHTML } from "./openMenuPanel.properties";

export const openMenuPanel = (options: {
    protyle: IProtyle,
    blockElement: Element,
    type: "select" | "properties" | "config" | "sorts" | "filters" | "edit" | "date" | "asset" | "switcher" | "relation" | "rollup",
    colId?: string, // for edit, rollup
    // 使用前端构造的数据
    editData?: {
        previousID: string,
        colData: IAVColumn,
    },
    cellElements?: HTMLElement[],   // for select & date & relation & asset
    cb?: (avPanelElement: Element) => void
}) => {
    let avPanelElement = document.querySelector(".av__panel");
    if (avPanelElement) {
        avPanelElement.remove();
        return;
    }
    const avID = options.blockElement.getAttribute("data-av-id");
    const avPageSize = getPageSize(options.blockElement);
    fetchPost("/api/av/renderAttributeView", {
        id: avID,
        query: options.blockElement.querySelector('[data-type="av-search"]')?.textContent.trim() || "",
        pageSize: avPageSize.unGroupPageSize,
        groupPaging: avPageSize.groupPageSize,
        viewID: options.blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW)
    }, (response) => {
        avPanelElement = document.querySelector(".av__panel");
        if (avPanelElement) {
            avPanelElement.remove();
            return;
        }
        window.siyuan.menus.menu.remove();
        const blockID = options.blockElement.getAttribute("data-node-id");

        const isCustomAttr = !options.blockElement.classList.contains("av");
        const data = response.data as IAV;
        let html;
        const fields = getFieldsByData(data);
        if (options.type === "config") {
            html = getViewHTML(data);
        } else if (options.type === "properties") {
            html = getPropertiesHTML(fields);
        } else if (options.type === "sorts") {
            html = getSortsHTML(fields, data.view.sorts);
        } else if (options.type === "switcher") {
            html = getSwitcherHTML(data.views, data.viewID);
        } else if (options.type === "filters") {
            html = getFiltersHTML(data);
        } else if (options.type === "select") {
            html = getSelectHTML(fields, options.cellElements, true, options.blockElement);
        } else if (options.type === "asset") {
            html = getAssetHTML(options.cellElements);
        } else if (options.type === "edit") {
            if (options.editData) {
                if (typeof options.editData.colData.wrap === "undefined") {
                    options.editData.colData.wrap = data.view.wrapField;
                }
                if (options.editData.previousID) {
                    fields.find((item, index) => {
                        if (item.id === options.editData.previousID) {
                            fields.splice(index + 1, 0, options.editData.colData);
                            return true;
                        }
                    });
                } else {
                    if (data.viewType === "table") {
                        fields.splice(0, 0, options.editData.colData);
                    } else {
                        fields.push(options.editData.colData);
                    }
                }
            }
            html = getEditHTML({ protyle: options.protyle, data, colId: options.colId, isCustomAttr });
        } else if (options.type === "date") {
            html = getDateHTML(options.cellElements);
        } else if (options.type === "rollup") {
            html = `<div class="b3-menu__items">${getRollupHTML({ data, cellElements: options.cellElements })}</div>`;
        } else if (options.type === "relation") {
            html = getRelationHTML(data, options.cellElements);
            if (!html) {
                openMenuPanel({
                    protyle: options.protyle,
                    blockElement: options.blockElement,
                    type: "edit",
                    colId: getColId(options.cellElements[0], data.viewType)
                });
                return;
            }
        }

        document.body.insertAdjacentHTML("beforeend", `<div class="av__panel" style="z-index: ${++window.siyuan.zIndex};">
    <div class="b3-dialog__scrim" data-type="close"></div>
    <div class="b3-menu" ${["select", "date", "asset", "relation", "rollup"].includes(options.type) ? `style="min-width: 200px;${isMobile ? "max-width: 90vw;" : "max-width: 50vw;"}"` : ""}>${html}</div>
</div>`);
        avPanelElement = document.querySelector(".av__panel");
        let closeCB: () => void;
        const menuElement = avPanelElement.lastElementChild as HTMLElement;
        const tabRect = options.blockElement.querySelector(`.av__views, .av__row[data-col-id="${options.colId}"] > .block__logo`)?.getBoundingClientRect();
        if (["select", "date", "asset", "relation", "rollup"].includes(options.type)) {
            let lastElement = options.cellElements[options.cellElements.length - 1];
            if (!options.blockElement.contains(lastElement)) {
                // https://github.com/siyuan-note/siyuan/issues/15839
                const rowID = getFieldIdByCellElement(lastElement, data.viewType);
                if (data.viewType === "table") {
                    lastElement = options.blockElement.querySelector(`.av__row[data-id="${rowID}"] .av__cell[data-col-id="${lastElement.dataset.colId}"]`);
                } else {
                    lastElement = options.blockElement.querySelector(`.av__gallery-item[data-id="${rowID}"] .av__cell[data-field-id="${lastElement.dataset.fieldId}"]`);
                }
            }
            const cellRect = (lastElement || options.cellElements[options.cellElements.length - 1]).getBoundingClientRect();

            if (options.type === "select") {
                bindSelectEvent(options.protyle, data, menuElement, options.cellElements, options.blockElement);
            } else if (options.type === "date") {
                closeCB = bindDateEvent({
                    protyle: options.protyle,
                    data,
                    menuElement,
                    cellElements: options.cellElements,
                    blockElement: options.blockElement
                });
            } else if (options.type === "asset") {
                bindAssetEvent({
                    protyle: options.protyle,
                    menuElement,
                    cellElements: options.cellElements,
                    blockElement: options.blockElement
                });
                setTimeout(() => {
                    setPosition(menuElement, cellRect.left, cellRect.bottom, cellRect.height);
                }, Constants.TIMEOUT_LOAD);  // 等待加载
            } else if (options.type === "relation") {
                bindRelationEvent({
                    menuElement,
                    cellElements: options.cellElements,
                    protyle: options.protyle,
                    blockElement: options.blockElement
                });
            } else if (options.type === "rollup") {
                bindRollupData({ protyle: options.protyle, data, menuElement });
            }
            if (["select", "date", "relation", "rollup"].includes(options.type)) {
                const inputElement = menuElement.querySelector("input");
                if (inputElement) {
                    inputElement.select();
                    inputElement.focus();
                }
                setPosition(menuElement, cellRect.left, cellRect.bottom, cellRect.height);
            }
        } else {
            setPosition(menuElement, tabRect.right - menuElement.clientWidth, tabRect.bottom, tabRect.height);
            if (options.type === "sorts") {
                bindSortsEvent(options.protyle, menuElement, data, blockID);
            } else if (options.type === "edit") {
                bindEditEvent({ protyle: options.protyle, data, menuElement, isCustomAttr, blockID });
            } else if (options.type === "config") {
                bindViewEvent({ protyle: options.protyle, data, menuElement, blockElement: options.blockElement });
            } else if (options.type === "switcher") {
                bindSwitcherEvent({ protyle: options.protyle, menuElement, blockElement: options.blockElement });
            }
        }
        if (options.cb) {
            options.cb(avPanelElement);
        }
        const ctx: IMenuPanelContext = {
            options, data, fields, avID, blockID, isCustomAttr,
            menuElement, avPanelElement, tabRect, closeCB
        };
        bindDragEvents(ctx);
        avPanelElement.addEventListener("mousedown", (event: MouseEvent & { target: HTMLElement }) => {
            if (event.button === 1 && !hasClosestByClassName(event.target, "b3-menu")) {
                document.querySelector(".av__panel").dispatchEvent(new CustomEvent("click", { detail: "close" }));
            }
        });
        avPanelElement.addEventListener("click", async (event: MouseEvent) => {
            let type: string;
            let target = event.target as HTMLElement;
            if (typeof event.detail === "string") {
                type = event.detail;
            } else if (typeof event.detail === "object") {
                type = (event.detail as { type: string }).type;
                target = (event.detail as { target: HTMLElement }).target;
            }
            while (target && target !== avPanelElement || type) {
                type = target?.dataset.type || type;
                if (type === "close") {
                    if (!options.protyle.toolbar.subElement.classList.contains("fn__none")) {
                        // 优先关闭资源文件搜索
                        hideElements(["util"], options.protyle);
                    } else if (!window.siyuan.menus.menu.element.classList.contains("fn__none")) {
                        // 过滤面板先关闭过滤条件
                    } else {
                        ctx.closeCB?.();
                        avPanelElement.remove();
                        setTimeout(() => {
                            focusBlock(options.blockElement);
                        }, Constants.TIMEOUT_TRANSITION);  // 单选使用 enter 修改选项后会滚动
                    }
                    window.siyuan.menus.menu.remove();
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (handleSortsFiltersClick(ctx, type, target, event)) {
                    break;
                } else if (handleColEditClick(ctx, type, target, event)) {
                    break;
                } else if (handleColOpsClick(ctx, type, target, event, getPropertiesHTML)) {
                    break;
                } else if (await handleViewClick(ctx, type, target, event, getPropertiesHTML)) {
                    break;
                } else if (await handleCellClick(ctx, type, target, event)) {
                    break;
                } else if (await handleGroupsClick(ctx, type, target, event)) {
                    break;
                }
                // 有错误日志，没找到重现步骤，需先判断一下
                if (!target || !target.parentElement) {
                    break;
                }
                target = target.parentElement;
            }
        });
    });
};

