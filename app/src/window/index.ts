import { Constants } from "../constants";
import { Menus } from "../menus";
import { Model } from "../layout/Model";
import "../assets/scss/base.scss";
import { initBlockPopover } from "../block/popover";
import { addScript, addScriptSync } from "../protyle/util/addScript";
import { genUUID } from "../util/platform/genID";
import { fetchPost } from "../util/network/fetch";
import { addBaseURL, getDocDisplayName, redirectToCheckAuth, setNoteBook } from "../util/file/pathName";
import {exportLayout} from "../layout/export/exportLayout";
import { openFileById } from "../editor/utils.openFileById";
import {
    processSync,
    progressBackgroundTask,
    progressLoading,
    progressStatus,
    processBacklinkIndexCommit,
    setDefRefCount,
    transactionError
} from "../dialog/processSystem";
import {kernelError} from "../util/kernelFault";
import { setTitle } from "../util/processTitle";
import { reloadSync } from "../dialog/processSystem/reloadSync";
import { setRefDynamicText } from "../dialog/processSystem/setRefDynamicText";
import {scheduleBacklinkRefresh} from "../layout/dock/backlink/backlinkRefresh";
import { hideMessage, initMessage, showMessage } from "../dialog/message";
import { confirmDialog } from "../dialog/confirmDialog";
import { getAllTabs } from "../layout/getAll";
import { getLocalStorage } from "../protyle/util/compatibility";
import { init } from "./init";
import { loadPlugins, reloadPlugin } from "../plugin/loader";
import { hideAllElements } from "../protyle/ui/hideElements";
import { reloadEmoji } from "../emoji";
import { appearanceConfigApi } from "../config/tabs/appearanceRuntime";
import { renderSnippet } from "../config/util/snippets";
import { createProcessMessage, setProcessMessageUIDependencies } from "../util/network/processMessage";
import {loadSiyuanLanguages} from "../util/siyuanEnvironments/languages/environment";
import { refreshThemeStyle, reloadInlineStyles, setBodyHighlight } from "../util/assets/assets";
import { installAppConfiguration } from "../boot/installAppConfiguration";
import { ensureUILayout } from "../util/ensureUILayout";
import { applyEntryVisibility } from "../config/entryVisibility/runtime";
import { removeBlockPanelEditors } from "../block/panelRemoval";
import { updateServerAddresses } from "../config/tabs/accessRuntime";
import { setSForgeState } from "../config/sforge.global";
import { SForgeSymbols } from "../config/sforge.symbols";

class App {
    public plugins: import("../plugin").Plugin[] = [];
    public appId: string;

    constructor() {
        addBaseURL();
        this.appId = Constants.SIYUAN_APPID;
        setProcessMessageUIDependencies({ exportLayout, showMessage, hideMessage, confirmDialog });
        const processMessage = createProcessMessage({ fetchPost });
        setSForgeState(SForgeSymbols.MODEL_HANDLERS, {
            processMessage,
            kernelError,
            reloadSync: (data) => reloadSync(this, data),
        });

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
                            case "setRefDynamicText":
                                setRefDynamicText(data.data);
                                break;
                            case "reloadPlugin":
                                reloadPlugin(this, data.data);
                                break;
                            case "reloadEmojiConf":
                                reloadEmoji();
                                break;
                            case "reloaddoc":
                                reloadSync(this, { upsertRootIDs: [data.data], removeRootIDs: [] }, false, false, true);
                                break;
                            case "syncMergeResult":
                                reloadSync(this, data.data);
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
                                break;
                            case "statusbar":
                                progressStatus(data);
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
                                openFileById({ app: this, id: data.data.id, action: [Constants.CB_GET_FOCUS] });
                                break;
                        }
                    }
                }
        });

        window.siyuan = {
            zIndex: 10,
            isReady: false,
            notebooks: [],
            transactions: [],
            reqIds: {},
            backStack: [],
            layout: {},
            dialogs: [],
            blockPanels: [],
            closedTabs: [],
            ctrlIsPressed: false,
            altIsPressed: false,
            languages: {},
            ws: mainWs,
        };
        fetchPost("/api/system/getConf", {}, async (response) => {
            addScriptSync(`${Constants.PROTYLE_CDN}/js/lute/lute.min.js?v=${Constants.SIYUAN_VERSION}`, "protyleLuteScript");
            addScript(`${Constants.PROTYLE_CDN}/js/protyle-html.js?v=${Constants.SIYUAN_VERSION}`, "protyleWcHtmlScript");
            const config = installAppConfiguration(response.data.conf, response.data.isPublish, {startNotebookRefresh: false});
            // 配置注入后提前请求笔记本列表，插件初始化前等待其完成。
            const notebookPromise = setNoteBook();
            ensureUILayout();
            setBodyHighlight();
            await notebookPromise;
            await loadPlugins(this);
            await getLocalStorage();
            await loadSiyuanLanguages(config.appearance.lang);
                    // 加载 Forge 翻译
                    const { loadForgeI18n } = await import("../util/siyuanEnvironments/forgeI18n.getI18n.environment");
                    await loadForgeI18n();
                    // 初始化 S-Forge 扩展功能
                    const { initSForge } = await import("../config/sforge.init");
                    await initSForge({ isMobile: false });
                    // 初始化智能工具箱状态栏按钮
                    const { initSmartToolboxStatusButton } = await import("../sforge/panel");
                    initSmartToolboxStatusButton();
                    // 初始化 MAGI 状态栏按钮
                    const { initMagiStatusButton } = await import("../magi/panel/magiStatusButton");
                    initMagiStatusButton();
                    window.siyuan.menus = new Menus(this);
                    fetchPost("/api/setting/getCloudUser", {}, async userResponse => {
                        window.siyuan.user = userResponse.data;
                        await init(this);
                        setTitle("", true);
                        initMessage();
                        window.siyuan.isReady = true;
                        mainWs.flushMainMessages();
                    });
        });
        initBlockPopover(this);
    }
}

new App();
