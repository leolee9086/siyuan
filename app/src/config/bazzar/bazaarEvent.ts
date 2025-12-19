import { showMessage } from "../../dialog/message";
import { fetchPost } from "../../util/fetch";
import { confirmDialog } from "../../dialog/confirmDialog";
import { Constants } from "../../constants";
/// #if !BROWSER
import * as path from "path";
/// #endif
import { getFrontend } from "../../util/functions";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { setStorageVal, writeText } from "../../protyle/util/compatibility";
import { hasClosestByAttribute, hasClosestByClassName } from "../../protyle/util/hasClosest";
import { Plugin } from "../../plugin";
import { App } from "../../index";
import { uninstall } from "../../plugin/uninstall";
import { afterLoadPlugin, loadPlugin, loadPlugins, reloadPlugin } from "../../plugin/loader";
import { useShell } from "../../util/pathName";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { saveLayout } from "../../layout/util";

const handleOpen = (dataObj: any) => {
    /// #if !BROWSER
    const dirName = dataObj.bazaarType;
    if (dirName === "icons" || dirName === "themes") {
        useShell("openPath", path.join(getSiyuanConfig().system.confDir, "appearance", dirName, dataObj.name));
    } else {
        useShell("openPath", path.join(getSiyuanConfig().system.dataDir, dirName, dataObj.name));
    }
    /// #endif
};

const handleSwitch = (dataObj: any, bazaar: any, app: App) => {
    const bazaarType = dataObj.bazaarType as TBazaarType;
    const packageName = dataObj.name;
    const mode = dataObj.themeMode === "dark" ? 1 : 0;
    if (bazaarType === "icons") {
        fetchPost("/api/setting/setAppearance", Object.assign({}, getSiyuanConfig().appearance, {
            icon: packageName,
        }), (appearanceResponse) => {
            bazaar._genMyHTML(bazaarType, app, false);
            fetchPost("/api/bazaar/getBazaarIcon", {}, response => {
                response.data.appearance = appearanceResponse.data;
                bazaar._onBazaar(response, "icons");
                bazaar._data.icons = response.data.packages;
            });
        });
    } else if (bazaarType === "themes") {
        fetchPost("/api/setting/setAppearance", Object.assign({}, getSiyuanConfig().appearance, {
            mode,
            modeOS: false,
            themeDark: mode === 1 ? packageName : getSiyuanConfig().appearance.themeDark,
            themeLight: mode === 0 ? packageName : getSiyuanConfig().appearance.themeLight,
        }), async (appearanceResponse) => {
            bazaar._genMyHTML("themes", app, false);
            fetchPost("/api/bazaar/getBazaarTheme", {}, response => {
                response.data.appearance = appearanceResponse.data;
                bazaar._onBazaar(response, "themes");
                bazaar._data.themes = response.data.packages;
            });
        });
    }
};

const handleUninstall = (dataObj: any, bazaar: any, app: App) => {
    const bazaarType = dataObj.bazaarType as TBazaarType;
    let url = "/api/bazaar/uninstallBazaarTemplate";
    if (bazaarType === "themes") {
        url = "/api/bazaar/uninstallBazaarTheme";
    } else if (bazaarType === "icons") {
        url = "/api/bazaar/uninstallBazaarIcon";
    } else if (bazaarType === "widgets") {
        url = "/api/bazaar/uninstallBazaarWidget";
    } else if (bazaarType === "plugins") {
        url = "/api/bazaar/uninstallBazaarPlugin";
    }

    const packageName = dataObj.name;
    if (getSiyuanConfig().appearance.themeDark === packageName ||
        getSiyuanConfig().appearance.themeLight === packageName ||
        getSiyuanConfig().appearance.icon === packageName) {
        showMessage(siyuanI18n.uninstallTip);
    } else {
        confirmDialog("⚠️ " + siyuanI18n.uninstall, siyuanI18n.confirmUninstall.replace("${name}", packageName), () => {
            fetchPost(url, {
                packageName,
                keyword: (bazaar.element.querySelector(".config-bazaar__panel:not(.fn__none) .b3-form__icon-input") as HTMLInputElement).value,
                frontend: getFrontend()
            }, response => {
                bazaar._genMyHTML(bazaarType, app);
                bazaar._onBazaar(response, bazaarType);
            });
        });
    }
};

const handleInstall = (target: HTMLElement, dataObj: any, bazaar: any, app: App, isUpdate: boolean = false) => {
    if (target.classList.contains("b3-button--progress")) {
        return;
    }
    const bazaarType = dataObj.bazaarType as TBazaarType;
    let url = "/api/bazaar/installBazaarTemplate";
    if (bazaarType === "themes") {
        url = "/api/bazaar/installBazaarTheme";
    } else if (bazaarType === "icons") {
        url = "/api/bazaar/installBazaarIcon";
    } else if (bazaarType === "widgets") {
        url = "/api/bazaar/installBazaarWidget";
    } else if (bazaarType === "plugins") {
        url = "/api/bazaar/installBazaarPlugin";
    }

    const confirmPrefix = isUpdate ? "⬆️ " + siyuanI18n.update : "";
    const confirmMsg = isUpdate ? siyuanI18n.confirmUpdate : "";

    const executeInstall = () => {
        if (isUpdate && !target.classList.contains("b3-button")) {
            target.parentElement?.insertAdjacentHTML("afterend", '<img data-type="img-loading" style="position: absolute;top: 0;left: 0;height: 100%;width: 100%;padding: 16px;box-sizing: border-box;" src="/stage/loading-pure.svg">');
        }
        fetchPost(url, {
            keyword: (bazaar.element.querySelector(".config-bazaar__panel:not(.fn__none) .b3-form__icon-input") as HTMLInputElement).value,
            repoURL: dataObj.repoURL,
            packageName: dataObj.name,
            repoHash: dataObj.repoHash,
            mode: dataObj.themeMode === "dark" ? 1 : 0,
            update: isUpdate,
            frontend: getFrontend()
        }, async response => {
            if (isUpdate) {
                bazaar._genMyHTML(bazaarType, app);
            }
            bazaar._onBazaar(response, bazaarType);
            if (!isUpdate) {
                bazaar._genMyHTML(bazaarType, app, false);
            }

            if (bazaarType === "themes" && response.data.appearance?.themeVer) {
                getSiyuanConfig().appearance.themeVer = response.data.appearance.themeVer;
            }

            if (bazaarType === "plugins") {
                if (isUpdate) {
                    app.plugins.find((item: Plugin) => {
                        if (item.name === dataObj.name) {
                            reloadPlugin(app, {
                                upsertCodePlugins: [dataObj.name],
                            });
                            return true;
                        }
                    });
                } else {
                    if (getSiyuanConfig().bazaar.petalDisabled) {
                        confirmDialog(siyuanI18n.confirm, siyuanI18n.enablePluginTip2);
                    } else {
                        confirmDialog("💡 " + siyuanI18n.enablePlugin, siyuanI18n.enablePluginTip, () => {
                            fetchPost("/api/petal/setPetalEnabled", {
                                packageName: dataObj.name,
                                enabled: true,
                                frontend: getFrontend(),
                                app: Constants.SIYUAN_APPID,
                            }, (response) => {
                                loadPlugin(app, response.data);
                                bazaar._genMyHTML(bazaarType, app, false);
                            });
                        });
                    }
                }
            }
        });
    };

    if (isUpdate) {
        confirmDialog(confirmPrefix, confirmMsg, executeInstall);
    } else {
        executeInstall();
    }
};

const handlePluginEnable = (target: HTMLInputElement, dataObj: any, app: App) => {
    if (target.getAttribute("disabled")) {
        return;
    }
    target.setAttribute("disabled", "disabled");
    const enabled = target.checked;
    fetchPost("/api/petal/setPetalEnabled", {
        packageName: dataObj.name,
        enabled,
        frontend: getFrontend(),
        app: Constants.SIYUAN_APPID,
    }, (response) => {
        target.removeAttribute("disabled");
        if (enabled) {
            loadPlugin(app, response.data).then((plugin: Plugin | undefined) => {
                if (plugin) {
                    // @ts-ignore
                    if (plugin.setting || plugin.__proto__.hasOwnProperty("openSetting")) {
                        target.parentElement?.querySelector('[data-type="setting"]')?.classList.remove("fn__none");
                    } else {
                        target.parentElement?.querySelector('[data-type="setting"]')?.classList.add("fn__none");
                    }
                }
            });
        } else {
            uninstall(app, dataObj.name, true);
            target.parentElement?.querySelector('[data-type="setting"]')?.classList.add("fn__none");
        }
    });
};

const handlePluginsEnable = (target: HTMLInputElement, bazaar: any, app: App) => {
    if (target.getAttribute("disabled")) {
        return;
    }
    target.setAttribute("disabled", "disabled");
    getSiyuanConfig().bazaar.petalDisabled = !target.checked;
    fetchPost("/api/setting/setBazaar", getSiyuanConfig().bazaar, () => {
        target.removeAttribute("disabled");
        if (getSiyuanConfig().bazaar.petalDisabled) {
            bazaar.element.querySelectorAll("#configBazaarDownloaded .b3-card").forEach((item: HTMLElement) => {
                item.classList.add("b3-card--disabled");
                const objStr = item.getAttribute("data-obj");
                if (objStr) {
                    uninstall(app, JSON.parse(objStr).name, true);
                }
            });
        } else {
            bazaar.element.querySelectorAll("#configBazaarDownloaded .b3-card").forEach((item: HTMLElement) => {
                item.classList.remove("b3-card--disabled");
            });
            loadPlugins(app, null, false).then(() => {
                app.plugins.forEach(item => {
                    afterLoadPlugin(item);
                });
            });
            saveLayout();
        }
    });
};

const handleTabSwitch = (target: HTMLElement, type: string, bazaar: any) => {
    bazaar.element.querySelector(".layout-tab-bar .item--focus")?.classList.remove("item--focus");
    target.classList.add("item--focus");
    bazaar.element.querySelectorAll(".config-bazaar__panel").forEach((item: HTMLElement) => {
        if (type === item.getAttribute("data-type")) {
            item.classList.remove("fn__none");
            if (!item.getAttribute("data-init")) {
                if (type === "template") {
                    fetchPost("/api/bazaar/getBazaarTemplate", {}, response => {
                        bazaar._onBazaar(response, "templates");
                        bazaar._data.templates = response.data.packages;
                    });
                } else if (type === "icon") {
                    fetchPost("/api/bazaar/getBazaarIcon", {}, response => {
                        bazaar._onBazaar(response, "icons");
                        bazaar._data.icons = response.data.packages;
                    });
                } else if (type === "widget") {
                    fetchPost("/api/bazaar/getBazaarWidget", {}, response => {
                        bazaar._onBazaar(response, "widgets");
                        bazaar._data.widgets = response.data.packages;
                    });
                } else if (type === "theme") {
                    fetchPost("/api/bazaar/getBazaarTheme", {}, response => {
                        bazaar._onBazaar(response, "themes");
                        bazaar._data.themes = response.data.packages;
                    });
                } else if (type === "plugin") {
                    fetchPost("/api/bazaar/getBazaarPlugin", {
                        frontend: getFrontend()
                    }, response => {
                        bazaar._onBazaar(response, "plugins");
                        bazaar._data.plugins = response.data.packages;
                    });
                }
                item.setAttribute("data-init", "true");
            }
        } else {
            item.classList.add("fn__none");
        }
    });
};

function handleBazaarClick(event: MouseEvent, bazaar: any, app: App) {
    let target = event.target as HTMLElement;
    const dataElement = hasClosestByAttribute(target, "data-obj", null);
    let dataObj: any;
    if (dataElement) {
        const objStr = dataElement.getAttribute("data-obj");
        if (objStr) {
            dataObj = JSON.parse(objStr);
        }
    }
    while (target && !target.isEqualNode(bazaar.element)) {
        const type = target.getAttribute("data-type");
        if (target.tagName === "A") {
            break;
        }
        if (type === "copy-funding") {
            const funding = target.getAttribute("data-funding");
            if (funding) {
                writeText(funding);
                showMessage(siyuanI18n.copied);
            }
            event.preventDefault();
            event.stopPropagation();
            break;
        } else if (type === "open" && dataObj) {
            handleOpen(dataObj);
            event.preventDefault();
            event.stopPropagation();
            break;
        } else if (["myTheme", "myTemplate", "myIcon", "myWidget", "myPlugin"].includes(type || "")) {
            if (target.classList.contains("b3-button--outline") &&
                !bazaar.element.querySelector("#configBazaarDownloaded")?.getAttribute("data-loading")) {
                target.parentElement?.childNodes.forEach((item: ChildNode) => {
                    const el = item as HTMLElement;
                    if (el.nodeType !== 3 && el.classList.contains("b3-button")) {
                        el.classList.add("b3-button--outline");
                    }
                });
                target.classList.remove("b3-button--outline");
                bazaar._genMyHTML((type || "").replace("my", "").toLowerCase() + "s" as TBazaarType, app, false);
            }
            event.preventDefault();
            event.stopPropagation();
            break;
        } else if (type === "goBack") {
            bazaar.element.querySelector("#configBazaarReadme")?.classList.remove("config-bazaar__readme--show");
            event.preventDefault();
            event.stopPropagation();
            break;
        } else if (type === "install") {
            handleInstall(target, dataObj, bazaar, app, false);
            event.preventDefault();
            event.stopPropagation();
            break;
        } else if (type === "install-all") {
            confirmDialog("⬆️ " + siyuanI18n.updateAll, siyuanI18n.confirmUpdateAll, () => {
                fetchPost("/api/bazaar/batchUpdatePackage", { frontend: getFrontend() });
            });
            event.preventDefault();
            event.stopPropagation();
            break;
        } else if (type === "feedback") {
            event.preventDefault();
            event.stopPropagation();
            break;
        } else if (type === "install-t") {
            handleInstall(target, dataObj, bazaar, app, true);
            event.preventDefault();
            event.stopPropagation();
            break;
        } else if (type === "uninstall") {
            handleUninstall(dataObj, bazaar, app);
            event.preventDefault();
            event.stopPropagation();
            break;
        } else if (type === "switch") {
            handleSwitch(dataObj, bazaar, app);
            event.preventDefault();
            event.stopPropagation();
            break;
        } else if (type === "setting") {
            app.plugins.find((item: Plugin) => {
                if (item.name === dataObj.name) {
                    item.openSetting();
                    return true;
                }
            });
            event.preventDefault();
            event.stopPropagation();
            break;
        } else if (type === "plugins-enable") {
            handlePluginsEnable(target as HTMLInputElement, bazaar, app);
            event.stopPropagation();
            break;
        } else if (type === "plugin-enable") {
            handlePluginEnable(target as HTMLInputElement, dataObj, app);
            event.stopPropagation();
            break;
        } else if (target.classList.contains("b3-card")) {
            if (!hasClosestByClassName(event.target as HTMLElement, "b3-card__actions--right")) {
                const objStr = target.getAttribute("data-obj");
                if (objStr) {
                    const dataObjLocal = JSON.parse(objStr);
                    const bazaarType = (dataObjLocal.bazaarType) as TBazaarType;
                    let data;
                    if (hasClosestByAttribute(target, "data-type", "downloaded-update")) {
                        data = bazaar._data.update[(dataObjLocal.bazaarType) as TBazaarType].find((item: IBazaarItem) => item.repoURL === dataObjLocal.repoURL);
                    } else {
                        data = (dataObjLocal.downloaded ? bazaar._data.downloaded : bazaar._data[bazaarType]).find((item: IBazaarItem) => item.repoURL === dataObjLocal.repoURL);
                    }
                    bazaar._renderReadme(bazaarType, data, dataObjLocal.downloaded);
                }
            }
            event.preventDefault();
            event.stopPropagation();
            break;
        } else if (target.classList.contains("item") && !target.classList.contains("item--focus")) {
            handleTabSwitch(target, type || "", bazaar);
            event.preventDefault();
            event.stopPropagation();
            break;
        } else if (target.classList.contains("item__preview")) {
            target.classList.toggle("item__preview--fullscreen");
            event.preventDefault();
            event.stopPropagation();
            break;
        }
        target = target.parentElement as HTMLElement;
    }
}

export const bindBazaarEvent = (bazaar: any, app: App) => {
    if (!getSiyuanConfig().bazaar.trust) {
        bazaar.element.querySelector("button")?.addEventListener("click", () => {
            fetchPost("/api/setting/setBazaar", {
                trust: true,
                petalDisabled: getSiyuanConfig().bazaar.petalDisabled
            }, () => {
                getSiyuanConfig().bazaar.trust = true;
                bazaar.element.innerHTML = bazaar.genHTML();
                bazaar.bindEvent(app);
            });
        });
        return;
    }
    bazaar._genMyHTML("plugins", app);
    bazaar.element.firstElementChild?.addEventListener("click", (event: MouseEvent) => {
        handleBazaarClick(event, bazaar, app);
    });

    bazaar.element.querySelectorAll(".config-bazaar__panel .b3-form__icon > .b3-text-field").forEach((inputElement: HTMLInputElement) => {
        inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.isComposing) {
                return;
            }
            if (event.key === "Enter") {
                const keyword = inputElement.value.trim();
                const panel = hasClosestByClassName(inputElement, "config-bazaar__panel") as HTMLElement;
                const type = panel ? panel.getAttribute("data-type") : "";

                if (type === "template") {
                    fetchPost("/api/bazaar/getBazaarTemplate", { keyword }, response => {
                        bazaar._onBazaar(response, "templates");
                        bazaar._data.templates = response.data.packages;
                    });
                } else if (type === "icon") {
                    fetchPost("/api/bazaar/getBazaarIcon", { keyword }, response => {
                        bazaar._onBazaar(response, "icons");
                        bazaar._data.icons = response.data.packages;
                    });
                } else if (type === "widget") {
                    fetchPost("/api/bazaar/getBazaarWidget", { keyword }, response => {
                        bazaar._onBazaar(response, "widgets");
                        bazaar._data.widgets = response.data.packages;
                    });
                } else if (type === "theme") {
                    fetchPost("/api/bazaar/getBazaarTheme", { keyword }, response => {
                        bazaar._onBazaar(response, "themes");
                        bazaar._data.themes = response.data.packages;
                    });
                } else if (type === "plugin") {
                    fetchPost("/api/bazaar/getBazaarPlugin", {
                        frontend: getFrontend(),
                        keyword
                    }, response => {
                        bazaar._onBazaar(response, "plugins");
                        bazaar._data.plugins = response.data.packages;
                    });
                } else if (type === "downloaded") {
                    const btn = inputElement.parentElement?.parentElement?.querySelector(".b3-button:not(.b3-button--outline)");
                    if (btn) {
                        const bazaarType = btn.getAttribute("data-type")!.replace("my", "").toLowerCase() + "s" as TBazaarType;
                        bazaar._genMyHTML(bazaarType, app);
                    }
                }
                event.preventDefault();
                return;
            }
        });
    });

    bazaar.element.querySelectorAll(".b3-select").forEach((selectElement: HTMLSelectElement) => {
        selectElement.addEventListener("change", (event) => {
            const target = event.target as HTMLElement;
            if (selectElement.id === "bazaarSelect") {
                // theme select
                bazaar.element.querySelectorAll("#configBazaarTheme .b3-card").forEach((item: HTMLElement) => {
                    const objStr = item.getAttribute("data-obj");
                    if (objStr) {
                        const dataObj = JSON.parse(objStr);
                        if (selectElement.value === "0") {
                            if (dataObj.themeMode.indexOf("light") > -1) {
                                item.classList.remove("fn__none");
                            } else {
                                item.classList.add("fn__none");
                            }
                        } else if (selectElement.value === "1") {
                            if (dataObj.themeMode.indexOf("dark") > -1) {
                                item.classList.remove("fn__none");
                            } else {
                                item.classList.add("fn__none");
                            }
                        } else {
                            item.classList.remove("fn__none");
                        }
                    }
                });
                const counter = target.parentElement?.querySelector(".counter");
                if (counter) {
                    counter.textContent = bazaar.element.querySelectorAll("#configBazaarTheme .b3-card:not(.fn__none)").length.toString();
                }
            } else {
                // sort
                if (!window.siyuan || !window.siyuan.storage) return;
                const localSort = window.siyuan.storage[Constants.LOCAL_BAZAAR];
                const panelElement = selectElement.parentElement?.parentElement;
                if (!panelElement) return;

                let html = "";
                const cardElements = Array.from(panelElement.querySelectorAll(".b3-card"));
                if (selectElement.value === "0") { // 更新时间降序
                    cardElements.sort((a, b) => {
                        const aObj = JSON.parse(a.getAttribute("data-obj") || "{}");
                        const bObj = JSON.parse(b.getAttribute("data-obj") || "{}");
                        return bObj.updated < aObj.updated ? -1 : 1;
                    }).forEach((item) => {
                        html += item.outerHTML;
                    });
                } else if (selectElement.value === "1") { // 更新时间升序
                    cardElements.sort((a, b) => {
                        const aObj = JSON.parse(a.getAttribute("data-obj") || "{}");
                        const bObj = JSON.parse(b.getAttribute("data-obj") || "{}");
                        return bObj.updated < aObj.updated ? 1 : -1;
                    }).forEach((item) => {
                        html += item.outerHTML;
                    });
                } else if (selectElement.value === "2") { // 下载次数降序
                    cardElements.sort((a, b) => {
                        const aObj = JSON.parse(a.getAttribute("data-obj") || "{}");
                        const bObj = JSON.parse(b.getAttribute("data-obj") || "{}");
                        return bObj.downloads < aObj.downloads ? -1 : 1;
                    }).forEach((item) => {
                        html += item.outerHTML;
                    });
                } else if (selectElement.value === "3") { // 下载次数升序
                    cardElements.sort((a, b) => {
                        const aObj = JSON.parse(a.getAttribute("data-obj") || "{}");
                        const bObj = JSON.parse(b.getAttribute("data-obj") || "{}");
                        return bObj.downloads < aObj.downloads ? 1 : -1;
                    }).forEach((item) => {
                        html += item.outerHTML;
                    });
                }
                const dataType = panelElement.getAttribute("data-type");
                if (dataType) {
                    localSort[dataType] = selectElement.value;
                    setStorageVal(Constants.LOCAL_BAZAAR, window.siyuan.storage[Constants.LOCAL_BAZAAR]);
                }

                if (cardElements.length > 1) {
                    html += '<div class="fn__flex-1" style="margin-left: 15px;min-width: 342px;"></div><div class="fn__flex-1" style="margin-left: 15px;min-width: 342px;"></div>';
                }
                const cardsContainer = panelElement.querySelector(".b3-cards");
                if (cardsContainer) {
                    cardsContainer.innerHTML = html;
                }
            }
        });
    });

    // 使用事件委托处理关键词点击事件
    bazaar.element.addEventListener("click", (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target.classList.contains("b3-chip") && target.hasAttribute("data-keyword")) {
            const keyword = target.getAttribute("data-keyword");
            const bazaarType = target.getAttribute("data-type") as TBazaarType;

            // 切换关键词选中状态
            if (bazaarType && keyword) {
                const selectedKeywords = bazaar._data.selectedKeywords[bazaarType];
                const index = selectedKeywords.indexOf(keyword);

                if (index === -1) {
                    // 添加关键词
                    selectedKeywords.push(keyword);
                    target.classList.add("b3-chip--primary");
                } else {
                    // 移除关键词
                    selectedKeywords.splice(index, 1);
                    target.classList.remove("b3-chip--primary");
                }

                // 应用过滤
                bazaar._renderFilteredPackages(bazaarType);
            }
        }
    });
};
