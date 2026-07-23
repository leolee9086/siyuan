import {popMenu} from "./imports";
import {isMobile} from "./imports";
import {initSettingSearch} from "./search/dialog";
import {switchSettingTab} from "./search/dialog";
import {bindSettingSaveDelegation} from "./setting/save";
import {Dialog} from "./imports";
import {Constants} from "./imports";
import {focusByRange} from "./imports";
import {escapeHtml, getFrontend, showMessage} from "./imports";
import {getSettingTabDefs, settingTabToMenuId} from "./setting/tabs";
import type {TSettingTab} from "./setting/tabs";
import {clearAccessTabElement} from "./tabs/accessRuntime";
import {clearSyncTabElement} from "./tabs/syncRuntime";
import {INTERNAL_FILETREE_TAB_TYPE} from "./fileTree";
import {fileTreeConfigPanel} from "./imports";
import {tabRegistry} from "./imports";
import {createApp} from "./imports";
import type {Custom} from "../layout/dock/Custom";
import {bazaar} from "./bazzar/bazaar";
import {fetchSyncPost} from "./imports";
import type {App} from "../index";
import {isHTMLElement} from "./imports";

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

/**
 * 初始化设置对话框元素（事件绑定、搜索注册等）
 * @param dialog 对话框实例
 * @param app 应用实例
 * @param initialTab 初始标签页
 */
const initSettingDialogElement = (dialog: Dialog, app: App, initialTab: TSettingTab) => {
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

const openSettingDialog = (app: App, initialTab: TSettingTab = "editor") => {
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

export const openSetting = (app: App, tab?: TSettingTab) => {
    if (isMobile) {
        openMobileSetting(tab);
        return;
    }
    return openSettingDialog(app, tab);
};

const BAZAAR_RESOURCES_URL: Record<"bazaar" | "downloaded", Record<TBazaarType, string>> = {
    bazaar: {
        templates: "/api/bazaar/getBazaarTemplate",
        icons: "/api/bazaar/getBazaarIcon",
        widgets: "/api/bazaar/getBazaarWidget",
        themes: "/api/bazaar/getBazaarTheme",
        plugins: "/api/bazaar/getBazaarPlugin",
    },
    downloaded: {
        templates: "/api/bazaar/getInstalledTemplate",
        icons: "/api/bazaar/getInstalledIcon",
        widgets: "/api/bazaar/getInstalledWidget",
        themes: "/api/bazaar/getInstalledTheme",
        plugins: "/api/bazaar/getInstalledPlugin",
    },
};

export const openBazaarReadme = async (app: App, bazaarType: TBazaarType, itemName: string, from: "bazaar" | "downloaded" = "bazaar") => {
    if (isMobile) {
        return;
    }
    // 未信任社区集市时只打开设置页，由用户先明确启用信任，不发起包内容请求。
    if (!window.siyuan.config.bazaar.trust) {
        openSettingDialog(app, "bazaar");
        return;
    }
    const getResourcesUrl = BAZAAR_RESOURCES_URL[from][bazaarType];
    if (!getResourcesUrl) {
        return;
    }

    const response = await fetchSyncPost(getResourcesUrl, {
        frontend: getFrontend(),
        keyword: itemName,
    });
    if (response.code !== 0) {
        return;
    }
    const packages: IBazaarItem[] = response.data.packages;
    const resource = packages.find((item: IBazaarItem) => item.name === itemName);
    if (!resource) {
        showMessage(`Package not found: ${escapeHtml(itemName)}`);
        return;
    }

    openSettingDialog(app, "bazaar");
    bazaar._renderReadme(bazaarType, resource, from === "downloaded");
};
