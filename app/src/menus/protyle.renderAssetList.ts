import { fetchPost } from "../ai/imports";
import { renderAssetsPreview } from "../asset/renderAssets";

const updateAssetUI = (element: Element, data: { path: string; hName: string; }[]) => {
    let searchHTML = "";
    data.forEach((item, index: number) => {
        searchHTML += `<div data-value="${item.path}" class="b3-list-item${index === 0 ? " b3-list-item--focus" : ""}"><div class="b3-list-item__text">${item.hName}</div></div>`;
    });

    const listElement = element.querySelector(".b3-list");
    const previewElement = element.querySelector("#preview");
    
    listElement.innerHTML = searchHTML || `<li class="b3-list--empty">${window.siyuan.languages.emptyContent}</li>`;
    
    if (data.length > 0) {
        previewElement.innerHTML = renderAssetsPreview(data[0].path);
    } else {
        previewElement.innerHTML = window.siyuan.languages.emptyContent;
    }
};

const handleMenuAndInput = (element: Element, k: string, position: IPosition) => {
    const inputElement = element.querySelector("input");
    
    /// #if MOBILE
    window.siyuan.menus.menu.fullscreen();
    /// #else
    window.siyuan.menus.menu.popup(position);
    /// #endif
    
    if (!k) {
        inputElement.select();
    }
};

export const renderAssetList = (element: Element, k: string, position: IPosition, exts: string[] = []) => {
    fetchPost("/api/search/searchAsset", {
        k,
        exts
    }, (response) => {
        updateAssetUI(element, response.data);
        handleMenuAndInput(element, k, position);
    });
};
