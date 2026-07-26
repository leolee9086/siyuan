import { Constants } from "./constants";
import { Menus } from "./menus";
import { Model } from "./layout/Model";
import { onGetConfig } from "./boot/onGetConfig";
import { initBlockPopover } from "./block/popover";
import { onSetaccount } from "./config/tabs/accountUi";
import { addScript, addScriptSync } from "./protyle/util/addScript";
import { genUUID } from "./util/platform/genID";
import { fetchGet, fetchPost } from "./util/network/fetch";
import { addBaseURL, redirectToCheckAuth, setNoteBook } from "./util/file/pathName";
import {exportLayout} from "./layout/export/exportLayout";
// S-forge: 上游新增 - 支持空文档标题显示 (upstream #17110)
import { getDocDisplayName, parseSiYuanUriInfo } from "./util/pathName";
import { registerServiceWorker } from "./util/network/serviceWorker";
import { openFileById } from "./editor/utils.openFileById";
import {activateQueuedAVLocate, queueAVLocateRequest} from "./protyle/render/av/locate";
import {activateOnboarding, ensureOnboarding} from "./onboarding";
import {
    bootSync,
    kernelError,
    processSync,
    progressBackgroundTask,
    progressLoading,
    progressStatus,
    setDefRefCount,
    transactionError
} from "./dialog/processSystem";
import { downloadProgress } from "./dialog/processSystem/downloadProgress";
import { setTitle } from "./util/processTitle";
import { reloadSync } from "./dialog/processSystem/reloadSync";
import { setRefDynamicText } from "./dialog/processSystem/setRefDynamicText";
import { hideMessage, initMessage, showMessage } from "./dialog/message";
import { confirmDialog } from "./dialog/confirmDialog";
import { getAllModels, getAllTabs } from "./layout/getAll";
// S-forge: 添加远程新增的 isInMobileApp 导入
import { getLocalStorage, isChromeBrowser, isInMobileApp } from "./protyle/util/compatibility";
import { checkPublishServiceClosed, createProcessMessage, setProcessMessageUIDependencies } from "./util/network/processMessage";
import { hideAllElements } from "./protyle/ui/hideElements";
import { addPluginDock, loadPlugins, reloadPlugin, reloadPluginData } from "./plugin/loader";
import "./assets/scss/base.scss";
// 注册导出预览页签类型（需要在布局恢复前完成注册）
import "./export-preview/register";
// 注册集市广场/发布设置页签类型
import "./bazaar-hub/register";
// 注册 MAGI Identity Access 页签类型
import "./magi/identity-access/adapters/register";
import { isBrowser, isBrowserDesktop } from "./platform";
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
import { registerProtyleDialogPort } from "./dialog/protyleDialogPort.factory";
import { configureWndDragRestore } from "./layout/Wnd.drag.port";
import { JSONToCenter } from "./layout/layout-deserialization";
import { Wnd } from "./layout/Wnd";
/** 用途：为完整 App 实例附加 AppFacade 厂牌；使用范围：应用组合根与下层宿主类型边界；解耦评估：仅导入稳定厂牌值，不反向加载具体业务实现。 */
import {appFacadeBrand} from "./app/AppFacade.types";
import type {AppSiYuanBlockNavigation} from "./app/AppFacade.types";
import type * as Siyuan from "siyuan";
import type {AssetOpenOptions} from "./asset/open/openAsset.types";
import {openAsset} from "./asset/open/openAsset";
import {processSiYuanUri} from "./editor/uri/processSiYuanUri";

export class App {
    readonly [appFacadeBrand] = "AppFacade" as const;
    public plugins: Siyuan.Plugin[] = [];
    public appId: string;
    public eventBus: EventBus;
    public pluginHost = {
        reloadData: (plugin: Siyuan.Plugin) => reloadPluginData(this, plugin),
        addDock: (plugin: Siyuan.Plugin) => addPluginDock(plugin),
    };
    public openAsset(options: AssetOpenOptions) {
        openAsset(this, options);
    }
    public openSiYuanBlock(options: AppSiYuanBlockNavigation) {
        void openFileById({app: this, ...options});
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
                        case "setSnippet":
                            window.siyuan.config.snippet = data.data;
                            renderSnippet();
                            break;
                        case "setDefRefCount":
                            setDefRefCount(data.data);
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
                                void activateOnboarding(this, window.siyuan.config.onboarding);
                            }
                            break;
                        case "onboarding":
                            void activateOnboarding(this, data.data);
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
                            if ((window.siyuan.config.appearance.mode === 1 && window.siyuan.config.appearance.themeDark !== "midnight") || (window.siyuan.config.appearance.mode === 0 && window.siyuan.config.appearance.themeLight !== "daylight")) {
                                (document.getElementById("themeStyle") as HTMLLinkElement).href = data.data.theme;
                            } else {
                                (document.getElementById("themeDefaultStyle") as HTMLLinkElement).href = data.data.theme;
                            }
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
                        case "notebookSortChanged": {
                            const fileDock = getDockByType("file");
                            if (fileDock) {
                                (fileDock.data.file as Files).onNotebookSortChanged();
                            }
                            break;
                        }
                        case "exit":
                            if (isBrowser && !isInMobileApp()) {
                                window.location.href = "about:blank";
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
            reqIds: {},
            backStack: [],
            layout: {},
            dialogs: [],
            blockPanels: [],
            closedTabs: [],
            ctrlIsPressed: false,
            altIsPressed: false,
            // 上游: 修复重复 WebSocket 连接 bug - 使用 mainWs 替代重复创建
            ws: mainWs,
        };
        this.eventBus = (window as any).globalEventBus;
        this.eventBus.emit("app-ready");
        fetchPost("/api/system/getConf", {}, async (response) => {
            addScriptSync(`${Constants.PROTYLE_CDN}/js/lute/lute.min.js?v=${Constants.SIYUAN_VERSION}`, "protyleLuteScript");
            addScript(`${Constants.PROTYLE_CDN}/js/protyle-html.js?v=${Constants.SIYUAN_VERSION}`, "protyleWcHtmlScript");
            window.siyuan.config = response.data.conf;
            window.siyuan.isPublish = response.data.isPublish;
            setBodyHighlight();
            await loadPlugins(this);
            // 初始化笔记内插件
            const { inNotePluginManager } = await import("./inNotePlugin");
            await inNotePluginManager.init(this);
            getLocalStorage(() => {
                fetchGet(`/appearance/langs/${window.siyuan.config?.appearance.lang}.json?v=${Constants.SIYUAN_VERSION}`, async (lauguages: IObject) => {
                    window.siyuan.languages = lauguages;
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
                            initMessage();
                            if (isBrowserDesktop && !isInMobileApp() && !window.siyuan.config.readonly && !window.siyuan.isPublish && !isChromeBrowser()
                                && window.siyuan.config.appearance.notifications?.browserCompatibility !== false) {
                                showMessage(window.siyuan.languages.useChrome, 0, "error");
                            }
                        });
                    });
                });
            });
        });
        setNoteBook();
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
                    activateQueuedAVLocate(protyle, blockInfo.id);
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
