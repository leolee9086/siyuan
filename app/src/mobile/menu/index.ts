import {popSearch} from "./search";
import {closeModel, closePanel} from "../util/closePanel";
import {mountHelp, newDailyNote} from "../../util/file/mount";
import {newEncryptedNotebook} from "../../util/file/notebookCreation/newEncryptedNotebook/newEncryptedNotebook.factory";
import {newNotebook} from "../../util/file/notebookCreation/newNotebook/newNotebook.factory";
import {exitSiYuan, processSync} from "../../dialog/processSystem";
import { lockScreen } from "../../dialog/processSystem/lockScreen";
import {openHistory} from "../../history/history.panel";
import {syncGuide} from "../../sync/syncGuide";
import {openCard} from "../../card/openCard";
import {activeBlur} from "../keyboard/activeBlur";
import {openModel} from "./model";
import {getRecentDocs} from "./getRecentDocs";
import type { AppFacade } from "../../app/AppFacade.types";
import {
    isDisabledFeature,
    isHuawei,
    isInMobileApp
} from "../../protyle/util/compatibility";
import {newFile} from "../../util/file/newFile";
// 上游新增：停靠栏入口、Agent 会话入口与可搜索设置面板
import {openDock} from "../dock/util";
import type {SettingTabId} from "../../config/setting/setting.types";
import {normalizeSearchText} from "../../config/search/normalize";
import {unmountBazaarTab} from "../../config/bazaarTab";
// S-forge：本地设置注册表与设置菜单类型
import {getSForgeState} from "../../config/sforge.global";
import {SETTING_TAB_REGISTRY} from "../../config/sforge.symbols";
import type {SettingTab, SettingTabSearchResult} from "../../config/setting/builder";
import {settingTabToMenuId} from "../../config/setting/settingMenu.types";
import {bindSettingSaveDelegation} from "../../config/setting/save";
import {isMobile} from "../../util/platform/functions";
import {getCurrentEditor} from "../util/getCurrentEditor";
// S-forge: 本地i18n封装，替代直接访问 window.siyuan.languages
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {openMobileDataMigration} from "../../menus/dataMigration/mobile";
import {setMobileSettingOpener} from "../setting.port";
import {getMobileAgentOpen} from "../agent/agent.port";

// S-forge: 保留本地运行时 AI 可见性判断，避免移动端菜单显示被禁用功能。
const getSettingTabs = () => {
    const settingTabs = getSForgeState(SETTING_TAB_REGISTRY);
    if (!settingTabs) {
        throw new Error("Mobile settings require the setting tab registry");
    }
    return settingTabs;
};

type TSettingTab = SettingTabId;

interface ISettingTabShell<TId extends string = string> {
    id: TId;
    icon: string;
    title: string;
    hidden?: boolean;
}

const settingTabIds: SettingTabId[] = [
    "editor", "file", "appearance", "bazaar", "flashcard", "ai", "AIProfiles", "secretsVariables",
    "assets", "export", "search", "keymap", "sync", "access", "app", "about",
];

const getSettingTab = (id: TSettingTab) => {
    const settingTab = getSettingTabs().get(id);
    if (!settingTab) {
        throw new Error(`Unknown mobile setting tab: ${id}`);
    }
    return settingTab;
};

const getSettingTabDefs = (): ISettingTabShell<TSettingTab>[] => {
    const defs: ISettingTabShell<TSettingTab>[] = [];
    for (const id of settingTabIds) {
        const settingTab = getSettingTabs().get(id);
        if (!settingTab) {
            continue;
        }
        const def: ISettingTabShell<TSettingTab> = {
            id,
            icon: settingTab.icon,
            title: settingTab.title(),
        };
        const hidden = settingTab.hidden?.();
        if (hidden !== undefined) {
            def.hidden = hidden;
        }
        defs.push(def);
    }
    return defs;
};

const isSettingTabHidden = (def: SettingTab) => {
    return def.hidden?.() || (["ai", "AIProfiles"].includes(def.id) && (isHuawei() || isDisabledFeature("ai")));
};

const getSettingTabFromMenuTarget = (target: HTMLElement): ISettingTabShell<TSettingTab> | undefined => {
    const item = target.closest(".b3-menu__item") as HTMLElement | null;
    if (!item?.id) {
        return undefined;
    }
    return getSettingTabDefs().find(def => settingTabToMenuId(def.id) === item.id);
};

const openSettingTabModel = (app: AppFacade, settingTabDef: SettingTab, title = settingTabDef.title(), icon = settingTabDef.icon) => {
    if (isSettingTabHidden(settingTabDef)) {
        return;
    }
    openModel({
        title,
        icon,
        html: `<div class="config${isMobile() ? " config--mobile" : ""}"></div>`,
        bindEvent(modelMainElement: HTMLElement) {
            const root = modelMainElement.firstElementChild as HTMLElement;
            bindSettingSaveDelegation(root);
            void settingTabDef.mount(root, undefined, app);
        }
    });
};

const getSettingTabsMenuHTML = () => getSettingTabDefs().map(def =>
    `<div class="b3-menu__item${def.hidden ? " fn__none" : ""}" id="${settingTabToMenuId(def.id)}">
        <svg class="b3-menu__icon"><use xlink:href="#${def.icon}"></use></svg>
        <span class="b3-menu__label">${def.title}</span>
    </div>`).join("");

const getSettingTabResultsHTML = () => getSettingTabDefs().map(def =>
    `<div class="config mobile-setting-menu__result fn__none" data-name="${def.id}"></div>`).join("");

const filterSettingTabsMenu = (element: HTMLElement, keywords: string) => {
    const matches = new Map<TSettingTab, SettingTabSearchResult>();
    for (const def of getSettingTabDefs()) {
        if (def.hidden) {
            continue;
        }
        const item = element.querySelector(`#${settingTabToMenuId(def.id)}`);
        const result = keywords ? getSettingTab(def.id).scanSearch(keywords) : undefined;
        const matched = !keywords || result?.matches;
        item?.classList.toggle("config-search-hidden", !matched);
        if (result?.matches) {
            matches.set(def.id, result);
        }
    }
    element.querySelector('[data-type="setting-search-empty"]')?.classList.toggle("fn__none", !keywords || matches.size > 0);
    return matches;
};

const openSettingTab = (app: AppFacade, settingTabDef: ISettingTabShell<TSettingTab>, returnCallback?: () => void) => {
    let root: HTMLElement | undefined;
    openModel({
        title: settingTabDef.title,
        icon: "iconLeft",
        html: `<div class="config${isMobile() ? " config--mobile" : ""}"></div>`,
        bindEvent(modelMainElement: HTMLElement) {
            root = modelMainElement.firstElementChild as HTMLElement;
            bindSettingSaveDelegation(root);
            void getSettingTab(settingTabDef.id).mount(root, undefined, app);
        },
        destroyCallback() {
            if (settingTabDef.id === "bazaar" && root) {
                unmountBazaarTab(root);
            }
        },
        backCallback() {
            if (settingTabDef.id === "bazaar") {
                const readmeElement = root?.querySelector("#configBazaarReadme.config__view--show");
                if (readmeElement) {
                    readmeElement.classList.remove("config__view--show");
                    return false;
                }
            }
            if (returnCallback) {
                returnCallback();
            } else {
                openSettingMenu(app, "back");
            }
        },
        transition: "forward",
    });
};

const openSettingMenu = (
    app: AppFacade,
    transition?: "back",
    returnCallback?: () => void,
) => {
    let settingMenuElement: HTMLElement | undefined;
    openModel({
        title: window.siyuan.languages.config,
        icon: "iconLeft",
        html: `<div class="mobile-setting-menu">
    <div class="mobile-setting-menu__search">
        <input placeholder="${window.siyuan.languages.searchPlaceholder}" class="b3-text-field fn__flex-1" autocomplete="off" autocorrect="off" spellcheck="false">
    </div>
    <div class="b3-menu__groups mobile-setting-menu__groups">
        <div class="b3-menu__group">
            <div class="b3-menu__group-items">${getSettingTabsMenuHTML()}</div>
        </div>
        <div class="b3-list--empty fn__none" data-type="setting-search-empty">${window.siyuan.languages.emptyContent}</div>
        ${getSettingTabResultsHTML()}
    </div>
</div>`,
        bindEvent(modelMainElement: HTMLElement) {
            settingMenuElement = modelMainElement;
            const searchElement = modelMainElement.querySelector("input") as HTMLInputElement;
            const groupsElement = modelMainElement.querySelector(".mobile-setting-menu__groups") as HTMLElement;
            let selectedTabId: TSettingTab | undefined;
            const showSearchResult = (keywords: string, tabId: TSettingTab, result: SettingTabSearchResult) => {
                groupsElement.classList.toggle("mobile-setting-menu__groups--bazaar", tabId === "bazaar");
                modelMainElement.querySelectorAll<HTMLElement>(".mobile-setting-menu__result").forEach((item) => {
                    item.classList.toggle("fn__none", item.dataset.name !== tabId);
                });
                modelMainElement.querySelectorAll(".b3-menu__group-items > .b3-menu__item").forEach((item) => {
                    item.classList.toggle("b3-menu__item--current", item.id === settingTabToMenuId(tabId));
                });
                const root = modelMainElement.querySelector(`.mobile-setting-menu__result[data-name="${tabId}"]`) as HTMLElement;
                bindSettingSaveDelegation(root);
                void getSettingTab(tabId).mount(root, {
                    keywords,
                    ...(result.visibleItemIds ? {visibleItemIds: result.visibleItemIds} : {}),
                    ...(result.visibleGroupIds ? {visibleGroupIds: result.visibleGroupIds} : {}),
                    ...(result.unavailableItems ? {unavailableItems: result.unavailableItems} : {}),
                }, app);
            };
            const syncSearch = () => {
                const keywords = normalizeSearchText(searchElement.value);
                const matches = filterSettingTabsMenu(modelMainElement, keywords);
                if (!keywords || matches.size === 0) {
                    selectedTabId = undefined;
                    groupsElement.classList.remove("mobile-setting-menu__groups--bazaar");
                    modelMainElement.querySelectorAll(".mobile-setting-menu__result").forEach((item) => {
                        item.classList.add("fn__none");
                    });
                    modelMainElement.querySelectorAll(".b3-menu__group-items > .b3-menu__item").forEach((item) => {
                        item.classList.remove("b3-menu__item--current");
                    });
                    return;
                }
                if (!selectedTabId || !matches.has(selectedTabId)) {
                    selectedTabId = matches.keys().next().value;
                }
                if (selectedTabId) {
                    const result = matches.get(selectedTabId);
                    if (result) {
                        showSearchResult(keywords, selectedTabId, result);
                    }
                }
            };
            searchElement.addEventListener("compositionend", syncSearch);
            searchElement.addEventListener("input", (event) => {
                const inputEvent = event instanceof InputEvent ? event : undefined;
                if (!inputEvent?.isComposing) {
                    syncSearch();
                }
            });
            modelMainElement.addEventListener("click", (event) => {
                const def = getSettingTabFromMenuTarget(event.target as HTMLElement);
                if (def) {
                    const keywords = normalizeSearchText(searchElement.value);
                    if (keywords) {
                        const result = getSettingTab(def.id).scanSearch(keywords);
                        if (!result.matches) {
                            return;
                        }
                        selectedTabId = def.id;
                        showSearchResult(keywords, def.id, result);
                        return;
                    }
                    openSettingTab(app, def, () => openSettingMenu(app, "back", returnCallback));
                }
            });
            syncSearch();
        },
        destroyCallback() {
            const root = settingMenuElement?.querySelector('.mobile-setting-menu__result[data-name="bazaar"]') as HTMLElement | null;
            if (root) {
                unmountBazaarTab(root);
            }
        },
        backCallback() {
            if (returnCallback) {
                returnCallback();
            } else {
                closeModel();
            }
        },
        ...(transition ? {transition} : {}),
    });
};

export const openMobileSetting = (app: AppFacade, tab?: TSettingTab, returnCallback?: () => void) => {
    activeBlur();
    if (tab) {
        const settingTabDef = getSettingTabDefs().find(def => def.id === tab);
        if (!settingTabDef || settingTabDef.hidden) {
            return;
        }
        openSettingTab(app, settingTabDef, returnCallback);
        return;
    }
    openSettingMenu(app, undefined, returnCallback);
};

// 移动菜单装配后发布设置入口，避免 Agent 面板反向加载菜单组合根。
setMobileSettingOpener(openMobileSetting);

export const popMenu = () => {
    if (getCurrentEditor()?.protyle.toolbar.isMultiSelectMode()) {
        return;
    }
    activeBlur();
    closePanel();
    const menuElement = document.getElementById("menu");
    menuElement.style.zIndex = (++window.siyuan.zIndex).toString();
    menuElement.classList.remove("fn__none");
};

export const initRightMenu = (
    app: AppFacade,
    openCommandPanel: (app: AppFacade) => void,
    notifyLayoutReady: (app: AppFacade) => void,
    openPluginMenu: (app: AppFacade) => void,
) => {
    const menuElement = document.getElementById("menu");
    let accountHTML = "";
    if (window.siyuan.user && !window.siyuan.config.readonly) {
        accountHTML = `<div class="b3-menu__item" id="menuAccount">
    <img class="b3-menu__icon" src="${window.siyuan.user.userAvatarURL}"/>
    <span class="b3-menu__label">${window.siyuan.user.userName}</span>
</div>`;
    } else if (!window.siyuan.config.readonly) {
        accountHTML = `<div class="b3-menu__item" id="menuAccount">
    <svg class="b3-menu__icon"><use xlink:href="#iconAccount"></use></svg><span class="b3-menu__label">${siyuanI18n.login}</span>
</div>`;
    }

    const settingTabsMenuHTML = [...getSettingTabs().values()].map(def =>
        `<div class="b3-menu__item${isSettingTabHidden(def) ? " fn__none" : ""}" id="${settingTabToMenuId(def.id)}">
        <svg class="b3-menu__icon"><use xlink:href="#${def.icon}"></use></svg>
        <span class="b3-menu__label">${def.title()}</span>
    </div>`).join("");

    menuElement.innerHTML = `<div class="b3-menu__title">
    <svg class="b3-menu__icon"><use xlink:href="#iconLeft"></use></svg>
    <span class="b3-menu__label">${siyuanI18n.back}</span>
</div>
<div class="b3-menu__items b3-menu__groups">
    <div class="b3-menu__group">
        <div class="b3-menu__group-title">${window.siyuan.languages.mobileMenuNavigation}</div>
        <div class="b3-menu__group-items">
            ${accountHTML}
            <div id="menuDocuments" class="b3-menu__item">
                <svg class="b3-menu__icon"><use xlink:href="#iconFiles"></use></svg><span class="b3-menu__label">${window.siyuan.languages.fileTree}</span>
            </div>
            <div id="menuTabs" class="b3-menu__item">
                <svg class="b3-menu__icon"><use xlink:href="#iconLayoutGrid"></use></svg><span class="b3-menu__label">${window.siyuan.languages.mobileTabs}</span>
            </div>
            <div id="menuOutline" class="b3-menu__item">
                <svg class="b3-menu__icon"><use xlink:href="#iconOutline"></use></svg><span class="b3-menu__label">${window.siyuan.languages.outline}</span>
            </div>
            <div id="menuBookmark" class="b3-menu__item">
                <svg class="b3-menu__icon"><use xlink:href="#iconBookmark"></use></svg><span class="b3-menu__label">${window.siyuan.languages.bookmark}</span>
            </div>
            <div id="menuTag" class="b3-menu__item">
                <svg class="b3-menu__icon"><use xlink:href="#iconTag"></use></svg><span class="b3-menu__label">${window.siyuan.languages.tag}</span>
            </div>
            <div id="menuBacklink" class="b3-menu__item">
                <svg class="b3-menu__icon"><use xlink:href="#iconLink"></use></svg><span class="b3-menu__label">${window.siyuan.languages.backlinks}</span>
            </div>
            <div id="menuInbox" class="b3-menu__item">
                <svg class="b3-menu__icon"><use xlink:href="#iconInbox"></use></svg><span class="b3-menu__label">${window.siyuan.languages.inbox}</span>
            </div>
            <div id="menuRecent" class="b3-menu__item">
                <svg class="b3-menu__icon"><use xlink:href="#iconList"></use></svg><span class="b3-menu__label">${window.siyuan.languages.recentDocs}</span>
            </div>
            <div id="menuSearch" class="b3-menu__item">
                <svg class="b3-menu__icon"><use xlink:href="#iconSearch"></use></svg><span class="b3-menu__label">${window.siyuan.languages.search}</span>
            </div>
            <div id="menuAgentChat" class="b3-menu__item${window.siyuan.config.readonly || window.siyuan.isPublish || isDisabledFeature("ai") ? " fn__none" : ""}">
                <svg class="b3-menu__icon"><use xlink:href="#iconSparkles"></use></svg>
                <span class="b3-menu__label">${window.siyuan.languages.agentChat}</span>
                <span data-type="agent-status" class="b3-menu__accelerator fn__none"></span>
            </div>
            <div id="menuCommand" class="b3-menu__item">
                <svg class="b3-menu__icon"><use xlink:href="#iconTerminal"></use></svg><span class="b3-menu__label">${window.siyuan.languages.commandPanel}</span>
            </div>
            <div id="menuCard" class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}">
                <svg class="b3-menu__icon"><use xlink:href="#iconRiffCard"></use></svg><span class="b3-menu__label">${window.siyuan.languages.spaceRepetition}</span>
            </div>
            <div class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}" id="menuLock">
                <svg class="b3-menu__icon"><use xlink:href="#iconLock"></use></svg><span class="b3-menu__label">${window.siyuan.languages.lockScreen}</span>
            </div>
            <div class="b3-menu__item b3-menu__item--warning${isInMobileApp() ? "" : " fn__none"}" id="menuSafeQuit">
                <svg class="b3-menu__icon"><use xlink:href="#iconQuit"></use></svg><span class="b3-menu__label">${window.siyuan.languages.safeQuit}</span>
            </div>
        </div>
    </div>
    <div class="b3-menu__group${window.siyuan.config.readonly ? " fn__none" : ""}">
        <div class="b3-menu__group-title">${window.siyuan.languages.mobileMenuCreate}</div>
        <div class="b3-menu__group-items">
            <div class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}" id="menuNewDoc">
                <svg class="b3-menu__icon"><use xlink:href="#iconFile"></use></svg><span class="b3-menu__label">${window.siyuan.languages.newFile}</span>
            </div>
            <div id="menuNewDaily" class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}">
                <svg class="b3-menu__icon"><use xlink:href="#iconCalendar"></use></svg><span class="b3-menu__label">${window.siyuan.languages.dailyNote}</span>
            </div>
            <div class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}" id="menuNewNotebook">
                <svg class="b3-menu__icon"><use xlink:href="#iconNewNoteBook"></use></svg><span class="b3-menu__label">${window.siyuan.languages.newNotebook}</span>
            </div>
            <div class="b3-menu__item${(window.siyuan.config.readonly || !window.siyuan.config.notebookCrypto?.enabled) ? " fn__none" : ""}" id="menuNewEncryptedNotebook">
                <svg class="b3-menu__icon"><use xlink:href="#iconLock"></use></svg><span class="b3-menu__label">${window.siyuan.languages.newEncryptedNotebook}</span>
            </div>
        </div>
    </div>
    <div class="b3-menu__group${window.siyuan.config.readonly ? " fn__none" : ""}">
        <div class="b3-menu__group-title">${window.siyuan.languages.mobileMenuDataManagement}</div>
        <div class="b3-menu__group-items">
            <div class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}" id="menuSyncNow">
                <svg class="b3-menu__icon"><use xlink:href="#iconCloudSucc"></use></svg><span class="b3-menu__label">${window.siyuan.languages.syncNow}</span>
            </div>
            <div class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}" id="menuHistory">
                <svg class="b3-menu__icon"><use xlink:href="#iconHistory"></use></svg><span class="b3-menu__label">${window.siyuan.languages.dataHistory}</span>
            </div>
            <div class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}" id="menuImport">
                <svg class="b3-menu__icon"><use xlink:href="#iconDatabaseBackup"></use></svg><span class="b3-menu__label">${window.siyuan.languages.dataMigration}</span>
            </div>
        </div>
    </div>
    <div class="b3-menu__group">
        <div class="b3-menu__group-title">${window.siyuan.languages.extensions}</div>
        <div class="b3-menu__group-items">
            ${settingTabsMenuHTML}
            <div class="b3-menu__item" id="menuPlugin">
                <svg class="b3-menu__icon"><use xlink:href="#iconPlugin"></use></svg><span class="b3-menu__label">${window.siyuan.languages.plugin}</span>
            </div>
            <div id="menuPluginTopBar" class="fn__none"></div>
        </div>
    </div>
    <div class="b3-menu__group">
        <div class="b3-menu__group-title">${window.siyuan.languages.mobileMenuSettingsAndHelp}</div>
        <div class="b3-menu__group-items">
            <div class="b3-menu__item" id="menuSettings">
                <svg class="b3-menu__icon"><use xlink:href="#iconSettings"></use></svg><span class="b3-menu__label">${window.siyuan.languages.config}</span>
            </div>
            <div class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}" id="menuHelp">
                <svg class="b3-menu__icon"><use xlink:href="#iconHelp"></use></svg><span class="b3-menu__label">${window.siyuan.languages.userGuide}</span>
            </div>
            <a class="b3-menu__item" href="${"zh-CN" === window.siyuan.config.lang ? "https://ld246.com/article/1649901726096" : "https://liuyun.io/article/1686530886208"}" target="_blank">
                <svg class="b3-menu__icon"><use xlink:href="#iconFeedback"></use></svg>
                <span class="b3-menu__label">${window.siyuan.languages.feedback}</span>
            </a>
        </div>
    </div>
</div>`;
    window.siyuan.mobile.agentChatController?.refreshStatus();
    processSync();
    notifyLayoutReady(app);
    // 只能用 click，否则无法上下滚动 https://github.com/siyuan-note/siyuan/issues/6628
    menuElement.addEventListener("click", (event) => {
        let target = event.target as HTMLElement;
        let settingTabDef: SettingTab | undefined;
        while (target && !target.isEqualNode(menuElement)) {
            if (target.classList.contains("b3-menu__title")) {
                closePanel();
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuDocuments") {
                closePanel();
                openDock("file");
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuTabs") {
                closePanel();
                document.getElementById("toolbarTabs").dispatchEvent(new CustomEvent("click"));
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (["menuOutline", "menuBookmark", "menuTag", "menuBacklink", "menuInbox"].includes(target.id)) {
                closePanel();
                openDock(target.id.replace("menu", "").toLowerCase());
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuRecent") {
                getRecentDocs(app);
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuSearch") {
                popSearch(app);
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuAgentChat") {
                getMobileAgentOpen()(app);
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuCommand") {
                closePanel();
                openCommandPanel(app);
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuNewDoc") {
                newFile(app);
                closePanel();
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuNewNotebook") {
                newNotebook();
                closePanel();
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuNewEncryptedNotebook") {
                newEncryptedNotebook();
                closePanel();
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuImport") {
                closePanel();
                openMobileDataMigration();
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuNewDaily") {
                newDailyNote(app);
                closePanel();
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuCard") {
                openCard(app);
                closePanel();
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuHelp") {
                mountHelp();
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuLock") {
                lockScreen(app);
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuSyncNow") {
                syncGuide();
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuHistory") {
                openHistory(app);
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuAccount") {
                const syncTab = [...getSettingTabs().values()].find(def => def.id === "sync");
                if (syncTab) {
                    openSettingTabModel(app, syncTab, window.siyuan.user ? siyuanI18n.manage : siyuanI18n.login, "iconAccount");
                }
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuSettings") {
                openMobileSetting(app);
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuSafeQuit") {
                event.preventDefault();
                event.stopPropagation();
                exitSiYuan();
                break;
            } else if ((settingTabDef = getSettingTabFromMenuTarget(target))) {
                openSettingTabModel(app, settingTabDef);
                event.preventDefault();
                event.stopPropagation();
                break;
            }
            target = target.parentElement;
        }
    });
};
