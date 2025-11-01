import { fetchPost } from "../ai/imports";
import { renderAssetsPreview } from "../asset/renderAssets";


export const renderAssetList = (element: Element, k: string, position: IPosition, exts: string[] = []) => {
    fetchPost("/api/search/searchAsset", {
        k,
        exts
    }, (response) => {
        let searchHTML = "";
        response.data.forEach((item: { path: string; hName: string; }, index: number) => {
            searchHTML += `<div data-value="${item.path}" class="b3-list-item${index === 0 ? " b3-list-item--focus" : ""}"><div class="b3-list-item__text">${item.hName}</div></div>`;
        });

        const listElement = element.querySelector(".b3-list");
        const previewElement = element.querySelector("#preview");
        const inputElement = element.querySelector("input");
        listElement.innerHTML = searchHTML || `<li class="b3-list--empty">${window.siyuan.languages.emptyContent}</li>`;
        if (response.data.length > 0) {
            previewElement.innerHTML = renderAssetsPreview(response.data[0].path);
        } else {
            previewElement.innerHTML = window.siyuan.languages.emptyContent;
        }
        /// #if MOBILE
        window.siyuan.menus.menu.fullscreen();
        /// #else
        window.siyuan.menus.menu.popup(position);
        /// #endif
        if (!k) {
            inputElement.select();
        }
    });
};
