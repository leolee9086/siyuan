// S-forge: 使用格式化的导入风格
import {escapeAttr, escapeHtml} from "../util/DOM/escape";
import {confirmDialog} from "../dialog/confirmDialog";
// S-forge: pathPosix 用于文件名提取
import {pathPosix} from "../util/file/pathName";
import {isBrowser, isMobile} from "../util/platform/functions";
import {hasClosestByClassName} from "../protyle/util/hasClosest";
import {fetchPost} from "../util/network/fetch";
import {getAllModels} from "../layout/getAll";
import {isElectron} from "../platform";
import {nativeRequire} from "../platform/nativeRequire";
// S-forge: openBy 从重构后的模块导入
import {openBy} from "../platform/localPath/openBy";
import {renderAssetsPreview} from "../asset/renderAssets";
import {writeText} from "../protyle/util/compatibility";
import {Constants} from "../constants";
import {showMessage} from "../dialog/message";
import {Protyle} from "../protyle";
import type { AppFacade } from "../app/AppFacade.types";
import {disabledProtyle, onGet} from "../protyle/util/onGet";
import {removeLoading} from "../protyle/ui/loading";
// S-forge: 统一 i18n 访问
import {siyuanI18n} from "../util/siyuanEnvironments/i18n.getI18n.environment";
import {switchSettingPanelSubTab} from "./setting/mount";
import {openMobileFileByIdViaPort} from "../plugin/api/openMobileFile.port";
import {BlockPanel} from "../block/panel/Panel";

/** 资源 Tab 侧栏 / 全局搜索索引文案 */
export const collectAssetsTabSearchStrings = (): string[] => [
    window.siyuan.languages.assets,
    window.siyuan.languages.unreferencedAssets,
    window.siyuan.languages.unreferencedAV,
    window.siyuan.languages.missingAssets,
];

/** 资源 Tab 挂载（面板页，不走注册表渲染） */
export const mountAssetsTab = (root: HTMLElement, keywords?: string, app?: AppFacade) => {
    if (root.innerHTML === "") {
        assets.element = root;
        root.innerHTML = assets.genHTML();
        if (app) {
            assets.bindEvent(app);
        }
    } else {
        assets.element = root;
    }
    if (keywords) {
        switchSettingPanelSubTab(root, keywords, [
            {type: "remove", label: window.siyuan.languages.unreferencedAssets},
            {type: "removeAV", label: window.siyuan.languages.unreferencedAV},
            {type: "missing", label: window.siyuan.languages.missingAssets},
        ]);
    }
};

const assets = {
    element: undefined as Element,
    genHTML: () => {
        const mobile = isMobile();
        return `<div class="fn__flex-column" style="height: 100%">
    <div class="layout-tab-bar fn__flex">
        <div class="item item--full item--focus" data-type="remove">
            <span class="fn__flex-1"></span>
            <span class="item__text">${siyuanI18n.unreferencedAssets}</span>
            <span class="fn__flex-1"></span>
        </div>
        <div class="item item--full" data-type="removeAV">
            <span class="fn__flex-1"></span>
                <span class="item__text">${window.siyuan.languages.unreferencedAV}</span>
            <span class="fn__flex-1"></span>
        </div>
        <div class="item item--full" data-type="missing">
            <span class="fn__flex-1"></span>
            <span class="item__text">${siyuanI18n.missingAssets}</span>
            <span class="fn__flex-1"></span>
        </div>
    </div>
    <div class="fn__flex-1">
        <div class="config-assets${mobile ? " b3-list--mobile" : ""}" data-type="remove" data-init="true">
            <div class="fn__hr--b"></div>
            <div class="fn__flex">
                <div class="fn__space"></div>
                <button id="removeAll" class="b3-button b3-button--outline fn__flex-center fn__size200">
                    <svg class="svg"><use xlink:href="#iconTrashcan"></use></svg>
                    ${siyuanI18n.delete}
                </button>
            </div>
            <div class="fn__hr"></div>
            <ul class="b3-list b3-list--background config-assets__list">
                <li class="fn__loading"><img src="/stage/loading-pure.svg"></li>
            </ul>
            <div class="config-assets__preview"></div>
        </div>
        <div class="fn__none config-assets${mobile ? " b3-list--mobile" : ""}" data-type="removeAV">
            <div class="fn__hr--b"></div>
            <div class="fn__flex">
                <div class="fn__space"></div>
                <button id="removeAVAll" class="b3-button b3-button--outline fn__flex-center fn__size200">
                    <svg class="svg"><use xlink:href="#iconTrashcan"></use></svg>
                    ${window.siyuan.languages.delete}
                </button>
            </div>
            <div class="fn__hr"></div>
            <ul class="b3-list b3-list--background config-assets__list">
                <li class="fn__loading"><img src="/stage/loading-pure.svg"></li>
            </ul>
            <div class="config-assets__preview" style="display: block;padding: 8px;"></div>
        </div>
        <div class="fn__none config-assets${mobile ? " b3-list--mobile" : ""}" data-type="missing">
            <div class="fn__hr"></div>
            <ul class="b3-list b3-list--background config-assets__list">
                <li class="fn__loading"><img src="/stage/loading-pure.svg"></li>
            </ul>
            <div class="fn__hr"></div>
        </div>
    </div>
</div>`;
    },
    bindEvent: (app: AppFacade) => {
        const assetsListElement = assets.element.querySelector('.config-assets[data-type="remove"] .config-assets__list');
        const avListElement = assets.element.querySelector('.config-assets[data-type="removeAV"] .config-assets__list');
        const editor = new Protyle(app, avListElement.nextElementSibling as HTMLElement, {
            blockId: "",
            action: [Constants.CB_GET_HISTORY],
            render: {
                background: false,
                gutter: false,
                breadcrumb: false,
                breadcrumbDocName: false,
            },
            typewriterMode: false,
        });
        disabledProtyle(editor.protyle);
        removeLoading(editor.protyle);
        assets.element.addEventListener("click", (event) => {
            let target = event.target as HTMLElement;
            while (target && !target.isEqualNode(assets.element)) {
                const type = target.getAttribute("data-type");
                if (target.id === "removeAll") {
                    confirmDialog(siyuanI18n.deleteOpConfirm, `${siyuanI18n.clearAll}`, () => {
                        fetchPost("/api/asset/removeUnusedAssets", {}, response => {
                            if (!isMobile()) {
                                getAllModels().asset.forEach(item => {
                                    if (response.data.paths.includes(item.path)) {
                                        item.parent.close();
                                    }
                                });
                            }
                            assetsListElement.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
                            assetsListElement.nextElementSibling.innerHTML = "";
                        });
                    }, undefined, true);
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (target.id === "removeAVAll") {
                    confirmDialog(window.siyuan.languages.deleteOpConfirm, `${window.siyuan.languages.clearAllAV}`, () => {
                        fetchPost("/api/av/removeUnusedAttributeViews", {}, () => {
                            avListElement.innerHTML = `<li class="b3-list--empty">${window.siyuan.languages.emptyContent}</li>`;
                            avListElement.nextElementSibling.innerHTML = "";
                        });
                    }, undefined, true);
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (target.classList.contains("item") && !target.classList.contains("item--focus")) {
                    assets.element.querySelector(".layout-tab-bar .item--focus").classList.remove("item--focus");
                    target.classList.add("item--focus");
                    assets.element.querySelectorAll(".config-assets").forEach(item => {
                        if (type === item.getAttribute("data-type")) {
                            item.classList.remove("fn__none");
                            if (type === "remove") {
                                fetchPost("/api/asset/getUnusedAssets", {}, response => {
                                    assets._renderList(response.data, assetsListElement, "unrefAssets");
                                });
                            } else if (!item.getAttribute("data-init")) {
                                if (type === "removeAV") {
                                    fetchPost("/api/av/getUnusedAttributeViews", {}, response => {
                                        assets._renderList(response.data, avListElement, "unRefAV");
                                    });
                                } else {
                                    fetchPost("/api/asset/getMissingAssets", {}, response => {
                                        assets._renderList(response.data, item.querySelector(".config-assets__list"), "lostAssets");
                                    });
                                }
                                item.setAttribute("data-init", "true");
                            }
                        } else {
                            item.classList.add("fn__none");
                        }
                    });
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (target.getAttribute("data-tab-type") === "unRefAV") {
                    avListElement.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
                    target.classList.add("b3-list-item--focus");
                    onGet({
                        data: {
                            data: {
                                content: `<div class="av" data-node-id="${Lute.NewNodeID()}" data-av-id="${target.dataset.item}" data-type="NodeAttributeView" data-av-type="table"><div spellcheck="true"></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`,
                                id: Lute.NewNodeID(),
                                rootID: Lute.NewNodeID(),
                            },
                            msg: "",
                            code: 0
                        },
                        protyle: editor.protyle,
                        action: [Constants.CB_GET_HISTORY, Constants.CB_GET_HTML, Constants.CB_GET_AV_NO_CREATE],
                    });
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "openFloat") {
                    const blockIDs = JSON.parse(target.getAttribute("data-id")) as string[];
                    if (blockIDs.length > 0) {
                        if (isMobile()) {
                            openMobileFileByIdViaPort(app, blockIDs[0], [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL]);
                        } else {
                            window.siyuan.blockPanels.push(new BlockPanel({
                                app,
                                isBacklink: false,
                                targetElement: target,
                                refDefs: blockIDs.map(refID => ({refID})),
                            }));
                        }
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "copy") {
                    if (target.parentElement.getAttribute("data-tab-type") === "unRefAV") {
                        writeText(`<div class="av" data-node-id="${Lute.NewNodeID()}" data-av-id="${target.parentElement.dataset.item}" data-type="NodeAttributeView" data-av-type="table"></div>`);
                    } else {
                        writeText(target.parentElement.querySelector(".b3-list-item__text").textContent.trim());
                    }
                    showMessage(window.siyuan.languages.copied);
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "open") {
                    if (isElectron) {
                        const nodePath = nativeRequire<typeof import("path")>("path");
                        if (target.parentElement.getAttribute("data-tab-type") === "unRefAV") {
                            openBy(nodePath.join(window.siyuan.config.system.dataDir, "storage", "av", target.parentElement.dataset.item) + ".json", "folder");
                        } else {
                            openBy(target.parentElement.dataset.item, "folder");
                        }
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "clear") {
                    const liElement = target.parentElement;
                    confirmDialog(siyuanI18n.deleteOpConfirm, `${siyuanI18n.delete} <b>${liElement.querySelector(".b3-list-item__text").textContent}</b>`, () => {
                        if (liElement.getAttribute("data-tab-type") === "unRefAV") {
                            const id = liElement.getAttribute("data-item");
                            fetchPost("/api/av/removeUnusedAttributeView", {
                                id,
                            }, () => {
                                if (liElement.parentElement.querySelectorAll("li").length === 1) {
                                    liElement.parentElement.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
                                } else {
                                    liElement.remove();
                                }
                                if (editor.protyle.element.querySelector(`.av[data-av-id="${id}"]`)) {
                                    onGet({
                                        data: {
                                            data: {
                                                content: "",
                                                id: Lute.NewNodeID(),
                                                rootID: Lute.NewNodeID(),
                                            },
                                            msg: "",
                                            code: 0
                                        },
                                        protyle: editor.protyle,
                                        action: [Constants.CB_GET_HISTORY, Constants.CB_GET_HTML],
                                    });
                                }
                            });
                        } else {
                            fetchPost("/api/asset/removeUnusedAsset", {
                                path: liElement.getAttribute("data-item"),
                            }, response => {
                                if (!isMobile()) {
                                    getAllModels().asset.forEach(item => {
                                        if (response.data.path === item.path) {
                                            item.parent.parent.removeTab(item.parent.id);
                                        }
                                    });
                                }
                                if (liElement.parentElement.querySelectorAll("li").length === 1) {
                                    liElement.parentElement.innerHTML = `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
                                } else {
                                    liElement.remove();
                                }
                                assetsListElement.nextElementSibling.innerHTML = "";
                            });
                        }
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
            if (liElement && liElement.getAttribute("data-item") !== assetsListElement.nextElementSibling.getAttribute("data-item")) {
                const item = liElement.getAttribute("data-item");
                assetsListElement.nextElementSibling.setAttribute("data-item", item);
                assetsListElement.nextElementSibling.innerHTML = renderAssetsPreview(liElement.getAttribute("data-path"), item);
            }
        });
        fetchPost("/api/asset/getUnusedAssets", {}, response => {
            assets._renderList(response.data, assetsListElement, "unrefAssets");
        });
    },
    _renderList: (data: {
        item: string,
        name: string,
        path?: string,
        blockIDs?: string[]
    }[], element: Element, type: "unRefAV" | "unrefAssets" | "lostAssets") => {
        let html = "";
        let boxOpenHTML = "";
        if (!isBrowser() && type !== "lostAssets") {
            boxOpenHTML = `<span data-type="open" class="ariaLabel b3-list-item__action" aria-label="${siyuanI18n.showInFolder}">
    <svg><use xlink:href="#iconFolder"></use></svg>
</span>`;
        }
        let boxClearHTML = "";
        if (type !== "lostAssets") {
            boxClearHTML = `<span data-type="clear" class="ariaLabel b3-list-item__action" aria-label="${siyuanI18n.delete}">
    <svg><use xlink:href="#iconTrashcan"></use></svg>
</span>`;
        }
        const mobile = isMobile();
        data.forEach((item) => {
            const blockPopoverHTML = type === "lostAssets" && item.blockIDs?.length > 0
                ? `<span data-type="openFloat" data-id="${escapeAttr(JSON.stringify(item.blockIDs))}" class="ariaLabel b3-list-item__action" aria-label="${window.siyuan.languages.refPopover}">
        <svg><use xlink:href="#iconPictureInPicture"></use></svg>
    </span>`
                : "";
            html += `<li data-tab-type="${type}" data-item="${escapeAttr(item.item)}" data-path="${escapeAttr(item.path || item.item)}" class="b3-list-item${mobile ? "" : " b3-list-item--hide-action"}">
    <span class="b3-list-item__text">${escapeHtml(item.name || item.item)}</span>
    ${blockPopoverHTML}
    <span data-type="copy" class="ariaLabel b3-list-item__action" aria-label="${type === "unRefAV" ? window.siyuan.languages.copyMirror : window.siyuan.languages.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>
    ${boxOpenHTML}
    ${boxClearHTML}
</li>`;
        });
        element.innerHTML = html || `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
    }
};

// S-forge: 兼容本地旧配置入口，外部逐步迁移到 assets.ts 后仍可复用原 image API。
export const image = assets;

// S-forge: 独立页签的事件绑定，用于 Plugin 系统中的资源管理页签
export const bindAssetTabEvent = (element: Element, type: string) => {
    const assetsListElement = element.querySelector(".config-assets__list");

    element.addEventListener("click", (event) => {
        let target = event.target as HTMLElement;
        while (target && !target.isEqualNode(element)) {
            if (target.id === `${type}All`) {
                const apiEndpoint = type === "remove" ? "/api/asset/removeUnusedAssets" : "/api/asset/removeMissingAssets";
                confirmDialog(siyuanI18n.deleteOpConfirm, `${siyuanI18n.clearAll}`, () => {
                    fetchPost(apiEndpoint, {}, response => {
                        if (!isMobile()) {
                            getAllModels().asset.forEach(item => {
                                if (response.data.paths.includes(item.path)) {
                                    item.parent.close();
                                }
                            });
                        }
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
                if (isElectron) {
                    const parentElement = target.parentElement;
                    if (parentElement) {
                        const dataPath = parentElement.getAttribute("data-path");
                        dataPath && openBy(dataPath, "folder");
                    }
                }
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
                                if (!isMobile()) {
                                    getAllModels().asset.forEach(item => {
                                        if (response.data.path === item.path) {
                                            item.parent.parent.removeTab(item.parent.id);
                                        }
                                    });
                                }
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
            assets._renderList(data, assetsListElement, type === "remove" ? "unrefAssets" : "lostAssets");
        });
    }
};

// S-forge: 独立资源页签的 HTML 生成
export const genAssetTabHTML = (type: string) => {
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
