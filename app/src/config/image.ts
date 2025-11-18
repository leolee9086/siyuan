import { escapeHtml } from "../util/escape";
import { confirmDialog } from "../dialog/confirmDialog";
import { pathPosix } from "../util/pathName";
import { isBrowser, isMobile } from "../util/functions";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { fetchPost } from "../util/fetch";
/// #if !MOBILE
import { getAllModels } from "../layout/getAll";
/// #endif
import { openBy } from "../editor/utils.openBy";
import { renderAssetsPreview } from "../asset/renderAssets";
import { writeText } from "../protyle/util/compatibility";
import { openFile } from "../editor/util";
import { Custom } from "../layout/dock/Custom";
import { Plugin } from "../plugin";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";

export const image = {
    element: undefined as Element,
    genHTML: () => {
        const isM = isMobile();
        return `<div class="fn__flex-column" style="height: 100%">
   
    <div class="layout-tab-bar fn__flex">
        <div class="item item--full item--focus" data-type="remove">
            <span class="fn__flex-1"></span>
            <span class="item__text">${window.siyuan.languages.unreferencedAssets}</span>
            <span class="fn__flex-1"></span>
        </div>
        <div class="item item--full" data-type="missing">
            <span class="fn__flex-1"></span>
            <span class="item__text">${window.siyuan.languages.missingAssets}</span>
            <span class="fn__flex-1"></span>
        </div>
    </div>
    <div class="fn__flex-1">
        <div class="config-assets${isM ? " b3-list--mobile" : ""}" data-type="remove" data-init="true">
            <div class="fn__hr--b"></div>
            <div class="fn__flex">
                <div class="fn__space"></div>
                <button id="removeAll" class="b3-button b3-button--outline fn__flex-center fn__size200">
                    <svg class="svg"><use xlink:href="#iconTrashcan"></use></svg>
                    ${window.siyuan.languages.delete}
                </button>
                <button class="open-in-new-tab b3-button b3-button--outline fn__flex-center fn__size200" data-type="remove">
                    <svg><use xlink:href="#iconEdit"></use></svg>${window.siyuan.languages.openInNewTab}
                </button>
            </div>
            <div class="fn__hr"></div>
            <ul class="b3-list b3-list--background config-assets__list">
                <li class="fn__loading"><img src="/stage/loading-pure.svg"></li>
            </ul>
            <div class="config-assets__preview"></div>
        </div>
        <div class="fn__none config-assets${isM ? " b3-list--mobile" : ""}" data-type="missing">
            <div class="fn__hr"></div>
            <div class="fn__flex">
                <div class="fn__space"></div>
                <button class="open-in-new-tab b3-button b3-button--outline fn__flex-center fn__size200" data-type="missing">
                    <svg><use xlink:href="#iconEdit"></use></svg>${window.siyuan.languages.openInNewTab}
                </button>
            </div>
            <div class="fn__hr"></div>
            <ul class="b3-list b3-list--background config-assets__list">
                <li class="fn__loading"><img src="/stage/loading-pure.svg"></li>
            </ul>
            <div class="fn__hr"></div>
        </div>
    </div>
</div>`;
    },
    bindEvent: (element: Element) => {
        const assetsListElement = element.querySelector(".config-assets__list");

        // 为"在新页签中打开"按钮添加点击事件
        const openInNewTabButtons = element.querySelectorAll(".open-in-new-tab") as NodeListOf<HTMLButtonElement>;
        openInNewTabButtons.forEach(button => {
            button.addEventListener("click", async () => {
                const type = button.getAttribute("data-type");
                const title = type === "remove" ? siyuanI18n.unreferencedAssets : siyuanI18n.missingAssets;
                await openFile({
                    app: window.siyuan.ws.app,
                    custom: {
                        title: title,
                        icon: "#iconImage",
                        id: 'internal-plugin-image' + "internal-image-" + type
                    }
                });
            });
        });

        element.addEventListener("click", (event) => {
            let target = event.target as HTMLElement;
            while (target && !target.isEqualNode(element)) {
                const type = target.getAttribute("data-type");
                if (target.id === "removeAll") {
                    confirmDialog(siyuanI18n.deleteOpConfirm, `${siyuanI18n.clearAll}`, () => {
                        fetchPost("/api/asset/removeUnusedAssets", {}, response => {
                            /// #if !MOBILE
                            getAllModels().asset.forEach(item => {
                                if (response.data.paths.includes(item.path)) {
                                    item.parent.close();
                                }
                            });
                            /// #endif
                            assetsListElement.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
                            element.querySelector(".config-assets__preview").innerHTML = "";
                        });
                    }, undefined, true);
                } else if (target.classList.contains("item") && !target.classList.contains("item--focus")) {
                    element.querySelector(".layout-tab-bar .item--focus").classList.remove("item--focus");
                    target.classList.add("item--focus");
                    element.querySelectorAll(".config-assets").forEach(item => {
                        if (type === item.getAttribute("data-type")) {
                            item.classList.remove("fn__none");
                            if (!item.getAttribute("data-init")) {
                                fetchPost("/api/asset/getMissingAssets", {}, response => {
                                    image._renderList(response.data.missingAssets, item.querySelector(".config-assets__list"), false);
                                });
                                item.setAttribute("data-init", "true");
                            }
                        } else {
                            item.classList.add("fn__none");
                        }
                    });
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "copy") {
                    writeText(target.parentElement.querySelector(".b3-list-item__text").textContent.trim().replace("assets/", ""));
                } else if (type === "open") {
                    /// #if !BROWSER
                    openBy(target.parentElement.getAttribute("data-path"), "folder");
                    /// #endif
                } else if (type === "clear") {
                    const pathString = target.parentElement.getAttribute("data-path");
                    confirmDialog(siyuanI18n.deleteOpConfirm, `${siyuanI18n.delete} <b>${pathPosix().basename(pathString)}</b>`, () => {
                        fetchPost("/api/asset/removeUnusedAsset", {
                            path: pathString,
                        }, response => {
                            /// #if !MOBILE
                            getAllModels().asset.forEach(item => {
                                if (response.data.path === item.path) {
                                    item.parent.parent.removeTab(item.parent.id);
                                }
                            });
                            /// #endif
                            const liElement = target.parentElement;
                            if (liElement.parentElement.querySelectorAll("li").length === 1) {
                                liElement.parentElement.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
                            } else {
                                liElement.remove();
                            }
                            element.querySelector(".config-assets__preview").innerHTML = "";
                        });
                    }, undefined, true);
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                }
                target = target.parentElement;
            }
        });

        assetsListElement.addEventListener("mouseover", (event) => {
            const liElement = hasClosestByClassName(event.target as Element, "b3-list-item");
            if (liElement && liElement.getAttribute("data-path") !== assetsListElement.nextElementSibling.getAttribute("data-path")) {
                const item = liElement.getAttribute("data-path");
                assetsListElement.nextElementSibling.setAttribute("data-path", item);
                assetsListElement.nextElementSibling.innerHTML = renderAssetsPreview(item);
            }
        });
        fetchPost("/api/asset/getUnusedAssets", {}, response => {
            image._renderList(response.data.unusedAssets, assetsListElement);
        });
    },
    _renderList: (data: string[], element: Element, action = true) => {
        let html = "";
        let boxOpenHTML = "";
        if (!isBrowser() && action) {
            boxOpenHTML = `<span data-type="open" class="ariaLabel b3-list-item__action" aria-label="${siyuanI18n.showInFolder}">
    <svg><use xlink:href="#iconFolder"></use></svg>
</span>`;
        }
        let boxClearHTML = "";
        if (action) {
            boxClearHTML = `<span data-type="clear" class="ariaLabel b3-list-item__action" aria-label="${siyuanI18n.delete}">
    <svg><use xlink:href="#iconTrashcan"></use></svg>
</span>`;
        }
        const isM = isMobile();
        data.forEach((item) => {
            const idx = item.indexOf("assets/");
            const dataPath = item.substr(idx);
            html += `<li data-path="${dataPath}"  class="b3-list-item${isM ? "" : " b3-list-item--hide-action"}">
    <span class="b3-list-item__text">${escapeHtml(item)}</span>
    <span data-type="copy" class="ariaLabel b3-list-item__action" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>
    ${boxOpenHTML}
    ${boxClearHTML}
</li>`;
        });
        element.innerHTML = html || `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
    },
    genAssetTabHTML: (type: string) => {
        const isM = isMobile();
        const title = type === "remove" ? siyuanI18n.unreferencedAssets : siyuanI18n.missingAssets;
        return `<div class="fn__flex-column" style="height: 100%">
            <div class="fn__hr--b"></div>
            <div class="fn__flex">
                <div class="fn__space"></div>
                <button id="${type}All" class="b3-button b3-button--outline fn__flex-center fn__size200">
                    <svg class="svg"><use xlink:href="#iconTrashcan"></use></svg>
                    ${window.siyuan.languages.delete}
                </button>
            </div>
            <div class="fn__hr"></div>
            <ul class="b3-list b3-list--background config-assets__list">
                <li class="fn__loading"><img src="/stage/loading-pure.svg"></li>
            </ul>
            <div class="config-assets__preview"></div>
        </div>`;
    },
    bindAssetTabEvent: (element: Element, type: string) => {
        const assetsListElement = element.querySelector(".config-assets__list");

        element.addEventListener("click", (event) => {
            let target = event.target as HTMLElement;
            while (target && !target.isEqualNode(element)) {
                if (target.id === `${type}All`) {
                    const apiEndpoint = type === "remove" ? "/api/asset/removeUnusedAssets" : "/api/asset/removeMissingAssets";
                    confirmDialog(siyuanI18n.deleteOpConfirm, `${siyuanI18n.clearAll}`, () => {
                        fetchPost(apiEndpoint, {}, response => {
                            /// #if !MOBILE
                            getAllModels().asset.forEach(item => {
                                if (response.data.paths.includes(item.path)) {
                                    item.parent.close();
                                }
                            });
                            /// #endif
                            assetsListElement.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
                            element.querySelector(".config-assets__preview").innerHTML = "";
                        });
                    }, undefined, true);
                } else if (target.getAttribute("data-type") === "copy") {
                    writeText(target.parentElement.querySelector(".b3-list-item__text").textContent.trim().replace("assets/", ""));
                } else if (target.getAttribute("data-type") === "open") {
                    /// #if !BROWSER
                    openBy(target.parentElement.getAttribute("data-path"), "folder");
                    /// #endif
                } else if (target.getAttribute("data-type") === "clear") {
                    const pathString = target.parentElement.getAttribute("data-path");
                    const apiEndpoint = type === "remove" ? "/api/asset/removeUnusedAsset" : "/api/asset/removeMissingAsset";
                    confirmDialog(siyuanI18n.deleteOpConfirm, `${siyuanI18n.delete} <b>${pathPosix().basename(pathString)}</b>`, () => {
                        fetchPost(apiEndpoint, {
                            path: pathString,
                        }, response => {
                            /// #if !MOBILE
                            getAllModels().asset.forEach(item => {
                                if (response.data.path === item.path) {
                                    item.parent.parent.removeTab(item.parent.id);
                                }
                            });
                            /// #endif
                            const liElement = target.parentElement;
                            if (liElement.parentElement.querySelectorAll("li").length === 1) {
                                liElement.parentElement.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
                            } else {
                                liElement.remove();
                            }
                            element.querySelector(".config-assets__preview").innerHTML = "";
                        });
                    }, undefined, true);
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                }
                target = target.parentElement;
            }
        });

        assetsListElement.addEventListener("mouseover", (event) => {
            const liElement = hasClosestByClassName(event.target as Element, "b3-list-item");
            if (liElement && liElement.getAttribute("data-path") !== assetsListElement.nextElementSibling.getAttribute("data-path")) {
                const item = liElement.getAttribute("data-path");
                assetsListElement.nextElementSibling.setAttribute("data-path", item);
                assetsListElement.nextElementSibling.innerHTML = renderAssetsPreview(item);
            }
        });

        const apiEndpoint = type === "remove" ? "/api/asset/getUnusedAssets" : "/api/asset/getMissingAssets";
        fetchPost(apiEndpoint, {}, response => {
            const data = type === "remove" ? response.data.unusedAssets : response.data.missingAssets;
            image._renderList(data, assetsListElement, type === "remove");
        });
    }
};

let plugin: Plugin
document.addEventListener(
    'app-ready', () => {
        plugin = new Plugin(
            {
                app: window.siyuan.ws.app,
                displayName: "资源管理内部插件",
                name: 'internal-plugin-image',
                i18n: {}
            }
        )
        plugin.addTab(
            {
                type: "internal-image",
                init: (model: Custom) => {
                    const tab = model.tab
                    if (tab) {
                        tab.panelElement.innerHTML = image.genHTML()
                        image.bindEvent(tab.panelElement)
                    }
                }
            }
        )
        // 注册未引用资源页签类型
        plugin.addTab(
            {
                type: "internal-image-remove",
                init: (model: Custom) => {
                    const tab = model.tab
                    if (tab) {
                        // 生成未引用资源页签的HTML
                        tab.panelElement.innerHTML = image.genAssetTabHTML("remove")
                        image.bindAssetTabEvent(tab.panelElement, "remove")
                    }
                }
            }
        )
        // 注册缺失资源页签类型
        plugin.addTab(
            {
                type: "internal-image-missing",
                init: (model: Custom) => {
                    const tab = model.tab
                    if (tab) {
                        // 生成缺失资源页签的HTML
                        tab.panelElement.innerHTML = image.genAssetTabHTML("missing")
                        image.bindAssetTabEvent(tab.panelElement, "missing")
                    }
                }
            }
        )
        window.siyuan.ws.app.plugins.push(plugin)
    }
)
