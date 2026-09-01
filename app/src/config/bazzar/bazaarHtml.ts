/**
 * Generate HTML functions for Bazaar
 */
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { escapeAttr } from "../../util/DOM/escape";
import { isBrowser } from "../../util/platform/functions";
import { Constants } from "../../constants";
import { bazaarData } from "./bazaarData";

export const genKeywordsHTML = (bazaarType: TBazaarType, keywords: string[], selectedKeywords: string[]): string => {
    let html = '<div class="config-bazaar__keywords">';
    html += '<div class="config-bazaar__keywords-list">';

    html += keywords.map(keyword => {
        const isSelected = selectedKeywords.includes(keyword);
        return `<span class="b3-chip ${isSelected ? "b3-chip--primary" : ""}" data-keyword="${keyword}" data-type="${bazaarType}">${keyword}</span>`;
    }).join("");

    html += "</div></div>";
    return html;
};

export const genFundingHTML = (funding: string): string => {
    if (!funding) {
        return "";
    }
    try {
        new URL(funding);
        return `<a target="_blank" href="${escapeAttr(funding)}" class="block__icon block__icon--show ariaLabel" aria-label="${siyuanI18n.sponsor} ${escapeAttr(funding)}"><svg class="ft__pink"><use xlink:href="#iconHeart"></use></svg></a>`;
    } catch (e) {
        return `<span data-type="copy-funding" data-funding="${escapeAttr(funding)}" class="block__icon block__icon--show ariaLabel" aria-label="${siyuanI18n.sponsor} ${escapeAttr(funding)}"><svg class="ft__pink"><use xlink:href="#iconHeart"></use></svg></span>`;
    }
};

const genCardActionsHTML = (item: IBazaarItem, showSwitch: boolean) => {
    return `<div class="b3-card__actions">
            <span class="block__icon block__icon--show ft__primary">
                <svg><use xlink:href="#iconDownload"></use></svg>
                <span class="fn__space"></span>
                ${item.downloads}
            </span>
            <span class="fn__space"></span>
            ${item.preferredFunding ? genFundingHTML(item.preferredFunding) + '<span class="fn__space"></span>' : ""}
            <div class="fn__flex-1"></div>
            <span class="b3-tooltips b3-tooltips__nw block__icon block__icon--show${item.installed ? "" : " fn__none"}" data-type="uninstall" aria-label="${siyuanI18n.uninstall}">
                <svg><use xlink:href="#iconTrashcan"></use></svg>
            </span>
            <div class="fn__space${!item.current && item.installed && showSwitch ? "" : " fn__none"}"></div>
            <span class="b3-tooltips b3-tooltips__nw block__icon block__icon--show${!item.current && item.installed && showSwitch ? "" : " fn__none"}" data-type="switch" aria-label="${siyuanI18n.use}">
                <svg><use xlink:href="#iconSelect"></use></svg>
            </span>
            <div class="fn__space${item.outdated ? "" : " fn__none"}"></div>
            <span data-type="install-t" class="b3-tooltips b3-tooltips__nw block__icon block__icon--show${item.outdated ? "" : " fn__none"}" aria-label="${siyuanI18n.update}">
                <svg class="ft__primary"><use xlink:href="#iconRefresh"></use></svg>
            </span>
        </div>`;
};

export const genCardHTML = (item: IBazaarItem, bazaarType: TBazaarType, selectValue: string): string => {
    let hide = false;
    let themeMode = "";
    if (bazaarType === "themes") {
        const themeValue = selectValue;
        hide = (themeValue === "0" && item.modes.includes("dark")) || (themeValue === "1" && item.modes.includes("light"));
        themeMode = item.modes.toString();
    }
    let showSwitch = false;
    if (["icons", "themes"].includes(bazaarType)) {
        showSwitch = true;
    }
    const dataObj = {
        bazaarType,
        themeMode: themeMode,
        updated: item.updated,
        name: item.name,
        repoURL: item.repoURL,
        repoHash: item.repoHash,
        downloads: item.downloads,
        downloaded: false,
    };
    return `<div data-obj='${JSON.stringify(dataObj)}' class="b3-card b3-card--wrap${hide ? " fn__none" : ""}${item.current ? " b3-card--current" : ""}">
    <div class="b3-card__img">
        <img src="${item.iconURL}" onerror="this.src='/stage/images/icon.png'"/>
    </div>
    <div class="fn__flex-1 fn__flex-column">
        <div class="b3-card__info fn__flex-1">
            ${item.preferredName}${item.preferredName !== item.name ? ` <span class="ft__on-surface ft__smaller">${item.name}</span>` : ""}
            <div class="b3-card__desc" title="${escapeAttr(item.preferredDesc) || ""}">
                ${item.preferredDesc || ""}
            </div>
        </div>
        ${genCardActionsHTML(item, showSwitch)}
    </div>
</div>`;
};

export const genUpdateItemHTML = (item: IBazaarItem, bazaarType: TBazaarType): string => {
    const dataObj = {
        bazaarType,
        themeMode: item.modes?.toString(),
        updated: item.updated,
        name: item.name,
        repoURL: item.repoURL,
        repoHash: item.repoHash,
        downloaded: true
    };
    return `<div class="b3-card" data-obj='${JSON.stringify(dataObj)}'>
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
        <span class="b3-tooltips b3-tooltips__nw block__icon block__icon--show${isBrowser() ? " fn__none" : ""}" data-type="open" aria-label="${siyuanI18n.showInFolder}">
            <svg><use xlink:href="#iconFolder"></use></svg>
        </span>
        <span data-type="install-t" aria-label="${siyuanI18n.update}" class="b3-tooltips b3-tooltips__nw block__icon block__icon--show">
            <svg class="ft__primary"><use xlink:href="#iconRefresh"></use></svg>
        </span>
    </div>
</div>`;
};


const genTrustHTML = () => {
    return `<div class="fn__flex-column">
<div class="fn__flex-1"></div>
<div class="b3-label">
    <div>${siyuanI18n.bazaarTrust}</div>
    <div class="fn__hr--b"></div>
    <div>${siyuanI18n.bazaarTrust3}</div>
</div>
<div class="fn__flex b3-label">
    <svg class="b3-label__icon"><use xlink:href="#iconEye"></use></svg>
    <div>
        ${siyuanI18n.bazaarTrustCodeReview}
        <div class="b3-label__text">${siyuanI18n.bazaarTrustCodeReviewTip}</div>
    </div>
</div>
<div class="fn__flex b3-label">
    <svg class="b3-label__icon"><use xlink:href="#iconGithub"></use></svg>
    <div>
        ${siyuanI18n.bazaarTrustOpenSource}
        <div class="b3-label__text">${siyuanI18n.bazaarTrustOpenSourceTip}</div>
    </div>
</div>
<div class="fn__flex b3-label">
    <svg class="b3-label__icon"><use xlink:href="#iconUsers"></use></svg>
    <div>
        ${siyuanI18n.bazaarCommunityReview}
        <div class="b3-label__text">${siyuanI18n.bazaarPeerReviewTip}</div>
    </div>
</div>
<div class="fn__flex b3-label">
    <svg class="b3-label__icon"><use xlink:href="#iconInfo"></use></svg>
    <div>
        ${siyuanI18n.bazaarUserReport}
        <div class="b3-label__text">${siyuanI18n.bazaarUserReportTip}</div>
    </div>
</div>
<div class="b3-label b3-label--noborder">
    <div>${siyuanI18n.bazaarTrust1}</div>
    <div class="fn__hr--b"></div>
    <diiv>${siyuanI18n.bazaarTrust2}</diiv>
</div>
<div class="ft__center b3-label b3-label--noborder">
    <button class="b3-button fn__size200">${siyuanI18n.trust}</button>
</div>
<div class="fn__flex-1"></div>
</div>`;
};

const genPanel = (
    type: string,
    localSortValue: string,
    keywordsHTML: string,
    loadingHTML: string,
    extraSelectHTML: string = "",
    isHidden: boolean = true
) => {
    return `<div class="${isHidden ? "fn__none " : ""}config-bazaar__panel" data-type="${type}">
        <div class="fn__flex config-bazaar__title">
            <svg class="svg ft__on-surface fn__flex-center"><use xlink:href="#iconSort"></use></svg>
            <div class="fn__space"></div>
            <select class="b3-select">
                <option ${localSortValue === "0" ? "selected" : ""} value="0">${siyuanI18n.sortByUpdateTimeDesc}</option>
                <option ${localSortValue === "1" ? "selected" : ""} value="1">${siyuanI18n.sortByUpdateTimeAsc}</option>
                <option ${localSortValue === "2" ? "selected" : ""} value="2">${siyuanI18n.sortByDownloadsDesc}</option>
                <option ${localSortValue === "3" ? "selected" : ""} value="3">${siyuanI18n.sortByDownloadsAsc}</option>
            </select>
            <div class="fn__space"></div>
            ${extraSelectHTML}
            <div class="b3-form__icon">
                <svg class="b3-form__icon-icon"><use xlink:href="#iconSearch"></use></svg>
                <input class="b3-text-field b3-form__icon-input fn__block" placeholder="${siyuanI18n.enterKey} ${siyuanI18n.search}">
            </div>
            <div class="fn__space"></div>
            ${keywordsHTML ? keywordsHTML + '<div class="fn__space"></div>' : ""}
            <div class="fn__flex-1"></div>
            <div class="counter counter--bg fn__flex-center b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.total}"></div>
        </div>
        <div id="configBazaar${type.charAt(0).toUpperCase() + type.slice(1)}" class="config-bazaar__content">
            ${loadingHTML}
        </div>
    </div>`;
};

import { getSiyuanConfig, getSafeSiyuanStorage } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

const genTabBarHTML = () => {
    return `<div class="layout-tab-bar fn__flex">
    <div data-type="downloaded" class="item item--full item--focus"><span class="fn__flex-1"></span><span class="item__text">${siyuanI18n.downloaded}</span><span class="fn__flex-1"></span></div>
    <div data-type="plugin" class="item item--full"><span class="fn__flex-1"></span><span class="item__text">${siyuanI18n.plugin}</span><span class="fn__flex-1"></span></div>
    <div data-type="theme" class="item item--full"><span class="fn__flex-1"></span><span class="item__text">${siyuanI18n.theme}</span><span class="fn__flex-1"></span></div>
    <div data-type="icon" class="item item--full"><span class="fn__flex-1"></span><span class="item__text">${siyuanI18n.icon}</span><span class="fn__flex-1"></span></div>
    <div data-type="template" class="item item--full"><span class="fn__flex-1"></span><span class="item__text">${siyuanI18n.template}</span><span class="fn__flex-1"></span></div>
    <div data-type="widget" class="item item--full"><span class="fn__flex-1"></span><span class="item__text">${siyuanI18n.widget}</span><span class="fn__flex-1"></span></div>
</div>`;
};

/** 生成「已下载」面板的排序下拉框 */
const genDownloadedSortHTML = (downloadedSortValue: string): string => {
    return `<div class="fn__flex config-bazaar__sort">
                <svg class="svg ft__on-surface fn__flex-center"><use xlink:href="#iconSort"></use></svg>
                <select class="b3-select" data-type="downloaded-sort">
                    <option ${downloadedSortValue === "0" ? "selected" : ""} value="0">${siyuanI18n.sortDefault}</option>
                    <option ${downloadedSortValue === "1" ? "selected" : ""} value="1">${siyuanI18n.sortByInstallTimeDesc}</option>
                    <option ${downloadedSortValue === "2" ? "selected" : ""} value="2">${siyuanI18n.sortByInstallTimeAsc}</option>
                    <option ${downloadedSortValue === "3" ? "selected" : ""} value="3">${siyuanI18n.sortByUpdateTimeDesc}</option>
                    <option ${downloadedSortValue === "4" ? "selected" : ""} value="4">${siyuanI18n.sortByUpdateTimeAsc}</option>
                    <option ${downloadedSortValue === "5" ? "selected" : ""} data-plugin-only="true" value="5">${siyuanI18n.sortByEnabledFirst}</option>
                    <option ${downloadedSortValue === "6" ? "selected" : ""} data-plugin-only="true" value="6">${siyuanI18n.sortByDisabledFirst}</option>
                </select>
            </div>`;
};

const genDownloadedPanelHTML = (keywordsHTML: string, loadingHTML: string, petalDisabled: boolean, downloadedSortValue = "0") => {
    const downloadedSortHTML = genDownloadedSortHTML(downloadedSortValue);
    return `<div class="config-bazaar__panel" data-type="downloaded" data-init="true">
        <div data-type="downloaded-update"></div>
        <div class="fn__flex config-bazaar__title">
            <button data-type="myPlugin" class="b3-button">${siyuanI18n.plugin}</button>
            <div class="fn__space"></div>
            <button data-type="myTheme" class="b3-button b3-button--outline">${siyuanI18n.theme}</button>
            <div class="fn__space"></div>
            <button data-type="myIcon" class="b3-button b3-button--outline">${siyuanI18n.icon}</button>
            <div class="fn__space"></div>
            <button data-type="myTemplate" class="b3-button b3-button--outline">${siyuanI18n.template}</button>
            <div class="fn__space"></div>
            <button data-type="myWidget" class="b3-button b3-button--outline">${siyuanI18n.widget}</button>
            <div class="fn__space"></div>
            <button data-type="install-local-package" class="b3-button b3-button--outline">
                <svg><use xlink:href="#iconDownload"></use></svg>${siyuanI18n.import}
            </button>
            <div class="fn__space"></div>
            <button data-type="open-bazaar-hub" class="b3-button b3-button--outline">
                <svg><use xlink:href="#iconBazaar"></use></svg>${siyuanI18n.bazaar} Hub
            </button>
            <div class="fn__space"></div>
            <button data-type="open-bazaar-publish" class="b3-button b3-button--outline">
                <svg><use xlink:href="#iconUpload"></use></svg>${siyuanI18n.publish}
            </button>
            <input id="bazaarLocalPackageInput" class="fn__none" type="file" accept=".plugin.zip,.theme.zip,.icon.zip,.template.zip,.widget.zip,.zip">
            <div class="fn__space"></div>
            <div class="b3-form__icon">
                <svg class="b3-form__icon-icon"><use xlink:href="#iconSearch"></use></svg>
                <input class="b3-text-field b3-form__icon-input fn__block" placeholder="${siyuanI18n.enterKey} ${siyuanI18n.search}">
            </div>
            <div class="fn__space"></div>
            ${downloadedSortHTML}
            <div class="fn__space"></div>
            ${keywordsHTML}
            <div class="fn__space"></div>
            <div class="fn__flex-1"></div>
            <input ${petalDisabled ? "" : " checked"} data-type="plugins-enable" type="checkbox" class="b3-switch fn__flex-center" style="margin-right: 8px">
            <div class="counter counter--bg fn__none fn__flex-center b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.total}"></div>
        </div>
        <div id="configBazaarDownloaded" class="config-bazaar__content">
            ${loadingHTML}
        </div>
    </div>`;
};

const getKeywordsHTML = (bazaarType: TBazaarType) => {
    return genKeywordsHTML(bazaarType, bazaarData.keywords[bazaarType], bazaarData.selectedKeywords[bazaarType]);
};

export const genBazaarHTML = (clientHeight: number) => {
    if (!getSiyuanConfig().bazaar.trust) {
        return genTrustHTML();
    }
    const localSort = getSafeSiyuanStorage()?.[Constants.LOCAL_BAZAAR] || {
        theme: "0",
        template: "0",
        plugin: "0",
        icon: "0",
        widget: "0",
        downloadedPlugin: "0",
        downloadedTheme: "0",
        downloadedIcon: "0",
        downloadedTemplate: "0",
        downloadedWidget: "0"
    };
    const loadingHTML = `<div style="height: ${clientHeight - 80}px;display: flex;align-items: center;justify-content: center;"><img src="/stage/loading-pure.svg"></div>`;

    return `<div class="fn__flex-column" style="height: 100%">
${genTabBarHTML()}
<div class="fn__flex-1">
    ${genDownloadedPanelHTML(getKeywordsHTML("themes"), loadingHTML, getSiyuanConfig().bazaar.petalDisabled, localSort.downloadedPlugin || "0")}
    ${genPanel("theme", localSort.theme, getKeywordsHTML("plugins"), loadingHTML, `
            <select id="bazaarSelect" class="b3-select">
                <option selected value="2">${siyuanI18n.all}</option>
                <option value="0">${siyuanI18n.themeLight}</option>
                <option value="1">${siyuanI18n.themeDark}</option>
            </select>
            <div class="fn__space"></div>`, true)}
    ${genPanel("template", localSort.template, getKeywordsHTML("icons"), loadingHTML)}
    ${genPanel("plugin", localSort.plugin, getKeywordsHTML("widgets"), loadingHTML)}
    ${genPanel("icon", localSort.icon, "", loadingHTML)}
    ${genPanel("widget", localSort.widget, "", loadingHTML)}
</div>
<div id="configBazaarReadme" class="config-bazaar__readme"></div>
</div>`;
};
