import { Constants } from "./constants";
import { Menus } from "./menus";
import { Model } from "./layout/Model";
import { onGetConfig } from "./boot/onGetConfig";
import { initBlockPopover } from "./block/popover";
import { account } from "./config/account";
import { addScript, addScriptSync } from "./protyle/util/addScript";
import { genUUID } from "./util/platform/genID";
import { fetchGet, fetchPost } from "./util/network/fetch";
import { addBaseURL, getIdFromSYProtocol, isSYProtocol, redirectToCheckAuth, setNoteBook } from "./util/file/pathName";
import { exportLayout } from "./layout/layout-serialization";
// S-forge: 上游新增 - 支持空文档标题显示 (upstream #17110)
import { getDocDisplayName } from "./util/pathName";
import { registerServiceWorker } from "./util/network/serviceWorker";
import { openFileById } from "./editor/utils.openFileById";
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
import { setTitle } from "./dialog/processSystem/setTitle";
import { reloadSync } from "./dialog/processSystem/reloadSync";
import { setRefDynamicText } from "./dialog/processSystem/setRefDynamicText";
import { hideMessage, initMessage, showMessage } from "./dialog/message";
import { confirmDialog } from "./dialog/confirmDialog";
import { getAllModels, getAllTabs } from "./layout/getAll";
// S-forge: 添加远程新增的 isInMobileApp 导入
import { getLocalStorage, isChromeBrowser, isInMobileApp } from "./protyle/util/compatibility";
import { getSearch } from "./util/platform/functions";
import { checkPublishServiceClosed, createProcessMessage, setProcessMessageUIDependencies } from "./util/network/processMessage";
import { hideAllElements } from "./protyle/ui/hideElements";
import { loadPlugins, reloadPlugin } from "./plugin/loader";
import "./assets/scss/base.scss";
// 注册导出预览页签类型（需要在布局恢复前完成注册）
import "./export-preview/register";
// 注册集市广场/发布设置页签类型
import "./bazaar-hub/register";
import { isBrowser, isBrowserDesktop } from "./platform";
import { ipcSend } from "./platform/electron/ipcRenderer";
import { reloadEmoji } from "./emoji";
import { processIOSPurchaseResponse } from "./util/platform/iOSPurchase";
import { getDockByType } from "./layout/tabUtil";
import { Tag } from "./layout/dock/Tag";
import { EventBus } from "./plugin/EventBus";
import { siyuanI18n } from "./util/siyuanEnvironments/i18n.getI18n.environment";
import { updateAppearance } from "./config/util/updateAppearance";
import { renderSnippet } from "./config/util/snippets";
import { embeddingText } from "./util/lib/embedding/transformer";
import { setSForgeState } from "./config/sforge.global";
import { SForgeSymbols } from "./config/sforge.symbols";
import { setBodyHighlight } from "./util/assets/assets";
import type { Plugin } from "./plugin";

export class App {
    public plugins: Plugin[] = [];
    public appId: string;
    public eventBus: EventBus;
    constructor() {
        if (checkPublishServiceClosed()) {
            return;
        }
        registerServiceWorker(`${Constants.SERVICE_WORKER_PATH}?v=${Constants.SIYUAN_VERSION}`);
        addBaseURL();

        setProcessMessageUIDependencies({ exportLayout, showMessage, hideMessage, confirmDialog });
        const processMessage = createProcessMessage({ fetchPost });
        // 注册 Model WebSocket 处理器，打断 Model ↔ processSystem/processMessage 循环依赖
        setSForgeState(SForgeSymbols.MODEL_HANDLERS, { processMessage, kernelError, reloadSync });

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
                            updateAppearance(data.data);
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
                        case "exit":
                            if (isBrowser() && !isInMobileApp()) {
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
                    fetchPost("/api/setting/getCloudUser", {}, userResponse => {
                        window.siyuan.user = userResponse.data;
                        onGetConfig(response.data.start, this);
                        account.onSetaccount();
                        // S-forge: 上游改进 - 支持设置空文档标题 (#17110)
                        setTitle("", true);
                        initMessage();
                        // 浏览器桌面端检查是否使用 Chrome，非 Chrome 时提示用户
                        if (isBrowserDesktop && !isInMobileApp() && !window.siyuan.config.readonly && !window.siyuan.isPublish && !isChromeBrowser()) {
                            showMessage(window.siyuan.languages.useChrome, 0, "error");
                        }
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
    if (openURL && isSYProtocol(openURL)) {
        const isZoomIn = getSearch("focus", openURL) === "1";
        openFileById({
            app: siyuanApp,
            id: getIdFromSYProtocol(openURL),
            action: isZoomIn ? [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS] : [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL],
            zoomIn: isZoomIn
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
} else {
    ipcSend(Constants.SIYUAN_READY_TO_SHOW);
}
console.log(embeddingText("测试"));
