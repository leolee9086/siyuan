/**
 * 模板选择功能
 * 从 Toolbar 类中拆分出来以减少文件大小
 */
import { Constants } from "../../constants";
import { focusByRange, getSelectionPosition } from "../util/selection";
import { hasClosestBlock, hasClosestByClassName, hasClosestByAttribute } from "../util/hasClosest";
import { hideElements } from "../ui/hideElements";
import { setPosition } from "../../util/setPosition";
import { upDownHint } from "../../util/upDownHint";
import { fetchPost } from "../../util/fetch";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { isMobile } from "../../util/functions";
import { confirmDialog } from "../../dialog/confirmDialog";
import { previewTemplate } from "./util";
import { hintRenderTemplate } from "../hint/extend";
import { resizeSide } from "../../history/resizeSide";
/// #if !BROWSER
import { openBy } from "../../editor/utils.openBy";
/// #endif

/**
 * 生成模板列表项 HTML
 */
function 生成模板列表项HTML(items: { path: string; content: string }[]): string {
    let html = "";
    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        html += `<div data-value="${item.path}" class="b3-list-item--hide-action b3-list-item${index === 0 ? " b3-list-item--focus" : ""}">
<span class="b3-list-item__text">${item.content}</span>`;
        /// #if !BROWSER
        html += `<span data-type="open" class="b3-list-item__action b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.showInFolder}">
    <svg><use xlink:href="#iconFolder"></use></svg>
</span>`;
        /// #endif
        html += `<span data-type="remove" class="b3-list-item__action b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.remove}">
    <svg><use xlink:href="#iconTrashcan"></use></svg>
</span></div>`;
    }
    return html || `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
}

/**
 * 显示模板选择面板
 */
export function 显示模板选择(
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    subElement: HTMLElement,
    toolbarElement: HTMLElement,
    setRange: (range: Range) => void
): void {
    setRange(range);
    hideElements(["hint"], protyle);
    window.siyuan.menus?.menu.remove();
    subElement.style.width = "";
    subElement.style.padding = "";
    subElement.innerHTML = `<div style="max-height:50vh" class="fn__flex">
<div class="fn__flex-column" style="${isMobile() ? "width: 100%" : "width: 256px"}">
    <div class="fn__flex" style="margin: 0 8px 4px 8px">
        <input class="b3-text-field fn__flex-1"/>
        <span class="fn__space"></span>
        <span data-type="previous" class="block__icon block__icon--show"><svg><use xlink:href="#iconLeft"></use></svg></span>
        <span class="fn__space"></span>
        <span data-type="next" class="block__icon block__icon--show"><svg><use xlink:href="#iconRight"></use></svg></span>
    </div>
    <div class="b3-list fn__flex-1 b3-list--background" style="position: relative"><img style="margin: 0 auto;display: block;width: 64px;height: 64px" src="/stage/loading-pure.svg"></div>
</div>
<div class="toolbarResize" style="    cursor: col-resize;
    box-shadow: 2px 0 0 0 var(--b3-theme-surface) inset, 3px 0 0 0 var(--b3-border-color) inset;
    width: 5px;
    margin-left: -2px;"></div>
<div style="width: 520px;${isMobile() || window.outerWidth < window.outerWidth / 2 + 520 ? "display:none;" : ""}overflow: auto;"></div>
</div>`;

    const listElement = subElement.querySelector(".b3-list");
    if (!listElement) {
return;
}

    const resizeElement = subElement.querySelector(".toolbarResize");
    if (resizeElement && listElement.parentElement) {
        resizeSide(resizeElement as HTMLElement, listElement.parentElement);
    }

    const previewElement = subElement.firstElementChild?.lastElementChild;
    if (!previewElement) {
return;
}

    let previewPath: string = "";

    listElement.addEventListener("mouseover", (event) => {
        const target = event.target as HTMLElement;
        const hoverItemElement = hasClosestByClassName(target, "b3-list-item");
        if (!hoverItemElement) {
return;
}
        const currentPath = hoverItemElement.getAttribute("data-value");
        if (previewPath === currentPath) {
return;
}
        previewPath = currentPath ?? "";
        previewTemplate(previewPath, previewElement, protyle.block.parentID);
        event.stopPropagation();
    });

    const inputElement = subElement.querySelector("input");
    if (!inputElement) {
return;
}

    inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        event.stopPropagation();
        if (event.isComposing) {
return;
}
        const isEmpty = !subElement.querySelector(".b3-list-item");
        if (!isEmpty) {
            const currentElement = upDownHint(listElement as HTMLElement, event);
            if (currentElement) {
                const currentPath = currentElement.getAttribute("data-value");
                if (previewPath !== currentPath) {
                    previewPath = currentPath ?? "";
                    previewTemplate(previewPath, previewElement, protyle.block.parentID);
                }
            }
        }
        if (event.key === "Enter") {
            if (!isEmpty) {
                const focusedItem = subElement.querySelector(".b3-list-item--focus");
                if (focusedItem) {
                    hintRenderTemplate(decodeURIComponent(focusedItem.getAttribute("data-value") ?? ""), protyle, nodeElement);
                }
            } else {
                focusByRange(range);
            }
            subElement.classList.add("fn__none");
            event.preventDefault();
        } else if (event.key === "Escape") {
            subElement.classList.add("fn__none");
            focusByRange(range);
        }
    });

    inputElement.addEventListener("input", (event) => {
        event.stopPropagation();
        fetchPost("/api/search/searchTemplate", {
            k: inputElement.value,
        }, (response) => {
            listElement.innerHTML = 生成模板列表项HTML(response.data.blocks);
            const currentPath = response.data.blocks[0]?.path;
            if (previewPath !== currentPath) {
                previewPath = currentPath ?? "";
                previewTemplate(previewPath, previewElement, protyle.block.parentID);
            }
        });
    });

    subElement.lastElementChild?.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (target.classList.contains("b3-list--empty")) {
            subElement.classList.add("fn__none");
            focusByRange(range);
            event.stopPropagation();
            return;
        }
        const iconElement = hasClosestByClassName(target, "b3-list-item__action");
        /// #if !BROWSER
        if (iconElement && iconElement.getAttribute("data-type") === "open") {
            openBy(iconElement.parentElement?.getAttribute("data-value") ?? "", "folder");
            event.stopPropagation();
            return;
        }
        /// #endif
        if (iconElement && iconElement.getAttribute("data-type") === "remove") {
            confirmDialog(siyuanI18n.remove, siyuanI18n.confirmDelete + "?", () => {
                fetchPost("/api/search/removeTemplate", { path: iconElement.parentElement?.getAttribute("data-value") }, () => {
                    const parentElement = iconElement.parentElement?.parentElement;
                    if (parentElement && parentElement.childElementCount === 1) {
                        parentElement.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
                        previewTemplate("", previewElement, protyle.block.parentID);
                    } else {
                        if (iconElement.parentElement?.classList.contains("b3-list-item--focus")) {
                            const sideElement = iconElement.parentElement.previousElementSibling || iconElement.parentElement.nextElementSibling;
                            if (sideElement) {
                                sideElement.classList.add("b3-list-item--focus");
                                const path = sideElement.getAttribute("data-value");
                                if (previewPath !== path) {
                                    previewPath = path ?? "";
                                    previewTemplate(previewPath, previewElement, protyle.block.parentID);
                                }
                            }
                        }
                        iconElement.parentElement?.remove();
                    }
                });
            });
            event.stopPropagation();
            return;
        }
        const previousElement = hasClosestByAttribute(target, "data-type", "previous");
        if (previousElement) {
            inputElement.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
            event.stopPropagation();
            return;
        }
        const nextElement = hasClosestByAttribute(target, "data-type", "next");
        if (nextElement) {
            inputElement.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
            event.stopPropagation();
            return;
        }
        const clickedListElement = hasClosestByClassName(target, "b3-list-item");
        if (clickedListElement) {
            hintRenderTemplate(decodeURIComponent(clickedListElement.getAttribute("data-value") ?? ""), protyle, nodeElement);
            event.stopPropagation();
        }
    });

    subElement.style.zIndex = (++window.siyuan.zIndex).toString();
    subElement.classList.remove("fn__none");
    toolbarElement.classList.add("fn__none");
    inputElement.select();

    fetchPost("/api/search/searchTemplate", {
        k: "",
    }, (response) => {
        const bgElement = subElement.querySelector(".b3-list--background");
        if (bgElement) {
            bgElement.innerHTML = 生成模板列表项HTML(response.data.blocks);
        }
        /// #if !MOBILE
        const rangePosition = getSelectionPosition(nodeElement, range);
        setPosition(subElement, rangePosition.left, rangePosition.top + 18, Constants.SIZE_TOOLBAR_HEIGHT);
        const firstChild = subElement.firstElementChild as HTMLElement;
        if (firstChild) {
            firstChild.style.maxHeight = Math.min(window.innerHeight * 0.8, window.innerHeight - subElement.getBoundingClientRect().top) - 16 + "px";
        }
        /// #else
        setPosition(subElement, 0, 0);
        /// #endif
        previewPath = listElement.firstElementChild?.getAttribute("data-value") ?? "";
        previewTemplate(previewPath, previewElement, protyle.block.parentID);
    });
}
