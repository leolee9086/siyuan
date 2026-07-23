
import { showMessage } from "../../dialog/message";
import { fetchPost } from "../../util/network/fetch";
import { highlightRender } from "../../protyle/render/highlightRender";
import { Constants } from "../../constants";
import { getFrontend, isBrowser } from "../../util/platform/functions";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { bazaarData, extractKeywords, filterPackagesByKeywords } from "./bazaarData";
import { genCardHTML, genUpdateItemHTML, genFundingHTML, genKeywordsHTML } from "./bazaarHtml";
import { App } from "../../index";
import { escapeAttr } from "../../util/DOM/escape";
import { Plugin } from "../../plugin";

export const renderReadme = (element: Element, bazaarType: TBazaarType, data: IBazaarItem, downloaded: boolean) => {
    const readmeElement = element.querySelector("#configBazaarReadme") as HTMLElement;
    const urls = data.repoURL.split("/");
    urls.pop();
    let navTitle = siyuanI18n.icon;
    if (bazaarType === "themes") {
        navTitle = siyuanI18n.theme;
    } else if (bazaarType === "widgets") {
        navTitle = siyuanI18n.widget;
    } else if (bazaarType === "templates") {
        navTitle = siyuanI18n.template;
    } else if (bazaarType === "plugins") {
        navTitle = siyuanI18n.plugin;
    }
    const dataObj1 = {
        bazaarType,
        themeMode: data.modes?.toString(),
        name: data.name,
        repoURL: data.repoURL,
        repoHash: data.repoHash,
        downloaded
    };
    readmeElement.innerHTML = ` <div class="item__side" data-obj='${JSON.stringify(dataObj1)}'>
    <div class="fn__flex">
        <div style="padding-right: 8px" class="block__icon block__icon--show b3-tooltips b3-tooltips__e" data-type="goBack" aria-label="${siyuanI18n.back}">
            <svg><use xlink:href="#iconLeft"></use></svg>
            <span class="fn__space"></span>
            ${navTitle}
        </div>
    </div>
    <img class="item__img" src="${data.iconURL}" onerror="this.src='/stage/images/icon.png'">
    <div>
        <a href="${data.repoURL}" target="_blank" class="item__title" title="GitHub Repo">${data.preferredName}</a>
    </div>
    <div class="fn__hr"></div>
    <div>
        <a href="${data.repoURL}" target="_blank" class="ft__on-surface ft__smaller" title="GitHub Repo">${data.name}</a>
    </div>
    <div class="block__icons">
        <span class="fn__flex-1"></span>
        ${data.preferredFunding ?
            genFundingHTML(data.preferredFunding) :
            `<span class="b3-tooltips b3-tooltips__ne block__icon block__icon--show ft__primary" aria-label="${siyuanI18n.author}" style="cursor: default"><svg><use xlink:href="#iconAccount"></use></svg></span>`
        }
        <span class="fn__space"></span>
        <a href="${urls.join("/")}" target="_blank" title="Creator">${data.author}</a>
        <span class="fn__flex-1"></span>
    </div>
    <div class="fn__hr--b"></div>
    <div class="fn__hr--b"></div>
    <div class="ft__on-surface ft__smaller" style="line-height: 20px;">${siyuanI18n.currentVer}<br>v${data.version}</div>
    <div class="fn__hr"></div>
    <div class="ft__on-surface ft__smaller" style="line-height: 20px;">${downloaded ? siyuanI18n.installDate : siyuanI18n.releaseDate}<br>${downloaded ? data.hInstallDate : data.hUpdated}</div>
    <div class="fn__hr${downloaded ? " fn__none" : ""}"></div>
    <div class="ft__on-surface ft__smaller${downloaded ? " fn__none" : ""}" style="line-height: 20px;">${siyuanI18n.pkgSize}<br>${data.hSize}</div>
    <div class="fn__hr"></div>
    <div class="ft__on-surface ft__smaller" style="line-height: 20px;">${siyuanI18n.installSize}<br>${data.hInstallSize}</div>
    <div class="fn__hr--b"></div>
    <div class="fn__hr--b"></div>
    <div${(data.installed || downloaded) ? ' class="fn__none"' : ""}>
        <button class="b3-button" style="width: 168px"  data-type="install">${siyuanI18n.download}</button>
    </div>
    <div${(data.outdated && (data.installed || downloaded)) ? "" : ' class="fn__none"'}>
        <button class="b3-button" style="width: 168px" data-type="install-t">${siyuanI18n.update}</button>
    </div>
    <div class="fn__hr--b"></div>
    <div>
        <a href="${data.repoURL}/issues" target="_blank" title="Feedback via GitHub Issues" class="b3-button b3-button--success" style="width: 168px" data-type="feedback">${siyuanI18n.feedback}</a>
    </div>
    <div class="fn__hr--b${downloaded ? " fn__none" : ""}"></div>
    <div class="fn__hr--b${downloaded ? " fn__none" : ""}"></div>
    <div class="fn__flex${downloaded ? " fn__none" : ""}" style="justify-content: center;">
        <svg class="svg ft__on-surface fn__flex-center"><use xlink:href="#iconGithub"></use></svg>
        <span class="fn__space"></span>
        <a href="${data.repoURL}" target="_blank" title="GitHub Repo">Repo</a>
        <span class="fn__space"></span>
        <span class="fn__space"></span>
        <svg class="svg ft__on-surface fn__flex-center"><use xlink:href="#iconStar"></use></svg>
        <span class="fn__space"></span>
        <a href="${data.repoURL}/stargazers" target="_blank" title="Stars">${data.stars}</a>
        <span class="fn__space"></span>
        <span class="fn__space"></span>
        <svg class="svg ft__on-surface fn__flex-center"><use xlink:href="#iconGitHubI"></use></svg>
        <span class="fn__space"></span>
        <a href="${data.repoURL}/issues" target="_blank" title="Open issues">${data.openIssues}</a>
        <span class="fn__space"></span>
        <span class="fn__space"></span>
        <svg class="svg ft__on-surface fn__flex-center"><use xlink:href="#iconDownload"></use></svg>
        <span class="fn__space"></span>
        ${data.downloads}
    </div>
    <div class="fn__hr--b"></div>
    <div class="fn__hr--b"></div>
    <div class="fn__flex-1"></div>
</div>
<div class="item__main">
    <div class="item__preview" style="background-image: url(${data.previewURL})"></div>
    <div class="b3-typography${data.preferredDesc ? "" : " fn__none"}">
        <blockquote>
            <p>
                ${data.preferredDesc || ""}
            </p>
         </blockquote>
    </div>
    <div class="item__readme b3-typography b3-typography--default">
        <img data-type="img-loading" style="height: 64px;width: 100%;padding: 16px 0;" src="/stage/loading-pure.svg">
    </div>
</div>`;
    if (downloaded && data.preferredReadme) {
        const mdElement = readmeElement.querySelector(".item__readme");
        mdElement.innerHTML = data.preferredReadme;
        highlightRender(mdElement);
    } else {
        fetchPost("/api/bazaar/getBazaarPackageREAME", {
            repoURL: data.repoURL,
            repoHash: data.repoHash,
            packageType: bazaarType
        }, response => {
            const mdElement = readmeElement.querySelector(".item__readme");
            mdElement.innerHTML = response.data.html;
            highlightRender(mdElement);
        });
    }
    readmeElement.classList.add("config-bazaar__readme--show");
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
            renderReadme(element, (dataObj.bazaarType) as TBazaarType,
                response.data.packages.find((item: IBazaarItem) => item.repoURL === dataObj.repoURL),
                dataObj.downloaded);
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

export const genMyHTML = (element: Element, bazaarType: TBazaarType, app: App, updateUpdate = true) => {
    if (updateUpdate) {
        getUpdate(element);
    }
    const contentElement = element.querySelector("#configBazaarDownloaded");
    const prevSibling = contentElement.previousElementSibling;
    if (contentElement.getAttribute("data-loading") === "true" ||
        prevSibling.querySelector(`[data-type="my${bazaarType.replace(bazaarType[0], bazaarType[0].toUpperCase()).substring(0, bazaarType.length - 1)}"]`).classList.contains("b3-button--outline")) {
        return;
    }
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
        if (response.data.packages.length === 0) {
            counterElement.classList.add("fn__none");
        } else {
            counterElement.classList.remove("fn__none");
            counterElement.textContent = response.data.packages.length;

            // Note: genCardHTML logic in bazaar.ts _genMyHTML is slightly different (downloaded=true, specific actions).
            // _genMyHTML manually constructed the card HTML.
            // bazaarHtml.ts's genCardHTML has `downloaded=false` in dataObj.
            // I should use the manual construction logic from _genMyHTML or update genCardHTML to handle 'downloaded' mode.
            // Since genCardHTML is shared, I should probably copy the logic from _genMyHTML for now or adapt genCardHTML.
            // Looking at bazaar.ts, _genMyHTML has unique buttons (setting, uninstall, open, switch, install-t for update).
            // genCardHTML has some of them.
            // To be safe, I will copy the logic from _genMyHTML directly here.

            response.data.packages.forEach((item: IBazaarItem) => {
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

                html += `<div data-obj='${JSON.stringify(dataObj)}' class="b3-card${item.current ? " b3-card--current" : ""}">
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
        bazaarData.downloaded = response.data.packages;
        const checkElement = contentElement.parentElement.querySelector(".b3-switch");
        if (bazaarType === "plugins") {
            checkElement.classList.remove("fn__none");
        } else {
            checkElement.classList.add("fn__none");
        }
        contentElement.innerHTML = html ? html : `<div class="fn__hr"></div><ul class="b3-list b3-list--background"><li class="b3-list--empty">${siyuanI18n.emptyContent}</li></ul>`;
    });
};
