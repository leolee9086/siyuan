
import { showMessage } from "../../dialog/message";
import { fetchPost } from "../../util/network/fetch";
import { Constants } from "../../constants";
import { getFrontend, isBrowser } from "../../util/platform/functions";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { bazaarData, extractKeywords, filterPackagesByKeywords } from "./bazaarData";
import { genCardHTML, genUpdateItemHTML, genFundingHTML, genKeywordsHTML } from "./bazaarHtml";
import type { AppFacade } from "../../app/AppFacade.types";
import { escapeAttr } from "../../util/DOM/escape";
import { Plugin } from "../../plugin";
import {renderReadme} from "./readme/renderReadme";

const getDownloadedTabType = (bazaarType: TBazaarType) => {
    return bazaarType.replace("s", "");
};

export const getDownloadedSortStorageKey = (bazaarType: TBazaarType) => {
    const tab = getDownloadedTabType(bazaarType);
    return "downloaded" + tab.charAt(0).toUpperCase() + tab.slice(1);
};

export const getDownloadedSortValue = (bazaarType: TBazaarType) => {
    const localSort = window.siyuan.storage[Constants.LOCAL_BAZAAR] || {};
    const value = localSort[getDownloadedSortStorageKey(bazaarType)] || "0";
    // 启禁排序仅对插件有意义，其余类型回退到默认排序
    if (bazaarType !== "plugins" && ["5", "6"].includes(value)) {
        return "0";
    }
    return value;
};

export const updateDownloadedSortSelect = (element: Element, bazaarType: TBazaarType) => {
    const selectElement = element.querySelector('[data-type="downloaded-sort"]') as HTMLSelectElement;
    if (!selectElement) {
        return;
    }
    selectElement.value = getDownloadedSortValue(bazaarType);
    selectElement.querySelectorAll('[data-plugin-only="true"]').forEach((option) => {
        (option as HTMLOptionElement).hidden = bazaarType !== "plugins";
    });
};

export const sortDownloadedPackages = (packages: IBazaarItem[], sortValue: string): IBazaarItem[] => {
    const indexed = packages.map((item, index) => ({item, index}));
    const sortByTime = (field: "installTime" | "updateTime", descending: boolean) => {
        return indexed.sort((a, b) => {
            const aTime = a.item[field] || 0;
            const bTime = b.item[field] || 0;
            if (aTime < 1 && bTime < 1) {
                return a.index - b.index;
            }
            if (aTime < 1) {
                return 1;
            }
            if (bTime < 1) {
                return -1;
            }
            const result = descending ? bTime - aTime : aTime - bTime;
            return result || a.index - b.index;
        }).map((entry) => entry.item);
    };
    if (sortValue === "1") {
        return sortByTime("installTime", true);
    }
    if (sortValue === "2") {
        return sortByTime("installTime", false);
    }
    if (sortValue === "3") {
        return sortByTime("updateTime", true);
    }
    if (sortValue === "4") {
        return sortByTime("updateTime", false);
    }
    if (["5", "6"].includes(sortValue)) {
        return indexed.sort((a, b) => {
            const aEnabled = a.item.enabled ? 1 : 0;
            const bEnabled = b.item.enabled ? 1 : 0;
            const result = sortValue === "5" ? bEnabled - aEnabled : aEnabled - bEnabled;
            return result || a.index - b.index;
        }).map((entry) => entry.item);
    }
    return [...packages];
};

export const reorderDownloadedCards = (element: Element, packages: IBazaarItem[]) => {
    const contentElement = element.querySelector("#configBazaarDownloaded");
    if (!contentElement) {
        return;
    }
    const cards = new Map(Array.from(contentElement.children).filter((item) => item.classList.contains("b3-card")).map((card) => [
        card.getAttribute("data-name"),
        card,
    ]));
    const fragment = document.createDocumentFragment();
    packages.forEach((item) => {
        const card = cards.get(item.name);
        if (card) {
            fragment.append(card);
        }
    });
    contentElement.append(fragment);
    bazaarData.downloaded = packages;
};

export const renderFilteredPackages = (element: Element, bazaarType: TBazaarType) => {
    const filteredPackages = filterPackagesByKeywords(bazaarType);
    let html = "";

    // Check if #bazaarSelect exists before accessing value. Fallback or throw if critical.
    const selectElement = element.querySelector("#bazaarSelect") as HTMLSelectElement;
    const selectValue = selectElement ? selectElement.value : "2";

    filteredPackages.forEach((item: IBazaarItem) => {
        html += genCardHTML(item, bazaarType, selectValue);
    });

    let id = "#configBazaarTemplate";
    if (bazaarType === "themes") {
        id = "#configBazaarTheme";
    } else if (bazaarType === "icons") {
        id = "#configBazaarIcon";
    } else if (bazaarType === "widgets") {
        id = "#configBazaarWidget";
    } else if (bazaarType === "plugins") {
        id = "#configBazaarPlugin";
    }

    const container = element.querySelector(id);
    container.innerHTML = `<div class="b3-cards">${html}</div>`;
    container.parentElement.querySelector(".counter").textContent = filteredPackages.length.toString();

    // 应用当前排序
    const localSort = window.siyuan.storage[Constants.LOCAL_BAZAAR];
    const sortType = localSort[bazaarType.replace("s", "")];

    if (["1", "2", "3"].includes(sortType)) {
        html = "";
        Array.from(container.querySelectorAll(".b3-card")).sort((a, b) => {
            const updatedA = JSON.parse(a.getAttribute("data-obj")).updated;
            const updatedB = JSON.parse(b.getAttribute("data-obj")).updated;
            const downloadsA = JSON.parse(a.getAttribute("data-obj")).downloads;
            const downloadsB = JSON.parse(b.getAttribute("data-obj")).downloads;

            if (sortType === "1") {
                return updatedB < updatedA ? 1 : -1;
            } else if (sortType === "2") {
                return downloadsB < downloadsA ? -1 : 1;
            } else if (sortType === "3") {
                return downloadsB < downloadsA ? 1 : -1;
            }
            return 0;
        }).forEach((item) => {
            html += item.outerHTML;
        });
    }

    if (filteredPackages.length > 1) {
        html += '<div class="fn__flex-1" style="margin-left: 15px;min-width: 342px;"></div><div class="fn__flex-1" style="margin-left: 15px;min-width: 342px;"></div>';
    }

    container.innerHTML = `<div class="b3-cards">${html}</div>`;
};

export const onBazaar = (element: Element, response: IWebSocketData, bazaarType: TBazaarType) => {
    if (element.querySelector("#configBazaarReadme").classList.contains("config-bazaar__readme--show")) {
        const dataObj = JSON.parse(element.querySelector("#configBazaarReadme > .item__side").getAttribute("data-obj"));
        if (response.data.packages) {
            renderReadme({
                element,
                bazaarType: dataObj.bazaarType as TBazaarType,
                data: response.data.packages.find((item: IBazaarItem) => item.repoURL === dataObj.repoURL),
                downloaded: dataObj.downloaded,
            });
        }
    }
    let id = "#configBazaarTemplate";
    if (bazaarType === "themes") {
        id = "#configBazaarTheme";
    } else if (bazaarType === "icons") {
        id = "#configBazaarIcon";
    } else if (bazaarType === "widgets") {
        id = "#configBazaarWidget";
    } else if (bazaarType === "plugins") {
        id = "#configBazaarPlugin";
    }
    const container = element.querySelector(id);
    if (response.code === 1) {
        showMessage(response.msg);
        container.querySelectorAll("img[data-type='img-loading']").forEach((item) => {
            item.remove();
        });
    }
    let html = "";
    if (response.data.packages) {
        // Need to get selectValue for genCardHTML
        const selectElement = element.querySelector("#bazaarSelect") as HTMLSelectElement;
        const selectValue = selectElement ? selectElement.value : "2";

        response.data.packages.forEach((item: IBazaarItem) => {
            html += genCardHTML(item, bazaarType, selectValue);
        });
        bazaarData[bazaarType] = response.data.packages;
        // 提取并存储关键词
        bazaarData.keywords[bazaarType] = extractKeywords(response.data.packages);
        container.innerHTML = `<div class="b3-cards">${html}</div>`;
        container.parentElement.querySelector(".counter").textContent = container.querySelectorAll(".b3-card:not(.fn__none)").length.toString();
        // 更新关键词标签
        const keywordsElement = container.parentElement.querySelector(".config-bazaar__keywords");
        if (keywordsElement) {
            keywordsElement.outerHTML = genKeywordsHTML(bazaarType, bazaarData.keywords[bazaarType], bazaarData.selectedKeywords[bazaarType]);
        }
    }
    const localSort = window.siyuan.storage[Constants.LOCAL_BAZAAR];
    const sortType = localSort[bazaarType.replace("s", "")];
    if (["1", "2", "3"].includes(sortType)) {
        html = "";
        Array.from(container.querySelectorAll(".b3-card")).sort((a, b) => {
            const updatedA = JSON.parse(a.getAttribute("data-obj")).updated;
            const updatedB = JSON.parse(b.getAttribute("data-obj")).updated;
            const downloadsA = JSON.parse(a.getAttribute("data-obj")).downloads;
            const downloadsB = JSON.parse(b.getAttribute("data-obj")).downloads;

            if (sortType === "1") {
                return updatedB < updatedA ? 1 : -1;
            } else if (sortType === "2") {
                return downloadsB < downloadsA ? -1 : 1;
            } else if (sortType === "3") {
                return downloadsB < downloadsA ? 1 : -1;
            }
            return 0;
        }).forEach((item) => {
            html += item.outerHTML;
        });
    }

    if (response.data.packages && response.data.packages.length > 1) {
        html += '<div class="fn__flex-1" style="margin-left: 15px;min-width: 342px;"></div><div class="fn__flex-1" style="margin-left: 15px;min-width: 342px;"></div>';
    }
    container.innerHTML = `<div class="b3-cards">${html}</div>`;
};

export const getUpdate = (element: Element) => {
    fetchPost("/api/bazaar/getUpdatedPackage", { frontend: getFrontend() }, (response) => {
        let html = "";
        response.data.plugins.forEach((item: IBazaarItem) => {
            html += genUpdateItemHTML(item, "plugins");
        });
        response.data.themes.forEach((item: IBazaarItem) => {
            html += genUpdateItemHTML(item, "themes");
        });
        response.data.icons.forEach((item: IBazaarItem) => {
            html += genUpdateItemHTML(item, "icons");
        });
        response.data.templates.forEach((item: IBazaarItem) => {
            html += genUpdateItemHTML(item, "templates");
        });
        response.data.widgets.forEach((item: IBazaarItem) => {
            html += genUpdateItemHTML(item, "widgets");
        });
        bazaarData.update = response.data;
        const allCount = response.data.themes.length + response.data.icons.length + response.data.widgets.length + response.data.plugins.length + response.data.templates.length;
        if (allCount === 0) {
            element.querySelector('[data-type="downloaded-update"]').innerHTML = "";
            return;
        }
        element.querySelector('[data-type="downloaded-update"]').innerHTML = `<div class="fn__flex config-bazaar__title">
<div class="fn__flex-1"></div>
<button class="b3-button" data-type="install-all">${siyuanI18n.updateAll}</button>
<span class="fn__space"></span>
<div class="counter counter--bg fn__flex-center">${allCount}</div>
</div>
<div class="config-bazaar__content">${html}</div>`;
    });
};

export const genMyHTML = (element: Element, bazaarType: TBazaarType, app: AppFacade, updateUpdate = true) => {
    if (updateUpdate) {
        getUpdate(element);
    }
    const contentElement = element.querySelector("#configBazaarDownloaded");
    const prevSibling = contentElement.previousElementSibling;
    if (contentElement.getAttribute("data-loading") === "true" ||
        prevSibling.querySelector(`[data-type="my${bazaarType.replace(bazaarType[0], bazaarType[0].toUpperCase()).substring(0, bazaarType.length - 1)}"]`).classList.contains("b3-button--outline")) {
        return;
    }
    updateDownloadedSortSelect(element, bazaarType);
    contentElement.setAttribute("data-loading", "true");
    let url = "/api/bazaar/getInstalledTheme";
    if (bazaarType === "icons") {
        url = "/api/bazaar/getInstalledIcon";
    } else if (bazaarType === "widgets") {
        url = "/api/bazaar/getInstalledWidget";
    } else if (bazaarType === "templates") {
        url = "/api/bazaar/getInstalledTemplate";
    } else if (bazaarType === "plugins") {
        url = "/api/bazaar/getInstalledPlugin";
    }
    fetchPost(url, {
        frontend: getFrontend(),
        keyword: (prevSibling.querySelector(".b3-text-field") as HTMLInputElement)?.value || "",
    }, response => {
        contentElement.removeAttribute("data-loading");
        let html = "";
        let showSwitch = false;
        if (["icons", "themes"].includes(bazaarType)) {
            showSwitch = true;
        }
        const counterElement = prevSibling.querySelector(".counter");
        const currentSortValue = getDownloadedSortValue(bazaarType);
        const packages = sortDownloadedPackages(response.data.packages, currentSortValue);
        if (packages.length === 0) {
            counterElement.classList.add("fn__none");
        } else {
            counterElement.classList.remove("fn__none");
            counterElement.textContent = packages.length;

            // Note: genCardHTML logic in bazaar.ts _genMyHTML is slightly different (downloaded=true, specific actions).
            // _genMyHTML manually constructed the card HTML.
            // bazaarHtml.ts's genCardHTML has `downloaded=false` in dataObj.
            // I should use the manual construction logic from _genMyHTML or update genCardHTML to handle 'downloaded' mode.
            // Since genCardHTML is shared, I should probably copy the logic from _genMyHTML for now or adapt genCardHTML.
            // Looking at bazaar.ts, _genMyHTML has unique buttons (setting, uninstall, open, switch, install-t for update).
            // genCardHTML has some of them.
            // To be safe, I will copy the logic from _genMyHTML directly here.

            packages.forEach((item: IBazaarItem) => {
                const dataObj = {
                    bazaarType,
                    themeMode: item.modes?.toString(),
                    updated: item.updated,
                    name: item.name,
                    repoURL: item.repoURL,
                    repoHash: item.repoHash,
                    downloaded: true
                };
                const plugin = bazaarType === "plugins"
                    ? app.plugins.find((item: Plugin) => item.name === dataObj.name)
                    : undefined;
                const hasSetting = !!plugin &&
                    ("setting" in plugin || Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(plugin), "openSetting"));
                const settingActionHTML = hasSetting
                    ? `<span class="b3-tooltips b3-tooltips__nw block__icon block__icon--show${window.siyuan.config.bazaar.petalDisabled ? " fn__none" : ""}" data-type="setting" aria-label="${siyuanI18n.config}">
        <svg><use xlink:href="#iconSettings"></use></svg>
    </span>`
                    : "";

                html += `<div data-name="${escapeAttr(item.name)}" data-obj='${JSON.stringify(dataObj)}' class="b3-card${item.current ? " b3-card--current" : ""}">
<div class="b3-card__img"><img src="${item.iconURL}" onerror="this.src='/stage/images/icon.png'"/></div>
<div class="fn__flex-1 fn__flex-column">
    <div class="b3-card__info b3-card__info--left fn__flex-1">
        ${item.preferredName}${item.preferredName !== item.name ? ` <span class="ft__on-surface ft__smaller">${item.name}</span>` : ""}
        <div class="b3-card__desc" title="${escapeAttr(item.preferredDesc) || ""}">${item.preferredDesc || ""}</div>
    </div>
</div>
<div class="b3-card__actions b3-card__actions--right">
    ${item.incompatible ? `<span class="fn__space"></span><span class="fn__flex-center b3-tooltips b3-tooltips__nw b3-chip b3-chip--error b3-chip--small" aria-label="${siyuanI18n.incompatiblePluginTip}">${siyuanI18n.incompatible}</span>` : ""}
    ${genFundingHTML(item.preferredFunding)}
    ${settingActionHTML}
    <span class="b3-tooltips b3-tooltips__nw block__icon block__icon--show" data-type="uninstall" aria-label="${siyuanI18n.uninstall}">
        <svg><use xlink:href="#iconTrashcan"></use></svg>
    </span>
    <span class="b3-tooltips b3-tooltips__nw block__icon block__icon--show${isBrowser() ? " fn__none" : ""}" data-type="open" aria-label="${siyuanI18n.showInFolder}">
        <svg><use xlink:href="#iconFolder"></use></svg>
    </span>
    <span class="b3-tooltips b3-tooltips__nw block__icon block__icon--show" data-type="export-local-package" aria-label="${siyuanI18n.export}">
        <svg><use xlink:href="#iconUpload"></use></svg>
    </span>
    <span class="b3-tooltips b3-tooltips__nw block__icon block__icon--show${!item.current && showSwitch ? "" : " fn__none"}" data-type="switch" aria-label="${siyuanI18n.use}">
        <svg><use xlink:href="#iconSelect"></use></svg>
    </span>
    <span data-type="install-t" aria-label="${siyuanI18n.update}" class="b3-tooltips b3-tooltips__nw block__icon block__icon--show${item.outdated ? "" : " fn__none"}">
        <svg class="ft__primary"><use xlink:href="#iconRefresh"></use></svg>
    </span>
    <span class="fn__space${bazaarType === "plugins" ? "" : " fn__none"}"></span>
    <span class="fn__space${bazaarType === "plugins" ? "" : " fn__none"}"></span>
    <input class="b3-switch fn__flex-center${bazaarType === "plugins" ? "" : " fn__none"}" ${item.enabled ? "checked" : ""} data-type="plugin-enable" type="checkbox" ${item.incompatible ? " disabled" : ""}>
</div>
</div>`;
            });
        }
        bazaarData.downloadedDefault = response.data.packages;
        bazaarData.downloaded = packages;
        const checkElement = contentElement.parentElement.querySelector(".b3-switch");
        if (bazaarType === "plugins") {
            checkElement.classList.remove("fn__none");
        } else {
            checkElement.classList.add("fn__none");
        }
        contentElement.innerHTML = html ? html : `<div class="fn__hr"></div><ul class="b3-list b3-list--background"><li class="b3-list--empty">${siyuanI18n.emptyContent}</li></ul>`;
    });
};
