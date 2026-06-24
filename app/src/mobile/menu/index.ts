import {popSearch} from "./search";
import {closePanel} from "../util/closePanel";
import {mountHelp, newDailyNote, newNotebook} from "../../util/file/mount";
import {exitSiYuan, processSync} from "../../dialog/processSystem";
import { lockScreen } from "../../dialog/processSystem/lockScreen";
import {openHistory} from "../../history/history";
import {syncGuide} from "../../sync/syncGuide";
import {openCard} from "../../card/openCard";
import {activeBlur} from "../util/keyboardToolbar";
import {openModel} from "./model";
import {getRecentDocs} from "./getRecentDocs";
import {App} from "../../index";
import {
    isDisabledFeature,
    isHuawei,
    isInMobileApp
} from "../../protyle/util/compatibility";
import {newFile} from "../../util/file/newFile";
import {afterLoadPlugin} from "../../plugin/loader";
import {commandPanel} from "../../boot/globalEvent/command/panel";
import {openTopBarMenu} from "../../plugin/openTopBarMenu";
import {
    getSettingTab,
    getSettingTabDefs,
    settingTabToMenuId,
    type ISettingTabShell,
    type TSettingTab
} from "../../config/setting/tabs";
import {bindSettingSaveDelegation} from "../../config/setting/save";
import {isMobile} from "../../util/platform/functions";
import {getCurrentEditor} from "../editor";
// S-forge: 本地i18n封装，替代直接访问 window.siyuan.languages
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

// S-forge: 保留本地运行时 AI 可见性判断，避免移动端菜单显示被禁用功能。
const isSettingTabHidden = (def: ISettingTabShell<TSettingTab>) => {
    return def.hidden || (["ai", "AIProfiles"].includes(def.id) && (isHuawei() || isDisabledFeature("ai")));
};

const getSettingTabFromMenuTarget = (target: HTMLElement): ISettingTabShell<TSettingTab> | undefined => {
    const item = target.closest(".b3-menu__item") as HTMLElement | null;
    if (!item?.id) {
        return undefined;
    }
    return getSettingTabDefs().find(def => settingTabToMenuId(def.id) === item.id);
};

const openSettingTabModel = (app: App, settingTabDef: ISettingTabShell<TSettingTab>, title = settingTabDef.title, icon = settingTabDef.icon) => {
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
            void getSettingTab(settingTabDef.id).mount(root, undefined, app);
        }
    });
};

export const popMenu = () => {
    if (getCurrentEditor()?.protyle.toolbar.isMultiSelectMode()) {
        return;
    }
    activeBlur();
    document.getElementById("menu").style.transform = "translateX(0px)";
};

export const initRightMenu = (app: App) => {
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

    const settingTabsMenuHTML = getSettingTabDefs().map(def =>
        `<div class="b3-menu__item${isSettingTabHidden(def) ? " fn__none" : ""}" id="${settingTabToMenuId(def.id)}">
        <svg class="b3-menu__icon"><use xlink:href="#${def.icon}"></use></svg>
        <span class="b3-menu__label">${def.title}</span>
    </div>`).join("");

    menuElement.innerHTML = `<div class="b3-menu__title">
    <svg class="b3-menu__icon"><use xlink:href="#iconLeft"></use></svg>
    <span class="b3-menu__label">${siyuanI18n.back}</span>
</div>
<div class="b3-menu__items">
    ${accountHTML}
    <div id="menuRecent" class="b3-menu__item">
        <svg class="b3-menu__icon"><use xlink:href="#iconList"></use></svg><span class="b3-menu__label">${siyuanI18n.recentDocs}</span>
    </div>
    <div id="menuSearch" class="b3-menu__item">
        <svg class="b3-menu__icon"><use xlink:href="#iconSearch"></use></svg><span class="b3-menu__label">${siyuanI18n.search}</span>
    </div>
    <div id="menuCommand" class="b3-menu__item">
        <svg class="b3-menu__icon"><use xlink:href="#iconTerminal"></use></svg><span class="b3-menu__label">${siyuanI18n.commandPanel}</span>
    </div>
    <div class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}" id="menuSyncNow">
        <svg class="b3-menu__icon"><use xlink:href="#iconCloudSucc"></use></svg><span class="b3-menu__label">${siyuanI18n.syncNow}</span>
    </div>
    <div class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}" id="menuNewDoc">
        <svg class="b3-menu__icon"><use xlink:href="#iconFile"></use></svg><span class="b3-menu__label">${siyuanI18n.newFile}</span>
    </div>
    <div class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}" id="menuNewNotebook">
        <svg class="b3-menu__icon"><use xlink:href="#iconNewNoteBook"></use></svg><span class="b3-menu__label">${window.siyuan.languages.newNotebook}</span>
    </div>
    <div class="b3-menu__separator"></div>
    <div id="menuNewDaily" class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}">
        <svg class="b3-menu__icon"><use xlink:href="#iconCalendar"></use></svg><span class="b3-menu__label">${siyuanI18n.dailyNote}</span>
    </div>
    <div id="menuCard" class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}">
        <svg class="b3-menu__icon"><use xlink:href="#iconRiffCard"></use></svg><span class="b3-menu__label">${siyuanI18n.spaceRepetition}</span>
    </div>
    <div class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}" id="menuLock">
        <svg class="b3-menu__icon"><use xlink:href="#iconLock"></use></svg><span class="b3-menu__label">${siyuanI18n.lockScreen}</span>
    </div>
    <div class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}" id="menuHistory">
        <svg class="b3-menu__icon"><use xlink:href="#iconHistory"></use></svg><span class="b3-menu__label">${siyuanI18n.dataHistory}</span>
    </div>
    <div class="b3-menu__separator${isInMobileApp() ? "" : " fn__none"}"></div>
    <div class="b3-menu__item b3-menu__item--warning${isInMobileApp() ? "" : " fn__none"}" id="menuSafeQuit">
        <svg class="b3-menu__icon"><use xlink:href="#iconQuit"></use></svg><span class="b3-menu__label">${siyuanI18n.safeQuit}</span>
    </div>
    <div class="b3-menu__separator"></div>
    ${settingTabsMenuHTML}
    <div class="b3-menu__item" id="menuPlugin">
        <svg class="b3-menu__icon"><use xlink:href="#iconPlugin"></use></svg><span class="b3-menu__label">${siyuanI18n.plugin}</span>
    </div>
    <div class="b3-menu__separator"></div>
    <div class="b3-menu__item${window.siyuan.config.readonly ? " fn__none" : ""}" id="menuHelp">
        <svg class="b3-menu__icon"><use xlink:href="#iconHelp"></use></svg><span class="b3-menu__label">${siyuanI18n.userGuide}</span>
    </div>
    <a class="b3-menu__item" href="${"zh-CN" === window.siyuan.config.lang || "zh-TW" === window.siyuan.config.lang ? "https://ld246.com/article/1649901726096" : "https://liuyun.io/article/1686530886208"}" target="_blank">
        <svg class="b3-menu__icon"><use xlink:href="#iconFeedback"></use></svg>
        <span class="b3-menu__label">${siyuanI18n.feedback}</span>
    </a>
</div>`;
    processSync();
    app.plugins.forEach(item => {
        afterLoadPlugin(item);
    });
    // 只能用 click，否则无法上下滚动 https://github.com/siyuan-note/siyuan/issues/6628
    menuElement.addEventListener("click", (event) => {
        let target = event.target as HTMLElement;
        let settingTabDef: ISettingTabShell<TSettingTab> | undefined;
        while (target && !target.isEqualNode(menuElement)) {
            if (target.classList.contains("b3-menu__title")) {
                closePanel();
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuCommand") {
                closePanel();
                commandPanel(app);
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuSearch") {
                popSearch(app);
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuRecent") {
                getRecentDocs(app);
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuSafeQuit") {
                event.preventDefault();
                event.stopPropagation();
                exitSiYuan();
                break;
            } else if (target.id === "menuPlugin") {
                openTopBarMenu(app);
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
            } else if (target.id === "menuNewNotebook") {
                newNotebook();
                closePanel();
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.id === "menuNewDoc") {
                newFile({
                    app,
                    useSavePath: true
                });
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
                const syncTab = getSettingTabDefs().find(def => def.id === "sync");
                if (syncTab) {
                    openSettingTabModel(app, syncTab, window.siyuan.user ? siyuanI18n.manage : siyuanI18n.login, "iconAccount");
                }
                event.preventDefault();
                event.stopPropagation();
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
