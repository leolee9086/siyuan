import { showMessage } from "../../dialog/message";
import { fetchPost } from "../../util/network/fetch";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { useShell } from "../../util/file/pathName";
import { App } from "../../index";
import { hasClosestByAttribute, hasClosestByClassName } from "../../protyle/util/hasClosest";
import { getFrontend } from "../../util/platform/functions";
import { writeText } from "../../protyle/util/compatibility";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { isElectron } from "../../platform";
import {nativeRequire} from "../../platform/nativeRequire";
import { openBazaarHubTab, openBazaarPublishTab } from "../../bazaar-hub/open";

import { IBazaar, IBazaarDataObj } from "./types";

export const handleOpen = (dataObj: IBazaarDataObj) => {
    if (!isElectron) {
        return;
    }
    if (!dataObj.name) {
        return;
    }
    const nodePath = nativeRequire<typeof import("path")>("path");
    const dirName = dataObj.bazaarType;
    if (dirName === "icons" || dirName === "themes") {
        useShell("openPath", nodePath.join(getSiyuanConfig().system.confDir, "appearance", dirName, dataObj.name));
    } else {
        useShell("openPath", nodePath.join(getSiyuanConfig().system.dataDir, dirName, dataObj.name));
    }
};

const initBazaarActions: Record<string, (bazaar: IBazaar<App>) => void> = {
    template: (bazaar: IBazaar<App>) => {
        fetchPost("/api/bazaar/getBazaarTemplate", {}, response => {
            bazaar._onBazaar(response, "templates");
            bazaar._data.templates = response.data.packages;
        });
    },
    icon: (bazaar: IBazaar<App>) => {
        fetchPost("/api/bazaar/getBazaarIcon", {}, response => {
            bazaar._onBazaar(response, "icons");
            bazaar._data.icons = response.data.packages;
        });
    },
    widget: (bazaar: IBazaar<App>) => {
        fetchPost("/api/bazaar/getBazaarWidget", {}, response => {
            bazaar._onBazaar(response, "widgets");
            bazaar._data.widgets = response.data.packages;
        });
    },
    theme: (bazaar: IBazaar<App>) => {
        fetchPost("/api/bazaar/getBazaarTheme", {}, response => {
            bazaar._onBazaar(response, "themes");
            bazaar._data.themes = response.data.packages;
        });
    },
    plugin: (bazaar: IBazaar<App>) => {
        fetchPost("/api/bazaar/getBazaarPlugin", {
            frontend: getFrontend()
        }, response => {
            bazaar._onBazaar(response, "plugins");
            bazaar._data.plugins = response.data.packages;
        });
    }
};

export const handleTabSwitch = (target: HTMLElement, type: string, bazaar: IBazaar<App>) => {
    bazaar.element?.querySelector(".layout-tab-bar .item--focus")?.classList.remove("item--focus");
    target.classList.add("item--focus");
    const panels = bazaar.element?.querySelectorAll(".config-bazaar__panel");
    if (!panels) {
return;
}
    for (const panel of panels) {
        const item = panel as HTMLElement;
        if (type !== item.getAttribute("data-type")) {
            item.classList.add("fn__none");
            continue;
        }
        item.classList.remove("fn__none");
        if (item.getAttribute("data-init")) {
            continue;
        }
        if (initBazaarActions[type]) {
            initBazaarActions[type](bazaar);
        }
        item.setAttribute("data-init", "true");
    }
};

export const handleBazaarNavClick = (type: string, target: HTMLElement, dataObj: IBazaarDataObj, bazaar: IBazaar<App>, app: App, event: MouseEvent): boolean => {
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
            !bazaar.element?.querySelector("#configBazaarDownloaded")?.getAttribute("data-loading")) {
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
        bazaar.element?.querySelector("#configBazaarReadme")?.classList.remove("config-bazaar__readme--show");
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

const handleBazaarCardClick = (target: HTMLElement, bazaar: IBazaar<App>, event: MouseEvent) => {
    if (hasClosestByClassName(event.target as HTMLElement, "b3-card__actions--right")) {
        return;
    }
    const objStr = target.getAttribute("data-obj");
    if (!objStr) {
        return;
    }
    const dataObjLocal = JSON.parse(objStr) as IBazaarDataObj;
    const bazaarType = (dataObjLocal.bazaarType) as TBazaarType;
    let data;
    if (hasClosestByAttribute(target, "data-type", "downloaded-update")) {
        data = bazaar._data.update[(dataObjLocal.bazaarType) as TBazaarType].find((item: IBazaarItem) => item.repoURL === dataObjLocal.repoURL);
    } else {
        data = (dataObjLocal.downloaded ? bazaar._data.downloaded : bazaar._data[bazaarType]).find((item: IBazaarItem) => item.repoURL === dataObjLocal.repoURL);
    }
    if (data) {
        bazaar._renderReadme(bazaarType, data, !!dataObjLocal.downloaded);
    }
};

export const handleBazaarUIInteraction = (target: HTMLElement, type: string | null, bazaar: IBazaar<App>, app: App, event: MouseEvent): boolean => {
    if (target.classList.contains("b3-card")) {
        handleBazaarCardClick(target, bazaar, event);
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (target.classList.contains("item") && !target.classList.contains("item--focus")) {
        handleTabSwitch(target, type || "", bazaar);
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (target.classList.contains("item__preview")) {
        target.classList.toggle("item__preview--fullscreen");
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "open-bazaar-hub") {
        void openBazaarHubTab({ app });
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (type === "open-bazaar-publish") {
        void openBazaarPublishTab({ app });
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    return false;
};
