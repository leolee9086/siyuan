import { focusToolbarRange } from "../../protyle/util/selection";
import { renderAssetsPreview } from "../../asset/renderAssets";
import { Constants } from "../../constants";
import { Menu } from "../../plugin/Menu";
import { hintRenderAssets } from "../../protyle/hint/extend";
import { hasClosestByClassName, hasClosestByAttribute } from "../../protyle/util/hasClosest";
import { isMobile } from "../../util/functions";
import { upDownHint } from "../../util/upDownHint";
import { fetchPost } from "../../ai/imports";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { getWindowOuterWidth } from "../../util/siyuanEnvironments/getWindowGeometry.environment";
import { assetItem } from "./protyle.asset.types";

/** 生成资源列表 HTML */
const 生成资源列表HTML = (data: assetItem[]) => {
    return data.map((item, index) => {
        const focusClass = index === 0 ? " b3-list-item--focus" : "";
        return `<div data-value="${item.path}" class="b3-list-item${focusClass}"><div class="b3-list-item__text">${item.hName}</div></div>`;
    }).join("");
};

/** 更新资源列表 UI */
const 更新资源列表UI = (listElement: Element, data: assetItem[]) => {
    const searchHTML = 生成资源列表HTML(data);
    listElement.innerHTML = searchHTML || `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
};

/** 更新预览区域 */
const 更新预览区域 = (previewElement: Element | null, data: assetItem[]) => {
    if (!previewElement) {
        return;
    }
    if (data.length > 0 && data[0]) {
        const firstItem = data[0];
        previewElement.innerHTML = renderAssetsPreview(firstItem.path);
        return;
    }
    previewElement.innerHTML = siyuanI18n.emptyContent;
};

/** 弹出菜单 */
const 弹出菜单 = (position: IPosition) => {
    /// #if MOBILE
    getSiyuanGlobalMenus().menu.fullscreen();
    /// #else
    getSiyuanGlobalMenus().menu.popup(position);
    /// #endif
};

/** 处理搜索资源的响应 */
const 处理搜索资源响应 = (
    element: Element,
    k: string,
    position: IPosition,
    data: assetItem[]
) => {
    const inputElement = element.querySelector("input");
    const previewElement = element.querySelector("#preview");
    const listElement = element.querySelector(".b3-list");

    if (listElement) {
        更新资源列表UI(listElement, data);
    }
    更新预览区域(previewElement, data);
    弹出菜单(position);

    if (!k && inputElement) {
        inputElement.select();
    }
};

export const renderAssetList = (element: Element, k: string, position: IPosition, exts: string[] = []) => {
    fetchPost("/api/search/searchAsset", { k, exts }, (response) => {
        const data = (response.data ?? []) as assetItem[];
        处理搜索资源响应(element, k, position, data);
    });
};

/** 处理列表悬停事件 */
const 处理列表悬停 = (previewElement: Element) => (event: Event) => {
    const target = event.target as HTMLElement;
    const hoverItemElement = hasClosestByClassName(target, "b3-list-item");
    if (!hoverItemElement) {
        return;
    }
    const dataValue = hoverItemElement.getAttribute("data-value") ?? "";
    previewElement.innerHTML = renderAssetsPreview(dataValue);
};

/** 处理 Enter 键事件 */
const 处理Enter键 = (
    element: Element,
    previewElement: Element,
    event: KeyboardEvent,
    protyle: IProtyle,
    callback?: (url: string, name: string) => void
) => {
    const isEmpty = element.querySelector(".b3-list--empty");

    // 列表为空时，如果没有回调，则关闭菜单并聚焦
    if (isEmpty && !callback) {
        getSiyuanGlobalMenus().menu.remove();
        focusToolbarRange(protyle);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // 列表为空时，有回调则不做任何事
    if (isEmpty) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // 列表不为空，选择当前项
    const currentElement = element.querySelector(".b3-list-item--focus");
    if (!currentElement) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    const dataValue = currentElement.getAttribute("data-value") ?? "";
    const textContent = currentElement.textContent ?? "";

    if (callback) {
        callback(dataValue, textContent);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    hintRenderAssets(dataValue, protyle);
    getSiyuanGlobalMenus().menu.remove();
    event.preventDefault();
    event.stopPropagation();
};

/** 处理 Escape 键事件 */
const 处理Escape键 = (protyle: IProtyle, callback?: (url: string, name: string) => void) => {
    if (callback) {
        return;
    }
    focusToolbarRange(protyle);
};

/** 处理键盘事件 */
const 处理键盘事件 = (
    element: Element,
    listElement: Element,
    previewElement: Element,
    protyle: IProtyle,
    callback?: (url: string, name: string) => void
) => (event: KeyboardEvent) => {
    if (event.isComposing) {
        return;
    }

    const isEmpty = element.querySelector(".b3-list--empty");

    // 处理上下方向键
    const currentElement = !isEmpty ? upDownHint(listElement, event) : null;
    if (currentElement) {
        const dataValue = currentElement.getAttribute("data-value") ?? "";
        previewElement.innerHTML = renderAssetsPreview(dataValue);
        event.stopPropagation();
    }

    if (event.key === "Enter") {
        处理Enter键(element, previewElement, event, protyle, callback);
        return;
    }

    if (event.key === "Escape") {
        处理Escape键(protyle, callback);
    }
};

/** 处理输入事件 */
const 处理输入事件 = (
    element: Element,
    inputElement: HTMLInputElement,
    position: IPosition,
    exts?: string[]
) => (event: Event) => {
    const inputEvent = event as InputEvent;
    if (inputEvent.isComposing) {
        return;
    }
    event.stopPropagation();
    renderAssetList(element, inputElement.value, position, exts);
};

/** 处理组合输入结束事件 */
const 处理组合输入结束 = (
    element: Element,
    inputElement: HTMLInputElement,
    position: IPosition,
    exts?: string[]
) => (event: Event) => {
    event.stopPropagation();
    renderAssetList(element, inputElement.value, position, exts);
};

/** 处理点击事件 */
const 处理点击事件 = (
    inputElement: HTMLInputElement,
    protyle: IProtyle,
    callback?: (url: string, name: string) => void
) => (event: Event) => {
    const target = event.target as HTMLElement;

    // 处理上一个按钮
    const previousElement = hasClosestByAttribute(target, "data-type", "previous");
    if (previousElement) {
        inputElement.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
        event.stopPropagation();
        return;
    }

    // 处理下一个按钮
    const nextElement = hasClosestByAttribute(target, "data-type", "next");
    if (nextElement) {
        inputElement.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        event.stopPropagation();
        return;
    }

    // 处理列表项点击
    const listItemElement = hasClosestByClassName(target, "b3-list-item");
    if (!listItemElement) {
        return;
    }

    event.stopPropagation();
    const currentURL = listItemElement.getAttribute("data-value") ?? "";
    const textContent = listItemElement.textContent ?? "";

    if (callback) {
        callback(currentURL, textContent);
        return;
    }

    hintRenderAssets(currentURL, protyle);
    getSiyuanGlobalMenus().menu.remove();
};

/** 判断预览区域是否应该隐藏 */
const 应该隐藏预览区域 = () => {
    const outerWidth = getWindowOuterWidth();
    return isMobile() || outerWidth < outerWidth / 2 + 260;
};

/** 绑定菜单元素事件 */
const 绑定菜单元素事件 = (
    element: HTMLElement,
    position: IPosition,
    protyle: IProtyle,
    callback?: (url: string, name: string) => void,
    exts?: string[]
) => {
    element.style.maxWidth = "none";
    const listElement = element.querySelector(".b3-list");
    const previewElement = element.querySelector("#preview");
    const inputElement = element.querySelector("input");

    if (!listElement || !previewElement || !inputElement) {
        return;
    }

    listElement.addEventListener("mouseover", 处理列表悬停(previewElement));
    inputElement.addEventListener("keydown", 处理键盘事件(element, listElement, previewElement, protyle, callback));
    inputElement.addEventListener("input", 处理输入事件(element, inputElement, position, exts));
    inputElement.addEventListener("compositionend", 处理组合输入结束(element, inputElement, position, exts));

    const lastChild = element.lastElementChild;
    if (lastChild) {
        lastChild.addEventListener("click", 处理点击事件(inputElement, protyle, callback));
    }

    renderAssetList(element, "", position, exts);
};

/** 生成菜单 HTML 模板 */
const 生成菜单HTML模板 = () => {
    const maxHeight = isMobile() ? "80" : "50";
    const columnStyle = isMobile() ? "width:100%" : "min-width: 260px;max-width:420px";
    const previewDisplay = 应该隐藏预览区域() ? "none" : "flex";

    return `<div class="fn__flex" style="max-height: ${maxHeight}vh">
<div class="fn__flex-column" style="${columnStyle}">
    <div class="fn__flex" style="margin: 0 8px 4px 8px">
        <input class="b3-text-field fn__flex-1"/>
        <span class="fn__space"></span>
        <span data-type="previous" class="block__icon block__icon--show"><svg><use xlink:href="#iconLeft"></use></svg></span>
        <span class="fn__space"></span>
        <span data-type="next" class="block__icon block__icon--show"><svg><use xlink:href="#iconRight"></use></svg></span>
    </div>
    <div class="b3-list fn__flex-1 b3-list--background" style="position: relative"><img style="margin: 0 auto;display: block;width: 64px;height: 64px" src="/stage/loading-pure.svg"></div>
</div>
<div id="preview" style="width: 360px;display: ${previewDisplay};padding: 8px;overflow: auto;justify-content: center;align-items: center;word-break: break-all;"></div>
</div>`;
};

export const assetMenu = (protyle: IProtyle, position: IPosition, callback?: (url: string, name: string) => void, exts?: string[]) => {
    const menu = new Menu(Constants.MENU_BACKGROUND_ASSET);
    if (menu.isOpen) {
        return;
    }
    menu.addItem({
        iconHTML: "",
        type: "readonly",
        label: 生成菜单HTML模板(),
        bind(element) {
            绑定菜单元素事件(element, position, protyle, callback, exts);
        }
    });
};
