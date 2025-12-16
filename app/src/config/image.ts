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
/// #if !MOBILE
import { openFile } from "../editor/util";
/// #endif

import { Custom } from "../layout/dock/Custom";
import { Plugin } from "../plugin";

import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";

export const image = {
    genHTML: () => {
        const isM = isMobile();
        return `<div class="fn__flex-column" style="height: 100%">
   
    <div class="layout-tab-bar fn__flex">
        <div class="item item--full item--focus" data-type="remove">
            <span class="fn__flex-1"></span>
            <span class="item__text">${siyuanI18n.unreferencedAssets}</span>
            <span class="fn__flex-1"></span>
        </div>
        <div class="item item--full" data-type="missing">
            <span class="fn__flex-1"></span>
            <span class="item__text">${siyuanI18n.missingAssets}</span>
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
                    ${siyuanI18n.delete}
                </button>
                <button class="open-in-new-tab b3-button b3-button--outline fn__flex-center fn__size200" data-type="remove">
                    <svg><use xlink:href="#iconEdit"></use></svg>${siyuanI18n.openInNewTab}
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
                    <svg><use xlink:href="#iconEdit"></use></svg>${siyuanI18n.openInNewTab}
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
                        id: "internal-plugin-image" + "internal-image-" + type
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
                            if (assetsListElement) {
                                assetsListElement.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
                            }
                            const previewElement = element.querySelector(".config-assets__preview");
                            if (previewElement) {
                                previewElement.innerHTML = "";
                            }
                        });
                    }, undefined, true);
                } else if (target.classList.contains("item") && !target.classList.contains("item--focus")) {
                    const barFocused = element.querySelector(".layout-tab-bar .item--focus");
                    barFocused && barFocused.classList.remove("item--focus");
                    target.classList.add("item--focus");
                    element.querySelectorAll(".config-assets").forEach(item => {
                        if (type === item.getAttribute("data-type")) {
                            item.classList.remove("fn__none");
                            if (!item.getAttribute("data-init")) {
                                fetchPost("/api/asset/getMissingAssets", {}, response => {
                                    const listElement = item.querySelector(".config-assets__list");
                                    if (listElement) {
                                        image._renderList(response.data.missingAssets, listElement, false);
                                    }
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
                    const parentElement = target.parentElement;
                    if (!parentElement) {
                        return;
                    }
                    const textElement = parentElement.querySelector(".b3-list-item__text");
                    if (textElement) {
                        writeText(textElement.textContent.trim().replace("assets/", ""));
                    }
                } else if (type === "open") {
                    /// #if !BROWSER
                    const parentElement = target.parentElement;
                    if (!parentElement) {
                        return;
                    }
                    const dataPath = parentElement.getAttribute("data-path");
                    dataPath && openBy(dataPath, "folder");
                    /// #endif
                } else if (type === "clear") {
                    const parentElement = target.parentElement;
                    if (!parentElement) {
                        return;
                    }
                    const pathString = parentElement.getAttribute("data-path");
                    if (pathString) {
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
                                if (liElement) {
                                    const liParent = liElement.parentElement;
                                    if (liParent) {
                                        if (liElement.parentElement.querySelectorAll("li").length === 1) {
                                            liElement.parentElement.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
                                        } else {
                                            liElement.remove();
                                        }
                                    }
                                }
                                const previewElement = element.querySelector(".config-assets__preview");
                                previewElement && (previewElement.innerHTML = "");
                            });
                        }, undefined, true);
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    }
                }
                const parentElement = target.parentElement;
                if (!parentElement) {
                    return;
                }
                target = parentElement;
            }
        });
        if (assetsListElement) {
            assetsListElement.addEventListener("mouseover", (event) => {
                const liElement = hasClosestByClassName(event.target as Element, "b3-list-item");
                const nextElementSibling = assetsListElement.nextElementSibling;
                if (nextElementSibling) {
                    if (liElement && liElement.getAttribute("data-path") !== nextElementSibling.getAttribute("data-path")) {
                        const item = liElement.getAttribute("data-path");
                        if (item) {
                            nextElementSibling.setAttribute("data-path", item);
                            nextElementSibling.innerHTML = renderAssetsPreview(item);
                        }
                    }
                }
            });

            fetchPost("/api/asset/getUnusedAssets", {}, response => {
                image._renderList(response.data.unusedAssets, assetsListElement);
            });
        }
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
};


const bindAssetTabEvent = (element: Element, type: string) => {
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
                        const assetsListElement = element.querySelector(".config-assets__list");
                        if (assetsListElement) {
                            assetsListElement.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
                        }
                        const previewElement = element.querySelector(".config-assets__preview");
                        if (previewElement) {
                            previewElement.innerHTML = "";
                        }
                    });
                }, undefined, true);
            } else if (target.getAttribute("data-type") === "copy") {
                const parentElement = target.parentElement;
                if (parentElement) {
                    const textElement = parentElement.querySelector(".b3-list-item__text");
                    if (textElement) {
                        writeText(textElement.textContent.trim().replace("assets/", ""));
                    }
                }
            } else if (target.getAttribute("data-type") === "open") {
                /// #if !BROWSER
                const parentElement = target.parentElement;
                if (parentElement) {
                    const dataPath = parentElement.getAttribute("data-path");
                    dataPath && openBy(dataPath, "folder");
                }
                /// #endif
            } else if (target.getAttribute("data-type") === "clear") {
                const parentElement = target.parentElement;
                if (parentElement) {
                    const pathString = parentElement.getAttribute("data-path");
                    const apiEndpoint = type === "remove" ? "/api/asset/removeUnusedAsset" : "/api/asset/removeMissingAsset";
                    if (pathString) {
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
                                if (liElement) {
                                    const liParent = liElement.parentElement;
                                    if (liParent) {
                                        if (liParent.querySelectorAll("li").length === 1) {
                                            liParent.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
                                        } else {
                                            liElement.remove();
                                        }
                                    }
                                }
                                const previewElement = element.querySelector(".config-assets__preview");
                                if (previewElement) {
                                    previewElement.innerHTML = "";

                                }
                            });
                        }, undefined, true);
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                }
            }
            target.parentElement && (target = target.parentElement);
        }
    });
    if (assetsListElement) {
        assetsListElement.addEventListener("mouseover", (event) => {
            const liElement = hasClosestByClassName(event.target as Element, "b3-list-item");
            const liNextElementSibling = assetsListElement.nextElementSibling;
            if (liNextElementSibling) {
                if (liElement && liElement.getAttribute("data-path") !== liNextElementSibling.getAttribute("data-path")) {
                    const item = liElement.getAttribute("data-path");
                    if (item) {
                        assetsListElement.nextElementSibling.setAttribute("data-path", item);
                        assetsListElement.nextElementSibling.innerHTML = renderAssetsPreview(item);
                    }
                }
            }
        });

        const apiEndpoint = type === "remove" ? "/api/asset/getUnusedAssets" : "/api/asset/getMissingAssets";
        fetchPost(apiEndpoint, {}, response => {
            const data = type === "remove" ? response.data.unusedAssets : response.data.missingAssets;
            image._renderList(data, assetsListElement, type === "remove");
        });
    }
};



const genAssetTabHTML = (type: string) => {
    return `<div class="fn__flex-column" style="height: 100%">
            <div class="fn__hr--b"></div>
            <div class="fn__flex">
                <div class="fn__space"></div>
                <button id="${type}All" class="b3-button b3-button--outline fn__flex-center fn__size200">
                    <svg class="svg"><use xlink:href="#iconTrashcan"></use></svg>
                    ${siyuanI18n.delete}
                </button>
            </div>
            <div class="fn__hr"></div>
            <ul class="b3-list b3-list--background config-assets__list">
                <li class="fn__loading"><img src="/stage/loading-pure.svg"></li>
            </ul>
            <div class="config-assets__preview"></div>
        </div>`;
};

let plugin: Plugin;
document.addEventListener(
    "app-ready", () => {
        plugin = new Plugin(
            {
                app: window.siyuan.ws.app,
                displayName: "资源管理内部插件",
                name: "internal-plugin-image",
                i18n: {}
            }
        );
        plugin.addTab(
            {
                type: "internal-image",
                init: (model: Custom) => {
                    const tab = model.tab;
                    if (tab) {
                        tab.panelElement.innerHTML = image.genHTML();
                        image.bindEvent(tab.panelElement);
                    }
                }
            }
        );
        // 注册未引用资源页签类型
        plugin.addTab(
            {
                type: "internal-image-remove",
                init: (model: Custom) => {
                    const tab = model.tab;
                    if (tab) {
                        // 生成未引用资源页签的HTML
                        tab.panelElement.innerHTML = genAssetTabHTML("remove");
                        bindAssetTabEvent(tab.panelElement, "remove");
                    }
                }
            }
        );
        // 注册缺失资源页签类型
        plugin.addTab(
            {
                type: "internal-image-missing",
                init: (model: Custom) => {
                    const tab = model.tab;
                    if (tab) {
                        // 生成缺失资源页签的HTML
                        tab.panelElement.innerHTML = genAssetTabHTML("missing");
                        bindAssetTabEvent(tab.panelElement, "missing");
                    }
                }
            }
        );
        window.siyuan.ws.app.plugins.push(plugin);
    }
);
