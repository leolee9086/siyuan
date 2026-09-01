import { Constants } from "./constants";
import { Menus } from "./menus";
import { Model } from "./layout/Model";
import { onGetConfig } from "./boot/onGetConfig";
import { initBlockPopover } from "./block/popover";
import { onSetaccount } from "./config/tabs/accountRuntime";
import { addScript, addScriptSync } from "./protyle/util/addScript";
import { genUUID } from "./util/platform/genID";
import { fetchPost } from "./util/network/fetch";
import { addBaseURL, redirectToCheckAuth, setNoteBook } from "./util/file/pathName";
import {exportLayout} from "./layout/export/exportLayout";
// S-forge: 上游新增 - 支持空文档标题显示 (upstream #17110)
import {getDocDisplayName} from "./util/file/pathName";
import {parseSiYuanUriInfo} from "./util/uri/protocol";
import { registerServiceWorker } from "./util/network/serviceWorker";
import { openFileById } from "./editor/utils.openFileById";
import {activateQueuedAVLocate, queueAVLocateRequest} from "./protyle/render/av/locate/activation/activation";
import {avRender} from "./protyle/render/av/render";
import {ensureOnboarding} from "./onboarding/common";
import {activateDesktopOnboarding} from "./onboarding/desktop";
import {
    bootSync,
    processSync,
    progressBackgroundTask,
    progressLoading,
    progressStatus,
    processBacklinkIndexCommit,
    setDefRefCount,
    transactionError
} from "./dialog/processSystem";
import {kernelError} from "./util/kernelFault";
import { downloadProgress } from "./dialog/processSystem/downloadProgress";
import { setTitle } from "./util/processTitle";
import { reloadSync } from "./dialog/processSystem/reloadSync";
import { setRefDynamicText } from "./dialog/processSystem/setRefDynamicText";
import {scheduleBacklinkRefresh} from "./layout/dock/backlink/backlinkRefresh";
import { hideMessage, initMessage, showMessage } from "./dialog/message";
import { confirmDialog } from "./dialog/confirmDialog";
import {getAllEditor, getAllModels, getAllTabs} from "./layout/getAll";
// S-forge: 添加远程新增的 isInMobileApp 导入
import { getLocalStorage, isChromeBrowser, isInMobileApp } from "./protyle/util/compatibility";
import { checkPublishServiceClosed, createProcessMessage, setProcessMessageUIDependencies } from "./util/network/processMessage";
import { hideAllElements } from "./protyle/ui/hideElements";
import { addPluginDock, loadPlugins, reloadPlugin, reloadPluginData } from "./plugin/loader";
import "./assets/scss/base.scss";
import "./config/assetsPlugin";
// 注册导出预览页签类型（需要在布局恢复前完成注册）
import "./export-preview/register";
// 注册集市广场/发布设置页签类型
import "./bazaar-hub/register";
// 注册 MAGI Identity Access 页签类型
import "./magi/identity-access/adapters/register";
import { isBrowser, isBrowserDesktop, isElectron } from "./platform";
import { ipcSend } from "./platform/electron/ipcRenderer";
import { reloadEmoji } from "./emoji";
import { processIOSPurchaseResponse } from "./util/platform/iOSPurchase";
import { getDockByType } from "./layout/tabUtil";
import { Files } from "./layout/dock/Files";
import { Tag } from "./layout/dock/Tag";
import { EventBus } from "./plugin/EventBus";
import { appearanceConfigApi } from "./config/tabs/appearanceRuntime";
import { renderSnippet } from "./config/util/snippets";
import { registerModelHandlers } from "./layout/modelRegistry";
import { setBodyHighlight } from "./util/assets/assets";
// 上游新增导入：服务器地址推送、主题与内联样式刷新、布局兜底、入口可见性、块面板编辑器清理
import {updateServerAddresses} from "./config/tabs/accessRuntime";
import {refreshThemeStyle, reloadInlineStyles} from "./util/assets/assets";
import {ensureUILayout} from "./util/ensureUILayout";
import {applyEntryVisibility} from "./config/entryVisibility/runtime";
import {removeBlockPanelEditors} from "./block/panelRemoval";
import { registerProtyleDialogPort } from "./dialog/protyleDialogPort.factory";
import { configureWndDragRestore } from "./layout/Wnd.drag.port";
import { JSONToCenter } from "./layout/layout-deserialization";
import { Wnd } from "./layout/Wnd";
/** 用途：为完整 App 实例附加 AppFacade 厂牌；使用范围：应用组合根与下层宿主类型边界；解耦评估：仅导入稳定厂牌值，不反向加载具体业务实现。 */
import {appFacadeBrand} from "./app/AppFacade.types";
import type {AppBlockNavigation} from "./app/AppFacade.types";
import type {AppDatabaseRowNavigation} from "./app/AppFacade.types";
import type {AppTabNavigation} from "./app/AppFacade.types";
import type {AppFacade} from "./app/AppFacade.types";
import type * as Siyuan from "siyuan";
import type {AssetOpenOptions} from "./asset/open/openAsset.types";
import {openAsset} from "./asset/open/openAsset";
import {processSiYuanUri} from "./editor/uri/processSiYuanUri";
import {openDatabaseRowBlock} from "./editor/open/databaseRow/openDatabaseRowBlock";
import {openDesktopDatabaseRow} from "./editor/open/databaseRow/openDatabaseRow";
import {Protyle} from "./protyle";
import type {ProtyleDomain} from "./protyle/protyle.types";
import {openFile} from "./editor/open/openFile";
import {toggleApplicationFullscreen} from "./app/fullscreen/toggleApplicationFullscreen";
import {newFile, newFileInTree} from "./util/file/newFile";
import {removeProtyleTab} from "./protyle/runtime/layout.port";
import {createInNotePluginManager} from "./inNotePlugin/manager/InNotePluginManager.factory";
import type {InNotePluginManagerDomain} from "./inNotePlugin/manager/inNotePluginManager.types";
import {openGlobalSearch as openGlobalSearchInApp} from "./search/global/openGlobalSearch";
import {openSearch} from "./search/spread";
import {openSetting} from "./config";
/** 用途：注册桌面原生 Agent capability 的实际 UI owner。使用范围：桌面 App 组合根初始化。解耦评估：Agent registry 不反向导入主应用模块。 */
import {registerDesktopNativeCapabilityEffects} from "./layout/dock/agent/runtime/host/frontendCapabilities.desktop.factory";
import {globalCommand} from "./boot/globalEvent/command/global";
import type {SettingTabId} from "./config/setting/setting.types";
import type {IDialog} from "./dialog/dialog.types";
import {loadSiyuanLanguages} from "./util/siyuanEnvironments/languages/environment";
import {escapeHtml} from "./util/DOM/escape";
import {initForgeRuntimeControl} from "./sforge/forgeRuntime";
import {createForgeRuntimeRecoveryURL} from "./sforge/forgeRuntime/exitContinuity";
import {
    reloadForgeRuntimeElectronInterface,
    startForgeRuntimeElectronContinuity,
} from "./sforge/forgeRuntime/electronContinuity";
import {getSForgeState} from "./config/sforge.global";
import {FORGE_RUNTIME_CONTROL} from "./config/sforge.symbols";
import type {ForgeRuntimeElectronContinuityResult} from "./sforge/forgeRuntime/types";
import {installAppConfiguration} from "./boot/installAppConfiguration";

const forgeRuntimeElectronContinuityMessageID = "forgeRuntimeElectronContinuity";

// 桌面组合根持有这些 UI owner；通过 HMR 稳定槽交给 Agent capability factory，不让 registry 反向形成依赖。
registerDesktopNativeCapabilityEffects({
    constants: Constants,
    getAllEditor,
    openFileById,
    openSearch,
    openSetting,
});

/** 将 Electron 接续终态转换为主界面可观察的错误信息。 */
const describeForgeRuntimeElectronContinuityResult = (result: ForgeRuntimeElectronContinuityResult): string => {
    switch (result.state) {
        case "rolled_back":
            return `Kernel 热替换已回滚：${result.detail}`;
        case "failed":
            return `Kernel 热替换失败：${result.detail}`;
        case "rejected":
            return `Kernel 热替换被控制面拒绝：${result.detail}`;
        case "timed_out":
            return `Kernel 热替换等待超时：${result.detail}`;
        default:
            return "";
    }
};

/** Electron 收到结构化 Forge 退出事件后独立接续；普通退出不进入此流程。 */
const handleForgeRuntimeElectronExit = (value: unknown): void => {
    let continuity: ReturnType<typeof startForgeRuntimeElectronContinuity>;
    try {
        continuity = startForgeRuntimeElectronContinuity(value, {
            onPhase: (_phase, detail) => {
                const suffix = detail ? `：${detail}` : "";
                showMessage(`Forge Runtime 正在接续 Kernel${suffix}`, 0, "info", forgeRuntimeElectronContinuityMessageID);
            },
        });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.error("[Forge Runtime] Electron 接续初始化失败", error);
        showMessage(`Kernel 热替换接续初始化失败：${detail}`, 8000, "error", forgeRuntimeElectronContinuityMessageID);
        return;
    }
    if (!continuity) {
        return;
    }
    const control = getSForgeState(FORGE_RUNTIME_CONTROL);
    control?.pauseForKernelRestart();
    void continuity.then((result) => {
        void hideMessage(forgeRuntimeElectronContinuityMessageID);
        if (result.state === "completed") {
            reloadForgeRuntimeElectronInterface();
            return;
        }
        control?.resumeAfterKernelRestart();
        showMessage(describeForgeRuntimeElectronContinuityResult(result), 8000, "error",
            `${forgeRuntimeElectronContinuityMessageID}Outcome`);
    }, (error: unknown) => {
        void hideMessage(forgeRuntimeElectronContinuityMessageID);
        control?.resumeAfterKernelRestart();
        const detail = error instanceof Error ? error.message : String(error);
        console.error("[Forge Runtime] Electron 接续失败", error);
        showMessage(`Kernel 热替换接续失败：${detail}`, 8000, "error",
            `${forgeRuntimeElectronContinuityMessageID}Outcome`);
    });
};

export class App {
    readonly [appFacadeBrand] = "AppFacade" as const;
    public plugins: Siyuan.Plugin[] = [];
    public appId: string;
    public eventBus: EventBus;
    public inNotePluginManager: InNotePluginManagerDomain<AppFacade> = createInNotePluginManager();
    public pluginHost = {
        reloadData: (plugin: Siyuan.Plugin) => reloadPluginData(this, plugin),
        addDock: (plugin: Siyuan.Plugin) => addPluginDock(plugin),
    };
    /** @显式返回类型原因：App 公开表面必须固定为完整 ProtyleDomain，避免向下层泄露具体 class。 */
    public createProtyle(element: HTMLElement, options: IProtyleOptions): ProtyleDomain {
        return new Protyle(this, element, options);
    }
    public getOpenEditors() {
        return getAllEditor();
    }
    public getOpenModels() {
        return getAllModels();
    }
    public openSettings(tab?: SettingTabId): IDialog | undefined {
        return openSetting(this, tab);
    }
    public globalCommand(command: string): boolean {
        return globalCommand(command, this);
    }
    public openSearch(query?: string) {
        const options = query === undefined
            ? {app: this, hotkey: Constants.DIALOG_GLOBALSEARCH}
            : {app: this, hotkey: Constants.DIALOG_GLOBALSEARCH, key: query};
        return openSearch(options);
    }
    public createDocument(name?: string) {
        return newFile(this, name);
    }
    public createDocumentInTree(notebookId: string, currentPath: string, paths?: string[]) {
        return newFileInTree(this, notebookId, currentPath, paths);
    }
    public handleUnavailableDocument(protyle: IProtyle) {
        if (protyle.model) {
            removeProtyleTab(protyle);
        }
    }
    public toggleFullscreen(element: Element, button?: Element) {
        toggleApplicationFullscreen(element, button);
    }
    public openGlobalSearch(text: string, replace: boolean, searchData?: Config.IUILayoutTabSearchConfig) {
        openGlobalSearchInApp(this, {text, replace, searchData});
    }
    public openTab(options: AppTabNavigation) {
        return openFile({app: this, ...options});
    }
    public openAsset(options: AssetOpenOptions) {
        openAsset(this, options);
    }
    public openBlock(options: AppBlockNavigation) {
        if (options.databaseRowId) {
            openDatabaseRowBlock(this, options);
            return;
        }
        return openFileById({app: this, ...options});
    }
    public openDatabaseRow(_protyle: IProtyle, options: AppDatabaseRowNavigation) {
        openDesktopDatabaseRow(this, options);
    }
    public processSiYuanUri(uri: string) {
        return processSiYuanUri(this, uri);
    }

    constructor() {
        configureWndDragRestore((app, data, target) => {
            if (target instanceof Wnd) {
                JSONToCenter(app, data, target);
            }
        });
        // Protyle 通过 Port 请求完整 App 的 Dialog 能力，原版插件仍继续使用原有 Dialog/EventBus。
        registerProtyleDialogPort();
        if (checkPublishServiceClosed()) {
            return;
        }
        registerServiceWorker(`${Constants.SERVICE_WORKER_PATH}?v=${Constants.SIYUAN_VERSION}`);
        addBaseURL();

        setProcessMessageUIDependencies({ exportLayout, showMessage, hideMessage, confirmDialog });
        const processMessage = createProcessMessage({ fetchPost });
        // 注册 Model WebSocket 处理器，打断 Model ↔ processSystem/processMessage 循环依赖
        registerModelHandlers({ processMessage, kernelError, reloadSync: (data) => reloadSync(this, data) });

        this.appId = Constants.SIYUAN_APPID;

        const mainWs = new Model({app: this});
        mainWs.connect({
            id: genUUID(),
            type: "main",
            msgCallback: (data) => {
                this.plugins.forEach((plugin) => {
                    plugin.eventBus.emit("ws-main", data);
                });
                if (data) {
                    switch (data.cmd) {
                        case "logoutAuth":
                            redirectToCheckAuth();
                            break;
                        case "setAppearance":
                            appearanceConfigApi.apply(data.data);
                            break;
                        case "reloadInlineStyles":
                            void reloadInlineStyles();
                            break;
                        case "setEntryVisibility":
                            applyEntryVisibility(data.data);
                            break;
                        case "setSnippet":
                            window.siyuan.config.snippet = data.data;
                            renderSnippet();
                            break;
                        case "setDefRefCount":
                            setDefRefCount(data.data);
                            break;
                        case "transactions":
                            scheduleBacklinkRefresh("transactions");
                            break;
                        case "databaseIndexCommit":
                            processBacklinkIndexCommit(data.data);
                            break;
                        case "reloadTag":
                            if (getDockByType("tag")?.data.tag instanceof Tag) {
                                (getDockByType("tag").data.tag as Tag).update();
                            }
                            break;
                        case "setRefDynamicText":
                            setRefDynamicText(data.data);
                            break;
                        case "reloadPlugin":
                            reloadPlugin(this, data.data);
                            break;
                        case "reloadEmojiConf":
                            reloadEmoji();
                            break;
                        case "syncMergeResult":
                            reloadSync(this, data.data);
                            break;
                        case "reloaddoc":
                            reloadSync(this, {upsertRootIDs: [data.data], removeRootIDs: []}, false, false, true);
                            break;
                        case "readonly":
                            window.siyuan.config.editor.readOnly = data.data;
                            hideAllElements(["util"]);
                            break;
                        case "setConf":
                            window.siyuan.config = data.data;
                            break;
                        case "setServerAddrs":
                            updateServerAddresses(data.data);
                            break;
                        case "setPublish":
                            window.siyuan.config.publish = data.data;
                            if (!window.siyuan.config.publish.enable) {
                                getAllModels().files.forEach(item => {
                                    item.element.classList.remove("file-tree__publish-access--active");
                                    item.element.querySelectorAll(".b3-list-item__icon").forEach(iconItem => {
                                        iconItem.classList.remove("fn__none");
                                        iconItem.nextElementSibling.classList.add("fn__none");
                                    });
                                });
                            }
                            break;
                        case "progress":
                            progressLoading(data);
                            break;
                        case "setLocalStorageVal":
                            if (window.siyuan.storage) {
                                window.siyuan.storage[data.data.key] = data.data.val;
                            }
                            break;
                        case "setLocalStorageVals":
                            Object.keys(data.data.keyVals).forEach((k) => {
                                window.siyuan.storage[k] = data.data.keyVals[k];
                            });
                            break;
                        case "removeLocalStorageVal":
                            delete window.siyuan.storage[data.data.key];
                            break;
                        case "removeLocalStorageVals":
                            data.data.keys.forEach((k: string) => {
                                delete window.siyuan.storage[k];
                            });
                            break;
                        case "rename":
                            scheduleBacklinkRefresh("rename");
                            getAllTabs().forEach((tab) => {
                                if (tab.headElement) {
                                    const initTab = tab.headElement.getAttribute("data-initdata");
                                    if (initTab) {
                                        const initTabData = JSON.parse(initTab);
                                        if (initTabData.instance === "Editor" && initTabData.rootId === data.data.id) {
                                            tab.updateTitle(getDocDisplayName(data.data.title, data.data.empty));
                                        }
                                    }
                                }
                            });
                            break;
                        case "closeBox":
                        case "removeBox":
                            removeBlockPanelEditors({notebookId: data.data.box});
                            getAllTabs().forEach((tab) => {
                                if (tab.headElement) {
                                    const initTab = tab.headElement.getAttribute("data-initdata");
                                    if (initTab) {
                                        const initTabData = JSON.parse(initTab);
                                        if (initTabData.instance === "Editor" && data.data.box === initTabData.notebookId) {
                                            tab.parent.removeTab(tab.id);
                                        }
                                    }
                                }
                            });
                            break;
                        case "removeDoc":
                            removeBlockPanelEditors({rootIDs: data.data.ids});
                            getAllTabs().forEach((tab) => {
                                if (tab.headElement) {
                                    const initTab = tab.headElement.getAttribute("data-initdata");
                                    if (initTab) {
                                        const initTabData = JSON.parse(initTab);
                                        if (initTabData.instance === "Editor" && data.data.ids.includes(initTabData.rootId)) {
                                            tab.parent.removeTab(tab.id);
                                        }
                                    }
                                }
                            });
                            if (window.siyuan.config.onboarding?.newUser && !window.siyuan.config.onboarding.dismissed &&
                                data.data.ids.includes(window.siyuan.config.onboarding.documentID)) {
                                void activateDesktopOnboarding(this, window.siyuan.config.onboarding);
                            }
                            break;
                        case "onboarding":
                            void activateDesktopOnboarding(this, data.data);
                            break;
                        case "statusbar":
                            progressStatus(data);
                            break;
                        case "downloadProgress":
                            downloadProgress(data.data);
                            break;
                        case "txerr":
                            transactionError(data.msg);
                            break;
                        case "syncing":
                            processSync(data, this.plugins);
                            break;
                        case "backgroundtask":
                            progressBackgroundTask(data.data.tasks);
                            break;
                        case "refreshtheme":
                            refreshThemeStyle(data.data.theme);
                            break;
                        case "openFileById":
                            openFileById({app: this, id: data.data.id, action: [Constants.CB_GET_FOCUS]});
                            break;
                        case "filetreeSortChanged": {
                            const fileDock = getDockByType("file");
                            if (fileDock) {
                                (fileDock.data.file as Files).onFiletreeSortChanged(data.data);
                            }
                            break;
                        }
                        case "docSortModeChanged": {
                            const fileDock = getDockByType("file");
                            if (fileDock) {
                                (fileDock.data.file as Files).onDocSortModeChanged(data.data);
                            }
                            break;
                        }
                        case "notebookSortChanged": {
                            const fileDock = getDockByType("file");
                            if (fileDock) {
                                (fileDock.data.file as Files).onNotebookSortChanged();
                            }
                            break;
                        }
                        case "exit":
                            if (isBrowser && !isInMobileApp()) {
                                try {
                                    const recoveryURL = createForgeRuntimeRecoveryURL(data.data, window.location.href);
                                    if (recoveryURL) {
                                        window.location.replace(recoveryURL);
                                    } else {
                                        window.location.href = "about:blank";
                                    }
                                } catch (error) {
                                    console.error("Forge Runtime recovery page initialization failed", error);
                                    window.location.href = "about:blank";
                                }
                            } else if (isElectron) {
                                handleForgeRuntimeElectronExit(data.data);
                            }
                            break;
                        case "updateKernelPluginState": {
                            const {name, state} = data.data as { name: string, state: TKernelPluginState };
                            const plugin = this.plugins.find(p => p.name === name);
                            if (plugin) {
                                plugin.kernel.state.code = state;
                            }
                            break;
                        }
                    }
                }
            }
        });

        window.siyuan = {
            zIndex: 10,
            transactions: [],
            isReady: false,
            notebooks: [],
            reqIds: {},
            backStack: [],
            layout: {},
            dialogs: [],
            blockPanels: [],
            closedTabs: [],
            ctrlIsPressed: false,
            altIsPressed: false,
            languages: {},
            // 上游: 修复重复 WebSocket 连接 bug - 使用 mainWs 替代重复创建
            ws: mainWs,
        };
        this.eventBus = (window as any).globalEventBus;
        this.eventBus.emit("app-ready");
        fetchPost("/api/system/getConf", {}, async (response) => {
            addScriptSync(`${Constants.PROTYLE_CDN}/js/lute/lute.min.js?v=${Constants.SIYUAN_VERSION}`, "protyleLuteScript");
            addScript(`${Constants.PROTYLE_CDN}/js/protyle-html.js?v=${Constants.SIYUAN_VERSION}`, "protyleWcHtmlScript");
            const config = installAppConfiguration(response.data.conf, response.data.isPublish, {startNotebookRefresh: false});
            // 配置注入后提前请求笔记本列表，插件初始化前等待其完成。
            const notebookPromise = setNoteBook();
            // 上游：配置注入后确保布局骨架存在；config/isPublish 由 installAppConfiguration 统一写入
            ensureUILayout();
            setBodyHighlight();
            await notebookPromise;
            await loadPlugins(this);
            await this.inNotePluginManager.init(this);
            await getLocalStorage();
            await loadSiyuanLanguages(config.appearance.lang);
                    // 加载 Forge 翻译
                    const { loadForgeI18n } = await import("./util/siyuanEnvironments/forgeI18n.getI18n.environment");
                    await loadForgeI18n();
                    // 初始化 S-Forge 扩展功能
                    const { initSForge } = await import("./config/sforge.init");
                    await initSForge({ isMobile: false });
                    // 初始化智能工具箱状态栏按钮
                    const { initSmartToolboxStatusButton } = await import("./sforge/panel");
                    initSmartToolboxStatusButton();
                    // 初始化 MAGI 状态栏按钮
                    const { initMagiStatusButton } = await import("./magi/panel/magiStatusButton");
                    initMagiStatusButton();
                    window.siyuan.menus = new Menus(this);
                    bootSync();
                    fetchPost("/api/setting/getCloudUser", {}, async userResponse => {
                        window.siyuan.user = userResponse.data;
                        await ensureOnboarding();
                        setNoteBook(() => {
                            onGetConfig(response.data.start, this);
                            onSetaccount();
                            setTitle("", true);
                            void initMessage().then(() => initForgeRuntimeControl()).catch((error) => {
                                console.error("[Forge Runtime] 主界面控制面初始化失败", error);
                                const message = error instanceof Error ? error.message : String(error);
                                showMessage(escapeHtml(message), 6000, "error", "forgeRuntimeInitializationError");
                            });
                            if (isBrowserDesktop && !isInMobileApp() && !window.siyuan.config.readonly && !window.siyuan.isPublish && !isChromeBrowser()
                                && window.siyuan.config.appearance.notifications?.browserCompatibility !== false) {
                                showMessage(window.siyuan.languages.useChrome, 0, "error");
                            }
                            // 上游：启动序列完成后置为就绪并冲刷排队的主通道消息
                            window.siyuan.isReady = true;
                            mainWs.flushMainMessages();
                        });
                    });
        });
        initBlockPopover(this);
    }
}
(window as any).globalEventBus = new EventBus(document);

const siyuanApp = new App();

window.openFileByURL = (openURL) => {
    const blockInfo = parseSiYuanUriInfo(openURL);
    if (blockInfo != null) {
        if (blockInfo.avItemID) {
            queueAVLocateRequest(blockInfo.id, {
                itemID: blockInfo.avItemID,
                viewID: blockInfo.avViewID,
                groupID: blockInfo.avGroupID,
            });
        }
        openFileById({
            app: siyuanApp,
            id: blockInfo.id,
            action: blockInfo.avItemID ? [Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL] :
                (blockInfo.focus ? [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS] : [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL]),
            zoomIn: blockInfo.avItemID ? false : blockInfo.focus,
            afterOpen: (model) => {
                const protyle = (model as { editor?: { protyle?: IProtyle } })?.editor?.protyle;
                if (protyle) {
                    activateQueuedAVLocate({renderAV: avRender, protyle, blockID: blockInfo.id});
                }
            },
        });
        return true;
    }
    return false;
};

if (isBrowser) {
    window.showKeyboardToolbar = () => {
        // 防止 Pad 端报错
    };
    window.processIOSPurchaseResponse = processIOSPurchaseResponse;
    // 桌面 bundle 运行在移动壳中时，将软键盘控制权交还给 WebView。
    if (window.JSAndroid?.setWebViewFocusable) {
        window.JSAndroid.setWebViewFocusable(true);
    } else if (window.JSHarmony?.setWebViewFocusable) {
        window.JSHarmony.setWebViewFocusable(true);
    }
} else {
    ipcSend(Constants.SIYUAN_READY_TO_SHOW);
}
