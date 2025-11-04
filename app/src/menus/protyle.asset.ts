import { focusByRange } from "../ai/imports";
import { renderAssetsPreview } from "../asset/renderAssets";
import { Constants } from "../constants";
import { Menu } from "../plugin/Menu";
import { hintRenderAssets } from "../protyle/hint/extend";
import { hasClosestByClassName, hasClosestByAttribute } from "../protyle/util/hasClosest";
import { isMobile } from "../util/functions";
import { upDownHint } from "../util/upDownHint";
import { fetchPost } from "../ai/imports";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";
import { getGlobalMenus } from "../util/siyuanEnvironments/getMenu";

const updateAssetUI = (listElement: Element, data: { path: string; hName: string; }[]) => {
    let searchHTML = "";
    data.forEach((item, index: number) => {
        searchHTML += `<div data-value="${item.path}" class="b3-list-item${index === 0 ? " b3-list-item--focus" : ""}"><div class="b3-list-item__text">${item.hName}</div></div>`;
    });
    listElement.innerHTML = searchHTML || `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
};



export const renderAssetList = (element: Element, k: string, position: IPosition, exts: string[] = []) => {
    fetchPost("/api/search/searchAsset", {
        k,
        exts
    }, (response) => {
        const inputElement = element.querySelector("input");
        const previewElement = element.querySelector("#preview");
        const listElement = element.querySelector(".b3-list");
        listElement && updateAssetUI(listElement, response.data);
        if (previewElement) {
            if (response.data.length > 0) {
                previewElement.innerHTML = renderAssetsPreview(response.data[0].path);
            } else {
                previewElement.innerHTML = siyuanI18n.emptyContent;
            }
        }
        /// #if MOBILE
        getGlobalMenus().menu.fullscreen();
        /// #else
        getGlobalMenus().menu.popup(position);
        /// #endif
        if (!k) {
            inputElement && inputElement.select();
        }
    });
};

export const assetMenu = (protyle: IProtyle, position: IPosition, callback?: (url: string, name: string) => void, exts?: string[]) => {
    const menu = new Menu(Constants.MENU_BACKGROUND_ASSET);
    if (menu.isOpen) {
        return;
    }
    menu.addItem({
        iconHTML: "",
        type: "readonly",
        label: `<div class="fn__flex" style="max-height: ${isMobile() ? "80" : "50"}vh">
<div class="fn__flex-column" style="${isMobile() ? "width:100%" : "min-width: 260px;max-width:420px"}">
    <div class="fn__flex" style="margin: 0 8px 4px 8px">
        <input class="b3-text-field fn__flex-1"/>
        <span class="fn__space"></span>
        <span data-type="previous" class="block__icon block__icon--show"><svg><use xlink:href="#iconLeft"></use></svg></span>
        <span class="fn__space"></span>
        <span data-type="next" class="block__icon block__icon--show"><svg><use xlink:href="#iconRight"></use></svg></span>
    </div>
    <div class="b3-list fn__flex-1 b3-list--background" style="position: relative"><img style="margin: 0 auto;display: block;width: 64px;height: 64px" src="/stage/loading-pure.svg"></div>
</div>
<div id="preview" style="width: 360px;display: ${isMobile() || window.outerWidth < window.outerWidth / 2 + 260 ? "none" : "flex"};padding: 8px;overflow: auto;justify-content: center;align-items: center;word-break: break-all;"></div>
</div>`,
        bind(element) {
            element.style.maxWidth = "none";
            const listElement = element.querySelector(".b3-list");
            const previewElement = element.querySelector("#preview");
            const inputElement = element.querySelector("input");
            listElement.addEventListener("mouseover", (event) => {
                const target = event.target as HTMLElement;
                const hoverItemElement = hasClosestByClassName(target, "b3-list-item");
                if (!hoverItemElement) {
                    return;
                }
                previewElement.innerHTML = renderAssetsPreview(hoverItemElement.getAttribute("data-value"));
            });
            inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
                if (event.isComposing) {
                    return;
                }
                const isEmpty = element.querySelector(".b3-list--empty");
                if (!isEmpty) {
                    const currentElement = upDownHint(listElement, event);
                    if (currentElement) {
                        previewElement.innerHTML = renderAssetsPreview(currentElement.getAttribute("data-value"));
                        event.stopPropagation();
                    }
                }

                if (event.key === "Enter") {
                    if (!isEmpty) {
                        const currentElement = element.querySelector(".b3-list-item--focus");
                        if (callback) {
                            callback(currentElement.getAttribute("data-value"), currentElement.textContent);
                        } else {
                            hintRenderAssets(currentElement.getAttribute("data-value"), protyle);
                            window.siyuan.menus.menu.remove();
                        }
                    } else if (!callback) {
                        window.siyuan.menus.menu.remove();
                        focusByRange(protyle.toolbar.range);
                    }
                    // 空行处插入 mp3 会多一个空的 mp3 块
                    event.preventDefault();
                    event.stopPropagation();
                } else if (event.key === "Escape") {
                    if (!callback) {
                        focusByRange(protyle.toolbar.range);
                    }
                }
            });
            inputElement.addEventListener("input", (event: InputEvent) => {
                if (event.isComposing) {
                    return;
                }
                event.stopPropagation();
                renderAssetList(element, inputElement.value, position, exts);
            });
            inputElement.addEventListener("compositionend", (event: InputEvent) => {
                event.stopPropagation();
                renderAssetList(element, inputElement.value, position, exts);
            });
            element.lastElementChild.addEventListener("click", (event) => {
                const target = event.target as HTMLElement;
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
                const listItemElement = hasClosestByClassName(target, "b3-list-item");
                if (listItemElement) {
                    event.stopPropagation();
                    const currentURL = listItemElement.getAttribute("data-value");
                    if (callback) {
                        callback(currentURL, listItemElement.textContent);
                    } else {
                        hintRenderAssets(currentURL, protyle);
                        window.siyuan.menus.menu.remove();
                    }
                }
            });
            renderAssetList(element, "", position, exts);
        }
    });
};
