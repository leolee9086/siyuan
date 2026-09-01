import { fetchPost } from "../../../util/network/fetch";
import {Menu} from "../../../plugin/Menu";
import {bindEditEvent, getEditHTML} from "./col/edit/render";
import {getColId} from "./col/identity/resolve";
import { setPosition } from "../../../util/DOM/positioning/setPosition";
import { hasClosestByClassName } from "../../util/hasClosest";
import { bindSelectEvent, getSelectHTML, setColOption } from "./select";
import { bindInlineFilterEvents, getFiltersHTML, prepareFilterColumns } from "./filter";
import {bindSortsEvent, getSortsHTML} from "./sorting";
import { bindDateEvent, getDateHTML } from "./date";
import { bindAssetEvent, getAssetHTML } from "./asset";
import { Constants } from "../../../constants";
import { hideElements } from "../../ui/hideElements";
import { isMobile } from "../../../platform";
import {addViewMutationMenuItems, bindSwitcherEvent, bindViewEvent, getSwitcherHTML, getViewHTML} from "./view";
import {getFieldsByData} from "./view/metadata";
import { focusBlock } from "../../util/selection";
import { getFieldIdByCellElement } from "./row";
import { bindRelationEvent, getRelationHTML } from "./relation";
import { bindRollupData, getRollupHTML } from "./rollup";
import { getPageSize } from "./groups";
import {updateCellsValue} from "./cell.update";
export type { IMenuPanelContext } from "./openMenuPanel.types";
import type { IMenuPanelContext } from "./openMenuPanel.types";
import {avMenuPanelDomainBrand} from "./openMenuPanel.types";
import type {OpenAVMenuPanelOptions} from "./openMenuPanel.types";
import type {OpenAVViewMenuOptions} from "./openMenuPanel.types";
import { bindDragEvents } from "./openMenuPanel.drag";
import { bindFilterCombinationChange, handleSortsFiltersClick } from "./openMenuPanel.click.sortsFilters";
import { handleColEditClick } from "./openMenuPanel.click.colEdit";
import { handleColOpsClick } from "./openMenuPanel.click.colOps";
import { handleViewClick } from "./openMenuPanel.click.view";
import { handleCellClick } from "./openMenuPanel.click.cell";
import {handleGroupsClick} from "./group/panel/interactions";
/**
 * 用途：国际化文案对象。
 * 使用范围：Panel 内除字段管理外的菜单文案。
 * 解耦评估：字段管理文案由 col/properties 子域自身直达同一真实所有者，本入口不再中转依赖。
 */
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 用途：渲染字段管理面板；使用范围：Panel 初始渲染与交互刷新；解耦评估：直达 Properties 唯一实现，不再由 Panel 包装或缓存依赖。 */
import {getPropertiesHTML} from "./col/properties/render";

export const openViewMenu = (options: OpenAVViewMenuOptions) => {
    if (options.protyle.disabled) {
        return;
    }
    const menu = new Menu(Constants.MENU_AV_VIEW);
    if (menu.isOpen) {
        return;
    }
    menu.addItem({
        id: "rename",
        icon: "iconEdit",
        label: siyuanI18n.rename,
        click() {
            document.querySelector(".av__panel")?.remove();
            openMenuPanel({
                protyle: options.protyle,
                blockElement: options.blockElement,
                type: "config",
                cb: (avPanelElement) => {
                    const inputElement = avPanelElement.querySelector('.b3-text-field[data-type="name"]');
                    if (!(inputElement instanceof HTMLInputElement)) {
                        throw new Error("AV view name input is missing from the config panel");
                    }
                    inputElement.focus();
                }
            });
        }
    });
    menu.addItem({
        id: "config",
        icon: "iconSettings",
        label: siyuanI18n.config,
        click() {
            document.querySelector(".av__panel")?.remove();
            openMenuPanel({
                protyle: options.protyle,
                blockElement: options.blockElement,
                type: "config"
            });
        }
    });
    addViewMutationMenuItems(menu, options);
    const rect = options.element.getBoundingClientRect();
    menu.open({
        x: rect.left,
        y: rect.bottom
    });
};

export const openMenuPanel = (options: OpenAVMenuPanelOptions) => {
    let avPanelElement = document.querySelector(".av__panel");
    if (avPanelElement) {
        avPanelElement.remove();
        options.destroyCallback?.();
        return;
    }
    const avID = options.blockElement.getAttribute("data-av-id");
    const avPageSize = getPageSize(options.blockElement);
    // config/properties/sorts/filters/switcher 菜单只需要字段/视图元数据，不需要行数据，跳过行渲染以提升大体量视图下的响应速度
    const ignoreRows = ["config", "properties", "sorts", "filters", "switcher"].includes(options.type);
    const fetchPayload = {
        id: avID,
        query: options.blockElement.querySelector('[data-type="av-search"]')?.textContent.trim() || "",
        pageSize: avPageSize.unGroupPageSize,
        groupPaging: avPageSize.groupPageSize,
        blockID: options.blockElement.getAttribute("data-node-id"),
        ignoreRows,
    };
    const renderData = async (data: IAV) => {
        avPanelElement = document.querySelector(".av__panel");
        if (avPanelElement) {
            avPanelElement.remove();
            return;
        }
        if (!options.keepMenuOpen) {
            window.siyuan.menus.menu.remove();
        }
        const blockID = options.blockElement.getAttribute("data-node-id");

        const isCustomAttr = !options.blockElement.classList.contains("av");
        if (options.type === "filters") {
            await prepareFilterColumns(data);
        }
        let html;
        const fields = getFieldsByData(data);
        if (options.type === "config") {
            html = getViewHTML(data);
        } else if (options.type === "properties") {
            html = getPropertiesHTML(fields, data.viewType);
        } else if (options.type === "sorts") {
            html = getSortsHTML(fields, data.view.sorts);
        } else if (options.type === "switcher") {
            html = getSwitcherHTML(data.views, data.viewID, options.blockElement);
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
    <div class="b3-menu${options.type === "filters" ? " av__filter-panel" : ""}${options.type === "relation" ? " av__relation-panel" : ""}" ${options.keepMenuOpen ? "data-menu=\"true\"" : ""} ${["select", "date", "asset", "relation", "rollup"].includes(options.type) ? `style="${["select", "asset", "relation"].includes(options.type) ? "max-height: calc(100vh - 32px);display: flex;flex-direction: column;" : ""}min-width: 200px;${options.type === "relation" ? `width: 760px;max-width: ${isMobile ? "90vw" : "calc(100vw - 32px)"};` : isMobile ? "max-width: 90vw;" : "max-width: 50vw;"}"` : ""}>${html}</div>
</div>`);
        avPanelElement = document.querySelector(".av__panel");
        if (options.destroyCallback) {
            const renderedPanelElement = avPanelElement;
            const parentElement = renderedPanelElement.parentElement;
            const observer = new MutationObserver(() => {
                if (!renderedPanelElement.isConnected) {
                    observer.disconnect();
                    options.destroyCallback();
                }
            });
            observer.observe(parentElement, {childList: true});
        }
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
                    blockElement: options.blockElement,
                    requireExplicitChange: options.requireExplicitChange,
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
                closeCB = bindRelationEvent({
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
                bindSortsEvent({protyle: options.protyle, menuElement, data, blockID});
            } else if (options.type === "filters") {
                bindInlineFilterEvents(avPanelElement, data, options.protyle, blockID, avID,
                    options.filterOperation);
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
            options, panel: avMenuPanel, data, fields, avID, blockID, isCustomAttr,
            menuElement, avPanelElement, tabRect, closeCB
        };
        bindDragEvents(ctx);
        bindFilterCombinationChange(ctx);
        let suppressSelectClick = false;
        // 多选排序
        avPanelElement.addEventListener("mousedown", (event: MouseEvent & { target: HTMLElement }) => {
            if (event.button === 1 && !hasClosestByClassName(event.target, "b3-menu")) {
                document.querySelector(".av__panel").dispatchEvent(new CustomEvent("click", { detail: "close" }));
            }
            if (event.button !== 0 || options.type !== "select") {
                return;
            }
            const selectedElement = event.target.closest(".b3-chip--middle") as HTMLElement;
            if (!selectedElement || !selectedElement.parentElement.classList.contains("b3-chips") ||
                event.target.closest('[data-type="removeCellOption"]')) {
                return;
            }
            const colId = getColId(options.cellElements[0], data.viewType);
            const colData = fields.find((item) => item.id === colId);
            if (colData?.type !== "mSelect" ||
                selectedElement.parentElement.querySelectorAll(".b3-chip--middle").length < 2) {
                return;
            }
            event.preventDefault();
            const documentSelf = document;
            documentSelf.ondragstart = () => false;
            let ghostElement: HTMLElement;
            const diffPosition = { x: 0, y: 0 };
            const startPosition = { x: event.clientX, y: event.clientY };
            const oldValue = Array.from(selectedElement.parentElement.querySelectorAll(".b3-chip--middle"))
                .map((item: HTMLElement) => item.dataset.content);
            documentSelf.onmousemove = (moveEvent: MouseEvent & { target: HTMLElement }) => {
                moveEvent.preventDefault();
                moveEvent.stopPropagation();
                if (!ghostElement) {
                    if (Math.hypot(moveEvent.clientX - startPosition.x, moveEvent.clientY - startPosition.y) < 5) {
                        return;
                    }
                    ghostElement = selectedElement.cloneNode(true) as HTMLElement;
                    document.body.append(ghostElement);
                    ghostElement.setAttribute("id", "dragGhost");
                    ghostElement.style.pointerEvents = "none";
                    ghostElement.style.position = "fixed";
                    ghostElement.style.zIndex = (window.siyuan.zIndex++).toString();
                    selectedElement.style.opacity = ".38";
                    document.body.style.cursor = "grabbing";
                    const selectedRect = selectedElement.getBoundingClientRect();
                    diffPosition.x = moveEvent.clientX - selectedRect.left;
                    diffPosition.y = moveEvent.clientY - selectedRect.top;
                }
                ghostElement.style.top = (moveEvent.clientY - diffPosition.y) + "px";
                ghostElement.style.left = (moveEvent.clientX - diffPosition.x) + "px";
                const targetElement = moveEvent.target.closest(".b3-chip--middle") as HTMLElement;
                if (targetElement && targetElement !== selectedElement) {
                    const nodeRect = targetElement.getBoundingClientRect();
                    if (moveEvent.clientX > nodeRect.left + nodeRect.width / 2 &&
                        moveEvent.clientX < nodeRect.right + 8) {
                        targetElement.after(selectedElement);
                    } else if (moveEvent.clientX <= nodeRect.left + nodeRect.width / 2 &&
                        moveEvent.clientX > nodeRect.left - 8) {
                        targetElement.before(selectedElement);
                    }
                }
            };

            documentSelf.onmouseup = () => {
                documentSelf.onmousemove = null;
                documentSelf.onmouseup = null;
                documentSelf.ondragstart = null;
                documentSelf.onselectstart = null;
                documentSelf.onselect = null;
                ghostElement?.remove();
                selectedElement.style.opacity = "";
                document.body.style.cursor = "";
                if (!ghostElement) {
                    return;
                }
                const newValue: IAVCellSelectValue[] = [];
                selectedElement.parentElement.querySelectorAll(".b3-chip--middle").forEach((item: HTMLElement) => {
                    newValue.push({ content: item.dataset.content, color: item.dataset.valueColor });
                });
                suppressSelectClick = true;
                setTimeout(() => {
                    suppressSelectClick = false;
                });
                if (newValue.some((item, index) => item.content !== oldValue[index])) {
                    updateCellsValue(options.protyle, options.blockElement as HTMLElement, newValue, options.cellElements);
                }
            };
        });
        avPanelElement.addEventListener("click", async (event: MouseEvent) => {
            let type: string;
            let target = event.target as HTMLElement;
            const isProgrammaticClose = typeof event.detail === "string";
            if (typeof event.detail === "string") {
                type = event.detail;
            } else if (typeof event.detail === "object") {
                type = (event.detail as { type: string }).type;
                target = (event.detail as { target: HTMLElement }).target;
            }
            const selectedElement = target?.closest(".b3-chip--middle") as HTMLElement;
            if (options.type === "select" && selectedElement?.parentElement.classList.contains("b3-chips") &&
                !target.closest('[data-type="removeCellOption"]')) {
                if (!suppressSelectClick) {
                    setColOption(options.protyle, data, selectedElement, options.blockElement, isCustomAttr,
                        options.cellElements, options.keepMenuOpen);
                }
                suppressSelectClick = false;
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            while (target && target !== avPanelElement || type) {
                type = target?.dataset.type || type;
                if (type === "toggleCombination") {
                    break;
                }
                if (type === "close") {
                    if (!options.protyle.toolbar.subElement.classList.contains("fn__none")) {
                        // 优先关闭资源文件搜索
                        hideElements(["util"], options.protyle);
                    } else if (!options.keepMenuOpen &&
                        !window.siyuan.menus.menu.element.classList.contains("fn__none")) {
                        // 过滤面板先关闭过滤条件
                    } else {
                        ctx.closeCB?.();
                        avPanelElement.remove();
                        setTimeout(() => {
                            focusBlock(options.blockElement);
                        }, Constants.TIMEOUT_TRANSITION);  // 单选使用 enter 修改选项后会滚动
                    }
                    if (!options.keepMenuOpen || !isProgrammaticClose) {
                        window.siyuan.menus.menu.remove();
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (handleSortsFiltersClick(ctx, type, target, event)) {
                    break;
                } else if (handleColEditClick(ctx, type, target, event)) {
                    break;
                } else if (handleColOpsClick(ctx, type, target, event, getPropertiesHTML)) {
                    break;
                } else {
                    const viewOutcome = await handleViewClick(ctx, type, target, event, getPropertiesHTML);
                    if (viewOutcome.kind === "open-view-menu") {
                        openViewMenu({
                            protyle: ctx.options.protyle,
                            blockElement: viewOutcome.blockElement,
                            element: viewOutcome.element,
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    }
                    if (viewOutcome.kind === "handled") {
                        break;
                    }
                    if (await handleCellClick(ctx, type, target, event)) {
                        break;
                    }
                    if (await handleGroupsClick({ctx, type, target, event})) {
                        break;
                    }
                }
                // 有错误日志，没找到重现步骤，需先判断一下
                if (!target || !target.parentElement) {
                    break;
                }
                target = target.parentElement;
            }
        });
    };
    if (options.data) {
        void renderData(options.data);
    } else {
        fetchPost("/api/av/renderAttributeView", fetchPayload, (response) => {
            void renderData(response.data as IAV);
        });
    }
};

/** 完整 AV 菜单面板领域外观；函数实现保持原有公开入口身份。 */
export const avMenuPanel = {
    [avMenuPanelDomainBrand]: "AVMenuPanelDomain" as const,
    open: openMenuPanel,
    openViewMenu,
} as const;
