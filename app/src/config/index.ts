import {popMenu} from "../mobile/menu";
import {isMobile} from "../platform";
import {initSettingSearch, switchSettingTab} from "./search/dialog";
import {bindSettingSaveDelegation} from "./setting/save";
import {Dialog} from "../dialog";
import {Constants} from "../constants";
import {focusByRange} from "../protyle/util/selection";
import {getSettingTabDefs, type TSettingTab} from "./setting/tabs";
import {clearAccessTabElement} from "./tabs/accessRuntime";
import {clearSyncTabElement} from "./tabs/syncRuntime";
import {INTERNAL_FILETREE_TAB_TYPE} from "./fileTree";
import fileTreeConfigPanel from "../components/panels/fileTreeConfig.panel.vue";
import {tabRegistry} from "../registry";
import {createApp} from "vue";
import type {Custom} from "../layout/dock/Custom";
import type {App} from "../index";

/**
 * 延迟注册 Tab 类型。
 * 不能在模块顶层直接调用 tabRegistry.register()，config、plugin/registry 等模块之间存在循环依赖。
 */
let _fileTreeTabRegistered = false;
const registerFileTreeTab = () => {
    if (_fileTreeTabRegistered || isMobile) {
        return;
    }
    _fileTreeTabRegistered = true;
    tabRegistry.register({
        type: INTERNAL_FILETREE_TAB_TYPE,
        init: (model: Custom) => {
            const tab = model.tab;
            const app = createApp(fileTreeConfigPanel);
            if (tab) {
                app.mount(tab.panelElement);
            }
        },
    });
};

const openSettingDialog = (app: App, initialTab: TSettingTab = "editor") => {
    registerFileTreeTab();
    window.siyuan.dialogs.find((item) => item.element.querySelector(".config__tab-container"))?.destroy();
    let range: Range;
    if (getSelection().rangeCount > 0) {
        range = getSelection().getRangeAt(0);
    }
    const tabListItems: string[] = [];
    const tabPanels: string[] = [];
    for (const def of getSettingTabDefs()) {
        const isActive = def.id === initialTab;
        tabListItems.push(`<li data-name="${def.id}" class="b3-list-item${isActive ? " b3-list-item--focus" : ""}${def.hidden ? " fn__none" : ""}"><svg class="b3-list-item__graphic"><use xlink:href="#${def.icon}"></use></svg><span class="b3-list-item__text">${def.title}</span></li>`);
        tabPanels.push(`<div class="config__tab-container${isActive ? "" : " fn__none"}" data-name="${def.id}"></div>`);
    }
    const dialog = new Dialog({
        content: `<div class="fn__flex-1 fn__flex config__panel" style="overflow: hidden;position: relative">
    <div class="config__side b3-list b3-list--background">
        <div class="config__tab-head">
            <div class="config__tab-title resize__move">
                <svg class="b3-list-item__graphic"><use xlink:href="#iconSettings"></use></svg>
                <span class="b3-list-item__text">${window.siyuan.languages.config}</span>
            </div>
            <div class="b3-form__icon">
                <svg class="b3-form__icon-icon"><use xlink:href="#iconSearch"></use></svg>
                <input placeholder="${window.siyuan.languages.search}" class="b3-text-field fn__block b3-form__icon-input">
            </div>
        </div>
        <ul class="config__tab-scroll">
            ${tabListItems.join("")}
        </ul>
    </div>
    <div class="config__tab-wrap">
        ${tabPanels.join("")}
    </div>
</div>`,
        width: "64vw",
        height: "90vh",
        destroyCallback() {
            clearSyncTabElement();
            clearAccessTabElement();
            if (range) {
                focusByRange(range);
            }
        },
        transparent: true,
        disableScrimClose: true,
        scrimPointerEvents: true,
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_SETTING);

    const tabWrap = dialog.element.querySelector(".config__tab-wrap") as HTMLElement;
    bindSettingSaveDelegation(tabWrap);
    initSettingSearch(dialog.element, app);
    (dialog.element.querySelector(".b3-dialog__container") as HTMLElement).style.maxWidth = "1280px";
    dialog.element.querySelectorAll(".config__side .b3-list-item").forEach((item) => {
        // 兼容社区 JS 代码片段模拟点击，不做事件委托
        item.addEventListener("click", () => {
            const tabId = item.getAttribute("data-name") as TSettingTab;
            switchSettingTab(dialog.element, app, tabId);
        });
    });
    switchSettingTab(dialog.element, app, initialTab);
    return dialog;
};

export const openSetting = (app: App, tab?: TSettingTab) => {
    if (isMobile) {
        popMenu();
        return;
    }
    return openSettingDialog(app, tab);
};
