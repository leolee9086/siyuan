import { showMessage } from "../../dialog/message";
import { fetchPost } from "../../util/fetch";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { useShell } from "../../util/pathName";
import { App } from "../../index";
import { hasClosestByAttribute, hasClosestByClassName } from "../../protyle/util/hasClosest";
import { getFrontend } from "../../util/functions";
import { writeText } from "../../protyle/util/compatibility";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
/// #if !BROWSER
import * as path from "path";
/// #endif

export const handleOpen = (dataObj: any) => {
    /// #if !BROWSER
    const dirName = dataObj.bazaarType;
    if (dirName === "icons" || dirName === "themes") {
        useShell("openPath", path.join(getSiyuanConfig().system.confDir, "appearance", dirName, dataObj.name));
    } else {
        useShell("openPath", path.join(getSiyuanConfig().system.dataDir, dirName, dataObj.name));
    }
    /// #endif
};

export const handleTabSwitch = (target: HTMLElement, type: string, bazaar: any) => {
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

export const handleBazaarNavClick = (type: string, target: HTMLElement, dataObj: any, bazaar: any, app: App, event: MouseEvent): boolean => {
    if (type === "copy-funding") {
        const funding = target.getAttribute("data-funding");
        if (funding) {
            writeText(funding);
            showMessage(siyuanI18n.copied);
        }
        event.preventDefault();
        event.stopPropagation();
        return true;
    } else if (type === "open" && dataObj) {
        handleOpen(dataObj);
        event.preventDefault();
        event.stopPropagation();
        return true;
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
        return true;
    } else if (type === "goBack") {
        bazaar.element.querySelector("#configBazaarReadme")?.classList.remove("config-bazaar__readme--show");
        event.preventDefault();
        event.stopPropagation();
        return true;
    } else if (type === "feedback") {
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    return false;
};

const handleBazaarCardClick = (target: HTMLElement, bazaar: any, event: MouseEvent) => {
    if (hasClosestByClassName(event.target as HTMLElement, "b3-card__actions--right")) {
        return;
    }
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
};

export const handleBazaarUIInteraction = (target: HTMLElement, type: string | null, bazaar: any, event: MouseEvent): boolean => {
    if (target.classList.contains("b3-card")) {
        handleBazaarCardClick(target, bazaar, event);
        event.preventDefault();
        event.stopPropagation();
        return true;
    } else if (target.classList.contains("item") && !target.classList.contains("item--focus")) {
        handleTabSwitch(target, type || "", bazaar);
        event.preventDefault();
        event.stopPropagation();
        return true;
    } else if (target.classList.contains("item__preview")) {
        target.classList.toggle("item__preview--fullscreen");
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    return false;
};
