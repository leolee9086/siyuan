import {popMenu} from "./imports";
import {isMobile} from "./imports";
import {initSettingSearch} from "./search/dialog";
import {switchSettingTab} from "./search/dialog";
import {bindSettingSaveDelegation} from "./setting/save";
import {Dialog} from "./imports";
import {Constants} from "./imports";
import {focusByRange} from "./imports";
import {getSettingTabDefs, settingTabToMenuId} from "./setting/tabs";
import type {TSettingTab} from "./setting/tabs";
import {clearAccessTabElement} from "./tabs/accessRuntime";
import {clearSyncTabElement} from "./tabs/syncRuntime";
import {INTERNAL_FILETREE_TAB_TYPE} from "./fileTree";
import {fileTreeConfigPanel} from "./imports";
import {tabRegistry} from "./imports";
import {createApp} from "./imports";
import type {CustomDomain} from "../layout/dock/custom/custom.types";
import type { AppFacade } from "../app/AppFacade.types";
import {isHTMLElement} from "./imports";
/** 导出 Bazaar README URI 能力，保持既有配置入口公开表面；实现位于 Bazaar README 子域。 */
export {openBazaarReadme} from "./bazzar/readme/openReadme";

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
        init: (model: CustomDomain) => {
            const tab = model.tab;
            const app = createApp(fileTreeConfigPanel);
            if (tab) {
                app.mount(tab.panelElement);
            }
        },
    });
};

/**
 * 初始化设置对话框元素（事件绑定、搜索注册等）
 * @param dialog 对话框实例
 * @param app 应用实例
 * @param initialTab 初始标签页
 */
const initSettingDialogElement = (dialog: Dialog, app: AppFacade, initialTab: TSettingTab) => {
    const tabWrap = dialog.element.querySelector(".config__tab-wrap");
    if (!isHTMLElement(tabWrap)) {
        return;
    }
    bindSettingSaveDelegation(tabWrap);
    initSettingSearch(dialog.element, app);
    const container = dialog.element.querySelector(".b3-dialog__container");
    if (isHTMLElement(container)) {
        container.style.maxWidth = "1280px";
    }
    const tabDefs = getSettingTabDefs();
    const items = dialog.element.querySelectorAll(".config__side .b3-list-item");
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const def = tabDefs[i];
        if (!def || !isHTMLElement(item)) {
            continue;
        }
        // 兼容社区 JS 代码片段模拟点击，不做事件委托
        item.addEventListener("click", () => {
            switchSettingTab(dialog.element, app, def.id);
        });
    }
    switchSettingTab(dialog.element, app, initialTab);
};

const openSettingDialog = (app: AppFacade, initialTab: TSettingTab = "editor") => {
    registerFileTreeTab();
    window.siyuan.dialogs.find((item) => item.element.querySelector(".config__tab-container"))?.destroy();
    const selection = getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : undefined;
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
                <span class="b3-list-item__text">${window.siyuan.languages?.config ?? ""}</span>
            </div>
            <input placeholder="${window.siyuan.languages?.search ?? ""}" class="b3-text-field fn__block">
        </div>
        <ul class="config__tab-scroll">
            ${tabListItems.join("")}
        </ul>
    </div>
    <div class="config__tab-wrap">
        ${tabPanels.join("")}
    </div>
</div>`,
        width: "max(70vw, min(90vw, 900px))",
        height: "90vh",
        destroyCallback() {
            clearSyncTabElement();
            clearAccessTabElement();
            if (range) {
                focusByRange(range);
            }
        },
        // 设置面板没有模态语义，打开期间仍应能操作主界面；透明穿透遮罩不承担关闭动作。
        // 退出统一交给 Dialog 的显式关闭按钮和全局 Esc 路径。
        transparent: true,
        disableScrimClose: true,
        scrimPointerEvents: true,
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_SETTING);
    initSettingDialogElement(dialog, app, initialTab);
    return dialog;
};

/** 打开移动端设置菜单，并在调用方指定 Tab 时延迟激活对应菜单项。 */
const openMobileSetting = (tab?: TSettingTab) => {
    popMenu();
    // 未指定 Tab 时保留移动设置菜单的默认选中状态。
    if (!tab) {
        return;
    }
    document.getElementById(settingTabToMenuId(tab))?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
};

export const openSetting = (app: AppFacade, tab?: TSettingTab) => {
    if (isMobile) {
        openMobileSetting(tab);
        return;
    }
    return openSettingDialog(app, tab);
};
