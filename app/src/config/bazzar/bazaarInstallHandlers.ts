import { showMessage } from "../../dialog/message";
import { fetchPost } from "../../util/network/fetch";
import { confirmDialog } from "../../dialog/confirmDialog";
import { Constants } from "../../constants";
import { getFrontend } from "../../util/platform/functions";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { AppFacade } from "../../app/AppFacade.types";
import type * as Siyuan from "siyuan";
import { uninstall } from "../../plugin/uninstall";
import { afterLoadPlugin, loadPlugin, loadPlugins, reloadPlugin } from "../../plugin/loader";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {saveLayout} from "../../layout/persistence/saveLayout";
import {openByMobile} from "../../editor/openLink";
import {escapeHtml} from "../../util/DOM/escape";

export const handleSwitch = (dataObj: any, bazaar: any, app: AppFacade) => {
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

export const handleUninstall = (dataObj: any, bazaar: any, app: AppFacade) => {
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
        confirmDialog("⚠️ " + siyuanI18n.uninstall, siyuanI18n.confirmUninstall.replace("${name}", escapeHtml(packageName)), () => {
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

export const handleInstall = (target: HTMLElement, dataObj: any, bazaar: any, app: AppFacade, isUpdate: boolean = false) => {
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
                    app.plugins.find((item: Siyuan.Plugin) => {
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
                                loadPlugin(app, response.data).then(() => {
                                    bazaar._genMyHTML(bazaarType, app, false);
                                });
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

export const handlePluginEnable = (target: HTMLInputElement, dataObj: any, bazaar: any, app: AppFacade) => {
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
            if (getSiyuanConfig().bazaar.petalDisabled) {
                target.parentElement?.querySelector('[data-type="setting"]')?.classList.add("fn__none");
                return;
            }
            loadPlugin(app, response.data).then(() => {
                bazaar._genMyHTML("plugins", app, false);
            });
        } else {
            uninstall(app, dataObj.name, true);
            target.parentElement?.querySelector('[data-type="setting"]')?.classList.add("fn__none");
        }
    });
};

export const handlePluginsEnable = (target: HTMLInputElement, bazaar: any, app: AppFacade) => {
    if (target.getAttribute("disabled")) {
        return;
    }
    target.setAttribute("disabled", "disabled");
    getSiyuanConfig().bazaar.petalDisabled = !target.checked;
    fetchPost("/api/setting/setBazaar", getSiyuanConfig().bazaar, () => {
        target.removeAttribute("disabled");
        if (getSiyuanConfig().bazaar.petalDisabled) {
            bazaar.element.querySelectorAll("#configBazaarDownloaded .b3-card").forEach((item: HTMLElement) => {
                item.querySelector('[data-type="setting"]')?.classList.add("fn__none");
                const objStr = item.getAttribute("data-obj");
                if (objStr) {
                    uninstall(app, JSON.parse(objStr).name, true);
                }
            });
            return;
        }
        loadPlugins(app, null, false).then(() => {
            app.plugins.forEach(item => {
                afterLoadPlugin(item);
            });
            bazaar._genMyHTML("plugins", app, false);
        });
        saveLayout();
    });
};

export const handleExportLocalPackage = (dataObj: any) => {
    if (!dataObj?.name || !dataObj?.bazaarType) {
        return;
    }
    fetchPost("/api/s-forge/bazaar/exportPackage", {
        packageType: dataObj.bazaarType,
        packageName: dataObj.name
    }, (response) => {
        if (response.code !== 0 || !response.data?.zip) {
            return;
        }
        openByMobile(response.data.zip);
    });
};

export const handleBazaarInstallClick = (type: string, target: HTMLElement, dataObj: any, bazaar: any, app: AppFacade, event: MouseEvent): boolean => {
    if (type === "install") {
        handleInstall(target, dataObj, bazaar, app, false);
        event.preventDefault();
        event.stopPropagation();
        return true;
    } else if (type === "install-all") {
        confirmDialog("⬆️ " + siyuanI18n.updateAll, siyuanI18n.confirmUpdateAll, () => {
            fetchPost("/api/bazaar/batchUpdatePackage", { frontend: getFrontend() });
        });
        event.preventDefault();
        event.stopPropagation();
        return true;
    } else if (type === "install-t") {
        handleInstall(target, dataObj, bazaar, app, true);
        event.preventDefault();
        event.stopPropagation();
        return true;
    } else if (type === "uninstall") {
        handleUninstall(dataObj, bazaar, app);
        event.preventDefault();
        event.stopPropagation();
        return true;
    } else if (type === "switch") {
        handleSwitch(dataObj, bazaar, app);
        event.preventDefault();
        event.stopPropagation();
        return true;
    } else if (type === "setting") {
        if (getSiyuanConfig().bazaar.petalDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return true;
        }
        app.plugins.find((item: Siyuan.Plugin) => {
            if (item.name === dataObj.name) {
                item.openSetting();
                return true;
            }
        });
        event.preventDefault();
        event.stopPropagation();
        return true;
    } else if (type === "plugins-enable") {
        handlePluginsEnable(target as HTMLInputElement, bazaar, app);
        event.stopPropagation();
        return true;
    } else if (type === "plugin-enable") {
        handlePluginEnable(target as HTMLInputElement, dataObj, bazaar, app);
        event.stopPropagation();
        return true;
    } else if (type === "export-local-package") {
        handleExportLocalPackage(dataObj);
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    return false;
};
