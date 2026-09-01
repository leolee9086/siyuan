import {popMenu} from "./imports";
import {isMobile} from "./imports";
import {initSettingSearch} from "./search/dialog";
import {switchSettingTab} from "./search/dialog";
import {bindSettingSaveDelegation} from "./setting/save";
import {Dialog} from "./imports";
import {Constants} from "./imports";
import {focusByRange} from "./imports";
import {unmountBazaarTab} from "./bazaarTab";
import {isBazaarAvailable} from "../util/bazaarAvailability";
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
/**
 * 作用：向 Vue Tab 注册表注册文件树配置面板。
 * 意图：把一次性注册限制在桌面运行时，避免 config、plugin registry 的初始化环重复挂载。
 * 调用时机：首次打开桌面设置对话框时。
 * 问题/改进：注册状态依赖模块生命周期，HMR 时由模块重载重新建立。
 */
const registerFileTreeTab = () => {
    if (_fileTreeTabRegistered || isMobile) {
        return;
    }
    _fileTreeTabRegistered = true;
    tabRegistry.register({
        type: INTERNAL_FILETREE_TAB_TYPE,
        /** 作用：创建文件树配置 Vue 根。意图：在真实 Tab 面板可用后再挂载，避免创建游离组件。调用时机：Tab registry 激活 fileTreeConfigPanel 时。问题/改进：面板元素由外部 registry 提供，缺失时无法挂载。 */
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
    // 自定义 Dialog 容器在极早销毁或测试替身中可能不存在，仅在真实 HTMLElement 上调整尺寸。
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

/** 作用：销毁设置对话框的动态页签资源并恢复先前选区。意图：把关闭生命周期从创建流程中分离，保持对话框构造函数聚焦装配。调用时机：设置 Dialog 销毁时。 */
const cleanupSettingDialog = (settingDialogRef: {element?: HTMLElement}, range: Range | undefined) => {
    const bazaarRoot = settingDialogRef.element?.querySelector('.config__tab-container[data-name="bazaar"]');
    // Bazaar 面板只在已挂载且仍连接到 Dialog DOM 时需要执行 Vue 卸载清理。
    if (isHTMLElement(bazaarRoot)) {
        unmountBazaarTab(bazaarRoot);
    }
    clearSyncTabElement();
    clearAccessTabElement();
    if (range) {
        focusByRange(range);
    }
};

/**
 * 作用：构造并打开桌面设置对话框。
 * 意图：将 Tab 壳、挂载、关闭清理集中在单个 Dialog 生命周期中。
 * 调用时机：桌面 `openSetting` 入口收到非移动端请求时。
 * 问题/改进：DOM 文本仍由模板字符串生成，后续可迁移为组件化壳层。
 */
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
    const settingDialogRef: {element?: HTMLElement} = {};
    const dialog = new Dialog({
        content: `<div class="fn__flex-1 fn__flex config__panel" style="overflow: hidden;position: relative">
    <div class="config__side b3-list b3-list--background">
        <div class="config__tab-head">
            <div class="config__tab-title resize__move">
                <svg class="b3-list-item__graphic"><use xlink:href="#iconSettings"></use></svg>
                <span class="b3-list-item__text">${window.siyuan.languages?.config ?? ""}</span>
            </div>
            <input placeholder="${window.siyuan.languages?.searchPlaceholder ?? ""}" class="b3-text-field fn__block">
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
        /** 作用：释放设置 Dialog 持有的页签资源并恢复选区。意图：避免 Bazaar Vue 根和页面选择范围在关闭后残留。调用时机：Dialog 销毁过程。问题/改进：清理顺序依赖 Dialog 保留 element 引用。 */
        destroyCallback() {
            cleanupSettingDialog(settingDialogRef, range);
        },
        // 设置面板没有模态语义，打开期间仍应能操作主界面；透明穿透遮罩不承担关闭动作。
        // 退出统一交给 Dialog 的显式关闭按钮和全局 Esc 路径。
        transparent: true,
        disableScrimClose: true,
        scrimPointerEvents: true,
    });
    settingDialogRef.element = dialog.element;
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

/**
 * 作用：根据当前平台打开设置界面。
 * 意图：为应用、快捷键和 Agent capability 提供同一稳定入口。
 * 调用时机：用户触发设置命令或 capability 请求设置面板时。
 * 问题/改进：Bazaar 在不可用环境中直接忽略请求，调用方不会收到 Dialog。
 */
export const openSetting = (app: AppFacade, tab?: TSettingTab) => {
    if (tab === "bazaar" && !isBazaarAvailable()) {
        return;
    }
    if (isMobile) {
        openMobileSetting(tab);
        return;
    }
    return openSettingDialog(app, tab);
};

/** Agent capability 通过具名全局槽读取设置入口，避免 Agent registry 反向加载本配置装配模块。 */
const agentOpenSettingCapabilityKey = Symbol.for("sforge.agent.frontendCapabilities.openSetting");
const didRegisterAgentOpenSetting = Reflect.set(globalThis, agentOpenSettingCapabilityKey, openSetting);
// 设置入口必须在 capability 执行前可用；写入失败时显式中断，避免静默丢失 Agent 操作。
if (!didRegisterAgentOpenSetting) {
    throw new Error("Unable to register agent open-setting capability");
}
