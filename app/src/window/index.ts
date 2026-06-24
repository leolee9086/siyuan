import { Constants } from "../constants";
import { Menus } from "../menus";
import { Model } from "../layout/Model";
import "../assets/scss/base.scss";
import { initBlockPopover } from "../block/popover";
import { addScript, addScriptSync } from "../protyle/util/addScript";
import { genUUID } from "../util/platform/genID";
import { fetchGet, fetchPost } from "../util/network/fetch";
import { addBaseURL, getDocDisplayName, redirectToCheckAuth, setNoteBook } from "../util/file/pathName";
import { exportLayout } from "../layout/layout-serialization";
import { openFileById } from "../editor/utils.openFileById";
import {
    kernelError,
    processSync,
    progressBackgroundTask,
    progressLoading,
    progressStatus,
    setDefRefCount,
    transactionError
} from "../dialog/processSystem";
import { setTitle } from "../util/processTitle";
import { reloadSync } from "../dialog/processSystem/reloadSync";
import { setRefDynamicText } from "../dialog/processSystem/setRefDynamicText";
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
import { setBodyHighlight } from "../util/assets/assets";
import { setSForgeState } from "../config/sforge.global";
import { SForgeSymbols } from "../config/sforge.symbols";
import { createProcessMessage, setProcessMessageUIDependencies } from "../util/network/processMessage";

class App {
    public plugins: import("../plugin").Plugin[] = [];
    public appId: string;

    constructor() {
        addBaseURL();
        this.appId = Constants.SIYUAN_APPID;
        setProcessMessageUIDependencies({ exportLayout, showMessage, hideMessage, confirmDialog });
        const processMessage = createProcessMessage({ fetchPost });
        setSForgeState(SForgeSymbols.MODEL_HANDLERS, { processMessage, kernelError, reloadSync });

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
                                openFileById({ app: this, id: data.data.id, action: [Constants.CB_GET_FOCUS] });
                                break;
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
            ws: mainWs,
        };
        fetchPost("/api/system/getConf", {}, async (response) => {
            addScriptSync(`${Constants.PROTYLE_CDN}/js/lute/lute.min.js?v=${Constants.SIYUAN_VERSION}`, "protyleLuteScript");
            addScript(`${Constants.PROTYLE_CDN}/js/protyle-html.js?v=${Constants.SIYUAN_VERSION}`, "protyleWcHtmlScript");
            window.siyuan.config = response.data.conf;
            setBodyHighlight();
            window.siyuan.isPublish = response.data.isPublish;
            await loadPlugins(this);
            getLocalStorage(() => {
                fetchGet(`/appearance/langs/${window.siyuan.config.appearance.lang}.json?v=${Constants.SIYUAN_VERSION}`, async (lauguages: IObject) => {
                    window.siyuan.languages = lauguages;
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
                    fetchPost("/api/setting/getCloudUser", {}, userResponse => {
                        window.siyuan.user = userResponse.data;
                        init(this);
                        setTitle("", true);
                        initMessage();
                    });
                });
            });
        });
        setNoteBook();
        initBlockPopover(this);
    }
}

new App();
