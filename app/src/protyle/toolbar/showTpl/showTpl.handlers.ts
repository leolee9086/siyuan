/**
 * 模板选择功能 - 事件处理
 */
import { focusByRange } from "../../util/selection";
import { hasClosestByClassName, hasClosestByAttribute } from "../../util/hasClosest";
import { upDownHint } from "../../../util/DOM/upDownHint";
import { fetchPost } from "../../../util/network/fetch";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { confirmDialog } from "../../runtime/dialog.port";
import { previewTemplate } from "../util";
import { hintRenderTemplate } from "../../hint/extend";
import { 生成模板列表项HTML } from "./showTpl.template";
import type { ITemplateState, IHandlerContext } from "./showTpl.types";
import { openBy } from "../../../editor/utils.openBy";
import { isElectron } from "../../../platform";

/**
 * 创建悬停事件处理器
 */
export function 创建悬停事件处理器(
    context: IHandlerContext
): (event: Event) => void {
    const { state, previewElement, protyle } = context;
    return (event: Event) => {
        const target = event.target as HTMLElement;
        const hoverItemElement = hasClosestByClassName(target, "b3-list-item");
        if (!hoverItemElement) {
            return;
        }
        const currentPath = hoverItemElement.getAttribute("data-value");
        if (state.previewPath === currentPath) {
            return;
        }
        state.previewPath = currentPath ?? "";
        previewTemplate(state.previewPath, previewElement, protyle.block.parentID);
        event.stopPropagation();
    };
}

/**
 * 创建键盘事件处理器
 */
export function 创建键盘事件处理器(
    context: IHandlerContext
): (event: KeyboardEvent) => void {
    const { subElement, listElement, previewElement, state, protyle, nodeElement, range } = context;
    return (event: KeyboardEvent) => {
        event.stopPropagation();
        if (event.isComposing) {
            return;
        }
        const isEmpty = !subElement.querySelector(".b3-list-item");
        if (!isEmpty) {
            处理方向键导航(listElement, event, state, previewElement, protyle);
        }
        if (event.key === "Enter") {
            处理回车键(isEmpty, subElement, protyle, nodeElement, range);
            event.preventDefault();
            return;
        }
        if (event.key === "Escape") {
            subElement.classList.add("fn__none");
            focusByRange(range);
        }
    };
}

function 处理方向键导航(
    listElement: Element,
    event: KeyboardEvent,
    state: ITemplateState,
    previewElement: Element,
    protyle: IProtyle
): void {
    const currentElement = upDownHint(listElement as HTMLElement, event);
    if (!currentElement) {
        return;
    }
    const currentPath = currentElement.getAttribute("data-value");
    if (state.previewPath === currentPath) {
        return;
    }
    state.previewPath = currentPath ?? "";
    if (!protyle.block.parentID) {
        throw new Error("预览模板时 parentID 不存在");
    }
    previewTemplate(state.previewPath, previewElement, protyle.block.parentID);
}

function 处理回车键(
    isEmpty: boolean,
    subElement: HTMLElement,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range
): void {
    // 卫语句：列表为空时，恢复焦点并隐藏
    if (isEmpty) {
        focusByRange(range);
        subElement.classList.add("fn__none");
        return;
    }
    // 主逻辑：列表不为空，尝试渲染选中的模板
    const focusedItem = subElement.querySelector(".b3-list-item--focus");
    if (focusedItem) {
        hintRenderTemplate(decodeURIComponent(focusedItem.getAttribute("data-value") ?? ""), protyle, nodeElement);
    }
    subElement.classList.add("fn__none");
}

/**
 * 设置输入搜索事件
 */
export function 设置输入事件(
    inputElement: HTMLInputElement,
    listElement: Element,
    previewElement: Element,
    state: ITemplateState,
    protyle: IProtyle
): void {
    inputElement.addEventListener("input", (event) => {
        event.stopPropagation();
        fetchPost("/api/search/searchTemplate", {
            k: inputElement.value,
        }, (response) => {
            listElement.innerHTML = 生成模板列表项HTML(response.data.templates);
            const currentPath = response.data.templates[0]?.path;
            if (state.previewPath !== currentPath) {
                state.previewPath = currentPath ?? "";
                previewTemplate(state.previewPath, previewElement, protyle.block.parentID);
            }
        });
    });
}

/**
 * 设置点击事件
 */
export function 设置点击事件(
    subElement: HTMLElement,
    inputElement: HTMLInputElement,
    listElement: Element,
    previewElement: Element,
    state: ITemplateState,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range
): void {
    subElement.lastElementChild?.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (处理空列表点击(target, subElement, range, event)) {
            return;
        }
        if (处理图标点击(target, listElement, previewElement, state, protyle, event)) {
            return;
        }
        if (处理导航点击(target, inputElement, event)) {
            return;
        }
        处理列表项点击(target, protyle, nodeElement, event);
    });
}

function 处理空列表点击(
    target: HTMLElement,
    subElement: HTMLElement,
    range: Range,
    event: Event
): boolean {
    if (target.classList.contains("b3-list--empty")) {
        subElement.classList.add("fn__none");
        focusByRange(range);
        event.stopPropagation();
        return true;
    }
    return false;
}

function 处理图标点击(
    target: HTMLElement,
    listElement: Element,
    previewElement: Element,
    state: ITemplateState,
    protyle: IProtyle,
    event: Event
): boolean {
    const iconElement = hasClosestByClassName(target, "b3-list-item__action");
    if (isElectron && iconElement && iconElement.getAttribute("data-type") === "open") {
        openBy(iconElement.parentElement?.getAttribute("data-value") ?? "", "folder");
        event.stopPropagation();
        return true;
    }
    if (iconElement && iconElement.getAttribute("data-type") === "remove") {
        处理删除操作(iconElement, listElement, previewElement, state, protyle);
        event.stopPropagation();
        return true;
    }
    return false;
}

function 执行删除模板(
    iconElement: Element,
    previewElement: Element,
    state: ITemplateState,
    protyle: IProtyle
): void {
    fetchPost("/api/search/removeTemplate", { path: iconElement.parentElement?.getAttribute("data-value") }, () => {
        const parentElement = iconElement.parentElement?.parentElement;
        if (parentElement && parentElement.childElementCount === 1) {
            parentElement.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
            previewTemplate("", previewElement, protyle.block.parentID);
            return;
        }
        处理删除后焦点(iconElement, previewElement, state, protyle);
        iconElement.parentElement?.remove();
    });
}

function 处理删除操作(
    iconElement: Element,
    listElement: Element,
    previewElement: Element,
    state: ITemplateState,
    protyle: IProtyle
): void {
    confirmDialog(
        siyuanI18n.remove,
        siyuanI18n.confirmDelete + "?",
        () => 执行删除模板(iconElement, previewElement, state, protyle)
    );
}

function 处理删除后焦点(
    iconElement: Element,
    previewElement: Element,
    state: ITemplateState,
    protyle: IProtyle
): void {
    if (!iconElement.parentElement?.classList.contains("b3-list-item--focus")) {
        return;
    }
    const sideElement = iconElement.parentElement.previousElementSibling || iconElement.parentElement.nextElementSibling;
    if (!sideElement) {
        return;
    }
    sideElement.classList.add("b3-list-item--focus");
    const path = sideElement.getAttribute("data-value");
    if (state.previewPath !== path) {
        state.previewPath = path ?? "";
        previewTemplate(state.previewPath, previewElement, protyle.block.parentID);
    }
}

function 处理导航点击(
    target: HTMLElement,
    inputElement: HTMLInputElement,
    event: Event
): boolean {
    const previousElement = hasClosestByAttribute(target, "data-type", "previous");
    if (previousElement) {
        inputElement.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
        event.stopPropagation();
        return true;
    }
    const nextElement = hasClosestByAttribute(target, "data-type", "next");
    if (nextElement) {
        inputElement.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        event.stopPropagation();
        return true;
    }
    return false;
}

function 处理列表项点击(
    target: HTMLElement,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    event: Event
): void {
    const clickedListElement = hasClosestByClassName(target, "b3-list-item");
    if (clickedListElement) {
        hintRenderTemplate(decodeURIComponent(clickedListElement.getAttribute("data-value") ?? ""), protyle, nodeElement);
        event.stopPropagation();
    }
}
